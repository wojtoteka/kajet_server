import { LANGUAGES, findLanguage } from "@/lib/code-runner";
import { readDocument } from "@/lib/document";
import {
  LIBRARY_FILE_TYPES,
  isLibraryCodeLanguage,
  libraryFileType,
} from "@/lib/library-file";

export type CodeNoteBody = {
  language: string;
  source: string;
};

/** Build content.json for a CODE note stored only on the web / sync-excluded path. */
export function buildCodeNoteContent(options: {
  id: string;
  title: string;
  language: string;
  source: string;
  existing?: {
    format?: number;
    createdAt?: number;
    tags?: string[];
    favorite?: boolean;
  } | null;
}): string {
  const now = Date.now();
  const existing = options.existing;

  return JSON.stringify({
    format: existing?.format ?? 1,
    id: options.id,
    kind: "code",
    title: options.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    code: {
      language: options.language,
      source: options.source,
    },
  });
}

export function parseCodeNote(content: string): CodeNoteBody | null {
  const document = readDocument(content);
  if (!document) {
    // Plain source fallback (legacy / imported file).
    if (content.trim()) return { language: "python", source: content };
    return null;
  }

  const code = (document as { code?: { language?: string; source?: string; code?: string } }).code;
  if (code && typeof code === "object") {
    const language = String(code.language ?? "python");
    const source = String(code.source ?? code.code ?? "");
    return { language, source };
  }

  // Some exports may put source at the top level.
  const top = document as { language?: string; source?: string; code?: string };
  if (typeof top.source === "string" || typeof top.code === "string") {
    return {
      language: String(top.language ?? "python"),
      source: String(top.source ?? top.code ?? ""),
    };
  }

  return null;
}

export function languageOptions(): {
  id: string;
  namePl: string;
  nameEn?: string;
  preview?: boolean;
}[] {
  const runtime = LANGUAGES.map(({ id, namePl, nameEn, preview }) => ({
    id,
    namePl,
    nameEn,
    preview,
  }));
  const runtimeIds = new Set(runtime.map((language) => language.id));
  const appOnly = LIBRARY_FILE_TYPES.filter((type) => !runtimeIds.has(type.language)).map(
    (type) => ({
      id: type.language,
      namePl: type.namePl,
      nameEn: type.nameEn,
    }),
  );
  return [...runtime, ...appOnly];
}

export function guessLanguageFromTitle(title: string): string | null {
  return libraryFileType(title)?.language ?? null;
}

/** Języki zapisywalne w pliku CODE: runtimes serwera plus formaty aplikacji. */
export function isCodeNoteLanguage(language: string): boolean {
  return Boolean(findLanguage(language)) || isLibraryCodeLanguage(language);
}

export function languageLabel(id: string): string {
  return findLanguage(id)?.namePl ?? id;
}
