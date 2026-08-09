import { randomBytes } from "node:crypto";
import type { Note, Permission } from "@prisma/client";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { apiWords } from "./language";

export type Access = {
  note: Note;
canEdit: boolean;
isOwner: boolean;
writerName: string;
userId: string | null;
};

export type AccessResult = { ok: true; access: Access } | { ok: false; reason: string };

export async function ownerAccess(noteId: string): Promise<AccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: (await apiWords()).apiMustSignIn };

  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note || note.deletedAt) return { ok: false, reason: "Nie ma takiej notatki." };
  if (note.ownerId !== session.user.id) {
    return { ok: false, reason: (await apiWords()).apiNoteNotYours };
  }

  return {
    ok: true,
    access: {
      note,
      canEdit: true,
      isOwner: true,
      writerName: session.user.login ?? session.user.name ?? (await apiWords()).ownerWord,
      userId: session.user.id,
    },
  };
}

export async function tokenAccess(token: string): Promise<AccessResult> {
  const share = await prisma.share.findUnique({
    where: { token },
    include: { note: true },
  });

  if (!share || share.note.deletedAt) {
    return { ok: false, reason: (await apiWords()).apiLinkDead };
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    return { ok: false, reason: (await apiWords()).apiLinkExpired };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  // An owner arriving through their own link has full rights, regardless of
  // what they set for everybody else.
  if (userId === share.note.ownerId) {
    return {
      ok: true,
      access: {
        note: share.note,
        canEdit: true,
        isOwner: true,
        writerName: session?.user?.login ?? (await apiWords()).ownerWord,
        userId,
      },
    };
  }

  if (share.email) {
    // Personal share. We check who is really signed in, not what somebody
    // typed into a form.
    const sessionAddress = session?.user?.email?.toLowerCase();
    if (!sessionAddress) {
      return {
        ok: false,
        reason:
          (await apiWords()).apiSharedByName,
      };
    }
    if (sessionAddress !== share.email.toLowerCase()) {
      return {
        ok: false,
        reason: (await apiWords()).apiSharedToSomeoneElse,
      };
    }
  } else if (!share.anonymousAllowed && !userId) {
    return { ok: false, reason: (await apiWords()).apiSignInToOpen };
  }

  void prisma.share
    .update({ where: { id: share.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    ok: true,
    access: {
      note: share.note,
      canEdit: share.permission === "EDIT",
      isOwner: false,
      writerName: session?.user?.login ?? session?.user?.name ?? (await apiWords()).guestWord,
      userId,
    },
  };
}

export async function createShare(options: {
  noteId: string;
  sharedById: string;
  permission: Permission;
  email?: string | null;
  anonymousAllowed: boolean;
  expiresInDays?: number | null;
}): Promise<string> {
  const token = randomBytes(24).toString("base64url");

  await prisma.share.create({
    data: {
      token,
      noteId: options.noteId,
      sharedById: options.sharedById,
      permission: options.permission,
      email: options.email?.trim().toLowerCase() || null,
      // A personal share requires an account by definition, so the
      // "no account" flag only applies to plain links.
      anonymousAllowed: options.email ? false : options.anonymousAllowed,
      expiresAt: options.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 86_400_000)
        : null,
    },
  });

  return token;
}

export function shareUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/n/${token}`;
}
