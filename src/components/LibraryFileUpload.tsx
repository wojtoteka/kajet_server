"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Result = { error?: string; success?: string; noteId?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

/**
 * Jeden przycisk w pasku biblioteki: systemowy wybór pliku i automatyczne
 * wysłanie po wyborze. Pole pliku jest ukryte wizualnie, ale podpis i stan są
 * dostępne dla czytnika ekranu.
 */
export function LibraryFileUpload({
  action,
  folderId,
  accept,
  label,
  busyLabel,
  hint,
  openLabel,
  closeLabel,
}: {
  action: Action;
  folderId?: string;
  accept: string;
  label: string;
  busyLabel: string;
  hint: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [state, submit, busy] = useActionState<Result, FormData>(action, {});
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!state.error && !state.success) return;
    setFeedbackVisible(true);
    // Ta sama nazwa musi dać się wskazać ponownie po poprawieniu przyczyny
    // błędu. Przeglądarka nie wywoła `change`, dopóki pole pamięta stary plik.
    if (input.current) input.current.value = "";
  }, [state]);

  return (
    <>
      <form ref={form} action={submit} style={{ display: "inline-flex" }}>
        {folderId ? <input type="hidden" name="folderId" value={folderId} /> : null}
        <input
          ref={input}
          id={inputId}
          name="file"
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(event) => {
            if (!event.currentTarget.files?.length) return;
            setFeedbackVisible(false);
            form.current?.requestSubmit();
          }}
        />
        {/* Ta sama klasa co sąsiednie Linki, także w mobilnej siatce. */}
        <button
          type="button"
          className="button compact"
          disabled={busy}
          title={hint}
          aria-controls={inputId}
          onClick={() => input.current?.click()}
        >
          <Icon name={busy ? "hourglass_top" : "upload"} size={18} />
          {busy ? busyLabel : label}
        </button>
        {/* requestSubmit ma wtedy jednoznaczny przycisk nawet w starszym WebView. */}
        {/*
          Globalne `button { display: inline-flex }` ma pierwszeństwo przed
          przeglądarkowym [hidden]. Jawne display:none usuwało pusty prostokąt,
          który dodatkowo rozciągał właściwy przycisk uploadu do 48 px.
        */}
        <button
          type="submit"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: "none" }}
        />
      </form>

      {feedbackVisible && (state.error || state.success) ? (
        <div className={`action-toast${state.error ? " bad" : ""}`} role="status">
          <span>
            {state.error ?? state.success}
            {state.noteId ? (
              <Link
                className="button compact"
                href={`/note/${state.noteId}`}
                style={{ marginInlineStart: 10 }}
              >
                {openLabel}
              </Link>
            ) : null}
          </span>
          <button
            type="button"
            className="toast-close"
            aria-label={closeLabel}
            onClick={() => setFeedbackVisible(false)}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
