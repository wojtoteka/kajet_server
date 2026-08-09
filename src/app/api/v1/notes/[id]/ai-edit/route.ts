/*
  POST /api/v1/notes/[id]/ai-edit - poproszenie asystenta o zmianę notatki.

  Aplikacja wysyła TYLKO identyfikator notatki i polecenie. Treści nie wysyła:
  serwer ją ma, a te same bajty w obie strony po to, żeby zaraz odesłać je do
  Google, byłyby marnowaniem łącza na tablecie.

  Zapis idzie tą samą drogą co zwykły zapis z aplikacji - upsertNoteForUser
  albo upsertCodeNoteForUser. Dzięki temu version i hash rosną normalnie,
  a inne urządzenia dostaną zmianę zwykłym pobraniem z kursorem, jakby ktoś
  poprawił notatkę na trzecim urządzeniu. Synchronizacji nikt tu nie dotyka.

  Zwycięstwo świeższej edycji człowieka bierze się stąd samo: baseVersion do
  zapisu jest odczytany PRZED wywołaniem modelu, więc gdy w trakcie tych kilku
  sekund ktoś zapisze notatkę, istniejące wykrywanie konfliktu odmówi zapisu.
*/

import { z } from "zod";
import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { aiNoteTooBig } from "@/lib/i18n";
import { settings } from "@/lib/settings";
import { upsertCodeNoteForUser, upsertNoteForUser } from "@/lib/note-write";
import { aiGate, aiRefusal } from "@/lib/ai/access";
import { aiHandles } from "@/lib/ai/tools";
import { viewForModel } from "@/lib/ai/note-view";
import { recentTurns, rememberTurn, sweepOldTurns } from "@/lib/ai/history";
import { askGemini, type AiFailure } from "@/lib/ai/gemini";
import { applyAiCall } from "@/lib/ai/apply";

export { OPTIONS } from "@/lib/api";

const body = z.object({
  instruction: z.string().trim().min(1).max(2_000),
  /**
   * Wersja, którą ma u siebie urządzenie. Nieobowiązkowa: starsze aplikacje
   * jej nie przyślą. Gdy przyjdzie i nie zgadza się z serwerem, odmawiamy od
   * razu - bez sensu jest zmieniać treść, której człowiek jeszcze nie widział.
   */
  baseVersion: z.number().int().min(0).optional(),
});

export const POST = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;

    const gate = aiGate(result.user);
    if (!gate.ok) return aiRefusal(gate);

    const words = await apiWords();
    const { id: noteId } = await params;

    let data: unknown;
    try {
      data = await request.json();
    } catch {
      return error("bad-request", words.apiBadRequest, 400);
    }

    const parsed = body.safeParse(data);
    if (!parsed.success) return error("bad-request", words.apiAiNoInstruction, 400);

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

    if (!note || note.deletedAt) return error("no-note", words.apiNoteNotOnServer, 404);
    if (note.ownerId !== result.user.id) {
      return error("not-yours", words.apiNoteNotYours, 403);
    }
    if (!aiHandles(note.kind)) return error("wrong-kind", words.apiAiWrongKind, 400);

    if (parsed.data.baseVersion !== undefined && parsed.data.baseVersion !== note.version) {
      return json({ status: "konflikt", version: note.version });
    }

    const view = viewForModel(note.kind, note.content);
    if (!view.ok) return error("unreadable", view.powod, 400);
    // Za duża notatka odmawia OD RAZU, zanim cokolwiek pójdzie do Google -
    // i mówi wprost ile ma znaków, zamiast po cichu obciąć jej połowę.
    if (view.chars > settings.ai.maxChars) {
      return error(
        "too-big",
        aiNoteTooBig(words, view.chars, settings.ai.maxChars),
        413,
      );
    }

    const history = await recentTurns(result.user.id, noteId);

    const answer = await askGemini({
      kind: note.kind,
      title: note.title,
      material: view.material,
      instruction: parsed.data.instruction,
      history,
    });

    if (!answer.ok) {
      return error("ai-failed", failureMessage(answer.failure, words), statusFor(answer.failure));
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
      return error("ai-refused", outcome.powod, 422);
    }

    if (outcome.kind === "pytanie") {
      await remember(result.user.id, noteId, parsed.data.instruction, outcome.pytanie);
      return json({ status: "pytanie", pytanie: outcome.pytanie });
    }

    const tags = note.tags ? note.tags.split("|") : [];
    // Gwiazdka i znaczniki jadą z powrotem takie, jakie były: upsert nadpisuje
    // je tym, co dostanie, więc pominięcie ich skasowałoby jedno i drugie.
    const saved =
      note.kind === "CODE"
        ? await upsertCodeNoteForUser(result.user.id, {
            id: note.id,
            title: note.title,
            content: outcome.content,
            baseVersion: note.version,
            favorite: note.favorite,
            tags,
          })
        : await upsertNoteForUser(result.user.id, {
            id: note.id,
            title: note.title,
            kind: note.kind,
            content: outcome.content,
            baseVersion: note.version,
            favorite: note.favorite,
            tags,
          });

    if (saved.status === "error") {
      return error(saved.code, saved.message, saved.httpStatus);
    }
    if (saved.status === "conflict") {
      // Ktoś zapisał notatkę w czasie, gdy model nad nią pracował. Jego wersja
      // wygrywa - nic nie nadpisujemy.
      return json({ status: "konflikt", version: saved.onServer.version });
    }
    if (saved.status === "unchanged" || saved.status === "gone") {
      return error("ai-refused", words.apiAiNoAnswer, 422);
    }

    await remember(result.user.id, noteId, parsed.data.instruction, outcome.opis);

    return json({
      status: "zmieniono",
      opis: outcome.opis,
      version: saved.version,
      updatedAt: saved.updatedAt,
      // Nowa treść wraca od razu: to i tak dane tego konta, a bez nich
      // aplikacja musiałaby po nie wrócić osobnym żądaniem, zanim pokaże wynik.
      content: outcome.content,
    });
  },
);

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

function failureMessage(failure: AiFailure, words: Awaited<ReturnType<typeof apiWords>>): string {
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
