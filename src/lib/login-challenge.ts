import { randomBytes } from "node:crypto";
import type { LoginChallenge, User } from "@prisma/client";
import { hashToken, issueToken } from "./app-token";
import { prisma } from "./prisma";
import { quotaState } from "./quota";
import { settings } from "./settings";
import { apiWords } from "./language";
import { accountBlockedWith } from "./i18n";

export const CHALLENGE_TTL_SECONDS = 10 * 60;
export const POLL_INTERVAL_SECONDS = 2;
const CODE_BYTES = 24;

export type ChallengeCreateResult = {
  code: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type ChallengePollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | {
      status: "ready";
      token: string;
      tokenId: string;
      account: {
        id: string;
        login: string;
        email: string;
        name: string | null;
        admin: boolean;
      };
      storage: {
        quota: string;
        used: string;
        unlimited: boolean;
      };
    };

export async function createLoginChallenge(device: string): Promise<ChallengeCreateResult> {
  // Every attempt to sign in from the app leaves a row behind. Sweep the ones
  // that expired over a day ago here, so the table does not grow forever and
  // no separate cron job is needed.
  await prisma.loginChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const code = randomBytes(CODE_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

  await prisma.loginChallenge.create({
    data: {
      codeHash: hashToken(code),
      device: device.slice(0, 120) || (await apiWords()).deviceFallback,
      expiresAt,
    },
  });

  const base = settings.baseUrl.replace(/\/$/, "");
  return {
    code,
    verificationUri: `${base}/signin/device?code=${encodeURIComponent(code)}`,
    expiresIn: CHALLENGE_TTL_SECONDS,
    interval: POLL_INTERVAL_SECONDS,
  };
}

export async function findChallengeByCode(code: string): Promise<LoginChallenge | null> {
  if (!code.trim()) return null;
  return prisma.loginChallenge.findUnique({
    where: { codeHash: hashToken(code.trim()) },
  });
}

function isExpired(challenge: LoginChallenge): boolean {
  return challenge.expiresAt.getTime() <= Date.now();
}

export async function approveLoginChallenge(
  code: string,
  user: User,
): Promise<{ ok: true; device: string } | { ok: false; reason: string }> {
  if (user.blocked) {
    return {
      ok: false,
      reason: user.blockReason
        ? accountBlockedWith(await apiWords(), user.blockReason)
        : (await apiWords()).apiAccountBlocked,
    };
  }

  const challenge = await findChallengeByCode(code);
  if (!challenge) return { ok: false, reason: (await apiWords()).apiChallengeGone };
  if (isExpired(challenge) || challenge.status === "REDEEMED") {
    return { ok: false, reason: (await apiWords()).apiChallengeExpiredAskApp };
  }
  if (challenge.status === "DENIED") {
    return { ok: false, reason: (await apiWords()).apiChallengeDenied };
  }
  if (challenge.status === "APPROVED") {
    if (challenge.userId === user.id) {
      return { ok: true, device: challenge.device };
    }
    return { ok: false, reason: (await apiWords()).apiChallengeOtherAccount };
  }

  await prisma.loginChallenge.update({
    where: { id: challenge.id },
    data: {
      status: "APPROVED",
      userId: user.id,
      approvedAt: new Date(),
    },
  });

  return { ok: true, device: challenge.device };
}

export async function denyLoginChallenge(
  code: string,
  user: User,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const challenge = await findChallengeByCode(code);
  if (!challenge) return { ok: false, reason: (await apiWords()).apiChallengeGone };
  if (isExpired(challenge) || challenge.status === "REDEEMED") {
    return { ok: false, reason: (await apiWords()).apiChallengeExpired };
  }
  if (challenge.status === "APPROVED" && challenge.userId && challenge.userId !== user.id) {
    return { ok: false, reason: (await apiWords()).apiChallengeWrongAccount };
  }

  await prisma.loginChallenge.update({
    where: { id: challenge.id },
    data: { status: "DENIED", userId: user.id },
  });

  return { ok: true };
}

export async function pollLoginChallenge(code: string): Promise<ChallengePollResult> {
  const challenge = await findChallengeByCode(code);
  if (!challenge) return { status: "expired" };
  if (challenge.status === "DENIED") return { status: "denied" };
  if (challenge.status === "REDEEMED" || isExpired(challenge)) return { status: "expired" };
  if (challenge.status !== "APPROVED" || !challenge.userId) return { status: "pending" };

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user) return { status: "expired" };
  if (user.blocked) return { status: "denied" };

  // Redeem once: issue AppToken and mark the challenge so a second poll
  // cannot receive another token for the same approval.
  const updated = await prisma.loginChallenge.updateMany({
    where: { id: challenge.id, status: "APPROVED" },
    data: { status: "REDEEMED" },
  });
  if (updated.count === 0) return { status: "expired" };

  const { token, id } = await issueToken(user.id, challenge.device);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date() },
  });
  const storage = await quotaState(user.id);

  return {
    status: "ready",
    token,
    tokenId: id,
    account: {
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      admin: user.role === "ADMIN",
    },
    storage: {
      quota: storage.quota.toString(),
      used: storage.used.toString(),
      unlimited: storage.unlimited,
    },
  };
}
