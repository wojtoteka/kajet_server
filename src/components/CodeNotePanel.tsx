"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useWords } from "@/components/LanguageProvider";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/components/useAutosave";
import { useSavedNote } from "@/components/useSavedNote";

type SaveResult = { error?: string; success?: string; version?: number; noteId?: string };
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
  autoSave = true,
  submitLabel,
}: {
  saveAction: SaveAction;
  runAction: RunAction;
  noteId?: string;
  version?: number;
  title: string;
  language: string;
  source: string;
  languages: { id: string; namePl: string; nameEn?: string; preview?: boolean }[];
  canRun: boolean;
  runnerHint: string;
  /** Ustawienie konta: plik zapisuje się sam po pauzie w pisaniu. */
  autoSave?: boolean;
  submitLabel: string;
}) {
  const words = useWords();
  const [saveState, saveSubmit, saveBusy] = useActionState<SaveResult, FormData>(saveAction, {});
  const [runState, runSubmit, runBusy] = useActionState<RunResult, FormData>(runAction, {});
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [currentSource, setCurrentSource] = useState(source);
  const [noteTitle, setNoteTitle] = useState(title);

  /*
    Spis do wyboru. Plik przyniesiony z tabletu może mieć język, którego ten
    serwer nie uruchamia (na przykład Kotlin albo zwykły tekst) - dopisujemy go
    wtedy na wierzch, bo puste pole „Język" wyglądałoby jak zgubione ustawienie
    i pierwszy zapis podmieniłby je na cudze.
  */
  const choices = languages.some((entry) => entry.id === currentLanguage)
    ? languages
    : [{ id: currentLanguage, namePl: currentLanguage }, ...languages];

  // Język, którego się nie liczy, tylko ogląda (HTML). Zamiast Dockera dostaje
  // podgląd strony.
  const previewLanguage = languages.some(
    (entry) => entry.id === currentLanguage && entry.preview,
  );

  // Autozapis jak w aplikacji: kod zapisuje się sam po pauzie w pisaniu.
  // Nowy plik zakłada pierwszy zapis, gdy tylko jest w nim cokolwiek.
  const formRef = useRef<HTMLFormElement | null>(null);
  const saved = useSavedNote({ noteId, version, state: saveState });
  const autosaves = Boolean(saved.noteId) || currentSource.trim().length > 0;
  const { dirty, markSent } = useAutosave({
    formRef,
    enabled: autosaves,
    auto: autoSave,
    busy: saveBusy,
    save: (data) => startTransition(() => saveSubmit(data)),
  });

  /*
    Zapis przyciskiem idzie tą samą drogą co autozapis. Gdyby szedł przez
    action={...} formularza, React po każdym zapisie czyściłby pola i zabierał
    kursor z kodu.
  */
  function saveNow() {
    const form = formRef.current;
    if (!form || saveBusy) return;
    markSent();
    startTransition(() => saveSubmit(new FormData(form)));
  }

  return (
    <div className="column" style={{ gap: 20 }}>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          saveNow();
        }}
        className="sheet"
        style={{ padding: "22px 24px" }}
      >
        {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
            kodem przeskakiwałaby przy każdym autozapisie. */}
        {saveState.error ? <p className="error">{saveState.error}</p> : null}

        {saved.noteId ? <input type="hidden" name="noteId" value={saved.noteId} /> : null}
        {saved.version != null ? (
          <input type="hidden" name="baseVersion" value={String(saved.version)} />
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 180px",
            gap: 14,
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="code-title">{words.codeTitle}</label>
            <input
              id="code-title"
              name="title"
              type="text"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              maxLength={300}
              placeholder={words.codeFileNamePlaceholder}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="code-language">{words.codeLanguage}</label>
            <select
              id="code-language"
              name="language"
              value={currentLanguage}
              onChange={(event) => setCurrentLanguage(event.target.value)}
            >
              {choices.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {words.locale === "en-GB" && entry.nameEn ? entry.nameEn : entry.namePl}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="code-source">{words.codeWord}</label>
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

        <div className="save-row">
          <button type="submit" className="primary" disabled={saveBusy}>
            {saveBusy ? words.savingWord : saved.noteId ? words.save : submitLabel}
          </button>
          <SaveStatus
            busy={saveBusy}
            dirty={dirty}
            saved={saved.saved}
            autosaves={autosaves}
            autoSaveOff={!autoSave}
            error={saveState.error}
          />
        </div>
      </form>

      {previewLanguage ? (
        /*
          HTML to strona do obejrzenia, nie program do policzenia - zamiast
          Dockera jest tu podgląd, tak samo jak w edytorze kodu w aplikacji.

          Ramka jest odcięta od reszty strony: `sandbox` bez `allow-same-origin`
          daje jej własne, obce pochodzenie, więc skrypty w podglądzie działają,
          ale nie sięgną ani do ciasteczek Kajetu, ani do notatek obok.
        */
        <section className="sheet" style={{ padding: "22px 24px" }}>
          <p className="eyebrow">{words.previewEyebrow}</p>
          <h2 style={{ marginBottom: 8 }}>{words.codePreview}</h2>
          <p className="lead" style={{ marginBottom: 14 }}>
            {words.codePreviewAbout}
          </p>
          <iframe
            title={words.htmlPreviewFrame}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            srcDoc={currentSource}
            style={{
              width: "100%",
              minHeight: 360,
              border: "var(--hairline) solid var(--rule)",
              borderRadius: "var(--radius)",
              background: "#fff",
            }}
          />
        </section>
      ) : null}

      <section
        className="sheet"
        style={{ padding: "22px 24px", display: previewLanguage ? "none" : undefined }}
      >
        <p className="eyebrow">{words.runningEyebrow}</p>
        <h2 style={{ marginBottom: 8 }}>{words.runOnServer}</h2>
        <p className="lead" style={{ marginBottom: 14 }}>
          {runnerHint}
        </p>

        {!canRun ? (
          /* To nie awaria, tylko wyłączona możliwość - stąd spokojny ton
             zamiast czerwonej ramki błędu. Powód stoi w zdaniu wyżej. */
          <p className="notice" style={{ marginBottom: 0 }}>
            {words.cannotRunHere}
          </p>
        ) : (
          <form action={runSubmit}>
            <input type="hidden" name="language" value={currentLanguage} />
            <input type="hidden" name="code" value={currentSource} />

            <div className="field">
              <label htmlFor="code-stdin">{words.standardInput}</label>
              <textarea
                id="code-stdin"
                name="input"
                rows={3}
                placeholder={words.stdinPlaceholder}
                style={{
                  width: "100%",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>

            <button type="submit" className="primary" disabled={runBusy}>
              {runBusy ? words.codeRunning : words.codeRun}
            </button>
          </form>
        )}

        {runState.error ? <p className="error">{runState.error}</p> : null}

        {runState.output != null || runState.errors ? (
          <div style={{ marginTop: 16 }}>
            <p className="small" style={{ marginBottom: 6 }}>
              {runState.timeMs != null ? `${runState.timeMs} ms` : null}
              {runState.exitCode != null ? ` · ${words.exitCodeWord} ${runState.exitCode}` : null}
              {runState.interrupted ? ` · ${words.interruptedByTimeout}` : null}
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
