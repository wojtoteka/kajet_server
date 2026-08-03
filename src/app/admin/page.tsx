import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { googleWorks, mailWorks, settings } from "@/lib/settings";
import { runnerState } from "@/lib/code-runner";
import { currentlyRunning } from "@/lib/run-limits";

export default async function AdminOverviewPage() {
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

  return (
    <>
      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Stan serwera</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 20,
          }}
        >
          <Stat name="Konta" value={String(accounts)} note={`w tym ${blocked} zablokowanych`} />
          <Stat name="Notatki" value={String(notes)} note="poza koszem" />
          <Stat
            name="Zajęte miejsce"
            value={humanSize(used)}
            note="razem na wszystkich kontach"
          />
          <Stat name="Wolne kody" value={String(freeCodes)} note="jeszcze ważne" />
        </div>
      </div>

      <div className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Ustawienia</p>
        <table>
          <tbody>
            <Row name="Adres strony" value={settings.baseUrl} />
            <Row name="Port" value={String(settings.port)} />
            <Row
              name="Poczta wychodząca"
              value={mailWorks() ? `${settings.mail.host}:${settings.mail.port}` : "nie ustawiona"}
              warning={!mailWorks()}
              hint={
                mailWorks()
                  ? undefined
                  : "Bez SMTP nie wysyłamy zaproszeń, potwierdzeń ani powiadomień o udostępnieniu. Odnośniki nadal da się kopiować ze strony."
              }
            />
            <Row
              name="Logowanie przez Google"
              value={googleWorks() ? "włączone" : "wyłączone"}
              warning={!googleWorks()}
              hint={
                googleWorks()
                  ? undefined
                  : "Uzupełnij AUTH_GOOGLE_ID i AUTH_GOOGLE_SECRET w pliku .env."
              }
            />
            <Row
              name="Domyślny limit nowego konta"
              value={humanSize(settings.quotas.default)}
            />
            <Row
              name="Największy pojedynczy plik"
              value={humanSize(settings.files.maxFileBytes)}
            />
            <Row name="Katalog z plikami" value={settings.files.directory} />
            <Row
              name="Uruchamianie kodu"
              value={codeWorks ? "w kontenerze Dockera" : "nie działa"}
              warning={!codeWorks}
              hint={
                codeWorks
                  ? `${codeDescription} Każdy program chodzi bez sieci, z limitem ${settings.code.memoryMb} MB pamięci i ${settings.code.pidsLimit} procesów, przez najwyżej ${settings.code.timeoutSeconds} s. ` +
                    `Naraz liczy się najwyżej ${settings.code.maxConcurrent} programów, czyli w szczycie ` +
                    `${humanSize(settings.code.maxConcurrent * settings.code.memoryMb * 1024 * 1024)} pamięci. ` +
                    `Teraz liczy się ${runningNow}.`
                  : `${codeDescription} Dopóki to nie działa, aplikacja mówi użytkownikom wprost, że uruchamianie jest niedostępne. Kod nadal da się pisać i zapisywać.`
              }
            />
          </tbody>
        </table>
      </div>

      <div className="row">
        <Link className="button primary" href="/admin/codes">
          Wydaj kod zaproszenia
        </Link>
        <Link className="button" href="/admin/accounts">
          Zarządzaj kontami
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
