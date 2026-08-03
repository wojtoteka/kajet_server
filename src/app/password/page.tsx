import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mailWorks } from "@/lib/settings";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import { requestLink, setNewPassword } from "./actions";

export const metadata = { title: "Nowe hasło — Kajet" };

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await isTokenValid(token) : false;

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        {token && valid ? (
          <>
            <p className="eyebrow">Nowe hasło</p>
            <h1 style={{ marginBottom: 8 }}>Ustaw nowe hasło</h1>
            <p className="lead">
              Po zmianie wylogujemy wszystkie urządzenia, więc zaloguj się na nowo także
              w aplikacji na tablecie.
            </p>

            <ActionForm
              action={setNewPassword}
              label="Zapisz nowe hasło"
              busyLabel="Zapisuję..."
              primary
            >
              <input type="hidden" name="token" value={token} />
              <div className="field">
                <label htmlFor="password">Nowe hasło</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="small" style={{ marginTop: 4 }}>Co najmniej osiem znaków.</p>
              </div>
              <div className="field">
                <label htmlFor="passwordRepeat">Powtórz hasło</label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </ActionForm>
          </>
        ) : token ? (
          <>
            <p className="eyebrow">Odnośnik</p>
            <h1 style={{ marginBottom: 8 }}>Ten odnośnik już nie działa</h1>
            <p className="lead">
              Odnośnik jest ważny przez godzinę i działa jeden raz. Poproś o nowy formularzem
              poniżej.
            </p>
            <LinkForm />
          </>
        ) : (
          <>
            <p className="eyebrow">Hasło</p>
            <h1 style={{ marginBottom: 8 }}>Nie pamiętam hasła</h1>
            <p className="lead">
              Podaj adres, na który masz konto. Wyślemy odnośnik do ustawienia nowego hasła.
            </p>
            {!mailWorks() ? (
              <p className="error">
                Poczta na tym serwerze nie jest ustawiona, więc wiadomość nie wyjdzie. Poproś
                administratora o pomoc.
              </p>
            ) : null}
            <LinkForm />
          </>
        )}
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        <Link href="/signin">Wróć do logowania</Link>
      </p>
    </main>
  );
}

function LinkForm() {
  return (
    <ActionForm action={requestLink} label="Wyślij odnośnik" busyLabel="Wysyłam..." primary>
      <div className="field">
        <label htmlFor="email">Adres e-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
    </ActionForm>
  );
}

async function isTokenValid(token: string): Promise<boolean> {
  const entry = await prisma.verificationToken.findUnique({ where: { token } });
  return Boolean(entry && entry.identifier.startsWith("password:") && entry.expires > new Date());
}
