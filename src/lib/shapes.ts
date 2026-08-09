/*
  Kształty wstawiane ręcznie: linia, strzałka, prostokąt, prostokąt
  zaokrąglony, elipsa, trójkąt, romb i gwiazda.

  Odbicie `ink/ShapeGeometry.kt` z aplikacji. Obie strony muszą liczyć to samo,
  bo ten sam plik notatki rysuje raz tablet, a raz przeglądarka - elipsa
  narysowana rysikiem ma tu wyjść tą samą elipsą, co do punktu.

  Kształt siedzi w prostokącie odniesienia i dopiero potem obraca się o
  `rotation` wokół swojego środka. Figury zamknięte mają boki dodatnie; linia i
  strzałka mogą mieć `width` albo `height` ujemne, bo ich końce to (x, y) oraz
  (x + width, y + height), a grot strzałki siedzi na tym drugim.
*/

export type ShapeKind =
  | "line"
  | "arrow"
  | "rect"
  | "round_rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star";

export type Shape = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** Barwa obrysu w ARGB, jak przy kresce. */
  color: number;
  strokeWidth?: number;
  /** Wypełnienie w ARGB; zero znaczy „bez wypełnienia". */
  fill?: number;
  opacity?: number;
  /** Zaokrąglenie rogu jako ułamek krótszego boku. */
  corner?: number;
};

/** Poniżej tego boku przeciągnięcie było stuknięciem, nie rysowaniem. */
export const MIN_SHAPE_SIDE = 6;

const ELLIPSE_STEPS = 48;
const STAR_ARMS = 5;
const STAR_INNER = 0.382;
const ARROW_HEAD_DEGREES = 26;
const ANGLE_SNAP_DEG = 45;
const ANGLE_SNAP_TOLERANCE_DEG = 4;

const DEG = Math.PI / 180;

export function isOpenShape(kind: ShapeKind): boolean {
  return kind === "line" || kind === "arrow";
}

export function shapeStrokeWidth(shape: Shape): number {
  return shape.strokeWidth && shape.strokeWidth > 0 ? shape.strokeWidth : 2;
}

export function shapeRotation(shape: Shape): number {
  return shape.rotation ?? 0;
}

export function shapeCenter(shape: Shape): { x: number; y: number } {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** Prostokąt odniesienia z bokami rosnącymi - linia w lewo ma ujemną szerokość. */
export function shapeBox(shape: Shape): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const left = Math.min(shape.x, shape.x + shape.width);
  const right = Math.max(shape.x, shape.x + shape.width);
  const top = Math.min(shape.y, shape.y + shape.height);
  const bottom = Math.max(shape.y, shape.y + shape.height);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// --- Punkty ---

/** Wierzchołki PRZED obrotem: x, y, x, y… Elipsa dostaje wielokąt przybliżający. */
export function localShapePoints(shape: Shape): number[] {
  const { left, top, right, bottom, width, height } = shapeBox(shape);

  switch (shape.kind) {
    case "line":
    case "arrow":
      return [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height];
    case "rect":
    case "round_rect":
      return [left, top, right, top, right, bottom, left, bottom];
    case "triangle":
      return [left + width / 2, top, right, bottom, left, bottom];
    case "diamond":
      return [
        left + width / 2, top,
        right, top + height / 2,
        left + width / 2, bottom,
        left, top + height / 2,
      ];
    case "star":
      return starPoints(left, top, width, height);
    case "ellipse":
    default:
      return ellipsePoints(left, top, width, height);
  }
}

function starPoints(left: number, top: number, width: number, height: number): number[] {
  const cx = left + width / 2;
  const cy = top + height / 2;
  const points: number[] = [];
  for (let i = 0; i < STAR_ARMS * 2; i += 1) {
    const angle = (-90 + (i * 180) / STAR_ARMS) * DEG;
    const reach = i % 2 === 0 ? 0.5 : 0.5 * STAR_INNER;
    points.push(cx + width * reach * Math.cos(angle));
    points.push(cy + height * reach * Math.sin(angle));
  }
  return points;
}

function ellipsePoints(left: number, top: number, width: number, height: number): number[] {
  const cx = left + width / 2;
  const cy = top + height / 2;
  const points: number[] = [];
  for (let i = 0; i < ELLIPSE_STEPS; i += 1) {
    const angle = (2 * Math.PI * i) / ELLIPSE_STEPS;
    points.push(cx + (width / 2) * Math.cos(angle));
    points.push(cy + (height / 2) * Math.sin(angle));
  }
  return points;
}

export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  degrees: number,
): [number, number] {
  if (!degrees) return [px, py];
  const angle = degrees * DEG;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function rotateAll(points: number[], cx: number, cy: number, degrees: number): number[] {
  if (!degrees) return points;
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const [x, y] = rotatePoint(points[i], points[i + 1], cx, cy, degrees);
    out.push(x, y);
  }
  return out;
}

/** Wierzchołki po obrocie - tak, jak kształt leży na stronie. */
export function shapePoints(shape: Shape): number[] {
  const center = shapeCenter(shape);
  return rotateAll(localShapePoints(shape), center.x, center.y, shapeRotation(shape));
}

/**
 * Punkty uchwytów: cztery rogi prostokąta odniesienia, a przy linii i strzałce
 * dwa końce. Rogi idą od lewego górnego zgodnie z zegarem, więc uchwyt
 * naprzeciwko to `(i + 2) % 4`.
 */
export function shapeHandles(shape: Shape): number[] {
  const center = shapeCenter(shape);
  const local = isOpenShape(shape.kind)
    ? [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height]
    : cornersOf(shape);
  return rotateAll(local, center.x, center.y, shapeRotation(shape));
}

function cornersOf(shape: Shape): number[] {
  const { left, top, right, bottom } = shapeBox(shape);
  return [left, top, right, top, right, bottom, left, bottom];
}

/** Prostokąt obejmujący kształt PO obrocie, z zapasem na grubość obrysu. */
export function shapeBounds(shape: Shape): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const points = shapePoints(shape);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  const reach = shapeStrokeWidth(shape) / 2;
  return { left: minX - reach, top: minY - reach, right: maxX + reach, bottom: maxY + reach };
}

// --- Trafianie ---

/**
 * Kształt wypełniony bierze się całym polem, pusty tylko obrysem - inaczej duży
 * prostokąt narysowany wokół notatek łapałby każde kliknięcie wymierzone
 * w pismo pod nim.
 */
export function shapeHits(shape: Shape, px: number, py: number, tolerance: number): boolean {
  const center = shapeCenter(shape);
  const [lx, ly] = rotatePoint(px, py, center.x, center.y, -shapeRotation(shape));
  const points = localShapePoints(shape);
  const reach = tolerance + shapeStrokeWidth(shape) / 2;

  if (isOpenShape(shape.kind)) {
    return distanceToSegment(lx, ly, points[0], points[1], points[2], points[3]) <= reach;
  }

  const fill = shape.fill ?? 0;
  const filled = fill !== 0 && (fill >>> 24) !== 0;
  if (filled && inPolygon(lx, ly, points)) return true;
  return edgeDistance(lx, ly, points) <= reach;
}

export function inPolygon(px: number, py: number, polygon: number[]): boolean {
  let inside = false;
  const count = polygon.length / 2;
  let j = count - 1;
  for (let i = 0; i < count; i += 1) {
    const xi = polygon[i * 2];
    const yi = polygon[i * 2 + 1];
    const xj = polygon[j * 2];
    const yj = polygon[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function edgeDistance(px: number, py: number, polygon: number[]): number {
  const count = polygon.length / 2;
  let best = Number.POSITIVE_INFINITY;
  let j = count - 1;
  for (let i = 0; i < count; i += 1) {
    best = Math.min(
      best,
      distanceToSegment(
        px, py,
        polygon[j * 2], polygon[j * 2 + 1],
        polygon[i * 2], polygon[i * 2 + 1],
      ),
    );
    j = i;
  }
  return best;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// --- Rysowanie przeciągnięciem i uchwytami ---

/**
 * Kształt rozciągnięty od punktu do punktu - tak powstaje przy rysowaniu.
 * `square` to proporcje 1:1: figura zamknięta dostaje równe boki, a linia
 * i strzałka kąt dosnapowany do wielokrotności 45 stopni.
 */
export function fitShapeTo(
  shape: Shape,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  square: boolean,
): Shape {
  let dx = endX - startX;
  let dy = endY - startY;

  if (square) {
    if (isOpenShape(shape.kind)) {
      const length = Math.hypot(dx, dy);
      const snapped = Math.round(Math.atan2(dy, dx) / DEG / 45) * 45 * DEG;
      dx = length * Math.cos(snapped);
      dy = length * Math.sin(snapped);
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = side * (dx < 0 ? -1 : 1);
      dy = side * (dy < 0 ? -1 : 1);
    }
  }

  if (isOpenShape(shape.kind)) {
    return { ...shape, x: startX, y: startY, width: dx, height: dy };
  }
  return {
    ...shape,
    x: Math.min(startX, startX + dx),
    y: Math.min(startY, startY + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

/**
 * Kształt po przeciągnięciu uchwytu do punktu na stronie. Uchwyt naprzeciwko
 * stoi w miejscu, także przy kształcie obróconym - dlatego rachunek idzie
 * w układzie kształtu, a środek wraca na stronę obrócony o ten sam kąt.
 */
export function dragShapeHandle(
  shape: Shape,
  index: number,
  px: number,
  py: number,
  square: boolean,
): Shape {
  const center = shapeCenter(shape);
  const rotation = shapeRotation(shape);
  const [mx, my] = rotatePoint(px, py, center.x, center.y, -rotation);

  const handles = isOpenShape(shape.kind)
    ? [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height]
    : cornersOf(shape);
  const count = handles.length / 2;
  if (index < 0 || index >= count) return shape;

  const opposite = isOpenShape(shape.kind) ? (index + 1) % 2 : (index + 2) % 4;
  const anchorX = handles[opposite * 2];
  const anchorY = handles[opposite * 2 + 1];

  const stretched =
    isOpenShape(shape.kind) && index === 0
      ? fitShapeTo(shape, mx, my, anchorX, anchorY, square)
      : fitShapeTo(shape, anchorX, anchorY, mx, my, square);

  const moved = shapeCenter(stretched);
  const [cx, cy] = rotatePoint(moved.x, moved.y, center.x, center.y, rotation);
  return { ...stretched, x: cx - stretched.width / 2, y: cy - stretched.height / 2 };
}

/** Kąt kształtu ciągniętego za uchwyt stojący nad górną krawędzią. */
export function rotateShapeTo(shape: Shape, px: number, py: number): Shape {
  const center = shapeCenter(shape);
  const raw = Math.atan2(py - center.y, px - center.x) / DEG + 90;
  let degrees = ((raw % 360) + 360) % 360;
  const snapped = Math.round(degrees / ANGLE_SNAP_DEG) * ANGLE_SNAP_DEG;
  if (Math.abs(degrees - snapped) <= ANGLE_SNAP_TOLERANCE_DEG) degrees = snapped % 360;
  return { ...shape, rotation: degrees };
}

/** Czy kształt jest już czymś więcej niż kliknięciem. */
export function shapeBigEnough(shape: Shape): boolean {
  return Math.max(Math.abs(shape.width), Math.abs(shape.height)) >= MIN_SHAPE_SIDE;
}

// --- Rysunek ---

/**
 * Ścieżka SVG kształtu, BEZ obrotu - ten nakłada się osobno przez
 * {@link shapeTransform}, żeby nie przeliczać łuków elipsy.
 */
export function shapePath(shape: Shape): string {
  const { left, top, right, bottom, width, height } = shapeBox(shape);

  if (isOpenShape(shape.kind)) {
    const x1 = shape.x;
    const y1 = shape.y;
    const x2 = shape.x + shape.width;
    const y2 = shape.y + shape.height;
    let path = `M ${round(x1)} ${round(y1)} L ${round(x2)} ${round(y2)}`;
    if (shape.kind === "arrow") path += arrowHead(x1, y1, x2, y2, shapeStrokeWidth(shape));
    return path;
  }

  if (shape.kind === "ellipse") {
    const rx = width / 2;
    const ry = height / 2;
    const cx = left + rx;
    const cy = top + ry;
    // Dwa półłuki - jeden łuk nie umie domknąć pełnej elipsy.
    return (
      `M ${round(cx - rx)} ${round(cy)} ` +
      `A ${round(rx)} ${round(ry)} 0 1 0 ${round(cx + rx)} ${round(cy)} ` +
      `A ${round(rx)} ${round(ry)} 0 1 0 ${round(cx - rx)} ${round(cy)} Z`
    );
  }

  if (shape.kind === "round_rect") {
    const radius = Math.max(0, Math.min(0.5, shape.corner ?? 0.18)) * Math.min(width, height);
    if (radius <= 0.01) return polygonPath([left, top, right, top, right, bottom, left, bottom]);
    const r = round(radius);
    return (
      `M ${round(left + radius)} ${round(top)} ` +
      `L ${round(right - radius)} ${round(top)} A ${r} ${r} 0 0 1 ${round(right)} ${round(top + radius)} ` +
      `L ${round(right)} ${round(bottom - radius)} A ${r} ${r} 0 0 1 ${round(right - radius)} ${round(bottom)} ` +
      `L ${round(left + radius)} ${round(bottom)} A ${r} ${r} 0 0 1 ${round(left)} ${round(bottom - radius)} ` +
      `L ${round(left)} ${round(top + radius)} A ${r} ${r} 0 0 1 ${round(left + radius)} ${round(top)} Z`
    );
  }

  return polygonPath(localShapePoints(shape));
}

function polygonPath(points: number[]): string {
  let path = `M ${round(points[0])} ${round(points[1])}`;
  for (let i = 2; i < points.length; i += 2) {
    path += ` L ${round(points[i])} ${round(points[i + 1])}`;
  }
  return `${path} Z`;
}

function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number,
): string {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return "";
  // Grot rośnie z grubością kreski, ale nigdy nie zjada całej strzałki.
  const head = Math.min(Math.max(10, strokeWidth * 5), length * 0.4);
  const direction = Math.atan2(y2 - y1, x2 - x1);
  const spread = ARROW_HEAD_DEGREES * DEG;
  const leftX = x2 - head * Math.cos(direction - spread);
  const leftY = y2 - head * Math.sin(direction - spread);
  const rightX = x2 - head * Math.cos(direction + spread);
  const rightY = y2 - head * Math.sin(direction + spread);
  return (
    ` M ${round(x2)} ${round(y2)} L ${round(leftX)} ${round(leftY)}` +
    ` M ${round(x2)} ${round(y2)} L ${round(rightX)} ${round(rightY)}`
  );
}

/** Obrót kształtu jako przekształcenie SVG albo nic, gdy kształt stoi prosto. */
export function shapeTransform(shape: Shape): string | undefined {
  const rotation = shapeRotation(shape);
  if (!rotation) return undefined;
  const center = shapeCenter(shape);
  return `rotate(${round(rotation)} ${round(center.x)} ${round(center.y)})`;
}

/*
  Krycie kształtu jako osobny atrybut SVG.

  Kanał alfa barwy siedzi już w samym zapisie koloru (`rgb(r g b / a)`), więc
  tutaj wchodzi wyłącznie mnożnik z pola `opacity`. Policzenie obu naraz
  przygaszałoby kształt dwa razy: figura obrysowana na wpół przezroczystym
  atramentem prawie znikałaby z kartki.
*/
export function shapeStrokeOpacity(shape: Shape): number {
  return clampOpacity(shape.opacity);
}

export function shapeFillOpacity(shape: Shape): number {
  return clampOpacity(shape.opacity);
}

function clampOpacity(opacity: number | undefined): number {
  if (opacity === undefined || Number.isNaN(opacity)) return 1;
  return Math.max(0, Math.min(1, opacity));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
