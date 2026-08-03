"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { shareMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { shareUrl, createShare } from "@/lib/sharing";
import {
  upsertNoteForUser,
  upsertCodeNoteForUser,
  setNoteDeletedForUser,
  setNoteFavoriteForUser,
  purgeNoteForUser,
} from "@/lib/note-write";
import { buildTextNoteContent, parseExistingTextDocument } from "@/lib/text-note";
import { buildCodeNoteContent, parseCodeNote, guessLanguageFromTitle } from "@/lib/code-note";
import { LANGUAGES, run, runnerState } from "@/lib/code-runner";
import { checkLimit, takeSlot } from "@/lib/run-limits";
import {
  mayUpload,
  resolveUploadMime,
  storeAttachment,
  deleteAttachment,
} from "@/lib/files";
import { reserveBytes, changeUsed } from "@/lib/quota";

export type Result = { error?: string; success?: string };

const textNoteForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  markdown: z.string().max(2_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveTextNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = textNoteForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    markdown: data.get("markdown") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." };
  }

  const title = parsed.data.title.trim() || "Bez nazwy";
  const markdown = parsed.data.markdown;
  const existingId = parsed.data.noteId;

  let noteId = existingId;
  let existingDocument = null;
  let baseVersion = parsed.data.baseVersion ?? 0;
  let favorite = false;
  let tags: string[] | undefined;

  if (existingId) {
    const row = await prisma.note.findUnique({
      where: { id: existingId },
      select: {
        id: true,
        ownerId: true,
        kind: true,
        content: true,
        version: true,
        deletedAt: true,
        favorite: true,
        tags: true,
      },
    });
    if (!row || row.deletedAt) return { error: "Nie ma takiej notatki." };
    if (row.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };
    if (row.kind !== "TEXT") {
      return { error: "Na stronie da się na razie poprawiać tylko notatki tekstowe." };
    }
    existingDocument = parseExistingTextDocument(row.content);
    favorite = row.favorite;
    tags = row.tags ? row.tags.split("|").filter(Boolean) : [];
    if (baseVersion <= 0) baseVersion = row.version;
  } else {
    noteId = randomUUID();
    baseVersion = 0;
  }

  const content = buildTextNoteContent({
    id: noteId!,
    title,
    markdown,
    existing: existingDocument,
  });

  const outcome = await upsertNoteForUser(user.id, {
    id: noteId!,
    title,
    kind: "TEXT",
    content,
    baseVersion,
    favorite,
    tags,
  });

  if (outcome.status === "error") {
    return { error: outcome.message };
  }
  if (outcome.status === "conflict") {
    return {
      error:
        outcome.message +
        " Odśwież stronę, żeby zobaczyć wersję z serwera, i zapisz jeszcze raz jeśli trzeba.",
    };
  }

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);

  if (!existingId) {
    redirect(`/note/${noteId}`);
  }

  return {
    success:
      outcome.status === "unchanged"
        ? "Nic się nie zmieniło."
        : `Zapisane (wersja ${outcome.version}).`,
  };
}

const codeNoteForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  language: z.string().min(1).max(32),
  source: z.string().max(200_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveCodeNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = codeNoteForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    language: data.get("language") ?? "python",
    source: data.get("source") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." };
  }

  const language = parsed.data.language;
  if (!LANGUAGES.some((entry) => entry.id === language)) {
    return { error: "Ten język nie jest obsługiwany na serwerze." };
  }

  const title =
    parsed.data.title.trim() ||
    `program.${LANGUAGES.find((entry) => entry.id === language)?.extension ?? "txt"}`;
  const source = parsed.data.source;
  const existingId = parsed.data.noteId;

  let noteId = existingId;
  let baseVersion = parsed.data.baseVersion ?? 0;
  let favorite = false;
  let tags: string[] | undefined;
  let existingMeta: { format?: number; createdAt?: number; tags?: string[]; favorite?: boolean } | null =
    null;

  if (existingId) {
    const row = await prisma.note.findUnique({
      where: { id: existingId },
      select: {
        id: true,
        ownerId: true,
        kind: true,
        content: true,
        version: true,
        deletedAt: true,
        favorite: true,
        tags: true,
      },
    });
    if (!row || row.deletedAt) return { error: "Nie ma takiej notatki." };
    if (row.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };
    if (row.kind !== "CODE") return { error: "To nie jest notatka z kodem." };
    favorite = row.favorite;
    tags = row.tags ? row.tags.split("|").filter(Boolean) : [];
    if (baseVersion <= 0) baseVersion = row.version;
    try {
      const parsedDoc = JSON.parse(row.content) as {
        format?: number;
        createdAt?: number;
        tags?: string[];
        favorite?: boolean;
      };
      existingMeta = parsedDoc;
    } catch {
      existingMeta = { favorite, tags };
    }
  } else {
    noteId = randomUUID();
    baseVersion = 0;
  }

  const content = buildCodeNoteContent({
    id: noteId!,
    title,
    language,
    source,
    existing: existingMeta,
  });

  const outcome = await upsertCodeNoteForUser(user.id, {
    id: noteId!,
    title,
    content,
    baseVersion,
    favorite,
    tags,
  });

  if (outcome.status === "error") return { error: outcome.message };
  if (outcome.status === "conflict") {
    return {
      error:
        outcome.message +
        " Odśwież stronę, żeby zobaczyć wersję z serwera, i zapisz jeszcze raz jeśli trzeba.",
    };
  }

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);

  if (!existingId) redirect(`/note/${noteId}`);

  return {
    success:
      outcome.status === "unchanged"
        ? "Nic się nie zmieniło."
        : `Zapisane (wersja ${outcome.version}).`,
  };
}

export type RunCodeResult = {
  error?: string;
  output?: string;
  errors?: string;
  exitCode?: number | null;
  interrupted?: boolean;
  timeMs?: number;
  disabled?: string;
};

export async function runCodeAction(
  _previous: RunCodeResult,
  data: FormData,
): Promise<RunCodeResult> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  if (!user.canRunCode) {
    return {
      error: "Administrator wyłączył uruchamianie kodu na tym koncie.",
      disabled: "Konto",
    };
  }

  const state = await runnerState();
  if (!state.works) {
    return { error: state.description, disabled: "Serwer" };
  }

  const language = String(data.get("language") ?? "").trim();
  const code = String(data.get("code") ?? data.get("source") ?? "");
  const input = String(data.get("input") ?? "");

  if (!language) return { error: "Wybierz język." };
  if (!code.trim()) return { error: "Nie ma czego uruchomić." };

  const limit = checkLimit(user.id);
  if (!limit.allowed) return { error: limit.message };

  const slot = takeSlot();
  if (!slot.taken) return { error: slot.message };

  try {
    const result = await run(language, code, input);
    return {
      output: result.output,
      errors: result.errors,
      exitCode: result.exitCode,
      interrupted: result.interrupted,
      timeMs: result.timeMs,
    };
  } finally {
    slot.release();
  }
}

export async function trashNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await setNoteDeletedForUser(user.id, noteId, true);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  revalidatePath(`/note/${noteId}`);
  redirect("/library");
}

export async function restoreNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await setNoteDeletedForUser(user.id, noteId, false);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  revalidatePath(`/note/${noteId}`);
  redirect(`/note/${noteId}`);
}

export async function purgeNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await purgeNoteForUser(user.id, noteId);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: "Notatka skasowana na stałe." };
}

export async function toggleFavorite(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  const next = String(data.get("favorite") ?? "") === "1";
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await setNoteFavoriteForUser(user.id, noteId, next);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);
  return { success: next ? "Dodano do ulubionych." : "Usunięto z ulubionych." };
}

export async function uploadAttachment(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  const file = data.get("file");
  let name = String(data.get("name") ?? "").trim();

  if (!noteId) return { error: "Brak identyfikatora notatki." };
  if (!(file instanceof File)) return { error: "Wybierz plik." };
  if (!name) name = file.name || "plik";

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };

  if (!mayUpload(file.type)) {
    return { error: "Ten rodzaj pliku nie jest przyjmowany. Wolno wysyłać zdjęcia i rysunki." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = resolveUploadMime(file.type, buffer);
  if (!mime) {
    return {
      error:
        "Zawartość pliku nie zgadza się z zadeklarowanym rodzajem. Wolno wysyłać zdjęcia i rysunki.",
    };
  }

  const previous = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
    select: { id: true, sizeBytes: true, path: true, hash: true },
  });

  const added = buffer.byteLength - (previous?.sizeBytes ?? 0);
  const room = await reserveBytes(user.id, added);
  if (!room.ok) return { error: room.reason };

  let stored;
  try {
    stored = await storeAttachment(user.id, noteId, name, buffer);
  } catch (problem) {
    await changeUsed(user.id, -added);
    return {
      error: problem instanceof Error ? problem.message : "Nie udało się zapisać pliku.",
    };
  }

  if (previous && previous.hash !== stored.hash) {
    await deleteAttachment(previous.path);
  }

  try {
    await prisma.attachment.upsert({
      where: { noteId_name: { noteId, name } },
      create: {
        noteId,
        name,
        mime,
        sizeBytes: stored.sizeBytes,
        path: stored.path,
        hash: stored.hash,
      },
      update: {
        mime,
        sizeBytes: stored.sizeBytes,
        path: stored.path,
        hash: stored.hash,
      },
    });
  } catch (problem) {
    await changeUsed(user.id, -added);
    throw problem;
  }

  revalidatePath(`/note/${noteId}`);
  return { success: `Dodano załącznik „${name}".` };
}

export async function removeAttachment(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const noteId = String(data.get("noteId") ?? "");
  const name = String(data.get("name") ?? "");
  if (!noteId || !name) return { error: "Brakuje danych załącznika." };

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true },
  });
  if (!note) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
  });
  if (!attachment) return { success: "Tego załącznika już nie ma." };

  await deleteAttachment(attachment.path);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await changeUsed(user.id, -attachment.sizeBytes);

  revalidatePath(`/note/${noteId}`);
  return { success: `Usunięto „${name}".` };
}

const form = z.object({
  noteId: z.string().min(1),
  permission: z.enum(["READ", "EDIT"]),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  anonymousAllowed: z.union([z.literal("on"), z.literal("")]).optional(),
  validDays: z.coerce.number().int().min(0).max(3650).optional(),
});

export async function share(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = form.safeParse({
    noteId: data.get("noteId"),
    permission: data.get("permission") ?? "READ",
    email: data.get("email") ?? "",
    anonymousAllowed: data.get("anonymousAllowed") ?? "",
    validDays: data.get("validDays") ?? 0,
  });
  if (!parsed.success) return { error: "Sprawdź wpisane dane." };

  const { noteId, permission, email, anonymousAllowed, validDays } = parsed.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, title: true, ownerId: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) {
    return { error: "Udostępnić można tylko własną notatkę." };
  }

  const token = await createShare({
    noteId,
    sharedById: user.id,
    permission,
    email: email || null,
    anonymousAllowed: anonymousAllowed === "on",
    expiresInDays: validDays && validDays > 0 ? validDays : null,
  });

  const link = shareUrl(settings.baseUrl, token);
  revalidatePath(`/note/${noteId}`);

  if (email) {
    const sent = await send(
      shareMail(
        email,
        link,
        user.name ?? user.login,
        note.title || "Bez nazwy",
        permission === "EDIT",
      ),
    );
    return {
      success: sent
        ? `Wysłaliśmy wiadomość na ${email}.`
        : `Udostępnienie gotowe, ale maila nie udało się wysłać. Przekaż odnośnik samodzielnie: ${link}`,
    };
  }

  return { success: `Odnośnik gotowy: ${link}` };
}

export async function revokeShare(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const id = String(data.get("id") ?? "");
  const existing = await prisma.share.findUnique({
    where: { id },
    include: { note: { select: { id: true, ownerId: true } } },
  });

  if (!existing) return { success: "Tego udostępnienia już nie ma." };
  if (existing.note.ownerId !== user.id) {
    return { error: "To nie jest Twoja notatka." };
  }

  await prisma.share.delete({ where: { id } });
  revalidatePath(`/note/${existing.note.id}`);

  return { success: "Udostępnienie cofnięte. Ten odnośnik przestał działać." };
}

/** Used by new-code page to pick a default language from the title. */
export async function suggestLanguageFromTitle(title: string): Promise<string | null> {
  return guessLanguageFromTitle(title);
}
