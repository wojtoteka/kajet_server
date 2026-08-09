"use client";

import { useActionState, useState } from "react";
import { register, startGoogleWithCode, type RegistrationResult } from "./actions";
import { useWords } from "@/components/LanguageProvider";

const empty: RegistrationResult = {};

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
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? (
        <p className="success">
          {state.success} <a href="/signin">{words.goToSignIn}</a>
        </p>
      ) : null}

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

        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? words.creatingAccount : words.createAccountButton}
        </button>
      </form>

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

      {state.error ? <p className="error">{state.error}</p> : null}

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
        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? words.checkingCode : words.onWithGoogle}
        </button>
      </form>
    </div>
  );
}
