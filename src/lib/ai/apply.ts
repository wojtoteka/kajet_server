/*
  Poprawka od modelu -> gotowa treść notatki.

  Wszystko, co przyszło z zewnątrz, przechodzi tu przez zod, ZANIM cokolwiek
  zostanie zapisane. Model potrafi oddać liczbę tam, gdzie ma być napis, pustą
  tablicę operacji albo rozmiar pisma spoza skali - i wtedy notatka ma zostać
  nietknięta, a człowiek ma zobaczyć w swoim języku, co poszło nie tak.

  Nowa treść powstaje ISTNIEJĄCYMI budowniczymi (buildTextNoteContent i spółka),
  tymi samymi, których używa panel WWW. Dzięki temu pola, o których model nic
  nie wie - rysunki w tekście, pismo odręczne w węzłach, znaczniki, data
  powstania, ustawienie widoku mapy - przechodzą przez zmianę same z siebie,
  bo nikt ich po drodze nie dotyka.
*/

import { z } from "zod";
import {
  TEXT_LARGEST_SIZE,
  TEXT_SMALLEST_SIZE,
  buildTextNoteContent,
  parseExistingTextDocument,
  textMarkdownFromContent,
} from "@/lib/text-note";
import { buildCodeNoteContent, parseCodeNote } from "@/lib/code-note";
import {
  buildMindMapNoteContent,
  parseExistingMindMapDocument,
  parseMindMapNote,
} from "@/lib/mindmap-note";
import { readDocument } from "@/lib/document";
import { fitTitle, titleFromMarkdown, titleFromMindMap, titleIsOwn } from "@/lib/note-title";
import type { Words } from "@/lib/i18n";
import { applyMindMapOperations } from "./mindmap-guard";
import { NAZWA_KOD, NAZWA_MAPA, NAZWA_PYTANIE, NAZWA_TEKST, type AiKind } from "./tools";

const opisPola = z.string().trim().min(1).max(300);
/*
  Tytuł od modelu. Granica jest hojna CELOWO: gdyby była ciasna, model
  wklejający zamiast tytułu cały akapit wywracałby zod, a razem z nim całą
  zmianę - i człowiek traciłby gotowe wypracowanie przez to, że KajetAI źle
  nazwał notatkę. Tytuł jest dodatkiem do zmiany, nie warunkiem jej przyjęcia;
  za długi zostaje przycięty przez fitTitle.
*/
const tytulPola = z.string().trim().min(1).max(2_000).optional();

const tekstArgs = z.object({
  markdown: z.string().max(400_000),
  opis: opisPola,
  tytul: tytulPola,
  font: z.enum(["body", "heading", "mono"]).optional(),
  fontSize: z.number().int().min(TEXT_SMALLEST_SIZE).max(TEXT_LARGEST_SIZE).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const kodArgs = z.object({
  source: z.string().max(400_000),
  opis: opisPola,
  tytul: tytulPola,
});

const mapaArgs = z.object({
  operacje: z
    .array(
      z.object({
        rodzaj: z.enum(["dodaj", "usun", "usun_galaz", "zmien_tekst", "przenies"]),
        id: z.string().trim().min(1).max(80),
        text: z.string().max(2_000).optional(),
        rodzicId: z.string().trim().max(80).nullable().optional(),
      }),
    )
    .min(1)
    .max(60),
  opis: opisPola,
  tytul: tytulPola,
});

const pytanieArgs = z.object({
  pytanie: z.string().trim().min(1).max(500),
});

export type AiOutcome =
  /** Gotowa nowa treść notatki, do przekazania upsertowi. */
  | { kind: "zmiana"; content: string; opis: string; title: string }
  /** Model nie zrozumiał polecenia i pyta. Notatka nietknięta. */
  | { kind: "pytanie"; pytanie: string }
  /** Coś się nie zgadza. Nic nie zapisujemy - także częściowo. */
  | { kind: "blad"; powod: string };

export type AiCallInput = {
  kind: AiKind;
  noteId: string;
  title: string;
  /** Treść notatki taka, jaka leży teraz w bazie. */
  content: string;
  toolName: string;
  args: unknown;
  /** Język, w którym ma wyjść odmowa - zdanie czyta człowiek, nie model. */
  words: Words;
};

export function applyAiCall(input: AiCallInput): AiOutcome {
  const { kind, toolName, args, words } = input;

  if (toolName === NAZWA_PYTANIE) {
    const parsed = pytanieArgs.safeParse(args);
    if (!parsed.success) return zle(words.aiNoQuestionAsked);
    return { kind: "pytanie", pytanie: parsed.data.pytanie };
  }

  // Narzędzie od innego typu notatki. Nie powinno się zdarzyć, bo do modelu
  // jadą tylko dwa - ale gdyby przyszło, notatka zostaje nietknięta.
  if (toolName !== expectedTool(kind)) {
    return zle(words.aiUnknownTool);
  }

  if (kind === "TEXT") return zastosujTekst(input, args);
  if (kind === "CODE") return zastosujKod(input, args);
  return zastosujMape(input, args);
}

function expectedTool(kind: AiKind): string {
  return kind === "TEXT" ? NAZWA_TEKST : kind === "CODE" ? NAZWA_KOD : NAZWA_MAPA;
}

/**
 * Tytuł po zmianie.
 *
 * Model może nadać tytuł WYŁĄCZNIE notatce, która swojego jeszcze nie ma:
 * „Bez nazwy", nazwa nadana przez program albo tytuł podpowiedziany z treści.
 * Tytuł napisany przez człowieka zostaje nietknięty, choćby model przysłał
 * własny - to jego notatka, nie modelu.
 *
 * Sprawdzenie jest tu, a nie tylko w prompcie, bo prompt jest prośbą.
 */
function titleAfter(input: AiCallInput, proposed: string | undefined): string {
  if (!proposed) return input.title;
  const derived = derivedTitleFor(input.kind, input.content);
  if (titleIsOwn(input.title, derived)) return input.title;
  return fitTitle(proposed);
}

/**
 * Tytuł, jaki dałaby DZISIEJSZA treść notatki. Null, gdy nie ma z czego.
 *
 * Wołane w dwóch miejscach: tutaj, żeby rozstrzygnąć, czy wolno przyjąć tytuł
 * od modelu, i w run.ts, żeby powiedzieć modelowi, czy wolno mu go w ogóle
 * zaproponować. Muszą liczyć to samo, więc liczą tym samym.
 */
export function derivedTitleFor(kind: AiKind, content: string): string | null {
  if (kind === "TEXT") return titleFromMarkdown(textMarkdownFromContent(content));
  if (kind === "MINDMAP") {
    const mapa = parseMindMapNote(content);
    return mapa ? titleFromMindMap(mapa.nodes) : null;
  }
  return null;
}

/**
 * Nazwa pliku z zachowanym rozszerzeniem.
 *
 * Rozszerzenie decyduje o tym, czym plik JEST - jakim językiem go pokolorować
 * i czym uruchomić. Model nazywa treść, a nie wybiera język, więc rozszerzenie
 * bierzemy ze starej nazwy i doklejamy je z powrotem.
 */
function withSameExtension(oldTitle: string, proposed: string): string {
  const dot = oldTitle.lastIndexOf(".");
  const extension = dot > 0 ? oldTitle.slice(dot) : "";
  const bare = proposed.replace(/\.[a-z0-9]{1,8}$/i, "").trim();
  return `${bare || proposed}${extension}`;
}

function zle(powod: string): AiOutcome {
  return { kind: "blad", powod };
}

function zastosujTekst(input: AiCallInput, args: unknown): AiOutcome {
  const parsed = tekstArgs.safeParse(args);
  if (!parsed.success) {
    return zle(input.words.aiTextUnsavable);
  }

  const { markdown, opis, tytul, font, fontSize, align } = parsed.data;
  const title = titleAfter(input, tytul);
  const nothingChanged =
    markdown === textMarkdownFromContent(input.content) &&
    title === input.title &&
    font === undefined &&
    fontSize === undefined &&
    align === undefined;
  if (nothingChanged) return zle(input.words.aiTextUnchanged);

  const existing = parseExistingTextDocument(input.content);

  return {
    kind: "zmiana",
    opis,
    title,
    content: buildTextNoteContent({
      id: input.noteId,
      title,
      markdown,
      // Puste pola zostawiają wygląd taki, jaki był - budowniczy sam bierze
      // wtedy wartość z poprzedniej wersji notatki.
      appearance: { font, fontSize, align },
      existing,
    }),
  };
}

function zastosujKod(input: AiCallInput, args: unknown): AiOutcome {
  const parsed = kodArgs.safeParse(args);
  if (!parsed.success) {
    return zle(input.words.aiCodeUnsavable);
  }

  const teraz = parseCodeNote(input.content);
  if (!teraz) return zle(input.words.aiCodeNoteUnreadable);

  const proposed = parsed.data.tytul
    ? withSameExtension(input.title, parsed.data.tytul)
    : undefined;
  const title = titleAfter(input, proposed);

  if (parsed.data.source === teraz.source && title === input.title) {
    return zle(input.words.aiCodeUnchanged);
  }

  return {
    kind: "zmiana",
    opis: parsed.data.opis,
    title,
    content: buildCodeNoteContent({
      id: input.noteId,
      title,
      // Języka model nie dotyka: notatka nazwana analiza.py ma zostać
      // pythonem, choćby przepisał ją na coś innego.
      language: teraz.language,
      source: parsed.data.source,
      existing: readDocument(input.content) ?? undefined,
    }),
  };
}

function zastosujMape(input: AiCallInput, args: unknown): AiOutcome {
  const parsed = mapaArgs.safeParse(args);
  if (!parsed.success) {
    return zle(input.words.aiMapUnsavable);
  }

  const teraz = parseMindMapNote(input.content);
  if (!teraz) return zle(input.words.aiMindMapUnreadable);

  const wynik = applyMindMapOperations(
    { nodes: teraz.nodes, edges: teraz.edges },
    parsed.data.operacje,
    input.words,
  );
  // Uszkodzona mapa nie jest zapisywana ani w części. Powód idzie wprost do
  // człowieka, bo mówi konkretnie, co KajetAI próbował zrobić.
  if (!wynik.ok) return zle(wynik.powod);

  return {
    kind: "zmiana",
    opis: parsed.data.opis,
    title: titleAfter(input, parsed.data.tytul),
    content: buildMindMapNoteContent({
      id: input.noteId,
      title: titleAfter(input, parsed.data.tytul),
      nodes: wynik.nodes,
      edges: wynik.edges,
      viewX: teraz.viewX,
      viewY: teraz.viewY,
      zoom: teraz.zoom,
      existing: parseExistingMindMapDocument(input.content),
    }),
  };
}
