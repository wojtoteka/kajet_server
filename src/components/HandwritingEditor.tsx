"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  appendStrokePoint,
  beginStroke,
  DARK_INK_COLOR,
  DEFAULT_INK_COLOR,
  emptyPage,
  type HandwritingBody,
} from "@/lib/handwriting-note";
import {
  argbColor,
  argbFromHex,
  attachmentUrl,
  cssFont,
  displayInkColor,
  eraseStrokeFragment,
  hexFromArgb,
  strokePath,
  VALUES_PER_POINT,
  type Image,
  type Page,
  type Stroke,
} from "@/lib/document";
import {
  dragShapeHandle,
  fitShapeTo,
  isOpenShape,
  rotateShapeTo,
  shapeBigEnough,
  shapeBounds,
  shapeCenter,
  shapeFillOpacity,
  shapeHandles,
  shapeHits,
  shapePath,
  shapeStrokeOpacity,
  shapeStrokeWidth,
  shapeTransform,
  type Shape,
  type ShapeKind,
} from "@/lib/shapes";
import { MAX_CUSTOM_COLORS, readPalette, savePalette } from "@/lib/palette";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon, type IconName } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import {
  changeOwnColour,
  ownColourSlot,
  ownColourSlotHint,
  tooManyOwnColours,
  type Words,
} from "@/lib/i18n";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/components/useAutosave";
import { useSavedNote } from "@/components/useSavedNote";
import { TITLE_LIMIT } from "@/lib/note-title";

type ActionResult = {
  error?: string;
  success?: string;
  version?: number;
  noteId?: string;
  attachment?: { name: string };
};
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

/** „select" nie rysuje - służy do przesuwania wstawionych zdjęć. */
type Tool = "pen" | "highlighter" | "fineliner" | "eraser" | "select" | "shapes";

/** Rodzaje kształtów w kolejności paska, razem z nazwą i ikoną. */
function shapeKinds(words: Words): { id: ShapeKind; label: string; icon: IconName }[] {
  return [
    { id: "line", label: words.shapeLine, icon: "horizontal_rule" },
    { id: "arrow", label: words.shapeArrow, icon: "arrow_outward" },
    { id: "rect", label: words.shapeRect, icon: "crop_square" },
    { id: "round_rect", label: words.shapeRoundRect, icon: "rounded_corner" },
    { id: "ellipse", label: words.shapeEllipse, icon: "circle" },
    { id: "triangle", label: words.shapeTriangle, icon: "change_history" },
    { id: "diamond", label: words.shapeDiamond, icon: "diamond" },
    { id: "star", label: words.shapeStar, icon: "star" },
  ];
}

/** Co robi wskaźnik z kształtem: rysuje nowy, przesuwa, rozciąga albo obraca. */
type ShapeDrag =
  | { what: "draw"; startX: number; startY: number; template: Shape }
  | { what: "move"; id: string; grabX: number; grabY: number; base: Shape }
  | { what: "handle"; id: string; index: number; base: Shape }
  | { what: "rotate"; id: string; base: Shape };

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function penColours(words: Words): { id: string; label: string; color: number }[] {
  return [
    { id: "ink", label: words.penInk, color: DEFAULT_INK_COLOR },
    { id: "teal", label: words.penTeal, color: argbColor(15, 107, 92) },
    { id: "burgundy", label: words.penBurgundy, color: argbColor(166, 57, 46) },
    { id: "blue", label: words.penBlue, color: argbColor(40, 80, 160) },
    { id: "highlighter", label: words.penHighlighter, color: argbColor(255, 230, 80, 120) },
  ];
}

/** Świeży slot na własny kolor - biały, dopóki się go nie pomaluje. */
const BLANK_SLOT = argbColor(255, 255, 255);

/** Zamienia samo krycie w gotowej barwie, zostawiając odcień bez zmian. */
function withOpacity(color: number, opacity: number): number {
  const alpha = Math.round(Math.min(1, Math.max(0.05, opacity)) * 255);
  return ((alpha << 24) | ((color >>> 0) & 0xffffff)) | 0;
}

function opacityOf(color: number): number {
  return ((color >>> 24) & 0xff) / 255;
}

/*
  In the dark theme the sheet is dark, so writing with the default ink
  (#23211d) would be invisible. The editor watches the theme and stores the
  dark-theme ink instead - the same rule as defaultInk in the tablet app.
  Displayed colours go through displayInkColor, so old strokes stay readable
  in both themes either way.

  Motyw ma dwa źródła: ustawienie systemu i wybór z nagłówka (data-theme na
  <html>). Pierwszego pilnuje matchMedia, drugiego obserwator atrybutu -
  bez niego przełączenie motywu przy otwartym edytorze zmieniłoby barwy
  arkusza, ale atrament zostałby z poprzedniego.
*/
function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () => {
      const forced = document.documentElement.dataset.theme;
      setDark(forced ? forced === "dark" : media.matches);
    };
    compute();
    media.addEventListener("change", compute);

    const watcher = new MutationObserver(compute);
    watcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      media.removeEventListener("change", compute);
      watcher.disconnect();
    };
  }, []);

  return dark;
}

const SIZES = [1.2, 2.4, 4, 8, 14];

/** Zapas wokół kształtu przy klikaniu, w punktach strony. */
const SHAPE_TAP_REACH = 8;

/** Promień uchwytu przy wziętym kształcie. */
const HANDLE_RADIUS = 7;

/** O tyle uchwyt obrotu odsuwa się nad górną krawędź. */
const ROTATE_GAP = 28;
const PAGE_GROW_MARGIN = 96;
const PAGE_GROW_STEP = 240;
const MIN_PAGE_HEIGHT = 842;

/** Najniższy punkt zawartości strony: kresek, kształtów, zdjęć i pól tekstowych. */
function pageContentBottom(entry: Page, draft?: Stroke | null): number {
  let bottom = 0;
  const strokes = draft ? [...(entry.strokes ?? []), draft] : entry.strokes ?? [];
  for (const stroke of strokes) {
    const points = stroke.points ?? [];
    for (let i = 1; i < points.length; i += VALUES_PER_POINT) {
      if (points[i] > bottom) bottom = points[i];
    }
  }
  for (const shape of entry.shapes ?? []) bottom = Math.max(bottom, shapeBounds(shape).bottom);
  for (const image of entry.images ?? []) bottom = Math.max(bottom, image.y + image.height);
  for (const box of entry.texts ?? []) bottom = Math.max(bottom, box.y + box.height);
  return bottom;
}

/**
 * Zapas wysokości płótna z zawartości, nie z pozycji kursora. Wcześniej
 * strona rosła przy każdym ruchu wskaźnika nad dolną krawędzią — samo
 * zjeżdżanie w dół do przycisku „Zapisz" wydłużało ją w nieskończoność
 * i przycisk uciekał. Ta liczba zostaje w edytorze; do content.json nie idzie.
 */
function fittedPageHeight(entry: Page, draft?: Stroke | null): number {
  const needed = pageContentBottom(entry, draft) + PAGE_GROW_MARGIN;
  return Math.max(MIN_PAGE_HEIGHT, Math.ceil(needed / PAGE_GROW_STEP) * PAGE_GROW_STEP);
}

export function HandwritingEditor({
  action,
  uploadAction,
  noteId,
  version,
  title,
  initial,
  autoSave = true,
  submitLabel,
  attachments = [],
  token,
}: {
  action: Action;
  /** Wysyłka zdjęcia prosto z paska - ta sama akcja co „Pliki przy notatce". */
  uploadAction?: Action;
  noteId?: string;
  version?: number;
  title: string;
  initial: HandwritingBody;
  /** Ustawienie konta: kartka zapisuje się sama po pauzie w rysowaniu. */
  autoSave?: boolean;
  submitLabel: string;
  /** Pliki przy notatce - z nich bierzemy zdjęcia do wstawienia na stronę. */
  attachments?: { name: string; mime: string }[];
  /** Odnośnik do udostępnienia - zdjęcia idą wtedy jego trasą, nie właściciela. */
  token?: string;
}) {
  const words = useWords();
  const darkTheme = useDarkTheme();
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});
  const [pages, setPages] = useState<Page[]>(initial.pages);
  const [noteTitle, setNoteTitle] = useState(title);
  const [pageIndex, setPageIndex] = useState(0);
  const [background, setBackground] = useState(initial.background);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(DEFAULT_INK_COLOR);
  const [size, setSize] = useState(2.4);
  const [draft, setDraft] = useState<Stroke | null>(null);
  // Własne kolory - każdy w swoim slocie na pasku, żeby nie trzeba było za
  // każdym razem trafiać w to samo miejsce na tęczy. Leżą w ciasteczku, więc
  // przeżywają zamknięcie karty i są te same przy każdej notatce.
  // Pierwszy render musi być pusty: na serwerze ciasteczka nie czytamy, a
  // różnica między nim a przeglądarką wywaliłaby uwodnienie Reacta.
  const [customColors, setCustomColors] = useState<number[]>([]);
  // Slot, który akurat malujemy paletą. null = stoimy na barwie gotowej,
  // wtedy paleta zakłada nowy slot zamiast psuć któryś z dawnych.
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  useEffect(() => {
    const saved = readPalette();
    if (saved.length > 0) setCustomColors(saved);
  }, []);
  // Nazwa załącznika wybrana w spisie do wstawienia oraz zdjęcie
  // zaznaczone już na stronie (to drugie można przesuwać i skalować).
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Kształty: co się rysuje, co jest wzięte do poprawek i co powstaje pod ręką.
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [shapeFilled, setShapeFilled] = useState(false);
  const [squareLock, setSquareLock] = useState(false);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [draftShape, setDraftShape] = useState<Shape | null>(null);
  const shapeDrag = useRef<ShapeDrag | null>(null);
  // Shift na klawiaturze i drugi wskaźnik na ekranie znaczą to samo co blokada.
  const shiftDown = useRef(false);
  const secondPointer = useRef(false);
  // Co po kolei przybyło na kartkę - stąd wie „cofnij", co ma zdjąć.
  const added = useRef<{ kind: "stroke" | "shape"; page: number; id: string }[]>([]);
  // Pytanie o wyczyszczenie strony - własne okno zamiast window.confirm.
  const [askingClear, setAskingClear] = useState(false);

  // Zdjęcia wysłane przed chwilą prosto z paska. Spis z serwera przychodzi
  // razem ze stroną, więc świeżo wysłanego pliku by w nim jeszcze nie było.
  const [justSent, setJustSent] = useState<string[]>([]);

  const pictures = [
    ...attachments.filter(
      (file) =>
        file.mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name),
    ),
    ...justSent
      .filter((name) => !attachments.some((file) => file.name === name))
      .map((name) => ({ name, mime: "image/*" })),
  ];

  const imageMove = useRef<{
    id: string;
    ox: number;
    oy: number;
    what: "move" | "resize";
  } | null>(null);

  const drawing = useRef<{
    stroke: Stroke;
    startedAt: number;
    lastSample: number;
  } | null>(null);
  const erasing = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Autozapis jak w aplikacji: po pauzie w rysowaniu strona zapisuje się sama.
  // Sam zegar siedzi niżej, bo potrzebuje gotowej treści stron.
  const formRef = useRef<HTMLFormElement | null>(null);
  const saved = useSavedNote({ noteId, version, state });

  const page = pages[pageIndex] ?? pages[0];
  const width = page?.width ?? 595;
  // Płótno może urosnąć przy pisaniu przy krawędzi, ale nie kurczy kartki
  // zapisanej na tablecie (długa strona ma zostać długa).
  const height = page
    ? Math.max(page.height ?? MIN_PAGE_HEIGHT, fittedPageHeight(page, draft))
    : MIN_PAGE_HEIGHT;

  const payload = useMemo(
    () =>
      JSON.stringify({
        pageMode: initial.pageMode,
        background,
        // Wymiary strony zostają z dokumentu. Dopasowanie do atramentu jest
        // tylko na płótnie — inaczej tablet dostawałby inną kartkę.
        pages,
      }),
    [initial.pageMode, background, pages],
  );

  // Nowej notatki nie zakładamy, dopóki na kartce nic nie ma - inaczej samo
  // wejście na „nowa odręczna" zostawiałoby w bibliotece pustą notatkę.
  const autosaves =
    Boolean(saved.noteId) ||
    pages.some(
      (entry) =>
        (entry.strokes?.length ?? 0) > 0 ||
        (entry.shapes?.length ?? 0) > 0 ||
        (entry.images?.length ?? 0) > 0 ||
        (entry.texts?.length ?? 0) > 0,
    );
  const { dirty, markSent } = useAutosave({
    formRef,
    enabled: autosaves,
    auto: autoSave,
    busy,
    save: (data) => startTransition(() => submit(data)),
    // Kartka z kreskami bywa gruba (nawet kilka megabajtów), a porównanie
    // migawki kosztuje tyle, co jej długość - sprawdzamy więc rzadziej niż
    // przy tekście. Pauza w rysowaniu i tak trwa dłużej niż w pisaniu.
    tickMs: 900,
    quietMs: 1800,
  });

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

  /*
    Zdjęcie prosto z paska: plik leci tą samą drogą co załączniki, a zaraz po
    wysłaniu ląduje na bieżącej stronie. Wcześniej trzeba było zjechać na dół
    do „Pliki przy notatce", wysłać, poczekać na przeładowanie i dopiero wtedy
    wybrać zdjęcie z rozwijanego spisu.

    Formularza nie wolno włożyć w formularz, więc pole na plik jest bez nazwy
    (nie trafia do zapisu notatki), a akcję wołamy z ręcznie złożonym FormData.
  */
  const [uploadState, uploadSubmit, uploading] = useActionState<ActionResult, FormData>(
    uploadAction ?? (async () => ({})),
    {},
  );
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handledUpload = useRef<ActionResult | null>(null);

  useEffect(() => {
    const name = uploadState.attachment?.name;
    if (!name) return;
    if (handledUpload.current === uploadState) return;
    handledUpload.current = uploadState;
    setJustSent((list) => (list.includes(name) ? list : [...list, name]));
    insertImage(name);
  }, [uploadState]);

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Czyścimy od razu, żeby wybranie tego samego pliku drugi raz też zadziałało.
    event.target.value = "";
    if (!file || !saved.noteId) return;
    const data = new FormData();
    data.set("noteId", saved.noteId);
    data.set("file", file);
    data.set("name", file.name);
    startTransition(() => uploadSubmit(data));
  }

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

  // --- Kształty ---

  /*
    Shift trzymany na klawiaturze. Czytamy go z okna, a nie ze zdarzenia
    wskaźnika: przy rysowaniu myszą Shift bywa naciskany i puszczany W TRAKCIE
    ciągnięcia, a `pointermove` niesie stan klawiszy tylko przy niektórych
    przeglądarkach.
  */
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftDown.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const squareWanted = () => squareLock || shiftDown.current || secondPointer.current;

  function newShapeId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Kształt z ustawień paska, jeszcze bez rozmiaru. */
  function shapeTemplate(x: number, y: number): Shape {
    const inkColor = color === DEFAULT_INK_COLOR && darkTheme ? DARK_INK_COLOR : color;
    return {
      id: newShapeId(),
      kind: shapeKind,
      x,
      y,
      width: 0,
      height: 0,
      color: inkColor,
      strokeWidth: size,
      // Wypełnienie bierze barwę obrysu i przycina jej krycie, żeby pismo pod
      // spodem zostało czytelne - tak samo jak przy zakreślaczu.
      fill: shapeFilled && !isOpenShape(shapeKind) ? withOpacity(inkColor, 0.28) : 0,
      opacity: 1,
    };
  }

  function patchShape(id: string, next: Shape) {
    patchPage(pageIndex, (current) => ({
      ...current,
      shapes: (current.shapes ?? []).map((entry) => (entry.id === id ? next : entry)),
    }));
  }

  function removeShape(id: string) {
    patchPage(pageIndex, (current) => ({
      ...current,
      shapes: (current.shapes ?? []).filter((entry) => entry.id !== id),
    }));
    added.current = added.current.filter((entry) => entry.id !== id);
    setSelectedShape(null);
  }

  /** Kształt pod wskaźnikiem. Ostatni na spisie leży na wierzchu. */
  function shapeAt(x: number, y: number): Shape | null {
    const shapes = page?.shapes ?? [];
    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      if (shapeHits(shapes[i], x, y, SHAPE_TAP_REACH)) return shapes[i];
    }
    return null;
  }

  function shapePointerDown(x: number, y: number) {
    const hit = shapeAt(x, y);
    if (hit) {
      setSelectedShape(hit.id);
      shapeDrag.current = { what: "move", id: hit.id, grabX: x - hit.x, grabY: y - hit.y, base: hit };
      return;
    }
    setSelectedShape(null);
    const template = shapeTemplate(x, y);
    shapeDrag.current = { what: "draw", startX: x, startY: y, template };
    setDraftShape(template);
  }

  function shapePointerMove(x: number, y: number) {
    const drag = shapeDrag.current;
    if (!drag) return;

    if (drag.what === "draw") {
      setDraftShape(
        fitShapeTo(drag.template, drag.startX, drag.startY, x, y, squareWanted()),
      );
      return;
    }
    if (drag.what === "move") {
      patchShape(drag.id, { ...drag.base, x: x - drag.grabX, y: y - drag.grabY });
      return;
    }
    if (drag.what === "handle") {
      patchShape(drag.id, dragShapeHandle(drag.base, drag.index, x, y, squareWanted()));
      return;
    }
    patchShape(drag.id, rotateShapeTo(drag.base, x, y));
  }

  function shapePointerUp() {
    const drag = shapeDrag.current;
    shapeDrag.current = null;
    secondPointer.current = false;
    if (!drag) return;

    if (drag.what !== "draw") {
      // Przesunięty albo rozciągnięty kształt siedzi już w stronie - w bazie
      // ruchu trzymamy jego stan sprzed gestu, więc wystarczy o nim zapomnieć.
      return;
    }

    const drawn = draftShape;
    setDraftShape(null);
    if (!drawn || !shapeBigEnough(drawn)) return;
    patchPage(pageIndex, (current) => ({
      ...current,
      shapes: [...(current.shapes ?? []), drawn],
    }));
    added.current.push({ kind: "shape", page: pageIndex, id: drawn.id });
    setSelectedShape(drawn.id);
  }

  function pointerKind(event: React.PointerEvent): string {
    if (event.pointerType === "pen") return "stylus";
    if (event.pointerType === "touch") return "finger";
    return "mouse";
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    // Drugi palec w trakcie rysowania kształtu prosi o proporcje 1:1.
    if (shapeDrag.current?.what === "draw" && event.pointerType === "touch") {
      secondPointer.current = true;
      return;
    }

    // Wskaźnik niczego nie rysuje. Kliknięcie obok zdjęcia je odznacza.
    if (tool === "select") {
      setSelectedImage(null);
      return;
    }

    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const { x, y } = clientToPage(event.clientX, event.clientY);

    if (tool === "shapes") {
      shapePointerDown(x, y);
      return;
    }

    if (tool === "eraser") {
      erasing.current = true;
      applyEraser(x, y);
      return;
    }

    const pressure =
      event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    const inkColor =
      color === DEFAULT_INK_COLOR && darkTheme ? DARK_INK_COLOR : color;
    /*
      Zakreślacz bierze barwę wybraną na pasku, tylko przycina jej krycie, żeby
      pismo pod spodem zostało czytelne. Kiedy nikt nic nie wybrał, zostaje
      domyślna żółć.
    */
    const highlighterColor =
      inkColor === DEFAULT_INK_COLOR || inkColor === DARK_INK_COLOR
        ? argbColor(255, 230, 80, 120)
        : withOpacity(inkColor, Math.min(opacityOf(inkColor) || 1, 0.47));
    const stroke = beginStroke({
      tool: tool === "highlighter" ? "highlighter" : tool === "fineliner" ? "fineliner" : "pen",
      color: tool === "highlighter" ? highlighterColor : inkColor,
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

    // Przesuwanie i skalowanie zdjęcia idzie przed rysowaniem, bo wskaźnik
    // nie tworzy żadnej kreski.
    const moving = imageMove.current;
    if (moving) {
      const image = (page?.images ?? []).find((entry) => entry.id === moving.id);
      if (!image) return;
      if (moving.what === "move") {
        patchImage(moving.id, {
          x: Math.round(x - moving.ox),
          y: Math.round(y - moving.oy),
        });
      } else {
        patchImage(moving.id, {
          width: Math.max(24, Math.round(x - moving.ox - image.x)),
          height: Math.max(24, Math.round(y - moving.oy - image.y)),
        });
      }
      return;
    }

    if (shapeDrag.current) {
      shapePointerMove(x, y);
      return;
    }

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
    imageMove.current = null;
    erasing.current = false;
    if (shapeDrag.current) {
      shapePointerUp();
      return;
    }
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
    added.current.push({ kind: "stroke", page: pageIndex, id: finished.id });
  }

  function clearPage() {
    patchPage(pageIndex, (current) => ({ ...current, strokes: [], shapes: [] }));
    added.current = added.current.filter((entry) => entry.page !== pageIndex);
    setSelectedShape(null);
  }

  /**
   * Cofa ostatnią rzecz położoną na kartce - kreskę albo kształt. Spis
   * przybytków prowadzimy sami, bo z samej strony nie da się odczytać, co
   * powstało później: kreski i kształty leżą w osobnych spisach.
   */
  function undoLast() {
    const last = added.current.pop();
    if (!last) {
      // Notatka otwarta z dysku nie ma tego spisu - wtedy jak dotąd schodzi
      // ostatnia kreska bieżącej strony.
      patchPage(pageIndex, (current) => ({
        ...current,
        strokes: (current.strokes ?? []).slice(0, -1),
      }));
      return;
    }
    patchPage(last.page, (current) =>
      last.kind === "stroke"
        ? { ...current, strokes: (current.strokes ?? []).filter((entry) => entry.id !== last.id) }
        : { ...current, shapes: (current.shapes ?? []).filter((entry) => entry.id !== last.id) },
    );
    if (last.kind === "shape" && selectedShape === last.id) setSelectedShape(null);
  }

  // --- Zdjęcia na stronie ---

  // Notatka założona przed chwilą przez autozapis ma już identyfikator, choć
  // strona przyszła bez niego - stąd saved.noteId, a nie sama właściwość.
  const imageAddress = (asset: string) =>
    saved.noteId ? attachmentUrl(saved.noteId, asset, token) : "";

  /** Kładzie załącznik na środku strony i przełącza na narzędzie do przesuwania. */
  function insertImage(asset: string) {
    const shown = 320;
    patchPage(pageIndex, (current) => ({
      ...current,
      images: [
        ...(current.images ?? []),
        {
          id: newId("img"),
          asset,
          x: Math.round((width - shown) / 2),
          y: 90,
          width: shown,
          height: Math.round(shown * 0.72),
          rotation: 0,
        },
      ],
    }));
    setTool("select");
    setPickedImage(asset);
  }

  function patchImage(id: string, patch: Partial<Image>) {
    patchPage(pageIndex, (current) => ({
      ...current,
      images: (current.images ?? []).map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function removeImage(id: string) {
    patchPage(pageIndex, (current) => ({
      ...current,
      images: (current.images ?? []).filter((entry) => entry.id !== id),
    }));
    setSelectedImage(null);
  }

  function onImagePointerDown(event: React.PointerEvent, image: Image, what: "move" | "resize") {
    if (tool !== "select") return;
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setSelectedImage(image.id);
    const { x, y } = clientToPage(event.clientX, event.clientY);
    imageMove.current =
      what === "move"
        ? { id: image.id, ox: x - image.x, oy: y - image.y, what }
        : { id: image.id, ox: x - (image.x + image.width), oy: y - (image.y + image.height), what };
  }

  /** Zmienia sloty i od razu je zapisuje - paleta ma przeżyć zamknięcie karty. */
  function updatePalette(next: number[]) {
    setCustomColors(next);
    savePalette(next);
  }

  /** Wpisuje barwę do wskazanego slotu, zostawiając resztę w spokoju. */
  function paintSlot(index: number, value: number) {
    updatePalette(customColors.map((entry, at) => (at === index ? value : entry)));
  }

  /**
   * Dokłada pusty slot i od razu w niego wchodzi. Jest biały, dopóki nie
   * pomaluje się go paletą - tak jak nowa kredka bez etykiety.
   */
  function addColorSlot() {
    if (customColors.length >= MAX_CUSTOM_COLORS) return;
    updatePalette([...customColors, BLANK_SLOT]);
    setActiveSlot(customColors.length);
    setColor(BLANK_SLOT);
    if (tool === "eraser") setTool("pen");
  }

  /**
   * Barwa z palety zmienia tylko ten slot, w którym stoimy.
   *
   * Okno koloru w systemie woła onChange przy każdym drgnięciu suwaka, a
   * dawniej każde takie drgnięcie dokładało nowy slot - po jednym dobraniu
   * koloru pasek miał ich osiem, wszystkie w prawie tym samym odcieniu i
   * wszystkie zmieniające się naraz przy kolejnym dobieraniu.
   */
  function pickCustomColor(hex: string) {
    const chosen = withOpacity(argbFromHex(hex), opacityOf(color) || 1);
    setColor(chosen);
    if (tool === "eraser") setTool("pen");

    if (activeSlot != null && activeSlot < customColors.length) {
      paintSlot(activeSlot, chosen);
      return;
    }

    // Nikt nie wskazał slotu: pierwsze drgnięcie zakłada jeden i od tej pory
    // całe dobieranie maluje już tylko jego. Gdy slotów jest komplet,
    // przejmujemy ostatni - nowego i tak nie ma gdzie postawić.
    if (customColors.length >= MAX_CUSTOM_COLORS) {
      const last = customColors.length - 1;
      setActiveSlot(last);
      paintSlot(last, chosen);
      return;
    }
    updatePalette([...customColors, chosen]);
    setActiveSlot(customColors.length);
  }

  /** Krycie zmienia barwę pisma, a gdy stoimy w slocie - również jego. */
  function pickOpacity(percent: number) {
    const next = withOpacity(color, percent / 100);
    setColor(next);
    if (activeSlot != null && activeSlot < customColors.length) {
      paintSlot(activeSlot, next);
    }
  }

  function addPage() {
    setPages((list) => {
      const last = list[list.length - 1];
      return [
        ...list,
        emptyPage({
          width: last?.width,
          height: last?.height,
        }),
      ];
    });
    setPageIndex(pages.length);
  }

  // Keep pageIndex in range if pages shrink.
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);

  const visibleStrokes = [...(page?.strokes ?? []), ...(draft ? [draft] : [])];
  const pageBackground = page?.background ?? background;

  /**
   * Ramka wziętego kształtu: obrys po jego rogach (a przy linii - po jej
   * końcach), uchwyty rozmiaru i uchwyt obrotu odsunięty nad górną krawędź.
   * Wszystko w układzie strony, więc obraca się razem z kształtem.
   */
  const selectedShapeFrame = (() => {
    const shape = (page?.shapes ?? []).find((entry) => entry.id === selectedShape);
    if (!shape || tool !== "shapes") return null;

    const points = shapeHandles(shape);
    const handles = [];
    for (let i = 0; i < points.length; i += 2) {
      handles.push({ x: points[i], y: points[i + 1] });
    }

    let outline = `M ${handles[0].x} ${handles[0].y}`;
    for (const handle of handles.slice(1)) outline += ` L ${handle.x} ${handle.y}`;
    if (handles.length > 2) outline += " Z";

    // Uchwyt obrotu odsuwa się od środka przez środek górnej krawędzi, więc
    // przy kształcie obróconym idzie razem z nim.
    const middle = {
      x: (handles[0].x + handles[1].x) / 2,
      y: (handles[0].y + handles[1].y) / 2,
    };
    const center = shapeCenter(shape);
    const away = Math.hypot(middle.x - center.x, middle.y - center.y);
    const ux = away > 1 ? (middle.x - center.x) / away : 0;
    const uy = away > 1 ? (middle.y - center.y) / away : -1;

    return {
      handles,
      outline,
      stem: { x1: middle.x, y1: middle.y },
      rotate: { x: middle.x + ux * ROTATE_GAP, y: middle.y + uy * ROTATE_GAP },
    };
  })();

  function onShapeHandleDown(
    event: React.PointerEvent,
    what: "handle" | "rotate",
    index: number,
  ) {
    const shape = (page?.shapes ?? []).find((entry) => entry.id === selectedShape);
    if (!shape) return;
    // Bez tego kartka pod uchwytem zaczęłaby rysować nowy kształt.
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    shapeDrag.current =
      what === "rotate"
        ? { what: "rotate", id: shape.id, base: shape }
        : { what: "handle", id: shape.id, index, base: shape };
  }

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
      <input type="hidden" name="handwritingJson" value={payload} />

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

      <div className="editor-toolbar" role="toolbar" aria-label={words.handwritingToolbar}>
        {(
          [
            ["pen", words.toolPen, "stylus"],
            ["fineliner", words.toolFineliner, "edit"],
            ["highlighter", words.toolHighlighter, "ink_highlighter"],
            ["eraser", words.toolEraser, "ink_eraser"],
            ["shapes", words.toolShapes, "shapes"],
            ["select", words.toolPointer, "arrow_selector_tool"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            className={`compact icon-only${tool === id ? " on" : ""}`}
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => {
              setTool(id);
              // Kształt zostaje wzięty tylko przy narzędziu, które umie go ruszyć.
              if (id !== "shapes") setSelectedShape(null);
            }}
          >
            <Icon name={icon} filled={tool === id} />
          </button>
        ))}
        <button
          type="button"
          className="compact icon-only"
          title={words.undoLastThing}
          aria-label={words.undoLastThing}
          disabled={(page?.strokes ?? []).length === 0 && (page?.shapes ?? []).length === 0}
          onClick={undoLast}
        >
          <Icon name="undo" />
        </button>

        <span className="toolbar-sep" />

        {/* Kształty: rodzaj, wypełnienie, proporcje i kosz na ten wzięty. */}
        {tool === "shapes" ? (
          <>
            {shapeKinds(words).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`compact icon-only${shapeKind === entry.id ? " on" : ""}`}
                title={entry.label}
                aria-label={entry.label}
                aria-pressed={shapeKind === entry.id}
                onClick={() => setShapeKind(entry.id)}
              >
                <Icon name={entry.icon} filled={shapeKind === entry.id} />
              </button>
            ))}
            <button
              type="button"
              className={`compact icon-only${shapeFilled ? " on" : ""}`}
              title={shapeFilled ? words.shapeFillOff : words.shapeFillOn}
              aria-label={shapeFilled ? words.shapeFillOff : words.shapeFillOn}
              aria-pressed={shapeFilled}
              onClick={() => setShapeFilled((on) => !on)}
            >
              <Icon name="format_color_fill" filled={shapeFilled} />
            </button>
            <button
              type="button"
              className={`compact icon-only${squareLock ? " on" : ""}`}
              title={words.shapeSquareLock}
              aria-label={words.shapeSquareLock}
              aria-pressed={squareLock}
              onClick={() => setSquareLock((on) => !on)}
            >
              <Icon name="square_foot" filled={squareLock} />
            </button>
            {selectedShape ? (
              <button
                type="button"
                className="compact icon-only"
                title={words.shapeRemove}
                aria-label={words.shapeRemove}
                onClick={() => removeShape(selectedShape)}
              >
                <Icon name="delete" />
              </button>
            ) : null}
            <span className="toolbar-sep" />
          </>
        ) : null}

        {penColours(words).map((entry) => {
          const active = activeSlot == null && color === entry.color;
          return (
            <button
              key={entry.id}
              type="button"
              className={`ink-swatch${active ? " active" : ""}`}
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={active}
              onClick={() => {
                setColor(entry.color);
                setActiveSlot(null);
                if (entry.id === "highlighter") setTool("highlighter");
                else if (tool === "eraser") setTool("pen");
              }}
              style={{
                background: displayInkColor(entry.color),
              }}
            />
          );
        })}

        {/*
          Własne kolory. Klucz idzie z miejsca w rzędzie, nie z barwy: dwa
          sloty wolno pomalować tak samo, a slot pomalowany na nowo ma zostać
          tym samym kółkiem, nie nowym.
        */}
        {customColors.map((entry, index) => (
          <button
            key={index}
            type="button"
            className={`ink-swatch${activeSlot === index ? " active" : ""}`}
            title={ownColourSlotHint(words, index + 1)}
            aria-label={ownColourSlot(words, index + 1)}
            aria-pressed={activeSlot === index}
            onClick={() => {
              setColor(entry);
              setActiveSlot(index);
              if (tool === "eraser") setTool("pen");
            }}
            style={{ background: displayInkColor(entry) }}
          />
        ))}

        <button
          type="button"
          className="ink-swatch blank"
          title={
            customColors.length >= MAX_CUSTOM_COLORS
              ? tooManyOwnColours(words, MAX_CUSTOM_COLORS)
              : words.addOwnColour
          }
          aria-label={words.addOwnColour}
          disabled={customColors.length >= MAX_CUSTOM_COLORS}
          onClick={addColorSlot}
        >
          <Icon name="add" size={16} />
        </button>

        <label
          className="small"
          style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
          title={
            activeSlot == null
              ? words.pickOwnColourNewSlot
              : changeOwnColour(words, activeSlot + 1)
          }
        >
          <Icon name="palette" size={18} />
          <input
            type="color"
            aria-label={words.ownInkColour}
            value={hexFromArgb(color, "#23211d")}
            onChange={(event) => pickCustomColor(event.target.value)}
            style={{
              width: 34,
              height: 30,
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
          style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
          title={words.strokeOpacity}
        >
          <Icon name="opacity" size={18} />
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            aria-label={words.strokeOpacity}
            value={Math.round((opacityOf(color) || 1) * 100)}
            onChange={(event) => pickOpacity(Number(event.target.value))}
            style={{ width: 84 }}
          />
        </label>

        <span className="toolbar-sep" />

        {SIZES.map((value) => (
          <button
            key={value}
            type="button"
            className={`compact${size === value ? " on" : ""}`}
            onClick={() => setSize(value)}
          >
            {value}
          </button>
        ))}

        <span className="toolbar-sep" />

        <label className="small" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="grid_on" size={18} />
          {words.backgroundWord}
          <select
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            style={{ width: "auto", minHeight: 36, padding: "4px 30px 4px 8px" }}
          >
            <option value="plain">{words.bgPlain}</option>
            <option value="lined">{words.bgLined}</option>
            <option value="grid">{words.bgGrid}</option>
            <option value="dots">{words.bgDots}</option>
            <option value="stave">{words.bgStave}</option>
          </select>
        </label>
        <button type="button" className="compact" onClick={addPage}>
          <Icon name="note_add" size={18} />
          {words.pageButton}
        </button>
        <button type="button" className="compact danger" onClick={() => setAskingClear(true)}>
          <Icon name="delete_sweep" size={18} />
          {words.clearPage}
        </button>
        {askingClear ? (
          <ConfirmDialog
            question={words.confirmClearPage}
            confirmLabel={words.clearPage}
            danger
            onCancel={() => setAskingClear(false)}
            onConfirm={() => {
              setAskingClear(false);
              clearPage();
            }}
          />
        ) : null}

        {/* Zdjęcia: wysłanie prosto z paska i wstawianie tych już wysłanych. */}
        <span className="toolbar-sep" />
        {uploadAction ? (
          <>
            {/* Pole na plik nie ma się pokazywać - klika się w przycisk obok. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              style={{ display: "none" }}
              onChange={onPickFile}
            />
            <button
              type="button"
              className="compact"
              disabled={!saved.noteId || uploading}
              title={
                saved.noteId
                  ? words.uploadAndPlace
                  : words.drawSomethingFirst
              }
              onClick={() => fileRef.current?.click()}
            >
              <Icon name={uploading ? "hourglass_top" : "add_photo_alternate"} size={18} />
              {uploading ? words.uploadingWord : words.photoWord}
            </button>
          </>
        ) : null}
        {saved.noteId ? (
          <>
            {pictures.length > 0 ? (
              <>
                <select
                  aria-label={words.photoToInsert}
                  value={pickedImage ?? ""}
                  onChange={(event) => setPickedImage(event.target.value || null)}
                  style={{ width: "auto", maxWidth: 190, minHeight: 36, padding: "4px 30px 4px 8px" }}
                >
                  <option value="">{words.choosePhoto}</option>
                  {pictures.map((file) => (
                    <option key={file.name} value={file.name}>
                      {file.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="compact"
                  disabled={!pickedImage}
                  onClick={() => pickedImage && insertImage(pickedImage)}
                >
                  <Icon name="image" size={18} />
                  {words.insertAgain}
                </button>
              </>
            ) : null}
            {selectedImage ? (
              <button
                type="button"
                className="compact danger icon-only"
                title={words.removeSelectedPhoto}
                aria-label={words.removeSelectedPhoto}
                onClick={() => removeImage(selectedImage)}
              >
                <Icon name="hide_image" />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="row-spread" style={{ marginTop: 10, marginBottom: 8 }}>
        <p className="small" style={{ margin: 0 }}>
          {words.pageWord} {pageIndex + 1} {words.ofWord} {pages.length} ·{" "}
          {words.pageGrowsHint}
        </p>
        <div className="row">
          <button
            type="button"
            className="compact"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            title={words.previousPage}
            aria-label={words.previousPage}
          >
            <Icon name="chevron_left" />
          </button>
          <button
            type="button"
            className="compact"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            title={words.nextPage}
            aria-label={words.nextPage}
          >
            <Icon name="chevron_right" />
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
          aria-label={words.handwritingCanvas}
          style={{
            width: "100%",
            maxWidth: 720,
            /* Wysokość idzie za proporcją viewBox. Wymuszanie jej z góry
               (720/595 strony) rozciągało kartkę na telefonie: rysunek
               lądował w środku z pustymi pasami u góry i u dołu. */
            height: "auto",
            display: "block",
            margin: "0 auto",
            background: "var(--sheet)",
            cursor: tool === "eraser" ? "cell" : tool === "select" ? "default" : "crosshair",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <PageBackdrop kind={pageBackground} width={width} height={height} />

          {/*
            Zdjęcia leżą pod pismem, tak samo jak w aplikacji. Wcześniej edytor
            w ogóle ich nie rysował: wstawione na tablecie były niewidoczne, a
            załącznik wysłany tutaj nie miał jak trafić na stronę.
          */}
          {(page?.images ?? []).map((image) => {
            const chosen = tool === "select" && selectedImage === image.id;
            return (
              <g key={image.id}>
                <image
                  href={imageAddress(image.asset)}
                  x={image.x}
                  y={image.y}
                  width={image.width}
                  height={image.height}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ cursor: tool === "select" ? "move" : "inherit" }}
                  onPointerDown={(event) => onImagePointerDown(event, image, "move")}
                />
                {chosen ? (
                  <>
                    <rect
                      x={image.x}
                      y={image.y}
                      width={image.width}
                      height={image.height}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                    <rect
                      x={image.x + image.width - 7}
                      y={image.y + image.height - 7}
                      width="14"
                      height="14"
                      rx="2"
                      fill="var(--sheet)"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      style={{ cursor: "nwse-resize" }}
                      onPointerDown={(event) => onImagePointerDown(event, image, "resize")}
                    />
                  </>
                ) : null}
              </g>
            );
          })}

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
                  color: displayInkColor(box.color),
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

          {/* Kształty leżą nad zdjęciami, pod atramentem - po kształcie da się pisać. */}
          {[...(page?.shapes ?? []), ...(draftShape ? [draftShape] : [])].map((shape) => (
            <path
              key={shape.id}
              d={shapePath(shape)}
              transform={shapeTransform(shape)}
              fill={!isOpenShape(shape.kind) && shape.fill ? displayInkColor(shape.fill) : "none"}
              fillOpacity={
                !isOpenShape(shape.kind) && shape.fill ? shapeFillOpacity(shape) : undefined
              }
              stroke={displayInkColor(shape.color)}
              strokeOpacity={shapeStrokeOpacity(shape)}
              strokeWidth={shapeStrokeWidth(shape)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {selectedShapeFrame ? (
            <g>
              <path
                d={selectedShapeFrame.outline}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                pointerEvents="none"
              />
              <line
                x1={selectedShapeFrame.stem.x1}
                y1={selectedShapeFrame.stem.y1}
                x2={selectedShapeFrame.rotate.x}
                y2={selectedShapeFrame.rotate.y}
                stroke="var(--accent)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
              <circle
                cx={selectedShapeFrame.rotate.x}
                cy={selectedShapeFrame.rotate.y}
                r={HANDLE_RADIUS}
                fill="var(--sheet)"
                stroke="var(--accent)"
                strokeWidth="2"
                style={{ cursor: "grab" }}
                onPointerDown={(event) => onShapeHandleDown(event, "rotate", 0)}
              />
              {selectedShapeFrame.handles.map((handle, index) => (
                <circle
                  key={index}
                  cx={handle.x}
                  cy={handle.y}
                  r={HANDLE_RADIUS}
                  fill="var(--sheet)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  style={{ cursor: "nwse-resize" }}
                  onPointerDown={(event) => onShapeHandleDown(event, "handle", index)}
                />
              ))}
            </g>
          ) : null}

          {visibleStrokes.map((stroke) => {
            const path = strokePath(stroke);
            if (!path) return null;
            const highlighter = stroke.tool === "highlighter";
            return (
              <path
                key={stroke.id}
                d={path}
                fill="none"
                stroke={displayInkColor(stroke.color)}
                strokeWidth={stroke.size || 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={highlighter ? "stroke-highlighter" : undefined}
              />
            );
          })}
        </svg>
      </div>

      {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
          kartką przeskakiwałaby przy każdym autozapisie. Pełny błąd też stoi
          tutaj, przy przycisku: na górze spychał całą kartkę w dół. */}
      {state.error ? (
        <p className="error" style={{ margin: "10px 0" }}>
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
