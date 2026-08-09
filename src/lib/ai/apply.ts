/*
  Poprawka od modelu -> gotowa treść notatki.

  Wszystko, co przyszło z zewnątrz, przechodzi tu przez zod, ZANIM cokolwiek
  zostanie zapisane. Model potrafi oddać liczbę tam, gdzie ma być napis, pustą
  tablicę operacji albo rozmiar pisma spoza skali - i wtedy notatka ma zostać
  nietknięta, a człowiek ma zobaczyć zdanie po polsku, co poszło nie tak.

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
import { applyMindMapOperations } from "./mindmap-guard";
import { NAZWA_KOD, NAZWA_MAPA, NAZWA_PYTANIE, NAZWA_TEKST, type AiKind } from "./tools";

const opisPola = z.string().trim().min(1).max(300);

const tekstArgs = z.object({
  markdown: z.string().max(400_000),
  opis: opisPola,
  font: z.enum(["body", "heading", "mono"]).optional(),
  fontSize: z.number().int().min(TEXT_SMALLEST_SIZE).max(TEXT_LARGEST_SIZE).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const kodArgs = z.object({
  source: z.string().max(400_000),
  opis: opisPola,
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
});

const pytanieArgs = z.object({
  pytanie: z.string().trim().min(1).max(500),
});

export type AiOutcome =
  /** Gotowa nowa treść notatki, do przekazania upsertowi. */
  | { kind: "zmiana"; content: string; opis: string }
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
};

export function applyAiCall(input: AiCallInput): AiOutcome {
  const { kind, toolName, args } = input;

  if (toolName === NAZWA_PYTANIE) {
    const parsed = pytanieArgs.safeParse(args);
    if (!parsed.success) return zle("Asystent chciał o coś dopytać, ale nie podał pytania.");
    return { kind: "pytanie", pytanie: parsed.data.pytanie };
  }

  // Narzędzie od innego typu notatki. Nie powinno się zdarzyć, bo do modelu
  // jadą tylko dwa - ale gdyby przyszło, notatka zostaje nietknięta.
  if (toolName !== expectedTool(kind)) {
    return zle("Asystent sięgnął po narzędzie, którego przy tej notatce nie ma.");
  }

  if (kind === "TEXT") return zastosujTekst(input, args);
  if (kind === "CODE") return zastosujKod(input, args);
  return zastosujMape(input, args);
}

function expectedTool(kind: AiKind): string {
  return kind === "TEXT" ? NAZWA_TEKST : kind === "CODE" ? NAZWA_KOD : NAZWA_MAPA;
}

function zle(powod: string): AiOutcome {
  return { kind: "blad", powod };
}

function zastosujTekst(input: AiCallInput, args: unknown): AiOutcome {
  const parsed = tekstArgs.safeParse(args);
  if (!parsed.success) {
    return zle("Asystent oddał treść w kształcie, którego nie da się zapisać.");
  }

  const { markdown, opis, font, fontSize, align } = parsed.data;
  const nothingChanged =
    markdown === textMarkdownFromContent(input.content) &&
    font === undefined &&
    fontSize === undefined &&
    align === undefined;
  if (nothingChanged) return zle("Asystent nie zmienił w notatce niczego.");

  const existing = parseExistingTextDocument(input.content);

  return {
    kind: "zmiana",
    opis,
    content: buildTextNoteContent({
      id: input.noteId,
      title: input.title,
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
    return zle("Asystent oddał kod w kształcie, którego nie da się zapisać.");
  }

  const teraz = parseCodeNote(input.content);
  if (!teraz) return zle("Nie udało się odczytać notatki z kodem.");
  if (parsed.data.source === teraz.source) {
    return zle("Asystent nie zmienił w kodzie niczego.");
  }

  return {
    kind: "zmiana",
    opis: parsed.data.opis,
    content: buildCodeNoteContent({
      id: input.noteId,
      title: input.title,
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
    return zle("Asystent oddał zmiany w mapie w kształcie, którego nie da się zapisać.");
  }

  const teraz = parseMindMapNote(input.content);
  if (!teraz) return zle("Nie udało się odczytać mapy myśli.");

  const wynik = applyMindMapOperations(
    { nodes: teraz.nodes, edges: teraz.edges },
    parsed.data.operacje,
  );
  // Uszkodzona mapa nie jest zapisywana ani w części. Powód idzie wprost do
  // człowieka, bo mówi konkretnie, co asystent próbował zrobić.
  if (!wynik.ok) return zle(wynik.powod);

  return {
    kind: "zmiana",
    opis: parsed.data.opis,
    content: buildMindMapNoteContent({
      id: input.noteId,
      title: input.title,
      nodes: wynik.nodes,
      edges: wynik.edges,
      viewX: teraz.viewX,
      viewY: teraz.viewY,
      zoom: teraz.zoom,
      existing: parseExistingMindMapDocument(input.content),
    }),
  };
}
