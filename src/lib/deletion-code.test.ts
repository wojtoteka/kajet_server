import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MAX_ATTEMPTS,
  clearDeletionTries,
  deletionTryAllowed,
  forgetAllDeletionTries,
  formatCode,
  issueDeletionCode,
  noteFailedDeletionTry,
  normalizeCode,
  useDeletionCode,
} from "./deletion-code";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const deleteMany = vi.mocked(prisma.verificationToken.deleteMany);
const create = vi.mocked(prisma.verificationToken.create);
const findFirst = vi.mocked(prisma.verificationToken.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
  forgetAllDeletionTries();
  deleteMany.mockResolvedValue({ count: 0 } as never);
  create.mockResolvedValue({} as never);
});

describe("przepisywanie kodu", () => {
  it("kod pokazuje się z myślnikiem pośrodku", () => {
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("myślnik, spacje i małe litery nie przeszkadzają", () => {
    expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeCode(" ab cd ef gh ")).toBe("ABCDEFGH");
    expect(normalizeCode("ABCD_EFGH")).toBe("ABCDEFGH");
  });
});

describe("issueDeletionCode", () => {
  it("kasuje poprzedni kod i zapisuje nowy z terminem ważności", async () => {
    const code = await issueDeletionCode("Ktos@Example.com");

    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    // Znaki, które łatwo pomylić przy przepisywaniu, nie mają prawa wystąpić.
    expect(code).not.toMatch(/[OIJ01]/);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { identifier: "delete:ktos@example.com" },
    });

    const saved = create.mock.calls[0][0].data as {
      identifier: string;
      token: string;
      expires: Date;
    };
    expect(saved.identifier).toBe("delete:ktos@example.com");
    expect(saved.token).toBe(code);
    const minutes = (saved.expires.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThan(61);
  });

  it("dwa wystawienia dają różne kody", async () => {
    const first = await issueDeletionCode("ktos@example.com");
    const second = await issueDeletionCode("ktos@example.com");
    expect(first).not.toBe(second);
  });
});

describe("useDeletionCode", () => {
  it("dobry kod przechodzi i od razu znika z bazy", async () => {
    findFirst.mockResolvedValue({
      identifier: "delete:ktos@example.com",
      token: "ABCDEFGH",
      expires: new Date(Date.now() + 60_000),
    } as never);

    const result = await useDeletionCode("ktos@example.com", "abcd-efgh");

    expect(result).toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { identifier: "delete:ktos@example.com", token: "ABCDEFGH" },
    });
  });

  it("kodu, którego nie ma, nie da się użyć", async () => {
    findFirst.mockResolvedValue(null as never);

    expect(await useDeletionCode("ktos@example.com", "ZZZZZZZZ")).toEqual({
      ok: false,
      reason: "wrong",
    });
  });

  it("pusty kod nie pyta nawet bazy", async () => {
    expect(await useDeletionCode("ktos@example.com", "   ")).toEqual({
      ok: false,
      reason: "wrong",
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("przeterminowany kod nie przechodzi i znika z bazy", async () => {
    findFirst.mockResolvedValue({
      identifier: "delete:ktos@example.com",
      token: "ABCDEFGH",
      expires: new Date(Date.now() - 1000),
    } as never);

    expect(await useDeletionCode("ktos@example.com", "ABCDEFGH")).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(deleteMany).toHaveBeenCalled();
  });
});

describe("zapora przed zgadywaniem kodu", () => {
  it("pierwsze próby przechodzą, po pięciu nietrafionych zamyka", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect(deletionTryAllowed("u1").allowed).toBe(true);
      noteFailedDeletionTry("u1");
    }

    const gate = deletionTryAllowed("u1");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.retryInSeconds).toBeGreaterThan(0);
      expect(gate.retryInSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("licznik jest osobny dla każdego konta", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) noteFailedDeletionTry("u1");

    expect(deletionTryAllowed("u1").allowed).toBe(false);
    expect(deletionTryAllowed("u2").allowed).toBe(true);
  });

  it("trafiony kod zeruje licznik", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) noteFailedDeletionTry("u1");
    expect(deletionTryAllowed("u1").allowed).toBe(false);

    clearDeletionTries("u1");
    expect(deletionTryAllowed("u1").allowed).toBe(true);
  });
});
