/*
  Samo opróżnianie kosza.

  Notatka wyrzucona do kosza zostaje w bazie, a jej załączniki na dysku - i tak
  ma być, bo do kosza się sięga. Gorzej, że dotąd nie znikała stamtąd nigdy:
  kosz na serwerze mógł opróżnić tylko człowiek, na stronie. Aplikacja o swoim
  koszu wie, ale serwerowego nie rusza, więc pliki po skasowanych notatkach
  leżały bezterminowo i liczyły się do limitu miejsca.

  Dlatego raz na dobę przechodzimy po notatkach leżących w koszu dłużej niż
  TRASH_DAYS (domyślnie 30 dni) i kasujemy je tak samo, jak robi to przycisk
  „Opróżnij kosz": wiersz, załączniki, katalog na dysku i miejsce w limicie.
  TRASH_DAYS=0 wyłącza sprzątanie.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import { purgeNoteForUser } from "@/lib/note-write";

const DAY = 86_400_000;

/** Ile notatek najwyżej w jednym przebiegu - żeby zaległy kosz nie zajął nocy. */
const BATCH = 500;

export type SweepResult = {
  /** Ile notatek zastano do skasowania (najwyżej BATCH). */
  found: number;
  purged: number;
  failed: number;
};

/**
 * Ile dni zostało notatce w koszu, zanim sprzątanie zabierze ją na zawsze.
 *
 * Ta sama arytmetyka co w aplikacji (Housekeeping.daysLeft): zaokrąglenie
 * w górę, bo dopóki został choćby kawałek dnia, jest to jeszcze „jeden
 * dzień". Zero znaczy: zniknie przy najbliższym przebiegu sprzątania.
 * Strona kosza pokazuje z tego napis „Zniknie za X dni" — liczbę i napis
 * liczy jedno miejsce, żeby odliczanie i kasowanie nie mogły się rozjechać.
 */
export function trashDaysLeft(
  deletedAt: Date,
  days = settings.trash.days,
  now = new Date(),
): number {
  const left = deletedAt.getTime() + days * DAY - now.getTime();
  if (left <= 0) return 0;
  return Math.ceil(left / DAY);
}

/**
 * Kasuje na zawsze notatki leżące w koszu dłużej niż `days` dni.
 * Jedna notatka, która nie da się skasować (na przykład prawa do pliku),
 * nie przerywa reszty przebiegu.
 */
export async function purgeExpiredTrash(days = settings.trash.days): Promise<SweepResult> {
  if (days <= 0) return { found: 0, purged: 0, failed: 0 };

  const cutoff = new Date(Date.now() - days * DAY);
  const stale = await prisma.note.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, ownerId: true },
    orderBy: { deletedAt: "asc" },
    take: BATCH,
  });

  let purged = 0;
  let failed = 0;
  for (const note of stale) {
    try {
      const outcome = await purgeNoteForUser(note.ownerId, note.id);
      if (outcome.status === "ok") purged += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { found: stale.length, purged, failed };
}

let started = false;

/**
 * Uruchamia sprzątanie w tle: raz krótko po starcie serwera i potem co dobę.
 * Woła to instrumentation.ts, czyli sam Next przy podnoszeniu procesu -
 * nie trzeba nic ustawiać w cronie.
 */
export function startTrashSweeper(): void {
  if (started || settings.trash.days <= 0) return;
  started = true;

  const run = async () => {
    try {
      const result = await purgeExpiredTrash();
      if (result.found > 0) {
        console.log(
          `[kosz] skasowano na zawsze ${result.purged} notatek starszych niż ` +
            `${settings.trash.days} dni${result.failed > 0 ? `, nie udało się: ${result.failed}` : ""}`,
        );
      }
    } catch (problem) {
      // Sprzątanie nie ma prawa położyć serwera. Baza bywa jeszcze niegotowa
      // w pierwszych sekundach po starcie - następny przebieg będzie za dobę.
      console.error(`[kosz] sprzątanie nie doszło do skutku: ${(problem as Error)?.message ?? problem}`);
    }
  };

  // Minuta zapasu po starcie: najpierw niech wstanie baza i serwer.
  setTimeout(run, 60_000).unref();
  setInterval(run, DAY).unref();
}
