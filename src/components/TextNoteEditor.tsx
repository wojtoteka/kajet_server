"use client";

import { useActionState, useState } from "react";

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
  const [body, setBody] = useState(markdown);
  const [showPreview, setShowPreview] = useState(false);

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

      <div className="row-spread" style={{ marginBottom: 8 }}>
        <label htmlFor="markdown" style={{ margin: 0 }}>
          Treść (Markdown)
        </label>
        <button
          type="button"
          className="compact"
          onClick={() => setShowPreview((value) => !value)}
        >
          {showPreview ? "Edycja" : "Podgląd roboczy"}
        </button>
      </div>

      {showPreview ? (
        <div
          className="sheet-ruled"
          style={{
            paddingBlock: 16,
            paddingInlineEnd: 18,
            marginBottom: 14,
            minHeight: 280,
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-body)",
            lineHeight: 1.5,
          }}
        >
          {body.trim() ? body : <span className="small">Pusto — wróć do edycji i napisz coś.</span>}
          <input type="hidden" name="markdown" value={body} />
        </div>
      ) : (
        <div className="field">
          <textarea
            id="markdown"
            name="markdown"
            value={body}
            onChange={(event) => setBody(event.target.value)}
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
            Zapis idzie tą samą drogą co synchronizacja z aplikacji — przy rozbieżności wersji
            dostaniesz komunikat zamiast nadpisać cudzą zmianę. {body.length.toLocaleString("pl-PL")}{" "}
            znaków.
          </p>
        </div>
      )}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}
