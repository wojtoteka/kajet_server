import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findChallengeByCode } from "@/lib/login-challenge";
import { KajetMark } from "@/components/KajetMark";
import { DeviceApproveForm } from "./DeviceApproveForm";

export const metadata = { title: "Połącz urządzenie — Kajet" };

export default async function DeviceSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = (params.code ?? "").trim();

  if (!code) {
    return (
      <main className="page" style={{ maxWidth: 460 }}>
        <KajetMark />
        <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
          <p className="eyebrow">Aplikacja</p>
          <h1 style={{ marginBottom: 8 }}>Brak kodu</h1>
          <p className="lead">
            Otwórz tę stronę z aplikacji Kajet przyciskiem „Zaloguj przez Google”.
            Bez kodu z aplikacji nie da się połączyć urządzenia.
          </p>
          <p className="small" style={{ marginTop: 18 }}>
            <Link href="/signin">Zwykłe logowanie do panelu</Link>
          </p>
        </div>
      </main>
    );
  }

  const user = await currentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/signin/device?code=${code}`)}`);
  }

  const challenge = await findChallengeByCode(code);
  const expired =
    !challenge ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.status === "REDEEMED";
  const denied = challenge?.status === "DENIED";
  const alreadyApproved =
    challenge?.status === "APPROVED" && challenge.userId === user.id;

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <KajetMark caption={user.login} />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">Aplikacja mobilna</p>
        <h1 style={{ marginBottom: 8 }}>Połącz urządzenie</h1>

        {expired ? (
          <>
            <p className="lead">
              Ten kod logowania wygasł albo został już użyty. Wróć do aplikacji i
              uruchom logowanie jeszcze raz.
            </p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">Moje notatki</Link>
            </p>
          </>
        ) : denied ? (
          <>
            <p className="lead">To logowanie zostało wcześniej odrzucone.</p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">Moje notatki</Link>
            </p>
          </>
        ) : alreadyApproved ? (
          <>
            <p className="lead">
              Urządzenie „{challenge.device}” jest już zatwierdzone. Wróć do
              aplikacji Kajet — powinna się zalogować sama.
            </p>
            <p style={{ marginTop: 16 }}>
              <a className="button primary" href={`kajet://auth?code=${encodeURIComponent(code)}`}>
                Otwórz aplikację
              </a>
            </p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">Albo zostań w panelu</Link>
            </p>
          </>
        ) : (
          <>
            <p className="lead">
              Aplikacja Kajet na urządzeniu „{challenge?.device ?? "…"}” prosi o
              dostęp do Twojego konta <strong>{user.login}</strong> ({user.email}).
              Potwierdź, jeśli to Ty uruchomiłeś logowanie.
            </p>
            <DeviceApproveForm code={code} device={challenge?.device ?? "Urządzenie"} />
          </>
        )}
      </div>
    </main>
  );
}
