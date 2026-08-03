import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

const TOKEN_LENGTH = 48;

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
      device: device.slice(0, 120) || "Nieznane urządzenie",
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

  void prisma.appToken
    .update({ where: { id: entry.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { ok: true, user: entry.user };
}

export async function revokeToken(userId: string, tokenId: string): Promise<void> {
  await prisma.appToken.deleteMany({ where: { id: tokenId, userId } });
}
