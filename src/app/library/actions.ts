"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setNoteDeletedForUser,
  setNoteFavoriteForUser,
  purgeNoteForUser,
} from "@/lib/note-write";

export type Result = { error?: string; success?: string };

export async function trashNoteFromLibrary(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };
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
  if (!user) return { error: "Musisz się zalogować." };
  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await setNoteDeletedForUser(user.id, noteId, false);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: "Przywrócono." };
}

export async function purgeNoteFromTrash(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };
  const noteId = String(data.get("noteId") ?? "");
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await purgeNoteForUser(user.id, noteId);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath("/library/trash");
  return { success: "Skasowano na stałe." };
}

export async function emptyTrash(_previous: Result, _data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

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
  if (!user) return { error: "Musisz się zalogować." };
  const noteId = String(data.get("noteId") ?? "");
  const next = String(data.get("favorite") ?? "") === "1";
  if (!noteId) return { error: "Brak identyfikatora." };

  const outcome = await setNoteFavoriteForUser(user.id, noteId, next);
  if (outcome.status === "error") return { error: outcome.message };

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);
  return { success: next ? "Ulubiona." : "Bez gwiazdki." };
}

export async function moveNoteToFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

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
  return { success: folderId ? "Przeniesiono do folderu." : "Wyjęto z folderu." };
}

export async function createFolder(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const name = String(data.get("name") ?? "").trim();
  if (!name) return { error: "Podaj nazwę folderu." };
  if (name.length > 120) return { error: "Nazwa folderu jest za długa." };

  await prisma.folder.create({
    data: {
      ownerId: user.id,
      name,
      parentId: null,
    },
  });

  revalidatePath("/library");
  return { success: `Folder „${name}" utworzony.` };
}
