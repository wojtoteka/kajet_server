"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createMindEdge,
  createMindNode,
  type MindMapBody,
} from "@/lib/mindmap-note";
import {
  argbFromHex,
  cssAlign,
  cssFont,
  displayInkColor,
  hexFromArgb,
  type MindEdge,
  type MindNode,
} from "@/lib/document";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import { mapTally, type Words } from "@/lib/i18n";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/components/useAutosave";
import { useSavedNote } from "@/components/useSavedNote";
import { useNoteFlush } from "@/components/NoteSync";
import { nodeGrowth } from "@/components/measureNodeText";
import { arrangeMindMap } from "@/lib/mindmap-layout";
import { TITLE_LIMIT } from "@/lib/note-title";

type ActionResult = { error?: string; success?: string; version?: number; noteId?: string };
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

const GAP_X = 64;
const GAP_Y = 20;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const MIN_W = 80;
const MIN_H = 40;
/** Najmniejsza wysokość planszy, zanim ResizeObserver odczyta prawdziwą. */
const MIN_BOARD_H = 480;

/** Pola węzła, po których hasło może przestać się mieścić w pudełku. */
const GROWING = ["text", "font", "fontSize", "bold", "italic"] as const;

/*
  Barwy węzłów. `customColor` to liczba ARGB - dokładnie to, co trzyma plik
  notatki i co czyta aplikacja na tablecie, więc kolor wybrany tutaj wygląda
  tam tak samo.
*/
function nodeColours(words: Words): { id: string; label: string; hex: string }[] {
  return [
    { id: "grafit", label: words.nodeGraphite, hex: "#4a4640" },
    { id: "morski", label: words.nodeTeal, hex: "#0f6b5c" },
    { id: "bordo", label: words.nodeBurgundy, hex: "#a6392e" },
    { id: "indygo", label: words.nodeIndigo, hex: "#2850a0" },
    { id: "sloneczny", label: words.nodeSunny, hex: "#b8860b" },
    { id: "sliwka", label: words.nodePlum, hex: "#6b3fa0" },
  ];
}

function nodeFonts(words: Words): { id: string; label: string }[] {
  return [
    { id: "body", label: words.fontBody },
    { id: "heading", label: words.fontHeading },
    { id: "mono", label: words.fontMono },
  ];
}

type Snapshot = { nodes: MindNode[]; edges: MindEdge[] };

export function MindMapEditor({
  action,
  noteId,
  version,
  title,
  initial,
  autoSave = true,
  submitLabel,
}: {
  action: Action;
  noteId?: string;
  version?: number;
  title: string;
  initial: MindMapBody;
  /** Ustawienie konta: mapa zapisuje się sama po chwili spokoju. */
  autoSave?: boolean;
  submitLabel: string;
}) {
  const words = useWords();
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});

  // Autozapis jak w aplikacji: mapa zapisuje się sama po chwili spokoju.
  // Sam zegar siedzi niżej, bo potrzebuje historii zmian.
  const formRef = useRef<HTMLFormElement | null>(null);
  const saved = useSavedNote({ noteId, version, state });
  const [noteTitle, setNoteTitle] = useState(title);

  const [nodes, setNodes] = useState<MindNode[]>(initial.nodes);
  const [edges, setEdges] = useState<MindEdge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.nodes[0]?.id ?? null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"move" | "connect">("move");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [viewX, setViewX] = useState(initial.viewX);
  const [viewY, setViewY] = useState(initial.viewY);
  const [zoom, setZoom] = useState(
    Number.isFinite(initial.zoom) && initial.zoom > 0 ? initial.zoom : 1,
  );

  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const resize = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const editingRef = useRef<HTMLTextAreaElement | null>(null);
  /*
    Plansza ma tyle pikseli, ile naprawdę zajmuje kartka — nie sztywne 960×540.
    Tamten kadr był znaczkiem pocztowym: przybliżanie i przesuwanie liczyły się
    do innego prostokąta niż ten na ekranie, więc mapa na WWW rozjeżdżała się
    względem tabletu (ten sam rodzaj usterki co zoom kontra pismo na Androidzie).
  */
  const [boardW, setBoardW] = useState(0);
  const [boardH, setBoardH] = useState(0);

  const payload = useMemo(
    () => JSON.stringify({ nodes, edges, viewX, viewY, zoom }),
    [nodes, edges, viewX, viewY, zoom],
  );

  // Nowej mapy nie zakładamy, dopóki człowiek jej nie tknął - inaczej samo
  // wejście na „nowa mapa" zostawiałoby w bibliotece pustą notatkę. Niepusta
  // historia cofania to najprostszy dowód, że coś się w mapie zmieniło.
  const autosaves = Boolean(saved.noteId) || past.length > 0;
  const { dirty, markSent } = useAutosave({
    formRef,
    enabled: autosaves,
    auto: autoSave,
    busy,
    save: (data) => startTransition(() => submit(data)),
  });

  /*
    Zapis na żądanie asystenta. Nie idzie przez `flush` z autozapisu, bo tamten
    odmawia w dwóch sytuacjach, które są tu właśnie te najważniejsze: gdy nic
    się nie zmieniło i gdy notatki jeszcze nie ma. KajetAI czyta mapę z bazy,
    więc mapa musi tam być - także wtedy, gdy powstała minutę temu i nikt jej
    nie nazwał. `autosave=1` zostawia człowieka na tej samej stronie.
  */
  const saveForAssistant = useCallback((): boolean => {
    const form = formRef.current;
    if (!form) return false;
    // Zapis już leci - jego odpowiedź i tak przyjdzie, nie ma po co wysyłać dwóch.
    if (busy) return true;
    markSent();
    const data = new FormData(form);
    data.set("autosave", "1");
    startTransition(() => submit(data));
    return true;
  }, [busy, markSent, submit]);
  useNoteFlush(saveForAssistant);

  /*
    Zapis przyciskiem idzie tą samą drogą co autozapis. Gdyby szedł przez
    action={...} formularza, React po każdym zapisie czyściłby pola formularza.
  */
  function saveNow() {
    const form = formRef.current;
    if (!form || busy) return;
    markSent();
    startTransition(() => submit(new FormData(form)));
  }

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  /*
    Pasek wyglądu i pole tekstu zostają na ekranie także wtedy, gdy nic nie jest
    zaznaczone - wtedy tylko przygasają i nie da się w nie kliknąć. Wcześniej
    znikały i wracały przy każdym kliknięciu, przez co cała strona podskakiwała.
  */
  const blankNode = useMemo(() => createMindNode({ x: 0, y: 0, text: "" }), []);
  const lastSelected = useRef<MindNode | null>(null);
  if (selected) lastSelected.current = selected;
  const shown = selected ?? lastSelected.current ?? blankNode;
  const idle = !selected;

  const worldView = useMemo(
    () => ({
      left: viewX,
      top: viewY,
      width: boardW > 0 ? boardW / zoom : 0,
      height: boardH > 0 ? boardH / zoom : 0,
    }),
    [viewX, viewY, zoom, boardW, boardH],
  );

  // Kółko myszy czyta stan przez tę zaczepkę, dzięki czemu nasłuch zakładamy
  // raz, a nie przy każdej zmianie przybliżenia.
  const viewRef = useRef({ viewX, viewY, zoom, boardW, boardH });
  viewRef.current = { viewX, viewY, zoom, boardW, boardH };

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const read = () => {
      const width = box.clientWidth;
      const height = box.clientHeight;
      if (width <= 0 || height <= 0) return;
      setBoardW((prev) => (prev === width ? prev : width));
      setBoardH((prev) => (prev === height ? prev : height));
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // --- Historia zmian ---

  const remember = useCallback(() => {
    setPast((list) => [...list.slice(-49), { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  // Zmiany stanu robimy obok siebie, a nie w środku funkcji przekazanej do
  // setState: React w trybie ścisłym woła ją dwa razy i historia dublowałaby
  // się przy każdym cofnięciu.
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((list) => list.slice(0, -1));
    setFuture((ahead) => [{ nodes, edges }, ...ahead].slice(0, 50));
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((list) => list.slice(1));
    setPast((back) => [...back.slice(-49), { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }

  // --- Zmiany w węzłach ---

  /*
    Zmiany, po których hasło może przestać się mieścić. Węzeł ma `overflow:
    hidden`, więc niezmieszczony napis nie wystaje - po prostu znika, i to bez
    śladu. Dlatego po każdej takiej zmianie węzeł jest domierzany w
    przeglądarce i, jeśli trzeba, ROŚNIE.

    Rośnie, a nie „dopasowuje się": skurczenie pudełka po skasowaniu połowy
    hasła cofałoby ręczne rozciągnięcie przy poprawianiu literówki. Od
    zmniejszania jest uchwyt w rogu.
  */
  function updateNode(id: string, patch: Partial<MindNode>, keep = false) {
    if (!keep) remember();
    const mayOverflow = GROWING.some((field) => field in patch);
    setNodes((list) =>
      list.map((node) => {
        if (node.id !== id) return node;
        const next = { ...node, ...patch };
        return mayOverflow ? { ...next, ...(nodeGrowth(next) ?? {}) } : next;
      }),
    );
  }

  /** Ta sama zmiana w trakcie ciągnięcia - bez zapisu do historii co klatkę. */
  function nudgeNode(id: string, patch: Partial<MindNode>) {
    setNodes((list) => list.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  }

  function addNodeAt(x: number, y: number) {
    remember();
    const node = createMindNode({ x, y, text: words.newNodeText });
    setNodes((list) => [...list, node]);
    setSelectedId(node.id);
    setEditingId(node.id);
  }

  function addChild() {
    if (!selected) return;
    remember();
    const siblings = edges.filter((edge) => edge.fromId === selected.id).length;
    const child = createMindNode({
      x: selected.x + (selected.width ?? 160) + GAP_X,
      y: selected.y + siblings * ((selected.height ?? 64) + GAP_Y),
      colorId: selected.colorId,
      customColor: selected.customColor,
      shape: selected.shape,
      font: selected.font,
      fontSize: selected.fontSize,
      align: selected.align,
      text: "",
    });
    setNodes((list) => [...list, child]);
    setEdges((list) => [...list, createMindEdge(selected.id, child.id)]);
    setSelectedId(child.id);
    setEditingId(child.id);
  }

  function addSibling() {
    if (!selected) return;
    const parent = edges.find((edge) => edge.toId === selected.id)?.fromId;
    remember();
    const twin = createMindNode({
      x: selected.x,
      y: selected.y + (selected.height ?? 64) + GAP_Y,
      colorId: selected.colorId,
      customColor: selected.customColor,
      shape: selected.shape,
      font: selected.font,
      fontSize: selected.fontSize,
      align: selected.align,
      text: "",
    });
    setNodes((list) => [...list, twin]);
    if (parent) setEdges((list) => [...list, createMindEdge(parent, twin.id)]);
    setSelectedId(twin.id);
    setEditingId(twin.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    remember();
    setNodes((list) => list.filter((node) => node.id !== selectedId));
    setEdges((list) =>
      list.filter((edge) => edge.fromId !== selectedId && edge.toId !== selectedId),
    );
    setSelectedId(null);
    setEditingId(null);
  }

  // --- Gałęzie i zwijanie ---

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      map.set(edge.fromId, [...(map.get(edge.fromId) ?? []), edge.toId]);
    }
    return map;
  }, [edges]);

  /** Węzły schowane pod zwiniętym rodzicem. */
  const hidden = useMemo(() => {
    const away = new Set<string>();
    const walk = (id: string) => {
      for (const child of childrenOf.get(id) ?? []) {
        if (away.has(child)) continue;
        away.add(child);
        walk(child);
      }
    };
    for (const node of nodes) {
      if (node.collapsed) walk(node.id);
    }
    return away;
  }, [nodes, childrenOf]);

  const visibleNodes = nodes.filter((node) => !hidden.has(node.id));
  const visibleEdges = edges.filter(
    (edge) => !hidden.has(edge.fromId) && !hidden.has(edge.toId),
  );

  /*
    Rozkłada mapę promieniście: temat główny w środku, gałęzie dookoła.

    Układ liczy `lib/mindmap-layout.ts` - ten sam, którego używa KajetAI po
    swoich zmianach. Wcześniej były dwa osobne rachunki, jeden tu i jeden na
    serwerze, i mapa układana przyciskiem wyglądała inaczej niż ta ułożona
    przez asystenta.

    Przy okazji każdy węzeł jest domierzany: „Rozłóż" to naturalny moment na
    naprawienie pudełek, w których hasło nie mieściło się od dawna - na
    przykład takich narysowanych na tablecie.
  */
  function arrange() {
    remember();
    setNodes((list) =>
      arrangeMindMap(
        list.map((node) => ({ ...node, ...(nodeGrowth(node) ?? {}) })),
        edges,
      ),
    );
  }

  /** Ustawia widok tak, żeby cała mapa zmieściła się na ekranie. */
  const fitToView = useCallback(() => {
    if (visibleNodes.length === 0) return;
    const { boardW: screenW, boardH: screenH } = viewRef.current;
    if (screenW <= 0 || screenH <= 0) return;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const node of visibleNodes) {
      left = Math.min(left, node.x);
      top = Math.min(top, node.y);
      right = Math.max(right, node.x + (node.width ?? 160));
      bottom = Math.max(bottom, node.y + (node.height ?? 64));
    }
    const pad = 40;
    const width = right - left + pad * 2;
    const height = bottom - top + pad * 2;
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(screenW / width, screenH / height)),
    );
    setZoom(next);
    setViewX(left - pad - (screenW / next - width) / 2);
    setViewY(top - pad - (screenH / next - height) / 2);
  }, [visibleNodes]);

  /*
    Mapa zapisuje razem z węzłami położenie kadru (viewX, viewY, zoom). Kadr
    dobrany na tablecie nie musi jednak pasować do okna na komputerze - płótno
    ma tu inny rozmiar i inne proporcje - więc mapa potrafiła otworzyć się na
    pustym miejscu: na tablecie węzły widać, na WWW biała plansza.

    Przy otwarciu sprawdzamy więc, czy w kadrze w ogóle coś stoi. Jeśli nie,
    pokazujemy całość - to samo, co robi przycisk „Zmieść całość". Kadr
    zapisany sensownie zostaje nietknięty.
  */
  const framed = useRef(false);
  const refit = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    // Dopiero po pierwszym pomiarze planszy - inaczej kadr liczyłby się do
    // pustego prostokąta i „Zmieść całość" trafiałoby w nic.
    if (worldView.width <= 0 || worldView.height <= 0) return;
    framed.current = true;
    if (visibleNodes.length === 0) return;
    const somethingInFrame = visibleNodes.some(
      (node) =>
        node.x < worldView.left + worldView.width &&
        node.x + (node.width ?? 160) > worldView.left &&
        node.y < worldView.top + worldView.height &&
        node.y + (node.height ?? 64) > worldView.top,
    );
    if (!somethingInFrame) {
      refit.current = true;
      fitToView();
    }
  }, [visibleNodes, worldView, fitToView]);

  // Samo dopasowanie kadru przy otwarciu to nie jest zmiana w mapie, więc nie
  // ma po co budzić autozapisu - inaczej każde zajrzenie na mapę podbijałoby
  // jej wersję na serwerze.
  useEffect(() => {
    if (!refit.current) return;
    refit.current = false;
    markSent();
  }, [payload, markSent]);

  // --- Przybliżanie ---

  const zoomAt = useCallback((factor: number, relX = 0.5, relY = 0.5) => {
    const { viewX: vx, viewY: vy, zoom: current, boardW: screenW, boardH: screenH } =
      viewRef.current;
    if (screenW <= 0 || screenH <= 0) return;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor));
    if (next === current) return;
    const worldX = vx + relX * (screenW / current);
    const worldY = vy + relY * (screenH / current);
    setZoom(next);
    setViewX(worldX - relX * (screenW / next));
    setViewY(worldY - relY * (screenH / next));
  }, []);

  /*
    Kółko myszy. React wiesza `onWheel` biernie, więc `preventDefault()` z niego
    nic nie daje i Ctrl+kółko przybliżało całą stronę zamiast mapy. Nasłuch
    zakładamy więc wprost, z passive: false.

    Ctrl (albo Cmd) + kółko przybliża mapę, Shift + kółko przesuwa ją w bok.
    Samo kółko zostawiamy stronie, żeby dało się przewinąć obok edytora.
  */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const target = svgRef.current ?? box;
        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        zoomAt(
          event.deltaY > 0 ? 0.9 : 1.1,
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height,
        );
        return;
      }
      if (event.shiftKey) {
        event.preventDefault();
        const { zoom: current } = viewRef.current;
        setViewX((x) => x + event.deltaY / current);
      }
    };

    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // --- Mysz na płótnie ---

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

  function beginPan(event: React.PointerEvent) {
    pan.current = { sx: event.clientX, sy: event.clientY, vx: viewX, vy: viewY };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function onNodePointerDown(event: React.PointerEvent, id: string) {
    event.stopPropagation();
    if (editingId === id) return;

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      beginPan(event);
      return;
    }

    setSelectedId(id);
    setEditingId(null);

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
          remember();
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
    remember();
    drag.current = { id, ox: point.x - node.x, oy: point.y - node.y };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onResizePointerDown(event: React.PointerEvent, id: string) {
    event.stopPropagation();
    const point = clientToSvg(event.clientX, event.clientY);
    const node = nodes.find((entry) => entry.id === id);
    if (!node) return;
    remember();
    resize.current = {
      id,
      ox: point.x - (node.x + (node.width ?? 160)),
      oy: point.y - (node.y + (node.height ?? 64)),
    };
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
    setEditingId(null);
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

    if (resize.current) {
      const point = clientToSvg(event.clientX, event.clientY);
      const { id, ox, oy } = resize.current;
      const node = nodes.find((entry) => entry.id === id);
      if (!node) return;
      nudgeNode(id, {
        width: Math.max(MIN_W, Math.round(point.x - ox - node.x)),
        height: Math.max(MIN_H, Math.round(point.y - oy - node.y)),
      });
      return;
    }

    if (!drag.current) return;
    const point = clientToSvg(event.clientX, event.clientY);
    const { id, ox, oy } = drag.current;
    nudgeNode(id, { x: Math.round(point.x - ox), y: Math.round(point.y - oy) });
  }

  function onPointerUp() {
    drag.current = null;
    resize.current = null;
    pan.current = null;
  }

  // --- Klawiatura ---

  useEffect(() => {
    if (editingId && editingRef.current) {
      editingRef.current.focus();
      editingRef.current.select();
    }
  }, [editingId]);

  function onCanvasKeyDown(event: React.KeyboardEvent) {
    if (editingId) return;
    if (event.key === "Tab") {
      event.preventDefault();
      addChild();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selected) setEditingId(selected.id);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
  }

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const canvasCursor = mode === "connect" ? "crosshair" : "default";
  const nodeColour = (node: MindNode) =>
    node.customColor ? displayInkColor(node.customColor) : "var(--accent)";

  return (
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
      <input type="hidden" name="mindMapJson" value={payload} />

      <div className="field">
        <label htmlFor="title">{words.noteTitle}</label>
        <input
          id="title"
          name="title"
          type="text"
          value={noteTitle}
          onChange={(event) => setNoteTitle(event.target.value)}
          maxLength={TITLE_LIMIT}
          placeholder={words.untitled}
        />
      </div>

      {/* --- Pasek: co zrobić z mapą --- */}
      <div className="editor-toolbar" role="toolbar" aria-label={words.mindMapToolbar}>
        <button
          type="button"
          className="compact"
          onClick={() => addNodeAt(viewX + worldView.width / 3, viewY + worldView.height / 3)}
        >
          <Icon name="add_box" size={18} />
          {words.nodeWord}
        </button>
        <button type="button" className="compact" disabled={!selected} onClick={addChild}>
          <Icon name="subdirectory_arrow_right" size={18} />
          {words.childWord}
        </button>
        <button type="button" className="compact" disabled={!selected} onClick={addSibling}>
          <Icon name="add" size={18} />
          {words.besideWord}
        </button>
        <button
          type="button"
          className={`compact${mode === "connect" ? " on" : ""}`}
          onClick={() => {
            setMode((current) => (current === "connect" ? "move" : "connect"));
            setConnectFrom(null);
          }}
        >
          <Icon name="linear_scale" size={18} />
          {mode === "connect"
            ? connectFrom
              ? words.pickTarget
              : words.pickSource
            : words.connectWord}
        </button>
        <button
          type="button"
          className="compact danger icon-only"
          disabled={!selected}
          onClick={deleteSelected}
          title={words.deleteNode}
          aria-label={words.deleteNode}
        >
          <Icon name="delete" />
        </button>

        <span className="toolbar-sep" />

        <button
          type="button"
          className="compact icon-only"
          onClick={undo}
          disabled={past.length === 0}
          title={words.undoWord}
          aria-label={words.undoWord}
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className="compact icon-only"
          onClick={redo}
          disabled={future.length === 0}
          title={words.redoWord}
          aria-label={words.redoWord}
        >
          <Icon name="redo" />
        </button>
        <button type="button" className="compact" onClick={arrange}>
          <Icon name="schema" size={18} />
          {words.arrangeWord}
        </button>

        <span className="toolbar-sep" />

        <button
          type="button"
          className="compact icon-only"
          onClick={() => zoomAt(0.9)}
          title={words.zoomOutWord}
          aria-label={words.zoomOutWord}
        >
          <Icon name="zoom_out" />
        </button>
        <span className="small" style={{ minWidth: 44, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="compact icon-only"
          onClick={() => zoomAt(1.1)}
          title={words.zoomInWord}
          aria-label={words.zoomInWord}
        >
          <Icon name="zoom_in" />
        </button>
        <button
          type="button"
          className="compact icon-only"
          onClick={fitToView}
          title={words.fitAll}
          aria-label={words.fitAll}
        >
          <Icon name="fit_screen" />
        </button>
      </div>

      {/* --- Pasek: wygląd zaznaczonego węzła --- */}
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label={words.nodeLookToolbar}
        inert={idle}
        style={{
          marginTop: 8,
          opacity: idle ? 0.4 : 1,
          transition: "opacity 160ms ease",
        }}
      >
        <button
          type="button"
          className="compact icon-only"
          title={
            shown.shape === "oval" ? words.turnIntoRectangle : words.turnIntoOval
          }
          aria-label={words.nodeShape}
          onClick={() =>
            updateNode(shown.id, {
              shape: shown.shape === "oval" ? "rectangle" : "oval",
            })
          }
        >
          <Icon name={shown.shape === "oval" ? "crop_square" : "circle"} />
        </button>

        <select
          className="toolbar-select"
          aria-label={words.fontLabel}
          value={shown.font ?? "body"}
          onChange={(event) => updateNode(shown.id, { font: event.target.value })}
        >
          {nodeFonts(words).map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="compact icon-only"
          title={words.smallerTextWord}
          aria-label={words.smallerTextWord}
          onClick={() =>
            updateNode(shown.id, {
              fontSize: Math.max(9, Math.round((shown.fontSize ?? 15) - 1)),
            })
          }
        >
          <Icon name="text_decrease" />
        </button>
        <span className="small" style={{ minWidth: 30, textAlign: "center" }}>
          {Math.round(shown.fontSize ?? 15)}
        </span>
        <button
          type="button"
          className="compact icon-only"
          title={words.largerTextWord}
          aria-label={words.largerTextWord}
          onClick={() =>
            updateNode(shown.id, {
              fontSize: Math.min(48, Math.round((shown.fontSize ?? 15) + 1)),
            })
          }
        >
          <Icon name="text_increase" />
        </button>

        <button
          type="button"
          className={`compact icon-only${shown.bold ? " on" : ""}`}
          title={words.bold}
          aria-label={words.bold}
          onClick={() => updateNode(shown.id, { bold: !shown.bold })}
        >
          <Icon name="format_bold" />
        </button>
        <button
          type="button"
          className={`compact icon-only${shown.italic ? " on" : ""}`}
          title={words.italic}
          aria-label={words.italic}
          onClick={() => updateNode(shown.id, { italic: !shown.italic })}
        >
          <Icon name="format_italic" />
        </button>

        {(
          [
            ["left", "format_align_left", words.alignLeft],
            ["center", "format_align_center", words.alignCentre],
            ["right", "format_align_right", words.alignRight],
          ] as const
        ).map(([value, icon, label]) => (
          <button
            key={value}
            type="button"
            className={`compact icon-only${(shown.align ?? "center") === value ? " on" : ""}`}
            title={label}
            aria-label={label}
            onClick={() => updateNode(shown.id, { align: value })}
          >
            <Icon name={icon} />
          </button>
        ))}

        <span className="toolbar-sep" />

        {nodeColours(words).map((colour) => (
          <button
            key={colour.id}
            type="button"
            className="ink-swatch"
            title={colour.label}
            aria-label={`${words.colourWord}: ${colour.label}`}
            onClick={() =>
              updateNode(shown.id, {
                colorId: colour.id,
                customColor: argbFromHex(colour.hex),
              })
            }
            style={{
              background: colour.hex,
              borderColor:
                hexFromArgb(shown.customColor, "") === colour.hex
                  ? "var(--accent)"
                  : "var(--rule)",
            }}
          />
        ))}

        <label
          className="small"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}
        >
          <Icon name="palette" size={18} />
          {words.frameWord}
          <input
            type="color"
            aria-label={words.ownFrameColour}
            value={hexFromArgb(shown.customColor, "#0f6b5c")}
            onChange={(event) =>
              updateNode(shown.id, {
                colorId: "wlasny",
                customColor: argbFromHex(event.target.value),
              })
            }
            style={{
              width: 34,
              height: 28,
              padding: 0,
              border: "var(--hairline) solid var(--rule)",
              borderRadius: "var(--radius)",
              background: "transparent",
              cursor: "pointer",
            }}
          />
        </label>

        <label
          className="small"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}
        >
          <Icon name="format_color_text" size={18} />
          {words.writingWord}
          <input
            type="color"
            aria-label={words.ownNodeTextColour}
            value={hexFromArgb(shown.textColor, "#23211d")}
            onChange={(event) =>
              updateNode(shown.id, { textColor: argbFromHex(event.target.value) })
            }
            style={{
              width: 34,
              height: 28,
              padding: 0,
              border: "var(--hairline) solid var(--rule)",
              borderRadius: "var(--radius)",
              background: "transparent",
              cursor: "pointer",
            }}
          />
        </label>

        <button
          type="button"
          className={`compact icon-only${shown.collapsed ? " on" : ""}`}
          title={shown.collapsed ? words.expandBranch : words.collapseBranch}
          aria-label={shown.collapsed ? words.expandBranch : words.collapseBranch}
          disabled={(childrenOf.get(shown.id)?.length ?? 0) === 0}
          onClick={() => updateNode(shown.id, { collapsed: !shown.collapsed })}
        >
          <Icon name={shown.collapsed ? "unfold_more" : "unfold_less"} />
        </button>
      </div>

      <div
        className="field"
        style={{ marginTop: 12, opacity: idle ? 0.55 : 1, transition: "opacity 160ms ease" }}
      >
        <label htmlFor="node-text">
          {idle ? words.nodeTextIdle : words.nodeTextLabel}
        </label>
        <textarea
          id="node-text"
          rows={2}
          value={idle ? "" : shown.text ?? ""}
          disabled={idle}
          onChange={(event) => updateNode(shown.id, { text: event.target.value }, true)}
          maxLength={500}
        />
      </div>

      <div
        ref={boxRef}
        className="sheet"
        style={{
          marginTop: 12,
          marginBottom: 16,
          overflow: "hidden",
          background: "var(--desk)",
          touchAction: "none",
          width: "100%",
          height: `clamp(${MIN_BOARD_H}px, 72dvh, 900px)`,
          minHeight: MIN_BOARD_H,
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={
            worldView.width > 0 && worldView.height > 0
              ? `${worldView.left} ${worldView.top} ${worldView.width} ${worldView.height}`
              : undefined
          }
          preserveAspectRatio="none"
          role="application"
          aria-label={words.mindMapCanvas}
          tabIndex={0}
          onKeyDown={onCanvasKeyDown}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: canvasCursor,
            outline: "none",
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

          {visibleEdges.map((edge) => {
            const from = byId.get(edge.fromId);
            const to = byId.get(edge.toId);
            if (!from || !to) return null;
            const fromX = from.x + (from.width ?? 160) / 2;
            const fromY = from.y + (from.height ?? 64) / 2;
            const toX = to.x + (to.width ?? 160) / 2;
            const toY = to.y + (to.height ?? 64) / 2;
            // Łagodny łuk czyta się lepiej niż prosta, gdy linii jest dużo.
            const midX = (fromX + toX) / 2;
            return (
              <g key={edge.id}>
                <path
                  d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                  fill="none"
                  stroke={nodeColour(to)}
                  strokeWidth="2"
                  strokeOpacity="0.55"
                />
                <path
                  d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  style={{ cursor: "pointer" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    remember();
                    setEdges((list) => list.filter((entry) => entry.id !== edge.id));
                  }}
                >
                  <title>{words.clickToRemoveEdge}</title>
                </path>
              </g>
            );
          })}

          {visibleNodes.map((node) => {
            const width = node.width ?? 160;
            const height = node.height ?? 64;
            const colour = nodeColour(node);
            const align = cssAlign(node.align);
            const active = node.id === selectedId || node.id === connectFrom;
            const editing = node.id === editingId;
            const kids = childrenOf.get(node.id)?.length ?? 0;

            return (
              <g
                key={node.id}
                style={{ cursor: mode === "move" ? "grab" : "crosshair" }}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(node.id);
                  setEditingId(node.id);
                }}
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
                    rx="4"
                    fill="var(--sheet)"
                    stroke={colour}
                    strokeWidth={active ? 3.5 : 2}
                  />
                )}

                <foreignObject
                  x={node.x}
                  y={node.y}
                  width={width}
                  height={height}
                  overflow="hidden"
                >
                  {/*
                    Wysokość wiersza 1.3 (bez jednostki) - ten sam mnożnik co
                    na tablecie. viewBox skaluje całe foreignObject, więc 1.3
                    trzyma pionowy środek przy każdym przybliżeniu. overflow
                    ucina hasło na krawędzi węzła.
                  */}
                  <div
                    style={{
                      width: `${width}px`,
                      height: `${height}px`,
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
                      color: node.textColor ? displayInkColor(node.textColor) : "var(--text)",
                      textAlign: align,
                      overflow: "hidden",
                      pointerEvents: editing ? "auto" : "none",
                      userSelect: editing ? "text" : "none",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {editing ? (
                      <textarea
                        ref={editingRef}
                        value={node.text ?? ""}
                        maxLength={500}
                        onChange={(event) =>
                          updateNode(node.id, { text: event.target.value }, true)
                        }
                        onPointerDown={(event) => event.stopPropagation()}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
                            event.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          padding: 0,
                          margin: 0,
                          border: "none",
                          outline: "none",
                          resize: "none",
                          background: "transparent",
                          font: "inherit",
                          lineHeight: "inherit",
                          color: "inherit",
                          textAlign: align,
                          overflow: "hidden",
                        }}
                      />
                    ) : (
                      node.text || "…"
                    )}
                  </div>
                </foreignObject>

                {/* Znacznik zwiniętej gałęzi: ile węzłów siedzi pod spodem. */}
                {node.collapsed && kids > 0 ? (
                  <g style={{ pointerEvents: "none" }}>
                    <circle
                      cx={node.x + width + 10}
                      cy={node.y + height / 2}
                      r="10"
                      fill="var(--sheet)"
                      stroke={colour}
                      strokeWidth="1.5"
                    />
                    <text
                      x={node.x + width + 10}
                      y={node.y + height / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--text-muted)"
                    >
                      {kids}
                    </text>
                  </g>
                ) : null}

                {/* Uchwyt do zmiany rozmiaru - tylko przy zaznaczonym węźle. */}
                {active ? (
                  <rect
                    x={node.x + width - 6}
                    y={node.y + height - 6}
                    width="12"
                    height="12"
                    rx="2"
                    fill="var(--sheet)"
                    stroke={colour}
                    strokeWidth="1.5"
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(event) => onResizePointerDown(event, node.id)}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="small" style={{ marginTop: -8, marginBottom: 14 }}>
        {mapTally(words, nodes.length, edges.length)} · {words.mindMapHints}
      </p>

      {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
          mapą przeskakiwałaby przy każdym autozapisie. Pełny błąd też stoi
          tutaj, przy przycisku: na górze spychał całą mapę w dół. */}
      {state.error ? (
        <p className="error" style={{ margin: "0 0 10px 0" }}>
          {state.error}
        </p>
      ) : null}

      <div className="save-row">
        <button type="submit" className="primary" disabled={busy}>
          <Icon name="save" size={18} />
          {busy ? words.savingWord : saved.noteId ? words.save : submitLabel}
        </button>
        <SaveStatus
          busy={busy}
          dirty={dirty}
          saved={saved.saved}
          autosaves={autosaves}
          autoSaveOff={!autoSave}
          error={state.error}
        />
      </div>
    </form>
  );
}
