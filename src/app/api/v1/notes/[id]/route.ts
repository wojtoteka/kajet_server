import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setNoteDeletedForUser, purgeNoteForUser } from "@/lib/note-write";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/**
 * Permanent removal, used when the app empties its bin. Soft delete (the bin)
 * travels as PUT /api/v1/notes with deleted:true; this endpoint is the step
 * after it: the row, the attachments and the files on disk all go away.
 */
export const DELETE = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id: noteId } = await params;

    const existing = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    // Already gone counts as done - the app retries deletions, so the second
    // attempt must not turn into an error.
    if (!existing) return json({ status: "ok", version: 0 });

    if (existing.ownerId !== result.user.id) {
      return error("not-yours", (await apiWords()).apiNoteNotYours, 403);
    }

    // An active note is never destroyed outright. The app purges only what it
    // had already binned; if the note is active again, somebody restored it in
    // the web panel after the tombstone - their newer copy must survive, so
    // the stale purge only sends it back to the bin (recoverable), not away.
    if (!existing.deletedAt) {
      const trashed = await setNoteDeletedForUser(result.user.id, noteId, true);
      if (trashed.status === "error") {
        return error("delete-failed", trashed.message, 400);
      }
      return json({ status: "trashed", version: trashed.version });
    }

    const purged = await purgeNoteForUser(result.user.id, noteId);
    if (purged.status === "error") {
      return error("delete-failed", purged.message, 400);
    }

    return json({ status: "ok", version: 0 });
  },
);
