"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setNoteDeletedForUser,
  setNoteFavoriteForUser,
  purgeNoteForUser,
} from "@/lib/note-write";
import { FOLDER_COLOURS, FOLDER_ICONS } from "@/lib/folder-look";
import { currentWords } from "@/lib/language";
import {
  bulkMovedMsg,
  bulkPartlyFailedMsg,
  bulkTrashedMsg,
  folderDeletedMsg,
} from "@/lib/i18n";

export type Result = { error?: string; success?: string };

export async function trashNoteFromLibrary(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };
  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await setNoteDeletedForUser(user.id, noteId, true);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: "Notatka w koszu." };
}

export async function restoreNoteFromTrash(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };
  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await setNoteDeletedForUser(user.id, noteId, false);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: (await currentWords()).actRestored };
}

export async function purgeNoteFromTrash(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };
  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await purgeNoteForUser(user.id, noteId);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: (await currentWords()).actDeletedForGood };
}

export async function emptyTrash(_previous: Result, _data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const trashed = await prisma.note.findMany({
    where: { ownerId: user.id, deletedAt: { not: null } },
    select: { id: true },
  });

  let failed = 0;
  for (const note of trashed) {
    const outcome = await purgeNoteForUser(user.id, note.id);
    if (outcome.status === "error") failed += 1;
  }

  revalidatePath("/library");
  revalidatePath("/library/trash");

  if (trashed.length === 0) return { error: "Kosz jest pusty." };
  if (failed > 0) {
    return {
      error: `Opróżniono częściowo: ${trashed.length - failed} skasowanych, ${failed} nie udało się.`,
    };
  }
  return { success: `Opróżniono kosz (${trashed.length}).` };
}

export async function toggleFavoriteFromLibrary(
  _previous: Result,
  data: FormData,
): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };
  const noteId = String(data.get("noteId") ?? "");
  const next = String(data.get("favorite") ?? "") === "1";
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await setNoteFavoriteForUser(user.id, noteId, next);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);
  // Bez słowa w odpowiedzi: wynik widać po samej gwiazdce, a napis pod
  // przyciskiem tylko rozpychał wiersz w spisie.
  return {};
}

export async function moveNoteToFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const noteId = String(data.get("noteId") ?? "");
  const folderRaw = String(data.get("folderId") ?? "");
  const folderId = folderRaw === "" || folderRaw === "__none" ? null : folderRaw;
  if (!noteId) return { error: "Brak identyfikatora." };

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };

  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { ownerId: true },
    });
    if (!folder || folder.ownerId !== user.id) {
      return { error: "Nie ma takiego folderu." };
    }
  }

  await prisma.note.update({
    where: { id: noteId },
    data: { folderId, version: { increment: 1 } },
  });

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);
  return { success: folderId ? (await currentWords()).actMovedToFolder : (await currentWords()).actTakenOutOfFolder };
}

/**
 * Działanie na wielu zaznaczonych notatkach naraz.
 *
 * Jedno działanie, a nie dwa osobne, bo formularz nad spisem jest jeden: dwa
 * znaczyłyby dwa komplety tych samych zaznaczeń i pytanie, do którego z nich
 * należy właśnie kliknięty przycisk. Co zrobić, mówi przycisk (`what`).
 *
 * Notatka, której nie da się ruszyć (cudza, skasowana w międzyczasie), nie
 * zatrzymuje reszty — zdanie na końcu mówi, ile takich było.
 */
export async function bulkNotesFromLibrary(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  const words = await currentWords();
  if (!user) return { error: words.apiMustSignIn };

  const noteIds = data
    .getAll("noteIds")
    .map((value) => String(value))
    .filter(Boolean);
  if (noteIds.length === 0) return { error: words.bulkNothingPicked };

  const what = String(data.get("what") ?? "");
  if (what !== "trash" && what !== "move") return { error: "Nieznane działanie." };

  // Cudzych notatek nie ruszamy i nie mówimy o nich ani słowa więcej, niż
  // trzeba: dla zaznaczającego wyglądają tak samo jak te, których nie ma.
  const mine = await prisma.note.findMany({
    where: { id: { in: noteIds }, ownerId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (mine.length === 0) return { error: words.bulkNothingPicked };

  if (what === "trash") {
    let failed = 0;
    for (const note of mine) {
      const outcome = await setNoteDeletedForUser(user.id, note.id, true);
      if (outcome.status === "error") failed += 1;
    }
    revalidatePath("/library");
    revalidatePath("/library/trash");
    if (failed > 0) {
      return { error: bulkPartlyFailedMsg(words, failed, mine.length) };
    }
    return { success: bulkTrashedMsg(words, mine.length) };
  }

  const folderRaw = String(data.get("folderId") ?? "");
  const folderId = folderRaw === "" || folderRaw === "__none" ? null : folderRaw;

  let folderName: string | null = null;
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { ownerId: true, name: true },
    });
    if (!folder || folder.ownerId !== user.id) return { error: "Nie ma takiego folderu." };
    folderName = folder.name;
  }

  // Jednym zapisem, nie notatka po notatce: przeniesienie nie ma żadnej
  // roboty pobocznej (plików, załączników, nagrobków), więc nie ma czego
  // rozkładać na kroki, a wersja rośnie każdej z nich tak samo.
  const moved = await prisma.note.updateMany({
    where: { id: { in: mine.map((note) => note.id) }, ownerId: user.id },
    data: { folderId, version: { increment: 1 } },
  });

  revalidatePath("/library");
  for (const note of mine) revalidatePath(`/note/${note.id}`);
  return { success: bulkMovedMsg(words, moved.count, folderName) };
}

export async function createFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const name = String(data.get("name") ?? "").trim();
  if (!name) return { error: (await currentWords()).actGiveFolderName };
  if (name.length > 120) return { error: (await currentWords()).actFolderNameTooLong };

  await prisma.folder.create({
    data: {
      ownerId: user.id,
      name,
      parentId: null,
      colorId: pickColour(data.get("colorId")),
      iconId: pickIcon(data.get("iconId")),
    },
  });

  revalidatePath("/library");
  return { success: `Folder „${name}" utworzony.` };
}

/** Barwa i ikona muszą być ze spisu - inaczej tablet nie wiedziałby, co narysować. */
function pickColour(raw: FormDataEntryValue | null): string {
  const id = String(raw ?? "");
  return FOLDER_COLOURS.some((entry) => entry.id === id) ? id : "grafit";
}

function pickIcon(raw: FormDataEntryValue | null): string {
  const id = String(raw ?? "");
  return FOLDER_ICONS.some((entry) => entry.id === id) ? id : "folder";
}

/** Sprawdza, że folder istnieje i należy do tej osoby. */
async function ownFolder(userId: string, folderId: string) {
  if (!folderId) return null;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!folder || folder.ownerId !== userId) return null;
  return folder;
}

export async function renameFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const folder = await ownFolder(user.id, String(data.get("folderId") ?? ""));
  if (!folder) return { error: "Nie ma takiego folderu." };

  const name = String(data.get("name") ?? "").trim();
  if (!name) return { error: (await currentWords()).actGiveFolderName };
  if (name.length > 120) return { error: (await currentWords()).actFolderNameTooLong };

  await prisma.folder.update({ where: { id: folder.id }, data: { name } });
  revalidatePath("/library");
  return { success: `Nazwa zmieniona na „${name}".` };
}

export async function setFolderLook(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const folder = await ownFolder(user.id, String(data.get("folderId") ?? ""));
  if (!folder) return { error: "Nie ma takiego folderu." };

  await prisma.folder.update({
    where: { id: folder.id },
    data: {
      colorId: pickColour(data.get("colorId")),
      iconId: pickIcon(data.get("iconId")),
    },
  });

  revalidatePath("/library");
  return { success: (await currentWords()).actLookChanged };
}

/**
 * Kasuje folder, zostawiając notatki w spokoju.
 *
 * Notatka wskazuje folder przez `onDelete: SetNull`, więc po skasowaniu
 * po prostu przestaje leżeć w folderze - nic nie idzie do kosza ani nie ginie.
 * Foldery w środku (na razie zakłada je tylko aplikacja) znikają razem
 * z rodzicem, a ich notatki tak samo zostają.
 */
export async function deleteFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const folder = await ownFolder(user.id, String(data.get("folderId") ?? ""));
  if (!folder) return { error: "Nie ma takiego folderu." };

  const [inside, subfolders] = await Promise.all([
    prisma.note.count({ where: { ownerId: user.id, folderId: folder.id } }),
    prisma.folder.count({ where: { ownerId: user.id, parentId: folder.id } }),
  ]);

  await prisma.folder.delete({ where: { id: folder.id } });

  revalidatePath("/library");
  return {
    success: folderDeletedMsg(await currentWords(), folder.name, inside, subfolders),
  };
}
