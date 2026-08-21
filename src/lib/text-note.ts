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

/**
 * Size to write into content.json. Zero stays the theme default - the same
 * rule as TextContent.storedFontSize on the tablet. A chosen size is 10-48.
 */
export function storedFontSize(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.min(TEXT_LARGEST_SIZE, Math.max(TEXT_SMALLEST_SIZE, Math.round(points)));
}

/**
 * Size after the visible control reports `picked`. While stored is 0 the
 * field shows TEXT_DEFAULT_SIZE as a preview; echoing that 17 must not
 * persist, or a tap on the control freezes the note at 17 after sync.
 * Choosing any other 10-48 (or 17 once the stored size is already a pick)
 * writes a real size. 0 goes back to the theme default.
 */
export function persistFontSize(stored: number, picked: number): number {
  if (!Number.isFinite(picked)) return stored;
  if (stored <= 0 && Math.round(picked) === TEXT_DEFAULT_SIZE) return 0;
  return storedFontSize(picked);
}

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
  „zdjecie (2).png". Tytuł w cudzysłowie (stary zapis szerokości z tabletu)
  odcinamy dopiero potem, żeby nawias w nazwie pliku nie uciął adresu.
*/
const IMAGE_LINE = /^!\[([^\]]*)\]\((.+)\)\s*$/;

/*
  Rozmiar zdjęcia w treści. Markdown sam z siebie nie ma na to miejsca, więc
  kanoniczny zapis to dopisek w opisie: `![zdjęcie|60%](assets/kot.gif)`.
  Tablet kiedyś pisał szerokość w tytule: `![zdjęcie](assets/kot.gif "60%")`.
  Oba odczyty muszą dać to samo, a zapis zawsze wraca do postaci z kreską -
  inaczej synchronizacja gubi rozmiar: opis|60% lądował na tablecie jako sam
  tekst, a zdjęcie rosło na całą szerokość.

  Z pliku czytamy, co stoi (także 10% ze starego suwaka w aplikacji). Przy
  zapisie ściągamy do 20-100%, bo taki próg ma strona i nowy suwak.
*/
const ALT_WIDTH = /^(.*?)\s*\|\s*(\d{1,3})\s*%$/;
const TITLE_WIDTH = /^(\d{1,3})%$/;

export const IMAGE_FULL_WIDTH = 100;
export const IMAGE_SMALLEST_WIDTH = 20;
/** O tyle procent zmienia się zdjęcie od jednego kliknięcia. */
export const IMAGE_WIDTH_STEP = 10;

/** Procent z pliku: bez dolnego progu, tylko 400% ścinamy do 100. */
function percentFromFile(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return IMAGE_FULL_WIDTH;
  return Math.min(IMAGE_FULL_WIDTH, Math.max(1, Math.round(n)));
}

/**
 * Rozbija środek `](…)` na adres i opcjonalny tytuł w cudzysłowie.
 * Tytuł to stary zapis szerokości z tabletu.
 */
export function readImageDestination(inside: string): { target: string; title: string } {
  const titled = /^(.*)\s+"([^"]*)"\s*$/.exec(inside);
  if (titled) return { target: titled[1].trim(), title: titled[2] };
  return { target: inside.trim(), title: "" };
}

/**
 * Czyta opis zdjęcia: sam opis i szerokość (100 = na całą szerokość).
 * Drugi argument to tytuł z `](adres "60%")` - gdy w opisie nie ma kreski.
 */
export function readImageAlt(raw: string, title = ""): { alt: string; width: number } {
  const fromAlt = raw.match(ALT_WIDTH);
  if (fromAlt) return { alt: fromAlt[1], width: percentFromFile(fromAlt[2]) };
  const fromTitle = TITLE_WIDTH.exec(title.trim());
  if (fromTitle) return { alt: raw, width: percentFromFile(fromTitle[1]) };
  return { alt: raw, width: IMAGE_FULL_WIDTH };
}

/** Składa opis z powrotem. Zdjęcie na całą szerokość nie potrzebuje dopisku. */
export function writeImageAlt(alt: string, width: number): string {
  const clean = readImageAlt(alt).alt;
  const clamped = clampImageWidth(width);
  return clamped >= IMAGE_FULL_WIDTH ? clean : `${clean}|${clamped}%`;
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
    const dest = readImageDestination(image[2]);
    const { alt, width } = readImageAlt(image[1], dest.title);
    blocks.push({ kind: "image", alt, target: dest.target, width });
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