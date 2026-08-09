"use server";

/*
  Zapis notatki przez odnośnik do udostępnienia.

  Te akcje różnią się od zapisu właściciela (note/[id]/actions.ts) jednym:
  prawo do zapisu wynika z UDOSTĘPNIENIA, nie z własności. Każde wywołanie od
  nowa sprawdza odnośnik (tokenWriteAccess), więc cofnięcie udostępnienia albo
  jego wygaśnięcie odcina zapis natychmiast, także przy otwartej stronie.

  Notatka wynika z tokenu, nigdy z pola formularza - inaczej dałoby się wziąć
  odnośnik do jednej notatki i zapisać nim inną. Zapis idzie przez
  upsertNoteForUser z identyfikatorem WŁAŚCICIELA: miejsce na dysku liczy się
  jemu, a wersje i konflikty działają tak samo jak przy synchronizacji
  z tabletem. Ulubione, etykiety i folder zostają nietknięte - odbiorca
  poprawia treść, nie porządek cudzej biblioteki.

  Token przyjeżdża jako dowiązany argument (.bind na stronie), nie jako pole
  formularza - strona zna go z adresu, a edytory nie muszą o nim wiedzieć.
*/

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Note } from "@prisma/client";
import { tokenWriteAccess } from "@/lib/sharing";
import { titleFromMarkdown, titleFromMindMap } from "@/lib/note-title";
import { upsertNoteForUser, upsertCodeNoteForUser, type UpsertNoteResult } from "@/lib/note-write";
import { buildTextNoteContent, parseExistingTextDocument } from "@/lib/text-note";
import {
  buildMindMapNoteContent,
  parseExistingMindMapDocument,
} from "@/lib/mindmap-note";
import {
  buildHandwritingNoteContent,
  parseExistingHandwritingDocument,
} from "@/lib/handwriting-note";
import { buildCodeNoteContent } from "@/lib/code-note";
import { LANGUAGES } from "@/lib/code-runner";
import type { MindEdge, MindNode, Page } from "@/lib/document";
import { currentWords } from "@/lib/language";
import type { Result } from "@/app/note/[id]/actions";

/** Czy to zapis w tle (z useAutosave), czy kliknięcie w „Zapisz". */
function isAutosave(data: FormData): boolean {
  return String(data.get("autosave") ?? "") === "1";
}

/**
 * Wspólny początek każdej akcji: odnośnik musi wpuszczać do zapisu, a notatka
 * być tego rodzaju, którego spodziewa się edytor.
 */
async function writableNote(
  token: string,
  kind: Note["kind"],
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  if (!token) return { ok: false, error: (await currentWords()).apiLinkDead };

  const access = await tokenWriteAccess(token);
  if (!access.ok) return { ok: false, error: access.reason };

  const note = access.access.note;
  if (note.kind !== kind) {
    const words = await currentWords();
    const mismatch: Record<string, string> = {
      TEXT: words.actOnlyTextNotes,
      MINDMAP: words.actNotAMindMap,
      HANDWRITTEN: words.actNotHandwriting,
      CODE: "To nie jest notatka z kodem.",
    };
    return { ok: false, error: mismatch[kind] ?? words.actCheckWhatYouTyped };
  }

  return { ok: true, note };
}

/** Wynik z upsertu na odpowiedź akcji - ten sam kształt co u właściciela. */
async function finishSave(
  outcome: UpsertNoteResult,
  noteId: string,
  autosave: boolean,
): Promise<Result> {
  if (outcome.status === "error") return { error: outcome.message };
  if (outcome.status === "gone") {
    return { error: (await currentWords()).apiLinkDead };
  }
  if (outcome.status === "conflict") {
    return {
      error: outcome.message + (await currentWords()).actRefreshAfterConflict,
    };
  }

  revalidatePath("/library");
  // Przy autozapisie nie odświeżamy strony notatki - to samo co u właściciela:
  // przerysowanie w trakcie pisania przeszkadza, a treść i tak już jest tu.
  if (!autosave) revalidatePath(`/note/${noteId}`);

  return {
    success:
      outcome.status === "unchanged"
        ? (await currentWords()).actNothingChanged
        : `Zapisane (wersja ${outcome.version}).`,
    version: outcome.version,
  };
}

function noteTags(note: Note): string[] {
  return note.tags ? note.tags.split("|").filter(Boolean) : [];
}

const sharedTextForm = z.object({
  title: z.string().max(300),
  markdown: z.string().max(2_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
  font: z.enum(["body", "heading", "mono"]).optional(),
  fontSize: z.coerce.number().min(0).max(48).optional(),
  textColor: z.coerce.number().int().min(-2147483648).max(2147483647).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export async function saveSharedTextNote(
  token: string,
  _previous: Result,
  data: FormData,
): Promise<Result> {
  const parsed = sharedTextForm.safeParse({
    title: data.get("title") ?? "",
    markdown: data.get("markdown") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
    font: data.get("font") || undefined,
    fontSize: data.get("fontSize") ?? undefined,
    textColor: data.get("textColor") ?? undefined,
    align: data.get("align") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const target = await writableNote(token, "TEXT");
  if (!target.ok) return { error: target.error };
  const note = target.note;

  const markdown = parsed.data.markdown;
  const title = parsed.data.title.trim() || titleFromMarkdown(markdown) || "Bez nazwy";
  const baseVersion =
    parsed.data.baseVersion && parsed.data.baseVersion > 0
      ? parsed.data.baseVersion
      : note.version;

  const content = buildTextNoteContent({
    id: note.id,
    title,
    markdown,
    appearance: {
      font: parsed.data.font,
      fontSize: parsed.data.fontSize,
      textColor: parsed.data.textColor,
      align: parsed.data.align,
    },
    existing: parseExistingTextDocument(note.content),
  });

  const outcome = await upsertNoteForUser(note.ownerId, {
    id: note.id,
    title,
    kind: "TEXT",
    content,
    baseVersion,
    favorite: note.favorite,
    tags: noteTags(note),
  });

  return finishSave(outcome, note.id, isAutosave(data));
}

const sharedMindMapForm = z.object({
  title: z.string().max(300),
  mindMapJson: z.string().max(5_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveSharedMindMapNote(
  token: string,
  _previous: Result,
  data: FormData,
): Promise<Result> {
  const parsed = sharedMindMapForm.safeParse({
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

  const target = await writableNote(token, "MINDMAP");
  if (!target.ok) return { error: target.error };
  const note = target.note;

  const title =
    parsed.data.title.trim() || titleFromMindMap(mapBody.nodes) || "Bez nazwy";
  const baseVersion =
    parsed.data.baseVersion && parsed.data.baseVersion > 0
      ? parsed.data.baseVersion
      : note.version;

  const content = buildMindMapNoteContent({
    id: note.id,
    title,
    nodes: mapBody.nodes,
    edges: mapBody.edges,
    viewX: mapBody.viewX,
    viewY: mapBody.viewY,
    zoom: mapBody.zoom,
    existing: parseExistingMindMapDocument(note.content),
  });

  const outcome = await upsertNoteForUser(note.ownerId, {
    id: note.id,
    title,
    kind: "MINDMAP",
    content,
    baseVersion,
    favorite: note.favorite,
    tags: noteTags(note),
  });

  return finishSave(outcome, note.id, isAutosave(data));
}

const sharedHandwritingForm = z.object({
  title: z.string().max(300),
  handwritingJson: z.string().max(20_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveSharedHandwritingNote(
  token: string,
  _previous: Result,
  data: FormData,
): Promise<Result> {
  const parsed = sharedHandwritingForm.safeParse({
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
    hwBody = { pageMode: raw.pageMode, background: raw.background, pages: raw.pages };
  } catch {
    return { error: (await currentWords()).actHandwritingUnreadable };
  }

  const target = await writableNote(token, "HANDWRITTEN");
  if (!target.ok) return { error: target.error };
  const note = target.note;

  const title = parsed.data.title.trim() || "Bez nazwy";
  const baseVersion =
    parsed.data.baseVersion && parsed.data.baseVersion > 0
      ? parsed.data.baseVersion
      : note.version;

  const content = buildHandwritingNoteContent({
    id: note.id,
    title,
    pages: hwBody.pages,
    pageMode: hwBody.pageMode,
    background: hwBody.background,
    existing: parseExistingHandwritingDocument(note.content),
  });

  const outcome = await upsertNoteForUser(note.ownerId, {
    id: note.id,
    title,
    kind: "HANDWRITTEN",
    content,
    baseVersion,
    favorite: note.favorite,
    tags: noteTags(note),
  });

  return finishSave(outcome, note.id, isAutosave(data));
}

const sharedCodeForm = z.object({
  title: z.string().max(300),
  language: z.string().min(1).max(32),
  source: z.string().max(200_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveSharedCodeNote(
  token: string,
  _previous: Result,
  data: FormData,
): Promise<Result> {
  const parsed = sharedCodeForm.safeParse({
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

  const target = await writableNote(token, "CODE");
  if (!target.ok) return { error: target.error };
  const note = target.note;

  const title =
    parsed.data.title.trim() ||
    `program.${LANGUAGES.find((entry) => entry.id === language)?.extension ?? "txt"}`;
  const baseVersion =
    parsed.data.baseVersion && parsed.data.baseVersion > 0
      ? parsed.data.baseVersion
      : note.version;

  let existingMeta: {
    format?: number;
    createdAt?: number;
    tags?: string[];
    favorite?: boolean;
  } | null = null;
  try {
    existingMeta = JSON.parse(note.content) as typeof existingMeta;
  } catch {
    existingMeta = { favorite: note.favorite, tags: noteTags(note) };
  }

  const content = buildCodeNoteContent({
    id: note.id,
    title,
    language,
    source: parsed.data.source,
    existing: existingMeta,
  });

  const outcome = await upsertCodeNoteForUser(note.ownerId, {
    id: note.id,
    title,
    content,
    baseVersion,
    favorite: note.favorite,
    tags: noteTags(note),
  });

  return finishSave(outcome, note.id, isAutosave(data));
}
