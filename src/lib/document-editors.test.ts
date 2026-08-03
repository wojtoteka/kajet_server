import { describe, expect, it } from "vitest";
import {
  VALUES_PER_POINT,
  packStrokePoint,
  eraseStrokeFragment,
  strokeHitsCircle,
  argbColor,
  type Stroke,
} from "./document";
import {
  buildMindMapNoteContent,
  parseMindMapNote,
  defaultMindMapSeed,
  createMindNode,
  createMindEdge,
} from "./mindmap-note";
import {
  buildHandwritingNoteContent,
  parseHandwritingNote,
  beginStroke,
  appendStrokePoint,
  defaultHandwritingSeed,
  emptyPage,
} from "./handwriting-note";
import { buildTextNoteContent, textMarkdownFromContent } from "./text-note";

describe("packStrokePoint", () => {
  it("emits six values per sample", () => {
    const point = packStrokePoint(10.456, 20.999, 12.3, 0.5123);
    expect(point).toHaveLength(VALUES_PER_POINT);
    expect(point[0]).toBe(10.46);
    expect(point[1]).toBe(21);
    expect(point[2]).toBe(12.3);
    expect(point[3]).toBe(0.512);
    expect(point[4]).toBe(-1);
    expect(point[5]).toBe(-1);
  });
});

describe("eraseStrokeFragment", () => {
  function line(): Stroke {
    const points: number[] = [];
    for (let x = 0; x <= 100; x += 10) {
      points.push(...packStrokePoint(x, 50, x));
    }
    return { id: "s1", color: argbColor(0, 0, 0), size: 2, tool: "pen", points };
  }

  it("removes the whole stroke when the eraser covers everything", () => {
    const result = eraseStrokeFragment(line(), 50, 50, 200, () => "n");
    expect(result).toEqual([]);
  });

  it("keeps the stroke when the eraser misses", () => {
    const stroke = line();
    const result = eraseStrokeFragment(stroke, 50, 200, 5, () => "n");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("splits a stroke around the eraser", () => {
    let n = 0;
    const result = eraseStrokeFragment(line(), 50, 50, 8, () => `piece-${++n}`);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(strokeHitsCircle(line(), 50, 50, 8)).toBe(true);
  });
});

describe("mindmap-note", () => {
  it("round-trips nodes and edges", () => {
    const seed = defaultMindMapSeed();
    const child = createMindNode({ x: 400, y: 160, text: "Dziecko" });
    const edge = createMindEdge(seed.nodes[0].id, child.id);
    const content = buildMindMapNoteContent({
      id: "mm1",
      title: "Mapa",
      nodes: [...seed.nodes, child],
      edges: [edge],
    });
    const parsed = parseMindMapNote(content);
    expect(parsed?.nodes).toHaveLength(2);
    expect(parsed?.edges).toHaveLength(1);
    expect(JSON.parse(content).kind).toBe("mindmap");
    expect(JSON.parse(content).mindMap.nodes[0].font).toBe("body");
  });
});

describe("handwriting-note", () => {
  it("round-trips strokes with six floats per point", () => {
    let stroke = beginStroke({
      color: argbColor(35, 33, 29),
      size: 2.4,
      x: 120.5,
      y: 300.25,
      input: "mouse",
    });
    stroke = appendStrokePoint(stroke, 122, 301, 8, 0.51);
    expect(stroke.points).toHaveLength(12);
    expect(stroke.tool).toBe("pen");
    expect(stroke.input).toBe("mouse");

    const page = emptyPage({ strokes: [stroke] });
    const content = buildHandwritingNoteContent({
      id: "hw1",
      title: "Szkic",
      pages: [page],
      background: "grid",
    });
    const parsed = parseHandwritingNote(content);
    expect(parsed?.pages[0].strokes?.[0].points).toHaveLength(12);
    expect(JSON.parse(content).kind).toBe("handwritten");
    expect(JSON.parse(content).handwriting.pageMode).toBe("a4");
  });

  it("seeds an empty A4 page", () => {
    const seed = defaultHandwritingSeed();
    expect(seed.pages).toHaveLength(1);
    expect(seed.pages[0].width).toBe(595);
  });
});

describe("text-note still builds markdown", () => {
  it("preserves markdown body", () => {
    const content = buildTextNoteContent({
      id: "t1",
      title: "Tekst",
      markdown: "# Hello\n\n**bold**",
    });
    expect(textMarkdownFromContent(content)).toBe("# Hello\n\n**bold**");
    expect(JSON.parse(content).kind).toBe("text");
  });
});
