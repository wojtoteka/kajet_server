"use client";

import { useActionState, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

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
  const [mode, setMode] = useState<"edit" | "preview" | "split">("edit");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function withSelection(transform: (value: string, start: number, end: number) => {
    next: string;
    selectStart: number;
    selectEnd: number;
  }) {
    const area = textareaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const result = transform(body, start, end);
    setBody(result.next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(result.selectStart, result.selectEnd);
    });
  }

  function wrap(marker: string) {
    withSelection((value, start, end) => {
      const selected = value.slice(start, end) || "tekst";
      const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
      return {
        next,
        selectStart: start + marker.length,
        selectEnd: start + marker.length + selected.length,
      };
    });
  }

  function wrapPair(open: string, close: string) {
    withSelection((value, start, end) => {
      const selected = value.slice(start, end) || "tekst";
      const next = value.slice(0, start) + open + selected + close + value.slice(end);
      return {
        next,
        selectStart: start + open.length,
        selectEnd: start + open.length + selected.length,
      };
    });
  }

  function beforeLine(prefix: string) {
    withSelection((value, start, end) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selected = value.slice(start, end);
      if (start !== end && selected.includes("\n")) {
        const block = selected
          .split("\n")
          .map((line) => (line.startsWith(prefix) ? line : prefix + line))
          .join("\n");
        const next = value.slice(0, start) + block + value.slice(end);
        return { next, selectStart: start, selectEnd: start + block.length };
      }
      const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      return {
        next,
        selectStart: start + prefix.length,
        selectEnd: end + prefix.length,
      };
    });
  }

  function insert(snippet: string, cursorOffset?: number) {
    withSelection((value, start, end) => {
      const next = value.slice(0, start) + snippet + value.slice(end);
      const pos = start + (cursorOffset ?? snippet.length);
      return { next, selectStart: pos, selectEnd: pos };
    });
  }

  const showEditor = mode === "edit" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";

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

      <div className="editor-toolbar" role="toolbar" aria-label="Formatowanie Markdown">
        <button type="button" className="compact" title="Nagłówek 1" onClick={() => beforeLine("# ")}>
          H1
        </button>
        <button type="button" className="compact" title="Nagłówek 2" onClick={() => beforeLine("## ")}>
          H2
        </button>
        <button type="button" className="compact" title="Nagłówek 3" onClick={() => beforeLine("### ")}>
          H3
        </button>
        <span className="toolbar-sep" />
        <button type="button" className="compact" title="Pogrubienie" onClick={() => wrap("**")}>
          <strong>B</strong>
        </button>
        <button type="button" className="compact" title="Kursywa" onClick={() => wrap("*")}>
          <em>I</em>
        </button>
        <button type="button" className="compact" title="Przekreślenie" onClick={() => wrap("~~")}>
          <span style={{ textDecoration: "line-through" }}>S</span>
        </button>
        <button type="button" className="compact" title="Podkreślenie" onClick={() => wrapPair("<u>", "</u>")}>
          <span style={{ textDecoration: "underline" }}>U</span>
        </button>
        <button type="button" className="compact" title="Podświetlenie" onClick={() => wrap("==")}>
          ==
        </button>
        <span className="toolbar-sep" />
        <button type="button" className="compact" title="Lista" onClick={() => beforeLine("- ")}>
          • Lista
        </button>
        <button type="button" className="compact" title="Lista numerowana" onClick={() => beforeLine("1. ")}>
          1.
        </button>
        <button type="button" className="compact" title="Lista zadań" onClick={() => beforeLine("- [ ] ")}>
          ☐
        </button>
        <button type="button" className="compact" title="Cytat" onClick={() => beforeLine("> ")}>
          „ ”
        </button>
        <span className="toolbar-sep" />
        <button type="button" className="compact" title="Kod w tekście" onClick={() => wrap("`")}>
          `
        </button>
        <button
          type="button"
          className="compact"
          title="Blok kodu"
          onClick={() => insert("\n```\n\n```\n", 5)}
        >
          {"{ }"}
        </button>
        <button
          type="button"
          className="compact"
          title="Odnośnik"
          onClick={() => insert("[opis](https://)", 1)}
        >
          Link
        </button>
        <button
          type="button"
          className="compact"
          title="Tabela"
          onClick={() =>
            insert("\n| Kolumna | Kolumna |\n| --- | --- |\n|  |  |\n", 3)
          }
        >
          Tabela
        </button>
        <button
          type="button"
          className="compact"
          title="Wzór"
          onClick={() => insert("\n$$\n\n$$\n", 4)}
        >
          Σ
        </button>
        <button type="button" className="compact" title="Linia" onClick={() => insert("\n---\n", 0)}>
          —
        </button>
        <span className="toolbar-sep" />
        <button
          type="button"
          className={`compact${mode === "edit" ? " primary" : ""}`}
          onClick={() => setMode("edit")}
        >
          Edycja
        </button>
        <button
          type="button"
          className={`compact${mode === "split" ? " primary" : ""}`}
          onClick={() => setMode("split")}
        >
          Obok
        </button>
        <button
          type="button"
          className={`compact${mode === "preview" ? " primary" : ""}`}
          onClick={() => setMode("preview")}
        >
          Podgląd
        </button>
      </div>

      <div
        className={mode === "split" ? "editor-split" : undefined}
        style={{ marginTop: 10, marginBottom: 14 }}
      >
        {showEditor ? (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="markdown" className="visually-hidden">
              Treść (Markdown)
            </label>
            <textarea
              ref={textareaRef}
              id="markdown"
              name="markdown"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={mode === "split" ? 22 : 18}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                lineHeight: 1.45,
                resize: "vertical",
                minHeight: 280,
              }}
            />
          </div>
        ) : (
          <input type="hidden" name="markdown" value={body} />
        )}

        {showPreview ? (
          <div
            className="sheet-ruled"
            style={{
              paddingBlock: 16,
              paddingInlineEnd: 18,
              minHeight: 280,
              overflow: "auto",
            }}
          >
            {body.trim() ? (
              <MarkdownPreview markdown={body} noteId={noteId ?? "preview"} />
            ) : (
              <span className="small">Pusto — wróć do edycji i napisz coś.</span>
            )}
            {!showEditor ? <input type="hidden" name="markdown" value={body} /> : null}
          </div>
        ) : null}
      </div>

      <p className="small" style={{ marginTop: -6, marginBottom: 14 }}>
        Zapis idzie tą samą drogą co synchronizacja z aplikacji — przy rozbieżności wersji
        dostaniesz komunikat zamiast nadpisać cudzą zmianę.{" "}
        {body.length.toLocaleString("pl-PL")} znaków.
      </p>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}
