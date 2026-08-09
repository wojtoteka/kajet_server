/*
  Drobna pomoc przy pisaniu kodu - taka jak w VS Code, ale bez pisania za
  człowieka.

  Robi dokładnie pięć rzeczy i ani jednej więcej:

   1. domyka nawias albo cudzysłów, zostawiając kursor w środku,
   2. przepuszcza kursor przez domknięcie, które już stoi (żeby nie wychodziło
      „))" po dopisaniu własnego),
   3. kasuje pustą parę jednym cofnięciem,
   4. w HTML domyka znacznik: po wpisaniu `<p>` dostawia `</p>` za kursorem,
   5. po Enterze przepisuje wcięcie z poprzedniego wiersza.

  Czego NIE robi: nie podpowiada nazw, nie wstawia szkieletów, pętli ani
  gotowych bloków. Kto pisze `if`, dostaje `if`, a nie trzy linijki, które
  trzeba potem czytać i kasować.

  To ten sam zestaw reguł, co CodeAssist.kt w aplikacji na Androida - żeby
  pisanie kodu w przeglądarce i na tablecie zachowywało się tak samo. Zmiana
  tutaj powinna iść i tam.

  Czyste działania na tekście i położeniu kursora, bez DOM-u i bez stanu -
  dzięki temu da się to sprawdzić testami (code-assist.test.ts).
*/

const PAIRS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ['"', '"'],
  ["'", "'"],
  ["`", "`"],
]);

const CLOSERS = new Set(PAIRS.values());

/** Cudzysłów jest sam sobie domknięciem - trzeba go liczyć osobno. */
const SYMMETRIC = new Set(['"', "'", "`"]);

/**
 * Znaczniki, które nie mają domknięcia. Dopisanie `</br>` byłoby błędem,
 * a nie pomocą.
 */
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
  "!doctype",
]);

/** Otwierający znacznik tuż przed kursorem: `<p>`, `<div class="x">`. */
const OPENING_TAG = /<([A-Za-z][A-Za-z0-9:-]*)(\s[^<>]*)?>$/;

export type CodeAssistEdit =
  /** Wstaw ten tekst zamiast wpisywanego znaku i cofnij kursor o `caretBack`. */
  | { kind: "insert"; text: string; caretBack: number }
  /** Nic nie wstawiaj, tylko przejdź kursorem przez znak, który już stoi. */
  | { kind: "skip" }
  /** Skasuj parę: znak przed kursorem razem z tym za nim. */
  | { kind: "deletePair" };

/**
 * Co zrobić z naciśniętym klawiszem. `null` znaczy „nie mam tu nic do
 * dodania" - wtedy przeglądarka robi swoje i nic się nie zmienia.
 */
export function assistKey(input: {
  key: string;
  text: string;
  start: number;
  end: number;
  html: boolean;
}): CodeAssistEdit | null {
  const { key, text, start, end, html } = input;
  const collapsed = start === end;

  if (key === "Enter" && collapsed) return keepIndent(text, start);

  if (key === "Backspace" && collapsed) {
    // 3. Skasowany otwierający, a tuż za kursorem stoi jego para - schodzi
    //    razem z nim. Pusta „()" znika jednym cofnięciem, tak jak weszła.
    const opener = text[start - 1];
    const partner = opener ? PAIRS.get(opener) : undefined;
    return partner && text[start] === partner ? { kind: "deletePair" } : null;
  }

  // Dalej idą już tylko pojedyncze znaki. Ctrl+V, strzałki i skróty klawiszowe
  // przychodzą jako nazwy dłuższe niż jeden znak i nie mają nas obchodzić.
  if (key.length !== 1) return null;

  // 2. Domknięcie już stoi tuż za kursorem - przechodzimy przez nie zamiast
  //    dokładać drugie. Bez tego dopisanie własnego „)" po tym, które sami
  //    dostawiliśmy, dawało „))".
  if (collapsed && CLOSERS.has(key) && text[start] === key) return { kind: "skip" };

  // 4. Znacznik HTML. Szukamy w tekście z domyślanym „>", bo tego znaku jeszcze
  //    w polu nie ma - dopiero go przechwyciliśmy.
  if (key === ">" && html && collapsed) {
    const closing = closingTagFor(`${text.slice(0, start)}>`);
    if (closing) return { kind: "insert", text: `>${closing}`, caretBack: closing.length };
  }

  const partner = PAIRS.get(key);
  if (!partner) return null;

  // 1. Domykamy nawias albo cudzysłów. Przy zaznaczeniu obejmujemy nim to, co
  //    zaznaczone - tak jak w VS Code, bo owinięcie kawałka w cudzysłów albo
  //    nawias jest częstsze niż zamiar skasowania go tym jednym znakiem.
  if (!collapsed) {
    return { kind: "insert", text: key + text.slice(start, end) + partner, caretBack: 1 };
  }

  if (!roomToClose(key, text, start)) return null;
  return { kind: "insert", text: key + partner, caretBack: 1 };
}

/**
 * Czy jest gdzie domknąć. Za kursorem musi być koniec wiersza, odstęp albo
 * inne domknięcie - inaczej wpisanie nawiasu przed istniejącym słowem
 * dokładałoby domknięcie w środku wyrażenia.
 */
function roomToClose(typed: string, text: string, at: number): boolean {
  const next = text[at];
  if (next !== undefined && !(/\s/.test(next) || CLOSERS.has(next))) return false;

  // Apostrof w słowie to najczęściej apostrof, nie początek napisu:
  // „don't" nie ma się zamienić w „don''t".
  if (SYMMETRIC.has(typed)) {
    const previous = text[at - 1];
    if (previous !== undefined && (/[\p{L}\p{N}]/u.test(previous) || previous === typed)) {
      return false;
    }
  }
  return true;
}

/** Domknięcie dla znacznika stojącego tuż przed kursorem, albo null. */
function closingTagFor(head: string): string | null {
  const match = OPENING_TAG.exec(head);
  if (!match) return null;

  // Znacznik domykający (`</p>`) i sam domknięty (`<br />`) nic nie potrzebują.
  if (match[0].startsWith("</")) return null;
  if ((match[2] ?? "").trimEnd().endsWith("/")) return null;

  const name = match[1];
  if (VOID_TAGS.has(name.toLowerCase())) return null;
  return `</${name}>`;
}

/**
 * Wcięcie z poprzedniego wiersza po naciśnięciu Entera. Bez tego każdy wiersz
 * w bloku trzeba zaczynać od odbijania spacji na nowo.
 */
function keepIndent(text: string, at: number): CodeAssistEdit | null {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  const indent = /^[ \t]*/.exec(text.slice(lineStart, at))?.[0] ?? "";
  if (!indent) return null;
  return { kind: "insert", text: `\n${indent}`, caretBack: 0 };
}
