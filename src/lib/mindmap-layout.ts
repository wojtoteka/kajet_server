/*
  Rozkładanie mapy myśli: korzenie po lewej, dzieci kolumnami w prawo.

  Do tej pory pozycje węzłów dostawionych przez asystenta wymyślał strażnik,
  węzeł po węźle: dziecko szło na wysokość rodzica plus stały skok razy numer
  rodzeństwa. Nikt przy tym nie patrzył na całość, więc nikt nie rezerwował
  miejsca na gałąź poprzedniego brata - i węzły spod różnych rodziców lądowały
  co do piksela w tym samym punkcie. Stąd ukośne kreski i plątanina.

  Tutaj liczy się to inaczej i w dwóch przebiegach:

  1. Każdemu węzłowi przypisujemy poziom, a każdemu poziomowi jedną wspólną
     kolumnę - odsuniętą o szerokość NAJSZERSZEGO węzła poziomu obok. Dzięki
     temu kolumny nigdy na siebie nie wchodzą, choćby napisy były różnej
     długości.

  2. W pionie każde poddrzewo dostaje własny, ROZŁĄCZNY pas: schodzimy w głąb,
     liście zajmują kolejne miejsca, a rodzic ustawia się na środku pasa swoich
     dzieci. Rozłączne pasy są tym, co daje gwarancję: skoro gałęzie nie
     zachodzą na siebie w pionie, ich krawędzie nie mają się gdzie przeciąć.

  Wyjątkiem są połączenia krzyżowe narysowane ręcznie - węzeł podwieszony
  w dwóch miejscach rysujemy raz, pod pierwszym rodzicem, a druga kreska musi
  gdzieś przebiec. To jest świadoma decyzja człowieka, nie usterka układu.
*/

import type { MindEdge, MindNode } from "@/lib/document";

/** Odstępy przepisane z edytora, żeby „Rozłóż" i asystent dawały ten sam obrazek. */
export const LAYOUT_START_X = 40;
export const LAYOUT_START_Y = 40;
export const LAYOUT_GAP_X = 64;
export const LAYOUT_GAP_Y = 20;

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

/**
 * Nowe położenia wszystkich węzłów. Reszta węzła - napis, barwa, kształt,
 * pismo odręczne - zostaje nietknięta.
 */
export function arrangeMindMap(nodes: MindNode[], edges: MindEdge[]): MindNode[] {
  if (nodes.length === 0) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));

  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of edges) {
    // Krawędź do węzła, którego już nie ma, nie ma prawa niczego przesunąć.
    if (!byId.has(edge.fromId) || !byId.has(edge.toId)) continue;
    childrenOf.set(edge.fromId, [...(childrenOf.get(edge.fromId) ?? []), edge.toId]);
    hasParent.add(edge.toId);
  }

  // --- przebieg pierwszy: poziom każdego węzła --------------------------
  // Pierwsze odwiedzenie wygrywa. To rozstrzyga węzeł podwieszony w dwóch
  // miejscach (rysujemy go pod pierwszym rodzicem) i zatrzymuje obchodzenie
  // na pierścieniu.
  const depth = new Map<string, number>();
  const numbered = new Set<string>();

  const number = (id: string, level: number) => {
    if (numbered.has(id)) return;
    numbered.add(id);
    depth.set(id, level);
    for (const child of childrenOf.get(id) ?? []) number(child, level + 1);
  };

  for (const node of nodes) if (!hasParent.has(node.id)) number(node.id, 0);
  // Zostały węzły zamknięte w pierścieniu - do nich nie da się dojść z żadnego
  // korzenia. Zaczynamy je od lewej, żeby nie przepadły.
  for (const node of nodes) number(node.id, 0);

  // --- kolumny ----------------------------------------------------------
  const widest = new Map<number, number>();
  for (const node of nodes) {
    const level = depth.get(node.id) ?? 0;
    widest.set(level, Math.max(widest.get(level) ?? 0, node.width ?? DEFAULT_WIDTH));
  }

  const columnX = new Map<number, number>();
  const deepest = Math.max(0, ...depth.values());
  let x = LAYOUT_START_X;
  for (let level = 0; level <= deepest; level += 1) {
    columnX.set(level, x);
    x += (widest.get(level) ?? DEFAULT_WIDTH) + LAYOUT_GAP_X;
  }

  // --- przebieg drugi: pasy w pionie ------------------------------------
  const placed = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  let cursorY = LAYOUT_START_Y;

  const place = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);

    const node = byId.get(id);
    if (!node) return;
    const height = node.height ?? DEFAULT_HEIGHT;
    const left = columnX.get(depth.get(id) ?? 0) ?? LAYOUT_START_X;
    const children = (childrenOf.get(id) ?? []).filter((child) => !visited.has(child));

    // Liść albo gałąź zwinięta: zajmuje jedno miejsce i tyle.
    if (children.length === 0 || node.collapsed) {
      placed.set(id, { x: left, y: cursorY });
      cursorY += height + LAYOUT_GAP_Y;
      return;
    }

    const from = cursorY;
    for (const child of children) place(child);
    // Dzieci zajęły pas [from, cursorY - LAYOUT_GAP_Y] - ostatni odstęp jest
    // już za nimi. Rodzic staje na jego środku.
    const to = cursorY - LAYOUT_GAP_Y;
    placed.set(id, { x: left, y: (from + to) / 2 - height / 2 });
  };

  for (const node of nodes) if (!hasParent.has(node.id)) place(node.id);
  for (const node of nodes) place(node.id);

  return nodes.map((node) => {
    const at = placed.get(node.id);
    return at ? { ...node, x: at.x, y: at.y } : node;
  });
}
