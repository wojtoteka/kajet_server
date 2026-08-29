import { Buffer } from "node:buffer";
import { findLanguage } from "@/lib/code-runner";
import { readDocument, type NoteKind } from "@/lib/document";
import { parseCodeNote } from "@/lib/code-note";

/**
 * Granice dotyczą wyłącznie ciężkiego edytora/podglądu w przeglądarce. Plik
 * nadal zostaje w Kajecie, synchronizuje się i można go pobrać bez obcinania.
 *
 * Tekst ma niższy próg, bo przed pokazaniem przechodzi przez parser Markdown i
 * powstaje z niego wiele edytowalnych węzłów. Kod siedzi w jednym textarea, ale
 * dostaje też numery wierszy i (dla HTML-u) osobny dokument podglądu. Mapy i
 * pismo odręczne mają najwyższy próg: ich JSON jest zwykle obszerny, choć nie
 * każdy bajt zamienia się w osobny element strony.
 */
export const NOTE_DISPLAY_LIMITS: Record<NoteKind, number> = {
  TEXT: 250 * 1024,
  CODE: 400 * 1024,
  MINDMAP: 500 * 1024,
  HANDWRITTEN: 500 * 1024,
};

export type NoteForDisplay = {
  kind: NoteKind;
  content: string;
  sizeBytes: number;
};

export type NoteDisplayDecision = {
  sizeBytes: number;
  limitBytes: number;
  tooLarge: boolean;
};

/**
 * Nie ufamy bezwarunkowo staremu sizeBytes: notatki z dawnych wydań mogły mieć
 * tam zero. Pomiar UTF-8 odpowiada temu, co liczy zapis i co naprawdę trzeba
 * przesłać do komponentu klienckiego.
 */
export function noteDisplayDecision(note: NoteForDisplay): NoteDisplayDecision {
  const measured = Buffer.byteLength(note.content, "utf8");
  const sizeBytes = Math.max(note.sizeBytes, measured);
  const limitBytes = NOTE_DISPLAY_LIMITS[note.kind];
  return { sizeBytes, limitBytes, tooLarge: sizeBytes > limitBytes };
}

export type NoteForDownload = {
  id: string;
  kind: NoteKind;
  title: string;
  content: string;
};

export type DownloadableNote = {
  body: string;
  fileName: string;
  contentType: string;
};

/**
 * Treść do pobrania jest tym, co użytkownik edytuje, a nie opakowaniem
 * content.json. Dzięki temu za duży plik .log/.py wraca jako zwykły plik. Dla
 * mapy i notatki odręcznej zachowujemy pełny JSON, bo to ich właściwy format.
 */
export function downloadableNote(note: NoteForDownload): DownloadableNote {
  if (note.kind === "CODE") {
    const code = parseCodeNote(note.content);
    const extension = code ? findLanguage(code.language)?.extension ?? "txt" : "txt";
    return {
      body: code?.source ?? note.content,
      fileName: downloadName(note.title, extension, note.id),
      contentType: "text/plain; charset=utf-8",
    };
  }

  if (note.kind === "TEXT") {
    const document = readDocument(note.content);
    const markdown = document?.text?.markdown;
    return {
      body: typeof markdown === "string" ? markdown : note.content,
      fileName: downloadName(note.title, "md", note.id),
      contentType: "text/markdown; charset=utf-8",
    };
  }

  return {
    body: note.content,
    fileName: downloadName(note.title, "kajet.json", note.id),
    contentType: "application/json; charset=utf-8",
  };
}

/** Nazwa bez ścieżek i znaków, które mogłyby popsuć nagłówek HTTP. */
export function downloadName(title: string, extension: string, id: string): string {
  const leaf = title.split(/[\\/]/).pop()?.trim() ?? "";
  const clean = leaf
    .replace(/[\u0000-\u001f\u007f";]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 180)
    .trim();
  const fallback = `kajet-${id.slice(0, 12)}`;
  const base = clean || fallback;

  // Tytuł przyniesiony z aplikacji (np. raport.log) zachowuje swój format.
  if (/\.[A-Za-z0-9][A-Za-z0-9._+-]{0,15}$/.test(base)) return base;
  return `${base}.${extension}`;
}

/** ASCII fallback + pełna nazwa UTF-8 dla współczesnych przeglądarek. */
export function downloadDisposition(fileName: string): string {
  const fallback = fileName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._+-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "") || "kajet-note";
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (mark) =>
    `%${mark.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
