import { prisma } from "./prisma";
import { settings } from "./settings";

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
  if (state.unlimited) return { ok: true };

  if (state.free !== null && BigInt(addedBytes) > state.free) {
    return {
      ok: false,
      reason:
        `Brakuje miejsca na koncie. Zajęte ${humanSize(state.used)} z ${humanSize(state.quota)}. ` +
        `Skasuj coś z kosza albo poproś administratora o większy limit.`,
    };
  }
  return { ok: true };
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
          quotaReason: "Nie ma takiego konta.",
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
            quotaReason:
              `Brakuje miejsca na koncie. Zajęte ${humanSize(user.usedBytes)} z ${humanSize(quota)}. ` +
              `Skasuj coś z kosza albo poproś administratora o większy limit.`,
          });
        }
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
