/*
  Operacje asystenta na mapie myśli i pilnowanie, żeby mapa po nich dalej
  trzymała się kupy.

  To jest ważniejsze niż sam schemat JSON. Uszkodzony markdown widać od razu.
  Uszkodzoną mapę - węzeł wiszący w próżni, krawędź do nieistniejącego węzła,
  gałąź zapętloną sama w siebie - widać dopiero wtedy, gdy edytor przestanie
  ją rysować albo zawiesi się na obchodzeniu drzewa.

  Dlatego model NIE dostaje listy węzłów do przepisania. Dostaje pięć operacji
  i tyle. Cała reszta - identyfikatory, położenie na kartce, pismo odręczne
  w węźle, kolory - zostaje tam, gdzie była, bo model nigdy jej nie dotyka.

  Czego tu NIE sprawdzamy, choć kiedyś sprawdzaliśmy: że węzeł ma najwyżej
  jednego rodzica i że gałąź nie zamyka się w pierścień. Oba edytory - i na
  stronie, i na tablecie - pozwalają takie mapy narysować i umieją je rysować
  dalej (druga krawędź jest przy układaniu pomijana, obchodzenie drzewa ma
  zabezpieczenie przed pętlą). Skoro człowiek ma prawo taką mapę zrobić, to
  asystent nie ma prawa odmówić przy niej pracy - a odmawiał, i to na zawsze,
  bo sprawdzenie szło po CAŁEJ mapie, nie po tym, co sam zmienił.

  Zostaje to, co naprawdę psuje plik: węzeł bez identyfikatora, powtórzony
  identyfikator, krawędź do węzła, którego nie ma, i węzeł podwieszony sam pod
  siebie. Przed zawiązaniem pierścienia bronimy się przy samej operacji
  „przenieś" - asystent nie ma prawa go zrobić, ale nie ma też prawa uznać za
  usterkę tego, który zrobił człowiek.
*/

import { createMindEdge, createMindNode } from "@/lib/mindmap-note";
import { arrangeMindMap } from "@/lib/mindmap-layout";
import type { MindEdge, MindNode } from "@/lib/document";

/** Odstępy przepisane z edytora, żeby dostawiony węzeł stanął tam, gdzie stanąłby ręcznie. */
const GAP_X = 64;
const GAP_Y = 20;

export type MindMapOperation = {
  rodzaj: "dodaj" | "usun" | "usun_galaz" | "zmien_tekst" | "przenies";
  /**
   * Przy „dodaj" to nazwa TYMCZASOWA, wymyślona przez model, żeby dało się
   * podwiesić pod nią kolejne węzły w tej samej paczce. Prawdziwy
   * identyfikator nadaje serwer - inaczej model mógłby trafić w cudzy.
   */
  id: string;
  text?: string;
  /** Puste albo brak znaczy „korzeń". */
  rodzicId?: string | null;
};

export type MindMapBefore = { nodes: MindNode[]; edges: MindEdge[] };

export type MindMapResult =
  | { ok: true; nodes: MindNode[]; edges: MindEdge[] }
  | { ok: false; powod: string };

/**
 * Wykonuje paczkę operacji na kopii mapy i oddaje wynik dopiero wtedy, gdy
 * całość przejdzie sprawdzenie. Wszystko albo nic - notatka nie ma prawa
 * zostać w stanie „połowa zmian weszła".
 */
export function applyMindMapOperations(
  before: MindMapBefore,
  operations: MindMapOperation[],
): MindMapResult {
  if (operations.length === 0) {
    return { ok: false, powod: "Asystent nie podał żadnej zmiany do wykonania." };
  }

  const nodes = before.nodes.map((node) => ({ ...node }));
  const edges = before.edges.map((edge) => ({ ...edge }));
  const mapWasEmpty = before.nodes.length === 0;

  /** Tymczasowa nazwa od modelu -> prawdziwy identyfikator nadany tutaj. */
  const minted = new Map<string, string>();
  const added = new Set<string>();

  const realId = (name: string | null | undefined): string | null => {
    if (!name) return null;
    return minted.get(name) ?? name;
  };
  const nodeAt = (id: string) => nodes.find((node) => node.id === id);
  const parentOf = (id: string) => edges.find((edge) => edge.toId === id);
  const childrenOf = (id: string) => edges.filter((edge) => edge.fromId === id);

  // Zdejmujemy WSZYSTKIE krawędzie wchodzące, nie pierwszą z brzegu. Węzeł
  // narysowany ręcznie potrafi mieć ich kilka, a „przenieś pod X" znaczy, że
  // po zmianie wisi pod X - nie pod X i jeszcze pod tym, co było wcześniej.
  const detach = (id: string) => {
    for (let i = edges.length - 1; i >= 0; i -= 1) {
      if (edges[i].toId === id) edges.splice(i, 1);
    }
  };

  const attach = (childId: string, parentId: string | null) => {
    detach(childId);
    if (parentId) edges.push(createMindEdge(parentId, childId));
  };

  for (const operation of operations) {
    const { rodzaj } = operation;

    if (rodzaj === "dodaj") {
      if (!operation.id) {
        return { ok: false, powod: "Asystent nie nazwał dodawanego węzła." };
      }
      if (minted.has(operation.id)) {
        return {
          ok: false,
          powod: `Asystent użył nazwy „${operation.id}" dla dwóch nowych węzłów.`,
        };
      }

      const parentId = realId(operation.rodzicId);
      if (parentId && !nodeAt(parentId)) {
        return {
          ok: false,
          powod: `Asystent chciał podwiesić nowy węzeł pod „${parentId}", a takiego węzła nie ma.`,
        };
      }
      // Poza pustą mapą każdy nowy węzeł musi mieć rodzica - inaczej właśnie
      // to się dzieje, czego pilnujemy: powstaje sierota. Mapa zakładana od
      // zera jest wyjątkiem: jej pierwszy węzeł nie ma pod co pójść.
      if (!parentId && !mapWasEmpty) {
        return {
          ok: false,
          powod: "Asystent chciał dodać węzeł, który do niczego nie jest podłączony.",
        };
      }

      const parent = parentId ? nodeAt(parentId) : null;
      const siblings = parentId ? childrenOf(parentId).length : nodes.length;
      const fresh = createMindNode(
        parent
          ? {
              x: parent.x + (parent.width ?? 160) + GAP_X,
              y: parent.y + siblings * ((parent.height ?? 64) + GAP_Y),
              text: operation.text ?? "",
            }
          : { x: 200, y: 160 + siblings * (64 + GAP_Y), text: operation.text ?? "" },
      );

      nodes.push(fresh);
      minted.set(operation.id, fresh.id);
      added.add(fresh.id);
      if (parentId) attach(fresh.id, parentId);
      continue;
    }

    const id = realId(operation.id);
    if (!id || !nodeAt(id)) {
      return {
        ok: false,
        powod: `Asystent wskazał węzeł „${operation.id}", a takiego w mapie nie ma.`,
      };
    }

    if (rodzaj === "zmien_tekst") {
      const node = nodeAt(id)!;
      node.text = operation.text ?? "";
      continue;
    }

    if (rodzaj === "przenies") {
      const parentId = realId(operation.rodzicId);
      if (parentId && !nodeAt(parentId)) {
        return {
          ok: false,
          powod: `Asystent chciał przenieść węzeł pod „${parentId}", a takiego węzła nie ma.`,
        };
      }
      if (parentId === id) {
        return { ok: false, powod: "Asystent chciał podwiesić węzeł sam pod siebie." };
      }
      // Pod własnego potomka też nie - to zamyka gałąź w pierścień, który
      // urywa ją od reszty mapy i zawiesza obchodzenie drzewa.
      if (parentId && isDescendant(edges, id, parentId)) {
        return {
          ok: false,
          powod: "Asystent chciał przenieść węzeł pod jego własną gałąź.",
        };
      }
      attach(id, parentId);
      continue;
    }

    if (rodzaj === "usun") {
      // Dzieci przechodzą tam, gdzie wisiał kasowany węzeł. Bez tego jedno
      // „usuń ten punkt" zabierałoby ze sobą całą gałąź pod spodem.
      //
      // Przepinamy SAMĄ krawędź od kasowanego węzła, zamiast wołać attach:
      // attach zdjąłby dziecku wszystkie krawędzie wchodzące, więc dziecko
      // podwieszone ręcznie w dwóch miejscach straciłoby przy okazji to
      // drugie połączenie, które z kasowaniem nie ma nic wspólnego.
      const grandparent = parentOf(id)?.fromId ?? null;
      for (const edge of childrenOf(id)) {
        const wouldLoop = grandparent === edge.toId;
        const alreadyThere = edges.some(
          (other) => other !== edge && other.fromId === grandparent && other.toId === edge.toId,
        );
        // Bez dziadka nie ma dokąd przepiąć - krawędź znika razem z węzłem,
        // a dziecko zostaje korzeniem.
        if (grandparent && !wouldLoop && !alreadyThere) edge.fromId = grandparent;
      }
      removeNode(nodes, edges, id);
      continue;
    }

    if (rodzaj === "usun_galaz") {
      for (const doomed of branchOf(edges, id)) removeNode(nodes, edges, doomed);
      continue;
    }

    return { ok: false, powod: `Asystent poprosił o nieznaną zmianę „${rodzaj}".` };
  }

  const complaint = checkMindMap({ nodes, edges }, added, mapWasEmpty);
  if (complaint) return { ok: false, powod: complaint };

  /*
    Po zmianie budowy mapa idzie do rozłożenia od nowa. Pozycje wymyślane przy
    pojedynczej operacji nie widzą całości i to one robiły plątaninę: węzły
    spod różnych rodziców trafiały w ten sam punkt, a „przenieś" zmieniało
    rodzica, zostawiając węzeł tam, gdzie stał.

    Sama zmiana napisu układu nie rusza - nie ma po co, a przesuwanie mapy
    przy poprawianiu literówki byłoby wścibskie.
  */
  const zmienionaBudowa = operations.some((operation) => operation.rodzaj !== "zmien_tekst");
  if (zmienionaBudowa) {
    return { ok: true, nodes: arrangeMindMap(nodes, edges), edges };
  }

  return { ok: true, nodes, edges };
}

/**
 * Sprawdzenie gotowej mapy. Osobno od wykonywania operacji, bo to samo
 * sprawdzenie ma sens także dla mapy, która przyszła z zewnątrz.
 *
 * Oddaje zdanie o tym, co jest nie tak, albo null, gdy wszystko gra.
 */
export function checkMindMap(
  map: MindMapBefore,
  added: ReadonlySet<string> = new Set(),
  /**
   * Czy mapa przed zmianą była zupełnie pusta. Wtedy węzeł dodany bez rodzica
   * jest korzeniem, a nie sierotą - i to jest jedyny przypadek, w którym wolno
   * mu zostać bez połączenia.
   */
  mapWasEmpty = false,
): string | null {
  const ids = new Set<string>();
  for (const node of map.nodes) {
    if (!node.id) return "W mapie jest węzeł bez identyfikatora.";
    if (ids.has(node.id)) return `Węzeł „${node.id}" występuje w mapie dwa razy.`;
    ids.add(node.id);
  }

  const edgeIds = new Set<string>();
  const parents = new Map<string, string>();
  for (const edge of map.edges) {
    if (edgeIds.has(edge.id)) return "Dwie krawędzie mapy mają ten sam identyfikator.";
    edgeIds.add(edge.id);

    if (!ids.has(edge.fromId) || !ids.has(edge.toId)) {
      return "W mapie została krawędź prowadząca do węzła, którego już nie ma.";
    }
    if (edge.fromId === edge.toId) return "W mapie jest węzeł podwieszony sam pod siebie.";
    // Węzeł z dwoma rodzicami i gałąź zamknięta w pierścień to mapy, które
    // człowiek ma prawo narysować w obu edytorach - patrz komentarz na górze
    // pliku. Zapamiętujemy pierwszego rodzica, żeby dało się rozpoznać sierotę.
    if (!parents.has(edge.toId)) parents.set(edge.toId, edge.fromId);
  }

  // Sierota: węzeł, który asystent właśnie dodał, a który do niczego nie
  // prowadzi. Mapa zakładana od zera jest wyjątkiem - jej pierwszy węzeł nie
  // ma pod co pójść i właśnie on jest korzeniem.
  if (!mapWasEmpty) {
    for (const id of added) {
      if (ids.has(id) && !parents.has(id) && map.nodes.length > 1) {
        return "Asystent zostawił dodany węzeł bez połączenia z resztą mapy.";
      }
    }
  }

  return null;
}

function removeNode(nodes: MindNode[], edges: MindEdge[], id: string): void {
  const at = nodes.findIndex((node) => node.id === id);
  if (at >= 0) nodes.splice(at, 1);
  for (let i = edges.length - 1; i >= 0; i -= 1) {
    if (edges[i].fromId === id || edges[i].toId === id) edges.splice(i, 1);
  }
}

/** Węzeł razem ze wszystkim, co pod nim wisi. */
function branchOf(edges: MindEdge[], rootId: string): string[] {
  const all: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    all.push(id);
    for (const edge of edges) if (edge.fromId === id) queue.push(edge.toId);
  }
  return all;
}

/** Czy `maybeChild` wisi gdzieś pod `ancestorId`. */
function isDescendant(edges: MindEdge[], ancestorId: string, maybeChild: string): boolean {
  return branchOf(edges, ancestorId).includes(maybeChild);
}
