/*
  Własne kolory z paska odręcznej notatki.

  Sloty siedzą w ciasteczku przeglądarki, nie przy koncie: to sprzęt, przy
  którym się rysuje, a nie własność notatki - tak samo jak wybór motywu.
  Ciasteczko, a nie localStorage, bo paleta ma być ta sama we wszystkich
  kartach z edytorem i przeżyć zamknięcie przeglądarki.

  Zapis to barwy ARGB pisane po szesnastkowemu, po przecinku:
  `ff23211d,ff0f6b5c`. Krótko, bez cudzysłowów i przecinków dziesiętnych,
  więc mieści się w ciasteczku bez kodowania.
*/

/** Nazwa ciasteczka. Zmiana skasuje ludziom dotychczasową paletę. */
export const PALETTE_COOKIE = "kajet-paleta";

/** Ile slotów mieści pasek. Więcej i tak nie zmieściłoby się w rzędzie. */
export const MAX_CUSTOM_COLORS = 8;

/** Rok - paleta ma przeżyć przerwę w pisaniu, a nie tylko jedną sesję. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Czyta zapis palety. Wszystko, co nie jest ośmioma znakami szesnastkowymi,
 * leci do kosza - ciasteczko może ruszyć ktokolwiek, a paleta ma się wtedy
 * co najwyżej skrócić, nie wysypać edytora.
 */
export function parsePalette(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const result: number[] = [];
  for (const piece of raw.split(",")) {
    const text = piece.trim();
    if (!/^[0-9a-f]{8}$/i.test(text)) continue;
    result.push(parseInt(text, 16) | 0);
    if (result.length >= MAX_CUSTOM_COLORS) break;
  }
  return result;
}

export function serializePalette(colors: number[]): string {
  return colors
    .slice(0, MAX_CUSTOM_COLORS)
    .map((color) => (color >>> 0).toString(16).padStart(8, "0"))
    .join(",");
}

/** Wyjmuje wartość ciasteczka z całego napisu `document.cookie`. */
export function cookieValue(jar: string, name: string): string | null {
  for (const piece of jar.split(";")) {
    const at = piece.indexOf("=");
    if (at < 0) continue;
    if (piece.slice(0, at).trim() !== name) continue;
    return decodeURIComponent(piece.slice(at + 1).trim());
  }
  return null;
}

/** Paleta z przeglądarki. Poza przeglądarką (render na serwerze) - pusta. */
export function readPalette(): number[] {
  if (typeof document === "undefined") return [];
  return parsePalette(cookieValue(document.cookie, PALETTE_COOKIE));
}

export function savePalette(colors: number[]): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    `${PALETTE_COOKIE}=${serializePalette(colors)}` +
    `; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${secure}`;
}
