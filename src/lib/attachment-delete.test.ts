import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    attachment: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("./files", () => ({
  deleteAttachment: vi.fn(async () => true),
}));

import { prisma } from "./prisma";
import { deleteAttachment } from "./files";
import {
  deleteAttachmentFileIfUnused,
  removeAttachmentRecord,
} from "./attachment-delete";

const record = {
  id: "attachment-1",
  noteId: "note-1",
  path: "user-1/note-1/hash.log",
};

const count = vi.mocked(prisma.attachment.count);
const deleteMany = vi.mocked(prisma.attachment.deleteMany);
const deleteFile = vi.mocked(deleteAttachment);

describe("attachment deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 1 });
  });

  it("removes an unshared physical file before deleting its row", async () => {
    count.mockResolvedValueOnce(0);

    await expect(removeAttachmentRecord("user-1", record)).resolves.toBe(true);

    expect(count).toHaveBeenCalledWith({
      where: { path: record.path, id: { not: record.id } },
    });
    expect(deleteFile).toHaveBeenCalledWith("user-1", "note-1", record.path);
    expect(deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0],
    );
  });

  it("keeps a physical file while another attachment still references it", async () => {
    count
      .mockResolvedValueOnce(1) // another reference before deleting the row
      .mockResolvedValueOnce(1); // and still present afterwards

    await expect(removeAttachmentRecord("user-1", record)).resolves.toBe(true);

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: record.id } });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("cleans the file after concurrent deletion of the last shared reference", async () => {
    count
      .mockResolvedValueOnce(1) // it looked shared before this row was removed
      .mockResolvedValueOnce(0); // the other row disappeared concurrently

    await expect(removeAttachmentRecord("user-1", record)).resolves.toBe(true);

    expect(deleteFile).toHaveBeenCalledWith("user-1", "note-1", record.path);
  });

  it("does not subtract quota twice through duplicate/concurrent DELETE calls", async () => {
    count.mockResolvedValueOnce(0);
    deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(removeAttachmentRecord("user-1", record)).resolves.toBe(false);
  });

  it("does not remove a row when deleting its unshared file fails", async () => {
    count.mockResolvedValueOnce(0);
    deleteFile.mockRejectedValueOnce(new Error("disk failure"));

    await expect(removeAttachmentRecord("user-1", record)).rejects.toThrow("disk failure");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an old/replaced file only after all database references are gone", async () => {
    count.mockResolvedValueOnce(0);
    await expect(
      deleteAttachmentFileIfUnused("user-1", "note-1", record.path),
    ).resolves.toBe(true);

    count.mockResolvedValueOnce(2);
    await expect(
      deleteAttachmentFileIfUnused("user-1", "note-1", record.path),
    ).resolves.toBe(false);
  });
});
