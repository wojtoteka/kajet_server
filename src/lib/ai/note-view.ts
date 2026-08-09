/*
  Notatka w postaci, w jakiej widzi ją model.

  Do modelu NIE jedzie plik notatki. Jedzie to, co jest do zmieniania: sam
  markdown, samo źródło albo drzewko węzłów z identyfikatorami. Reszta - pismo
  odręczne, punkty kresek po sześć liczb każdy, kolory, położenie na kartce,
  ustawienie widoku - zostaje na serwerze. Jedna zamalowana mapa myśli potrafi
  ważyć setki kilobajtów, których model i tak nie czyta, a płaci się za każdy
  token.

  Ta sama funkcja liczy rozmiar sprawdzany przy limicie - a więc limit dotyczy
  dokładnie tego, co naprawdę wychodzi z serwera, nie wielkości pliku notatki.
*/

import { parseCodeNote } from "@/lib/code-note";
import { parseMindMapNote } from "@/lib/mindmap-note";
import { textMarkdownFromContent } from "@/lib/text-note";
import type { MindEdge, MindNode } from "@/lib/document";
import type { AiKind } from "./tools";

export type NoteView =
  | { ok: true; material: string; chars: number }
  | { ok: false; powod: string };

export function viewForModel(kind: AiKind, content: string): NoteView {
  if (kind === "TEXT") {
    const markdown = textMarkdownFromContent(content);
    return gotowe(markdown);
  }

  if (kind === "CODE") {
    const code = parseCodeNote(content);
    if (!code) return { ok: false, powod: "Nie udało się odczytać notatki z kodem." };
    return gotowe(`Język: ${code.language}\n\n${code.source}`);
  }

  const map = parseMindMapNote(content);
  if (!map) return { ok: false, powod: "Nie udało się odczytać mapy myśli." };
  return gotowe(drawMindMap(map.nodes, map.edges));
}

function gotowe(material: string): NoteView {
  return { ok: true, material, chars: material.length };
}

/**
 * Mapa jako wcięte drzewko z identyfikatorami w nawiasach kwadratowych.
 *
 * Identyfikatory muszą tu być, bo operacje odwołują się właśnie do nich -
 * gdyby model widział same napisy, nie miałby czym wskazać, który węzeł
 * przenieść. Węzły bez rodzica stoją na pierwszym poziomie; te, które nie dały
 * się obejść z żadnego korzenia, dopisujemy na końcu, żeby model o nich
 * wiedział zamiast zgadywać.
 *
 * Węzeł podwieszony w dwóch miejscach rysujemy raz, a w drugim miejscu
 * zostawiamy odnośnik. Milczenie w tym miejscu byłoby gorsze niż powtórzenie:
 * model zmieniałby mapę, której obraz ma niepełny, i mógłby uznać brakującą
 * gałąź za coś do dopisania jeszcze raz.
 */
export function drawMindMap(nodes: MindNode[], edges: MindEdge[]): string {
  if (nodes.length === 0) return "(mapa jest pusta)";

  const hasParent = new Set(edges.map((edge) => edge.toId));
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    children.set(edge.fromId, [...(children.get(edge.fromId) ?? []), edge.toId]);
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lines: string[] = [];
  const seen = new Set<string>();

  const walk = (id: string, depth: number) => {
    const node = byId.get(id);
    if (!node) return;
    const indent = "  ".repeat(depth);
    if (seen.has(id)) {
      // Drugie (i kolejne) miejsce, w którym ten sam węzeł wisi. Rysujemy sam
      // odnośnik, żeby nie powielać całej gałęzi pod spodem.
      lines.push(`${indent}[${id}] ${describe(node)}   (ten sam węzeł, opisany wyżej)`);
      return;
    }
    seen.add(id);
    lines.push(`${indent}[${id}] ${describe(node)}`);
    for (const child of children.get(id) ?? []) walk(child, depth + 1);
  };

  for (const node of nodes) if (!hasParent.has(node.id)) walk(node.id, 0);
  // Zostały te, do których nie da się dojść z żadnego korzenia - czyli węzły
  // zamknięte w pierścieniu. Rodzica mają, więc nie wolno powiedzieć, że nie
  // wiszą pod niczym; trzeba nazwać rzecz po imieniu.
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const zaczyna = lines.length;
    walk(node.id, 0);
    lines[zaczyna] += hasParent.has(node.id)
      ? "   (gałąź zamknięta w pierścień)"
      : "   (nie wisi pod żadnym węzłem)";
  }

  return lines.join("\n");
}

function describe(node: MindNode): string {
  const text = (node.text ?? "").trim();
  // Węzeł zapisany rysikiem nie ma napisu. Model musi wiedzieć, że coś tam
  // jest, żeby go nie skasował jako pustego.
  if (!text) return node.ink?.length ? "(węzeł zapisany odręcznie)" : "(pusty węzeł)";
  return text;
}
