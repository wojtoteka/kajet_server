"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { assistKey, type CodeAssistEdit } from "@/lib/code-assist";
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

  // Numery wierszy obok kodu. Liczymy je z treści, a nie z wysokości pola:
  // przy wyłączonym zawijaniu jeden wiersz kodu to zawsze jeden wiersz na
  // ekranie, więc wystarczy policzyć znaki końca wiersza.
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const lineNumbers = useMemo(() => {
    const count = currentSource.split("\n").length;
    return Array.from({ length: count }, (_, at) => at + 1).join("\n");
  }, [currentSource]);

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
    Pomoc przy pisaniu kodu: domykanie nawiasów i znaczników, wcięcia. Reguły
    siedzą w lib/code-assist.ts i są te same, co w aplikacji na tablecie.
    Sam klawisz przechwytujemy tutaj, bo tylko tu wiadomo, w jakim języku
    pisany jest plik - `>` domyka znacznik wyłącznie w HTML.
  */
  function assist(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Skróty klawiszowe (Ctrl+V, Ctrl+Z) zostawiamy przeglądarce.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const area = event.currentTarget;
    const edit = assistKey({
      key: event.key,
      text: area.value,
      start: area.selectionStart,
      end: area.selectionEnd,
      html: currentLanguage === "html",
    });
    if (!edit) return;

    event.preventDefault();
    applyAssist(area, edit, setCurrentSource);
  }

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
        {saved.noteId ? <input type="hidden" name="noteId" value={saved.noteId} /> : null}
        {saved.version != null ? (
          <input type="hidden" name="baseVersion" value={String(saved.version)} />
        ) : null}

        <div className="code-note-head">
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
          {/*
            Numery wierszy w osobnej kolumnie po lewej, tak jak w aplikacji
            (LineNumberGutter) i jak w każdym edytorze kodu.

            Kolumna nie jest polem do pisania - to zwykły napis, ukryty przed
            czytnikiem ekranu, bo dyktowanie „jeden dwa trzy" przed każdym
            wierszem kodu tylko przeszkadza.

            Zawijanie wierszy jest WYŁĄCZONE (wrap="off"). Inaczej jeden długi
            wiersz zająłby na ekranie dwa i numeracja rozjechałaby się z kodem
            od tego miejsca w dół. Zamiast tego kod przewija się w bok - tak
            samo jak w aplikacji przy wyłączonym zawijaniu.
          */}
          <div className="code-editor">
            <div className="code-gutter" ref={gutterRef} aria-hidden="true">
              {lineNumbers}
            </div>
            <textarea
              id="code-source"
              name="source"
              ref={sourceRef}
              className="mono-field code-source"
              value={currentSource}
              onChange={(event) => setCurrentSource(event.target.value)}
              onKeyDown={assist}
              onScroll={(event) => {
                // Kolumna z numerami jedzie razem z kodem. Bez tego przy
                // przewijaniu numery zostawały na miejscu.
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
              rows={18}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>

        {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
            kodem przeskakiwałaby przy każdym autozapisie. Pełny błąd też stoi
            tutaj, przy przycisku: na górze spychał cały kod w dół. */}
        {saveState.error ? (
          <p className="error" style={{ margin: "0 0 10px 0" }}>
            {saveState.error}
          </p>
        ) : null}

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
                className="mono-field"
                rows={3}
                placeholder={words.stdinPlaceholder}
                style={{
                  width: "100%",
                  resize: "vertical",
                }}
              />
            </div>

            <button type="submit" className="primary" disabled={runBusy}>
              {runBusy ? words.codeRunning : words.codeRun}
            </button>
          </form>
        )}

        {runState.error ? (
          <p className="error" style={{ margin: "12px 0 0 0" }}>
            {runState.error}
          </p>
        ) : null}

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

/*
  Wprowadzenie podpowiedzianej zmiany do pola.

  Idzie przez `execCommand`, mimo że to wysłużone wywołanie: jako jedyne
  zostawia nietkniętą historię cofania przeglądarki. Podmiana `value` z ręki
  kasuje ją bez śladu, a wtedy Ctrl+Z po domkniętym nawiasie cofałoby całe
  pisanie zamiast ostatniego znaku. Gdyby przeglądarka odmówiła, zostaje
  zapasowa droga - lepiej stracić cofanie niż pomoc przy pisaniu.
*/
function applyAssist(
  area: HTMLTextAreaElement,
  edit: CodeAssistEdit,
  onText: (text: string) => void,
) {
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const command = (name: string, value?: string) => {
    if (typeof document.execCommand !== "function") return false;
    try {
      return document.execCommand(name, false, value);
    } catch {
      return false;
    }
  };

  if (edit.kind === "skip") {
    area.setSelectionRange(start + 1, start + 1);
    return;
  }

  if (edit.kind === "deletePair") {
    area.setSelectionRange(start - 1, start + 1);
    if (!command("delete")) {
      area.setRangeText("", start - 1, start + 1, "end");
      onText(area.value);
    }
    return;
  }

  if (!command("insertText", edit.text)) {
    area.setRangeText(edit.text, start, end, "end");
    onText(area.value);
  }

  const caret = area.selectionStart - edit.caretBack;
  area.setSelectionRange(caret, caret);
}
