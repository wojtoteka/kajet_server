import { prisma } from "./prisma";
import { settings } from "./settings";
import { apiWords } from "./language";
import { outOfSpaceReason, serverOutOfSpaceReason } from "./i18n";

export type QuotaState = {
  quota: bigint;
  used: bigint;
  free: bigint | null;
  unlimited: boolean;
  quotaUntil: Date | null;
};

export async function quotaState(userId: string): Promise<QuotaState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      quotaBytes: true,
      permanentQuotaBytes: true,
      quotaUntil: true,
      usedBytes: true,
    },
  });

  let quota = user.quotaBytes;
  let quotaUntil = user.quotaUntil;

  if (quotaUntil && quotaUntil < new Date()) {
    quota = user.permanentQuotaBytes;
    quotaUntil = null;
    await prisma.user.update({
      where: { id: userId },
      data: { quotaBytes: user.permanentQuotaBytes, quotaUntil: null },
    });
  }

  const unlimited = quota === 0n;
  return {
    quota,
    used: user.usedBytes,
    free: unlimited ? null : quota - user.usedBytes,
    unlimited,
    quotaUntil,
  };
}

export type QuotaCheck = { ok: true } | { ok: false; reason: string };

export async function fitsInQuota(userId: string, addedBytes: number): Promise<QuotaCheck> {
  if (addedBytes <= 0) return { ok: true };

  const state = await quotaState(userId);

  if (!state.unlimited && state.free !== null && BigInt(addedBytes) > state.free) {
    return {
      ok: false,
      reason: outOfSpaceReason(await apiWords(), humanSize(state.used), humanSize(state.quota)),
    };
  }

  const total = await usedOnServer();
  if (overServerLimit(total, addedBytes)) {
    return {
      ok: false,
      reason: serverOutOfSpaceReason(await apiWords(), humanSize(total), humanSize(SERVER_QUOTA)),
    };
  }

  return { ok: true };
}

/**
 * Granica dla całego serwera. Trzymana jako bigint, bo zajętość kont też nią
 * jest - i sumy bajtów nie mają prawa przejść przez liczbę zmiennoprzecinkową.
 */
export const SERVER_QUOTA = BigInt(settings.quotas.server);

/** Ile zajmują wszystkie konta razem. */
export async function usedOnServer(): Promise<bigint> {
  const totals = await prisma.user.aggregate({ _sum: { usedBytes: true } });
  return totals._sum.usedBytes ?? 0n;
}

/**
 * Czy ten zapis przekroczyłby granicę serwera.
 *
 * Osobna, czysta funkcja, bo to jedno porównanie decyduje o przyjęciu albo
 * odrzuceniu każdego zapisu i musi dać się sprawdzić testem bez bazy.
 */
export function overServerLimit(usedTotal: bigint, addedBytes: number): boolean {
  if (SERVER_QUOTA <= 0n) return false;
  if (addedBytes <= 0) return false;
  return usedTotal + BigInt(addedBytes) > SERVER_QUOTA;
}

export async function changeUsed(userId: string, differenceBytes: number): Promise<void> {
  if (differenceBytes === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { usedBytes: { increment: BigInt(differenceBytes) } },
  });

  // The counter has no business going below zero, but should it do so after
  // some unfinished operation, we straighten it out here.
  await prisma.$executeRaw`UPDATE users SET usedBytes = 0 WHERE id = ${userId} AND usedBytes < 0`;
}

/**
 * Atomically reserve storage against the quota (check + increment under a row
 * lock). Call this before writing; on a failed write call `changeUsed` with
 * the negative amount to release the reservation.
 */
export async function reserveBytes(userId: string, addedBytes: number): Promise<QuotaCheck> {
  if (addedBytes <= 0) {
    await changeUsed(userId, addedBytes);
    return { ok: true };
  }

  // Słownik bierzemy przed transakcją: w jej środku każde zbędne czekanie
  // trzyma wiersz konta zablokowany dłużej, niż trzeba.
  const words = await apiWords();

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          quotaBytes: bigint;
          permanentQuotaBytes: bigint;
          quotaUntil: Date | null;
          usedBytes: bigint;
        }>
      >`SELECT quotaBytes, permanentQuotaBytes, quotaUntil, usedBytes FROM users WHERE id = ${userId} FOR UPDATE`;

      const user = rows[0];
      if (!user) {
        throw Object.assign(new Error("missing-user"), {
          quotaReason: words.apiNoSuchAccount,
        });
      }

      let quota = user.quotaBytes;
      if (user.quotaUntil && user.quotaUntil < new Date()) {
        quota = user.permanentQuotaBytes;
        await tx.user.update({
          where: { id: userId },
          data: { quotaBytes: user.permanentQuotaBytes, quotaUntil: null },
        });
      }

      if (quota !== 0n) {
        const free = quota - user.usedBytes;
        if (BigInt(addedBytes) > free) {
          throw Object.assign(new Error("out-of-space"), {
            quotaReason: outOfSpaceReason(words, humanSize(user.usedBytes), humanSize(quota)),
          });
        }
      }

      /*
        Granica całego serwera - ostatnia zapora przed zapełnieniem dysku.
        Liczymy ją w tej samej transakcji, co limit konta, żeby brała pod uwagę
        wyłącznie zapisy już zatwierdzone. Dwa zapisy z RÓŻNYCH kont, biegnące
        dokładnie równocześnie, mogą przez tę granicę przejść razem - blokada
        wiersza trzyma tylko jedno konto. Przekroczenie sięga wtedy najwyżej
        wielkości tych zapisów (pojedynczy plik to najwyżej 25 MB), a następny
        zapis zostaje już odrzucony. Pełna szczelność wymagałaby blokady na
        całej tabeli kont, czyli ustawienia wszystkich piszących w kolejkę.
      */
      const total = (await tx.user.aggregate({ _sum: { usedBytes: true } }))._sum.usedBytes ?? 0n;
      if (overServerLimit(total, addedBytes)) {
        throw Object.assign(new Error("server-full"), {
          quotaReason: serverOutOfSpaceReason(words, humanSize(total), humanSize(SERVER_QUOTA)),
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { usedBytes: { increment: BigInt(addedBytes) } },
      });
    });
    return { ok: true };
  } catch (problem) {
    if (
      problem &&
      typeof problem === "object" &&
      "quotaReason" in problem &&
      typeof (problem as { quotaReason: unknown }).quotaReason === "string"
    ) {
      return { ok: false, reason: (problem as { quotaReason: string }).quotaReason };
    }
    throw problem;
  }
}

export async function recomputeUsed(userId: string): Promise<bigint> {
  const notes = await prisma.note.aggregate({
    where: { ownerId: userId },
    _sum: { sizeBytes: true },
  });
  const attachments = await prisma.attachment.aggregate({
    where: { note: { ownerId: userId } },
    _sum: { sizeBytes: true },
  });

  const total = BigInt(notes._sum.sizeBytes ?? 0) + BigInt(attachments._sum.sizeBytes ?? 0);

  await prisma.user.update({
    where: { id: userId },
    data: { usedBytes: total },
  });
  return total;
}

export const DEFAULT_QUOTA = BigInt(settings.quotas.default);

export function humanSize(bytes: bigint | number): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  // Zero bytes of use is "0 B". Unlimited storage is quota === 0, handled
  // separately by callers (storage.unlimited), not here.
  if (value === 0) return "0 B";
  if (value < 1024) return `${value} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let size = value / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  const rounded = size >= 100 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}
