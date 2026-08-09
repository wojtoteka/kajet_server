import Link from "next/link";
import { statfs } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { SERVER_QUOTA, humanSize } from "@/lib/quota";
import { googleWorks, mailWorks, settings } from "@/lib/settings";
import { runnerState } from "@/lib/code-runner";
import { currentRelease } from "@/lib/app-release";
import { currentWords } from "@/lib/language";
import { Icon } from "@/components/Icon";
import {
  blockedOfWhich,
  diskUnderLimitHint,
  freeOfServerLimit,
  lastAccountOn,
  lastCrashOn,
  notesThisWeek,
  serverNearlyFullHint,
  spaceOfServerLimit,
  type Words,
} from "@/lib/i18n";

/*
  Strona główna panelu.

  Dwa rzędy liczb i nic poza nimi. Górny mówi, ile Kajetu w ogóle jest, dolny -
  co się w nim wydarzyło przez ostatni tydzień; to drugie jest jedyną rzeczą,
  po którą warto tu zaglądać częściej niż raz.

  Stałych z pliku .env - adresu, portu, katalogu, limitów - tu nie ma. Nigdy
  się nie zmieniały, a zajmowały pół ekranu; kto ich potrzebuje, ma je w .env.
  Zostaje z nich tylko to, co potrafi się zepsuć, i tylko wtedy, gdy jest
  zepsute: sekcja „do sprawdzenia” przy sprawnym serwerze w ogóle się nie
  pokazuje.
*/

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminOverviewPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const release = await currentRelease();

  const [
    accounts,
    blocked,
    notes,
    freeCodes,
    totals,
    newAccounts,
    newestAccount,
    notesToday,
    notesWeek,
    crashes,
    newestCrash,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { blocked: true } }),
    prisma.note.count({ where: { deletedAt: null } }),
    prisma.inviteCode.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }),
    prisma.user.aggregate({ _sum: { usedBytes: true } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.note.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.note.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.crashReport.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.crashReport.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const used = totals._sum.usedBytes ?? 0n;
  const free = await freeSpace();

  /*
    Ile jeszcze wolno zapisać. To ta sama odległość od granicy, którą przy każdym
    zapisie liczy `overServerLimit` - kafelek nie wymyśla własnej liczby, tylko
    pokazuje tę, na której zapisy naprawdę się zatrzymają. Bez granicy
    (SERVER_QUOTA_BYTES=0) nie ma od czego odejmować i zostaje wolne miejsce
    na dysku.
  */
  const limited = SERVER_QUOTA > 0n;
  const leftOfLimit = used >= SERVER_QUOTA ? 0n : SERVER_QUOTA - used;

  // Dysk mniejszy niż to, co granica jeszcze pozwala zapisać: wtedy zapisy
  // zatrzyma dysk, a kafelek pokazywałby liczbę, do której nikt nie dojdzie.
  const diskUnderLimit = limited && free !== null && BigInt(Math.floor(free)) < leftOfLimit;

  // Pytamy Dockera, czy obraz w ogóle istnieje. Lepiej zobaczyć to tutaj niż
  // dowiedzieć się od ucznia, któremu program się nie uruchomił.
  const codeState = await runnerState();
  const words = await currentWords();
  const problems = worthChecking(words, {
    mail: mailWorks(),
    google: googleWorks(),
    release: Boolean(release),
    code: codeState.works,
    codeDescription: codeState.description,
    // Dziewięć dziesiątych granicy serwera: tyle zostaje czasu, żeby zwolnić
    // miejsce albo podnieść granicę, zanim komukolwiek przestanie się zapisywać.
    serverNearlyFull: limited && used * 10n >= SERVER_QUOTA * 9n,
    serverUsed: humanSize(used),
    serverLimit: humanSize(SERVER_QUOTA),
    diskUnderLimit,
    diskFree: free === null ? words.unknownWord : humanSize(free),
    limitLeft: humanSize(leftOfLimit),
  });

  return (
    <>
      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.serverState}</p>
        <StatRow>
          <Stat
            name={words.statAccounts}
            value={String(accounts)}
            note={blockedOfWhich(words, blocked)}
          />
          <Stat name={words.statNotes} value={String(notes)} note={words.statNotesNote} />
          <Stat
            name={words.statSpace}
            value={humanSize(used)}
            note={
              limited ? spaceOfServerLimit(words, humanSize(SERVER_QUOTA)) : words.statSpaceNote
            }
          />
          <Stat
            name={words.statFreeSpace}
            value={
              limited
                ? humanSize(leftOfLimit)
                : free === null
                  ? words.unknownWord
                  : humanSize(free)
            }
            note={
              limited
                ? freeOfServerLimit(words, humanSize(SERVER_QUOTA))
                : words.statFreeSpaceNote
            }
          />
          <Stat
            name={words.statFreeCodes}
            value={String(freeCodes)}
            note={words.statFreeCodesNote}
          />
        </StatRow>
      </div>

      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.lastWeekEyebrow}</p>
        <StatRow>
          <Stat
            name={words.statNewAccounts}
            value={String(newAccounts)}
            note={lastAccountOn(words, newestAccount?.createdAt ?? null)}
          />
          <Stat
            name={words.statNotesToday}
            value={String(notesToday)}
            note={notesThisWeek(words, notesWeek)}
          />
          <Stat
            name={words.statCrashes}
            value={String(crashes)}
            note={lastCrashOn(words, newestCrash?.createdAt ?? null)}
          />
        </StatRow>
      </div>

      {problems.length > 0 ? (
        <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
          <p className="eyebrow">{words.worthCheckingEyebrow}</p>
          {problems.map((problem) => (
            <div key={problem.title} className="notice" style={{ borderLeftColor: "var(--warning)" }}>
              <p style={{ margin: 0, color: "var(--text)", display: "flex", gap: 8 }}>
                <Icon name="warning" size={18} />
                {problem.title}
              </p>
              <p className="small" style={{ margin: "4px 0 0 26px" }}>
                {problem.hint}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="row">
        <Link className="button primary" href="/admin/codes">
          {words.issueInviteCode}
        </Link>
        <Link className="button" href="/admin/accounts">
          {words.manageAccounts}
        </Link>
        <Link className="button" href="/admin/app">
          {words.publishApp}
        </Link>
      </div>
    </>
  );
}

/*
  Wolne miejsce na dysku serwera. Pytamy o katalog z załącznikami, bo to on
  zapełni się pierwszy - i to jego zapełnienie zatrzyma zapisywanie notatek.
  Gdy katalogu jeszcze nie ma (świeży serwer), pytamy o katalog programu.
  Cokolwiek by tu nie wyszło, strona ma się pokazać - stąd `null` zamiast błędu.
*/
async function freeSpace(): Promise<number | null> {
  for (const where of [settings.files.directory, "."]) {
    try {
      const disk = await statfs(where);
      return Number(disk.bavail) * Number(disk.bsize);
    } catch {
      continue;
    }
  }
  return null;
}

/** Rzeczy zepsute - każda z jednym zdaniem o tym, co przez to nie działa. */
function worthChecking(
  words: Words,
  state: {
    mail: boolean;
    google: boolean;
    release: boolean;
    code: boolean;
    codeDescription: string;
    serverNearlyFull: boolean;
    serverUsed: string;
    serverLimit: string;
    diskUnderLimit: boolean;
    diskFree: string;
    limitLeft: string;
  },
): { title: string; hint: string }[] {
  const problems: { title: string; hint: string }[] = [];

  // Najpierw miejsce: pełny serwer zatrzymuje zapisywanie wszystkim naraz,
  // a reszta tych usterek dotyka pojedynczych możliwości.
  if (state.serverNearlyFull) {
    problems.push({
      title: words.serverNearlyFullTitle,
      hint: serverNearlyFullHint(words, state.serverUsed, state.serverLimit),
    });
  }
  if (state.diskUnderLimit) {
    problems.push({
      title: words.diskUnderLimitTitle,
      hint: diskUnderLimitHint(words, state.diskFree, state.limitLeft),
    });
  }
  if (!state.mail) problems.push({ title: words.mailOffTitle, hint: words.noSmtpHint });
  if (!state.google) problems.push({ title: words.googleOffTitle, hint: words.googleEnvHint });
  if (!state.release) problems.push({ title: words.noReleaseTitle, hint: words.noReleaseHint });
  if (!state.code) {
    problems.push({
      title: words.codeOffTitle,
      hint: `${state.codeDescription} ${words.codeOffHint}`,
    });
  }

  return problems;
}

function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 20,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <div>
      <p className="small" style={{ margin: 0 }}>
        {name}
      </p>
      <p
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 26,
          fontWeight: 600,
          margin: "2px 0",
        }}
      >
        {value}
      </p>
      <p className="small" style={{ margin: 0 }}>
        {note}
      </p>
    </div>
  );
}
