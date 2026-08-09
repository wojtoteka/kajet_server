import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginChallenge: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/app-token", () => ({
  hashToken: (token: string) => `hash:${token}`,
  issueToken: vi.fn(async () => ({ token: "plaintext-token", id: "tok-1" })),
}));

vi.mock("@/lib/quota", () => ({
  quotaState: vi.fn(async () => ({
    quota: 100n,
    used: 10n,
    free: 90n,
    unlimited: false,
    quotaUntil: null,
  })),
}));

vi.mock("@/lib/settings", () => ({
  settings: { baseUrl: "https://kajet.example" },
}));

import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/app-token";
import {
  approveLoginChallenge,
  createLoginChallenge,
  pollLoginChallenge,
} from "./login-challenge";

const user = {
  id: "user-1",
  login: "ania",
  email: "ania@example.com",
  name: "Ania",
  role: "USER",
  blocked: false,
  blockReason: null,
} as const;

describe("login-challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a challenge with verification URL", async () => {
    vi.mocked(prisma.loginChallenge.create).mockResolvedValue({} as never);

    const created = await createLoginChallenge("Pixel 8");

    expect(created.verificationUri).toContain("https://kajet.example/signin/device?code=");
    expect(created.code.length).toBeGreaterThan(20);
    expect(created.expiresIn).toBe(600);
    expect(created.interval).toBe(2);
    expect(prisma.loginChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          device: "Pixel 8",
          codeHash: expect.stringMatching(/^hash:/),
        }),
      }),
    );
  });

  it("approves a pending challenge for the signed-in user", async () => {
    vi.mocked(prisma.loginChallenge.findUnique).mockResolvedValue({
      id: "ch-1",
      codeHash: "hash:abc",
      device: "Pixel 8",
      status: "PENDING",
      userId: null,
      approvedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.loginChallenge.update).mockResolvedValue({} as never);

    const result = await approveLoginChallenge("abc", user as never);

    expect(result).toEqual({ ok: true, device: "Pixel 8" });
    expect(prisma.loginChallenge.update).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      data: expect.objectContaining({ status: "APPROVED", userId: "user-1" }),
    });
  });

  it("redeems an approved challenge once via poll", async () => {
    vi.mocked(prisma.loginChallenge.findUnique).mockResolvedValue({
      id: "ch-1",
      codeHash: "hash:abc",
      device: "Pixel 8",
      status: "APPROVED",
      userId: "user-1",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(prisma.loginChallenge.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.update).mockResolvedValue(user as never);

    const result = await pollLoginChallenge("abc");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.token).toBe("plaintext-token");
      expect(result.tokenId).toBe("tok-1");
      expect(result.account.login).toBe("ania");
    }
    expect(issueToken).toHaveBeenCalledWith("user-1", "Pixel 8");
  });

  it("returns pending while waiting for approval", async () => {
    vi.mocked(prisma.loginChallenge.findUnique).mockResolvedValue({
      id: "ch-1",
      codeHash: "hash:abc",
      device: "Pixel 8",
      status: "PENDING",
      userId: null,
      approvedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    } as never);

    await expect(pollLoginChallenge("abc")).resolves.toEqual({ status: "pending" });
    expect(issueToken).not.toHaveBeenCalled();
  });
});
