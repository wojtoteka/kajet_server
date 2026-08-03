import { Prisma } from "@prisma/client";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  SYNC_KINDS,
  outgoingNoteSchema,
  upsertNoteForUser,
} from "@/lib/note-write";

export { OPTIONS } from "@/lib/api";

const PAGE_SIZE = 200;

// --- Fetching changes ---
//
// Cursor is the pair (updatedAt, id). Query params:
//   since   — milliseconds since epoch (required for incremental sync; omit for full)
//   afterId — note id to skip when several notes share the same updatedAt
// Response:
//   upTo    — updatedAt of the last note on this page (ms), or since/0 when empty
//   upToId  — id of that note (null when the page is empty)
//   hasMore — true when another page may follow (tablet loops until false)
// Pass the previous upTo as since and upToId as afterId on the next request.

export const GET = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const afterId = url.searchParams.get("afterId");
  const withContent = url.searchParams.get("withContent") !== "no";

  const sinceMs = sinceRaw != null && sinceRaw !== "" ? Number(sinceRaw) : NaN;
  const sinceDate = Number.isFinite(sinceMs) ? new Date(sinceMs) : null;

  const cursorFilter: Prisma.NoteWhereInput = sinceDate
    ? afterId
      ? {
          OR: [
            { updatedAt: { gt: sinceDate } },
            { updatedAt: sinceDate, id: { gt: afterId } },
          ],
        }
      : { updatedAt: { gt: sinceDate } }
    : {};

  const notes = await prisma.note.findMany({
    where: {
      ownerId: result.user.id,
      kind: { in: [...SYNC_KINDS] },
      ...cursorFilter,
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      kind: true,
      favorite: true,
      tags: true,
      version: true,
      hash: true,
      sizeBytes: true,
      updatedAt: true,
      deletedAt: true,
      folderId: true,
      // Content can weigh several megabytes per note, so when merely checking
      // what changed the app may skip fetching it.
      content: withContent,
      attachments: {
        select: { name: true, mime: true, sizeBytes: true, hash: true },
      },
    },
  });

  const last = notes.at(-1);

  return json({
    notes: notes.map((note) => ({
      ...note,
      updatedAt: note.updatedAt.getTime(),
      deletedAt: note.deletedAt?.getTime() ?? null,
    })),
    // Marker for the next question. We take it from the last note rather than
    // from the server clock, so as not to miss a save that was in progress at
    // the moment of the response.
    upTo: last?.updatedAt.getTime() ?? (sinceDate ? sinceDate.getTime() : 0),
    upToId: last?.id ?? null,
    hasMore: notes.length === PAGE_SIZE,
  });
});

// --- Sending a note ---

export const PUT = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", "Nie udało się odczytać zapytania.", 400);
  }

  const parsed = outgoingNoteSchema.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", "Notatka ma nieznany kształt. Zaktualizuj aplikację.", 400);
  }

  const outcome = await upsertNoteForUser(result.user.id, parsed.data);

  if (outcome.status === "error") {
    return error(outcome.code, outcome.message, outcome.httpStatus);
  }

  // conflict / unchanged / saved / created — always HTTP 200 so the tablet
  // can read the body (it treats non-2xx as hard errors before parsing JSON).
  return json(outcome);
});
