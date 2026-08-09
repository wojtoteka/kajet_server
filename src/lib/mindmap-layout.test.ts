import { describe, expect, it } from "vitest";
import { arrangeMindMap, LAYOUT_GAP_Y } from "@/lib/mindmap-layout";
import { createMindEdge, createMindNode } from "@/lib/mindmap-note";
import type { MindEdge, MindNode } from "@/lib/document";

/** Mapa z tego samego kształtu, co na zrzucie: korzeń, cztery gałęzie, po dwoje dzieci. */
function grunwald(): { nodes: MindNode[]; edges: MindEdge[] } {
  const nodes: MindNode[] = [];
  const edges: MindEdge[] = [];

  const dodaj = (id: string, text: string, rodzic?: string) => {
    // Wszystkie w jednym punkcie - po to, żeby było widać, że układ je rozdziela.
    const node = { ...createMindNode({ x: 0, y: 0, text }), id };
    nodes.push(node);
    if (rodzic) edges.push(createMindEdge(rodzic, id));
  };

  dodaj("korzen", "Bitwa pod Grunwaldem");
  const galezie = ["Data i miejsce", "Strony konfliktu", "Główni dowódcy", "Skutki"];
  galezie.forEach((tekst, at) => {
    dodaj(`g${at}`, tekst, "korzen");
    dodaj(`g${at}a`, `${tekst} — raz`, `g${at}`);
    dodaj(`g${at}b`, `${tekst} — dwa`, `g${at}`);
  });

  return { nodes, edges };
}

/** Pionowy pas zajęty przez węzeł. */
function pas(node: MindNode): [number, number] {
  return [node.y, node.y + (node.height ?? 64)];
}

describe("układ mapy myśli", () => {
  it("nie zostawia dwóch węzłów w tym samym punkcie", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);

    const punkty = ulozone.map((node) => `${node.x}:${node.y}`);
    expect(new Set(punkty).size).toBe(ulozone.length);
  });

  it("kolumna zależy od poziomu, a nie od rodzica", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    // Wszystkie gałęzie stoją w jednej kolumnie, wszystkie wnuki w następnej.
    const drugi = [0, 1, 2, 3].map((at) => przy(`g${at}`).x);
    expect(new Set(drugi).size).toBe(1);

    const trzeci = [0, 1, 2, 3].flatMap((at) => [przy(`g${at}a`).x, przy(`g${at}b`).x]);
    expect(new Set(trzeci).size).toBe(1);

    expect(przy("korzen").x).toBeLessThan(drugi[0]);
    expect(drugi[0]).toBeLessThan(trzeci[0]);
  });

  it("każda gałąź dostaje własny pas w pionie - stąd brak skrzyżowań", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    // Pas gałęzi = od góry pierwszego dziecka do dołu ostatniego.
    const pasy = [0, 1, 2, 3].map((at) => {
      const dzieci = [przy(`g${at}a`), przy(`g${at}b`)];
      return [
        Math.min(...dzieci.map((n) => pas(n)[0])),
        Math.max(...dzieci.map((n) => pas(n)[1])),
      ] as [number, number];
    });

    const posortowane = [...pasy].sort((a, b) => a[0] - b[0]);
    for (let at = 1; at < posortowane.length; at += 1) {
      expect(posortowane[at][0]).toBeGreaterThanOrEqual(posortowane[at - 1][1]);
    }
  });

  it("rodzic stoi na środku swoich dzieci", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    for (const at of [0, 1, 2, 3]) {
      const rodzic = przy(`g${at}`);
      const dzieci = [przy(`g${at}a`), przy(`g${at}b`)];
      const srodekDzieci =
        (Math.min(...dzieci.map((n) => pas(n)[0])) + Math.max(...dzieci.map((n) => pas(n)[1]))) / 2;
      const srodekRodzica = rodzic.y + (rodzic.height ?? 64) / 2;
      expect(Math.abs(srodekRodzica - srodekDzieci)).toBeLessThanOrEqual(1);
    }
  });

  it("odstęp między rodzeństwem to jeden GAP_Y, nie więcej", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    const a = przy("g0a");
    const b = przy("g0b");
    expect(b.y - (a.y + (a.height ?? 64))).toBe(LAYOUT_GAP_Y);
  });

  it("radzi sobie z pierścieniem i z węzłem bez połączeń", () => {
    const a = { ...createMindNode({ x: 0, y: 0, text: "a" }), id: "a" };
    const b = { ...createMindNode({ x: 0, y: 0, text: "b" }), id: "b" };
    const sam = { ...createMindNode({ x: 0, y: 0, text: "sam" }), id: "sam" };

    const ulozone = arrangeMindMap(
      [a, b, sam],
      [createMindEdge("a", "b"), createMindEdge("b", "a")],
    );

    expect(ulozone).toHaveLength(3);
    const punkty = ulozone.map((node) => `${node.x}:${node.y}`);
    expect(new Set(punkty).size).toBe(3);
  });

  it("węzeł podwieszony w dwóch miejscach zostaje postawiony raz", () => {
    const korzen = { ...createMindNode({ x: 0, y: 0, text: "korzeń" }), id: "korzen" };
    const lewy = { ...createMindNode({ x: 0, y: 0, text: "lewy" }), id: "lewy" };
    const wspolny = { ...createMindNode({ x: 0, y: 0, text: "wspólny" }), id: "wspolny" };

    const ulozone = arrangeMindMap(
      [korzen, lewy, wspolny],
      [
        createMindEdge("korzen", "lewy"),
        createMindEdge("korzen", "wspolny"),
        createMindEdge("lewy", "wspolny"),
      ],
    );

    expect(ulozone.filter((node) => node.id === "wspolny")).toHaveLength(1);
    const punkty = ulozone.map((node) => `${node.x}:${node.y}`);
    expect(new Set(punkty).size).toBe(3);
  });
});
