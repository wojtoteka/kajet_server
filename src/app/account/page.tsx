import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize, quotaState } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import {
  revokeDevice,
  revokeAllDevices,
  issueAppToken,
  changePassword,
  changeOwnLogin,
  logOut,
} from "./actions";

export const metadata = { title: "Moje konto — Kajet" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account");

  const [devices, storage, noteCount, googleLinked] = await Promise.all([
    prisma.appToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    quotaState(user.id),
    prisma.note.count({ where: { ownerId: user.id, deletedAt: null } }),
    prisma.account.findFirst({
      where: { userId: user.id, provider: "google" },
      select: { providerAccountId: true },
    }),
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
          <form action={logOut}>
            <button type="submit" className="compact danger">
              Wyloguj się
            </button>
          </form>
        </div>
      </div>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Profil</p>
        <h2 style={{ marginBottom: 8 }}>{user.login}</h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 16px",
            margin: 0,
          }}
        >
          <dt className="small" style={{ margin: 0 }}>
            Adres e-mail
          </dt>
          <dd style={{ margin: 0 }}>{user.email}</dd>
          <dt className="small" style={{ margin: 0 }}>
            Rola
          </dt>
          <dd style={{ margin: 0 }}>{user.role === "ADMIN" ? "Administrator" : "Użytkownik"}</dd>
          <dt className="small" style={{ margin: 0 }}>
            Logowanie na stronie
          </dt>
          <dd style={{ margin: 0 }}>
            {[
              user.passwordHash ? "hasło" : null,
              googleLinked ? "Google" : null,
              !user.passwordHash && !googleLinked ? "sesja (bez hasła)" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </dd>
          <dt className="small" style={{ margin: 0 }}>
            Ostatnie logowanie
          </dt>
          <dd style={{ margin: 0 }}>
            {user.lastSignInAt
              ? user.lastSignInAt.toLocaleString("pl-PL")
              : "jeszcze nie zanotowane"}
          </dd>
          <dt className="small" style={{ margin: 0 }}>
            Konto od
          </dt>
          <dd style={{ margin: 0 }}>{user.createdAt.toLocaleDateString("pl-PL")}</dd>
        </dl>
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href="/password">Nie pamiętam hasła</Link>
          {" · "}
          <Link href="/library">Lista notatek</Link>
        </p>
      </section>

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
        <p className="eyebrow">Tokeny urządzeń</p>
        <h2 style={{ marginBottom: 8 }}>Logowanie przez token</h2>
        <p className="lead" style={{ marginBottom: 16 }}>
          Zwykle w aplikacji mobilnej wystarczy adres e-mail i hasło. Token przydaje się, gdy
          konto założyłeś przez Google i nie masz jeszcze hasła, albo gdy wolisz nie wpisywać
          hasła na cudzym urządzeniu. To nie jest logowanie Google w aplikacji — wklejasz token
          ze strony konta.
        </p>

        <ActionForm action={issueAppToken} label="Wydaj token" busyLabel="Wydaję...">
          <div className="field">
            <label htmlFor="device">Nazwa urządzenia</label>
            <input id="device" name="device" type="text" placeholder="np. telefon, tablet, laptop" />
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
                    <th style={{ width: 140 }} />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <strong>{device.device}</strong>
                        <p className="small" style={{ margin: "2px 0 0 0" }}>
                          wydany {device.createdAt.toLocaleDateString("pl-PL")}
                        </p>
                      </td>
                      <td className="small">
                        {device.lastUsedAt
                          ? device.lastUsedAt.toLocaleString("pl-PL")
                          : "jeszcze nie użyty"}
                      </td>
                      <td>
                        <ActionForm
                          action={revokeDevice}
                          label="Unieważnij"
                          compact
                          danger
                          confirmation="Unieważnić ten token? Aplikacja na tym urządzeniu poprosi o ponowne zalogowanie."
                        >
                          <input type="hidden" name="id" value={device.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16 }}>
              <ActionForm
                action={revokeAllDevices}
                label="Unieważnij wszystkie tokeny"
                compact
                danger
                confirmation="Unieważnić wszystkie tokeny? Każde urządzenie będzie musiało zalogować się od nowa."
              />
            </div>
          </>
        ) : (
          <p className="small" style={{ marginTop: 16 }}>
            Nie ma jeszcze żadnego tokenu. Wydaj jeden, jeśli logujesz się w aplikacji bez hasła.
          </p>
        )}
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

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">Hasło</p>
        <p className="lead">
          {user.passwordHash
            ? "Zmiana hasła nie wylogowuje urządzeń. Jeśli ktoś obcy dostał się do konta, unieważnij jego token wyżej."
            : "To konto nie ma jeszcze hasła (zakładane przez Google). Ustaw hasło, jeśli chcesz logować się w aplikacji mobilnej adresem i hasłem zamiast tokenem."}
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

      <section className="sheet" style={{ padding: "22px 24px" }}>
        <p className="eyebrow">Sesja w przeglądarce</p>
        <p className="lead" style={{ marginBottom: 12 }}>
          Wylogowanie zamyka sesję w przeglądarce. Tokeny urządzeń zostają ważne, dopóki ich
          nie unieważnisz wyżej.
        </p>
        <form action={logOut}>
          <button type="submit" className="danger">
            Wyloguj się ze strony
          </button>
        </form>
      </section>
    </main>
  );
}
