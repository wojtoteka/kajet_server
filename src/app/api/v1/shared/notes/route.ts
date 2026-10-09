import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { viewerFromRequest } from "@/lib/live/access";
import { folderShareRights, insideShare } from "@/lib/shared-library";
import { upsertNoteForUser } from "@/lib/note-write";

export { OPTIONS } from "@/lib/api";

const form = z.object({
  id: z.string().min(1).max(64),
  folderId: z.string().min(1).max(64),
  kind: z.enum(["HANDWRITTEN", "TEXT", "MINDMAP"]),
  title: z.string().max(2_000),
  content: z.string().max(16 * 1024 * 1024),
});

/*
  Nowa notatka w udostępnionym folderze - od kogoś, kto ma prawo do zmian.

  Notatka należy do WŁAŚCICIELA folderu i zajmuje jego miejsce: folder jest
  jego, więc i to, co w nim powstaje. Tak samo działa wspólny folder na
  Dysku Google. Kto ją założył, widać w dzienniku zmian na żywo.
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
  if (!parsed.success) return error("bad-request", words.apiNoteUnknownShape, 400);
  if (!(await insideShare(rights, parsed.data.folderId))) {
    return error("no-access", words.apiLinkDead, 404);
  }

  // Identyfikator zajęty przez cudzą notatkę - nie nadpisujemy jej.
  const taken = await prisma.note.findUnique({
    where: { id: parsed.data.id },
    select: { ownerId: true },
  });
  if (taken) return error("taken", words.apiNoteNotYours, 409);

  const outcome = await upsertNoteForUser(
    rights.ownerId,
    {
      id: parsed.data.id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      content: parsed.data.content,
      folderId: parsed.data.folderId,
      baseVersion: 0,
    },
    {
      authorId: who.viewer.userId,
      authorName: who.viewer.name,
      clientId: request.headers.get("x-kajet-client") ?? "",
    },
  );
  if (outcome.status === "error") return error(outcome.code, outcome.message, outcome.httpStatus);
  if (outcome.status !== "created" && outcome.status !== "saved") {
    return error("conflict", words.apiConflict, 409);
  }
  return json({ status: "created", id: parsed.data.id, version: outcome.version });
});
