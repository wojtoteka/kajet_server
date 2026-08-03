import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveBytes, changeUsed } from "@/lib/quota";
import { contentHash, deleteAttachment, deleteNoteDirectory } from "@/lib/files";

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
  /** Soft-delete marker; null means the note is active. */
  deletedAt: Date | null;
  favorite: boolean;
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

  const wantDeleted = note.deleted ?? false;
  const isDeleted = existing?.deletedAt != null;
  const wantFavorite = note.favorite ?? existing?.favorite ?? false;
  const favoriteSame = existing ? wantFavorite === existing.favorite : true;

  // Same content is not enough: soft-delete / restore / favorite must still write.
  if (existing && existing.hash === hash && wantDeleted === isDeleted && favoriteSame) {
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
    select: {
      id: true,
      ownerId: true,
      version: true,
      sizeBytes: true,
      hash: true,
      deletedAt: true,
      favorite: true,
    },
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

export type NoteMetaResult =
  | { status: "ok"; version: number }
  | { status: "error"; message: string };

/**
 * Soft-delete or restore without rewriting content. Used by the web panel;
 * sync clients can still send `deleted` through {@link upsertNoteForUser}.
 */
export async function setNoteDeletedForUser(
  userId: string,
  noteId: string,
  deleted: boolean,
): Promise<NoteMetaResult> {
  const existing = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, deletedAt: true, version: true },
  });
  if (!existing) return { status: "error", message: "Nie ma takiej notatki." };
  if (existing.ownerId !== userId) {
    return { status: "error", message: "To nie jest Twoja notatka." };
  }

  const isDeleted = existing.deletedAt != null;
  if (deleted === isDeleted) {
    return { status: "ok", version: existing.version };
  }

  const saved = await prisma.note.update({
    where: { id: noteId },
    data: {
      deletedAt: deleted ? new Date() : null,
      version: { increment: 1 },
    },
    select: { version: true },
  });

  return { status: "ok", version: saved.version };
}

/** Toggle favorite without rewriting note content. */
export async function setNoteFavoriteForUser(
  userId: string,
  noteId: string,
  favorite: boolean,
): Promise<NoteMetaResult> {
  const existing = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, favorite: true, version: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return { status: "error", message: "Nie ma takiej notatki." };
  }
  if (existing.ownerId !== userId) {
    return { status: "error", message: "To nie jest Twoja notatka." };
  }
  if (existing.favorite === favorite) {
    return { status: "ok", version: existing.version };
  }

  const saved = await prisma.note.update({
    where: { id: noteId },
    data: { favorite, version: { increment: 1 } },
    select: { version: true },
  });

  return { status: "ok", version: saved.version };
}

/**
 * Web-only write path for CODE notes (excluded from tablet sync kinds).
 * Same version / hash / quota rules as {@link upsertNoteForUser}.
 */
export async function upsertCodeNoteForUser(
  userId: string,
  note: {
    id: string;
    title: string;
    content: string;
    baseVersion: number;
    favorite?: boolean;
    tags?: string[];
    folderId?: string | null;
    deleted?: boolean;
  },
): Promise<UpsertNoteResult> {
  // Reuse the sync planner with a synthetic TEXT kind — kind is not part of
  // conflict/quota logic; we force CODE on the actual Prisma write below.
  const asSync: OutgoingNote = {
    id: note.id,
    title: note.title,
    kind: "TEXT",
    content: note.content,
    baseVersion: note.baseVersion,
    favorite: note.favorite,
    tags: note.tags,
    folderId: note.folderId,
    deleted: note.deleted,
  };

  const size = Buffer.byteLength(note.content, "utf8");
  const hash = contentHash(note.content);

  const existing = await prisma.note.findUnique({
    where: { id: note.id },
    select: {
      id: true,
      ownerId: true,
      version: true,
      sizeBytes: true,
      hash: true,
      deletedAt: true,
      favorite: true,
      kind: true,
    },
  });

  if (existing && existing.kind !== "CODE") {
    return {
      status: "error",
      code: "wrong-kind",
      message: "To nie jest notatka z kodem.",
      httpStatus: 400,
    };
  }

  const plan = planNoteUpsert(existing, asSync, hash, userId);

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
      onServer: { ...full, updatedAt: full.updatedAt.getTime() },
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
        kind: "CODE",
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

/**
 * Permanently remove a soft-deleted note (and its attachments on disk).
 * Active notes must be soft-deleted first.
 */
export async function purgeNoteForUser(
  userId: string,
  noteId: string,
): Promise<NoteMetaResult> {
  const existing = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      ownerId: true,
      deletedAt: true,
      sizeBytes: true,
      attachments: { select: { path: true, sizeBytes: true } },
    },
  });
  if (!existing) return { status: "error", message: "Nie ma takiej notatki." };
  if (existing.ownerId !== userId) {
    return { status: "error", message: "To nie jest Twoja notatka." };
  }
  if (!existing.deletedAt) {
    return {
      status: "error",
      message: "Najpierw wyrzuć notatkę do kosza, potem możesz ją skasować na stałe.",
    };
  }

  const attachmentBytes = existing.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
  const freed = existing.sizeBytes + attachmentBytes;

  for (const attachment of existing.attachments) {
    await deleteAttachment(attachment.path);
  }
  await deleteNoteDirectory(userId, noteId);
  await prisma.note.delete({ where: { id: noteId } });
  await changeUsed(userId, -freed);

  return { status: "ok", version: 0 };
}
