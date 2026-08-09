/*
  Ustawienia pisania - to, co człowiek wybiera raz w „Moje konto", a co potem
  obowiązuje w edytorach na stronie.

  Dwie rzeczy trzeba tu rozróżnić:

  - krój, rozmiar i wyrównanie to wygląd NOWEJ notatki tekstowej. Te trzy pola
    notatka nosi w sobie (content.json), więc wybór z ustawień staje się jej
    stanem początkowym i po synchronizacji zna go też aplikacja;
  - autozapis i grube pismo dotyczą samego pisania na stronie. Do pliku notatki
    nie wchodzą - aplikacja nie ma dla nich miejsca, a dopisywanie do
    content.json pól, których tablet nie zna, mogłoby mu popsuć odczyt.
*/

import { prisma } from "./prisma";
import {
  TEXT_FONTS,
  TEXT_LARGEST_SIZE,
  TEXT_SMALLEST_SIZE,
} from "./text-note";

export type WritingSettings = {
  /** Notatka zapisuje się sama po pauzie w pisaniu. */
  autoSave: boolean;
  /** Krój nowej notatki tekstowej: body / heading / mono. */
  font: string;
  /** Rozmiar nowej notatki. Zero znaczy „domyślny". */
  fontSize: number;
  /** Wyrównanie nowej notatki: left / center / right. */
  align: string;
  /** Grube pismo w polu do pisania. */
  bold: boolean;
};

export const DEFAULT_WRITING: WritingSettings = {
  autoSave: true,
  font: "body",
  fontSize: 0,
  align: "left",
  bold: false,
};

export const TEXT_ALIGNMENTS = [
  { id: "left", label: "Do lewej", labelEn: "Align left" },
  { id: "center", label: "Do środka", labelEn: "Align centre" },
  { id: "right", label: "Do prawej", labelEn: "Align right" },
] as const;

/** Kolumny konta, w których siedzą te ustawienia - do `select` Prismy. */
export const WRITING_COLUMNS = {
  autoSave: true,
  textFont: true,
  textSize: true,
  textAlign: true,
  textBold: true,
} as const;

export type WritingColumns = {
  autoSave: boolean;
  textFont: string;
  textSize: number;
  textAlign: string;
  textBold: boolean;
};

function knownFont(font: string): string {
  return TEXT_FONTS.some((entry) => entry.id === font) ? font : DEFAULT_WRITING.font;
}

function knownAlign(align: string): string {
  return TEXT_ALIGNMENTS.some((entry) => entry.id === align) ? align : DEFAULT_WRITING.align;
}

/** Rozmiar z pola: zero (domyślny) albo liczba w dozwolonym przedziale. */
function knownSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.min(TEXT_LARGEST_SIZE, Math.max(TEXT_SMALLEST_SIZE, Math.round(size)));
}

/** Wiersz konta na ustawienia. Braki (stara baza, brak konta) na domyślne. */
export function readWritingSettings(row: Partial<WritingColumns> | null | undefined): WritingSettings {
  if (!row) return DEFAULT_WRITING;
  return {
    autoSave: row.autoSave ?? DEFAULT_WRITING.autoSave,
    font: knownFont(row.textFont ?? DEFAULT_WRITING.font),
    fontSize: knownSize(row.textSize ?? DEFAULT_WRITING.fontSize),
    align: knownAlign(row.textAlign ?? DEFAULT_WRITING.align),
    bold: row.textBold ?? DEFAULT_WRITING.bold,
  };
}

/** Formularz z „Moje konto" na ustawienia. Nieznane wartości lecą na domyślne. */
export function writingSettingsFromForm(data: FormData): WritingSettings {
  return {
    autoSave: data.get("autoSave") != null,
    font: knownFont(String(data.get("font") ?? "")),
    fontSize: knownSize(Number(data.get("fontSize") ?? 0)),
    align: knownAlign(String(data.get("align") ?? "")),
    bold: data.get("bold") != null,
  };
}

/** Ustawienia na kolumny konta - w drugą stronę niż `readWritingSettings`. */
export function writingColumns(settings: WritingSettings): WritingColumns {
  return {
    autoSave: settings.autoSave,
    textFont: settings.font,
    textSize: settings.fontSize,
    textAlign: settings.align,
    textBold: settings.bold,
  };
}

/**
 * Ustawienia właściciela notatki. Bez zalogowania (notatka z odnośnika)
 * obowiązują domyślne - cudze ustawienia nikogo nie dotyczą.
 */
export async function writingSettingsFor(
  userId: string | null | undefined,
): Promise<WritingSettings> {
  if (!userId) return DEFAULT_WRITING;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: WRITING_COLUMNS,
  });
  return readWritingSettings(row);
}
