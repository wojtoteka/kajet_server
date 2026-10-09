import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";

export { OPTIONS } from "@/lib/api";

/*
  „Usuń z moich udostępnionych" - odbiorca zdejmuje przyjęte udostępnienie
  ze swojej biblioteki. Notatka u właściciela zostaje nietknięta, odnośnik
  dalej działa: wystarczy otworzyć go jeszcze raz, żeby wróciła.
*/
export const DELETE = wrapApi(
  async (request: Request, { params }: { params: Promise<{ shareId: string }> }) => {
    const who = await viewerFromRequest(request);
    if (!who.ok || !who.viewer.userId) {
      return error("missing", (await apiWords()).apiNotSignedIn, 401);
    }
    const { shareId } = await params;
    await prisma.share.updateMany({
      where: { id: shareId, acceptedById: who.viewer.userId },
      data: { acceptedById: null, acceptedAt: null },
    });
    return json({ status: "ok" });
  },
);
