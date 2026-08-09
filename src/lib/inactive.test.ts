import { describe, expect, it, vi, beforeEach } from "vitest";
import { sweepInactiveAccounts } from "./inactive";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), update: vi.fn() },
    appToken: { findFirst: vi.fn() },
    note: { findFirst: vi.fn() },
    auditEntry: { create: vi.fn() },
  },
}));

vi.mock("@/lib/settings", () => ({
  settings: {
    baseUrl: "https://kajet.wojtoteka.ovh",
    inactive: { days: 365, graceDays: 30 },
  },
}));

vi.mock("@/lib/account-delete", () => ({ removeAccount: vi.fn() }));

vi.mock("@/lib/mail", () => ({
  send: vi.fn(),
  inactiveAccountMail: (to: string) => ({ to }),
}));

import { prisma } from "@/lib/prisma";
import { removeAccount } from "@/lib/account-delete";
import { send } from "@/lib/mail";

const findMany = vi.mocked(prisma.user.findMany);
const update = vi.mocked(prisma.user.update);
const tokenFirst = vi.mocked(prisma.appToken.findFirst);
const noteFirst = vi.mocked(prisma.note.findFirst);
const remove = vi.mocked(removeAccount);
const sendMail = vi.mocked(send);

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/** Konto widziane przez wstępne sito. */
function account(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "u1",
    email: "ktos@example.com",
    login: "ktos",
    createdAt: ago(800),
    lastSignInAt: ago(500),
    inactiveWarnedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tokenFirst.mockResolvedValue(null as never);
  noteFirst.mockResolvedValue(null as never);
  sendMail.mockResolvedValue(true);
  remove.mockResolvedValue({ login: "ktos", email: "ktos@example.com", noteCount: 3 });
});

describe("sweepInactiveAccounts", () => {
  it("zero dni wyłącza sprzątanie - baza nie jest nawet pytana", async () => {
    const result = await sweepInactiveAccounts(0);

    expect(result).toEqual({ warned: 0, deleted: 0, revived: 0, failed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("nieużywane konto dostaje ostrzeżenie i znacznik, ale nie znika", async () => {
    findMany.mockResolvedValue([account()] as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.warned).toBe(1);
    expect(result.deleted).toBe(0);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { inactiveWarnedAt: expect.any(Date) } }),
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("synchronizacja z tabletu liczy się jak logowanie - konto zostaje", async () => {
    findMany.mockResolvedValue([account()] as never);
    tokenFirst.mockResolvedValue({ lastUsedAt: ago(2), createdAt: ago(700) } as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result).toEqual({ warned: 0, deleted: 0, revived: 0, failed: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("świeżo zapisana notatka też jest śladem życia", async () => {
    findMany.mockResolvedValue([account()] as never);
    noteFirst.mockResolvedValue({ updatedAt: ago(10) } as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.warned).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("po karencji konto znika i zostaje wpis w dzienniku", async () => {
    findMany.mockResolvedValue([account({ inactiveWarnedAt: ago(31) })] as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.deleted).toBe(1);
    expect(remove).toHaveBeenCalledWith("u1");
    expect(prisma.auditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "account.inactive.deleted", actorId: null }),
      }),
    );
  });

  it("w trakcie karencji konto jeszcze czeka", async () => {
    findMany.mockResolvedValue([account({ inactiveWarnedAt: ago(10) })] as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result).toEqual({ warned: 0, deleted: 0, revived: 0, failed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("powrót po ostrzeżeniu zdejmuje znacznik i konto zostaje", async () => {
    findMany.mockResolvedValue([account({ inactiveWarnedAt: ago(40) })] as never);
    noteFirst.mockResolvedValue({ updatedAt: ago(1) } as never);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.revived).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { inactiveWarnedAt: null } }),
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("gdy poczta nie poszła, zegar karencji nie rusza", async () => {
    findMany.mockResolvedValue([account()] as never);
    sendMail.mockResolvedValue(false);

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.failed).toBe(1);
    expect(result.warned).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("jedno konto, które się nie udało, nie przerywa reszty", async () => {
    findMany.mockResolvedValue([
      account({ id: "u1", inactiveWarnedAt: ago(31) }),
      account({ id: "u2", inactiveWarnedAt: ago(31) }),
    ] as never);
    remove.mockRejectedValueOnce(new Error("EACCES"));

    const result = await sweepInactiveAccounts(365, 30);

    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(1);
  });
});
