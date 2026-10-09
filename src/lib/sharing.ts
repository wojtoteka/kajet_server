import { randomBytes } from "node:crypto";
import type { Folder, Note, Permission, Share } from "@prisma/client";
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

/** Najgłębsze zagnieżdżenie folderów, jakie przejdziemy w górę drzewa. */
const MAX_FOLDER_DEPTH = 64;

/**
 * Czy folder [folderId] leży w [rootId] albo jest nim samym. Idziemy od
 * folderu w górę po rodzicach - drzewo jednego konta jest płytkie, a pętla
 * w danych (która nie powinna się zdarzyć) kończy się na limicie.
 */
export async function folderWithin(folderId: string | null, rootId: string): Promise<boolean> {
  let current = folderId;
  for (let step = 0; current && step < MAX_FOLDER_DEPTH; step += 1) {
    if (current === rootId) return true;
    const folder = await prisma.folder.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = folder?.parentId ?? null;
  }
  return false;
}

/** Identyfikatory folderu i wszystkich nad nim - do szukania udostępnień. */
export async function folderChain(folderId: string | null): Promise<string[]> {
  const chain: string[] = [];
  let current = folderId;
  for (let step = 0; current && step < MAX_FOLDER_DEPTH; step += 1) {
    if (chain.includes(current)) break;
    chain.push(current);
    const folder = await prisma.folder.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = folder?.parentId ?? null;
  }
  return chain;
}

export type ShareWithTarget = Share & { note: Note | null; folder: Folder | null };

/**
 * Notatka, którą otwiera odnośnik. Przy udostępnionej notatce to ona sama;
 * przy folderze - notatka [noteId], o ile leży w tym folderze albo głębiej
 * i należy do tego samego właściciela. null znaczy „ten odnośnik tej
 * notatki nie otwiera".
 */
export async function noteBehindShare(
  share: ShareWithTarget,
  noteId?: string | null,
): Promise<Note | null> {
  if (share.note || share.noteId) {
    if (noteId && noteId !== (share.noteId ?? share.note?.id)) return null;
    return share.note;
  }
  if (!share.folder || !noteId) return null;
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note || note.ownerId !== share.folder.ownerId) return null;
  return (await folderWithin(note.folderId, share.folder.id)) ? note : null;
}

/** Właściciel tego, co udostępniono - notatki albo folderu. */
export function shareOwnerId(share: ShareWithTarget): string | null {
  return share.note?.ownerId ?? share.folder?.ownerId ?? null;
}

async function shareForToken(token: string): Promise<ShareWithTarget | null> {
  return prisma.share.findUnique({
    where: { token },
    include: { note: true, folder: true },
  });
}

/**
 * Dostęp przez odnośnik. [noteId] wskazuje notatkę w udostępnionym folderze;
 * przy udostępnionej notatce można go pominąć.
 */
export async function tokenAccess(token: string, noteId?: string | null): Promise<AccessResult> {
  const share = await shareForToken(token);
  const note = share ? await noteBehindShare(share, noteId) : null;
  if (!share || !note || note.deletedAt) {
    return { ok: false, reason: (await apiWords()).apiLinkDead };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const decision = shareAccessDecision(
    share,
    note.ownerId,
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
        note,
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
      note,
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
export async function tokenWriteAccess(
  token: string,
  noteId?: string | null,
): Promise<AccessResult> {
  const share = await shareForToken(token);
  const note = share ? await noteBehindShare(share, noteId) : null;
  if (!share || !note || note.deletedAt) {
    return { ok: false, reason: (await apiWords()).apiLinkDead };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const decision = shareWriteDecision(
    share,
    note.ownerId,
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
      note,
      canEdit: true,
      isOwner: decision.isOwner,
      writerName:
        session?.user?.login ?? session?.user?.name ?? (await apiWords()).guestWord,
      userId,
    },
  };
}

export type FolderShareAccess =
  | {
      ok: true;
      share: ShareWithTarget & { folder: Folder };
      canEdit: boolean;
      isOwner: boolean;
      userId: string | null;
    }
  | { ok: false; reason: string };

/** Wejście do udostępnionego folderu przez odnośnik (strona folderu). */
export async function folderTokenAccess(token: string): Promise<FolderShareAccess> {
  const share = await shareForToken(token);
  if (!share || !share.folder) return { ok: false, reason: (await apiWords()).apiLinkDead };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const decision = shareAccessDecision(
    share,
    share.folder.ownerId,
    { userId, email: session?.user?.email ?? null },
    new Date(),
  );
  if (!decision.allowed) {
    return { ok: false, reason: await denialReason(decision.reason, Boolean(share.email)) };
  }
  if (!decision.isOwner) touchShare(share.id, share.lastUsedAt);
  return {
    ok: true,
    share: share as ShareWithTarget & { folder: Folder },
    canEdit: decision.canEdit,
    isOwner: decision.isOwner,
    userId,
  };
}

export type AcceptOutcome =
  | { status: "accepted" | "already"; share: ShareWithTarget }
  /** Odnośnik bez adresu - nic się u nikogo nie zapisuje. */
  | { status: "link"; share: ShareWithTarget }
  | { status: "denied"; reason: "dead" | "expired" | "sign-in" | "someone-else" };

/**
 * Przyjęcie udostępnienia imiennego: notatka (albo folder) trafia do
 * biblioteki osoby, do której ją wysłano.
 *
 * Woła to dopiero człowiek, który naprawdę otworzył odnośnik - strona zaraz
 * po wyświetleniu (żądaniem POST z przeglądarki), aplikacja po otwarciu
 * odnośnika. Zwykłe pobranie strony nic tu nie zapisuje, więc skaner linków
 * w skrzynce pocztowej (i każdy inny automat bez sesji tej osoby) niczego
 * nie przypnie. Konto musi mieć dokładnie adres z zaproszenia.
 */
export async function acceptShare(
  token: string,
  viewer: { userId: string | null; email: string | null },
): Promise<AcceptOutcome> {
  const share = await shareForToken(token);
  const ownerId = share ? shareOwnerId(share) : null;
  if (!share || !ownerId || share.note?.deletedAt) return { status: "denied", reason: "dead" };

  const decision = shareAccessDecision(share, ownerId, viewer, new Date());
  if (!decision.allowed) return { status: "denied", reason: decision.reason };
  if (!share.email || decision.isOwner || !viewer.userId) return { status: "link", share };

  if (share.acceptedById === viewer.userId) return { status: "already", share };

  await prisma.share.updateMany({
    where: { id: share.id },
    data: { acceptedById: viewer.userId, acceptedAt: new Date(), lastUsedAt: new Date() },
  });
  return {
    status: "accepted",
    share: { ...share, acceptedById: viewer.userId, acceptedAt: new Date() },
  };
}

export type AccountRights = {
  canEdit: boolean;
  /** Udostępnienie, przez które konto ma dostęp. */
  shareId: string;
};

/**
 * Dostęp do cudzej notatki przez udostępnienie przyjęte przez to konto -
 * samej notatki albo któregoś folderu nad nią. Najmocniejsze prawo wygrywa.
 */
export async function acceptedShareRights(
  userId: string,
  note: { id: string; ownerId: string; folderId: string | null },
  now = new Date(),
): Promise<AccountRights | null> {
  const chain = await folderChain(note.folderId);
  const shares = await prisma.share.findMany({
    where: {
      acceptedById: userId,
      OR: [{ noteId: note.id }, ...(chain.length > 0 ? [{ folderId: { in: chain } }] : [])],
    },
    select: { id: true, permission: true, expiresAt: true, folder: { select: { ownerId: true } } },
  });
  let best: AccountRights | null = null;
  for (const share of shares) {
    if (share.expiresAt && share.expiresAt < now) continue;
    // Folder mógł zmienić właściciela tylko w złych danych - nie ryzykujemy.
    if (share.folder && share.folder.ownerId !== note.ownerId) continue;
    const canEdit = share.permission === "EDIT";
    if (!best || (canEdit && !best.canEdit)) best = { canEdit, shareId: share.id };
  }
  return best;
}

export async function createShare(options: {
  noteId?: string | null;
  folderId?: string | null;
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
      noteId: options.noteId ?? null,
      folderId: options.noteId ? null : (options.folderId ?? null),
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
