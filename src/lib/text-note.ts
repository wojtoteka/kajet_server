import { readDocument, type NoteDocument } from "./document";

/** Build content.json for a TEXT note in the shape the tablet expects. */
export function buildTextNoteContent(options: {
  id: string;
  title: string;
  markdown: string;
  existing?: NoteDocument | null;
}): string {
  const now = Date.now();
  const existing = options.existing;

  return JSON.stringify({
    format: existing?.format ?? 1,
    id: options.id,
    kind: "text",
    title: options.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    text: {
      markdown: options.markdown,
      drawings: existing?.text?.drawings ?? [],
    },
  });
}

export function textMarkdownFromContent(content: string): string {
  const document = readDocument(content);
  return document?.text?.markdown ?? "";
}

export function parseExistingTextDocument(content: string): NoteDocument | null {
  return readDocument(content);
}
