import {
  argbColor,
  packStrokePoint,
  readDocument,
  type NoteDocument,
  type Page,
  type Stroke,
} from "./document";

export type HandwritingBody = {
  pageMode: string;
  background: string;
  pages: Page[];
};

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/** Default ink colour matching Kajet sheet text (#23211d). */
export const DEFAULT_INK_COLOR = argbColor(35, 33, 29);

/** Its dark-theme counterpart (#e8e4da) - the same pair as defaultInk in the app. */
export const DARK_INK_COLOR = argbColor(232, 228, 218);

/**
 * Page width/height pick the tablet card (A4 vs one long sheet). The web
 * canvas may grow for drawing, but a save must not rewrite those numbers
 * from ink — there is no page-size control on the website.
 */
export function preservePageDimensions(pages: Page[], existing?: NoteDocument | null): Page[] {
  const previous = existing?.handwriting?.pages ?? [];
  if (previous.length === 0) return pages;
  const byId = new Map(previous.map((page) => [page.id, page]));
  return pages.map((page) => {
    const was = byId.get(page.id);
    if (!was) return page;
    return { ...page, width: was.width, height: was.height };
  });
}

/** Build content.json for a HANDWRITTEN note matching FORMAT.md. */
export function buildHandwritingNoteContent(options: {
  id: string;
  title: string;
  pages: Page[];
  pageMode?: string;
  background?: string;
  existing?: NoteDocument | null;
}): string {
  const now = Date.now();
  const existing = options.existing;

  return JSON.stringify({
    format: existing?.format ?? 1,
    id: options.id,
    kind: "handwritten",
    title: options.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    handwriting: {
      pageMode: options.pageMode ?? existing?.handwriting?.pageMode ?? "a4",
      background: options.background ?? existing?.handwriting?.background ?? "lined",
      pages: preservePageDimensions(options.pages, existing),
    },
  });
}

export function parseHandwritingNote(content: string): HandwritingBody | null {
  const document = readDocument(content);
  if (!document) return null;
  if (!document.handwriting) {
    return {
      pageMode: "a4",
      background: "lined",
      pages: [emptyPage()],
    };
  }
  return {
    pageMode: document.handwriting.pageMode ?? "a4",
    background: document.handwriting.background ?? "lined",
    pages:
      document.handwriting.pages && document.handwriting.pages.length > 0
        ? document.handwriting.pages
        : [emptyPage()],
  };
}

export function parseExistingHandwritingDocument(content: string): NoteDocument | null {
  return readDocument(content);
}

export function emptyPage(partial?: Partial<Page>): Page {
  return {
    id: partial?.id ?? newId(),
    width: partial?.width ?? A4_WIDTH,
    height: partial?.height ?? A4_HEIGHT,
    background: partial?.background,
    strokes: partial?.strokes ?? [],
    shapes: partial?.shapes ?? [],
    texts: partial?.texts ?? [],
    images: partial?.images ?? [],
    recognized: partial?.recognized ?? [],
  };
}

export function defaultHandwritingSeed(): HandwritingBody {
  return {
    pageMode: "a4",
    background: "lined",
    pages: [emptyPage()],
  };
}

/** Start a new stroke from a pointer sample (mouse / touch / pen). */
export function beginStroke(options: {
  id?: string;
  tool?: string;
  color: number;
  size: number;
  x: number;
  y: number;
  input?: string;
  pressure?: number;
}): Stroke {
  const pressure = options.pressure ?? 0.5;
  return {
    id: options.id ?? newId(),
    tool: options.tool ?? "pen",
    color: options.color,
    size: options.size,
    epsilon: 0.1,
    input: options.input ?? "mouse",
    points: packStrokePoint(options.x, options.y, 0, pressure),
  };
}

/** Append a sample; timeMs is elapsed since stroke start. */
export function appendStrokePoint(
  stroke: Stroke,
  x: number,
  y: number,
  timeMs: number,
  pressure = 0.5,
): Stroke {
  return {
    ...stroke,
    points: [...(stroke.points ?? []), ...packStrokePoint(x, y, timeMs, pressure)],
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `hw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
