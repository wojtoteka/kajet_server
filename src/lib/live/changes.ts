/*
  Zapis zmian treści dla edycji na żywo.

  Każdy zapis treści notatki - z aplikacji, ze strony, od asystenta, z edycji
  na żywo - kończy się tutaj: liczymy deltę między treścią sprzed i po
  zapisie, odkładamy ją do tabeli live_changes i podajemy wszystkim, którzy
  mają notatkę otwartą. Kto otwiera notatkę albo wraca po chwili bez sieci,
  dociąga z tabeli tylko to, czego nie widział.

  Delta jest liczona po stronie serwera z dwóch pełnych treści. Dzięki temu
  stare wydania aplikacji (wysyłające całą notatkę) i strona też „nadają na
  żywo", choć same o delcie nic nie wiedzą.
*/

import { prisma } from "@/lib/prisma";
import { diff, type Delta, type Json } from "./merge";
import { hasListeners, publish } from "./bus";

export type ChangeOrigin = {
  /** Konto piszącego; puste przy pisaniu z odnośnika bez konta. */
  authorId?: string | null;
  /** Imię widoczne przy zmianie. */
  authorName?: string;
  /** Karta albo urządzenie, które wysłało zmianę - po tym nadawca pozna echo. */
  clientId?: string;
};

/** Jak długo trzymamy zmiany do dociągania. Starsze - pełna treść. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
/** Ile zmian jednej notatki trzymamy najwyżej. */
const KEEP_ROWS = 2_000;
/** Co który zapis sprząta stare wpisy tej notatki. */
const PRUNE_EVERY = 25;

let writesSincePrune = 0;

function parse(content: string | null): Json | undefined {
  if (content === null) return undefined;
  try {
    return JSON.parse(content) as Json;
  } catch {
    return undefined;
  }
}

/** Delta między dwiema treściami. Treść nie do odczytania - podmiana całości. */
export function contentDelta(before: string | null, after: string): Delta | null {
  const next = parse(after);
  if (next === undefined) return null;
  const previous = parse(before);
  if (previous === undefined) return { $: next };
  return diff(previous, next) ?? { o: {} };
}

export function cleanClientId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

/**
 * Odnotowuje zapis treści i podaje go dalej. Nie rzuca: treść jest już
 * zapisana, a kłopot z dziennikiem zmian nie może cofnąć zapisu - najwyżej
 * otwarte karty dostaną pełną treść przy następnym połączeniu.
 */
export async function recordContentChange(input: {
  noteId: string;
  before: string | null;
  after: string;
  version: number;
  origin?: ChangeOrigin;
}): Promise<void> {
  try {
    const delta = contentDelta(input.before, input.after);
    const clientId = cleanClientId(input.origin?.clientId);
    const authorName = (input.origin?.authorName ?? "").slice(0, 120);

    if (delta === null) {
      // Treść, której nie da się czytać jak JSON, nie ma delty. Otwarte karty
      // dostają ją w całości, a w dzienniku zostaje dziura - kto będzie
      // dociągał, dostanie pełną treść.
      publish(input.noteId, { type: "reset", v: input.version, content: input.after });
      return;
    }

    await prisma.liveChange.create({
      data: {
        noteId: input.noteId,
        version: input.version,
        authorId: input.origin?.authorId ?? null,
        authorName,
        clientId,
        operation: JSON.stringify(delta),
      },
    });

    if (hasListeners(input.noteId)) {
      publish(input.noteId, {
        type: "change",
        v: input.version,
        by: clientId,
        name: authorName,
        d: delta,
      });
    }

    writesSincePrune += 1;
    if (writesSincePrune >= PRUNE_EVERY) {
      writesSincePrune = 0;
      await pruneNote(input.noteId, input.version);
    }
  } catch (problem) {
    console.error("[live] zapis zmiany", problem);
  }
}

/** Notatka zniknęła (kosz albo skasowanie) - otwarte karty mają się zamknąć. */
export function announceGone(noteId: string): void {
  publish(noteId, { type: "gone" });
}

async function pruneNote(noteId: string, version: number): Promise<void> {
  await prisma.liveChange.deleteMany({
    where: {
      noteId,
      OR: [{ version: { lt: version - KEEP_ROWS } }, { createdAt: { lt: new Date(Date.now() - KEEP_MS) } }],
    },
  });
}

export type StoredChange = { v: number; by: string; name: string; d: Delta };

/**
 * Zmiany po wersji [since], po kolei. null znaczy „nie da się dociągnąć"
 * (dziennik nie sięga tak daleko) - wtedy trzeba oddać pełną treść.
 *
 * Wersja notatki rośnie też bez zmiany treści (gwiazdka, przeniesienie do
 * folderu), więc numery w dzienniku mają dziury. To nic: dziura znaczy, że
 * treść się nie zmieniła. Liczy się tylko to, czy dziennik sięga do [since] -
 * pierwszy wpis o wersji nie większej niż [since] to dowód, że żadna zmiana
 * treści po nim nie przepadła przy sprzątaniu.
 */
export async function changesSince(noteId: string, since: number): Promise<StoredChange[] | null> {
  if (since <= 0) return null;
  const anchor = await prisma.liveChange.findFirst({
    where: { noteId, version: { lte: since } },
    select: { id: true },
  });
  if (!anchor) return null;

  const rows = await prisma.liveChange.findMany({
    where: { noteId, version: { gt: since } },
    orderBy: [{ version: "asc" }, { id: "asc" }],
    take: 500,
  });
  if (rows.length === 500) return null;

  const changes: StoredChange[] = [];
  for (const row of rows) {
    try {
      changes.push({
        v: row.version,
        by: row.clientId,
        name: row.authorName,
        d: JSON.parse(row.operation) as Delta,
      });
    } catch {
      return null;
    }
  }
  return changes;
}

/**
 * Czy treść notatki jest dziś taka sama jak w wersji [base]. Prawda także
 * wtedy, gdy wersja urosła bez zmiany treści - po samej gwiazdce delta
 * z [base] dalej pasuje do notatki.
 */
export async function contentUnchangedSince(
  noteId: string,
  base: number,
  current: number,
): Promise<boolean> {
  if (base === current) return true;
  if (base <= 0 || base > current) return false;
  const newer = await prisma.liveChange.findFirst({
    where: { noteId, version: { gt: base } },
    select: { id: true },
  });
  if (newer) return false;
  const anchor = await prisma.liveChange.findFirst({
    where: { noteId, version: { lte: base } },
    select: { id: true },
  });
  return anchor !== null;
}

let sweeperStarted = false;

/** Raz na dobę wyrzuca zmiany starsze niż tydzień - dla wszystkich notatek. */
export function startLiveSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  const run = async () => {
    try {
      await prisma.liveChange.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } },
      });
    } catch (problem) {
      console.error(`[live] sprzątanie zmian: ${(problem as Error)?.message ?? problem}`);
    }
  };
  setTimeout(run, 90_000).unref();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}
