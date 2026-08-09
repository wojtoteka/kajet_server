/*
  Cała droga jednej prośby do asystenta, w jednym miejscu.

  Wołają to dwie rzeczy: punkt /api/v1/notes/[id]/ai-edit (aplikacja, token
  urządzenia) i akcja serwerowa panelu WWW (przeglądarka, ciasteczko sesji).
  Różnią się wyłącznie tym, SKĄD wiadomo, kto pyta - reszta, od bramki dostępu
  po zapis, ma być co do kroku ta sama. Inaczej za miesiąc jedna z tych dróg
  ma limit, a druga nie.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import type { Words } from "@/lib/i18n";
import { aiNoteTooBig } from "@/lib/i18n";
import { upsertCodeNoteForUser, upsertNoteForUser } from "@/lib/note-write";
import { aiGate } from "./access";
import { aiHandles } from "./tools";
import { viewForModel } from "./note-view";
import { recentTurns, rememberTurn, sweepOldTurns } from "./history";
import { askGemini, type AiFailure } from "./gemini";
import { applyAiCall, derivedTitleFor } from "./apply";
import { titleIsOwn } from "@/lib/note-title";
import { checkAiLimit } from "./limits";
import { recordAiCall } from "./usage";

export type AiRunner = {
  id: string;
  canUseAi: boolean;
  aiConsentAt: Date | null;
  aiDailyLimit: number;
};

export type AiRunResult =
  | {
      status: "zmieniono";
      opis: string;
      /** Tytuł po zmianie - asystent mógł go nadać notatce bez własnego. */
      title: string;
      version: number;
      updatedAt: number;
      content: string;
    }
  | { status: "pytanie"; pytanie: string }
  | { status: "konflikt"; version: number }
  /** Bramka zamknięta tak, że nie wolno przyznać, iż asystent istnieje. */
  | { status: "ukryte" }
  | { status: "blad"; code: string; message: string; httpStatus: number };

export async function runAiEdit(input: {
  user: AiRunner;
  noteId: string;
  instruction: string;
  /** Zero albo brak znaczy „nie sprawdzaj wersji". */
  baseVersion?: number;
  words: Words;
}): Promise<AiRunResult> {
  const { user, noteId, instruction, words } = input;

  const gate = aiGate(user);
  if (!gate.ok) {
    if (gate.hidden) return { status: "ukryte" };
    return {
      status: "blad",
      code: gate.code,
      message: words.apiAiNoConsent,
      httpStatus: gate.status,
    };
  }

  if (!instruction.trim()) {
    return { status: "blad", code: "bad-request", message: words.apiAiNoInstruction, httpStatus: 400 };
  }

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      kind: true,
      content: true,
      version: true,
      favorite: true,
      tags: true,
      deletedAt: true,
    },
  });

  if (!note || note.deletedAt) {
    return { status: "blad", code: "no-note", message: words.apiNoteNotOnServer, httpStatus: 404 };
  }
  if (note.ownerId !== user.id) {
    return { status: "blad", code: "not-yours", message: words.apiNoteNotYours, httpStatus: 403 };
  }
  if (!aiHandles(note.kind)) {
    return { status: "blad", code: "wrong-kind", message: words.apiAiWrongKind, httpStatus: 400 };
  }

  const wanted = input.baseVersion ?? 0;
  if (wanted > 0 && wanted !== note.version) {
    return { status: "konflikt", version: note.version };
  }

  const view = viewForModel(note.kind, note.content);
  if (!view.ok) {
    return { status: "blad", code: "unreadable", message: view.powod, httpStatus: 400 };
  }
  // Za duża notatka odmawia OD RAZU, zanim cokolwiek pójdzie do Google - i mówi
  // wprost ile ma znaków, zamiast po cichu obciąć jej połowę.
  if (view.chars > settings.ai.maxChars) {
    return {
      status: "blad",
      code: "too-big",
      message: aiNoteTooBig(words, view.chars, settings.ai.maxChars),
      httpStatus: 413,
    };
  }

  // Limit sprawdzany dopiero wtedy, gdy żądanie ma sens - odbicie się od bramki
  // albo od rozmiaru notatki nie ma prawa zjadać komuś dziennej puli.
  const room = await checkAiLimit(user, words);
  if (!room.allowed) {
    return { status: "blad", code: "ai-limit", message: room.message, httpStatus: 429 };
  }

  const history = await recentTurns(user.id, noteId);

  const answer = await askGemini({
    kind: note.kind,
    title: note.title,
    material: view.material,
    instruction,
    history,
    // Ten sam rachunek, który apply.ts wykona jeszcze raz przy zapisie.
    // Tu służy do powiedzenia modelowi, czy wolno mu tytuł zaproponować;
    // tam - do rozstrzygnięcia, czy wolno go przyjąć.
    titleIsOwn: titleIsOwn(note.title, derivedTitleFor(note.kind, note.content)),
  });

  // Do rozliczeń idzie każde wywołanie, także nieudane: za tokeny wejściowe
  // płaci się i wtedy, gdy odpowiedź do niczego się nie nadała.
  await recordAiCall({
    userId: user.id,
    kind: note.kind,
    usage: answer.usage,
    tookMs: answer.tookMs,
    model: answer.model,
    failure: answer.ok ? undefined : answer.failure,
  });

  if (!answer.ok) {
    return {
      status: "blad",
      code: "ai-failed",
      message: failureMessage(answer.failure, words),
      httpStatus: statusFor(answer.failure),
    };
  }

  const outcome = applyAiCall({
    kind: note.kind,
    noteId: note.id,
    title: note.title,
    content: note.content,
    toolName: answer.toolName,
    args: answer.args,
  });

  if (outcome.kind === "blad") {
    // Notatka została nietknięta - zdanie mówi, co asystent próbował zrobić.
    return { status: "blad", code: "ai-refused", message: outcome.powod, httpStatus: 422 };
  }

  if (outcome.kind === "pytanie") {
    await remember(user.id, noteId, instruction, outcome.pytanie);
    return { status: "pytanie", pytanie: outcome.pytanie };
  }

  const tags = note.tags ? note.tags.split("|") : [];
  // Gwiazdka i znaczniki jadą z powrotem takie, jakie były: upsert nadpisuje
  // je tym, co dostanie, więc pominięcie ich skasowałoby jedno i drugie.
  //
  // Tytuł bierzemy z wyniku, nie z wiersza notatki: asystent mógł go nadać
  // notatce, która swojego jeszcze nie miała. Musi trafić w OBA miejsca -
  // do treści notatki (robi to apply.ts) i do kolumny w bazie (tutaj).
  // Pominięcie któregokolwiek dałoby notatkę z innym tytułem w spisie niż
  // w środku, a przy najbliższej synchronizacji jedno nadpisałoby drugie.
  const saved =
    note.kind === "CODE"
      ? await upsertCodeNoteForUser(user.id, {
          id: note.id,
          title: outcome.title,
          content: outcome.content,
          baseVersion: note.version,
          favorite: note.favorite,
          tags,
        })
      : await upsertNoteForUser(user.id, {
          id: note.id,
          title: outcome.title,
          kind: note.kind,
          content: outcome.content,
          baseVersion: note.version,
          favorite: note.favorite,
          tags,
        });

  if (saved.status === "error") {
    return {
      status: "blad",
      code: saved.code,
      message: saved.message,
      httpStatus: saved.httpStatus,
    };
  }
  if (saved.status === "conflict") {
    // Ktoś zapisał notatkę w czasie, gdy model nad nią pracował. Jego wersja
    // wygrywa - nic nie nadpisujemy.
    return { status: "konflikt", version: saved.onServer.version };
  }
  if (saved.status === "unchanged" || saved.status === "gone") {
    return { status: "blad", code: "ai-refused", message: words.apiAiNoAnswer, httpStatus: 422 };
  }

  await remember(user.id, noteId, instruction, outcome.opis);

  return {
    status: "zmieniono",
    opis: outcome.opis,
    title: outcome.title,
    version: saved.version,
    updatedAt: saved.updatedAt,
    content: outcome.content,
  };
}

async function remember(
  userId: string,
  noteId: string,
  instruction: string,
  reply: string,
): Promise<void> {
  await rememberTurn(userId, noteId, instruction, reply);
  // Sprzątanie przeterminowanych rozmów przy okazji zapisu. Dla kilkunastu
  // kont to zupełnie wystarcza zamiast osobnego zadania w tle.
  await sweepOldTurns();
}

function failureMessage(failure: AiFailure, words: Words): string {
  if (failure === "timeout") return words.apiAiTimeout;
  if (failure === "rate-limit") return words.apiAiBusy;
  if (failure === "no-call") return words.apiAiNoAnswer;
  return words.apiAiBroken;
}

function statusFor(failure: AiFailure): number {
  if (failure === "timeout") return 504;
  if (failure === "rate-limit") return 429;
  if (failure === "no-call") return 422;
  return 502;
}
