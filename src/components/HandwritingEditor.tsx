"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendStrokePoint,
  beginStroke,
  DEFAULT_INK_COLOR,
  type HandwritingBody,
} from "@/lib/handwriting-note";
import {
  argbColor,
  cssColor,
  cssFont,
  eraseStrokeFragment,
  strokePath,
  type Page,
  type Stroke,
} from "@/lib/document";

type ActionResult = { error?: string; success?: string };
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

type Tool = "pen" | "highlighter" | "fineliner" | "eraser";

const PEN_COLORS = [
  { label: "Atrament", color: DEFAULT_INK_COLOR },
  { label: "Morski", color: argbColor(15, 107, 92) },
  { label: "Bordo", color: argbColor(166, 57, 46) },
  { label: "Niebieski", color: argbColor(40, 80, 160) },
  { label: "Zakreślacz", color: argbColor(255, 230, 80, 120) },
];

const SIZES = [1.2, 2.4, 4, 8, 14];
const PAGE_GROW_MARGIN = 96;
const PAGE_GROW_STEP = 240;
const MIN_PAGE_HEIGHT = 842;

export function HandwritingEditor({
  action,
  noteId,
  version,
  title,
  initial,
  submitLabel,
}: {
  action: Action;
  noteId?: string;
  version?: number;
  title: string;
  initial: HandwritingBody;
  submitLabel: string;
}) {
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});
  const [pages, setPages] = useState<Page[]>(initial.pages);
  const [pageIndex, setPageIndex] = useState(0);
  const [background, setBackground] = useState(initial.background);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(DEFAULT_INK_COLOR);
  const [size, setSize] = useState(2.4);
  const [draft, setDraft] = useState<Stroke | null>(null);

  const drawing = useRef<{
    stroke: Stroke;
    startedAt: number;
    lastSample: number;
  } | null>(null);
  const erasing = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const page = pages[pageIndex] ?? pages[0];
  const width = page?.width ?? 595;
  const height = Math.max(MIN_PAGE_HEIGHT, page?.height ?? MIN_PAGE_HEIGHT);

  const payload = useMemo(
    () =>
      JSON.stringify({
        pageMode: initial.pageMode,
        background,
        pages,
      }),
    [initial.pageMode, background, pages],
  );

  const clientToPage = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const local = point.matrixTransform(matrix.inverse());
      return {
        x: Math.max(0, Math.min(width, local.x)),
        y: Math.max(0, local.y),
      };
    },
    [width],
  );

  function patchPage(index: number, transform: (current: Page) => Page) {
    setPages((list) => list.map((entry, i) => (i === index ? transform(entry) : entry)));
  }

  function ensurePageHeight(y: number) {
    patchPage(pageIndex, (current) => {
      const h = Math.max(MIN_PAGE_HEIGHT, current.height ?? MIN_PAGE_HEIGHT);
      if (y < h - PAGE_GROW_MARGIN) return current;
      const needed = Math.ceil((y + PAGE_GROW_MARGIN - h) / PAGE_GROW_STEP) * PAGE_GROW_STEP;
      return { ...current, height: h + Math.max(PAGE_GROW_STEP, needed) };
    });
  }

  function applyEraser(x: number, y: number) {
    const radius = Math.max(8, size * 2.5);
    patchPage(pageIndex, (current) => {
      const next: Stroke[] = [];
      for (const stroke of current.strokes ?? []) {
        next.push(
          ...eraseStrokeFragment(stroke, x, y, radius, () =>
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ),
        );
      }
      return { ...current, strokes: next };
    });
  }

  function pointerKind(event: React.PointerEvent): string {
    if (event.pointerType === "pen") return "stylus";
    if (event.pointerType === "touch") return "finger";
    return "mouse";
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const { x, y } = clientToPage(event.clientX, event.clientY);
    ensurePageHeight(y);

    if (tool === "eraser") {
      erasing.current = true;
      applyEraser(x, y);
      return;
    }

    const pressure =
      event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    const stroke = beginStroke({
      tool: tool === "highlighter" ? "highlighter" : tool === "fineliner" ? "fineliner" : "pen",
      color: tool === "highlighter" ? argbColor(255, 230, 80, 120) : color,
      size: tool === "fineliner" ? Math.min(size, 1.6) : tool === "highlighter" ? Math.max(size, 10) : size,
      x,
      y,
      input: pointerKind(event),
      pressure,
    });
    drawing.current = { stroke, startedAt: performance.now(), lastSample: 0 };
    setDraft(stroke);
  }

  function onPointerMove(event: React.PointerEvent) {
    const { x, y } = clientToPage(event.clientX, event.clientY);
    ensurePageHeight(y);

    if (tool === "eraser" && erasing.current) {
      applyEraser(x, y);
      return;
    }

    const session = drawing.current;
    if (!session) return;

    const elapsed = performance.now() - session.startedAt;
    if (elapsed - session.lastSample < 8 && session.stroke.points!.length > 6) return;
    session.lastSample = elapsed;
    const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    const next = appendStrokePoint(session.stroke, x, y, elapsed, pressure);
    session.stroke = next;
    setDraft(next);
  }

  function onPointerUp() {
    erasing.current = false;
    const session = drawing.current;
    drawing.current = null;
    if (!session) {
      setDraft(null);
      return;
    }
    const finished = session.stroke;
    setDraft(null);
    patchPage(pageIndex, (current) => ({
      ...current,
      strokes: [...(current.strokes ?? []), finished],
    }));
  }

  function clearPage() {
    if (!confirm("Wyczyścić wszystkie kreski na tej stronie? Pola tekstowe i obrazy zostaną.")) {
      return;
    }
    patchPage(pageIndex, (current) => ({ ...current, strokes: [] }));
  }

  function addPage() {
    setPages((list) => [
      ...list,
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `page-${Date.now()}`,
        width: 595,
        height: MIN_PAGE_HEIGHT,
        strokes: [],
        texts: [],
        images: [],
        recognized: [],
      },
    ]);
    setPageIndex(pages.length);
  }

  // Keep pageIndex in range if pages shrink.
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);

  const visibleStrokes = [...(page?.strokes ?? []), ...(draft ? [draft] : [])];
  const pageBackground = page?.background ?? background;

  return (
    <form action={submit} className="sheet" style={{ padding: "22px 24px" }}>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}

      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      {version != null ? (
        <input type="hidden" name="baseVersion" value={String(version)} />
      ) : null}
      <input type="hidden" name="handwritingJson" value={payload} />

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

      <div className="editor-toolbar" role="toolbar" aria-label="Odręczne">
        {(
          [
            ["pen", "Pióro"],
            ["fineliner", "Cienkopis"],
            ["highlighter", "Zakreślacz"],
            ["eraser", "Gumka"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`compact${tool === id ? " primary" : ""}`}
            onClick={() => setTool(id)}
          >
            {label}
          </button>
        ))}
        <span className="toolbar-sep" />
        {PEN_COLORS.map((entry) => {
          const active = color === entry.color;
          return (
            <button
              key={entry.label}
              type="button"
              className={`ink-swatch${active ? " active" : ""}`}
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={active}
              onClick={() => {
                setColor(entry.color);
                if (entry.label === "Zakreślacz") setTool("highlighter");
                else if (tool === "eraser") setTool("pen");
              }}
              style={{
                background: cssColor(entry.color),
              }}
            />
          );
        })}
        <span className="toolbar-sep" />
        {SIZES.map((value) => (
          <button
            key={value}
            type="button"
            className={`compact${size === value ? " primary" : ""}`}
            onClick={() => setSize(value)}
          >
            {value}
          </button>
        ))}
        <span className="toolbar-sep" />
        <label className="small" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          Tło
          <select
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            style={{ width: "auto", minHeight: 36, padding: "4px 8px" }}
          >
            <option value="plain">Gładkie</option>
            <option value="lined">W linie</option>
            <option value="grid">W kratkę</option>
            <option value="dots">W kropki</option>
            <option value="stave">Pięciolinia</option>
          </select>
        </label>
        <button type="button" className="compact" onClick={addPage}>
          + Strona
        </button>
        <button type="button" className="compact danger" onClick={clearPage}>
          Wyczyść stronę
        </button>
      </div>

      <div className="row-spread" style={{ marginTop: 10, marginBottom: 8 }}>
        <p className="small" style={{ margin: 0 }}>
          Strona {pageIndex + 1} z {pages.length} ·{" "}
          {(page?.strokes ?? []).length} kresek · strona rośnie, gdy piszesz w dół
        </p>
        <div className="row">
          <button
            type="button"
            className="compact"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          >
            ←
          </button>
          <button
            type="button"
            className="compact"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          >
            →
          </button>
        </div>
      </div>

      <div
        className="sheet handwriting-stage"
        style={{
          marginBottom: 16,
          overflow: "auto",
          background: "var(--desk)",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Edytor odręczny"
          style={{
            width: "100%",
            maxWidth: 720,
            height: "auto",
            minHeight: Math.round((720 / width) * height),
            display: "block",
            margin: "0 auto",
            background: "var(--sheet)",
            cursor: tool === "eraser" ? "cell" : "crosshair",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <PageBackdrop kind={pageBackground} width={width} height={height} />

          {(page?.texts ?? []).map((box) => (
            <foreignObject key={box.id} x={box.x} y={box.y} width={box.width} height={box.height}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  padding: 4,
                  boxSizing: "border-box",
                  fontFamily: cssFont(box.font),
                  fontSize: `${box.fontSize ?? 14}px`,
                  color: cssColor(box.color),
                  fontWeight: box.bold ? 600 : 400,
                  fontStyle: box.italic ? "italic" : "normal",
                  pointerEvents: "none",
                  whiteSpace: "pre-wrap",
                }}
              >
                {box.text ?? ""}
              </div>
            </foreignObject>
          ))}

          {visibleStrokes.map((stroke) => {
            const path = strokePath(stroke);
            if (!path) return null;
            const highlighter = stroke.tool === "highlighter";
            return (
              <path
                key={stroke.id}
                d={path}
                fill="none"
                stroke={cssColor(stroke.color)}
                strokeWidth={stroke.size || 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={highlighter ? { mixBlendMode: "multiply" } : undefined}
              />
            );
          })}
        </svg>
      </div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}

const LINE_SPACING = 28;
const GRID_SPACING = 20;
const PAGE_MARGIN = 60;

function PageBackdrop({
  kind,
  width,
  height,
}: {
  kind: string;
  width: number;
  height: number;
}) {
  const colour = "var(--rule)";
  const patternId = `edit-bg-${kind}`;
  if (kind === "plain") {
    return (
      <line x1={PAGE_MARGIN} y1="0" x2={PAGE_MARGIN} y2={height} stroke={colour} strokeWidth="0.9" />
    );
  }

  return (
    <>
      <defs>
        {kind === "lined" ? (
          <pattern id={patternId} width={width} height={LINE_SPACING} patternUnits="userSpaceOnUse">
            <line x1="0" y1={LINE_SPACING} x2={width} y2={LINE_SPACING} stroke={colour} strokeWidth="0.6" />
          </pattern>
        ) : null}
        {kind === "grid" ? (
          <pattern id={patternId} width={GRID_SPACING} height={GRID_SPACING} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`}
              fill="none"
              stroke={colour}
              strokeWidth="0.6"
            />
          </pattern>
        ) : null}
        {kind === "dots" ? (
          <pattern id={patternId} width={GRID_SPACING} height={GRID_SPACING} patternUnits="userSpaceOnUse">
            <circle cx="0.9" cy="0.9" r="0.9" fill={colour} />
          </pattern>
        ) : null}
        {kind === "stave" ? (
          <pattern id={patternId} width={width} height={91} patternUnits="userSpaceOnUse">
            {[0, 9, 18, 27, 36].map((y) => (
              <line
                key={y}
                x1={30}
                y1={y + 9}
                x2={width - 30}
                y2={y + 9}
                stroke={colour}
                strokeWidth="0.6"
              />
            ))}
          </pattern>
        ) : null}
      </defs>
      <rect width={width} height={height} fill={`url(#${patternId})`} />
      <line x1={PAGE_MARGIN} y1="0" x2={PAGE_MARGIN} y2={height} stroke={colour} strokeWidth="0.9" />
    </>
  );
}
