/*
  Kasowanie konta razem ze wszystkim, co na nim było.

  Jedno miejsce, bo kasują dwie drogi: administrator z panelu i sprzątanie kont
  nieużywanych (inactive.ts). Gdyby każda robiła to po swojemu, jedna z nich
  prędzej czy później zapomniałaby o katalogu na dysku albo o odnośnikach z
  poczty - a te nie mają klucza obcego, więc kaskada ich nie sprzątnie.
*/

import { prisma } from "./prisma";
import {
  deleteAttachment,
  deleteNoteDirectory,
  deleteUserDirectory,
  noteStoragePrefix,
  userStoragePrefix,
} from "./files";

export type RemovedAccount = {
  login: string;
  email: string;
  noteCount: number;
};

/**
 * Kasuje konto: wiersz w bazie (a kaskadą notatki, foldery, załączniki,
 * udostępnienia, tokeny urządzeń, wyzwania logowania i konta Google),
 * odnośniki wysłane pocztą oraz katalog z plikami na dysku.
 *
 * Zwraca null, gdy konta już nie ma - kasowanie dwa razy nie jest błędem.
 * Wpisu do dziennika nie robi: kto skasował i dlaczego, wie tylko strona
 * wołająca.
 */
export async function removeAccount(userId: string): Promise<RemovedAccount | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      login: true,
      email: true,
      _count: { select: { notes: true } },
      notes: {
        select: {
          id: true,
          attachments: { select: { path: true } },
        },
      },
    },
  });
  if (!user) return null;

  const ownPaths = [
    ...new Set(
      user.notes.flatMap((note) => note.attachments.map((attachment) => attachment.path)),
    ),
  ];
  const externalReferences = await prisma.attachment.findMany({
    where: {
      note: { ownerId: { not: user.id } },
      OR:
        ownPaths.length > 0
          ? [
              { path: { startsWith: userStoragePrefix(user.id) } },
              { path: { in: ownPaths } },
            ]
          : [{ path: { startsWith: userStoragePrefix(user.id) } }],
    },
    select: { path: true },
  });
  const protectedPaths = new Set(externalReferences.map((attachment) => attachment.path));

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: {
        identifier: {
          in: [`password:${user.email}`, `confirm:${user.email}`],
        },
      },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  // Baza poszła kaskadą, na dysku został jeszcze katalog z załącznikami.
  // Zwykle jest w całości prywatny i można go usunąć jednym ruchem. Jeżeli
  // jednak starszy albo uszkodzony wpis innego konta wskazuje plik w środku,
  // zachowaj dokładnie ten plik i posprzątaj pozostałe notatki osobno.
  if (protectedPaths.size === 0) {
    await deleteUserDirectory(user.id);
  } else {
    for (const note of user.notes) {
      const notePrefix = noteStoragePrefix(user.id, note.id);
      const noteHasProtectedFile = externalReferences.some(
        (attachment) =>
          attachment.path.startsWith(notePrefix) ||
          note.attachments.some((own) => own.path === attachment.path),
      );

      if (!noteHasProtectedFile) {
        await deleteNoteDirectory(user.id, note.id);
        continue;
      }

      for (const attachment of note.attachments) {
        if (!protectedPaths.has(attachment.path)) {
          await deleteAttachment(user.id, note.id, attachment.path);
        }
      }
    }
  }

  return {
    login: user.login,
    email: user.email,
    noteCount: user._count.notes,
  };
}
