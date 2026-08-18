/*
  Narzędzia, przez które asystent oddaje zmianę. Po jednym na typ notatki, plus
  jedno wspólne na dopytanie.

  Model nigdy nie pisze notatki „luźnym tekstem do sparsowania" i nigdy nie
  przepisuje całego dokumentu. Oddaje samą POPRAWKĘ - nowy markdown, nowe
  źródło albo listę operacji na mapie - a dokument składa z tego serwer
  istniejącymi budowniczymi (text-note.ts, code-note.ts, mindmap-note.ts).

  Dwa powody, dla których tak, a nie „oddaj cały JSON":

   - notatka niesie rzeczy, których model nie widzi i nie ma po co widzieć:
     rysunki w tekście, pismo odręczne w węzłach mapy, znaczniki, datę
     powstania. Przy przepisywaniu całości gubi je bezgłośnie,
   - płaci się za każdy token wyjścia, a przepisywanie niezmienionej połowy
     notatki przy każdym „skróć ostatni akapit" to czysta strata.

  Kształt jest pisany pod Gemini: płaskie obiekty, `enum` zamiast wariantów,
  żadnych `anyOf` ani zagnieżdżeń głębszych niż trzeba - dokumentacja mówi
  wprost, że nie każdy kawałek JSON Schema przechodzi, a bardzo duże albo
  głęboko zagnieżdżone schematy bywają odrzucane.
*/

import { TEXT_FONTS, TEXT_LARGEST_SIZE, TEXT_SMALLEST_SIZE } from "@/lib/text-note";

/** Deklaracja narzędzia w kształcie, jakiego chce Gemini. */
export type GeminiTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const NAZWA_TEKST = "zmien_tekst";
export const NAZWA_KOD = "zmien_kod";
export const NAZWA_MAPA = "zmien_mape";
export const NAZWA_PYTANIE = "dopytaj";

/**
 * Jedno zdanie o tym, co się zmieniło. Jest w każdym narzędziu, bo użytkownik
 * musi zobaczyć, co asystent zrobił, ZANIM zdecyduje, czy to cofnąć - a
 * porównywanie dwóch wersji notatki gołym okiem tego nie zastąpi.
 */
const OPIS = {
  type: "string",
  description:
    "Jedno krótkie zdanie w języku polecenia o tym, co zostało zmienione. Bez wstępu, " +
    "bez zwrotu do użytkownika, na przykład: „Skrócono drugi akapit o połowę.”",
};

/**
 * Nowy tytuł notatki. Wspólny dla trzech narzędzi zmiany, bo model oddaje
 * TYLKO JEDNO wywołanie na zapytanie - osobne narzędzie „nadaj tytuł"
 * oznaczałoby wybór: albo treść, albo tytuł. A tytuł ma się nadawać właśnie
 * wtedy, gdy asystent pisze notatkę od zera.
 */
const TYTUL = {
  type: "string",
  description:
    "Nowy tytuł notatki. Podaj go WYŁĄCZNIE wtedy, gdy w wiadomości napisano, " +
    "że notatka nie ma jeszcze własnego tytułu. Krótko - do sześciu słów, bez " +
    "kropki na końcu i bez cudzysłowów. Gdy notatka ma już tytuł nadany przez " +
    "człowieka, pomiń to pole całkowicie.",
};

const NARZEDZIE_TEKST: GeminiTool = {
  type: "function",
  name: NAZWA_TEKST,
  description:
    "Zapisuje nową treść notatki tekstowej. Podajesz CAŁĄ treść po zmianie, " +
    "nie sam zmieniony fragment.",
  parameters: {
    type: "object",
    properties: {
      markdown: {
        type: "string",
        description:
          "Cała treść notatki po zmianie, w markdownie Kajetu (nagłówki tylko #–###). " +
          "Zapisy zdjęć ![opis|60%](assets/plik.png) przepisz bez zmian, razem z dopiskiem " +
          "szerokości - to nie jest tekst do poprawiania. Starszy zapis z tytułem " +
          '![opis](assets/plik.png "60%") też zostawiasz.',
      },
      opis: OPIS,
      tytul: TYTUL,
      font: {
        type: "string",
        enum: TEXT_FONTS.map((font) => font.id),
        description:
          "Krój pisma całej notatki: body, heading albo mono. Podaj tylko wtedy, " +
          "gdy proszono o zmianę kroju całej notatki.",
      },
      fontSize: {
        type: "integer",
        minimum: 0,
        maximum: TEXT_LARGEST_SIZE,
        description:
          "Rozmiar pisma całej notatki. 0 = rozmiar z motywu konta; " +
          `${TEXT_SMALLEST_SIZE}–${TEXT_LARGEST_SIZE}` +
          " = stały rozmiar. Podaj tylko wtedy, gdy proszono o zmianę rozmiaru. " +
          "Pominięcie pola zostawia rozmiar nietknięty. Nigdy nie podawaj 17 jako " +
          "„normalnego” - to podgląd, nie zapis.",
      },
      align: {
        type: "string",
        enum: ["left", "center", "right"],
        description:
          "Wyrównanie całej notatki: left, center albo right. Podaj tylko wtedy, " +
          "gdy proszono o zmianę wyrównania całej notatki.",
      },
    },
    required: ["markdown", "opis"],
  },
};

const NARZEDZIE_KOD: GeminiTool = {
  type: "function",
  name: NAZWA_KOD,
  description:
    "Zapisuje nową treść notatki z kodem. Podajesz CAŁE źródło po zmianie, " +
    "nie sam poprawiony fragment.",
  parameters: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "Całe źródło po zmianie. Zachowaj język, w którym notatka jest napisana, " +
          "oraz sposób wcinania, jaki był w niej dotąd. Jeden plik, bez README. " +
          "Całego pliku przy okazji nie formatuj.",
      },
      opis: OPIS,
      tytul: {
        ...TYTUL,
        description:
          TYTUL.description +
          " Przy notatce z kodem tytuł to nazwa pliku - samo imię, bez " +
          "rozszerzenia; rozszerzenie dokłada serwer, zgodne z językiem, " +
          "w którym plik jest napisany.",
      },
    },
    required: ["source", "opis"],
  },
};

const NARZEDZIE_MAPA: GeminiTool = {
  type: "function",
  name: NAZWA_MAPA,
  description:
    "Zmienia mapę myśli listą operacji. Nie przepisujesz mapy - wymieniasz tylko to, " +
    "co ma się zmienić. Reszta zostaje nietknięta.",
  parameters: {
    type: "object",
    properties: {
      operacje: {
        type: "array",
        minItems: 1,
        maxItems: 60,
        description: "Operacje w kolejności, w jakiej mają zostać wykonane.",
        items: {
          type: "object",
          properties: {
            rodzaj: {
              type: "string",
              enum: ["dodaj", "usun", "usun_galaz", "zmien_tekst", "przenies"],
              description:
                "dodaj - nowy węzeł pod wskazanym rodzicem; usun - sam węzeł, a to co pod " +
                "nim wisiało przechodzi wyżej; usun_galaz - węzeł razem ze wszystkim pod " +
                "nim; zmien_tekst - nowy napis w węźle; przenies - ten sam węzeł pod innym " +
                "rodzicem.",
            },
            id: {
              type: "string",
              description:
                "Przy rodzaju dodaj - wymyślona przez Ciebie nazwa nowego węzła, po której " +
                "możesz podwiesić pod niego kolejne w tej samej paczce (na przykład nowy1). " +
                "Przy pozostałych - identyfikator węzła, który dostałeś w mapie.",
            },
            text: {
              type: "string",
              description: "Napis w węźle: kilka słów, nie zdanie. Tylko dla rodzajów dodaj i zmien_tekst.",
            },
            rodzicId: {
              type: "string",
              description:
                "Identyfikator rodzica. Tylko dla rodzajów dodaj i przenies. Puste znaczy " +
                "korzeń mapy - i wolno tak zrobić wyłącznie wtedy, gdy mapa jest jeszcze pusta.",
            },
          },
          required: ["rodzaj", "id"],
        },
      },
      opis: OPIS,
      tytul: TYTUL,
    },
    required: ["operacje", "opis"],
  },
};

/**
 * Dopytanie. Bez tego model, który nie wie, o co chodzi, i tak coś zmieni -
 * bo o zmianę go poproszono - i trafi w to pytanie, którego nie zadał.
 */
const NARZEDZIE_PYTANIE: GeminiTool = {
  type: "function",
  name: NAZWA_PYTANIE,
  description:
    "Zadaje użytkownikowi pytanie zamiast zmieniać notatkę. Wywołaj to zawsze, gdy " +
    "polecenie da się rozumieć na więcej niż jeden sposób albo gdy nie wiadomo, " +
    "którego fragmentu dotyczy. Notatka zostaje wtedy nietknięta.",
  parameters: {
    type: "object",
    properties: {
      pytanie: {
        type: "string",
        description:
          "Jedno konkretne pytanie w języku polecenia. Nie lista pytań i nie prośba " +
          "o „więcej szczegółów”. Gdy nie wiadomo, o który fragment chodzi - dwie możliwości.",
      },
    },
    required: ["pytanie"],
  },
};

/** Typy notatek, przy których asystent w ogóle się pokazuje. */
export const AI_KINDS = ["TEXT", "MINDMAP", "CODE"] as const;
export type AiKind = (typeof AI_KINDS)[number];

export function aiHandles(kind: string): kind is AiKind {
  return (AI_KINDS as readonly string[]).includes(kind);
}

/**
 * Narzędzia dla danego typu notatki: jedno do zmiany i jedno do dopytania.
 * Notatki odręczne nie mają tu wpisu - i to jest jedyny powód, dla którego
 * asystent przy nich nie działa.
 */
export function toolsFor(kind: AiKind): GeminiTool[] {
  const change =
    kind === "TEXT" ? NARZEDZIE_TEKST : kind === "CODE" ? NARZEDZIE_KOD : NARZEDZIE_MAPA;
  return [change, NARZEDZIE_PYTANIE];
}

/** Nazwa narzędzia zmiany dla danego typu - do wymuszenia wywołania. */
export function changeToolFor(kind: AiKind): string {
  return kind === "TEXT" ? NAZWA_TEKST : kind === "CODE" ? NAZWA_KOD : NAZWA_MAPA;
}
