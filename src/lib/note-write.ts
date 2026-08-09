import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveBytes, changeUsed } from "@/lib/quota";
import { contentHash, deleteAttachment, deleteNoteDirectory } from "@/lib/files";
import { fitTitle } from "@/lib/note-title";
import { apiWords } from "./language";

/**
 * Kinds every tablet app version understands. Old apps choke on CODE content
 * (it is not a NoteDocument), so GET keeps this narrow list unless the app
 * asks for more with ?kinds=all.
 */
export const SYNC_KINDS = ["HANDWRITTEN", "TEXT", "MINDMAP"] as const;
export type SyncNoteKind = (typeof SYNC_KINDS)[number];

/** Kinds the PUT endpoint accepts. New apps sync code files as CODE notes. */
export const PUT_KINDS = [...SYNC_KINDS, "CODE"] as const;

export const outgoingNoteSchema = z.object({
  id: z.string().min(1).max(64),
  // Hojna granica, bo tytuł i tak przycina fitTitle przy zapisie.
  // Odmowa zatrzymałaby synchronizację starszych wydań aplikacji na
  // zawsze - wpis w kolejce wracałby z błędem przy każdej próbie.
  title: z.string().max(2_000),
  kind: z.enum(PUT_KINDS),
  favorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().nullable().optional(),
  // A tombstone (deleted: true) carries no content; every other write must.
  // The route checks that, because zod alone cannot see the pair.
  content: z.string().optional(),
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
  /** ms since epoch; set when the server copy sits in the bin. */
  deletedAt: number | null;
};

export type UpsertNoteResult =
  | { status: "unchanged"; version: number }
  | { status: "conflict"; message: string; onServer: NoteOnServer }
  | { status: "saved" | "created"; version: number; updatedAt: number }
  /** The note was purged here; the client should bin its copy, not recreate. */
  | { status: "gone"; version: number }
  | { status: "error"; code: string; message: string; httpStatus: number };

const CONFLICT_MESSAGE =
  (await apiWords()).apiConflict;

export type ExistingNoteSnapshot = {
  id: string;
  ownerId: string;
  version: number;
  sizeBytes: number;
  hash: string;
  /** Soft-delete marker; null means the note is active. */
  deletedAt: Date | null;
  favorite: boolean;
  /** Folder the note sits in; optional so older tests keep compiling. */
  folderId?: string | null;
};

/**
 * Maps the folder field of an incoming note onto what the database can hold.
 * The tablet sends "" for the root (its serializer drops nulls), a real id for
 * a folder, and nothing at all for "leave the note where it is". A folder this
 * account does not own also means "leave it" - moving the note to the root
 * over a typo would be worse.
 */
export async function resolveFolderId(
  userId: string,
  folderId: string | null | undefined,
): Promise<string | null | undefined> {
  if (folderId === undefined) return undefined;
  if (!folderId) return null;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder || folder.ownerId !== userId) return undefined;
  return folderId;
}

/**
 * Pure decision used by both the API route and tests: given what we know about
 * the row and the incoming payload, should we no-op, report a conflict, or write?
 */
export function planNoteUpsert(
  existing: ExistingNoteSnapshot | null,
  note: OutgoingNote,
  hash: string,
  ownerId: string,
  /** Folder already resolved by {@link resolveFolderId}; undefined = leave. */
  folderId?: string | null,
):
  | { action: "unchanged"; version: number }
  | { action: "conflict" }
  | { action: "forbidden" }
  | { action: "delete" }
  | { action: "write"; addedBytes: number } {
  if (existing && existing.ownerId !== ownerId) {
    return { action: "forbidden" };
  }

  const wantDeleted = note.deleted ?? false;
  const isDeleted = existing?.deletedAt != null;

  // Deleting wins over version conflicts: it only moves the note to the bin,
  // so nothing is lost, and the app has no way to resolve a conflict on a note
  // the user just threw away. Content is untouched - a tombstone has none.
  if (wantDeleted) {
    if (!existing) return { action: "unchanged", version: 0 };
    if (isDeleted) return { action: "unchanged", version: existing.version };
    return { action: "delete" };
  }

  const wantFavorite = note.favorite ?? existing?.favorite ?? false;
  const favoriteSame = existing ? wantFavorite === existing.favorite : true;

  // A move between folders changes no content, yet it must still write -
  // otherwise the note never leaves its old folder on the other devices.
  const folderSame =
    folderId === undefined || !existing || folderId === (existing.folderId ?? null);

  // Same content is not enough: soft-delete / restore / favorite / folder
  // must still write.
  if (existing && existing.hash === hash && wantDeleted === isDeleted && favoriteSame && folderSame) {
    return { action: "unchanged", version: existing.version };
  }

  if (existing && note.baseVersion > 0 && existing.version !== note.baseVersion) {
    return { action: "conflict" };
  }

  return {
    action: "write",
    addedBytes: Buffer.byteLength(note.content ?? "", "utf8") - (existing?.sizeBytes ?? 0),
  };
}

/**
 * Single write path for tablet sync and (later) web editor server actions.
 * Conflict is a normal result - callers map it to HTTP 200 with status:"conflict".
 */
export async function upsertNoteForUser(
  userId: string,
  note: OutgoingNote,
): Promise<UpsertNoteResult> {
  if (!note.deleted && typeof note.content !== "string") {
    return {
      status: "error",
      code: "bad-request",
      message: (await apiWords()).apiNoteWithoutBody,
      httpStatus: 400,
    };
  }

  const content = note.content ?? "";
  const size = Buffer.byteLength(content, "utf8");
  const hash = contentHash(content);

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
      folderId: true,
    },
  });

  // A baseVersion above zero says the server once acknowledged this note, yet
  // the row is missing - so it was purged (from the panel or another device).
  // Recreating it would resurrect a deliberately destroyed note; the client
  // moves its copy to the bin instead. Deletions fall through to the regular
  // path, which answers "unchanged" for a missing row.
  if (!existing && !note.deleted && note.baseVersion > 0) {
    return { status: "gone", version: 0 };
  }

  const folderId = await resolveFolderId(userId, note.folderId);
  const plan = planNoteUpsert(existing, note, hash, userId, folderId);

  if (plan.action === "forbidden") {
    return {
      status: "error",
      code: "not-yours",
      message: (await apiWords()).apiNoteNotYours,
      httpStatus: 403,
    };
  }

  if (plan.action === "unchanged") {
    return { status: "unchanged", version: plan.version };
  }

  if (plan.action === "delete") {
    const saved = await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
      select: { version: true, updatedAt: true },
    });
    return {
      status: "saved",
      version: saved.version,
      updatedAt: saved.updatedAt.getTime(),
    };
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
        deletedAt: true,
      },
    });
    return {
      status: "conflict",
      message: CONFLICT_MESSAGE,
      onServer: {
        ...full,
        updatedAt: full.updatedAt.getTime(),
        deletedAt: full.deletedAt?.getTime() ?? null,
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
        folderId: folderId ?? null,
        title: fitTitle(note.title),
        kind: note.kind,
        favorite: note.favorite ?? false,
        tags: (note.tags ?? []).join("|"),
        content,
        sizeBytes: size,
        hash,
        version: 1,
        deletedAt: null,
      },
      update: {
        // An absent field leaves the note where it is; "" (root) and unknown
        // folders are already straightened out by resolveFolderId.
        folderId: folderId === undefined ? undefined : folderId,
        title: fitTitle(note.title),
        favorite: note.favorite ?? false,
        tags: (note.tags ?? []).join("|"),
        content,
        sizeBytes: size,
        hash,
        version: { increment: 1 },
        // Deletions never reach this branch (they are the "delete" plan), so a
        // write always means the note is alive - also when it climbs out of
        // the bin after a restore on the device.
        deletedAt: null,
      },
      select: { version: true, updatedAt: true },
    });

    // Notatka powstała na nowo pod starym identyfikatorem — nagrobek po niej
    // przestaje obowiązywać.
    if (!existing) await forgetTombstone(note.id);

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
 * Zdejmuje nagrobek po notatce, która właśnie powstała na nowo pod tym samym
 * identyfikatorem.
 *
 * Zdarza się to po wylogowaniu i ponownym zalogowaniu: urządzenie zapomina
 * wtedy zapamiętane wersje i odsyła notatkę, którą wciąż ma u siebie, jako
 * nieznaną serwerowi. Notatka znowu istnieje, więc stary nagrobek jest
 * nieprawdą — zostawiony kazałby urządzeniom skasować żywą notatkę.
 */
async function forgetTombstone(noteId: string): Promise<void> {
  await prisma.deletedNote.deleteMany({ where: { noteId } });
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
  // Reuse the sync planner with a synthetic TEXT kind - kind is not part of
  // conflict/quota logic; we force CODE on the actual Prisma write below.
  const asSync: OutgoingNote = {
    id: note.id,
    title: fitTitle(note.title),
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
      folderId: true,
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

  const folderId = await resolveFolderId(userId, note.folderId);
  const plan = planNoteUpsert(existing, asSync, hash, userId, folderId);

  if (plan.action === "forbidden") {
    return {
      status: "error",
      code: "not-yours",
      message: (await apiWords()).apiNoteNotYours,
      httpStatus: 403,
    };
  }
  if (plan.action === "unchanged") {
    return { status: "unchanged", version: plan.version };
  }
  if (plan.action === "delete") {
    const saved = await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
      select: { version: true, updatedAt: true },
    });
    return {
      status: "saved",
      version: saved.version,
      updatedAt: saved.updatedAt.getTime(),
    };
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
        deletedAt: true,
      },
    });
    return {
      status: "conflict",
      message: CONFLICT_MESSAGE,
      onServer: {
        ...full,
        updatedAt: full.updatedAt.getTime(),
        deletedAt: full.deletedAt?.getTime() ?? null,
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
        folderId: folderId ?? null,
        title: fitTitle(note.title),
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
        // Same rule as in upsertNoteForUser: an absent folderId leaves the
        // note in its folder, "" and unknown folders are resolved above.
        folderId: folderId === undefined ? undefined : folderId,
        title: fitTitle(note.title),
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

    // Tak samo jak przy zwykłej notatce: plik z kodem odesłany po
    // przelogowaniu unieważnia nagrobek po sobie.
    if (!existing) await forgetTombstone(note.id);

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
      message: (await apiWords()).apiTrashFirst,
    };
  }

  const attachmentBytes = existing.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
  const freed = existing.sizeBytes + attachmentBytes;

  for (const attachment of existing.attachments) {
    await deleteAttachment(attachment.path);
  }
  await deleteNoteDirectory(userId, noteId);

  // Wiersz i nagrobek jednym zapisem. Osobno dałoby się rozerwać w połowie:
  // notatka skasowana bez nagrobka znika po cichu i żadne urządzenie się o
  // tym nie dowie, a nagrobek bez skasowania kazałby urządzeniom wyrzucić
  // notatkę, która na serwerze dalej stoi.
  await prisma.$transaction([
    prisma.note.delete({ where: { id: noteId } }),
    prisma.deletedNote.upsert({
      where: { noteId },
      create: { noteId, ownerId: userId },
      update: { deletedAt: new Date(), ownerId: userId },
    }),
  ]);

  await changeUsed(userId, -freed);

  return { status: "ok", version: 0 };
}
