import { describe, expect, it, vi, beforeEach } from "vitest";
import { packStoredNotes } from "./note-packer";
import { isPacked, unpackNoteContent } from "./note-content";

vi.mock("@/lib/prisma", () => ({
  prisma: { note: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/quota", () => ({
  changeUsed: vi.fn(async () => undefined),
  humanSize: (bytes: number) => `${bytes} B`,
}));

import { prisma } from "@/lib/prisma";
import { changeUsed } from "@/lib/quota";

const findMany = vi.mocked(prisma.note.findMany);
const findUnique = vi.mocked(prisma.note.findUnique);
const updateMany = vi.mocked(prisma.note.updateMany);

const BIG = JSON.stringify({
  kind: "handwritten",
  points: Array.from({ length: 3000 }, (_, i) => (i * 0.47).toFixed(2)),
});
const SMALL = '{"kind":"text","text":{"markdown":"Hej"}}';
const updatedAt = new Date("2026-10-01T10:00:00.000Z");

function row(id: string, content: string) {
  return { id, ownerId: "u1", version: 7, sizeBytes: Buffer.byteLength(content), updatedAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("packStoredNotes", () => {
  it("packs an old note in place and gives the space back to its owner", async () => {
    findMany.mockResolvedValueOnce([row("n1", BIG)] as never).mockResolvedValueOnce([] as never);
    findUnique.mockResolvedValue({ content: BIG } as never);

    const result = await packStoredNotes({ pauseMs: 0 });

    const call = updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: { content: string; sizeBytes: number; updatedAt: Date };
    };
    expect(isPacked(call.data.content)).toBe(true);
    expect(unpackNoteContent(call.data.content)).toBe(BIG);
    // Tylko wiersz taki, jak go przeczytaliśmy - i bez nowej wersji ani daty
    // zmiany, bo dla urządzeń treść jest ta sama.
    expect(call.where).toEqual({ id: "n1", version: 7, sizeBytes: Buffer.byteLength(BIG), updatedAt });
    expect(call.data.updatedAt).toBe(updatedAt);
    expect(call.data).not.toHaveProperty("version");

    const saved = Buffer.byteLength(BIG) - call.data.sizeBytes;
    expect(saved).toBeGreaterThan(0);
    expect(changeUsed).toHaveBeenCalledWith("u1", -saved);
    expect(result).toEqual({ packed: 1, savedBytes: saved });
  });

  it("leaves a note alone when packing would not make it smaller", async () => {
    findMany.mockResolvedValueOnce([row("n1", SMALL)] as never).mockResolvedValueOnce([] as never);
    findUnique.mockResolvedValue({ content: SMALL } as never);

    expect(await packStoredNotes({ pauseMs: 0 })).toEqual({ packed: 0, savedBytes: 0 });
    expect(updateMany).not.toHaveBeenCalled();
    expect(changeUsed).not.toHaveBeenCalled();
  });

  it("does not count a note someone saved in the meantime", async () => {
    findMany.mockResolvedValueOnce([row("n1", BIG)] as never).mockResolvedValueOnce([] as never);
    findUnique.mockResolvedValue({ content: BIG } as never);
    updateMany.mockResolvedValue({ count: 0 } as never);

    expect(await packStoredNotes({ pauseMs: 0 })).toEqual({ packed: 0, savedBytes: 0 });
    expect(changeUsed).not.toHaveBeenCalled();
  });

  it("walks on past notes it could not pack instead of asking for them again", async () => {
    findMany
      .mockResolvedValueOnce([row("a", SMALL), row("b", BIG)] as never)
      .mockResolvedValueOnce([] as never);
    findUnique
      .mockResolvedValueOnce({ content: SMALL } as never)
      .mockResolvedValueOnce({ content: BIG } as never);

    await packStoredNotes({ pauseMs: 0 });

    expect(findMany).toHaveBeenCalledTimes(2);
    const second = findMany.mock.calls[1][0] as { where: { id: { gt: string } } };
    expect(second.where.id).toEqual({ gt: "b" });
  });

  it("skips notes changed within the last hour", async () => {
    findMany.mockResolvedValueOnce([] as never);
    const now = new Date("2026-10-29T12:00:00.000Z");

    await packStoredNotes({ now, pauseMs: 0 });

    const query = findMany.mock.calls[0][0] as { where: { updatedAt: { lt: Date } } };
    expect(query.where.updatedAt.lt).toEqual(new Date("2026-10-29T11:00:00.000Z"));
  });
});
