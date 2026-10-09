/*
  „Udostępnione mi" - cudze notatki i foldery widziane z drugiej strony.

  Wszystko tutaj chodzi po odnośniku (token). Aplikacja i strona dostają go
  razem z udostępnieniem i nim się przedstawiają; dla udostępnień imiennych
  liczy się do tego, KTO pyta (konto z adresem z zaproszenia), dla zwykłych
  odnośników - samo posiadanie linku. Prawa sprawdzamy przy każdym żądaniu
  od nowa, więc cofnięte udostępnienie przestaje działać od razu.
*/

import type { Folder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { folderWithin, shareAccessDecision, shareOwnerId, type ShareWithTarget } from "@/lib/sharing";
import type { Viewer } from "@/lib/live/access";

export type SharedNoteEntry = {
  id: string;
  title: string;
  kind: string;
  version: number;
  updatedAt: number;
};

export type SharedFolderEntry = {
  id: string;
  name: string;
  colorId: string;
  iconId: string;
};

export type SharedItem = {
  shareId: string;
  token: string;
  kind: "note" | "folder";
  permission: "read" | "edit";
  owner: string;
  acceptedAt: number | null;
  note?: SharedNoteEntry;
  folder?: SharedFolderEntry;
};

function noteEntry(note: {
  id: string;
  title: string;
  kind: string;
  version: number;
  updatedAt: Date;
}): SharedNoteEntry {
  return {
    id: note.id,
    title: note.title,
    kind: note.kind,
    version: note.version,
    updatedAt: note.updatedAt.getTime(),
  };
}

function folderEntry(folder: Folder): SharedFolderEntry {
  return { id: folder.id, name: folder.name, colorId: folder.colorId, iconId: folder.iconId };
}

type ShareWithPeople = ShareWithTarget & { sharedBy: { login: string; name: string | null } };

export function sharedItem(share: ShareWithPeople): SharedItem | null {
  const base = {
    shareId: share.id,
    token: share.token,
    permission: share.permission === "EDIT" ? ("edit" as const) : ("read" as const),
    owner: share.sharedBy.name || share.sharedBy.login,
    acceptedAt: share.acceptedAt?.getTime() ?? null,
  };
  if (share.note && !share.note.deletedAt) {
    return { ...base, kind: "note", note: noteEntry(share.note) };
  }
  if (share.folder) return { ...base, kind: "folder", folder: folderEntry(share.folder) };
  return null;
}

/** Udostępnienia przyjęte przez konto - to, co stoi w jego bibliotece. */
export async function acceptedItems(userId: string, now = new Date()): Promise<SharedItem[]> {
  const shares = await prisma.share.findMany({
    where: {
      acceptedById: userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      note: true,
      folder: true,
      sharedBy: { select: { login: true, name: true } },
    },
    orderBy: { acceptedAt: "desc" },
  });
  return shares
    .filter((share) => share.sharedById !== userId)
    .map((share) => sharedItem(share))
    .filter((item): item is SharedItem => item !== null);
}

export type FolderShareRights = {
  share: ShareWithPeople & { folder: Folder };
  ownerId: string;
  canEdit: boolean;
};

/** Wejście do udostępnionego folderu odnośnikiem [token] - albo null. */
export async function folderShareRights(
  token: string,
  viewer: Viewer,
): Promise<FolderShareRights | null> {
  const share = await prisma.share.findUnique({
    where: { token },
    include: { note: true, folder: true, sharedBy: { select: { login: true, name: true } } },
  });
  if (!share?.folder) return null;
  const ownerId = shareOwnerId(share);
  if (!ownerId) return null;
  const decision = shareAccessDecision(share, ownerId, viewer, new Date());
  if (!decision.allowed) return null;
  return {
    share: share as FolderShareRights["share"],
    ownerId,
    canEdit: decision.canEdit,
  };
}

export type FolderListing = {
  folder: SharedFolderEntry & { parentId: string | null };
  /** Droga od udostępnionego folderu do bieżącego - do nawigacji wstecz. */
  path: SharedFolderEntry[];
  folders: SharedFolderEntry[];
  notes: SharedNoteEntry[];
};

/**
 * Zawartość folderu [folderId] w udostępnionym drzewie. null, gdy folder nie
 * leży w udostępnionym (próba wyjścia poza udostępnienie).
 */
export async function listSharedFolder(
  rights: FolderShareRights,
  folderId?: string | null,
): Promise<FolderListing | null> {
  const root = rights.share.folder;
  const targetId = folderId || root.id;
  if (!(await folderWithin(targetId, root.id))) return null;
  const folder = await prisma.folder.findUnique({ where: { id: targetId } });
  if (!folder || folder.ownerId !== rights.ownerId) return null;

  const path: SharedFolderEntry[] = [];
  let cursor: Folder | null = folder;
  for (let step = 0; cursor && step < 64; step += 1) {
    path.unshift(folderEntry(cursor));
    if (cursor.id === root.id) break;
    cursor = cursor.parentId
      ? await prisma.folder.findUnique({ where: { id: cursor.parentId } })
      : null;
  }

  const [folders, notes] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId: rights.ownerId, parentId: folder.id },
      orderBy: { name: "asc" },
    }),
    prisma.note.findMany({
      where: { ownerId: rights.ownerId, folderId: folder.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, kind: true, version: true, updatedAt: true },
    }),
  ]);

  return {
    folder: { ...folderEntry(folder), parentId: folder.id === root.id ? null : folder.parentId },
    path,
    folders: folders.map(folderEntry),
    notes: notes.map(noteEntry),
  };
}

/** Czy [folderId] leży w udostępnionym drzewie (do zakładania w nim rzeczy). */
export async function insideShare(rights: FolderShareRights, folderId: string): Promise<boolean> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder || folder.ownerId !== rights.ownerId) return false;
  return folderWithin(folderId, rights.share.folder.id);
}
