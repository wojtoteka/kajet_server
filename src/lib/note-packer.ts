/*
  Dociskanie starych notatek.

  Nowa treść pakuje się przy każdym zapisie (note-write.ts, note-content.ts).
  Notatki zapisane wcześniej leżą w bazie rozpakowane i ważą w limicie miejsca
  kilka razy więcej, niż muszą - a starej notatki zwykle nikt już nie zmienia,
  więc sama z siebie by się nie spakowała.

  Dlatego w tle przechodzimy po nich po kolei i pakujemy je w miejscu: ta sama
  treść, ten sam skrót, ta sama wersja i ta sama data zmiany. Urządzenia nie
  mają więc czego pobierać ani z czym się scalać - zmienia się tylko waga
  notatki w bazie i zajęte miejsce konta.

  Jedna notatka naraz, z przerwą, i tylko taka, której nikt nie ruszał od
  godziny - żeby nie wchodzić w drogę edycji na żywo. Gdy wszystko jest już
  spakowane, przebieg kończy się na pierwszym zapytaniu.
*/

import { prisma } from "@/lib/prisma";
import { changeUsed, humanSize } from "@/lib/quota";
import { PACKED, PACK_FROM_BYTES, isPacked, packNoteContent } from "@/lib/note-content";

const DAY = 86_400_000;

/** Ile notatek bierzemy z bazy jednym zapytaniem. */
const BATCH = 50;

/** Notatka zmieniona później niż tyle temu jeszcze może być w użyciu. */
const IDLE_MS = 60 * 60_000;

/** Przerwa po każdej spakowanej notatce - serwer ma w tym czasie obsługiwać ludzi. */
const PAUSE_MS = 50;

export type PackResult = { packed: number; savedBytes: number };

/** Pakuje wszystkie notatki, które jeszcze leżą w bazie rozpakowane. */
export async function packStoredNotes(
  options: { now?: Date; pauseMs?: number } = {},
): Promise<PackResult> {
  const idleSince = new Date((options.now ?? new Date()).getTime() - IDLE_MS);
  const pauseMs = options.pauseMs ?? PAUSE_MS;
  const result: PackResult = { packed: 0, savedBytes: 0 };

  // Kursor po identyfikatorze, a nie „pierwsze nie spakowane": notatka, której
  // pakowanie nic nie daje, zostaje rozpakowana i inaczej stałaby w miejscu.
  let after = "";
  for (;;) {
    const batch = await prisma.note.findMany({
      where: {
        id: { gt: after },
        updatedAt: { lt: idleSince },
        // Zero to rozmiar z dawnych wydań, które go nie liczyły.
        OR: [{ sizeBytes: { gte: PACK_FROM_BYTES } }, { sizeBytes: 0 }],
        NOT: { content: { startsWith: PACKED } },
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, ownerId: true, version: true, sizeBytes: true, updatedAt: true },
    });
    if (batch.length === 0) break;

    for (const note of batch) {
      const saved = await packOne(note);
      if (saved === null) continue;
      result.packed += 1;
      result.savedBytes += saved;
      if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    after = batch[batch.length - 1].id;
  }

  return result;
}

/** Ile bajtów zwolniło spakowanie notatki, albo null, gdy jej nie ruszyliśmy. */
async function packOne(note: {
  id: string;
  ownerId: string;
  version: number;
  sizeBytes: number;
  updatedAt: Date;
}): Promise<number | null> {
  const row = await prisma.note.findUnique({ where: { id: note.id }, select: { content: true } });
  if (!row) return null;

  const stored = await packNoteContent(row.content);
  if (!isPacked(stored)) return null;
  const size = Buffer.byteLength(stored, "utf8");

  /*
    Zapis tylko wtedy, gdy wiersz jest wciąż taki, jak go przeczytaliśmy -
    inaczej ktoś zdążył go zmienić, a jego zapis i tak poszedł spakowany.
    Data zmiany zostaje stara: po niej urządzenia pobierają zmiany, a treść
    dla nich jest ta sama.
  */
  const updated = await prisma.note.updateMany({
    where: {
      id: note.id,
      version: note.version,
      sizeBytes: note.sizeBytes,
      updatedAt: note.updatedAt,
    },
    data: { content: stored, sizeBytes: size, updatedAt: note.updatedAt },
  });
  if (updated.count === 0) return null;

  await changeUsed(note.ownerId, size - note.sizeBytes);
  return note.sizeBytes - size;
}

let started = false;

/**
 * Pakowanie w tle: krótko po starcie serwera i potem raz na dobę - wtedy łapie
 * notatki, które przy poprzednim przebiegu były akurat w użyciu. Woła to
 * instrumentation.ts.
 */
export function startNotePacker(): void {
  if (started) return;
  started = true;

  const run = async () => {
    try {
      const result = await packStoredNotes();
      if (result.packed > 0) {
        console.log(
          `[notatki] spakowano ${result.packed} notatek, ` +
            `w bazie zwolniło się ${humanSize(result.savedBytes)}`,
        );
      }
    } catch (problem) {
      // Pakowanie nie ma prawa położyć serwera - następny przebieg za dobę.
      console.error(`[notatki] pakowanie nie doszło do skutku: ${(problem as Error)?.message ?? problem}`);
    }
  };

  // Dwie minuty zapasu po starcie: najpierw niech wstanie baza i serwer.
  setTimeout(run, 2 * 60_000).unref();
  setInterval(run, DAY).unref();
}
