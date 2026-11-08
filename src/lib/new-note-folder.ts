import { prisma } from "@/lib/prisma";
import type { FolderChoice } from "@/components/FolderMoveForm";

/**
 * Folder dla nowej notatki - tak jak w aplikacji: notatka powstaje w folderze,
 * w którym człowiek akurat stoi. Biblioteka dokleja go do odnośników „nowa
 * notatka" jako `?folder=...`, a strona nowej notatki pokazuje wybór folderu
 * już ustawiony na ten właśnie folder.
 *
 * Folder spoza spisu tego konta (stary odnośnik, cudzy folder, "__none")
 * znaczy po prostu: bez folderu.
 */
export type NewNoteFolder = {
  folders: FolderChoice[];
  folderId: string | null;
};

export async function newNoteFolderFor(
  userId: string,
  requested: string | undefined,
): Promise<NewNoteFolder> {
  const folders = await prisma.folder.findMany({
    where: { ownerId: userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, colorId: true, iconId: true },
  });
  const folderId =
    requested && folders.some((folder) => folder.id === requested) ? requested : null;
  return { folders, folderId };
}

/** Adres nowej notatki danego rodzaju, od razu w podanym folderze. */
export function newNoteHref(path: string, folderId: string | null | undefined): string {
  return folderId ? `${path}?folder=${encodeURIComponent(folderId)}` : path;
}

/** Dokąd wraca „Anuluj" - do folderu, z którego przyszliśmy. */
export function libraryHref(folderId: string | null | undefined): string {
  return folderId ? `/library?folder=${encodeURIComponent(folderId)}` : "/library";
}
