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
import { titleFromMarkdown, titleFromMindMap } from "@/lib/note-title";
import {
  upsertNoteForUser,
  upsertCodeNoteForUser,
  setNoteDeletedForUser,
  setNoteFavoriteForUser,
  purgeNoteForUser,
} from "@/lib/note-write";
import { buildTextNoteContent, parseExistingTextDocument } from "@/lib/text-note";
import {
  buildMindMapNoteContent,
  parseExistingMindMapDocument,
} from "@/lib/mindmap-note";
import {
  buildHandwritingNoteContent,
  parseExistingHandwritingDocument,
} from "@/lib/handwriting-note";
import { buildCodeNoteContent, parseCodeNote, guessLanguageFromTitle } from "@/lib/code-note";
import type { MindEdge, MindNode, Page } from "@/lib/document";
import { LANGUAGES, run, runnerState } from "@/lib/code-runner";
import { checkLimit, takeSlot } from "@/lib/run-limits";
import { currentWords } from "@/lib/language";
import {
  mayUpload,
  resolveUploadMime,
  safeAttachmentName,
  storeAttachment,
  deleteAttachment,
} from "@/lib/files";
import { reserveBytes, changeUsed } from "@/lib/quota";

export type Result = {
  error?: string;
  success?: string;
  copyable?: { value: string; label?: string };
  /** Wersja po zapisie — autozapis wysyła ją jako baseVersion kolejnego. */
  version?: number;
  /**
   * Identyfikator notatki założonej przez autozapis. Ręczny zapis nowej
   * notatki kończy się przekierowaniem, ale autozapis nie może wyrzucić
   * człowieka ze środka pisania — dostaje więc identyfikator i od tej pory
   * dopisuje do tej samej notatki (adres w pasku podmienia sama strona).
   */
  noteId?: string;
  /**
   * Nazwa świeżo wysłanego załącznika. Edytor wstawia po niej zdjęcie prosto
   * w treść notatki, zamiast kazać człowiekowi przepisywać nazwę ręcznie.
   */
  attachment?: { name: string };
};

/** Czy to zapis w tle (z useAutosave), czy kliknięcie w „Zapisz". */
function isAutosave(data: FormData): boolean {
  return String(data.get("autosave") ?? "") === "1";
}

const textNoteForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  markdown: z.string().max(2_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
  // Whole-note appearance, the same fields the tablet keeps in content.json.
  font: z.enum(["body", "heading", "mono"]).optional(),
  fontSize: z.coerce.number().min(0).max(48).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export async function saveTextNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = textNoteForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    markdown: data.get("markdown") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
    font: data.get("font") || undefined,
    fontSize: data.get("fontSize") ?? undefined,
    align: data.get("align") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const markdown = parsed.data.markdown;
  /*
    Pusty tytuł bierzemy z pierwszego wiersza treści - inaczej spis zapełniał
    się notatkami „Bez nazwy", nie do odróżnienia od siebie. Wpisany tytuł
    zawsze wygrywa.
  */
  const title = parsed.data.title.trim() || titleFromMarkdown(markdown) || "Bez nazwy";
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
      return { error: (await currentWords()).actOnlyTextNotes };
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
    appearance: {
      font: parsed.data.font,
      fontSize: parsed.data.fontSize,
      align: parsed.data.align,
    },
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
        (await currentWords()).actRefreshAfterConflict,
    };
  }

  revalidatePath("/library");
  // Przy autozapisie NIE odświeżamy ścieżki otwartej notatki: to przerysowuje
  // całą stronę w trakcie pisania. Nagłówek z numerem wersji poczeka do
  // najbliższego wejścia na stronę, treść i tak jest już na serwerze.
  if (!isAutosave(data)) revalidatePath(`/note/${noteId}`);

  if (!existingId && !isAutosave(data)) {
    redirect(`/note/${noteId}`);
  }

  return {
    success:
      outcome.status === "unchanged"
        ? (await currentWords()).actNothingChanged
        : `Zapisane (wersja ${outcome.version}).`,
    // Autozapis podaje tę wersję jako baseVersion następnego zapisu —
    // bez tego drugi zapis z rzędu wpadałby w konflikt sam ze sobą.
    version: outcome.version,
    noteId: existingId ? undefined : noteId,
  };
}

const mindMapForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  mindMapJson: z.string().max(5_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveMindMapNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = mindMapForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    mindMapJson: data.get("mindMapJson") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  let mapBody: {
    nodes: MindNode[];
    edges: MindEdge[];
    viewX?: number;
    viewY?: number;
    zoom?: number;
  };
  try {
    const raw = JSON.parse(parsed.data.mindMapJson) as {
      nodes?: MindNode[];
      edges?: MindEdge[];
      viewX?: number;
      viewY?: number;
      zoom?: number;
    };
    mapBody = {
      nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
      edges: Array.isArray(raw.edges) ? raw.edges : [],
      viewX: raw.viewX,
      viewY: raw.viewY,
      zoom: raw.zoom,
    };
  } catch {
    return { error: (await currentWords()).actMindMapUnreadable };
  }

  // Mapa bez tytułu nazywa się od pierwszego opisanego węzła - to prawie
  // zawsze jej środek, czyli temat całej mapy.
  const title =
    parsed.data.title.trim() || titleFromMindMap(mapBody.nodes) || "Bez nazwy";
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
    if (row.kind !== "MINDMAP") return { error: (await currentWords()).actNotAMindMap };
    existingDocument = parseExistingMindMapDocument(row.content);
    favorite = row.favorite;
    tags = row.tags ? row.tags.split("|").filter(Boolean) : [];
    if (baseVersion <= 0) baseVersion = row.version;
  } else {
    noteId = randomUUID();
    baseVersion = 0;
  }

  const content = buildMindMapNoteContent({
    id: noteId!,
    title,
    nodes: mapBody.nodes,
    edges: mapBody.edges,
    viewX: mapBody.viewX,
    viewY: mapBody.viewY,
    zoom: mapBody.zoom,
    existing: existingDocument,
  });

  const outcome = await upsertNoteForUser(user.id, {
    id: noteId!,
    title,
    kind: "MINDMAP",
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
        (await currentWords()).actRefreshAfterConflict,
    };
  }

  revalidatePath("/library");
  if (!isAutosave(data)) revalidatePath(`/note/${noteId}`);
  if (!existingId && !isAutosave(data)) redirect(`/note/${noteId}`);

  return {
    success:
      outcome.status === "unchanged"
        ? (await currentWords()).actNothingChanged
        : `Zapisane (wersja ${outcome.version}).`,
    // Autozapis podaje tę wersję jako baseVersion następnego zapisu —
    // bez tego drugi zapis z rzędu wpadałby w konflikt sam ze sobą.
    version: outcome.version,
    noteId: existingId ? undefined : noteId,
  };
}

const handwritingForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  handwritingJson: z.string().max(20_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveHandwritingNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = handwritingForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    handwritingJson: data.get("handwritingJson") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  let hwBody: { pageMode?: string; background?: string; pages: Page[] };
  try {
    const raw = JSON.parse(parsed.data.handwritingJson) as {
      pageMode?: string;
      background?: string;
      pages?: Page[];
    };
    if (!Array.isArray(raw.pages) || raw.pages.length === 0) {
      return { error: (await currentWords()).actHandwritingNeedsPage };
    }
    hwBody = {
      pageMode: raw.pageMode,
      background: raw.background,
      pages: raw.pages,
    };
  } catch {
    return { error: (await currentWords()).actHandwritingUnreadable };
  }

  const title = parsed.data.title.trim() || "Bez nazwy";
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
    if (row.kind !== "HANDWRITTEN") return { error: (await currentWords()).actNotHandwriting };
    existingDocument = parseExistingHandwritingDocument(row.content);
    favorite = row.favorite;
    tags = row.tags ? row.tags.split("|").filter(Boolean) : [];
    if (baseVersion <= 0) baseVersion = row.version;
  } else {
    noteId = randomUUID();
    baseVersion = 0;
  }

  const content = buildHandwritingNoteContent({
    id: noteId!,
    title,
    pages: hwBody.pages,
    pageMode: hwBody.pageMode,
    background: hwBody.background,
    existing: existingDocument,
  });

  const outcome = await upsertNoteForUser(user.id, {
    id: noteId!,
    title,
    kind: "HANDWRITTEN",
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
        (await currentWords()).actRefreshAfterConflict,
    };
  }

  revalidatePath("/library");
  if (!isAutosave(data)) revalidatePath(`/note/${noteId}`);
  if (!existingId && !isAutosave(data)) redirect(`/note/${noteId}`);

  return {
    success:
      outcome.status === "unchanged"
        ? (await currentWords()).actNothingChanged
        : `Zapisane (wersja ${outcome.version}).`,
    // Autozapis podaje tę wersję jako baseVersion następnego zapisu —
    // bez tego drugi zapis z rzędu wpadałby w konflikt sam ze sobą.
    version: outcome.version,
    noteId: existingId ? undefined : noteId,
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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = codeNoteForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    language: data.get("language") ?? "python",
    source: data.get("source") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const language = parsed.data.language;
  if (!LANGUAGES.some((entry) => entry.id === language)) {
    return { error: (await currentWords()).actLanguageUnsupported };
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
        (await currentWords()).actRefreshAfterConflict,
    };
  }

  revalidatePath("/library");
  if (!isAutosave(data)) revalidatePath(`/note/${noteId}`);

  if (!existingId && !isAutosave(data)) redirect(`/note/${noteId}`);

  return {
    success:
      outcome.status === "unchanged"
        ? (await currentWords()).actNothingChanged
        : `Zapisane (wersja ${outcome.version}).`,
    // Autozapis podaje tę wersję jako baseVersion następnego zapisu —
    // bez tego drugi zapis z rzędu wpadałby w konflikt sam ze sobą.
    version: outcome.version,
    noteId: existingId ? undefined : noteId,
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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  if (!user.canRunCode) {
    return {
      error: (await currentWords()).apiCodeRunningOffForAccount,
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

  if (!language) return { error: (await currentWords()).actPickLanguage };
  if (!code.trim()) return { error: (await currentWords()).apiNothingToRun };

  const limit = checkLimit(user.id);
  if (!limit.allowed) return { error: limit.message };

  const slot = takeSlot(await currentWords());
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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await purgeNoteForUser(user.id, noteId);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: (await currentWords()).actNoteDeletedForGood };
}

export async function toggleFavorite(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const noteId = String(data.get("noteId") ?? "");
  const next = String(data.get("favorite") ?? "") === "1";
  if (!noteId) return { error: "Brak identyfikatora notatki." };

  const outcome = await setNoteFavoriteForUser(user.id, noteId, next);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);
  return { success: next ? (await currentWords()).actAddedToFavorites : (await currentWords()).actRemovedFromFavorites };
}

export async function uploadAttachment(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const noteId = String(data.get("noteId") ?? "");
  const file = data.get("file");
  let name = String(data.get("name") ?? "").trim();

  if (!noteId) return { error: "Brak identyfikatora notatki." };
  if (!(file instanceof File)) return { error: "Wybierz plik." };
  // Nazwa po oczyszczeniu, bo wchodzi wprost w odnośnik `assets/...` w treści
  // notatki - spacja albo nawias rozbiłyby go i zamiast zdjęcia zostałby tekst.
  name = safeAttachmentName(name || file.name || "plik");

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };

  if (!mayUpload(file.type)) {
    return { error: (await currentWords()).apiFileKindRefused };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = resolveUploadMime(file.type, buffer);
  if (!mime) {
    return {
      error:
        (await currentWords()).apiFileContentMismatch,
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
      error: problem instanceof Error ? problem.message : (await currentWords()).apiFileSaveFailed,
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
  return { success: `Dodano załącznik „${name}".`, attachment: { name } };
}

export async function removeAttachment(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const noteId = String(data.get("noteId") ?? "");
  const name = String(data.get("name") ?? "");
  if (!noteId || !name) return { error: (await currentWords()).actAttachmentDataMissing };

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true },
  });
  if (!note) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
  });
  if (!attachment) return { success: (await currentWords()).actAttachmentGone };

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
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = form.safeParse({
    noteId: data.get("noteId"),
    permission: data.get("permission") ?? "READ",
    email: data.get("email") ?? "",
    anonymousAllowed: data.get("anonymousAllowed") ?? "",
    validDays: data.get("validDays") ?? 0,
  });
  if (!parsed.success) return { error: (await currentWords()).actCheckWhatYouTyped };

  const { noteId, permission, email, anonymousAllowed, validDays } = parsed.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, title: true, ownerId: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) {
    return { error: (await currentWords()).actOnlyOwnNote };
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
    return sent
      ? { success: `Wysłaliśmy wiadomość na ${email}.` }
      : {
          success: (await currentWords()).actShareMailFailed,
          copyable: { value: link, label: (await currentWords()).copyLink },
        };
  }

  return {
    success: (await currentWords()).actLinkReady,
    copyable: { value: link, label: (await currentWords()).copyLink },
  };
}

export async function revokeShare(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const id = String(data.get("id") ?? "");
  const existing = await prisma.share.findUnique({
    where: { id },
    include: { note: { select: { id: true, ownerId: true } } },
  });

  if (!existing) return { success: (await currentWords()).actShareGone };
  if (existing.note.ownerId !== user.id) {
    return { error: "To nie jest Twoja notatka." };
  }

  await prisma.share.delete({ where: { id } });
  revalidatePath(`/note/${existing.note.id}`);

  return { success: (await currentWords()).actShareRevoked };
}

/** Used by new-code page to pick a default language from the title. */
export async function suggestLanguageFromTitle(title: string): Promise<string | null> {
  return guessLanguageFromTitle(title);
}
