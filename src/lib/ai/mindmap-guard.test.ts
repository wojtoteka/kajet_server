/*
  Spójność mapy myśli po zmianach asystenta.

  Uszkodzona mapa nie rzuca się w oczy od razu - i to jest dokładnie powód,
  dla którego ten plik jest dłuższy niż reszta testów asystenta. Sprawdzane
  jest jedno: żadna paczka operacji nie ma prawa zostawić mapy z sierotą,
  z pierścieniem, z krawędzią donikąd ani z węzłem o dwóch rodzicach - a gdy
  próbuje, nie zapisuje się NIC, także częściowo.
*/

import { describe, expect, it } from "vitest";
import { applyMindMapOperations, checkMindMap, type MindMapOperation } from "./mindmap-guard";
import type { MindEdge, MindNode } from "@/lib/document";

function node(id: string, text = id): MindNode {
  return { id, x: 0, y: 0, width: 160, height: 64, text, ink: [] };
}
function edge(fromId: string, toId: string): MindEdge {
  return { id: `e-${fromId}-${toId}`, fromId, toId };
}

/*
  Mapa użyta w większości prób:

    korzen
      ├── owoce ── jablko
      └── warzywa
*/
const MAPA = {
  nodes: [node("korzen"), node("owoce"), node("jablko"), node("warzywa")],
  edges: [edge("korzen", "owoce"), edge("owoce", "jablko"), edge("korzen", "warzywa")],
};

function parents(edges: MindEdge[]): Record<string, string> {
  return Object.fromEntries(edges.map((e) => [e.toId, e.fromId]));
}

describe("dodawanie węzłów", () => {
  it("podwiesza nowy węzeł pod wskazanym rodzicem i nadaje mu własny identyfikator", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "nowy1", text: "gruszka", rodzicId: "owoce" },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fresh = result.nodes.find((n) => n.text === "gruszka");
    expect(fresh).toBeTruthy();
    // Nazwa od modelu jest tymczasowa - w mapie ma stanąć prawdziwy identyfikator.
    expect(fresh!.id).not.toBe("nowy1");
    expect(parents(result.edges)[fresh!.id]).toBe("owoce");
  });

  it("pozwala podwiesić jeden nowy węzeł pod drugim z tej samej paczki", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "a", text: "napoje", rodzicId: "korzen" },
      { rodzaj: "dodaj", id: "b", text: "sok", rodzicId: "a" },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const napoje = result.nodes.find((n) => n.text === "napoje")!;
    const sok = result.nodes.find((n) => n.text === "sok")!;
    expect(parents(result.edges)[sok.id]).toBe(napoje.id);
  });

  it("nie pozwala dodać węzła bez rodzica do niepustej mapy", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "sierota", text: "nic" },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("nie jest podłączony");
  });

  it("do pustej mapy wolno dodać pierwszy węzeł bez rodzica", () => {
    const result = applyMindMapOperations({ nodes: [], edges: [] }, [
      { rodzaj: "dodaj", id: "pierwszy", text: "Temat" },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it("odmawia, gdy rodzic nie istnieje", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "x", text: "coś", rodzicId: "nie-ma-takiego" },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("nie-ma-takiego");
  });

  it("odmawia, gdy model użyje tej samej nazwy dla dwóch nowych węzłów", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "ten-sam", text: "raz", rodzicId: "korzen" },
      { rodzaj: "dodaj", id: "ten-sam", text: "dwa", rodzicId: "korzen" },
    ]);

    expect(result.ok).toBe(false);
  });
});

describe("kasowanie węzłów", () => {
  it("usun przesuwa dzieci pod dziadka, zamiast je osierocić", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "owoce" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nodes.map((n) => n.id).sort()).toEqual(["jablko", "korzen", "warzywa"]);
    // Jabłko wisiało pod owocami; po skasowaniu owoców przechodzi pod korzeń.
    expect(parents(result.edges).jablko).toBe("korzen");
  });

  it("usun_galaz zabiera węzeł razem ze wszystkim pod nim", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun_galaz", id: "owoce" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nodes.map((n) => n.id).sort()).toEqual(["korzen", "warzywa"]);
    expect(result.edges).toHaveLength(1);
  });

  it("skasowanie korzenia zostawia jego dzieci jako nowe korzenie, nie jako sieroty", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "korzen" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Owoce i warzywa nie mają już rodzica - i tak ma być, bo nie ma gdzie ich
    // podwiesić. Mapa dalej jest spójna.
    expect(checkMindMap(result)).toBeNull();
  });

  it("odmawia kasowania węzła, którego nie ma", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "widmo" }]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("widmo");
  });
});

describe("przenoszenie węzłów", () => {
  it("przepina węzeł pod nowego rodzica, zostawiając mu jednego", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "jablko", rodzicId: "warzywa" },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(parents(result.edges).jablko).toBe("warzywa");
    expect(result.edges.filter((e) => e.toId === "jablko")).toHaveLength(1);
  });

  it("nie pozwala podwiesić węzła sam pod siebie", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "owoce", rodzicId: "owoce" },
    ]);

    expect(result.ok).toBe(false);
  });

  it("nie pozwala przenieść węzła pod jego własne dziecko - to zamknęłoby pierścień", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "owoce", rodzicId: "jablko" },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("własną gałąź");
  });
});

describe("paczka operacji wchodzi w całości albo wcale", () => {
  it("błąd na drugiej operacji cofa też pierwszą", () => {
    const operations: MindMapOperation[] = [
      { rodzaj: "zmien_tekst", id: "owoce", text: "OWOCE" },
      { rodzaj: "przenies", id: "korzen", rodzicId: "jablko" },
    ];

    const result = applyMindMapOperations(MAPA, operations);
    expect(result.ok).toBe(false);

    // Mapa wejściowa nietknięta - operacje idą po kopii.
    expect(MAPA.nodes.find((n) => n.id === "owoce")!.text).toBe("owoce");
  });

  it("pusta lista operacji to błąd, a nie cicha zgoda", () => {
    expect(applyMindMapOperations(MAPA, []).ok).toBe(false);
  });
});

describe("sprawdzanie gotowej mapy", () => {
  it("przepuszcza mapę zdrową", () => {
    expect(checkMindMap(MAPA)).toBeNull();
  });

  it("łapie krawędź do węzła, którego nie ma", () => {
    expect(
      checkMindMap({ nodes: MAPA.nodes, edges: [...MAPA.edges, edge("korzen", "duch")] }),
    ).toContain("którego już nie ma");
  });

  it("łapie węzeł o dwóch rodzicach", () => {
    expect(
      checkMindMap({ nodes: MAPA.nodes, edges: [...MAPA.edges, edge("warzywa", "jablko")] }),
    ).toContain("dwóch rodziców");
  });

  it("łapie pierścień", () => {
    expect(
      checkMindMap({
        nodes: [node("a"), node("b")],
        edges: [edge("a", "b"), edge("b", "a")],
      }),
    ).toContain("pierścień");
  });

  it("łapie dwa węzły o tym samym identyfikatorze", () => {
    expect(checkMindMap({ nodes: [node("a"), node("a")], edges: [] })).toContain("dwa razy");
  });
});
