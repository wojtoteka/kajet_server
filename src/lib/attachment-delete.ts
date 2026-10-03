import { prisma } from "./prisma";
import { deleteAttachment } from "./files";
import { droppedAttachments } from "./attachment-usage";
import { changeUsed } from "./quota";

export type AttachmentRecord = {
  id: string;
  noteId: string;
  path: string;
};

/**
 * Delete a physical file only when no attachment row points to it anymore.
 * This is also used after replacing an attachment, when the old row already
 * contains the new path.
 */
export async function deleteAttachmentFileIfUnused(
  ownerId: string,
  noteId: string,
  relativePath: string,
): Promise<boolean> {
  const references = await prisma.attachment.count({ where: { path: relativePath } });
  if (references > 0) return false;
  return deleteAttachment(ownerId, noteId, relativePath);
}

/**
 * Remove an attachment row and its file without breaking deduplicated files.
 *
 * Files are named from their content hash, so two logical attachment names
 * may share one physical file. For the ordinary (unshared) case the disk is
 * changed before the database: a disk error leaves the row in place and the
 * operation can safely be retried. Shared rows are removed first and checked
 * once more afterwards; that second check also covers two shared rows being
 * deleted concurrently.
 *
 * The return value says whether this call actually removed the database row,
 * so concurrent/idempotent DELETE requests do not subtract quota twice.
 */
export async function removeAttachmentRecord(
  ownerId: string,
  attachment: AttachmentRecord,
): Promise<boolean> {
  const otherReferences = await prisma.attachment.count({
    where: {
      path: attachment.path,
      id: { not: attachment.id },
    },
  });

  if (otherReferences === 0) {
    await deleteAttachment(ownerId, attachment.noteId, attachment.path);
  }

  const removed = await prisma.attachment.deleteMany({ where: { id: attachment.id } });
  if (removed.count === 0) return false;

  if (otherReferences > 0) {
    await deleteAttachmentFileIfUnused(ownerId, attachment.noteId, attachment.path);
  }

  return true;
}

/**
 * Sprzątanie po zapisie notatki tekstowej: załączniki, na które treść
 * przestała wskazywać (usunięte zdjęcie, usunięty rysunek razem z jego
 * kreskami), znikają z serwera i oddają zajęte miejsce.
 *
 * Zwraca nazwy skasowanych plików. Błąd dysku nie psuje zapisu notatki -
 * plik zostaje i spróbujemy przy następnym zapisie.
 */
export async function pruneDroppedAttachments(
  ownerId: string,
  noteId: string,
  previousContent: string | null | undefined,
  nextContent: string,
): Promise<string[]> {
  const attachments = await prisma.attachment.findMany({
    where: { noteId },
    select: { id: true, noteId: true, name: true, path: true, sizeBytes: true },
  });
  if (!attachments.length) return [];

  const dropped = new Set(
    droppedAttachments(
      previousContent,
      nextContent,
      attachments.map((attachment) => attachment.name),
    ),
  );
  const removed: string[] = [];
  for (const attachment of attachments) {
    if (!dropped.has(attachment.name)) continue;
    try {
      if (await removeAttachmentRecord(ownerId, attachment)) {
        await changeUsed(ownerId, -attachment.sizeBytes);
        removed.push(attachment.name);
      }
    } catch (problem) {
      console.error("[attachments] prune", problem);
    }
  }
  return removed;
}
