import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { folderShareRights, insideShare } from "@/lib/shared-library";

export { OPTIONS } from "@/lib/api";

const form = z.object({
  parentId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
});

/*
  Nowy podfolder w udostępnionym folderze. Jak notatki - należy do
  właściciela udostępnionego folderu.
*/
export const POST = wrapApi(async (request: Request) => {
  const words = await apiWords();
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const who = await viewerFromRequest(request);
  if (!who.ok) return error(who.reason, words.apiTokenDead, who.reason === "blocked" ? 403 : 401);

  const rights = token ? await folderShareRights(token, who.viewer) : null;
  if (!rights) return error("no-access", words.apiLinkDead, 404);
  if (!rights.canEdit) return error("read-only", words.apiShareReadOnly, 403);

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", words.apiBadRequest, 400);
  }
  const parsed = form.safeParse(data);
  if (!parsed.success) return error("bad-request", words.apiUnknownShape, 400);
  if (!(await insideShare(rights, parsed.data.parentId))) {
    return error("no-access", words.apiLinkDead, 404);
  }

  const folder = await prisma.folder.create({
    data: { ownerId: rights.ownerId, parentId: parsed.data.parentId, name: parsed.data.name },
  });
  return json({ id: folder.id, name: folder.name, colorId: folder.colorId, iconId: folder.iconId });
});
