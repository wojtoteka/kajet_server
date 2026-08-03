import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize, quotaState } from "@/lib/quota";
import { settings } from "@/lib/settings";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import { revokeDevice, issueAppToken, changePassword, changeOwnLogin } from "./actions";

export const metadata = { title: "Moje konto — Kajet" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account");

  const [devices, storage, noteCount] = await Promise.all([
    prisma.appToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    quotaState(user.id),
    prisma.note.count({ where: { ownerId: user.id, deletedAt: null } }),
  ]);

  const percent =
    storage.unlimited || storage.quota === 0n
      ? 0
      : Math.min(100, Math.round((Number(storage.used) / Number(storage.quota)) * 100));

  return (
    <main className="page">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Moje konto</h1>
        <div className="row">
          <Link className="button compact" href="/library">
            Moje notatki
          </Link>
          {user.role === "ADMIN" ? (
            <Link className="button compact" href="/admin">
              Panel administratora
            </Link>
          ) : null}
        </div>
      </div>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Miejsce</p>
        <p style={{ marginBottom: 8 }}>
          {humanSize(storage.used)} z{" "}
          {storage.unlimited ? "bez limitu" : humanSize(storage.quota)} · {noteCount} notatek
          {storage.quotaUntil
            ? ` · limit obowiązuje do ${storage.quotaUntil.toLocaleDateString("pl-PL")}`
            : ""}
        </p>
        <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
          <span style={{ width: `${storage.unlimited ? 4 : percent}%` }} />
        </div>
        {percent >= 90 && !storage.unlimited ? (
          <p className="small" style={{ marginTop: 8 }}>
            Miejsce się kończy. Skasuj coś albo poproś administratora o większy limit.
          </p>
        ) : null}
      </section>

      <section
        className="sheet-ruled"
        style={{ paddingBlock: 24, paddingInlineEnd: 26, marginBottom: 20 }}
      >
        <p className="eyebrow">Urządzenia</p>
        <h2 style={{ marginBottom: 8 }}>Aplikacja na tablecie</h2>
        <p className="lead">
          Zwykle wystarczy zalogować się w aplikacji adresem i hasłem. Token przydaje się wtedy,
          gdy konto założyłeś przez Google i nie masz hasła, albo gdy wolisz nie wpisywać hasła
          na cudzym urządzeniu.
        </p>
        <p className="small" style={{ marginBottom: 16 }}>
          Adres serwera do wpisania w aplikacji: <span className="mono">{settings.baseUrl}</span>
        </p>

        <ActionForm action={issueAppToken} label="Wydaj token" busyLabel="Wydaję...">
          <div className="field">
            <label htmlFor="device">Nazwa urządzenia</label>
            <input id="device" name="device" type="text" placeholder="np. Yoga Tab" />
          </div>
        </ActionForm>

        {devices.length > 0 ? (
          <>
            <hr className="divider" />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Urządzenie</th>
                    <th style={{ width: 160 }}>Ostatnie użycie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <strong>{device.device}</strong>
                        <p className="small" style={{ margin: "2px 0 0 0" }}>
                          podłączone {device.createdAt.toLocaleDateString("pl-PL")}
                        </p>
                      </td>
                      <td className="small">
                        {device.lastUsedAt
                          ? device.lastUsedAt.toLocaleString("pl-PL")
                          : "jeszcze nie użyte"}
                      </td>
                      <td>
                        <ActionForm
                          action={revokeDevice}
                          label="Odłącz"
                          compact
                          danger
                          confirmation="Odłączyć to urządzenie? Aplikacja poprosi na nim o ponowne zalogowanie."
                        >
                          <input type="hidden" name="id" value={device.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Login</p>
        <p className="lead">Login widzą osoby, którym udostępnisz notatkę.</p>
        <ActionForm action={changeOwnLogin} label="Zapisz login" compact>
          <div className="field">
            <input name="login" type="text" defaultValue={user.login} aria-label="Login" />
          </div>
        </ActionForm>
      </section>

      <section className="sheet" style={{ padding: "22px 24px" }}>
        <p className="eyebrow">Hasło</p>
        <p className="lead">
          {user.passwordHash
            ? "Zmiana hasła nie wylogowuje urządzeń. Jeśli ktoś obcy dostał się do konta, odłącz je ręcznie wyżej."
            : "To konto nie ma jeszcze hasła, bo założyłeś je przez Google. Ustaw hasło, jeśli chcesz logować się także bez Google."}
        </p>
        <ActionForm
          action={changePassword}
          label={user.passwordHash ? "Zmień hasło" : "Ustaw hasło"}
          compact
        >
          {user.passwordHash ? (
            <div className="field">
              <label htmlFor="current">Dotychczasowe hasło</label>
              <input id="current" name="current" type="password" autoComplete="current-password" />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="next">Nowe hasło</label>
            <input
              id="next"
              name="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="repeat">Powtórz nowe hasło</label>
            <input
              id="repeat"
              name="repeat"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
        </ActionForm>
      </section>
    </main>
  );
}
