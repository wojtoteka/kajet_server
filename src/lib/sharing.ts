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

/** Pola udostępnienia, od których zależy decyzja o wpuszczeniu. */
export type ShareRules = {
  permission: Permission;
  email: string | null;
  anonymousAllowed: boolean;
  expiresAt: Date | null;
};

/** Kto stoi przed drzwiami: sesja albo nikt (odnośnik bez konta). */
export type ShareViewer = {
  userId: string | null;
  email: string | null;
};

export type ShareDecision =
  | { allowed: true; canEdit: boolean; isOwner: boolean }
  /*
    Powody odmowy, w słowach dopiero u wołającego - czysta funkcja nie ma
    dostępu do języka strony:
    - "expired"        - odnośnik wygasł,
    - "sign-in"        - trzeba się zalogować (odnośnik imienny albo z
                         wyłączonym wejściem bez konta),
    - "someone-else"   - odnośnik imienny otwarty z innego konta.
  */
  | { allowed: false; reason: "expired" | "sign-in" | "someone-else" };

/**
 * Jedna decyzja dla odczytu i zapisu: czy ten człowiek może otworzyć to
 * udostępnienie i czy wolno mu poprawiać. Zapis przechodzi wyłącznie przez
 * {@link shareWriteDecision}, które dokłada warunek uprawnienia EDIT -
 * dzięki temu odnośnik „tylko do czytania" nie zapisze nawet przy wywołaniu
 * akcji wprost, z pominięciem interfejsu.
 */
export function shareAccessDecision(
  share: ShareRules,
  ownerId: string,
  viewer: ShareViewer,
  now: Date,
): ShareDecision {
  if (share.expiresAt && share.expiresAt < now) {
    return { allowed: false, reason: "expired" };
  }

  // Właściciel wchodzący własnym odnośnikiem ma pełne prawa, niezależnie od
  // tego, co ustawił pozostałym.
  if (viewer.userId && viewer.userId === ownerId) {
    return { allowed: true, canEdit: true, isOwner: true };
  }

  if (share.email) {
    // Udostępnienie imienne. Liczy się, kto naprawdę jest zalogowany, nie to,
    // co ktoś wpisał w formularz.
    const address = viewer.email?.toLowerCase();
    if (!address) return { allowed: false, reason: "sign-in" };
    if (address !== share.email.toLowerCase()) {
      return { allowed: false, reason: "someone-else" };
    }
  } else if (!share.anonymousAllowed && !viewer.userId) {
    return { allowed: false, reason: "sign-in" };
  }

  return { allowed: true, canEdit: share.permission === "EDIT", isOwner: false };
}

export type ShareWriteDecision =
  | { allowed: true; isOwner: boolean }
  | { allowed: false; reason: "expired" | "sign-in" | "someone-else" | "read-only" };

/** Decyzja o zapisie: wejście plus uprawnienie EDIT. */
export function shareWriteDecision(
  share: ShareRules,
  ownerId: string,
  viewer: ShareViewer,
  now: Date,
): ShareWriteDecision {
  const decision = shareAccessDecision(share, ownerId, viewer, now);
  if (!decision.allowed) return decision;
  if (!decision.canEdit) return { allowed: false, reason: "read-only" };
  return { allowed: true, isOwner: decision.isOwner };
}

/** Jak rzadko odnotowujemy otwarcie odnośnika - patrz TOUCH_EVERY_MS w app-token.ts. */
const TOUCH_EVERY_MS = 5 * 60_000;

/**
 * Odnotowanie, że z odnośnika skorzystano. Bez czekania i z rzadka.
 *
 * Ta sama rzecz co przy tokenach aplikacji i z tego samego powodu: `update`
 * z warunkiem na kluczu robi w Prismie odczyt, a potem zapis, więc dwa
 * otwarcia naraz potrafią wywrócić się na „Record has changed since last
 * read". `updateMany` idzie jednym poleceniem, a warunek na starej wartości
 * sprawia, że przegrany wyścig po prostu nic nie robi.
 */
function touchShare(id: string, lastUsedAt: Date | null): void {
  const now = Date.now();
  if (lastUsedAt && now - lastUsedAt.getTime() < TOUCH_EVERY_MS) return;

  void prisma.share
    .updateMany({ where: { id, lastUsedAt }, data: { lastUsedAt: new Date(now) } })
    .catch(() => undefined);
}

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

/** Słowo odmowy dla powodu z decyzji. Odnośnik imienny bez sesji dostaje
 *  zdanie o zaproszeniu, zwykły z wyłączonym wejściem bez konta - o logowaniu. */
async function denialReason(
  reason: "expired" | "sign-in" | "someone-else" | "read-only",
  personal: boolean,
): Promise<string> {
  const words = await apiWords();
  switch (reason) {
    case "expired":
      return words.apiLinkExpired;
    case "sign-in":
      return personal ? words.apiSharedByName : words.apiSignInToOpen;
    case "someone-else":
      return words.apiSharedToSomeoneElse;
    case "read-only":
      return words.apiShareReadOnly;
  }
}

export async function tokenAccess(token: string): Promise<AccessResult> {
  const share = await prisma.share.findUnique({
    where: { token },
    include: { note: true },
  });

  if (!share || share.note.deletedAt) {
    return { ok: false, reason: (await apiWords()).apiLinkDead };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const decision = shareAccessDecision(
    share,
    share.note.ownerId,
    { userId, email: session?.user?.email ?? null },
    new Date(),
  );

  if (!decision.allowed) {
    return { ok: false, reason: await denialReason(decision.reason, Boolean(share.email)) };
  }

  if (decision.isOwner) {
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

  touchShare(share.id, share.lastUsedAt);

  return {
    ok: true,
    access: {
      note: share.note,
      canEdit: decision.canEdit,
      isOwner: false,
      writerName: session?.user?.login ?? session?.user?.name ?? (await apiWords()).guestWord,
      userId,
    },
  };
}

/**
 * Dostęp do ZAPISU przez odnośnik. Wołane przy każdym zapisie od nowa, więc
 * cofnięcie udostępnienia albo jego wygaśnięcie odbiera zapis natychmiast -
 * także osobie, która trzyma stronę otwartą.
 */
export async function tokenWriteAccess(token: string): Promise<AccessResult> {
  const share = await prisma.share.findUnique({
    where: { token },
    include: { note: true },
  });

  if (!share || share.note.deletedAt) {
    return { ok: false, reason: (await apiWords()).apiLinkDead };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const decision = shareWriteDecision(
    share,
    share.note.ownerId,
    { userId, email: session?.user?.email ?? null },
    new Date(),
  );

  if (!decision.allowed) {
    return { ok: false, reason: await denialReason(decision.reason, Boolean(share.email)) };
  }

  // Zapis to też użycie odnośnika - panel pokazuje przy nim ostatnie otwarcie.
  if (!decision.isOwner) touchShare(share.id, share.lastUsedAt);

  return {
    ok: true,
    access: {
      note: share.note,
      canEdit: true,
      isOwner: decision.isOwner,
      writerName:
        session?.user?.login ?? session?.user?.name ?? (await apiWords()).guestWord,
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
}): Promise<{ id: string; token: string }> {
  const token = randomBytes(24).toString("base64url");

  const share = await prisma.share.create({
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
    select: { id: true },
  });

  return { id: share.id, token };
}

export function shareUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/n/${token}`;
}
