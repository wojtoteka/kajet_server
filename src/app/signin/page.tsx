import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { auth, signIn } from "@/lib/auth";
import { googleWorks } from "@/lib/settings";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await currentWords()).metaSignIn };
}

function messages(words: Words): Record<string, string> {
  return {
    blocked: words.signInBlocked,
    "code-required": words.signInCodeRequired,
    CredentialsSignin: words.wrongCredentials,
    "too-many-attempts": words.tooManyAttempts,
    OAuthAccountNotLinked: words.signInNotLinked,
    Configuration: words.signInConfiguration,
    AccessDenied: words.signInAccessDenied,
    OAuthSignin: words.signInOAuthStart,
    OAuthCallback: words.signInOAuthCallback,
    OAuthCreateAccount: words.signInOAuthCreate,
    Callback: words.signInInterrupted,
    Verification: words.signInVerification,
    Default: words.signInDefault,
  };
}

/** Powody, dla których ktoś tu właśnie wrócił - to nie są błędy. */
function farewells(words: Words): Record<string, string> {
  return {
    wszedzie: words.byeEverywhere,
    haslo: words.byePasswordChanged,
    "haslo-nowe": words.byePasswordSet,
    "konto-skasowane": words.byeAccountDeleted,
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    code?: string;
    next?: string;
    wylogowano?: string;
  }>;
}) {
  const params = await searchParams;
  const words = await currentWords();
  const session = await auth();
  /*
    Samo `user.id` nie wystarczy. Konto zablokowane albo wylogowane wszędzie ma
    ciasteczko, które nadal niesie identyfikator, ale nie otwiera już niczego -
    odesłanie do biblioteki wracałoby tu z powrotem, w kółko.
  */
  if (session?.user?.id && !session.user.blocked) {
    const next = params.next?.startsWith("/") ? params.next : "/library";
    redirect(next);
  }

  // Auth.js dokłada `code` przy błędach z providera - stąd wiadomo, że to
  // zapora po pięciu próbach, a nie zwyczajnie złe hasło.
  /*
    Dwa najczęstsze komunikaty idą ze słownika, więc mówią w wybranym języku.
    Reszta (błędy Google, wygasłe odnośniki) czeka jeszcze na przeniesienie
    i zostaje po polsku - lepiej to niż pusty ekran bez wyjaśnienia.
  */
  const reasons = messages(words);
  const message = params.error
    ? (reasons[params.code ?? ""] ?? reasons[params.error] ?? reasons.Default)
    : null;

  const partings = farewells(words);
  const goodbye = params.wylogowano
    ? (partings[params.wylogowano] ?? partings.wszedzie)
    : null;

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.signInEntrance}</p>
        <h1 style={{ marginBottom: 8 }}>{words.signInTitle}</h1>
        <p className="lead">
          {words.signInLead}
        </p>

        {/* Pożegnanie (wylogowano, hasło zmienione) może stać nad formularzem:
            człowiek dopiero tu przyszedł i nic jeszcze nie wpisywał. Błąd
            logowania stoi ZA formularzem - po nieudanej próbie strona wraca
            z polami w tym samym miejscu, zamiast spychać je w dół. */}
        {goodbye ? <p className="success">{goodbye}</p> : null}

        <form
          action={async (data: FormData) => {
            "use server";
            /*
              Nieudane logowanie to u Auth.js rzucony wyjątek. Bez łapania
              wychodzi z akcji jako awaria całej strony ("Application error"),
              więc zamieniamy go z powrotem na adres z powodem - stąd bierze
              się komunikat nad formularzem. Udane logowanie też rzuca
              (przekierowaniem) i ono ma polecieć dalej.
            */
            try {
              await signIn("credentials", {
                email: String(data.get("email") ?? ""),
                password: String(data.get("password") ?? ""),
                redirectTo: params.next || "/library",
              });
            } catch (problem) {
              if (problem instanceof AuthError) {
                const back = new URLSearchParams({ error: problem.type });
                if (problem instanceof CredentialsSignin && problem.code) {
                  back.set("code", problem.code);
                }
                if (params.next) back.set("next", params.next);
                redirect(`/signin?${back.toString()}`);
              }
              throw problem;
            }
          }}
        >
          <div className="field">
            <label htmlFor="email">{words.emailAddress}</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="password">{words.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="primary" style={{ width: "100%" }}>
            {words.signInTitle}
          </button>
        </form>

        {message ? (
          <p className="error" style={{ margin: "14px 0 0 0" }}>
            {message}
          </p>
        ) : null}

        {googleWorks() ? (
          <>
            <hr className="divider" />
            <form
              action={async () => {
                "use server";
                // Ta sama zasada co przy haśle: błąd wraca tu jako komunikat.
                try {
                  await signIn("google", { redirectTo: params.next || "/library" });
                } catch (problem) {
                  if (problem instanceof AuthError) {
                    const back = new URLSearchParams({ error: problem.type });
                    if (params.next) back.set("next", params.next);
                    redirect(`/signin?${back.toString()}`);
                  }
                  throw problem;
                }
              }}
            >
              <button type="submit" style={{ width: "100%" }}>
                {words.signInWithGoogleButton}
              </button>
            </form>
            <p className="small" style={{ marginTop: 10 }}>
              {words.googleInAppHint}
            </p>
          </>
        ) : null}

        <p className="small" style={{ marginTop: 18 }}>
          <Link href="/password">{words.forgotPassword}</Link>
        </p>
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        {words.noAccountAsk} <Link href="/register">{words.registerOnCode}</Link>
      </p>
    </main>
  );
}
