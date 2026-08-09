import { describe, expect, it } from "vitest";
import {
  dragShapeHandle,
  fitShapeTo,
  rotateShapeTo,
  shapeBigEnough,
  shapeBounds,
  shapeHandles,
  shapeHits,
  shapePath,
  shapeStrokeOpacity,
  type Shape,
  type ShapeKind,
} from "./shapes";

/**
 * Lustro `ink/src/test/.../ShapeGeometryTest.kt` z aplikacji. Te same liczby po
 * obu stronach - inaczej kształt narysowany rysikiem wyszedłby na stronie
 * gdzie indziej niż na tablecie.
 */
function shape(over: Partial<Shape> & { kind?: ShapeKind } = {}): Shape {
  return {
    id: "k",
    kind: "rect",
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
    color: -0x1000000,
    strokeWidth: 2,
    fill: 0,
    ...over,
  };
}

describe("kształty", () => {
  it("przeciągnięcie od punktu do punktu daje dodatnie boki", () => {
    const drawn = fitShapeTo(shape(), 300, 300, 100, 150, false);

    expect(drawn.x).toBe(100);
    expect(drawn.y).toBe(150);
    expect(drawn.width).toBe(200);
    expect(drawn.height).toBe(150);
  });

  it("blokada proporcji robi z prostokąta kwadrat", () => {
    const drawn = fitShapeTo(shape(), 100, 100, 300, 160, true);

    expect(drawn.width).toBe(200);
    expect(drawn.height).toBe(200);
  });

  it("strzałka zachowuje kierunek, bo grot siedzi na drugim końcu", () => {
    const drawn = fitShapeTo(shape({ kind: "arrow" }), 300, 300, 100, 200, false);

    expect(drawn.x).toBe(300);
    expect(drawn.y).toBe(300);
    expect(drawn.width).toBe(-200);
    expect(drawn.height).toBe(-100);
  });

  it("blokada proporcji dosnapowuje linię do 45 stopni", () => {
    const drawn = fitShapeTo(shape({ kind: "line" }), 0, 0, 100, 10, true);

    expect(Math.abs(drawn.height)).toBeLessThan(0.01);
    expect(drawn.width).toBeCloseTo(Math.hypot(100, 10), 2);
  });

  it("pusty prostokąt łapie obrys, a nie środek", () => {
    const empty = shape();

    expect(shapeHits(empty, 100, 100, 4)).toBe(true);
    expect(shapeHits(empty, 200, 150, 4)).toBe(false);
  });

  it("wypełniony prostokąt łapie całym polem", () => {
    const filled = shape({ fill: -0x10000 });

    expect(shapeHits(filled, 200, 150, 4)).toBe(true);
    expect(shapeHits(filled, 400, 150, 4)).toBe(false);
  });

  it("obrócony kształt łapie tam, gdzie naprawdę leży", () => {
    const turned = shape({ rotation: 90, fill: -0x10000 });

    expect(shapeHits(turned, 200, 60, 2)).toBe(true);
    expect(shapeHits(turned, 120, 150, 2)).toBe(false);
  });

  it("uchwyt przeciwległy zostaje w miejscu", () => {
    const start = shape();
    const corners = shapeHandles(start);

    const stretched = dragShapeHandle(start, 0, 60, 40, false);
    const after = shapeHandles(stretched);

    expect(after[4]).toBeCloseTo(corners[4], 2);
    expect(after[5]).toBeCloseTo(corners[5], 2);
    expect(stretched.width).toBeCloseTo(240, 2);
    expect(stretched.height).toBeCloseTo(160, 2);
  });

  it("uchwyt przeciwległy zostaje w miejscu także po obrocie", () => {
    const start = shape({ rotation: 30 });
    const corners = shapeHandles(start);

    const stretched = dragShapeHandle(start, 0, 40, 20, false);
    const after = shapeHandles(stretched);

    expect(after[4]).toBeCloseTo(corners[4], 1);
    expect(after[5]).toBeCloseTo(corners[5], 1);
    expect(stretched.rotation).toBe(30);
  });

  it("obrót dosnapowuje się do ćwiartki", () => {
    const turned = rotateShapeTo(shape(), 200 + 200, 150 + 4);

    expect(turned.rotation).toBe(90);
  });

  it("kliknięcie zamiast przeciągnięcia nie jest kształtem", () => {
    expect(shapeBigEnough(fitShapeTo(shape(), 100, 100, 102, 101, false))).toBe(false);
  });

  it("prostokąt obejmujący bierze poprawkę na grubość obrysu", () => {
    const box = shapeBounds(shape({ strokeWidth: 4 }));

    expect(box.left).toBeCloseTo(98, 2);
    expect(box.right).toBeCloseTo(302, 2);
  });

  /*
    Alfa barwy siedzi już w samym zapisie koloru, więc atrybut krycia niesie
    wyłącznie pole `opacity`. Inaczej przezroczystość liczyłaby się dwa razy.
  */
  it("krycie niesie samą przezroczystość kształtu, bez alfy barwy", () => {
    expect(shapeStrokeOpacity(shape({ opacity: 0.5 }))).toBeCloseTo(0.5, 3);
    expect(shapeStrokeOpacity(shape({ color: 0x80000000 | 0, opacity: 1 }))).toBe(1);
    expect(shapeStrokeOpacity(shape({ opacity: undefined }))).toBe(1);
  });

  describe("ścieżka SVG", () => {
    it("prostokąt domyka się sam", () => {
      expect(shapePath(shape())).toBe("M 100 100 L 300 100 L 300 200 L 100 200 Z");
    });

    it("elipsa idzie dwoma półłukami", () => {
      expect(shapePath(shape({ kind: "ellipse" }))).toBe(
        "M 100 150 A 100 50 0 1 0 300 150 A 100 50 0 1 0 100 150 Z",
      );
    });

    it("strzałka dokłada grot na drugim końcu", () => {
      const path = shapePath(shape({ kind: "arrow", x: 0, y: 0, width: 100, height: 0 }));

      expect(path.startsWith("M 0 0 L 100 0")).toBe(true);
      // Grot to dwie kreski wychodzące z końca strzałki.
      expect(path.match(/M 100 0 L/g)).toHaveLength(2);
    });

    it("trójkąt ma trzy wierzchołki", () => {
      expect(shapePath(shape({ kind: "triangle" }))).toBe(
        "M 200 100 L 300 200 L 100 200 Z",
      );
    });
  });
});
