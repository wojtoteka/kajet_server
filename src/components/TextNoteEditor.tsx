"use client";

import { useActionState } from "react";

type ActionResult = { error?: string; success?: string };
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

export function TextNoteEditor({
  action,
  noteId,
  version,
  title,
  markdown,
  submitLabel,
}: {
  action: Action;
  noteId?: string;
  version?: number;
  title: string;
  markdown: string;
  submitLabel: string;
}) {
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});

  return (
    <form action={submit} className="sheet" style={{ padding: "22px 24px" }}>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}

      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      {version != null ? (
        <input type="hidden" name="baseVersion" value={String(version)} />
      ) : null}

      <div className="field">
        <label htmlFor="title">Tytuł</label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={title}
          maxLength={300}
          placeholder="Bez nazwy"
        />
      </div>

      <div className="field">
        <label htmlFor="markdown">Treść (Markdown)</label>
        <textarea
          id="markdown"
          name="markdown"
          defaultValue={markdown}
          rows={18}
          style={{
            width: "100%",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            lineHeight: 1.45,
            resize: "vertical",
            minHeight: 280,
          }}
        />
        <p className="small" style={{ marginTop: 4 }}>
          Zapis idzie tą samą drogą co synchronizacja z tabletu — przy rozbieżności wersji
          dostaniesz komunikat zamiast nadpisać cudzą zmianę.
        </p>
      </div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}
