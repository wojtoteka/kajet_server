import { z } from "zod";
import { prisma } from "./prisma";
import { KEEP_DAYS, KEEP_NEWEST, LONGEST_REPORT } from "./crash-limits";

/**
 * Kształt zapytania z aplikacji (cloud/…/CrashReporter.kt).
 *
 * Obowiązkowy jest tylko `report`. Reszta to wygoda: aplikacja wyciąga te pola
 * z nagłówka raportu, ale starszy plik może ich nie mieć, a raport i tak ma
 * dojść. Schemat siedzi tutaj, a nie w route.ts, bo Next.js pilnuje, co wolno
 * eksportować z tras - a test kontraktu musi mieć do niego dostęp.
 */
export const crashBody = z.object({
  report: z.string().min(1).max(LONGEST_REPORT),
  appVersion: z.string().max(40).optional(),
  versionCode: z.number().int().optional(),
  device: z.string().max(120).optional(),
  android: z.string().max(40).optional(),
  thread: z.string().max(80).optional(),
});

/*
  Raport przychodzi w postaci, w jakiej człowiek widzi go na ekranie po awarii
  (patrz CrashLog.report w aplikacji):

    Kajet 1.0
    Czas: 2026-08-06 14:33:14
    Urządzenie: LENOVO TB520FU, Android 16
    Wątek: main
                                <- pusta linia oddziela nagłówek od śladu
    java.lang.IllegalStateException: coś pękło
      at wojtoteka.ovh.kajet.Cos.metoda(Cos.kt:42)
      ...
*/

/** Odcisk nie może rozsadzić kolumny - w bazie stoi VarChar(200). */
export const LONGEST_FINGERPRINT = 200;

/**
 * Odcisk awarii: rodzaj wyjątku plus miejsce, w którym poleciał.
 *
 * Po to, żeby ta sama awaria zgłoszona dwadzieścia razy dała się rozpoznać
 * jako jedna rzecz do naprawienia, a nie dwadzieścia osobnych. Sam rodzaj
 * wyjątku by nie wystarczył: NullPointerException w dwóch różnych miejscach
 * to dwie różne usterki.
 */
export function fingerprintOf(report: string): string {
  const lines = report.split(/\r?\n/);

  // Nagłówek kończy pierwsza pusta linia. Gdy jej nie ma (obcięty raport,
  // inna wersja aplikacji), czytamy od początku - gorzej, ale nie pusto.
  const blank = lines.findIndex((line) => line.trim() === "");
  const start = blank >= 0 ? blank + 1 : 0;

  const isFrame = (line: string) => /^\s*at\s+/.test(line);

  const failure =
    lines.slice(start).find((line) => line.trim() !== "" && !isFrame(line))?.trim() ??
    lines.find((line) => line.trim() !== "")?.trim() ??
    "";

  const frame = lines.find(isFrame)?.trim() ?? "";

  const both = frame ? `${failure} | ${frame}` : failure;
  return both.slice(0, LONGEST_FINGERPRINT) || "awaria bez opisu";
}

/**
 * Sprząta stare raporty.
 *
 * Punkt przyjmujący awarie jest otwarty dla każdego, więc baza nie może rosnąć
 * bez końca. Zostaje [KEEP_NEWEST] najnowszych i nic starszego niż [KEEP_DAYS]
 * dni - której granicy dobije się pierwsza, ta obowiązuje.
 */
export async function pruneCrashReports(): Promise<void> {
  const oldest = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  await prisma.crashReport.deleteMany({ where: { createdAt: { lt: oldest } } });

  // Numery rosną same, więc "starszy" to po prostu "mniejszy numer".
  const edge = await prisma.crashReport.findMany({
    orderBy: { id: "desc" },
    skip: KEEP_NEWEST - 1,
    take: 1,
    select: { id: true },
  });

  const keepFrom = edge[0]?.id;
  if (keepFrom !== undefined) {
    await prisma.crashReport.deleteMany({ where: { id: { lt: keepFrom } } });
  }
}
