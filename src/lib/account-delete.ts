/*
  Kasowanie konta razem ze wszystkim, co na nim było.

  Jedno miejsce, bo kasują dwie drogi: administrator z panelu i sprzątanie kont
  nieużywanych (inactive.ts). Gdyby każda robiła to po swojemu, jedna z nich
  prędzej czy później zapomniałaby o katalogu na dysku albo o odnośnikach z
  poczty - a te nie mają klucza obcego, więc kaskada ich nie sprzątnie.
*/

import { prisma } from "./prisma";
import { deleteUserDirectory } from "./files";

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
    },
  });
  if (!user) return null;

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
  await deleteUserDirectory(user.id);

  return {
    login: user.login,
    email: user.email,
    noteCount: user._count.notes,
  };
}
