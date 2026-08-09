import { readDocument, type NoteDocument } from "./document";

/*
  Whole-note appearance of a TEXT note - the same fields the tablet stores in
  content.json (TextContent in the app). fontSize 0 means the default size,
  textColor is an Android ARGB int (0 = default colour).
*/
export type TextAppearance = {
  font: string;
  fontSize: number;
  textColor: number;
  align: string;
};

export const TEXT_FONTS = [
  { id: "body", label: "Tekstowy", labelEn: "Body" },
  { id: "heading", label: "Nagłówkowy", labelEn: "Display" },
  { id: "mono", label: "Maszynowy", labelEn: "Typewriter" },
] as const;

export const TEXT_DEFAULT_SIZE = 17;
export const TEXT_SMALLEST_SIZE = 10;
export const TEXT_LARGEST_SIZE = 48;

/** Build content.json for a TEXT note in the shape the tablet expects. */
export function buildTextNoteContent(options: {
  id: string;
  title: string;
  markdown: string;
  appearance?: Partial<TextAppearance>;
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
      font: options.appearance?.font ?? existing?.text?.font ?? "body",
      fontSize: options.appearance?.fontSize ?? existing?.text?.fontSize ?? 0,
      textColor: options.appearance?.textColor ?? existing?.text?.textColor ?? 0,
      align: options.appearance?.align ?? existing?.text?.align ?? "left",
    },
  });
}

export function textMarkdownFromContent(content: string): string {
  const document = readDocument(content);
  return document?.text?.markdown ?? "";
}

export function textAppearanceFromContent(content: string): TextAppearance {
  const document = readDocument(content);
  return {
    font: document?.text?.font ?? "body",
    fontSize: document?.text?.fontSize ?? 0,
    textColor: document?.text?.textColor ?? 0,
    align: document?.text?.align ?? "left",
  };
}

export function parseExistingTextDocument(content: string): NoteDocument | null {
  return readDocument(content);
}

/*
  Widok blokowy treści - tak jak w aplikacji (TextEditor.kt): zdjęcia widać
  jako zdjęcia, a nie jako zapis `![...](...)`. Sama notatka dalej jest jednym
  markdownem; bloki to tylko sposób pokazania go w polu do pisania.
*/
export type TextBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; target: string; width: number };

/*
  Wiersz ze zdjęciem. Adres łapiemy zachłannie do ostatniego nawiasu w wierszu,
  tak samo jak podgląd, bo nazwy plików potrafią same mieć nawiasy:
  „zdjecie (2).png".
*/
const IMAGE_LINE = /^!\[([^\]]*)\]\((.+)\)\s*$/;

/*
  Rozmiar zdjęcia w treści. Markdown sam z siebie nie ma na to miejsca, więc
  szerokość dopisujemy do opisu zdjęcia - `![zdjęcie|60%](assets/kot.gif)` -
  bo tego kawałka nie widać w gotowym wyglądzie i żaden czytnik markdownu się
  o niego nie potyka: aplikacja i tak pokaże samo zdjęcie, tylko na całą
  szerokość. Liczymy w procentach szerokości notatki, żeby na telefonie i na
  tablecie zdjęcie zajmowało tę samą część kartki.
*/
const ALT_WIDTH = /^(.*?)\s*\|\s*(\d{1,3})\s*%$/;

export const IMAGE_FULL_WIDTH = 100;
export const IMAGE_SMALLEST_WIDTH = 20;
/** O tyle procent zmienia się zdjęcie od jednego kliknięcia. */
export const IMAGE_WIDTH_STEP = 10;

/** Czyta opis zdjęcia: sam opis i szerokość (100 = na całą szerokość). */
export function readImageAlt(raw: string): { alt: string; width: number } {
  const match = raw.match(ALT_WIDTH);
  if (!match) return { alt: raw, width: IMAGE_FULL_WIDTH };
  return { alt: match[1], width: clampImageWidth(Number(match[2])) };
}

/** Składa opis z powrotem. Zdjęcie na całą szerokość nie potrzebuje dopisku. */
export function writeImageAlt(alt: string, width: number): string {
  return width >= IMAGE_FULL_WIDTH ? alt : `${alt}|${clampImageWidth(width)}%`;
}

export function clampImageWidth(width: number): number {
  if (!Number.isFinite(width)) return IMAGE_FULL_WIDTH;
  return Math.min(IMAGE_FULL_WIDTH, Math.max(IMAGE_SMALLEST_WIDTH, Math.round(width)));
}

/**
 * Dzieli treść na bloki do pisania i bloki ze zdjęciem. Przy każdym zdjęciu -
 * przed nim i po nim - zostaje blok tekstu, nawet pusty: inaczej w notatce
 * złożonej z samych zdjęć nie byłoby gdzie kliknąć, żeby dopisać zdanie.
 */
export function splitTextBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let lines: string[] | null = null;

  const closeText = () => {
    blocks.push({ kind: "text", text: lines ? lines.join("\n") : "" });
    lines = null;
  };

  for (const line of markdown.split("\n")) {
    const image = line.match(IMAGE_LINE);
    if (!image) {
      (lines ??= []).push(line);
      continue;
    }
    closeText();
    const { alt, width } = readImageAlt(image[1]);
    blocks.push({ kind: "image", alt, target: image[2].trim(), width });
  }
  closeText();
  return blocks;
}

/**
 * Skleja bloki z powrotem w treść notatki. Puste bloki tekstu przepadają, bo
 * są tylko miejscem do pisania - notatka nie ma przez nie tyć o puste wiersze
 * przy każdym otwarciu.
 */
export function joinTextBlocks(blocks: TextBlock[]): string {
  return blocks
    .filter((block) => block.kind !== "text" || block.text !== "")
    .map((block) =>
      block.kind === "text"
        ? block.text
        : `![${writeImageAlt(block.alt, block.width)}](${block.target})`,
    )
    .join("\n");
}


/*
  Listy nie mają tu już własnej obsługi. W panelu WWW notatkę pisze się
  w polu z gotowym wyglądem (RichText.tsx), gdzie listę prowadzi sama
  przeglądarka - Enter zaczyna kolejną pozycję, a numerowanie liczy ona
  po swojemu. Zapis listy w markdownie robi lib/rich-text.ts.
*/