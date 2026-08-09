/*
  GET    /api/v1/notes/[id]/ai-history - rozmowa z asystentem przy tej notatce.
  DELETE /api/v1/notes/[id]/ai-history - wyczyszczenie jej.

  Bramka jest tu słabsza niż przy zmianie notatki: wystarczy uprawnienie, zgoda
  nie jest potrzebna. Kto zgodę wycofał, ma tym bardziej prawo posprzątać po
  sobie to, co zostało z wcześniejszych rozmów.
*/

import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords, type Words } from "@/lib/language";
import { aiRefusal, aiVisibleFor } from "@/lib/ai/access";
import { forgetTurns, recentTurns } from "@/lib/ai/history";

export { OPTIONS } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

type Allowed =
  | { ok: false; response: Response }
  | { ok: true; userId: string; noteId: string; words: Words };

/** Konto z uprawnieniem i notatka, która do niego należy. */
async function allowed(request: Request, params: Params["params"]): Promise<Allowed> {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return { ok: false, response: result.errorResponse };

  if (!aiVisibleFor(result.user)) {
    return { ok: false, response: await aiRefusal({ ok: false, hidden: true }) };
  }

  const { id: noteId } = await params;
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { ownerId: true },
  });

  const words = await apiWords();
  if (!note) return { ok: false, response: error("no-note", words.apiNoteNotOnServer, 404) };
  if (note.ownerId !== result.user.id) {
    return { ok: false, response: error("not-yours", words.apiNoteNotYours, 403) };
  }

  return { ok: true, userId: result.user.id, noteId, words };
}

export const GET = wrapApi(async (request: Request, { params }: Params) => {
  const check = await allowed(request, params);
  if (!check.ok) return check.response;

  return json({ turns: await recentTurns(check.userId, check.noteId) });
});

export const DELETE = wrapApi(async (request: Request, { params }: Params) => {
  const check = await allowed(request, params);
  if (!check.ok) return check.response;

  const cleared = await forgetTurns(check.userId, check.noteId);
  return json({ status: "ok", cleared, message: check.words.apiAiHistoryCleared });
});
