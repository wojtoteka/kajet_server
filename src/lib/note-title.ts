/*
  Tytuł podpowiedziany z treści.

  Notatka bez wpisanego tytułu nazywała się „Bez nazwy" — i przy kilkunastu
  takich notatkach spis przestawał cokolwiek mówić. Zamiast tego bierzemy
  pierwszy wiersz treści, tak jak robi to Notion czy Keep: to prawie zawsze
  jest nagłówek albo pierwsze zdanie, czyli dokładnie to, czym notatka jest.

  Wpisany tytuł ZAWSZE wygrywa. Ta funkcja odzywa się wyłącznie wtedy, gdy pole
  tytułu zostało puste, i nie zmienia niczego, co człowiek napisał sam.
*/

/** Dłuższy pierwszy wiersz obcinamy - w spisie i tak by się nie zmieścił. */
const LONGEST = 80;

/**
 * Ile znaków musi mieć NIEDOKOŃCZONY wiersz, żeby dało się z niego zrobić
 * tytuł.
 *
 * Autozapis rusza ułamek sekundy po pierwszym znaku. Bez tego progu notatka
 * nazwałaby się od jednej litery i tak już zostało - a tytuł podpowiada się
 * tylko raz, przy pierwszym zapisie z pustym polem.
 */
const SETTLED_LENGTH = 12;

function shorten(text: string): string {
  return text.length > LONGEST ? `${text.slice(0, LONGEST).trimEnd()}...` : text;
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
 * Tytuł z treści notatki tekstowej. Null, gdy nie ma z czego go zrobić —
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
