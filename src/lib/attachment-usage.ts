/*
  Które załączniki notatki tekstowej są jeszcze w użyciu.

  Zdjęcie i rysunek wstawione w notatkę to plik w załącznikach, a w treści
  odnośnik `![opis](assets/plik.png)`. Rysunek z tabletu ma do tego drugi plik
  - swoje kreski (`plik.strokes.json`) - i wpis w `text.drawings`.

  Usunięcie rysunku z notatki zabierało dotąd tylko odnośnik: pliki zostawały
  w załącznikach, a strona pokazywała je w „Plikach przy notatce" jak żywe.
  Ten sam rachunek liczy aplikacja (TextAttachments.kt).

  Rachunek jest celowo ostrożny - w razie wątpliwości plik jest W UŻYCIU.
  Kasujemy tylko to, na co treść WSKAZYWAŁA, a już nie wskazuje (plik wysłany
  przez „Pliki przy notatce" i jeszcze niewstawiony zostaje), oraz pliki
  rysunków, których obrazka w treści już nie ma.
*/

type Drawing = { asset: string; source: string };
type TextPart = { markdown: string; drawings: Drawing[] };

const ASSETS = "assets/";

/** Treść notatki tekstowej z zapisu content.json; null dla innych notatek. */
export function textPartOf(content: string | null | undefined): TextPart | null {
  if (!content) return null;
  try {
    const document = JSON.parse(content) as {
      text?: { markdown?: unknown; drawings?: unknown } | null;
    };
    const text = document?.text;
    if (!text || typeof text.markdown !== "string") return null;
    const drawings = Array.isArray(text.drawings)
      ? (text.drawings as unknown[]).filter(
          (entry): entry is Drawing =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Drawing).asset === "string" &&
            typeof (entry as Drawing).source === "string",
        )
      : [];
    return { markdown: text.markdown, drawings };
  } catch {
    return null;
  }
}

/** Czy treść wskazuje na plik - wprost albo z kodowaniem adresu. */
export function mentioned(markdown: string, name: string): boolean {
  if (!name) return false;
  const spellings = new Set([
    name,
    name.replace(/ /g, "%20"),
    name.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29"),
    encodeURIComponent(name),
  ]);
  for (const spelling of spellings) {
    if (markdown.includes(ASSETS + spelling)) return true;
  }
  return false;
}

/** Plik w użyciu: wskazuje na niego treść albo to kreski rysunku z treści. */
export function inUse(text: TextPart, name: string): boolean {
  if (mentioned(text.markdown, name)) return true;
  return text.drawings.some(
    (drawing) => drawing.source === name && mentioned(text.markdown, drawing.asset),
  );
}

/**
 * Załączniki do skasowania po zapisie nowej treści.
 *
 * [names] to pliki, które notatka ma teraz w załącznikach. Wypada plik, na
 * który wskazywała poprzednia treść, a nowa już nie - oraz obrazek i kreski
 * rysunku, którego w nowej treści nie ma (także taki, który zniknął z niej
 * jeszcze przed tą poprawką i wisi w załącznikach od dawna).
 */
export function droppedAttachments(
  previousContent: string | null | undefined,
  nextContent: string,
  names: string[],
): string[] {
  const next = textPartOf(nextContent);
  if (!next) return [];
  const previous = textPartOf(previousContent);
  const present = new Set(names);
  const dropped = new Set<string>();

  if (previous) {
    for (const name of names) {
      if (inUse(previous, name) && !inUse(next, name)) dropped.add(name);
    }
  }

  for (const drawing of [...(previous?.drawings ?? []), ...next.drawings]) {
    if (mentioned(next.markdown, drawing.asset)) continue;
    for (const name of [drawing.asset, drawing.source]) {
      if (present.has(name) && !inUse(next, name)) dropped.add(name);
    }
  }

  return [...dropped];
}
