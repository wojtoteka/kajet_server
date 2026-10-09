import { error, json, wrapApi } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { acceptedItems } from "@/lib/shared-library";

export { OPTIONS } from "@/lib/api";

/*
  Spis „udostępnione mi" dla aplikacji: notatki i foldery, które ktoś
  udostępnił temu kontu imiennie, a ono otworzyło odnośnik (przyjęło).
  Aplikacja pokazuje je w bibliotece obok własnych, z oznaczeniem
  „udostępnione". Zwykłe odnośniki („każdy, kto ma link") tu nie trafiają -
  otwierają się tylko na czas oglądania.
*/
export const GET = wrapApi(async (request: Request) => {
  const who = await viewerFromRequest(request);
  if (!who.ok || !who.viewer.userId) {
    return error("missing", (await apiWords()).apiNotSignedIn, 401);
  }
  return json({ items: await acceptedItems(who.viewer.userId) });
});
