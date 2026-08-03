import { z } from "zod";
import { Prisma } from "@prisma/client";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reserveBytes, changeUsed } from "@/lib/quota";
import { contentHash } from "@/lib/files";

export { OPTIONS } from "@/lib/api";

const PAGE_SIZE = 200;

/** Kinds the tablet sync API understands. CODE notes stay on the web only. */
const SYNC_KINDS = ["HANDWRITTEN", "TEXT", "MINDMAP"] as const;

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

const outgoingNote = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(300),
  kind: z.enum(SYNC_KINDS),
  favorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().nullable().optional(),
  content: z.string(),
  baseVersion: z.number().int().min(0),
  deleted: z.boolean().optional(),
});

export const PUT = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;
  const user = result.user;

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", "Nie udało się odczytać zapytania.", 400);
  }

  const parsed = outgoingNote.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", "Notatka ma nieznany kształt. Zaktualizuj aplikację.", 400);
  }

  const note = parsed.data;
  const size = Buffer.byteLength(note.content, "utf8");
  const hash = contentHash(note.content);

  const existing = await prisma.note.findUnique({
    where: { id: note.id },
    select: { id: true, ownerId: true, version: true, sizeBytes: true, hash: true },
  });

  if (existing && existing.ownerId !== user.id) {
    return error("not-yours", "Ta notatka należy do kogoś innego.", 403);
  }

  // Nothing changed. We send back the current state and leave the database
  // alone, so that re-syncing the same thing does not bump the version forever.
  if (existing && existing.hash === hash) {
    return json({ status: "unchanged", version: existing.version });
  }

  // Somebody changed this note after the tablet fetched its copy.
  // HTTP 200 so the tablet reads the body (it treats non-2xx as hard errors).
  if (existing && note.baseVersion > 0 && existing.version !== note.baseVersion) {
    const full = await prisma.note.findUniqueOrThrow({
      where: { id: note.id },
      select: {
        id: true,
        title: true,
        kind: true,
        favorite: true,
        tags: true,
        content: true,
        version: true,
        updatedAt: true,
      },
    });
    return json({
      status: "conflict",
      message:
        "Ta notatka zmieniła się także gdzie indziej. Zapisz swoją wersję obok, żeby nic nie przepadło.",
      onServer: {
        ...full,
        updatedAt: full.updatedAt.getTime(),
      },
    });
  }

  const added = size - (existing?.sizeBytes ?? 0);
  const room = await reserveBytes(user.id, added);
  if (!room.ok) return error("out-of-space", room.reason, 507);

  try {
    const saved = await prisma.note.upsert({
      where: { id: note.id },
      create: {
        id: note.id,
        ownerId: user.id,
        folderId: note.folderId ?? null,
        title: note.title,
        kind: note.kind,
        favorite: note.favorite ?? false,
        tags: (note.tags ?? []).join("|"),
        content: note.content,
        sizeBytes: size,
        hash,
        version: 1,
        deletedAt: note.deleted ? new Date() : null,
      },
      update: {
        folderId: note.folderId ?? null,
        title: note.title,
        favorite: note.favorite ?? false,
        tags: (note.tags ?? []).join("|"),
        content: note.content,
        sizeBytes: size,
        hash,
        version: { increment: 1 },
        deletedAt: note.deleted ? new Date() : null,
      },
      select: { version: true, updatedAt: true },
    });

    return json({
      status: existing ? "saved" : "created",
      version: saved.version,
      updatedAt: saved.updatedAt.getTime(),
    });
  } catch (problem) {
    await changeUsed(user.id, -added);
    throw problem;
  }
});
