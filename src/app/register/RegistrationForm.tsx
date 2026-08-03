"use client";

import { useActionState, useState } from "react";
import { parkCodeForGoogle, register, type RegistrationResult } from "./actions";

const empty: RegistrationResult = {};

export function RegistrationForm({ codeFromLink }: { codeFromLink: string }) {
  const [state, submitForm, busy] = useActionState(register, empty);
  const [viaGoogle, setViaGoogle] = useState(false);
  const [googleState, setGoogleState] = useState<RegistrationResult>({});

  return (
    <>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? (
        <p className="success">
          {state.success} <a href="/signin">Przejdź do logowania</a>
        </p>
      ) : null}

      <form action={submitForm}>
        <div className="field">
          <label htmlFor="code">Kod zaproszenia</label>
          <input
            id="code"
            name="code"
            type="text"
            required
            defaultValue={codeFromLink}
            autoComplete="off"
            placeholder="np. KAJET-7QX2-9MB4"
          />
          {codeFromLink ? (
            <p className="small" style={{ marginTop: 4 }}>
              Kod wpisał się sam z odnośnika, który dostałeś.
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="email">Adres e-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="field">
          <label htmlFor="login">Login (możesz zostawić pusty)</label>
          <input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            placeholder="wymyślimy go z adresu"
          />
          <p className="small" style={{ marginTop: 4 }}>
            Login widzą osoby, którym udostępnisz notatkę.
          </p>
        </div>

        <div className="field">
          <label htmlFor="password">Hasło</label>
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

        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Zakładam konto..." : "Załóż konto"}
        </button>
      </form>

      <hr className="divider" />

      {!viaGoogle ? (
        <button type="button" onClick={() => setViaGoogle(true)} style={{ width: "100%" }}>
          Wolę konto Google
        </button>
      ) : (
        <GoogleForm codeFromLink={codeFromLink} state={googleState} setState={setGoogleState} />
      )}
    </>
  );
}

function GoogleForm({
  codeFromLink,
  state,
  setState,
}: {
  codeFromLink: string;
  state: RegistrationResult;
  setState: (result: RegistrationResult) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <p className="eyebrow">Konto Google</p>
      <p className="small" style={{ marginBottom: 12 }}>
        Podaj kod i adres, na który masz konto Google. Potem zaloguj się przyciskiem Google.
      </p>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const data = new FormData(event.currentTarget);
          const result = await parkCodeForGoogle(
            String(data.get("code") ?? ""),
            String(data.get("email") ?? ""),
          );
          setState(result);
          setBusy(false);
        }}
      >
        <div className="field">
          <label htmlFor="googleCode">Kod zaproszenia</label>
          <input id="googleCode" name="code" type="text" required defaultValue={codeFromLink} />
        </div>
        <div className="field">
          <label htmlFor="googleEmail">Adres konta Google</label>
          <input id="googleEmail" name="email" type="email" required />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Zapisuję kod..." : "Przyjmij kod"}
        </button>
      </form>

      {state.success ? (
        <a
          href="/api/auth/signin/google"
          className="button primary"
          style={{ width: "100%", marginTop: 12 }}
        >
          Zaloguj się przez Google
        </a>
      ) : null}
    </div>
  );
}
