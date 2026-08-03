export type NoteKind = "HANDWRITTEN" | "TEXT" | "MINDMAP" | "CODE";

export const VALUES_PER_POINT = 6;

export type Stroke = {
  id: string;
  tool?: string;
  color: number;
  size: number;
  epsilon?: number;
  input?: string;
  points: number[];
};

export type TextBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  color: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font?: string;
  align?: string;
  background?: number;
};

export type Image = {
  id: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type Page = {
  id: string;
  width?: number;
  height?: number;
  background?: string | null;
  strokes?: Stroke[];
  texts?: TextBox[];
  images?: Image[];
  recognized?: { id: string; text: string }[];
};

export type MindNode = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  shape?: string;
  text?: string;
  ink?: Stroke[];
  colorId?: string;
  customColor?: number;
  fontSize?: number;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  align?: string;
  textColor?: number;
  collapsed?: boolean;
};

export type MindEdge = { id: string; fromId: string; toId: string };

export type NoteDocument = {
  format?: number;
  id: string;
  kind?: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  tags?: string[];
  favorite?: boolean;
  handwriting?: {
    pageMode?: string;
    background?: string;
    pages?: Page[];
  } | null;
  text?: {
    markdown?: string;
    drawings?: { asset: string; source: string; width: number; height: number }[];
  } | null;
  mindMap?: {
    nodes?: MindNode[];
    edges?: MindEdge[];
    viewX?: number;
    viewY?: number;
    zoom?: number;
  } | null;
  code?: {
    language?: string;
    source?: string;
  } | null;
};

export function readDocument(content: string): NoteDocument | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as NoteDocument;
  } catch {
    return null;
  }
}

export function cssColor(argb: number | undefined, fallback = "#23211d"): string {
  if (argb === undefined || argb === null || Number.isNaN(argb)) return fallback;

  // Colours arrive from Android as signed numbers, so a negative value is a
  // normal colour with the top alpha bit set.
  const unsigned = argb >>> 0;
  const a = (unsigned >>> 24) & 0xff;
  const r = (unsigned >>> 16) & 0xff;
  const g = (unsigned >>> 8) & 0xff;
  const b = unsigned & 0xff;

  if (a === 0 && r === 0 && g === 0 && b === 0) return fallback;
  if (a === 255) return `rgb(${r} ${g} ${b})`;
  return `rgb(${r} ${g} ${b} / ${(a / 255).toFixed(3)})`;
}

export function cssFont(font: string | undefined): string {
  switch (font) {
    case "heading":
      return "var(--font-heading)";
    case "mono":
      return "var(--font-mono)";
    default:
      return "var(--font-body)";
  }
}

export function cssAlign(align: string | undefined): "left" | "center" | "right" {
  switch (align) {
    case "center":
      return "center";
    case "right":
      return "right";
    default:
      return "left";
  }
}

export function strokePath(stroke: Stroke): string {
  const points = stroke.points ?? [];
  const count = Math.floor(points.length / VALUES_PER_POINT);
  if (count === 0) return "";

  const x = (i: number) => points[i * VALUES_PER_POINT];
  const y = (i: number) => points[i * VALUES_PER_POINT + 1];

  if (count === 1) {
    // A dot. A very short segment with round caps gives a full circle.
    return `M ${x(0)} ${y(0)} L ${x(0) + 0.01} ${y(0)}`;
  }

  let path = `M ${x(0)} ${y(0)}`;
  for (let i = 1; i < count - 1; i += 1) {
    const midX = (x(i) + x(i + 1)) / 2;
    const midY = (y(i) + y(i + 1)) / 2;
    path += ` Q ${x(i)} ${y(i)} ${midX} ${midY}`;
  }
  path += ` L ${x(count - 1)} ${y(count - 1)}`;
  return path;
}

export function strokeBounds(strokes: Stroke[]): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let empty = true;

  for (const stroke of strokes) {
    const points = stroke.points ?? [];
    for (let i = 0; i + 1 < points.length; i += VALUES_PER_POINT) {
      empty = false;
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
  }

  return empty ? null : { left: minX, top: minY, right: maxX, bottom: maxY };
}

export function preview(document: NoteDocument | null, maxChars = 160): string {
  if (!document) return "";

  if (document.text?.markdown) {
    return document.text.markdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/[#*_>`~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  }

  if (document.mindMap?.nodes?.length) {
    return document.mindMap.nodes
      .map((node) => node.text)
      .filter(Boolean)
      .join(", ")
      .slice(0, maxChars);
  }

  const recognized = document.handwriting?.pages
    ?.flatMap((page) => page.recognized ?? [])
    .map((entry) => entry.text)
    .filter(Boolean)
    .join(" ");

  return recognized?.slice(0, maxChars) ?? "";
}
