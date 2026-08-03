"use client";

import { useActionState, useState } from "react";

type SaveResult = { error?: string; success?: string };
type SaveAction = (previous: SaveResult, data: FormData) => Promise<SaveResult>;

type RunResult = {
  error?: string;
  output?: string;
  errors?: string;
  exitCode?: number | null;
  interrupted?: boolean;
  timeMs?: number;
  disabled?: string;
};
type RunAction = (previous: RunResult, data: FormData) => Promise<RunResult>;

export function CodeNotePanel({
  saveAction,
  runAction,
  noteId,
  version,
  title,
  language,
  source,
  languages,
  canRun,
  runnerHint,
  submitLabel,
}: {
  saveAction: SaveAction;
  runAction: RunAction;
  noteId?: string;
  version?: number;
  title: string;
  language: string;
  source: string;
  languages: { id: string; namePl: string }[];
  canRun: boolean;
  runnerHint: string;
  submitLabel: string;
}) {
  const [saveState, saveSubmit, saveBusy] = useActionState<SaveResult, FormData>(saveAction, {});
  const [runState, runSubmit, runBusy] = useActionState<RunResult, FormData>(runAction, {});
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [currentSource, setCurrentSource] = useState(source);

  return (
    <div className="column" style={{ gap: 20 }}>
      <form action={saveSubmit} className="sheet" style={{ padding: "22px 24px" }}>
        {saveState.error ? <p className="error">{saveState.error}</p> : null}
        {saveState.success ? <p className="success">{saveState.success}</p> : null}

        {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
        {version != null ? (
          <input type="hidden" name="baseVersion" value={String(version)} />
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 180px",
            gap: 14,
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="code-title">Tytuł / nazwa pliku</label>
            <input
              id="code-title"
              name="title"
              type="text"
              defaultValue={title}
              maxLength={300}
              placeholder="np. zadanie1.py"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="code-language">Język</label>
            <select
              id="code-language"
              name="language"
              value={currentLanguage}
              onChange={(event) => setCurrentLanguage(event.target.value)}
            >
              {languages.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.namePl}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="code-source">Kod</label>
          <textarea
            id="code-source"
            name="source"
            value={currentSource}
            onChange={(event) => setCurrentSource(event.target.value)}
            rows={18}
            spellCheck={false}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.45,
              resize: "vertical",
              minHeight: 280,
            }}
          />
        </div>

        <div className="row">
          <button type="submit" className="primary" disabled={saveBusy}>
            {saveBusy ? "Zapisuję..." : submitLabel}
          </button>
        </div>
      </form>

      <section className="sheet" style={{ padding: "22px 24px" }}>
        <p className="eyebrow">Uruchomienie</p>
        <h2 style={{ marginBottom: 8 }}>Uruchom na serwerze</h2>
        <p className="lead" style={{ marginBottom: 14 }}>
          {runnerHint}
        </p>

        {!canRun ? (
          <p className="error" style={{ marginBottom: 0 }}>
            Uruchamianie niedostępne.
          </p>
        ) : (
          <form action={runSubmit}>
            <input type="hidden" name="language" value={currentLanguage} />
            <input type="hidden" name="code" value={currentSource} />

            <div className="field">
              <label htmlFor="code-stdin">Wejście standardowe (opcjonalnie)</label>
              <textarea
                id="code-stdin"
                name="input"
                rows={3}
                placeholder="Dane na stdin…"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>

            <button type="submit" className="primary" disabled={runBusy}>
              {runBusy ? "Liczy..." : "Uruchom"}
            </button>
          </form>
        )}

        {runState.error ? <p className="error">{runState.error}</p> : null}

        {runState.output != null || runState.errors ? (
          <div style={{ marginTop: 16 }}>
            <p className="small" style={{ marginBottom: 6 }}>
              {runState.timeMs != null ? `${runState.timeMs} ms` : null}
              {runState.exitCode != null ? ` · kod wyjścia ${runState.exitCode}` : null}
              {runState.interrupted ? " · przerwane (limit czasu)" : null}
            </p>
            {runState.output ? (
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  background: "var(--desk)",
                  padding: "14px 16px",
                  borderRadius: "var(--radius)",
                  borderLeft: "2px solid var(--accent)",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {runState.output}
              </pre>
            ) : null}
            {runState.errors ? (
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  background: "var(--desk)",
                  padding: "14px 16px",
                  borderRadius: "var(--radius)",
                  borderLeft: "2px solid var(--warning)",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  marginTop: 10,
                }}
              >
                {runState.errors}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
