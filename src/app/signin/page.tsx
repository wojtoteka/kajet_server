import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { googleWorks } from "@/lib/settings";
import { KajetMark } from "@/components/KajetMark";

export const metadata = { title: "Zaloguj się — Kajet" };

const MESSAGES: Record<string, string> = {
  blocked: "To konto zostało zablokowane. Napisz do administratora.",
  "code-required":
    "Na ten adres nie ma jeszcze konta. Konto zakłada się na kod od administratora, na stronie rejestracji.",
  CredentialsSignin: "Zły adres albo złe hasło.",
  OAuthAccountNotLinked:
    "Ten adres jest już używany przy logowaniu hasłem. Zaloguj się hasłem, a potem możesz powiązać Google.",
  Configuration:
    "Logowanie przez Google nie jest poprawnie ustawione na serwerze (klucze, adres powrotu albo AUTH_URL). Napisz do administratora albo zaloguj się hasłem.",
  AccessDenied: "Google nie pozwoliło na logowanie, albo to konto nie ma dostępu.",
  OAuthSignin: "Nie udało się rozpocząć logowania przez Google. Spróbuj jeszcze raz.",
  OAuthCallback:
    "Google nie dokończyło logowania. Sprawdź, czy wracasz na ten sam adres strony (https), albo spróbuj jeszcze raz. Jeśli problem wraca — to zwykle zły adres powrotu w konsoli Google albo brak AUTH_URL.",
  OAuthCreateAccount: "Nie udało się założyć konta przez Google. Spróbuj jeszcze raz albo załóż konto hasłem na kodzie zaproszenia.",
  Callback: "Logowanie zostało przerwane. Spróbuj jeszcze raz.",
  Verification: "Odnośnik do logowania wygasł albo został już użyty.",
  Default: "Nie udało się zalogować. Spróbuj jeszcze raz.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/library");

  const params = await searchParams;
  const message = params.error
    ? (MESSAGES[params.error] ?? MESSAGES.Default)
    : null;

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">Wejście</p>
        <h1 style={{ marginBottom: 8 }}>Zaloguj się</h1>
        <p className="lead">
          Po zalogowaniu zobaczysz notatki z tabletu i będziesz mógł je tutaj poprawiać.
        </p>

        {message ? <p className="error">{message}</p> : null}

        <form
          action={async (data: FormData) => {
            "use server";
            await signIn("credentials", {
              email: String(data.get("email") ?? ""),
              password: String(data.get("password") ?? ""),
              redirectTo: params.next || "/library",
            });
          }}
        >
          <div className="field">
            <label htmlFor="email">Adres e-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="password">Hasło</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="primary" style={{ width: "100%" }}>
            Zaloguj się
          </button>
        </form>

        {googleWorks() ? (
          <>
            <hr className="divider" />
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: params.next || "/library" });
              }}
            >
              <button type="submit" style={{ width: "100%" }}>
                Zaloguj się przez Google
              </button>
            </form>
            <p className="small" style={{ marginTop: 10 }}>
              Google działa tylko w przeglądarce. W aplikacji na tablecie używasz hasła albo
              logowania przez token ze strony konta.
            </p>
          </>
        ) : null}

        <p className="small" style={{ marginTop: 18 }}>
          <Link href="/password">Nie pamiętam hasła</Link>
        </p>
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        Nie masz konta? <Link href="/register">Załóż je na kod zaproszenia</Link>
      </p>
    </main>
  );
}
