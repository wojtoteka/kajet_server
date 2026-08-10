/**
 * Jednorazowe przepisanie limitów miejsca na nowe znaczenie liczb.
 *
 *   było:  0 = bez ograniczeń
 *   jest:  0 = zero miejsca,  -1 = bez ograniczeń
 *
 * Konta, które dziś mają w bazie zero, miały miejsce BEZ KOŃCA. Samo wgranie
 * nowego kodu odczytałoby je jako „ani bajta" i z dnia na dzień przestałyby
 * cokolwiek zapisywać. Ten skrypt przepisuje je na -1, czyli zostawia rzecz
 * taką, jaka była - zmienia się zapis, nie uprawnienie.
 *
 * Użycie (na serwerze, PRZED `npm run db:apply` i przed wgraniem nowej wersji):
 *
 *   npm run db:limity
 *
 * KOLEJNOŚĆ MA ZNACZENIE i skrypt jej pilnuje. Po zmianie schematu zero
 * zaczyna być zwyczajną liczbą - tyle znaczy nowe konto, któremu nikt nie
 * nadał miejsca. Puszczony wtedy drugi raz rozdałby tym kontom miejsce bez
 * ograniczeń, więc w takiej sytuacji skrypt nie robi nic i mówi dlaczego.
 * Poznaje to po wartości domyślnej kolumny: stara to 524288000, nowa to 0.
 */

import { PrismaClient } from "@prisma/client";
import { prepareDatabase } from "./database.mjs";

const prisma = new PrismaClient({ datasourceUrl: prepareDatabase() });

/** Wartość domyślna kolumny prosto z bazy - po niej poznajemy, co już poszło. */
async function domyslnaWartosc() {
  const rows = await prisma.$queryRaw`
    SELECT COLUMN_DEFAULT AS wartosc
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'quotaBytes'
  `;
  return rows[0]?.wartosc ?? null;
}

try {
  const domyslna = await domyslnaWartosc();

  if (domyslna === null) {
    console.error("ŹLE: nie ma tabeli `users` albo kolumny `quotaBytes`.");
    console.error("Czy to na pewno baza Kajetu?");
    process.exit(1);
  }

  if (String(domyslna) === "0") {
    console.log("Nie robię nic - schemat jest już zmieniony.");
    console.log();
    console.log("Wartość domyślna kolumny quotaBytes to 0, czyli `npm run db:apply`");
    console.log("już poszedł. Od tej chwili zero w bazie znaczy „konto bez miejsca\"");
    console.log("i tak wygląda każde świeżo założone konto. Przepisanie ich teraz");
    console.log("na -1 rozdałoby im miejsce bez ograniczeń.");
    console.log();
    console.log("Jeśli przepisanie NIE zdążyło pójść przed zmianą schematu, zajrzyj");
    console.log("do kont z zerem i nadaj im miejsce ręcznie z panelu:");
    console.log("  SELECT id, login, quotaBytes FROM users WHERE quotaBytes = 0;");
    process.exit(0);
  }

  const doZmiany = await prisma.user.findMany({
    where: { OR: [{ quotaBytes: 0n }, { permanentQuotaBytes: 0n }] },
    select: { id: true, login: true, quotaBytes: true, permanentQuotaBytes: true },
  });

  if (doZmiany.length === 0) {
    console.log("Nie ma czego przepisywać: żadne konto nie ma zapisanego zera.");
    console.log("Możesz iść dalej: npm run db:apply");
    process.exit(0);
  }

  console.log(`Konta z zerem (czyli dziś: bez ograniczeń) - ${doZmiany.length}:`);
  for (const konto of doZmiany) {
    const co = [
      konto.quotaBytes === 0n ? "limit" : null,
      konto.permanentQuotaBytes === 0n ? "limit stały" : null,
    ]
      .filter(Boolean)
      .join(" i ");
    console.log(`  ${konto.login} (${co})`);
  }
  console.log();

  // Oba zapisy jednym ruchem: konto z zerem w obu kolumnach ma wyjść stąd
  // spójne albo nie wyjść wcale.
  const [limit, staly] = await prisma.$transaction([
    prisma.user.updateMany({ where: { quotaBytes: 0n }, data: { quotaBytes: -1n } }),
    prisma.user.updateMany({
      where: { permanentQuotaBytes: 0n },
      data: { permanentQuotaBytes: -1n },
    }),
  ]);

  console.log(`Przepisano: limit w ${limit.count}, limit stały w ${staly.count} kontach.`);
  console.log("Te konta mają dalej miejsce bez ograniczeń, tylko zapisane jako -1.");
  console.log();
  console.log("Teraz: npm run db:apply");
} finally {
  await prisma.$disconnect();
}
