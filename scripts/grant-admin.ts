/**
 * Grants administrator rights to the first account.
 *
 * The first administrator cannot be made from the panel, because reaching the
 * panel already requires being one. Hence this script. It is run once, after
 * creating your own account through ordinary registration.
 *
 * Usage:
 *   npm run admin -- address@example.com
 *
 * When there is no invite code yet, the script issues one so that the first
 * account can be created.
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prepareDatabase } from "./database.mjs";

const prisma = new PrismaClient({ datasourceUrl: prepareDatabase() });

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from(randomBytes(4))
      .map((byte) => alphabet[byte % alphabet.length])
      .join("");
  return `KAJET-${part()}-${part()}`;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Podaj adres e-mail konta. Na przykład:");
    console.error("  npm run admin -- ja@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`Nie ma konta na adres ${email}.`);

    const freeCodes = await prisma.inviteCode.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });

    if (freeCodes === 0) {
      // A code needs an author, and with an empty database there is no account
      // yet. So we create a founder account and let it issue the first code.
      const founder = await prisma.user.upsert({
        where: { email: "founder@localhost" },
        update: {},
        create: {
          email: "founder@localhost",
          login: "founder",
          role: "ADMIN",
        },
      });

      const code = newCode();
      await prisma.inviteCode.create({
        data: {
          code,
          seats: 1,
          description: "Pierwszy kod, wydany przez skrypt.",
          issuedById: founder.id,
        },
      });

      console.error("");
      console.error("Wydałem pierwszy kod zaproszenia:");
      console.error(`  ${code}`);
      console.error("");
      console.error(
        "Załóż na niego konto na stronie /register, a potem uruchom ten skrypt jeszcze raz.",
      );
    } else {
      console.error("Załóż konto na stronie /register, a potem uruchom ten skrypt jeszcze raz.");
    }

    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`Konto ${user.login} już jest administratorem. Nic nie zmieniam.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`Gotowe. Konto ${user.login} ma teraz uprawnienia administratora.`);
  console.log("Panel znajdziesz pod adresem /admin.");
}

main()
  .catch((problem) => {
    console.error("Nie udało się:", problem instanceof Error ? problem.message : problem);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
