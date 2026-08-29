import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(async () => ({})),
    },
    attachment: {
      findMany: vi.fn(async () => []),
    },
    verificationToken: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (operations: unknown[]) => operations),
  },
}));

vi.mock("./files", () => ({
  deleteAttachment: vi.fn(async () => true),
  deleteNoteDirectory: vi.fn(async () => undefined),
  deleteUserDirectory: vi.fn(async () => undefined),
  noteStoragePrefix: (ownerId: string, noteId: string) => `${ownerId}/${noteId}/`,
  userStoragePrefix: (ownerId: string) => `${ownerId}/`,
}));

import { prisma } from "./prisma";
import {
  deleteAttachment,
  deleteNoteDirectory,
  deleteUserDirectory,
} from "./files";
import { removeAccount } from "./account-delete";

const user = {
  id: "user-1",
  login: "ala",
  email: "ala@example.test",
  _count: { notes: 2 },
  notes: [
    {
      id: "note-1",
      attachments: [
        { path: "user-1/note-1/shared.png" },
        { path: "user-1/note-1/own.log" },
      ],
    },
    {
      id: "note-2",
      attachments: [{ path: "user-1/note-2/own.json" }],
    },
  ],
};

describe("removeAccount disk cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([] as never);
  });

  it("removes the complete owner directory when nobody else references it", async () => {
    await expect(removeAccount(user.id)).resolves.toMatchObject({
      login: "ala",
      noteCount: 2,
    });

    expect(deleteUserDirectory).toHaveBeenCalledWith(user.id);
    expect(deleteNoteDirectory).not.toHaveBeenCalled();
    expect(deleteAttachment).not.toHaveBeenCalled();
  });

  it("preserves a cross-account shared path and cleans everything else", async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      { path: "user-1/note-1/shared.png" },
    ] as never);

    await removeAccount(user.id);

    expect(deleteUserDirectory).not.toHaveBeenCalled();
    expect(deleteNoteDirectory).toHaveBeenCalledWith(user.id, "note-2");
    expect(deleteAttachment).toHaveBeenCalledTimes(1);
    expect(deleteAttachment).toHaveBeenCalledWith(
      user.id,
      "note-1",
      "user-1/note-1/own.log",
    );
  });

  it("is idempotent when the account has already gone", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(removeAccount(user.id)).resolves.toBeNull();
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    expect(deleteUserDirectory).not.toHaveBeenCalled();
  });
});
