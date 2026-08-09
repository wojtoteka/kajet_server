import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  planNoteUpsert,
  outgoingNoteSchema,
  upsertNoteForUser,
  setNoteDeletedForUser,
  type OutgoingNote,
} from "./note-write";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
  it("accepts CODE (new apps sync code files)", () => {
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "program.py",
      kind: "CODE",
      content: '{"code":{"language":"python","source":"print(1)"}}',
      baseVersion: 0,
    });
    expect(parsed.success).toBe(true);
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

  it("accepts a tombstone without content", () => {
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "",
      kind: "TEXT",
      baseVersion: 4,
      deleted: true,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("planNoteUpsert", () => {
  it("creates a write plan for a new note", () => {
    const plan = planNoteUpsert(null, note({ content: "abc", baseVersion: 0 }), "hash:abc", owner);
    expect(plan).toEqual({ action: "write", addedBytes: Buffer.byteLength("abc", "utf8") });
  });

  it("returns unchanged when hash matches and meta is the same", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 3,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "abc", baseVersion: 3 }),
      "hash:abc",
      owner,
    );
    expect(plan).toEqual({ action: "unchanged", version: 3 });
  });

  it("plans a delete when the app sends a tombstone", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 3,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "abc", baseVersion: 3, deleted: true }),
      "hash:abc",
      owner,
    );
    expect(plan.action).toBe("delete");
  });

  it("deleting wins even when versions disagree", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 9,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "", baseVersion: 2, deleted: true }),
      "hash:",
      owner,
    );
    expect(plan.action).toBe("delete");
  });

  it("a tombstone for a note already in the bin is unchanged", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 7,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: new Date(),
        favorite: false,
      },
      note({ content: "", baseVersion: 7, deleted: true }),
      "hash:",
      owner,
    );
    expect(plan).toEqual({ action: "unchanged", version: 7 });
  });

  it("a tombstone for an unknown note is unchanged with version 0", () => {
    const plan = planNoteUpsert(null, note({ content: "", baseVersion: 0, deleted: true }), "hash:", owner);
    expect(plan).toEqual({ action: "unchanged", version: 0 });
  });

  it("a restore (deleted:false with matching baseVersion) writes", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 5,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: new Date(),
        favorite: false,
      },
      note({ content: "abc", baseVersion: 5 }),
      "hash:abc",
      owner,
    );
    expect(plan.action).toBe("write");
  });

  it("writes when favorite flips without content change", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 3,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "abc", baseVersion: 3, favorite: true }),
      "hash:abc",
      owner,
    );
    expect(plan.action).toBe("write");
  });

  it("writes when only the folder changes", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 3,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
        folderId: null,
      },
      note({ content: "abc", baseVersion: 3 }),
      "hash:abc",
      owner,
      "f-123",
    );
    expect(plan.action).toBe("write");
  });

  it("stays unchanged when the folder field was not sent", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 3,
        sizeBytes: 10,
        hash: "hash:abc",
        deletedAt: null,
        favorite: false,
        folderId: "f-123",
      },
      note({ content: "abc", baseVersion: 3 }),
      "hash:abc",
      owner,
      undefined,
    );
    expect(plan.action).toBe("unchanged");
  });

  it("returns conflict when baseVersion mismatches server version", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 5,
        sizeBytes: 10,
        hash: "hash:old",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "new", baseVersion: 4 }),
      "hash:new",
      owner,
    );
    expect(plan).toEqual({ action: "conflict" });
  });

  it("allows first sync overwrite when baseVersion is 0", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: owner,
        version: 5,
        sizeBytes: 10,
        hash: "hash:old",
        deletedAt: null,
        favorite: false,
      },
      note({ content: "new", baseVersion: 0 }),
      "hash:new",
      owner,
    );
    expect(plan.action).toBe("write");
  });

  it("forbids writing someone else's note", () => {
    const plan = planNoteUpsert(
      {
        id: "note-1",
        ownerId: "other",
        version: 1,
        sizeBytes: 1,
        hash: "h",
        deletedAt: null,
        favorite: false,
      },
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
      deletedAt: null,
      favorite: false,
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
      deletedAt: null,
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
        deletedAt: null,
      },
    });
    expect(prisma.note.upsert).not.toHaveBeenCalled();
  });

  it("soft-deletes on a tombstone without touching content", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue({
      id: "note-1",
      ownerId: owner,
      version: 6,
      sizeBytes: 100,
      hash: "hash:old",
      deletedAt: null,
      favorite: false,
    } as never);
    const updatedAt = new Date("2026-08-04T09:00:00.000Z");
    vi.mocked(prisma.note.update).mockResolvedValue({
      version: 7,
      updatedAt,
    } as never);

    const result = await upsertNoteForUser(
      owner,
      note({ content: "", baseVersion: 2, deleted: true }),
    );

    expect(result).toEqual({
      status: "saved",
      version: 7,
      updatedAt: updatedAt.getTime(),
    });
    expect(prisma.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: expect.any(Date), version: { increment: 1 } },
      }),
    );
    expect(prisma.note.upsert).not.toHaveBeenCalled();
  });

  it("answers gone for a purged note the client still remembers", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null);

    const result = await upsertNoteForUser(
      owner,
      note({ content: "spóźniona edycja", baseVersion: 5 }),
    );

    expect(result).toEqual({ status: "gone", version: 0 });
    expect(prisma.note.upsert).not.toHaveBeenCalled();
  });

  it("still creates a brand-new note with baseVersion 0", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null);
    const updatedAt = new Date("2026-08-04T10:00:00.000Z");
    vi.mocked(prisma.note.upsert).mockResolvedValue({
      version: 1,
      updatedAt,
    } as never);

    const result = await upsertNoteForUser(owner, note({ content: "nowa", baseVersion: 0 }));

    expect(result).toEqual({
      status: "created",
      version: 1,
      updatedAt: updatedAt.getTime(),
    });
  });

  it("rejects a regular save without content", async () => {
    const result = await upsertNoteForUser(owner, {
      id: "note-1",
      title: "x",
      kind: "TEXT",
      baseVersion: 1,
    });
    expect(result).toEqual(
      expect.objectContaining({ status: "error", httpStatus: 400 }),
    );
  });

  it("increments version on save", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue({
      id: "note-1",
      ownerId: owner,
      version: 2,
      sizeBytes: 3,
      hash: "hash:old",
      deletedAt: null,
      favorite: false,
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

describe("setNoteDeletedForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-deletes and bumps version", async () => {
    vi.mocked(prisma.note.findUnique).mockResolvedValue({
      id: "note-1",
      ownerId: owner,
      deletedAt: null,
      version: 2,
    } as never);
    vi.mocked(prisma.note.update).mockResolvedValue({ version: 3 } as never);

    const result = await setNoteDeletedForUser(owner, "note-1", true);
    expect(result).toEqual({ status: "ok", version: 3 });
    expect(prisma.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          version: { increment: 1 },
        }),
      }),
    );
  });
});
