import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { googleWorks, mailWorks, settings } from "@/lib/settings";
import { runnerState } from "@/lib/code-runner";
import { currentlyRunning } from "@/lib/run-limits";
import { currentRelease } from "@/lib/app-release";
import { currentWords } from "@/lib/language";
import { blockedOfWhich, releaseFileHint, releaseWithDownloads } from "@/lib/i18n";

export default async function AdminOverviewPage() {
  const release = await currentRelease();

  const [accounts, blocked, notes, freeCodes, totals] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { blocked: true } }),
    prisma.note.count({ where: { deletedAt: null } }),
    prisma.inviteCode.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),
    prisma.user.aggregate({ _sum: { usedBytes: true } }),
  ]);

  const used = totals._sum.usedBytes ?? 0n;

  // We ask Docker whether the image exists at all. Better to see it here than
  // to learn about it from a pupil whose program did not start.
  const codeState = await runnerState();
  const codeWorks = codeState.works;
  const codeDescription = codeState.description;
  const runningNow = currentlyRunning();
  const words = await currentWords();

  return (
    <>
      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.serverState}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 20,
          }}
        >
          <Stat
            name={words.statAccounts}
            value={String(accounts)}
            note={blockedOfWhich(words, blocked)}
          />
          <Stat name={words.statNotes} value={String(notes)} note={words.statNotesNote} />
          <Stat
            name={words.statSpace}
            value={humanSize(used)}
            note={words.statSpaceNote}
          />
          <Stat
            name={words.statFreeCodes}
            value={String(freeCodes)}
            note={words.statFreeCodesNote}
          />
        </div>
      </div>

      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.settingsEyebrow}</p>
        <table>
          <tbody>
            <Row name={words.rowSiteAddress} value={settings.baseUrl} />
            <Row name={words.rowPort} value={String(settings.port)} />
            <Row
              name={words.rowOutgoingMail}
              value={mailWorks() ? `${settings.mail.host}:${settings.mail.port}` : words.notSetUp}
              warning={!mailWorks()}
              hint={
                mailWorks()
                  ? undefined
                  : words.noSmtpHint
              }
            />
            <Row
              name={words.rowGoogleSignIn}
              value={googleWorks() ? words.enabledWord : words.disabledWord}
              warning={!googleWorks()}
              hint={
                googleWorks()
                  ? undefined
                  : words.googleEnvHint
              }
            />
            <Row
              name={words.rowDefaultQuota}
              value={humanSize(settings.quotas.default)}
            />
            <Row
              name={words.rowLargestFile}
              value={humanSize(settings.files.maxFileBytes)}
            />
            <Row name={words.rowFilesDirectory} value={settings.files.directory} />
            <Row
              name={words.rowAndroidApp}
              value={
                release ? releaseWithDownloads(words, release.version, release.downloads) : words.notPublished
              }
              warning={!release}
              hint={
                release
                  ? releaseFileHint(words, humanSize(release.sizeBytes))
                  : words.noReleaseHint
              }
            />
            <Row
              name={words.rowRunningCode}
              value={codeWorks ? words.inDockerContainer : words.notWorking}
              warning={!codeWorks}
              hint={
                codeWorks
                  ? `${codeDescription} Każdy program chodzi bez sieci, z limitem ${settings.code.memoryMb} MB pamięci i ${settings.code.pidsLimit} procesów, przez najwyżej ${settings.code.timeoutSeconds} s. ` +
                    `Naraz liczy się najwyżej ${settings.code.maxConcurrent} programów, czyli w szczycie ` +
                    `${humanSize(settings.code.maxConcurrent * settings.code.memoryMb * 1024 * 1024)} pamięci. ` +
                    `Teraz liczy się ${runningNow}.`
                  : `${codeDescription} ${words.codeOffHint}`
              }
            />
          </tbody>
        </table>
      </div>

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

function Row({
  name,
  value,
  warning,
  hint,
}: {
  name: string;
  value: string;
  warning?: boolean;
  hint?: string;
}) {
  return (
    <tr>
      <th style={{ width: 240 }}>{name}</th>
      <td>
        <span className={warning ? "tag danger" : "mono"}>{value}</span>
        {hint ? (
          <p className="small" style={{ margin: "6px 0 0 0" }}>
            {hint}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
