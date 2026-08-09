/*
  Sprzątanie kont, z których nikt nie korzysta.

  Konto bez śladu życia przez INACTIVE_DAYS (domyślnie rok) dostaje jedno
  ostrzeżenie na pocztę. Jeśli przez kolejne INACTIVE_GRACE_DAYS (domyślnie
  miesiąc) nadal nikt się nie odezwie, konto znika razem ze wszystkim, co na
  nim było. Powrót w dowolnym momencie kasuje ostrzeżenie i wszystko zaczyna
  się od nowa.

  ŚLAD ŻYCIA to nie samo logowanie.

  Tablet loguje się raz i potem chodzi na tokenie miesiącami - gdyby liczyło
  się wyłącznie `lastSignInAt`, konto codziennie synchronizowanej biblioteki
  wyleciałoby po roku razem z notatkami. Dlatego za ślad życia uchodzi
  najpóźniejsza z czterech rzeczy: założenie konta, ostatnie logowanie,
  ostatnie użycie tokenu przez aplikację i ostatni zapis notatki. Wystarczy
  jedna z nich, żeby konto zostało.

  Przebieg wisi na zegarze procesu, tak samo jak sprzątanie kosza - nie trzeba
  niczego wpisywać do crona.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import { removeAccount } from "@/lib/account-delete";
import { inactiveAccountMail, send } from "@/lib/mail";

const DAY = 86_400_000;

/** Ile kont najwyżej w jednym przebiegu, żeby zaległość nie zajęła nocy. */
const BATCH = 200;

export type InactiveSweep = {
  /** Ile kont dostało ostrzeżenie w tym przebiegu. */
  warned: number;
  /** Ile kont skasowano. */
  deleted: number;
  /** Ile kont wróciło do życia po ostrzeżeniu - znacznik zdjęty. */
  revived: number;
  /** Ile razy nie udało się wysłać ostrzeżenia albo skasować konta. */
  failed: number;
};

/**
 * Ostatni ślad życia na koncie. Bierzemy najpóźniejszy z czterech znanych
 * momentów; szukamy tylko wtedy, gdy wstępne sito już coś przepuściło, więc
 * te dwa dodatkowe zapytania idą po garstce kont, nie po całej bazie.
 */
async function lastActivity(user: {
  id: string;
  createdAt: Date;
  lastSignInAt: Date | null;
}): Promise<Date> {
  const [token, note] = await Promise.all([
    prisma.appToken.findFirst({
      where: { userId: user.id },
      orderBy: { lastUsedAt: "desc" },
      select: { lastUsedAt: true, createdAt: true },
    }),
    prisma.note.findFirst({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const moments = [
    user.createdAt,
    user.lastSignInAt,
    token?.lastUsedAt ?? token?.createdAt ?? null,
    note?.updatedAt ?? null,
  ].filter((moment): moment is Date => moment instanceof Date);

  return new Date(Math.max(...moments.map((moment) => moment.getTime())));
}

/**
 * Jeden przebieg sprzątania. Jedno konto, które się nie udało (poczta nie
 * poszła, plik nie chciał zniknąć), nie przerywa reszty.
 */
export async function sweepInactiveAccounts(
  days = settings.inactive.days,
  graceDays = settings.inactive.graceDays,
): Promise<InactiveSweep> {
  const result: InactiveSweep = { warned: 0, deleted: 0, revived: 0, failed: 0 };
  if (days <= 0) return result;

  const now = Date.now();
  const cutoff = new Date(now - days * DAY);

  /*
    Wstępne sito po samej bazie: konto założone dawno temu, które albo nigdy
    się nie logowało, albo logowało się dawniej niż granica. Ostateczną
    decyzję podejmuje lastActivity - to sito ma tylko nie kazać nam chodzić
    po wszystkich kontach naraz.
  */
  const candidates = await prisma.user.findMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ lastSignInAt: null }, { lastSignInAt: { lt: cutoff } }],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      email: true,
      login: true,
      createdAt: true,
      lastSignInAt: true,
      inactiveWarnedAt: true,
    },
  });

  for (const user of candidates) {
    try {
      const seen = await lastActivity(user);

      // Ktoś tu jednak jest. Zdejmujemy ostrzeżenie, jeśli wisiało.
      if (seen.getTime() >= cutoff.getTime()) {
        if (user.inactiveWarnedAt) {
          await prisma.user.update({
            where: { id: user.id },
            data: { inactiveWarnedAt: null },
          });
          result.revived += 1;
        }
        continue;
      }

      // Ostrzeżenie jeszcze nie poszło.
      if (!user.inactiveWarnedAt) {
        const sent = await send(
          inactiveAccountMail(
            user.email,
            `${settings.baseUrl.replace(/\/$/, "")}/signin`,
            days,
            graceDays,
          ),
        );

        /*
          Poczta nie poszła - konto NIE dostaje znacznika. Bez tego zegar
          karencji ruszyłby mimo że nikt nikogo nie ostrzegł, a konto
          zniknęłoby bez jednego słowa. Następny przebieg spróbuje jeszcze raz.
        */
        if (!sent) {
          result.failed += 1;
          continue;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { inactiveWarnedAt: new Date() },
        });
        result.warned += 1;
        continue;
      }

      // Ostrzeżenie wisi. Czy karencja już minęła?
      if (now - user.inactiveWarnedAt.getTime() < graceDays * DAY) continue;

      const removed = await removeAccount(user.id);
      if (!removed) continue;

      await prisma.auditEntry.create({
        data: {
          // Nikt tego nie kazał zrobić - zrobił to sam serwer.
          actorId: null,
          action: "account.inactive.deleted",
          details:
            `${removed.login}, notatek: ${removed.noteCount}, ` +
            `bez ruchu od ${days} dni, ostrzeżenie ` +
            `${user.inactiveWarnedAt.toISOString().slice(0, 10)}`,
        },
      });
      result.deleted += 1;
    } catch (problem) {
      result.failed += 1;
      console.error(
        `[konta] konto ${user.login} nie doczekało się sprzątania: ` +
          `${(problem as Error)?.message ?? problem}`,
      );
    }
  }

  return result;
}

let started = false;

/**
 * Uruchamia sprzątanie w tle: raz krótko po starcie serwera i potem co dobę.
 * Woła to instrumentation.ts, czyli sam Next przy podnoszeniu procesu.
 */
export function startInactiveSweeper(): void {
  if (started || settings.inactive.days <= 0) return;
  started = true;

  const run = async () => {
    try {
      const result = await sweepInactiveAccounts();
      if (result.warned || result.deleted || result.revived || result.failed) {
        console.log(
          `[konta] ostrzeżeń: ${result.warned}, skasowanych: ${result.deleted}, ` +
            `powrotów: ${result.revived}` +
            (result.failed ? `, nie udało się: ${result.failed}` : ""),
        );
      }
    } catch (problem) {
      // Sprzątanie nie ma prawa położyć serwera. Baza bywa jeszcze niegotowa
      // w pierwszych sekundach po starcie - następny przebieg będzie za dobę.
      console.error(
        `[konta] sprzątanie nie doszło do skutku: ${(problem as Error)?.message ?? problem}`,
      );
    }
  };

  // Dwie minuty zapasu po starcie, żeby nie wchodzić w drogę sprzątaniu kosza.
  setTimeout(run, 120_000).unref();
  setInterval(run, DAY).unref();
}
