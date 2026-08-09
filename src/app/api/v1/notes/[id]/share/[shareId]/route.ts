import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/**
 * Cofnięcie udostępnienia z panelu w aplikacji - odpowiednik „Cofnij" na
 * stronie. Skasowany wiersz odbiera dostęp natychmiast: każdy odczyt i zapis
 * przez odnośnik zaczyna się od znalezienia tego wiersza.
 */
export const DELETE = wrapApi(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string; shareId: string }> },
  ) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id: noteId, shareId } = await params;

    const existing = await prisma.share.findUnique({
      where: { id: shareId },
      select: { id: true, noteId: true, note: { select: { ownerId: true } } },
    });

    // Już cofnięte liczy się jako zrobione - cofnięcia wolno powtarzać.
    // Odnośnik spod innej notatki traktujemy tak samo: dla pytającego on
    // pod tym adresem nie istnieje.
    if (!existing || existing.noteId !== noteId) return json({ status: "ok" });

    if (existing.note.ownerId !== result.user.id) {
      return error("not-yours", (await apiWords()).apiNoteNotYours, 403);
    }

    await prisma.share.delete({ where: { id: shareId } });
    return json({ status: "ok" });
  },
);
