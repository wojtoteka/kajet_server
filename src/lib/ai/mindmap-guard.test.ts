/*
  Spójność mapy myśli po zmianach KajetAI.

  Uszkodzona mapa nie rzuca się w oczy od razu - i to jest dokładnie powód,
  dla którego ten plik jest dłuższy niż reszta testów KajetAI. Sprawdzane
  jest jedno: żadna paczka operacji nie ma prawa zostawić mapy z sierotą,
  z pierścieniem, z krawędzią donikąd ani z węzłem o dwóch rodzicach - a gdy
  próbuje, nie zapisuje się NIC, także częściowo.
*/

import { describe, expect, it } from "vitest";
import { applyMindMapOperations, checkMindMap, type MindMapOperation } from "./mindmap-guard";
import type { MindEdge, MindNode } from "@/lib/document";
import { words } from "@/lib/i18n";

const PL = words("pl");

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
    ], PL);

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
    ], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const napoje = result.nodes.find((n) => n.text === "napoje")!;
    const sok = result.nodes.find((n) => n.text === "sok")!;
    expect(parents(result.edges)[sok.id]).toBe(napoje.id);
  });

  it("nie pozwala dodać węzła bez rodzica do niepustej mapy", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "sierota", text: "nic" },
    ], PL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("nie jest podłączony");
  });

  it("do pustej mapy wolno dodać pierwszy węzeł bez rodzica", () => {
    const result = applyMindMapOperations({ nodes: [], edges: [] }, [
      { rodzaj: "dodaj", id: "pierwszy", text: "Temat" },
    ], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  /*
    Mapa założona w aplikacji jest PUSTA - strona zakłada ją z gotowym
    korzeniem „Temat", aplikacja nie zakłada niczego. Dlatego „zrób mapę myśli
    o czymś" na tablecie buduje w jednej paczce i korzeń, i wszystko pod nim.

    Ten przypadek padał za każdym razem: korzeń trafiał do zbioru dodanych,
    rodzica nie miał, a mapa miała już więcej niż jeden węzeł - więc końcowe
    sprawdzenie odrzucało całość. Przechodziła wyłącznie paczka z jednym
    węzłem i tylko ona była w testach.
  */
  it("do pustej mapy wolno wstawić całe drzewo jedną paczką", () => {
    const result = applyMindMapOperations({ nodes: [], edges: [] }, [
      { rodzaj: "dodaj", id: "korzen", text: "Fotosynteza" },
      { rodzaj: "dodaj", id: "a", text: "Substraty", rodzicId: "korzen" },
      { rodzaj: "dodaj", id: "b", text: "Produkty", rodzicId: "korzen" },
      { rodzaj: "dodaj", id: "a1", text: "Woda", rodzicId: "a" },
    ], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    // Korzeń jest jeden i to on nie ma rodzica.
    const bezRodzica = result.nodes.filter(
      (n) => !result.edges.some((e) => e.toId === n.id),
    );
    expect(bezRodzica).toHaveLength(1);
    expect(bezRodzica[0].text).toBe("Fotosynteza");
  });

  it("odmawia, gdy rodzic nie istnieje", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "x", text: "coś", rodzicId: "nie-ma-takiego" },
    ], PL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("nie-ma-takiego");
  });

  it("odmawia, gdy model użyje tej samej nazwy dla dwóch nowych węzłów", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "dodaj", id: "ten-sam", text: "raz", rodzicId: "korzen" },
      { rodzaj: "dodaj", id: "ten-sam", text: "dwa", rodzicId: "korzen" },
    ], PL);

    expect(result.ok).toBe(false);
  });
});

describe("kasowanie węzłów", () => {
  it("usun przesuwa dzieci pod dziadka, zamiast je osierocić", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "owoce" }], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nodes.map((n) => n.id).sort()).toEqual(["jablko", "korzen", "warzywa"]);
    // Jabłko wisiało pod owocami; po skasowaniu owoców przechodzi pod korzeń.
    expect(parents(result.edges).jablko).toBe("korzen");
  });

  it("usun_galaz zabiera węzeł razem ze wszystkim pod nim", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun_galaz", id: "owoce" }], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nodes.map((n) => n.id).sort()).toEqual(["korzen", "warzywa"]);
    expect(result.edges).toHaveLength(1);
  });

  it("skasowanie korzenia zostawia jego dzieci jako nowe korzenie, nie jako sieroty", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "korzen" }], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Owoce i warzywa nie mają już rodzica - i tak ma być, bo nie ma gdzie ich
    // podwiesić. Mapa dalej jest spójna.
    expect(checkMindMap(result, PL)).toBeNull();
  });

  it("odmawia kasowania węzła, którego nie ma", () => {
    const result = applyMindMapOperations(MAPA, [{ rodzaj: "usun", id: "widmo" }], PL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.powod).toContain("widmo");
  });
});

describe("przenoszenie węzłów", () => {
  it("przepina węzeł pod nowego rodzica, zostawiając mu jednego", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "jablko", rodzicId: "warzywa" },
    ], PL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(parents(result.edges).jablko).toBe("warzywa");
    expect(result.edges.filter((e) => e.toId === "jablko")).toHaveLength(1);
  });

  it("nie pozwala podwiesić węzła sam pod siebie", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "owoce", rodzicId: "owoce" },
    ], PL);

    expect(result.ok).toBe(false);
  });

  it("nie pozwala przenieść węzła pod jego własne dziecko - to zamknęłoby pierścień", () => {
    const result = applyMindMapOperations(MAPA, [
      { rodzaj: "przenies", id: "owoce", rodzicId: "jablko" },
    ], PL);

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

    const result = applyMindMapOperations(MAPA, operations, PL);
    expect(result.ok).toBe(false);

    // Mapa wejściowa nietknięta - operacje idą po kopii.
    expect(MAPA.nodes.find((n) => n.id === "owoce")!.text).toBe("owoce");
  });

  it("pusta lista operacji to błąd, a nie cicha zgoda", () => {
    expect(applyMindMapOperations(MAPA, [], PL).ok).toBe(false);
  });
});

describe("sprawdzanie gotowej mapy", () => {
  it("przepuszcza mapę zdrową", () => {
    expect(checkMindMap(MAPA, PL)).toBeNull();
  });

  it("łapie krawędź do węzła, którego nie ma", () => {
    expect(
      checkMindMap({ nodes: MAPA.nodes, edges: [...MAPA.edges, edge("korzen", "duch")] }, PL),
    ).toContain("którego już nie ma");
  });

  // Poniższe dwie mapy da się narysować ręcznie w obu edytorach, więc strażnik
  // nie ma prawa ich odrzucać. Kiedyś odrzucał - i przez to KajetAI odmawiał
  // pracy przy takiej mapie na zawsze, choćby polecenie dotyczyło innej gałęzi.
  it("przepuszcza węzeł podwieszony w dwóch miejscach", () => {
    expect(
      checkMindMap({ nodes: MAPA.nodes, edges: [...MAPA.edges, edge("warzywa", "jablko")] }, PL),
    ).toBeNull();
  });

  it("przepuszcza gałąź zamkniętą w pierścień", () => {
    expect(
      checkMindMap(
        { nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("b", "a")] },
        PL,
      ),
    ).toBeNull();
  });

  it("łapie dwa węzły o tym samym identyfikatorze", () => {
    expect(checkMindMap({ nodes: [node("a"), node("a")], edges: [] }, PL)).toContain("dwa razy");
  });
});
