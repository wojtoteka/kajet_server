import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    attachment: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./quota", () => ({
  changeUsed: vi.fn(async () => undefined),
}));

vi.mock("./files", () => ({
  deleteAttachment: vi.fn(async () => true),
}));

import { prisma } from "./prisma";
import { deleteAttachment } from "./files";
import { changeUsed } from "./quota";
import {
  deleteAttachmentFileIfUnused,
  pruneDroppedAttachments,
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

describe("pruning attachments a text note no longer uses", () => {
  const findMany = vi.mocked(prisma.attachment.findMany);

  beforeEach(() => {
    vi.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 1 });
    count.mockResolvedValue(0);
  });

  const text = (markdown: string) =>
    JSON.stringify({
      format: 1,
      id: "note-1",
      kind: "text",
      text: {
        markdown,
        drawings: [{ asset: "rysunek-1.png", source: "rysunek-1.strokes.json", width: 560, height: 300 }],
      },
    });

  it("deletes the removed drawing with its strokes and gives the space back", async () => {
    findMany.mockResolvedValue([
      { id: "a1", noteId: "note-1", name: "rysunek-1.png", path: "u/n/h1.png", sizeBytes: 1000 },
      { id: "a2", noteId: "note-1", name: "rysunek-1.strokes.json", path: "u/n/h2.json", sizeBytes: 200 },
      { id: "a3", noteId: "note-1", name: "kot.png", path: "u/n/h3.png", sizeBytes: 5000 },
    ] as never);

    const removed = await pruneDroppedAttachments(
      "user-1",
      "note-1",
      text("Ala\n\n![rysunek](assets/rysunek-1.png)\n\n![kot](assets/kot.png)"),
      text("Ala\n\n![kot](assets/kot.png)"),
    );

    expect(removed.sort()).toEqual(["rysunek-1.png", "rysunek-1.strokes.json"]);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "a2" } });
    expect(deleteMany).not.toHaveBeenCalledWith({ where: { id: "a3" } });
    expect(vi.mocked(changeUsed)).toHaveBeenCalledWith("user-1", -1000);
    expect(vi.mocked(changeUsed)).toHaveBeenCalledWith("user-1", -200);
  });

  it("does nothing while the drawing is still in the text", async () => {
    findMany.mockResolvedValue([
      { id: "a1", noteId: "note-1", name: "rysunek-1.png", path: "u/n/h1.png", sizeBytes: 1000 },
    ] as never);

    const content = text("![rysunek](assets/rysunek-1.png)");
    await expect(pruneDroppedAttachments("user-1", "note-1", content, content)).resolves.toEqual([]);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
