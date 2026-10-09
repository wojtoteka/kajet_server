import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/** Cofnięcie udostępnienia folderu. Powtórzone cofnięcie to nie błąd. */
export const DELETE = wrapApi(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string; shareId: string }> },
  ) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id, shareId } = await params;

    const existing = await prisma.share.findUnique({
      where: { id: shareId },
      select: { folderId: true, folder: { select: { ownerId: true } } },
    });
    if (!existing || existing.folderId !== id) return json({ status: "ok" });
    if (!existing.folder || existing.folder.ownerId !== result.user.id) {
      return error("not-yours", (await apiWords()).apiNoteNotYours, 403);
    }
    await prisma.share.delete({ where: { id: shareId } });
    return json({ status: "ok" });
  },
);
