"use client";

import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import {
  createMindEdge,
  createMindNode,
  type MindMapBody,
} from "@/lib/mindmap-note";
import { cssAlign, cssColor, cssFont, type MindEdge, type MindNode } from "@/lib/document";

type ActionResult = { error?: string; success?: string };
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

const GAP_X = 48;
const GAP_Y = 24;
const VIEWPORT_W = 960;
const VIEWPORT_H = 540;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const COLORS: { id: string; label: string; custom: number }[] = [
  { id: "grafit", label: "Grafit", custom: 0 },
  { id: "morski", label: "Morski", custom: -15261604 }, // #0f6b5c-ish
  { id: "bordo", label: "Bordo", custom: -5822162 },
  { id: "indygo", label: "Indygo", custom: -10066432 },
];

export function MindMapEditor({
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
  initial: MindMapBody;
  submitLabel: string;
}) {
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});
  const [nodes, setNodes] = useState<MindNode[]>(initial.nodes);
  const [edges, setEdges] = useState<MindEdge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.nodes[0]?.id ?? null,
  );
  const [mode, setMode] = useState<"move" | "connect">("move");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [viewX, setViewX] = useState(initial.viewX);
  const [viewY, setViewY] = useState(initial.viewY);
  const [zoom, setZoom] = useState(
    Number.isFinite(initial.zoom) && initial.zoom > 0 ? initial.zoom : 1,
  );

  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const payload = useMemo(
    () => JSON.stringify({ nodes, edges, viewX, viewY, zoom }),
    [nodes, edges, viewX, viewY, zoom],
  );

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const worldView = useMemo(
    () => ({
      left: viewX,
      top: viewY,
      width: VIEWPORT_W / zoom,
      height: VIEWPORT_H / zoom,
    }),
    [viewX, viewY, zoom],
  );

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }, []);

  function updateNode(id: string, patch: Partial<MindNode>) {
    setNodes((list) => list.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  }

  function addNodeAt(x: number, y: number) {
    const node = createMindNode({ x, y, text: "Nowy węzeł" });
    setNodes((list) => [...list, node]);
    setSelectedId(node.id);
  }

  function addChild() {
    if (!selected) return;
    const siblings = edges.filter((edge) => edge.fromId === selected.id).length;
    const child = createMindNode({
      x: selected.x + (selected.width ?? 160) + GAP_X,
      y: selected.y + siblings * ((selected.height ?? 64) + GAP_Y),
      colorId: selected.colorId,
      shape: selected.shape,
      font: selected.font,
      fontSize: selected.fontSize,
      text: "",
    });
    setNodes((list) => [...list, child]);
    setEdges((list) => [...list, createMindEdge(selected.id, child.id)]);
    setSelectedId(child.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setNodes((list) => list.filter((node) => node.id !== selectedId));
    setEdges((list) =>
      list.filter((edge) => edge.fromId !== selectedId && edge.toId !== selectedId),
    );
    setSelectedId(null);
  }

  function beginPan(event: React.PointerEvent) {
    pan.current = {
      sx: event.clientX,
      sy: event.clientY,
      vx: viewX,
      vy: viewY,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function onNodePointerDown(event: React.PointerEvent, id: string) {
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      beginPan(event);
      return;
    }

    setSelectedId(id);

    if (mode === "connect") {
      if (!connectFrom) {
        setConnectFrom(id);
        return;
      }
      if (connectFrom !== id) {
        const exists = edges.some(
          (edge) =>
            (edge.fromId === connectFrom && edge.toId === id) ||
            (edge.fromId === id && edge.toId === connectFrom),
        );
        if (!exists) {
          setEdges((list) => [...list, createMindEdge(connectFrom, id)]);
        }
      }
      setConnectFrom(null);
      setMode("move");
      return;
    }

    const point = clientToSvg(event.clientX, event.clientY);
    const node = nodes.find((entry) => entry.id === id);
    if (!node) return;
    drag.current = { id, ox: point.x - node.x, oy: point.y - node.y };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onBackgroundPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      event.preventDefault();
      beginPan(event);
      return;
    }
    setSelectedId(null);
    setConnectFrom(null);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (pan.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = worldView.width / rect.width;
      const scaleY = worldView.height / rect.height;
      setViewX(pan.current.vx - (event.clientX - pan.current.sx) * scaleX);
      setViewY(pan.current.vy - (event.clientY - pan.current.sy) * scaleY);
      return;
    }

    if (!drag.current) return;
    const point = clientToSvg(event.clientX, event.clientY);
    const { id, ox, oy } = drag.current;
    updateNode(id, { x: point.x - ox, y: point.y - oy });
  }

  function onPointerUp() {
    drag.current = null;
    pan.current = null;
  }

  function onWheel(event: React.WheelEvent) {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    if (nextZoom === zoom) return;

    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const worldX = viewX + relX * (VIEWPORT_W / zoom);
    const worldY = viewY + relY * (VIEWPORT_H / zoom);

    setZoom(nextZoom);
    setViewX(worldX - relX * (VIEWPORT_W / nextZoom));
    setViewY(worldY - relY * (VIEWPORT_H / nextZoom));
  }

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const canvasCursor = mode === "connect" ? "crosshair" : "default";

  return (
    <form action={submit} className="sheet" style={{ padding: "22px 24px" }}>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}

      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      {version != null ? (
        <input type="hidden" name="baseVersion" value={String(version)} />
      ) : null}
      <input type="hidden" name="mindMapJson" value={payload} />

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

      <div className="editor-toolbar" role="toolbar" aria-label="Mapa myśli">
        <button
          type="button"
          className="compact"
          onClick={() => addNodeAt(viewX + 40, viewY + 40)}
        >
          + Węzeł
        </button>
        <button type="button" className="compact" disabled={!selected} onClick={addChild}>
          + Dziecko
        </button>
        <button
          type="button"
          className={`compact${mode === "connect" ? " primary" : ""}`}
          onClick={() => {
            setMode((current) => (current === "connect" ? "move" : "connect"));
            setConnectFrom(null);
          }}
        >
          {mode === "connect"
            ? connectFrom
              ? "Wybierz cel…"
              : "Łączenie (wybierz źródło)"
            : "Połącz"}
        </button>
        <button type="button" className="compact danger" disabled={!selected} onClick={deleteSelected}>
          Usuń węzeł
        </button>
        <span className="toolbar-sep" />
        <button
          type="button"
          className="compact"
          disabled={!selected}
          onClick={() =>
            selected &&
            updateNode(selected.id, {
              shape: selected.shape === "oval" ? "rectangle" : "oval",
            })
          }
        >
          {selected?.shape === "oval" ? "Prostokąt" : "Owal"}
        </button>
        {COLORS.map((colour) => (
          <button
            key={colour.id}
            type="button"
            className="compact"
            disabled={!selected}
            title={colour.label}
            onClick={() =>
              selected &&
              updateNode(selected.id, {
                colorId: colour.id,
                customColor: colour.custom,
              })
            }
            style={{
              borderColor: colour.custom ? cssColor(colour.custom) : "var(--rule)",
            }}
          >
            {colour.label}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="node-text">Tekst węzła</label>
          <input
            id="node-text"
            type="text"
            value={selected.text ?? ""}
            onChange={(event) => updateNode(selected.id, { text: event.target.value })}
            maxLength={500}
          />
        </div>
      ) : (
        <p className="small" style={{ marginTop: 8 }}>
          Przeciągaj węzły myszą. Ctrl + przeciągnięcie przesuwa płótno, kółko myszy przybliża.
        </p>
      )}

      <div
        className="sheet"
        style={{
          marginTop: 12,
          marginBottom: 16,
          overflow: "hidden",
          background: "var(--desk)",
          touchAction: "none",
        }}
        onWheel={onWheel}
      >
        <svg
          ref={svgRef}
          viewBox={`${worldView.left} ${worldView.top} ${worldView.width} ${worldView.height}`}
          role="img"
          aria-label="Edytor mapy myśli"
          style={{
            width: "100%",
            minHeight: 420,
            display: "block",
            cursor: canvasCursor,
          }}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onDoubleClick={(event) => {
            if (event.ctrlKey || event.metaKey) return;
            const point = clientToSvg(event.clientX, event.clientY);
            addNodeAt(point.x - 80, point.y - 32);
          }}
        >
          <rect
            x={worldView.left}
            y={worldView.top}
            width={worldView.width}
            height={worldView.height}
            fill="transparent"
          />

          {edges.map((edge) => {
            const from = byId.get(edge.fromId);
            const to = byId.get(edge.toId);
            if (!from || !to) return null;
            const fromX = from.x + (from.width ?? 160) / 2;
            const fromY = from.y + (from.height ?? 64) / 2;
            const toX = to.x + (to.width ?? 160) / 2;
            const toY = to.y + (to.height ?? 64) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="var(--rule)"
                  strokeWidth="2"
                />
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="transparent"
                  strokeWidth="14"
                  style={{ cursor: "pointer" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEdges((list) => list.filter((entry) => entry.id !== edge.id));
                  }}
                >
                  <title>Kliknij, aby usunąć połączenie</title>
                </line>
              </g>
            );
          })}

          {nodes.map((node) => {
            const width = node.width ?? 160;
            const height = node.height ?? 64;
            const colour = node.customColor
              ? cssColor(node.customColor)
              : "var(--accent)";
            const align = cssAlign(node.align);
            const active = node.id === selectedId || node.id === connectFrom;

            return (
              <g
                key={node.id}
                style={{ cursor: mode === "move" ? "grab" : "crosshair" }}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
              >
                {node.shape === "oval" ? (
                  <ellipse
                    cx={node.x + width / 2}
                    cy={node.y + height / 2}
                    rx={width / 2}
                    ry={height / 2}
                    fill="var(--sheet)"
                    stroke={colour}
                    strokeWidth={active ? 3.5 : 2}
                  />
                ) : (
                  <rect
                    x={node.x}
                    y={node.y}
                    width={width}
                    height={height}
                    rx="3"
                    fill="var(--sheet)"
                    stroke={colour}
                    strokeWidth={active ? 3.5 : 2}
                  />
                )}
                <foreignObject x={node.x} y={node.y} width={width} height={height}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        align === "center"
                          ? "center"
                          : align === "right"
                            ? "flex-end"
                            : "flex-start",
                      padding: "6px 10px",
                      boxSizing: "border-box",
                      fontFamily: cssFont(node.font),
                      fontSize: `${node.fontSize ?? 15}px`,
                      lineHeight: 1.3,
                      fontWeight: node.bold ? 600 : 400,
                      fontStyle: node.italic ? "italic" : "normal",
                      color: node.textColor ? cssColor(node.textColor) : "var(--text)",
                      textAlign: align,
                      overflow: "hidden",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {node.text || "…"}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="small" style={{ marginTop: -8, marginBottom: 14 }}>
        {nodes.length} węzłów · {edges.length} połączeń · Ctrl+przeciągnięcie = przesuwanie ·
        kółko = zoom · podwójne kliknięcie dodaje węzeł
      </p>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}
