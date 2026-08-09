"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyableLink";
import { useWords } from "@/components/LanguageProvider";
import { Icon } from "@/components/Icon";

type ActionResult = {
  error?: string;
  success?: string;
  /** A value (token, code, link) shown with a copy button next to the success message. */
  copyable?: { value: string; label?: string };
};
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  label,
  busyLabel,
  primary,
  danger,
  compact,
  confirmation,
  icon,
  iconOnly,
  on,
  quiet,
  toast,
  children,
}: {
  action: Action;
  label: string;
  busyLabel?: string;
  primary?: boolean;
  danger?: boolean;
  compact?: boolean;
  confirmation?: string;
  /** Nazwa ikony z fonts.google.com/icons, na przykład "delete". */
  icon?: string;
  /** Sam znak, bez podpisu. Podpis idzie wtedy na tytuł i do czytnika ekranu. */
  iconOnly?: boolean;
  /** Stan włączony - na przykład gwiazdka na notatce już ulubionej. */
  on?: boolean;
  /**
   * Odpowiedź serwera drobnym pismem pod przyciskiem zamiast ramki na całą
   * szerokość. Do ciasnych miejsc, jak kolumna w spisie notatek.
   */
  quiet?: boolean;
  /**
   * Odpowiedź serwera jako dymek przy dolnej krawędzi ekranu. Nie stoi
   * w układzie strony, więc nie rozpycha formularzy obok - jak kolumny
   * ustawień konta w panelu administratora.
   */
  toast?: boolean;
  children?: React.ReactNode;
}) {
  const words = useWords();
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});
  const [toastShown, setToastShown] = useState(false);

  // Pytanie o zgodę we własnym oknie zamiast window.confirm - przeglądarkowe
  // okno podpisuje pytanie adresem strony i wygląda obco. Zgoda z okna ustawia
  // znacznik i ponawia wysłanie formularza, już bez pytania.
  const form = useRef<HTMLFormElement>(null);
  const approved = useRef(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!toast) return;
    if (!state.error && !state.success) return;
    setToastShown(true);
    // Odpowiedź z wartością do skopiowania zostaje, aż człowiek ją zamknie.
    if (state.copyable) return;
    const timer = setTimeout(() => setToastShown(false), 6000);
    return () => clearTimeout(timer);
  }, [toast, state]);

  const classes = [
    "",
    primary ? "primary" : "",
    danger ? "danger" : "",
    compact ? "compact" : "",
    iconOnly ? "icon-only" : "",
    on ? "on" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const feedback = toast ? (
    toastShown && (state.error || state.success) ? (
      <div className={`action-toast${state.error ? " bad" : ""}`} role="status">
        <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {state.error ?? state.success}
          {state.copyable ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span className="mono">{state.copyable.value}</span>
              <CopyButton value={state.copyable.value} label={state.copyable.label ?? words.copyWord} />
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="toast-close"
          aria-label={words.close}
          onClick={() => setToastShown(false)}
        >
          ×
        </button>
      </div>
    ) : null
  ) : quiet ? (
    <>
      {state.error ? <span className="action-note bad">{state.error}</span> : null}
      {state.success ? <span className="action-note">{state.success}</span> : null}
    </>
  ) : (
    <>
      {state.error ? (
        <p className="error" style={{ margin: "12px 0 0 0" }}>
          {state.error}
        </p>
      ) : null}
      {/* We keep the line breaks, because some answers are a printed token or
          a link given on its own line. */}
      {state.success ? (
        <div
          className="success"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "12px 0 0 0" }}
        >
          {state.success}
          {state.copyable ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span className="mono">{state.copyable.value}</span>
              <CopyButton
                value={state.copyable.value}
                label={state.copyable.label ?? words.copyWord}
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <form
      ref={form}
      action={submit}
      className={quiet ? "quiet-action" : undefined}
      onSubmit={(event) => {
        if (confirmation && !approved.current) {
          event.preventDefault();
          setAsking(true);
          return;
        }
        approved.current = false;
      }}
    >
      {asking && confirmation ? (
        <ConfirmDialog
          question={confirmation}
          confirmLabel={label}
          danger={danger}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            approved.current = true;
            form.current?.requestSubmit();
          }}
        />
      ) : null}
      {children}
      <button
        type="submit"
        className={classes}
        disabled={busy}
        title={iconOnly ? label : undefined}
        aria-label={iconOnly ? label : undefined}
      >
        {icon ? <Icon name={busy ? "hourglass_top" : icon} filled={on} /> : null}
        {iconOnly ? null : busy ? (busyLabel ?? words.justAMoment) : label}
      </button>
      {/* Odpowiedź serwera stoi POD przyciskiem w każdym trybie. Nad polami
          wskakiwała między nagłówek a formularz i spychała pola razem z
          przyciskiem w dół - na stronie hasła o wysokość czterech linijek,
          dokładnie spod palca, który właśnie kliknął. */}
      {feedback}
    </form>
  );
}
