"use client";

import { useActionState, useState } from "react";
import { register, startGoogleWithCode, type RegistrationResult } from "./actions";
import { useWords } from "@/components/LanguageProvider";
import { PRIVACY_URL, TERMS_URL } from "@/lib/documents";

const empty: RegistrationResult = {};

/*
  Zgoda na regulamin.

  Musi być przy obu drogach zakładania konta, także przy Google - umowa
  zawiera się w chwili powstania konta, więc dokumenty trzeba przyjąć zanim
  ktokolwiek gdziekolwiek odejdzie. Pole nie jest domyślnie zaznaczone i
  serwer sprawdza je jeszcze raz, bo `required` w przeglądarce da się obejść.
*/
function TermsConsent({ id }: { id: string }) {
  const words = useWords();

  return (
    <div className="field">
      <label
        htmlFor={id}
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
      >
        <input id={id} name="terms" type="checkbox" required style={{ marginTop: 3 }} />
        <span>{words.acceptTerms}</span>
      </label>
      <p className="small" style={{ marginTop: 6, display: "flex", gap: 16 }}>
        <a href={TERMS_URL} target="_blank" rel="noopener">
          {words.footerTerms}
        </a>
        <a href={PRIVACY_URL} target="_blank" rel="noopener">
          {words.footerPrivacy}
        </a>
      </p>
    </div>
  );
}

export function RegistrationForm({
  codeFromLink,
  googleAvailable,
}: {
  codeFromLink: string;
  googleAvailable: boolean;
}) {
  const words = useWords();
  const [state, submitForm, busy] = useActionState(register, empty);
  const [viaGoogle, setViaGoogle] = useState(false);

  return (
    <>
      <form action={submitForm}>
        <div className="field">
          <label htmlFor="code">{words.inviteCode}</label>
          <input
            id="code"
            name="code"
            type="text"
            required
            defaultValue={codeFromLink}
            autoComplete="off"
            placeholder={words.inviteCodePlaceholder}
          />
          {codeFromLink ? (
            <p className="small" style={{ marginTop: 4 }}>
              {words.codeCameFromLink}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="email">{words.emailAddress}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="field">
          <label htmlFor="login">{words.loginOptional}</label>
          <input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            placeholder={words.loginPlaceholder}
          />
          <p className="small" style={{ marginTop: 4 }}>
            {words.loginIsVisible}
          </p>
        </div>

        <div className="field">
          <label htmlFor="password">{words.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="small" style={{ marginTop: 4 }}>{words.atLeastEightChars}</p>
        </div>

        <div className="field">
          <label htmlFor="passwordRepeat">{words.repeatPassword}</label>
          <input
            id="passwordRepeat"
            name="passwordRepeat"
            type="password"
            required
            autoComplete="new-password"
          />
        </div>

        <TermsConsent id="terms" />

        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? words.creatingAccount : words.createAccountButton}
        </button>
      </form>

      {/* Odpowiedź pod przyciskiem - nad polami spychała cały formularz w dół
          w chwili wysłania. */}
      {state.error ? (
        <p className="error" style={{ margin: "14px 0 0 0" }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="success" style={{ margin: "14px 0 0 0" }}>
          {state.success} <a href="/signin">{words.goToSignIn}</a>
        </p>
      ) : null}

      {googleAvailable ? (
        <>
          <hr className="divider" />

          {!viaGoogle ? (
            <button type="button" onClick={() => setViaGoogle(true)} style={{ width: "100%" }}>
              {words.preferGoogle}
            </button>
          ) : (
            <GoogleForm codeFromLink={codeFromLink} />
          )}
        </>
      ) : null}
    </>
  );
}

function GoogleForm({ codeFromLink }: { codeFromLink: string }) {
  const words = useWords();
  const [state, submitForm, busy] = useActionState(startGoogleWithCode, empty);

  return (
    <div>
      <p className="eyebrow">{words.googleAccountEyebrow}</p>
      <p className="small" style={{ marginBottom: 12 }}>
        {words.googleAccountAbout}
      </p>

      <form action={submitForm}>
        <div className="field">
          <label htmlFor="googleCode">{words.inviteCode}</label>
          <input
            id="googleCode"
            name="code"
            type="text"
            required
            defaultValue={codeFromLink}
            autoComplete="off"
            placeholder={words.inviteCodePlaceholder}
          />
        </div>

        <TermsConsent id="googleTerms" />

        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? words.checkingCode : words.onWithGoogle}
        </button>
      </form>

      {state.error ? (
        <p className="error" style={{ margin: "14px 0 0 0" }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
