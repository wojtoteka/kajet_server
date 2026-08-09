import { prisma } from "@/lib/prisma";

/*
  Zgoda na wysyłanie treści notatek do Google.

  Jedna droga dla aplikacji (punkt /api/v1/account/ai-consent) i dla panelu WWW
  (akcja na stronie konta) - inaczej wycofanie zgody sprzątałoby po sobie tylko
  w jednym z tych dwóch miejsc.

  Zgoda siedzi PRZY KONCIE, nie na urządzeniu: zapisana lokalnie zniknęłaby po
  przeinstalowaniu aplikacji albo po zalogowaniu się na drugim tablecie.
*/
export async function setAiConsent(userId: string, consented: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { aiConsentAt: consented ? new Date() : null },
  });

  // Wycofanie kasuje też rozmowy. Nie ma w nich treści notatek, ale są
  // polecenia, które człowiek pisał - a skoro wycofuje zgodę na całą funkcję,
  // zostawianie po niej zapisków byłoby dziwne.
  if (!consented) {
    await prisma.aiTurn.deleteMany({ where: { userId } });
  }
}
