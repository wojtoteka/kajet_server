/**
 * Zarządzanie kontami z serwera.
 *
 * Panel administratora celowo nie umie już dwóch rzeczy: nadać ani odebrać
 * uprawnień administratora, i tknąć cudzego konta administratora - hasła,
 * adresu, blokady, skasowania. Wszystko to robi się tutaj, czyli z powłoki na
 * maszynie, na której stoi serwer.
 *
 * Po co: konto administratora, które ktoś przejmie (wyciekłe hasło, otwarta
 * przeglądarka), dawało wcześniej pełnię władzy nad serwerem - włącznie
 * z zrobieniem administratora z konta napastnika i odebraniem uprawnień
 * wszystkim prawowitym. Teraz najgorsze, co da się zrobić z panelu, dotyczy
 * zwykłych kont, a odzyskanie serwera zostaje przy tym, kto ma do niego
 * dostęp powłoką - i to samo zabezpieczenie stoi w actions.ts, nie tylko
 * w wyglądzie strony.
 *
 * Użycie:
 *   npm run konta                              lista kont administratorów
 *   npm run konta -- lista [fraza]             wszystkie konta (fraza szuka po loginie i adresie)
 *   npm run konta -- nadaj <e-mail>            nadaje uprawnienia administratora
 *   npm run konta -- odbierz <e-mail>          odbiera uprawnienia
 *   npm run konta -- haslo <e-mail> <hasło>    ustawia hasło i wylogowuje wszystkie urządzenia
 *   npm run konta -- email <e-mail> <nowy>     zmienia adres (nowy czeka na potwierdzenie)
 *   npm run konta -- login <e-mail> <nowy>     zmienia login
 *   npm run konta -- zablokuj <e-mail> [powód]
 *   npm run konta -- odblokuj <e-mail>
 *   npm run konta -- miejsce <e-mail> <MB>     miejsce na notatki (-1 to bez ograniczeń, 0 to zero)
 *   npm run konta -- kod <e-mail> tak|nie      uruchamianie kodu na serwerze
 *   npm run konta -- kajetai <e-mail> tak|nie [na dobę]
 *   npm run konta -- skasuj <e-mail> --na-pewno
 *
 * Przy pustej bazie „nadaj" wydaje pierwszy kod zaproszenia, bo konto trzeba
 * najpierw założyć zwykłą rejestracją.
 */

import { randomBytes } from "node:crypto";
import { loadEnv } from "./database.mjs";

// Tak samo jak w sprawdz-asystenta.ts: ustawienia czytają process.env raz, przy
// wczytaniu modułu, więc .env musi już wtedy stać. Stąd importy z opóźnieniem
// w środku main(), a nie na górze pliku.
loadEnv();

const LOGIN_RULES = /^[a-z0-9._-]{3,24}$/;

main().catch((problem) => {
  console.error("Nie udało się:", problem instanceof Error ? problem.message : problem);
  process.exit(1);
});

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { removeAccount } = await import("../src/lib/account-delete");
  const bcrypt = (await import("bcryptjs")).default;

  const args = process.argv.slice(2);
  const sure = args.includes("--na-pewno");
  const rest = args.filter((argument) => argument !== "--na-pewno");
  const command = (rest[0] ?? "lista").toLowerCase();

  /** Konto po adresie albo po loginie - jedno i drugie jest jednoznaczne. */
  async function find(who: string) {
    const wanted = who.trim().toLowerCase();
    if (!wanted) fail("Podaj adres e-mail albo login konta.");

    const user =
      (await prisma.user.findUnique({ where: { email: wanted } })) ??
      (await prisma.user.findUnique({ where: { login: wanted } }));
    if (!user) fail(`Nie ma konta ${wanted}.`);

    return user;
  }

  /** Wpis do dziennika bez autora: zmiana przyszła z powłoki, nie z panelu. */
  async function writeToLog(action: string, details: string) {
    await prisma.auditEntry.create({
      data: { actorId: null, action, details: `${details} (z serwera)` },
    });
  }

  /** Konto wypada ze wszystkich urządzeń: strona przez znacznik, aplikacja z bazy. */
  async function signOutEverywhere(userId: string) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { sessionsRevokedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.appToken.deleteMany({ where: { userId } }),
    ]);
  }

  switch (command) {
    case "lista": {
      const fraza = rest[1]?.trim().toLowerCase();
      const users = await prisma.user.findMany({
        where: fraza
          ? { OR: [{ login: { contains: fraza } }, { email: { contains: fraza } }] }
          : // Bez frazy interesują nas ci, których panel nie tyka.
            { role: "ADMIN" },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
        select: { login: true, email: true, role: true, blocked: true, createdAt: true },
        take: 200,
      });

      if (users.length === 0) {
        console.log(fraza ? `Nic nie pasuje do „${fraza}".` : "Nie ma jeszcze żadnego administratora.");
        break;
      }

      console.log(fraza ? `Konta pasujące do „${fraza}":` : "Konta administratorów:");
      for (const user of users) {
        const znaczniki = [
          user.role === "ADMIN" ? "administrator" : "użytkownik",
          user.blocked ? "zablokowane" : null,
        ]
          .filter(Boolean)
          .join(", ");
        console.log(
          `  ${user.login.padEnd(20)} ${user.email.padEnd(34)} ${znaczniki}` +
            `  od ${user.createdAt.toISOString().slice(0, 10)}`,
        );
      }
      break;
    }

    case "nadaj": {
      const who = rest[1];
      if (!who) fail("Podaj adres e-mail konta. Na przykład: npm run konta -- nadaj ja@example.com");

      const wanted = who.trim().toLowerCase();
      const user =
        (await prisma.user.findUnique({ where: { email: wanted } })) ??
        (await prisma.user.findUnique({ where: { login: wanted } }));

      if (!user) {
        await bootstrap(wanted);
        break;
      }

      if (user.role === "ADMIN") {
        console.log(`Konto ${user.login} już jest administratorem. Nic nie zmieniam.`);
        break;
      }

      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      await writeToLog("account.role", `${user.login} -> ADMIN`);
      console.log(`Gotowe. Konto ${user.login} ma teraz uprawnienia administratora.`);
      console.log("Panel znajdziesz pod adresem /admin.");
      break;
    }

    case "odbierz": {
      const user = await find(rest[1] ?? "");
      if (user.role !== "ADMIN") {
        console.log(`Konto ${user.login} i tak nie jest administratorem. Nic nie zmieniam.`);
        break;
      }

      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1 && !sure) {
        fail(
          `To ostatni administrator. Po odebraniu uprawnień do panelu nie wejdzie nikt -\n` +
            `wrócić da się tylko tym poleceniem. Jeśli tak ma być, dopisz --na-pewno.`,
        );
      }

      await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });
      await writeToLog("account.role", `${user.login} -> USER`);
      console.log(`Konto ${user.login} jest znowu zwykłym użytkownikiem.`);
      break;
    }

    case "haslo": {
      const user = await find(rest[1] ?? "");
      const password = rest[2] ?? "";
      if (password.length < 8) fail("Hasło musi mieć co najmniej 8 znaków.");

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      });
      await signOutEverywhere(user.id);
      await writeToLog("account.password.set", user.login);
      console.log(`Hasło dla ${user.login} ustawione. Konto wypadło ze wszystkich urządzeń.`);
      break;
    }

    case "email": {
      const user = await find(rest[1] ?? "");
      const email = (rest[2] ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("To nie wygląda na adres e-mail.");
      if (email === user.email) fail(`Konto ${user.login} ma już ten adres.`);

      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) fail("Ten adres jest już na innym koncie.");

      // Odnośniki wysłane na stary adres (zmiana hasła, potwierdzenie) nie mogą
      // dalej działać - dotyczą konta, które ma już inny adres. Tak samo jak
      // przy zmianie adresu z panelu.
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { email, emailVerified: null } }),
        prisma.verificationToken.deleteMany({
          where: { identifier: { in: [`password:${user.email}`, `confirm:${user.email}`] } },
        }),
      ]);

      await writeToLog("account.email", `${user.login}: ${user.email} -> ${email}`);
      console.log(`Konto ${user.login} ma teraz adres ${email}.`);
      console.log("Adres czeka na potwierdzenie - odnośnik wyślij z panelu albo ze strony logowania.");
      break;
    }

    case "login": {
      const user = await find(rest[1] ?? "");
      const login = (rest[2] ?? "").trim().toLowerCase();
      if (!LOGIN_RULES.test(login)) {
        fail("Login: od 3 do 24 znaków, małe litery, cyfry, kropka, myślnik albo podkreślenie.");
      }

      const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
      if (taken && taken.id !== user.id) fail("Ten login jest już zajęty.");

      await prisma.user.update({ where: { id: user.id }, data: { login } });
      await writeToLog("account.login", `${user.login} -> ${login}`);
      console.log(`Konto nazywa się teraz ${login}.`);
      break;
    }

    case "zablokuj": {
      const user = await find(rest[1] ?? "");
      const reason = rest.slice(2).join(" ").trim();

      await prisma.user.update({
        where: { id: user.id },
        data: { blocked: true, blockReason: reason || null },
      });
      // Zablokowane konto ma wyjść od razu, nie dopiero gdy wygaśnie sesja.
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.appToken.deleteMany({ where: { userId: user.id } });

      await writeToLog("account.blocked", `${user.login}${reason ? `: ${reason}` : ""}`);
      console.log(`Konto ${user.login} zablokowane.${reason ? ` Powód: ${reason}` : ""}`);
      break;
    }

    case "odblokuj": {
      const user = await find(rest[1] ?? "");
      await prisma.user.update({
        where: { id: user.id },
        data: { blocked: false, blockReason: null },
      });
      await writeToLog("account.unblocked", user.login);
      console.log(`Konto ${user.login} odblokowane.`);
      break;
    }

    case "miejsce": {
      const user = await find(rest[1] ?? "");
      const megabytes = Number(rest[2]);
      if (!Number.isInteger(megabytes) || megabytes < -1) {
        fail("Podaj liczbę megabajtów. Minus jeden znaczy bez ograniczeń, zero znaczy zero.");
      }

      // Ta sama zasada co w panelu: -1 to bez ograniczeń, a limit stały idzie
      // razem z bieżącym, żeby konto nie wróciło po terminie do starego.
      const quota = megabytes < 0 ? -1n : BigInt(megabytes) * 1024n * 1024n;
      await prisma.user.update({
        where: { id: user.id },
        data: { quotaBytes: quota, permanentQuotaBytes: quota, quotaUntil: null },
      });

      await writeToLog("account.quota", `${user.login}: ${megabytes < 0 ? "bez ograniczeń" : `${megabytes} MB`}`);
      console.log(
        `Konto ${user.login} ma teraz ${megabytes < 0 ? "miejsce bez ograniczeń" : `${megabytes} MB`}.`,
      );
      break;
    }

    case "kod": {
      const user = await find(rest[1] ?? "");
      const allowed = yesOrNo(rest[2] ?? "");

      await prisma.user.update({ where: { id: user.id }, data: { canRunCode: allowed } });
      await writeToLog(allowed ? "account.code.enabled" : "account.code.disabled", user.login);
      console.log(
        allowed
          ? `Konto ${user.login} może uruchamiać kod.`
          : `Konto ${user.login} nie uruchomi już kodu.`,
      );
      break;
    }

    case "kajetai": {
      const user = await find(rest[1] ?? "");
      const allowed = yesOrNo(rest[2] ?? "");
      const perDay = rest[3] === undefined ? undefined : Number(rest[3]);
      if (perDay !== undefined && (!Number.isInteger(perDay) || perDay < 0)) {
        fail("Limit na dobę to liczba całkowita, zero bierze wartość domyślną z ustawień serwera.");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { canUseAi: allowed, ...(perDay === undefined ? {} : { aiDailyLimit: perDay }) },
      });

      await writeToLog(
        allowed ? "account.ai.enabled" : "account.ai.disabled",
        `${user.login}${perDay === undefined ? "" : `, ${perDay}/doba`}`,
      );
      console.log(
        allowed
          ? `Konto ${user.login} może korzystać z KajetAI.` +
              (user.aiConsentAt ? "" : " Zgodę na wysyłanie treści do Google musi jeszcze wyrazić samo.")
          : `Konto ${user.login} nie ma już dostępu do KajetAI.`,
      );
      break;
    }

    case "skasuj": {
      const user = await find(rest[1] ?? "");
      const notes = await prisma.note.count({ where: { ownerId: user.id } });

      if (!sure) {
        fail(
          `Skasowanie konta ${user.login} zabierze też jego notatki (${notes}) i pliki.\n` +
            `Tego się nie cofa. Jeśli tak ma być, dopisz --na-pewno.`,
        );
      }

      const removed = await removeAccount(user.id);
      if (!removed) fail("Konta już nie ma.");

      await writeToLog("account.deleted", `${removed!.login}, notatek: ${removed!.noteCount}`);
      console.log(`Konto ${removed!.login} skasowane razem z ${removed!.noteCount} notatkami.`);
      break;
    }

    default:
      fail(
        `Nie znam polecenia „${command}". Umiem: lista, nadaj, odbierz, haslo, email, login,\n` +
          `zablokuj, odblokuj, miejsce, kod, kajetai, skasuj.\n` +
          `Opis poleceń jest na górze pliku scripts/konta.ts.`,
      );
  }

  await prisma.$disconnect();

  /**
   * Pierwsze konto administratora, gdy w bazie nie ma jeszcze nikogo.
   *
   * Konta nie da się tu założyć - hasło, zgody i potwierdzenie adresu robi
   * rejestracja - więc skrypt wydaje kod zaproszenia i odsyła na /register.
   */
  async function bootstrap(wanted: string) {
    console.error(`Nie ma konta ${wanted}.`);

    const freeCodes = await prisma.inviteCode.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });

    if (freeCodes > 0) {
      console.error("Załóż konto na stronie /register, a potem uruchom to polecenie jeszcze raz.");
      process.exit(1);
    }

    // Kod musi mieć autora, a przy pustej bazie nie ma jeszcze żadnego konta.
    // Zakładamy więc konto założycielskie i to ono wydaje pierwszy kod.
    const founder = await prisma.user.upsert({
      where: { email: "founder@localhost" },
      update: {},
      create: { email: "founder@localhost", login: "founder", role: "ADMIN" },
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
    console.error("Załóż na niego konto na stronie /register, a potem uruchom to polecenie jeszcze raz.");
    process.exit(1);
  }
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from(randomBytes(4))
      .map((byte) => alphabet[byte % alphabet.length])
      .join("");
  return `KAJET-${part()}-${part()}`;
}

/** „tak" albo „nie" z wiersza poleceń. Nic innego nie przechodzi. */
function yesOrNo(value: string): boolean {
  const word = value.trim().toLowerCase();
  if (word === "tak") return true;
  if (word === "nie") return false;
  return fail(`Napisz „tak" albo „nie", nie „${value}".`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
