/*
  Tytuł podpowiedziany z treści.

  Notatka bez wpisanego tytułu nazywała się „Bez nazwy" - i przy kilkunastu
  takich notatkach spis przestawał cokolwiek mówić. Zamiast tego bierzemy
  pierwszy wiersz treści, tak jak robi to Notion czy Keep: to prawie zawsze
  jest nagłówek albo pierwsze zdanie, czyli dokładnie to, czym notatka jest.

  Wpisany tytuł ZAWSZE wygrywa. Ta funkcja odzywa się wyłącznie wtedy, gdy pole
  tytułu zostało puste, i nie zmienia niczego, co człowiek napisał sam.
*/

/**
 * Dłuższy pierwszy wiersz obcinamy - w spisie i tak by się nie zmieścił.
 *
 * Osiemdziesiąt znaków zajmowało na karcie telefonu trzy wiersze i tytuł
 * zjadał całą kartę. Czterdzieści osiem mieści się w jednym wierszu z zapasem.
 *
 * Ta sama liczba stoi w aplikacji (NoteTitles.kt). Rozjazd między stronami
 * znaczyłby, że te same notatki przetytułowują się nawzajem przy każdej
 * synchronizacji.
 */
const LONGEST = 48;

/**
 * Ile znaków musi mieć NIEDOKOŃCZONY wiersz, żeby dało się z niego zrobić
 * tytuł.
 *
 * Autozapis rusza ułamek sekundy po pierwszym znaku. Bez tego progu notatka
 * nazwałaby się od jednej litery i tak już zostało - a tytuł podpowiada się
 * tylko raz, przy pierwszym zapisie z pustym polem.
 */
const SETTLED_LENGTH = 12;

/**
 * Obcięcie na ostatniej spacji przed granicą, a nie w połowie słowa.
 * „Pomaganie drugiemu człowiekowi to jedna z najważn..." czyta się jak tytuł;
 * „...z najważn" jak usterka.
 *
 * Wyjątek: jedno słowo dłuższe niż cała granica - wtedy nie ma gdzie ciąć
 * i tniemy równo, bo inaczej tytuł zostałby pusty.
 */
function shorten(text: string): string {
  if (text.length <= LONGEST) return text;

  const cut = text.slice(0, LONGEST);
  const space = cut.lastIndexOf(" ");
  const kept = space > LONGEST / 2 ? cut.slice(0, space) : cut;
  return `${kept.trimEnd()}...`;
}

/**
 * Najdłuższy tytuł, jaki przyjmujemy - także wpisany ręcznie.
 *
 * Do tej pory bramki przepuszczały trzysta znaków, a kolumna `Note.title`
 * w bazie to zwykły `String`, czyli VARCHAR(191) w MySQL. Tytuł między tymi
 * liczbami nie zapisywał się WCALE - wywracał zapis błędem bazy danych.
 *
 * Sto dwadzieścia mieści się w kolumnie z zapasem i zgadza się z limitem
 * nazwy folderu.
 */
export const TITLE_LIMIT = 120;

/**
 * Tytuł przycięty do granicy. PRZYCINAMY, nie odmawiamy.
 *
 * Odmowa zatrzymałaby synchronizację starszych wydań aplikacji na zawsze:
 * wpis w kolejce wysyłki wracałby z błędem przy każdej próbie i utknąłby tam
 * na dobre. Przycięcie jest niemiłe, ale przechodzi.
 *
 * Wielokropka tu nie dodajemy - to tytuł napisany przez człowieka, a nie
 * podpowiedź z treści.
 */
export function fitTitle(title: string): string {
  const clean = title.trim();
  if (clean.length <= TITLE_LIMIT) return clean;

  const cut = clean.slice(0, TITLE_LIMIT);
  const space = cut.lastIndexOf(" ");
  return (space > TITLE_LIMIT / 2 ? cut.slice(0, space) : cut).trimEnd();
}

/**
 * Nazwy, które tytułem są tylko z nazwy. Padają wtedy, gdy nikt tytułu nie
 * wpisał, a coś trzeba było pokazać.
 */
const PLACEHOLDERS = new Set([
  "",
  "bez nazwy",
  "bez tytułu",
  "bez tytulu",
  "untitled",
  "unnamed",
  "nowa notatka",
  "new note",
]);

/** Nazwy plików, które nadaje sam program, a nie człowiek. */
const DEFAULT_CODE_NAME = /^(program|kod|code|plik|file|main|nowy|new)\.[a-z0-9]{1,8}$/i;

/**
 * Czy ten tytuł napisał człowiek.
 *
 * KLUCZOWE dla asystenta: własnego tytułu nie wolno mu ruszyć, a „Bez nazwy"
 * i tytuł podpowiedziany z treści może zastąpić. Informacji „ten tytuł wpisał
 * człowiek" nie ma NIGDZIE - ani w bazie, ani w pliku notatki - więc trzeba
 * ją odgadnąć.
 *
 * `derived` to tytuł, jaki dałaby DZISIEJSZA treść notatki. Gdy tytuł jest
 * dokładnie nim, prawie na pewno stamtąd pochodzi.
 *
 * To heurystyka, nie pewnik - ale myli się w bezpieczną stronę. Gdy człowiek
 * poprawił pierwszy wiersz po podpowiedzi, porównanie już nie zagra, tytuł
 * uchodzi za wpisany ręcznie i asystent go NIE tknie.
 */
export function titleIsOwn(title: string, derived: string | null): boolean {
  const clean = title.trim();
  if (PLACEHOLDERS.has(clean.toLowerCase())) return false;
  if (DEFAULT_CODE_NAME.test(clean)) return false;
  return !(derived && clean === derived);
}

/**
 * Znaczniki na początku wiersza, które są składnią, a nie treścią:
 * `# `, `> `, `- `, `- [ ] `, `1. `.
 */
const LEADING_SYNTAX = /^\s*(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/;

/** Znaczniki w środku wiersza. Zdejmujemy je, zostawiając samą treść. */
function withoutMarkers(line: string): string {
  return line
    // Barwę, rozmiar i podkreślenie zapisujemy znacznikami HTML - patrz
    // rich-text.ts. Otwarcia i domknięcia zdejmujemy osobno, żeby poradzić
    // sobie też z zapisem zagnieżdżonym (barwa w rozmiarze).
    .replace(/<span style="[^"]*">/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<\/?u>/gi, "")
    // Odnośnik i zdjęcie: zostaje sam opis.
    .replace(/!?\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tytuł z treści notatki tekstowej. Null, gdy nie ma z czego go zrobić -
 * wtedy zostaje dotychczasowe „Bez nazwy".
 */
export function titleFromMarkdown(markdown: string): string | null {
  let insideCodeBlock = false;
  const lines = markdown.split("\n");

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();

    // Płot bloku kodu i wzoru. Treść w środku bywa techniczna i na tytuł się
    // nie nadaje, więc przechodzimy nad nią.
    if (line.startsWith("```") || line === "$$") {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }
    if (insideCodeBlock) continue;

    // Linia pozioma to nie treść.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue;

    const cleaned = withoutMarkers(line.replace(LEADING_SYNTAX, ""));
    if (!cleaned) continue;

    // Wiersz musi być dokończony: albo człowiek przeszedł do następnego, albo
    // napisał już tyle, że widać, o czym to jest.
    const settled = index < lines.length - 1 || cleaned.length >= SETTLED_LENGTH;
    if (!settled) return null;

    return shorten(cleaned);
  }

  return null;
}

/** To samo dla mapy myśli: tytułem zostaje pierwszy opisany węzeł. */
export function titleFromMindMap(nodes: { text?: string }[]): string | null {
  for (const node of nodes) {
    const cleaned = withoutMarkers((node.text ?? "").trim());
    if (!cleaned) continue;
    // Węzeł mapy wpisuje się w okienku i zatwierdza, więc nie ma tu ryzyka
    // złapania go w pół słowa.
    return shorten(cleaned);
  }
  return null;
}
