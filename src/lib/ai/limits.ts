/*
  Ile razy dziennie i na godzinę wolno poprosić asystenta.

  Liczone z tabeli ai_calls, a nie z licznika w pamięci procesu jak przy
  uruchamianiu kodu. Powód jest prosty: wywołanie modelu kosztuje pieniądze
  i ma zostawić ślad w rozliczeniach, więc wiersz w bazie i tak powstaje -
  a skoro powstaje, to nie ma po co liczyć tego drugi raz obok. Przy okazji
  limit przeżywa wdrożenie, czego licznik w pamięci nie robi.

  Liczą się WSZYSTKIE wywołania, także nieudane. Inaczej model, który wywraca
  się w kółko, mógłby kosztować bez końca - a za tokeny wejściowe płaci się
  także wtedy, gdy odpowiedź do niczego się nie nadała.

  Okna są przesuwane: „ostatnie 24 godziny", nie „od północy". Limit dobowy
  odblokowywany o północy zachęca do czekania do północy.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import type { Words } from "@/lib/i18n";
import { aiLimitReached } from "@/lib/i18n";

export type AiLimitCheck =
  | { allowed: true; leftToday: number }
  | { allowed: false; message: string };

/** Limit dobowy tego konta: własny, gdy ustawiony, inaczej domyślny z ustawień. */
export function dailyLimitFor(account: { aiDailyLimit: number }): number {
  return account.aiDailyLimit > 0 ? account.aiDailyLimit : settings.ai.callsPerDay;
}

export async function checkAiLimit(
  account: { id: string; aiDailyLimit: number },
  words: Words,
): Promise<AiLimitCheck> {
  const now = Date.now();
  const daily = dailyLimitFor(account);
  const hourly = settings.ai.callsPerHour;

  const [today, thisHour] = await Promise.all([
    prisma.aiCall.count({
      where: { userId: account.id, createdAt: { gte: new Date(now - 86_400_000) } },
    }),
    prisma.aiCall.count({
      where: { userId: account.id, createdAt: { gte: new Date(now - 3_600_000) } },
    }),
  ]);

  if (today >= daily) {
    return { allowed: false, message: aiLimitReached(words, daily, "doba") };
  }
  if (thisHour >= hourly) {
    return { allowed: false, message: aiLimitReached(words, hourly, "godzina") };
  }

  return { allowed: true, leftToday: daily - today - 1 };
}

export type AiUsageSummary = { today: number; week: number; tokens: number };

export const NO_AI_USAGE: AiUsageSummary = { today: 0, week: 0, tokens: 0 };

/**
 * Zużycie dla całej listy kont naraz, do panelu administratora.
 *
 * Dwa zapytania na całą stronę, nie dwa na konto: przy dwustu kontach ta
 * różnica to czterysta zapytań na jedno otwarcie listy.
 */
export async function aiUsageForMany(
  userIds: string[],
): Promise<Map<string, AiUsageSummary>> {
  const summary = new Map<string, AiUsageSummary>();
  if (userIds.length === 0) return summary;

  const now = Date.now();
  const [today, week] = await Promise.all([
    prisma.aiCall.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: new Date(now - 86_400_000) } },
      _count: { _all: true },
    }),
    prisma.aiCall.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: new Date(now - 7 * 86_400_000) } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  for (const row of week) {
    summary.set(row.userId, {
      today: 0,
      week: row._count._all,
      tokens: (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0),
    });
  }
  for (const row of today) {
    const current = summary.get(row.userId) ?? { ...NO_AI_USAGE };
    summary.set(row.userId, { ...current, today: row._count._all });
  }

  return summary;
}
