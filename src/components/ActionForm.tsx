"use client";

import { useActionState } from "react";

type ActionResult = { error?: string; success?: string };
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  label,
  busyLabel,
  primary,
  danger,
  compact,
  confirmation,
  children,
}: {
  action: Action;
  label: string;
  busyLabel?: string;
  primary?: boolean;
  danger?: boolean;
  compact?: boolean;
confirmation?: string;
  children?: React.ReactNode;
}) {
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});

  const classes = ["", primary ? "primary" : "", danger ? "danger" : "", compact ? "compact" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {state.error ? <p className="error">{state.error}</p> : null}
      {/* We keep the line breaks, because some answers are a printed token or
          a link given on its own line. */}
      {state.success ? (
        <p className="success" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {state.success}
        </p>
      ) : null}
      {children}
      <button type="submit" className={classes} disabled={busy}>
        {busy ? (busyLabel ?? "Chwileczkę...") : label}
      </button>
    </form>
  );
}
