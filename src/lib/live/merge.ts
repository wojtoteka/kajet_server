/*
  Zmiany notatki: różnica, nałożenie i scalanie trzech wersji.

  Treść notatki to jeden dokument JSON (content.json). Edycja na żywo i
  synchronizacja po powrocie z trybu offline potrzebują trzech rzeczy:

  - diff(przed, po)          - mała delta zamiast całej notatki w sieci,
  - applyDelta(przed, delta) - to samo po drugiej stronie,
  - merge3(baza, moje, ich)  - złożenie dwóch niezależnych zmian tej samej
                               wersji bazowej, bez gubienia żadnej z nich.

  Ten plik nie zna rodzajów notatek. Wystarczą mu dwie obserwacje o kształcie
  dokumentu Kajetu:

  1. Tablice obiektów z polem "id" (strony, kreski, kształty, pola tekstowe,
     zdjęcia, węzły i krawędzie mapy) to zbiory rzeczy, nie listy pozycji.
     Porównuje się je po identyfikatorze - kreska dopisana na jednym
     urządzeniu i kreska dopisana na drugim zostają obie.
  2. Długi tekst (markdown, źródło kodu) scala się jak w systemach kontroli
     wersji: wierszami, a w obrębie spornego fragmentu słowami.

  Reguły rozstrzygania sporów (uzgodnione z autorem):
  - zmiana wygrywa ze skasowaniem (nikt nie traci tego, co właśnie pisał),
  - dwa różne teksty w tym samym miejscu zostają oba, jeden pod drugim
    (najpierw wersja, którą inni już widzieli, potem nowa),
  - krótka wartość (liczba, kolor, napis w jednym wierszu - np. hasło węzła
    mapy) bierze późniejszą zmianę, czyli „moją".

  Ten sam silnik, linijka w linijkę, siedzi w aplikacji (LiveMerge.kt).
  Wspólne przypadki testowe leżą w live-vectors.json w obu repozytoriach.
*/

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

/** Wymiana jednej pozycji tekstu: [od, ile znaków usunąć, co wstawić]. */
export type Splice = [number, number, string];

/**
 * Ułożenie elementu w tablicy po identyfikatorach: [za kim, id] przesuwa
 * istniejący element, [za kim, id, element] wstawia nowy. „Za kim" równe
 * null znaczy „na początek".
 */
export type Placement = [string | null, string] | [string | null, string, Json];

export type KeyedDelta = {
  /** Skasowane identyfikatory. */
  d?: string[];
  /** Zmiany w środku elementów. */
  u?: { [id: string]: Delta };
  /** Nowe i przesunięte elementy, w kolejności docelowej. */
  p?: Placement[];
};

export type Delta =
  /** Podmiana całej wartości. */
  | { $: Json }
  /** Zmiany pól obiektu; null znaczy „pole znika". */
  | { o: { [key: string]: Delta | null } }
  /** Zmiany tablicy elementów z identyfikatorem. */
  | { k: KeyedDelta }
  /** Zmiany tekstu, pozycje liczone w starym tekście, rosnąco. */
  | { t: Splice[] };

/** Nazwy pól, których nie wolno dotknąć - nie dają się bezpiecznie zapisać. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Od tej długości (albo z nowym wierszem) tekst zmienia się wymianami. */
const SHORT_TEXT = 64;

/** Górne granice pracy porównywania - powyżej spór rozstrzyga się w całości. */
const MAX_LINE_EDITS = 3_000;
const MAX_WORD_EDITS = 2_000;
const MAX_WORD_REGION = 60_000;

// --- Podstawy ---

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(object: JsonObject, key: string): Json | undefined {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
}

/** Głęboka równość dwóch wartości JSON. Kolejność pól obiektu nie gra roli. */
export function jsonEqual(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "number") return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!jsonEqual(a[i], b[i])) return false;
    return true;
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!jsonEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function idOf(value: Json): string | null {
  if (!isPlainObject(value)) return null;
  const id = own(value, "id");
  return typeof id === "string" ? id : null;
}

/** Czy tablica to zbiór rzeczy z identyfikatorami (pusta też się liczy). */
export function isKeyed(values: Json[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const id = idOf(value);
    if (id === null || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function byId(values: Json[]): Map<string, Json> {
  const map = new Map<string, Json>();
  for (const value of values) map.set(idOf(value) as string, value);
  return map;
}

// --- Różnica ---

/** Delta z [base] do [target]; undefined, gdy niczego nie zmieniono. */
export function diff(base: Json | undefined, target: Json): Delta | undefined {
  if (jsonEqual(base, target)) return undefined;
  if (base === undefined) return { $: target };

  if (typeof base === "string" && typeof target === "string") {
    if (base.length + target.length <= SHORT_TEXT && !base.includes("\n") && !target.includes("\n")) {
      return { $: target };
    }
    return { t: [textSplice(base, target)] };
  }

  if (isPlainObject(base) && isPlainObject(target)) {
    const changes: { [key: string]: Delta | null } = {};
    let any = false;
    for (const key of Object.keys(base)) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        changes[key] = null;
        any = true;
      }
    }
    for (const key of Object.keys(target)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const inner = diff(own(base, key), target[key]);
      if (inner !== undefined) {
        changes[key] = inner;
        any = true;
      }
    }
    return any ? { o: changes } : undefined;
  }

  if (Array.isArray(base) && Array.isArray(target) && isKeyed(base) && isKeyed(target)) {
    if (base.length > 0 || target.length > 0) return diffKeyed(base, target);
  }

  return { $: target };
}

/** Jedna wymiana obejmująca wszystko między wspólnym początkiem i końcem. */
function textSplice(base: string, target: string): Splice {
  let start = 0;
  const shorter = Math.min(base.length, target.length);
  while (start < shorter && base.charCodeAt(start) === target.charCodeAt(start)) start += 1;
  let endBase = base.length;
  let endTarget = target.length;
  while (
    endBase > start &&
    endTarget > start &&
    base.charCodeAt(endBase - 1) === target.charCodeAt(endTarget - 1)
  ) {
    endBase -= 1;
    endTarget -= 1;
  }
  return [start, endBase - start, target.slice(start, endTarget)];
}

function diffKeyed(base: Json[], target: Json[]): Delta | undefined {
  const before = byId(base);
  const after = byId(target);

  const deleted = base.map(idOf).filter((id): id is string => id !== null && !after.has(id));

  const updated: { [id: string]: Delta } = {};
  let anyUpdate = false;
  for (const value of target) {
    const id = idOf(value) as string;
    const old = before.get(id);
    if (old === undefined) continue;
    const inner = diff(old, value);
    if (inner !== undefined) {
      updated[id] = inner;
      anyUpdate = true;
    }
  }

  // Elementy, które zachowują kolejność względem siebie, zostają na miejscu.
  // Najdłuższy rosnący podciąg pozycji z bazy daje ich największy zbiór -
  // przesuwać trzeba tylko resztę.
  const position = new Map<string, number>();
  base.forEach((value, index) => position.set(idOf(value) as string, index));
  const common = target.map(idOf).filter((id): id is string => id !== null && before.has(id));
  const stable = longestIncreasing(common, (id) => position.get(id) as number);

  const placements: Placement[] = [];
  let previous: string | null = null;
  for (const value of target) {
    const id = idOf(value) as string;
    if (!before.has(id)) placements.push([previous, id, value]);
    else if (!stable.has(id)) placements.push([previous, id]);
    previous = id;
  }

  if (deleted.length === 0 && !anyUpdate && placements.length === 0) return undefined;
  const delta: KeyedDelta = {};
  if (deleted.length > 0) delta.d = deleted;
  if (anyUpdate) delta.u = updated;
  if (placements.length > 0) delta.p = placements;
  return { k: delta };
}

/** Identyfikatory najdłuższego podciągu rosnącego według [rank]. */
function longestIncreasing(ids: string[], rank: (id: string) => number): Set<string> {
  const tails: number[] = [];
  const tailIndex: number[] = [];
  const parent = new Array<number>(ids.length).fill(-1);
  ids.forEach((id, index) => {
    const value = rank(id);
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
    tailIndex[low] = index;
    parent[index] = low > 0 ? tailIndex[low - 1] : -1;
  });
  const result = new Set<string>();
  let cursor = tails.length > 0 ? tailIndex[tails.length - 1] : -1;
  while (cursor >= 0) {
    result.add(ids[cursor]);
    cursor = parent[cursor];
  }
  return result;
}

// --- Nałożenie ---

/** Nakłada [delta] na [base]. Nie zmienia [base] - oddaje nową wartość. */
export function applyDelta(base: Json | undefined, delta: Delta): Json {
  if ("$" in delta) return delta.$;

  if ("o" in delta) {
    const result: JsonObject = isPlainObject(base) ? { ...base } : {};
    for (const key of Object.keys(delta.o)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const change = delta.o[key];
      if (change === null) delete result[key];
      else result[key] = applyDelta(own(result, key), change);
    }
    return result;
  }

  if ("t" in delta) {
    const text = typeof base === "string" ? base : "";
    let out = "";
    let at = 0;
    for (const [from, removed, inserted] of delta.t) {
      const start = Math.max(at, Math.min(from, text.length));
      out += text.slice(at, start) + inserted;
      at = Math.min(text.length, start + Math.max(0, removed));
    }
    return out + text.slice(at);
  }

  const list: Json[] = Array.isArray(base) ? base.slice() : [];
  const change = delta.k;
  if (change.d && change.d.length > 0) {
    const gone = new Set(change.d);
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const id = idOf(list[i]);
      if (id !== null && gone.has(id)) list.splice(i, 1);
    }
  }
  if (change.u) {
    const updates = change.u;
    for (let i = 0; i < list.length; i += 1) {
      const id = idOf(list[i]);
      if (id !== null && Object.prototype.hasOwnProperty.call(updates, id)) {
        list[i] = applyDelta(list[i], updates[id]);
      }
    }
  }
  for (const placement of change.p ?? []) {
    const [after, id] = placement;
    const index = list.findIndex((value) => idOf(value) === id);
    let element: Json;
    if (placement.length > 2) {
      element = placement[2] as Json;
      if (index >= 0) list.splice(index, 1);
    } else {
      if (index < 0) continue;
      element = list[index];
      list.splice(index, 1);
    }
    let at = 0;
    if (after !== null) {
      const anchor = list.findIndex((value) => idOf(value) === after);
      at = anchor >= 0 ? anchor + 1 : list.length;
    }
    list.splice(at, 0, element);
  }
  return list;
}

/** Sprawdza kształt delty przysłanej z zewnątrz, zanim cokolwiek ją nałoży. */
export function isDelta(value: unknown, depth = 0): value is Delta {
  if (depth > 64 || !isPlainObject(value as Json)) return false;
  const record = value as { [key: string]: unknown };
  const keys = Object.keys(record);
  if (keys.length !== 1) return false;
  const [key] = keys;
  const body = record[key];
  switch (key) {
    case "$":
      return body !== undefined;
    case "o":
      if (!isPlainObject(body as Json)) return false;
      return Object.entries(body as { [key: string]: unknown }).every(
        ([name, inner]) => !FORBIDDEN_KEYS.has(name) && (inner === null || isDelta(inner, depth + 1)),
      );
    case "t":
      return (
        Array.isArray(body) &&
        body.every(
          (splice) =>
            Array.isArray(splice) &&
            splice.length === 3 &&
            Number.isInteger(splice[0]) &&
            splice[0] >= 0 &&
            Number.isInteger(splice[1]) &&
            splice[1] >= 0 &&
            typeof splice[2] === "string",
        )
      );
    case "k": {
      if (!isPlainObject(body as Json)) return false;
      const keyed = body as { [key: string]: unknown };
      for (const part of Object.keys(keyed)) if (!["d", "u", "p"].includes(part)) return false;
      if (keyed.d !== undefined && !(Array.isArray(keyed.d) && keyed.d.every((id) => typeof id === "string"))) {
        return false;
      }
      if (keyed.u !== undefined) {
        if (!isPlainObject(keyed.u as Json)) return false;
        for (const inner of Object.values(keyed.u as object)) if (!isDelta(inner, depth + 1)) return false;
      }
      if (keyed.p !== undefined) {
        if (!Array.isArray(keyed.p)) return false;
        for (const placement of keyed.p) {
          if (!Array.isArray(placement) || (placement.length !== 2 && placement.length !== 3)) return false;
          if (placement[0] !== null && typeof placement[0] !== "string") return false;
          if (typeof placement[1] !== "string") return false;
          if (placement.length === 3 && idOf(placement[2] as Json) !== placement[1]) return false;
        }
      }
      return true;
    }
    default:
      return false;
  }
}

// --- Scalanie ---

/**
 * Składa dwie niezależne zmiany tej samej wersji [base]: [mine] (tutaj,
 * jeszcze niewysłane albo zrobione offline) i [theirs] (już na serwerze).
 * undefined znaczy „tej wartości nie ma" - pola albo elementu.
 */
export function merge3(
  base: Json | undefined,
  mine: Json | undefined,
  theirs: Json | undefined,
): Json | undefined {
  if (jsonEqual(mine, theirs)) return mine;
  if (jsonEqual(base, mine)) return theirs;
  if (jsonEqual(base, theirs)) return mine;
  // Jedna strona skasowała, druga zmieniła - zmiana wygrywa.
  if (mine === undefined) return theirs;
  if (theirs === undefined) return mine;

  if (isPlainObject(mine) && isPlainObject(theirs)) {
    const original = isPlainObject(base) ? base : {};
    const keys: string[] = Object.keys(theirs);
    for (const key of Object.keys(mine)) if (!Object.prototype.hasOwnProperty.call(theirs, key)) keys.push(key);
    for (const key of Object.keys(original)) if (!keys.includes(key)) keys.push(key);
    const result: JsonObject = {};
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const merged = merge3(own(original, key), own(mine, key), own(theirs, key));
      if (merged !== undefined) result[key] = merged;
    }
    return result;
  }

  if (
    Array.isArray(mine) &&
    Array.isArray(theirs) &&
    isKeyed(mine) &&
    isKeyed(theirs) &&
    (base === undefined || base === null || (Array.isArray(base) && isKeyed(base)))
  ) {
    return mergeKeyed(Array.isArray(base) ? base : [], mine, theirs);
  }

  if (typeof mine === "string" && typeof theirs === "string") {
    return mergeText(typeof base === "string" ? base : "", mine, theirs);
  }

  // Liczba, kolor, przełącznik, tablica punktów kreski - późniejsza zmiana.
  return mine;
}

function mergeKeyed(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const original = byId(base);
  const left = byId(mine);
  const right = byId(theirs);

  const merged = new Map<string, Json>();
  const ids = new Set<string>([...right.keys(), ...left.keys(), ...original.keys()]);
  for (const id of ids) {
    const value = merge3(original.get(id), left.get(id), right.get(id));
    if (value !== undefined) merged.set(id, value);
  }

  // Kolejność bierzemy od strony, która jej nie przestawiała - zwykle od
  // serwera; elementy drugiej strony wchodzą za swoim poprzednikiem.
  const mineReordered = reordered(base, mine);
  const theirsReordered = reordered(base, theirs);
  const [primary, secondary] = mineReordered && !theirsReordered ? [mine, theirs] : [theirs, mine];

  const order: string[] = [];
  const placed = new Set<string>();
  for (const value of primary) {
    const id = idOf(value) as string;
    if (merged.has(id)) {
      order.push(id);
      placed.add(id);
    }
  }
  let previous: string | null = null;
  for (const value of secondary) {
    const id = idOf(value) as string;
    if (!merged.has(id)) continue;
    if (!placed.has(id)) {
      const at = previous === null ? 0 : order.indexOf(previous) + 1;
      order.splice(at, 0, id);
      placed.add(id);
    }
    previous = id;
  }
  return order.map((id) => merged.get(id) as Json);
}

/** Czy [values] przestawia wzajemną kolejność elementów obecnych w [base]. */
function reordered(base: Json[], values: Json[]): boolean {
  const inBase = new Set(base.map(idOf));
  const inValues = new Set(values.map(idOf));
  const fromBase = base.map(idOf).filter((id) => inValues.has(id));
  const fromValues = values.map(idOf).filter((id) => inBase.has(id));
  if (fromBase.length !== fromValues.length) return true;
  for (let i = 0; i < fromBase.length; i += 1) if (fromBase[i] !== fromValues[i]) return true;
  return false;
}

// --- Scalanie tekstu ---

type Hunk = { oS: number; oE: number; aS: number; aE: number };

/** Dzieli tekst na wiersze razem ze znakiem końca - złączenie oddaje całość. */
export function splitLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

/**
 * Różnica dwóch ciągów metodą Myersa: odcinki, w których się różnią.
 * null, gdy ciągi różnią się bardziej niż [maxEdits] - wtedy liczenie
 * kosztowałoby za dużo, a i tak nie dałoby czytelnego scalenia.
 */
function editHunks(
  n: number,
  m: number,
  same: (i: number, j: number) => boolean,
  maxEdits: number,
): Hunk[] | null {
  let start = 0;
  while (start < n && start < m && same(start, start)) start += 1;
  let endN = n;
  let endM = m;
  while (endN > start && endM > start && same(endN - 1, endM - 1)) {
    endN -= 1;
    endM -= 1;
  }
  const lenA = endN - start;
  const lenB = endM - start;
  if (lenA === 0 && lenB === 0) return [];
  if (lenA === 0 || lenB === 0) return [{ oS: start, oE: endN, aS: start, aE: endM }];

  const max = lenA + lenB;
  const limit = Math.min(max, maxEdits);
  const offset = max + 1;
  const frontier = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;

  for (let d = 0; d <= limit && found < 0; d += 1) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && frontier[offset + k - 1] < frontier[offset + k + 1])) {
        x = frontier[offset + k + 1];
      } else {
        x = frontier[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < lenA && y < lenB && same(start + x, start + y)) {
        x += 1;
        y += 1;
      }
      frontier[offset + k] = x;
      if (x >= lenA && y >= lenB) {
        found = d;
        break;
      }
    }
    trace.push(frontier.slice(offset - d, offset + d + 1));
  }
  if (found < 0) return null;

  // Powrót po śladzie: od końca do początku, krok po kroku.
  type Move = 0 | 1 | 2; // 0 - ten sam element, 1 - skasowany z A, 2 - wstawiony z B
  const moves: Move[] = [];
  let x = lenA;
  let y = lenB;
  for (let d = found; d > 0; d -= 1) {
    const previous = trace[d - 1];
    const at = (k: number) => previous[k + d - 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const previousK = down ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;
    const middleX = down ? previousX : previousX + 1;
    while (x > middleX) {
      moves.push(0);
      x -= 1;
      y -= 1;
    }
    moves.push(down ? 2 : 1);
    x = previousX;
    y = previousY;
  }
  while (x > 0) {
    moves.push(0);
    x -= 1;
  }
  moves.reverse();

  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  let open: Hunk | null = null;
  for (const move of moves) {
    if (move === 0) {
      if (open) {
        open.oE = start + i;
        open.aE = start + j;
        hunks.push(open);
        open = null;
      }
      i += 1;
      j += 1;
      continue;
    }
    if (!open) open = { oS: start + i, oE: start + i, aS: start + j, aE: start + j };
    if (move === 1) i += 1;
    else j += 1;
  }
  if (open) {
    open.oE = start + i;
    open.aE = start + j;
    hunks.push(open);
  }
  return hunks;
}

type SidedHunk = Hunk & { side: 0 | 1 };

/** Czy odcinek [hunk] wchodzi w grupę [groupStart, groupEnd) albo jej dotyka wstawką. */
function touches(hunk: Hunk, groupStart: number, groupEnd: number): boolean {
  if (hunk.oS < groupEnd) return true;
  if (hunk.oS !== groupEnd) return false;
  // Na styku: spór tylko wtedy, gdy któraś strona coś w tym miejscu wstawia.
  return hunk.oS === hunk.oE || groupStart === groupEnd;
}

/** Tekst odcinka [from, to) bazy po zmianach jednej strony. */
function sideRegion<T>(
  base: T[],
  side: T[],
  hunks: Hunk[],
  from: number,
  to: number,
  join: (items: T[]) => string,
): string {
  let out = "";
  let at = from;
  for (const hunk of hunks) {
    out += join(base.slice(at, hunk.oS)) + join(side.slice(hunk.aS, hunk.aE));
    at = hunk.oE;
  }
  return out + join(base.slice(at, to));
}

type Merged = { text: string; clean: boolean };

/** Scalanie dwóch zmian na pociętym tekście - wspólna część wierszy i znaków. */
function mergeSequences<T>(
  base: T[],
  mine: T[],
  theirs: T[],
  mineHunks: Hunk[],
  theirsHunks: Hunk[],
  join: (items: T[]) => string,
  resolve: (base: string, mine: string, theirs: string) => Merged,
): Merged {
  const all: SidedHunk[] = [
    ...mineHunks.map((hunk) => ({ ...hunk, side: 0 as const })),
    ...theirsHunks.map((hunk) => ({ ...hunk, side: 1 as const })),
  ].sort((p, q) => p.oS - q.oS || p.oE - q.oE || p.side - q.side);

  let out = "";
  let clean = true;
  let position = 0;
  let index = 0;
  while (index < all.length) {
    const group: SidedHunk[] = [all[index]];
    let groupStart = all[index].oS;
    let groupEnd = all[index].oE;
    index += 1;
    while (index < all.length && touches(all[index], groupStart, groupEnd)) {
      groupStart = Math.min(groupStart, all[index].oS);
      groupEnd = Math.max(groupEnd, all[index].oE);
      group.push(all[index]);
      index += 1;
    }
    out += join(base.slice(position, groupStart));

    const fromMine = group.filter((hunk) => hunk.side === 0);
    const fromTheirs = group.filter((hunk) => hunk.side === 1);
    const mineText = sideRegion(base, mine, fromMine, groupStart, groupEnd, join);
    const theirsText = sideRegion(base, theirs, fromTheirs, groupStart, groupEnd, join);
    if (fromTheirs.length === 0) {
      out += mineText;
    } else if (fromMine.length === 0) {
      out += theirsText;
    } else if (mineText === theirsText) {
      out += mineText;
    } else {
      const resolved = resolve(join(base.slice(groupStart, groupEnd)), mineText, theirsText);
      out += resolved.text;
      if (!resolved.clean) clean = false;
    }
    position = groupEnd;
  }
  out += join(base.slice(position));
  return { text: out, clean };
}

/** Złączenie kawałków tekstu - wierszy albo słów. */
const joinLines = (items: string[]) => items.join("");

/**
 * Scalanie tekstu z trzech wersji. Wierszami, a gdzie obie strony ruszyły te
 * same wiersze - słowami. Kiedy i słowa się gryzą, zostają obie wersje.
 */
export function mergeText(base: string, mine: string, theirs: string): string {
  if (mine === theirs) return mine;
  if (base === mine) return theirs;
  if (base === theirs) return mine;

  const baseLines = splitLines(base);
  const mineLines = splitLines(mine);
  const theirsLines = splitLines(theirs);
  const mineHunks = editHunks(
    baseLines.length,
    mineLines.length,
    (i, j) => baseLines[i] === mineLines[j],
    MAX_LINE_EDITS,
  );
  const theirsHunks = editHunks(
    baseLines.length,
    theirsLines.length,
    (i, j) => baseLines[i] === theirsLines[j],
    MAX_LINE_EDITS,
  );
  if (!mineHunks || !theirsHunks) return keepBoth(mine, theirs);

  return mergeSequences(
    baseLines,
    mineLines,
    theirsLines,
    mineHunks,
    theirsHunks,
    joinLines,
    mergeRegion,
  ).text;
}

/**
 * Słowa, odstępy i pojedyncze znaki - na nich idzie druga próba scalenia.
 *
 * Nie na pojedynczych literach: dwie różne podmiany tego samego słowa
 * („zielony" na „niebieski" tu, na „czerwony" tam) dałyby się złożyć literami
 * w bełkot. Na słowach to czysty spór i zostają obie wersje.
 */
export function wordTokens(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    let j = i + 1;
    if (isWordCode(code)) {
      while (j < text.length && isWordCode(text.charCodeAt(j))) j += 1;
    } else if (code === 32 || code === 9) {
      while (j < text.length && (text.charCodeAt(j) === 32 || text.charCodeAt(j) === 9)) j += 1;
    }
    tokens.push(text.slice(i, j));
    i = j;
  }
  return tokens;
}

const LETTER_OR_DIGIT = /^[\p{L}\p{Nd}]$/u;

function isWordCode(code: number): boolean {
  if (code >= 0xd800 && code <= 0xdfff) return true;
  if (code < 128) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }
  return LETTER_OR_DIGIT.test(String.fromCharCode(code));
}

/** Spór w obrębie kilku wierszy: druga próba na słowach. */
function mergeRegion(base: string, mine: string, theirs: string): Merged {
  if (base.length + mine.length + theirs.length <= MAX_WORD_REGION) {
    const baseWords = wordTokens(base);
    const mineWords = wordTokens(mine);
    const theirsWords = wordTokens(theirs);
    const mineHunks = editHunks(
      baseWords.length,
      mineWords.length,
      (i, j) => baseWords[i] === mineWords[j],
      MAX_WORD_EDITS,
    );
    const theirsHunks = editHunks(
      baseWords.length,
      theirsWords.length,
      (i, j) => baseWords[i] === theirsWords[j],
      MAX_WORD_EDITS,
    );
    if (mineHunks && theirsHunks) {
      const merged = mergeSequences(
        baseWords,
        mineWords,
        theirsWords,
        mineHunks,
        theirsHunks,
        joinLines,
        () => ({ text: "", clean: false }),
      );
      if (merged.clean) return merged;
    }
  }
  return { text: keepBoth(mine, theirs), clean: false };
}

/**
 * Prawdziwy spór. Tekst wielowierszowy zatrzymuje obie wersje - najpierw tę,
 * którą inni już widzą, pod nią nową. Krótki napis w jednym wierszu bierze
 * późniejszą zmianę: dwa hasła węzła sklejone w jedno nic by nie znaczyły.
 */
function keepBoth(mine: string, theirs: string): string {
  if (!mine.includes("\n") && !theirs.includes("\n")) return mine;
  if (theirs === "") return mine;
  if (mine === "") return theirs;
  const separator = theirs.endsWith("\n") ? "" : "\n";
  return theirs + separator + mine;
}
