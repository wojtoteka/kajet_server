import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { apiWords } from "./language";

const TOKEN_LENGTH = 48;

/**
 * Jak rzadko odnotowujemy, że token był w użyciu.
 *
 * `lastUsedAt` służy do dwóch rzeczy: daty „ostatnio używane" na ekranie konta
 * i liczenia nieaktywności konta (inactive.ts, skala dni). Do żadnej z nich nie
 * jest potrzebna dokładność co do sekundy, a zapis przy KAŻDYM żądaniu z
 * tabletu to setki zapisów w ten sam wiersz przy jednej synchronizacji.
 */
const TOUCH_EVERY_MS = 5 * 60_000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(
  userId: string,
  device: string,
): Promise<{ token: string; id: string }> {
  const token = randomBytes(TOKEN_LENGTH).toString("base64url");

  const entry = await prisma.appToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      device: device.slice(0, 120) || (await apiWords()).unknownDeviceWord,
    },
    select: { id: true },
  });

  return { token, id: entry.id };
}

export type TokenResult =
  | { ok: true; user: User }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "blocked" };

export async function userFromHeaders(headers: Headers): Promise<TokenResult> {
  const header = headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, reason: "missing" };

  const entry = await prisma.appToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!entry) return { ok: false, reason: "invalid" };
  if (entry.expiresAt && entry.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (entry.user.blocked) return { ok: false, reason: "blocked" };

  touchToken(entry.id, entry.lastUsedAt);

  return { ok: true, user: entry.user };
}

/**
 * Odnotowanie, że token był w użyciu. Bez czekania i z rzadka.
 *
 * Wcześniej stało tu `update({ where: { id } })` przy każdym żądaniu i sypało
 * na produkcji błędem MySQL 1020 „Record has changed since last read in table
 * 'app_tokens'". Dwie przyczyny naraz:
 *
 *  1. Prisma dla `update` z warunkiem na kluczu robi ODCZYT, a potem zapis.
 *     Tablet synchronizuje się kilkoma żądaniami naraz, więc wiersz zmieniał
 *     się między jednym a drugim - i o tym właśnie mówi tamten błąd.
 *     `updateMany` idzie jednym poleceniem UPDATE, bez odczytu przed nim.
 *  2. Zapis szedł przy każdym żądaniu, choć wystarcza raz na kilka minut.
 *
 * Warunek na STARĄ wartość robi z tego porównaj-i-zamień: kto przegra wyścig,
 * trafia w zero wierszy i nic nie robi. `updateMany` przy zerze dopasowań nie
 * rzuca wyjątkiem - w odróżnieniu od `update`, który wywraca się na P2025,
 * gdy token zdążył zniknąć (wylogowanie ze wszystkich urządzeń w trakcie
 * synchronizacji to nie jest rzecz nieprawdopodobna).
 */
function touchToken(id: string, lastUsedAt: Date | null): void {
  const now = Date.now();
  if (lastUsedAt && now - lastUsedAt.getTime() < TOUCH_EVERY_MS) return;

  void prisma.appToken
    .updateMany({ where: { id, lastUsedAt }, data: { lastUsedAt: new Date(now) } })
    .catch(() => undefined);
}

export async function revokeToken(userId: string, tokenId: string): Promise<void> {
  await prisma.appToken.deleteMany({ where: { id: tokenId, userId } });
}
