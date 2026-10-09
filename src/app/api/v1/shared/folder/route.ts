import { error, json, wrapApi } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { folderShareRights, listSharedFolder } from "@/lib/shared-library";

export { OPTIONS } from "@/lib/api";

/*
  Zawartość udostępnionego folderu - podfoldery i notatki - dla aplikacji.
  `t` to odnośnik, `folder` - który z podfolderów (bez niego sam udostępniony).
  Poza udostępnione drzewo wyjść się nie da.
*/
export const GET = wrapApi(async (request: Request) => {
  const words = await apiWords();
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const who = await viewerFromRequest(request);
  if (!who.ok) return error(who.reason, words.apiTokenDead, who.reason === "blocked" ? 403 : 401);

  const rights = token ? await folderShareRights(token, who.viewer) : null;
  if (!rights) return error("no-access", words.apiLinkDead, 404);

  const listing = await listSharedFolder(rights, url.searchParams.get("folder"));
  if (!listing) return error("no-access", words.apiLinkDead, 404);

  return json({
    ...listing,
    permission: rights.canEdit ? "edit" : "read",
    owner: rights.share.sharedBy.name || rights.share.sharedBy.login,
  });
});
