/*
  Kto patrzy na notatkę i co mu wolno - wspólne dla edycji na żywo,
  załączników i spisu „udostępnione mi".

  Trzy drogi do cudzej notatki, sprawdzane przy KAŻDYM żądaniu od nowa (tak
  samo jak przy odnośnikach na stronie - cofnięte udostępnienie przestaje
  działać od razu, także w otwartej karcie):

  1. własna notatka,
  2. odnośnik (token) - do notatki albo do folderu, w którym notatka leży,
  3. udostępnienie imienne przyjęte przez to konto - też notatki albo folderu.
*/

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { userFromHeaders } from "@/lib/app-token";
import { apiWords } from "@/lib/language";
import {
  acceptedShareRights,
  noteBehindShare,
  shareAccessDecision,
  type ShareWithTarget,
} from "@/lib/sharing";

export type Viewer = {
  userId: string | null;
  email: string | null;
  name: string;
  /** Aplikacja (token w nagłówku) albo przeglądarka (ciasteczko sesji). */
  app: boolean;
};

export type ViewerResult =
  | { ok: true; viewer: Viewer }
  /** Aplikacja przysłała token, który już nie działa - ma się zalogować od nowa. */
  | { ok: false; reason: "invalid" | "expired" | "blocked" | "missing" };

/**
 * Kto pyta. Aplikacja przedstawia się tokenem w nagłówku, przeglądarka
 * sesją. Bez jednego i drugiego to gość - może wejść odnośnikiem.
 */
export async function viewerFromRequest(request: Request): Promise<ViewerResult> {
  const guest = (await apiWords()).guestWord;
  if (request.headers.get("authorization")) {
    const result = await userFromHeaders(request.headers);
    if (!result.ok) return { ok: false, reason: result.reason };
    return {
      ok: true,
      viewer: {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.login || result.user.name || guest,
        app: true,
      },
    };
  }
  const session = await auth();
  const user = session?.user;
  if (user?.id && !user.blocked) {
    return {
      ok: true,
      viewer: {
        userId: user.id,
        email: user.email ?? null,
        name: user.login ?? user.name ?? guest,
        app: false,
      },
    };
  }
  return { ok: true, viewer: { userId: null, email: null, name: guest, app: false } };
}

export type NoteForLive = {
  id: string;
  ownerId: string;
  folderId: string | null;
  kind: "HANDWRITTEN" | "TEXT" | "MINDMAP" | "CODE";
  title: string;
  version: number;
  favorite: boolean;
  tags: string;
  deletedAt: Date | null;
};

export type NoteRights = {
  note: NoteForLive;
  canEdit: boolean;
  isOwner: boolean;
};

const NOTE_COLUMNS = {
  id: true,
  ownerId: true,
  folderId: true,
  kind: true,
  title: true,
  version: true,
  favorite: true,
  tags: true,
  deletedAt: true,
} as const;

/**
 * Prawa [viewer] do notatki [noteId]. null - ani czytać, ani pisać (albo
 * notatki nie ma, albo leży w koszu). [token] to odnośnik, którym ktoś
 * wszedł; bez niego liczy się własność i udostępnienia przyjęte przez konto.
 */
export async function noteRights(
  noteId: string,
  viewer: Viewer,
  token?: string | null,
): Promise<NoteRights | null> {
  const note = (await prisma.note.findUnique({
    where: { id: noteId },
    select: NOTE_COLUMNS,
  })) as NoteForLive | null;
  if (!note || note.deletedAt) return null;

  if (viewer.userId && viewer.userId === note.ownerId) {
    return { note, canEdit: true, isOwner: true };
  }

  let canRead = false;
  let canEdit = false;

  if (token) {
    const share = (await prisma.share.findUnique({
      where: { token },
      include: { note: true, folder: true },
    })) as ShareWithTarget | null;
    const behind = share ? await noteBehindShare(share, noteId) : null;
    if (share && behind?.id === note.id) {
      const decision = shareAccessDecision(share, note.ownerId, viewer, new Date());
      if (decision.allowed) {
        canRead = true;
        canEdit = decision.canEdit;
      }
    }
  }

  if (viewer.userId && !canEdit) {
    const accepted = await acceptedShareRights(viewer.userId, note);
    if (accepted) {
      canRead = true;
      canEdit = canEdit || accepted.canEdit;
    }
  }

  return canRead ? { note, canEdit, isOwner: false } : null;
}
