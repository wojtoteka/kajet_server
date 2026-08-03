import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveBytes, changeUsed } from "@/lib/quota";
import { contentHash } from "@/lib/files";

/** Kinds the tablet sync API understands. CODE notes stay on the web only. */
export const SYNC_KINDS = ["HANDWRITTEN", "TEXT", "MINDMAP"] as const;
export type SyncNoteKind = (typeof SYNC_KINDS)[number];

export const outgoingNoteSchema = z.object({
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

export type OutgoingNote = z.infer<typeof outgoingNoteSchema>;

export type NoteOnServer = {
  id: string;
  title: string;
  kind: string;
  favorite: boolean;
  tags: string;
  content: string;
  version: number;
  updatedAt: number;
};

export type UpsertNoteResult =
  | { status: "unchanged"; version: number }
  | { status: "conflict"; message: string; onServer: NoteOnServer }
  | { status: "saved" | "created"; version: number; updatedAt: number }
  | { status: "error"; code: string; message: string; httpStatus: number };

const CONFLICT_MESSAGE =
  "Ta notatka zmieniła się także gdzie indziej. Zapisz swoją wersję obok, żeby nic nie przepadło.";

export type ExistingNoteSnapshot = {
  id: string;
  ownerId: string;
  version: number;
  sizeBytes: number;
  hash: string;
};

/**
 * Pure decision used by both the API route and tests: given what we know about
 * the row and the incoming payload, should we no-op, report a conflict, or write?
 */
export function planNoteUpsert(
  existing: ExistingNoteSnapshot | null,
  note: OutgoingNote,
  hash: string,
  ownerId: string,
):
  | { action: "unchanged"; version: number }
  | { action: "conflict" }
  | { action: "forbidden" }
  | { action: "write"; addedBytes: number } {
  if (existing && existing.ownerId !== ownerId) {
    return { action: "forbidden" };
  }

  if (existing && existing.hash === hash) {
    return { action: "unchanged", version: existing.version };
  }

  if (existing && note.baseVersion > 0 && existing.version !== note.baseVersion) {
    return { action: "conflict" };
  }

  return {
    action: "write",
    addedBytes: Buffer.byteLength(note.content, "utf8") - (existing?.sizeBytes ?? 0),
  };
}

/**
 * Single write path for tablet sync and (later) web editor server actions.
 * Conflict is a normal result — callers map it to HTTP 200 with status:"conflict".
 */
export async function upsertNoteForUser(
  userId: string,
  note: OutgoingNote,
): Promise<UpsertNoteResult> {
  const size = Buffer.byteLength(note.content, "utf8");
  const hash = contentHash(note.content);

  const existing = await prisma.note.findUnique({
    where: { id: note.id },
    select: { id: true, ownerId: true, version: true, sizeBytes: true, hash: true },
  });

  const plan = planNoteUpsert(existing, note, hash, userId);

  if (plan.action === "forbidden") {
    return {
      status: "error",
      code: "not-yours",
      message: "Ta notatka należy do kogoś innego.",
      httpStatus: 403,
    };
  }

  if (plan.action === "unchanged") {
    return { status: "unchanged", version: plan.version };
  }

  if (plan.action === "conflict") {
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
    return {
      status: "conflict",
      message: CONFLICT_MESSAGE,
      onServer: {
        ...full,
        updatedAt: full.updatedAt.getTime(),
      },
    };
  }

  const room = await reserveBytes(userId, plan.addedBytes);
  if (!room.ok) {
    return {
      status: "error",
      code: "out-of-space",
      message: room.reason,
      httpStatus: 507,
    };
  }

  try {
    const saved = await prisma.note.upsert({
      where: { id: note.id },
      create: {
        id: note.id,
        ownerId: userId,
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

    return {
      status: existing ? "saved" : "created",
      version: saved.version,
      updatedAt: saved.updatedAt.getTime(),
    };
  } catch (problem) {
    await changeUsed(userId, -plan.addedBytes);
    throw problem;
  }
}
