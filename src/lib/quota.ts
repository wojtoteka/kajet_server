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

  return { ...readQuota(quota, user.usedBytes), quotaUntil };
}

/**
 * Jak czytać zapisany limit miejsca.
 *
 * ZERO ZNACZY ZERO, a „bez ograniczeń" zapisuje się liczbą UJEMNĄ (-1).
 * Do niedawna było odwrotnie: zerem zapisywało się brak ograniczeń, a konto,
 * któremu nikt miejsca nie nadał, dostawało pół giga z ustawień serwera.
 * Pomyłka w jedną stronę (wpisane zero) oddawała cały dysk, a w drugą -
 * rozdawała miejsce bez pytania. Teraz brak nadania znaczy dokładnie tyle,
 * ile mówi: nic, dopóki miejsce nie zostanie nadane świadomie.
 *
 * Wolne miejsce wychodzi ujemne dla konta, któremu miejsce odebrano po tym,
 * jak zdążyło coś zapisać. To jest w porządku: [fitsInQuota] porównuje liczby,
 * więc każdy kolejny zapis odbija się, a to, co już leży, zostaje nietknięte.
 *
 * Osobna funkcja, bo to jedyne miejsce, w którym rozstrzyga się znaczenie
 * tych liczb - i jedyne, które da się sprawdzić testem bez bazy danych.
 */
export function readQuota(
  quota: bigint,
  used: bigint,
): Omit<QuotaState, "quotaUntil"> {
  const unlimited = quota < 0n;
  return {
    quota,
    used,
    free: unlimited ? null : quota - used,
    unlimited,
  };
}

export type QuotaCheck = { ok: true } | { ok: false; reason: string };

export async function fitsInQuota(userId: string, addedBytes: number): Promise<QuotaCheck> {
  if (addedBytes <= 0) return { ok: true };

  const state = await quotaState(userId);

  if (!fitsIn(state, addedBytes)) {
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
 * Czy zapis tylu bajtów mieści się w limicie konta.
 *
 * Jedna funkcja dla obu dróg: sprawdzenia z góry ([fitsInQuota]) i tej pod
 * blokadą wiersza ([reserveBytes]). Wcześniej każda miała własne porównanie
 * i przy zmianie znaczenia zera jedna z nich została przy starym - konto
 * z zerowym limitem zapisywało bez końca, choć na ekranie miało „0 B".
 */
export function fitsIn(
  state: { unlimited: boolean; free: bigint | null },
  addedBytes: number,
): boolean {
  if (state.unlimited || state.free === null) return true;
  return BigInt(addedBytes) <= state.free;
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

      /*
        Znaczenie liczb czytamy przez [readQuota], a nie porównaniem na
        miejscu. To JEST ta zapora - wszystko, co zapisuje bajty, przechodzi
        tędy - a stała tu własna, druga kopia reguły. Kiedy zero przestało
        znaczyć „bez ograniczeń", tamta kopia została przy starym: konto
        z zerem miało pomijane sprawdzenie i zapisywało bez końca, a konto
        bez ograniczeń (-1) odbijało się od ujemnego zapasu przy pierwszym
        zapisie. Dokładnie odwrotnie, niż mówi ekran.
      */
      if (!fitsIn(readQuota(quota, user.usedBytes), addedBytes)) {
        throw Object.assign(new Error("out-of-space"), {
          quotaReason: outOfSpaceReason(words, humanSize(user.usedBytes), humanSize(quota)),
        });
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
  // Zero bajtów to „0 B" - i przy limicie znaczy to dokładnie tyle, ile
  // pisze. Miejsce bez ograniczeń zapisuje się liczbą ujemną i wołający
  // odsiewa je wcześniej (storage.unlimited), więc tutaj nie ma prawa dojść.
  if (value <= 0) return "0 B";
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
