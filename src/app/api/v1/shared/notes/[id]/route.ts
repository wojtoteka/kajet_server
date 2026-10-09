import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { folderShareRights, insideShare } from "@/lib/shared-library";
import { setNoteDeletedForUser } from "@/lib/note-write";

export { OPTIONS } from "@/lib/api";

/*
  Usunięcie notatki z udostępnionego folderu - przez kogoś z prawem do zmian.
  Notatka idzie do KOSZA WŁAŚCICIELA, nie znika na zawsze: właściciel
  zawsze może ją stamtąd wyjąć. Pojedynczej udostępnionej notatki odbiorca
  nie usuwa - może ją najwyżej zdjąć ze swojej listy.
*/
export const DELETE = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const words = await apiWords();
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") ?? "";
    const who = await viewerFromRequest(request);
    if (!who.ok) return error(who.reason, words.apiTokenDead, who.reason === "blocked" ? 403 : 401);

    const rights = token ? await folderShareRights(token, who.viewer) : null;
    if (!rights) return error("no-access", words.apiLinkDead, 404);
    if (!rights.canEdit) return error("read-only", words.apiShareReadOnly, 403);

    const note = await prisma.note.findUnique({
      where: { id },
      select: { ownerId: true, folderId: true, deletedAt: true },
    });
    if (!note || note.deletedAt) return json({ status: "ok" });
    if (!note.folderId || !(await insideShare(rights, note.folderId))) {
      return error("no-access", words.apiLinkDead, 404);
    }

    const outcome = await setNoteDeletedForUser(rights.ownerId, id, true);
    if (outcome.status === "error") return error("delete-failed", outcome.message, 400);
    return json({ status: "ok", version: outcome.version });
  },
);
