import { describe, expect, it, vi, beforeEach } from "vitest";
import { purgeExpiredTrash, trashDaysLeft } from "./trash";

vi.mock("@/lib/prisma", () => ({
  prisma: { note: { findMany: vi.fn() } },
}));

vi.mock("@/lib/settings", () => ({ settings: { trash: { days: 30 } } }));

vi.mock("@/lib/note-write", () => ({ purgeNoteForUser: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { purgeNoteForUser } from "@/lib/note-write";

const findMany = vi.mocked(prisma.note.findMany);
const purge = vi.mocked(purgeNoteForUser);

beforeEach(() => {
  vi.clearAllMocks();
  purge.mockResolvedValue({ status: "ok", version: 0 });
});

describe("purgeExpiredTrash", () => {
  it("kasuje notatki leżące w koszu dłużej niż zadany czas", async () => {
    findMany.mockResolvedValue([
      { id: "n1", ownerId: "u1" },
      { id: "n2", ownerId: "u2" },
    ] as never);

    const result = await purgeExpiredTrash(30);

    expect(result).toEqual({ found: 2, purged: 2, failed: 0 });
    expect(purge).toHaveBeenCalledWith("u1", "n1");
    expect(purge).toHaveBeenCalledWith("u2", "n2");
  });

  it("pyta o notatki wyrzucone przed granicą, a nie o wszystkie", async () => {
    findMany.mockResolvedValue([] as never);

    await purgeExpiredTrash(30);

    const where = findMany.mock.calls[0][0]?.where as { deletedAt: { lt: Date } };
    const days = (Date.now() - where.deletedAt.lt.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("zero dni wyłącza sprzątanie - baza nie jest nawet pytana", async () => {
    const result = await purgeExpiredTrash(0);

    expect(result).toEqual({ found: 0, purged: 0, failed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("jedna notatka nie do skasowania nie przerywa reszty", async () => {
    findMany.mockResolvedValue([
      { id: "n1", ownerId: "u1" },
      { id: "n2", ownerId: "u1" },
      { id: "n3", ownerId: "u1" },
    ] as never);
    purge.mockRejectedValueOnce(new Error("EACCES"));
    purge.mockResolvedValueOnce({ status: "error", message: "nie ma takiej" });

    const result = await purgeExpiredTrash(30);

    expect(result).toEqual({ found: 3, purged: 1, failed: 2 });
    expect(purge).toHaveBeenCalledTimes(3);
  });
});

describe("trashDaysLeft", () => {
  const DAY = 86_400_000;
  const now = new Date("2026-08-07T12:00:00Z");

  it("liczy pełne dni do końca terminu", () => {
    const deletedAt = new Date(now.getTime() - 5 * DAY);
    expect(trashDaysLeft(deletedAt, 30, now)).toBe(25);
  });

  it("kawałek dnia liczy się jeszcze jako dzień", () => {
    // Wyrzucona 29 dni i pół godziny temu: zostało pół doby, czyli „1 dzień".
    const deletedAt = new Date(now.getTime() - 29 * DAY - 12 * 3_600_000);
    expect(trashDaysLeft(deletedAt, 30, now)).toBe(1);
  });

  it("po terminie oddaje zero, nie liczby ujemne", () => {
    const deletedAt = new Date(now.getTime() - 40 * DAY);
    expect(trashDaysLeft(deletedAt, 30, now)).toBe(0);
  });

  it("świeżo wyrzucona ma przed sobą cały termin", () => {
    expect(trashDaysLeft(now, 30, now)).toBe(30);
  });
});
