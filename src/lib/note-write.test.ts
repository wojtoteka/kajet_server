import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  planNoteUpsert,
  outgoingNoteSchema,
  upsertNoteForUser,
  type OutgoingNote,
} from "./note-write";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/quota", () => ({
  reserveBytes: vi.fn(async () => ({ ok: true as const })),
  changeUsed: vi.fn(async () => undefined),
}));

vi.mock("@/lib/files", () => ({
  contentHash: (data: string | Buffer) =>
    `hash:${typeof data === "string" ? data : data.toString("utf8")}`,
}));

import { prisma } from "@/lib/prisma";
import { reserveBytes } from "@/lib/quota";

const owner = "user-1";

function note(partial: Partial<OutgoingNote> & Pick<OutgoingNote, "content" | "baseVersion">): OutgoingNote {
  return {
    id: "note-1",
    title: "Tytuł",
    kind: "TEXT",
    ...partial,
  };
}

describe("outgoingNoteSchema", () => {
  it("rejects CODE (tablet sync kinds only)", () => {
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "x",
      kind: "CODE",
      content: "{}",
      baseVersion: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts TEXT", () => {
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "x",
      kind: "TEXT",
      content: "{}",
      baseVersion: 1,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("planNoteUpsert", () => {
  it("creates a write plan for a new note", () => {
    const plan = planNoteUpsert(null, note({ content: "abc", baseVersion: 0 }), "hash:abc", owner);
    expect(plan).toEqual({ action: "write", addedBytes: Buffer.byteLength("abc", "utf8") });
  });

  it("returns unchanged when hash matches", () => {
    const plan = planNoteUpsert(
      { id: "note-1", ownerId: owner, version: 3, sizeBytes: 10, hash: "hash:abc" },
      note({ content: "abc", baseVersion: 3 }),
      "hash:abc",
      owner,
    );
    expect(plan).toEqual({ action: "unchanged", version: 3 });
  });

  it("returns conflict when baseVersion mismatches server version", () => {
    const plan = planNoteUpsert(
      { id: "note-1", ownerId: owner, version: 5, sizeBytes: 10, hash: "hash:old" },
      note({ content: "new", baseVersion: 4 }),
      "hash:new",
      owner,
    );
    expect(plan).toEqual({ action: "conflict" });
  });

  it("allows first sync overwrite when baseVersion is 0", () => {
    const plan = planNoteUpsert(
      { id: "note-1", ownerId: owner, version: 5, sizeBytes: 10, hash: "hash:old" },
      note({ content: "new", baseVersion: 0 }),
      "hash:new",
      owner,
    );
    expect(plan.action).toBe("write");
  });

  it("forbids writing someone else's note", () => {
    const plan = planNoteUpsert(
      { id: "note-1", ownerId: "other", version: 1, sizeBytes: 1, hash: "h" },
      note({ content: "x", baseVersion: 1 }),
      "hash:x",
      owner,
    );
    expect(plan).toEqual({ action: "forbidden" });
  });
});

describe("upsertNoteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reserveBytes).mockResolvedValue({ ok: true });
  });

  it("returns conflict shape with trimmed onServer and HTTP-mappable fields", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue({
      id: "note-1",
      ownerId: owner,
      version: 2,
      sizeBytes: 4,
      hash: "hash:old",
    } as never);
    const updatedAt = new Date("2026-08-03T12:00:00.000Z");
    vi.mocked(prisma.note.findUniqueOrThrow).mockResolvedValue({
      id: "note-1",
      title: "Na serwerze",
      kind: "TEXT",
      favorite: false,
      tags: "a|b",
      content: '{"format":1}',
      version: 2,
      updatedAt,
    } as never);

    const result = await upsertNoteForUser(
      owner,
      note({ content: "local-change", baseVersion: 1 }),
    );

    expect(result).toEqual({
      status: "conflict",
      message: expect.stringContaining("zmieniła się"),
      onServer: {
        id: "note-1",
        title: "Na serwerze",
        kind: "TEXT",
        favorite: false,
        tags: "a|b",
        content: '{"format":1}',
        version: 2,
        updatedAt: updatedAt.getTime(),
      },
    });
    expect(prisma.note.upsert).not.toHaveBeenCalled();
  });

  it("increments version on save", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue({
      id: "note-1",
      ownerId: owner,
      version: 2,
      sizeBytes: 3,
      hash: "hash:old",
    } as never);
    const updatedAt = new Date("2026-08-03T13:00:00.000Z");
    vi.mocked(prisma.note.upsert).mockResolvedValue({
      version: 3,
      updatedAt,
    } as never);

    const result = await upsertNoteForUser(
      owner,
      note({ content: "fresh", baseVersion: 2 }),
    );

    expect(result).toEqual({
      status: "saved",
      version: 3,
      updatedAt: updatedAt.getTime(),
    });
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          version: { increment: 1 },
          content: "fresh",
        }),
      }),
    );
  });

  it("creates with version 1", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null);
    const updatedAt = new Date("2026-08-03T14:00:00.000Z");
    vi.mocked(prisma.note.upsert).mockResolvedValue({
      version: 1,
      updatedAt,
    } as never);

    const result = await upsertNoteForUser(
      owner,
      note({ content: "brand-new", baseVersion: 0 }),
    );

    expect(result).toEqual({
      status: "created",
      version: 1,
      updatedAt: updatedAt.getTime(),
    });
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ version: 1 }),
      }),
    );
  });
});
