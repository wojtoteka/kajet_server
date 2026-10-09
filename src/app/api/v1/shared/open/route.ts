import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { acceptShare } from "@/lib/sharing";
import { sharedItem } from "@/lib/shared-library";

export { OPTIONS } from "@/lib/api";

const body = z.object({ token: z.string().min(8).max(128) });

/*
  Aplikacja otworzyła odnośnik /n/<token> - stuknięty w poczcie, w
  komunikatorze, gdziekolwiek.

  Odpowiedź mówi, co to jest (notatka czy folder), z jakimi prawami i czy
  zostaje w bibliotece. Udostępnienie imienne, otwarte przez konto z adresem
  z zaproszenia, zostaje w tym momencie przyjęte - od teraz notatka stoi
  w bibliotece odbiorcy, na stronie i w aplikacji. Zwykły odnośnik niczego
  nie przypina: otwiera się, dopóki ktoś go ogląda.

  To POST, a nie GET, i woła go dopiero aplikacja po otwarciu linku przez
  człowieka - automat, który podgląda linki z poczty, niczego tu nie przyjmie.
*/
export const POST = wrapApi(async (request: Request) => {
  const words = await apiWords();
  const who = await viewerFromRequest(request);
  if (!who.ok) return error(who.reason, words.apiTokenDead, who.reason === "blocked" ? 403 : 401);

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", words.apiBadRequest, 400);
  }
  const parsed = body.safeParse(data);
  if (!parsed.success) return error("bad-request", words.apiUnknownShape, 400);

  const outcome = await acceptShare(parsed.data.token, who.viewer);
  if (outcome.status === "denied") {
    const message = {
      dead: words.apiLinkDead,
      expired: words.apiLinkExpired,
      "sign-in": words.apiSharedByName,
      "someone-else": words.apiSharedToSomeoneElse,
    }[outcome.reason];
    return error(outcome.reason, message, outcome.reason === "dead" ? 404 : 403);
  }

  const share = await prisma.share.findUnique({
    where: { id: outcome.share.id },
    include: { note: true, folder: true, sharedBy: { select: { login: true, name: true } } },
  });
  const item = share ? sharedItem(share) : null;
  if (!item) return error("dead", words.apiLinkDead, 404);

  const isOwner = Boolean(
    who.viewer.userId &&
      (share?.note?.ownerId === who.viewer.userId || share?.folder?.ownerId === who.viewer.userId),
  );

  return json({
    ...item,
    permission: isOwner ? "edit" : item.permission,
    // Zostaje w bibliotece: przyjęte teraz albo wcześniej.
    accepted: outcome.status === "accepted" || outcome.status === "already",
    isOwner,
  });
});
