/*
  Rozkładanie mapy myśli: temat główny w środku, gałęzie dookoła niego.

  Do tej pory mapa szła w prawo kolumnami, poziom po poziomie. Wygląda to
  porządnie na papierze, ale czyta się źle: przy czterech gałęziach po dwoje
  dzieci kartka rośnie w dół na kilka ekranów, a na telefonie zostaje z tego
  wąski, bardzo długi pasek. Mapa myśli ma się rozchodzić na boki - po to
  właśnie jest mapą, a nie spisem.

  Teraz jest promieniowo i liczone tak:

  1. Każdemu poddrzewu przydzielamy WYCINEK KOŁA, tym szerszy, im więcej
     miejsca na obwodzie potrzebują jego liście. Korzeń dostaje pełne koło,
     jego dzieci dzielą je między siebie, wnuki dzielą wycinek swojego rodzica
     i tak w głąb. Skoro wycinki są rozłączne, gałęzie nie mają się gdzie na
     siebie nałożyć.

  2. Poziom to pierścień. Promień pierścienia bierze się z dwóch warunków
     naraz: musi zmieścić się MIĘDZY węzłem rodzica a węzłem dziecka (w głąb)
     i musi dać każdemu węzłowi tyle łuku, ile zajmuje jego bok (w poprzek).
     Bierzemy większy z nich, więc żadne dwa węzły nie wchodzą na siebie ani
     wzdłuż promienia, ani wzdłuż pierścienia.

  Pierwsze dziecko korzenia siada po prawej, reszta idzie zgodnie z ruchem
  wskazówek zegara - przy dwóch gałęziach wychodzi z tego lewo-prawo, przy
  czterech krzyż. Kilka osobnych map na jednej kartce układa się jedna pod
  drugą, każda wokół własnego środka.

  Wyjątkiem są połączenia krzyżowe narysowane ręcznie - węzeł podwieszony
  w dwóch miejscach rysujemy raz, pod pierwszym rodzicem, a druga kreska musi
  gdzieś przebiec. To jest świadoma decyzja człowieka, nie usterka układu.
*/

import type { MindEdge, MindNode } from "@/lib/document";

/** Lewy górny róg całego rysunku. */
export const LAYOUT_START_X = 40;
export const LAYOUT_START_Y = 40;
/** Najmniejszy prześwit między węzłami - i w głąb, i w poprzek pierścienia. */
export const LAYOUT_GAP = 44;
/** Przerwa między osobnymi mapami, gdy na jednej kartce jest ich kilka. */
export const LAYOUT_CLUSTER_GAP = 96;

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

/*
  Rozmiar węzła pod długość hasła.

  Węzeł ma na sztywno 160×64 i `overflow: hidden`, więc dłuższe hasło było po
  prostu UCINANE - a mapa od asystenta bywa pełna haseł w rodzaju „Koalicja
  polsko-litewska". Do tego jeden bardzo szeroki węzeł rozpycha cały pierścień,
  bo promień liczy się z boków węzłów; dlatego jest górna granica szerokości,
  a dłuższe hasła schodzą do drugiego wiersza.

  Miar pisma na serwerze nie ma, więc szerokość znaku jest oszacowana - ale nie
  jedną liczbą na wszystkie znaki, bo „WWW" i „ili" są w tym samym kroju
  szerokie zupełnie inaczej. Stąd tabelka niżej. Oszacowanie ma być raczej
  za duże niż za małe: węzeł odrobinę za wysoki nikomu nie przeszkadza,
  a ucięte hasło - bardzo.
*/
const NODE_MAX_WIDTH = 280;
const NODE_FONT_SIZE = 15;
/** `line-height: 1.3` z edytora. */
const LINE_RATIO = 1.3;
/** `padding: 6px 10px` z edytora, obustronnie. */
const PAD_X = 20;
const PAD_Y = 12;

/** Szerokość znaku jako ułamek rozmiaru pisma. */
function charRatio(sign: string): number {
  if (sign === " " || sign === "\t") return 0.28;
  if ("iljI.,;:'!|[]()ft".includes(sign)) return 0.33;
  if ("mwMW@%".includes(sign)) return 0.92;
  if ("0123456789".includes(sign)) return 0.57;
  // Wielka litera - także polska. Porównanie z wersją małą odróżnia litery od
  // znaków przestankowych, które są sobie równe w obu wersjach.
  if (sign !== sign.toLowerCase() && sign === sign.toUpperCase()) return 0.68;
  return 0.55;
}

function inkWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const sign of text) total += charRatio(sign) * fontSize;
  return total;
}

/** Ile wierszy zajmie hasło w węźle o takiej szerokości wnętrza. */
function linesNeeded(text: string, usable: number, fontSize: number): number {
  if (usable <= 0) return 1;
  const spaceWidth = inkWidth(" ", fontSize);
  let lines = 0;

  for (const paragraph of text.split("\n")) {
    let taken = 0;
    let count = 1;

    for (const word of paragraph.split(" ")) {
      const wordWidth = inkWidth(word, fontSize);

      if (wordWidth > usable) {
        // Wyraz dłuższy niż cały wiersz łamie się w środku - `word-break`
        // w edytorze robi dokładnie to.
        if (taken > 0) {
          count += 1;
          taken = 0;
        }
        const rows = Math.ceil(wordWidth / usable);
        count += rows - 1;
        taken = wordWidth - (rows - 1) * usable;
        continue;
      }

      const withSpace = taken > 0 ? taken + spaceWidth + wordWidth : wordWidth;
      if (withSpace > usable) {
        count += 1;
        taken = wordWidth;
      } else {
        taken = withSpace;
      }
    }

    lines += count;
  }

  return Math.max(1, lines);
}

/** Szerokość i wysokość węzła, w których hasło się zmieści. */
export function fitNodeSize(
  text: string | undefined,
  fontSize = NODE_FONT_SIZE,
): { width: number; height: number } {
  const clean = (text ?? "").trim();
  if (!clean) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  // Najdłuższy wiersz bez łamania - do tego dążymy szerokością.
  const longest = Math.max(...clean.split("\n").map((line) => inkWidth(line, fontSize)));

  // Najpierw poszerzamy do granicy - dopiero potem łamiemy na kolejne wiersze.
  // Zaokrąglenie do dwudziestki, żeby węzły nie stały na przypadkowych
  // ułamkach piksela.
  const width = Math.min(
    NODE_MAX_WIDTH,
    Math.max(DEFAULT_WIDTH, Math.ceil((longest + PAD_X) / 20) * 20),
  );

  const lines = linesNeeded(clean, width - PAD_X, fontSize);
  const height = Math.max(DEFAULT_HEIGHT, Math.ceil(lines * fontSize * LINE_RATIO + PAD_Y));

  return { width, height };
}

type Slot = {
  id: string;
  depth: number;
  /** Środek wycinka, w radianach. Zero to prawo, rośnie zgodnie z zegarem. */
  angle: number;
  /** Szerokość wycinka w radianach. */
  span: number;
};

/**
 * Nowe położenia wszystkich węzłów. Reszta węzła - napis, barwa, kształt,
 * pismo odręczne - zostaje nietknięta.
 */
export function arrangeMindMap(nodes: MindNode[], edges: MindEdge[]): MindNode[] {
  if (nodes.length === 0) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const width = (id: string) => byId.get(id)?.width ?? DEFAULT_WIDTH;
  const height = (id: string) => byId.get(id)?.height ?? DEFAULT_HEIGHT;

  // --- drzewo do narysowania -------------------------------------------
  // Węzeł podwieszony w dwóch miejscach należy do pierwszego rodzica, do
  // którego uda się dojść; druga krawędź zostaje w mapie, ale układu nie
  // rusza. To samo zabezpieczenie zatrzymuje obchodzenie na pierścieniu.
  const rawChildren = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of edges) {
    if (!byId.has(edge.fromId) || !byId.has(edge.toId)) continue;
    if (edge.fromId === edge.toId) continue;
    rawChildren.set(edge.fromId, [...(rawChildren.get(edge.fromId) ?? []), edge.toId]);
    hasParent.add(edge.toId);
  }

  const kids = new Map<string, string[]>();
  const taken = new Set<string>();

  const grow = (id: string) => {
    const mine: string[] = [];
    for (const child of rawChildren.get(id) ?? []) {
      if (taken.has(child)) continue;
      taken.add(child);
      mine.push(child);
    }
    kids.set(id, mine);
    for (const child of mine) grow(child);
  };

  const roots: string[] = [];
  const openRoot = (id: string) => {
    if (taken.has(id)) return;
    taken.add(id);
    roots.push(id);
    grow(id);
  };

  for (const node of nodes) if (!hasParent.has(node.id)) openRoot(node.id);
  // Zostały węzły zamknięte w pierścieniu - do nich nie da się dojść z żadnego
  // korzenia. Każdy z nich zaczyna własną mapę, żeby nie przepadł.
  for (const node of nodes) openRoot(node.id);

  /*
    Ile obwodu należy się każdej gałęzi.

    Nie liczba liści, tylko ich SZEROKOŚĆ. Liczba liści traktowałaby „1410"
    i „Wzrost znaczenia Polski w Europie Środkowej" jednakowo, więc wycinek
    wychodziłby dla obu ten sam - a skoro promień musi pomieścić najszerszy
    węzeł pierścienia, całe koło rozpychał ten jeden najdłuższy napis.
    Szeroki węzeł dostaje teraz szerszy wycinek i pierścień zostaje ciasny.
  */
  const rim = new Map<string, number>();
  const weigh = (id: string): number => {
    const mine = kids.get(id) ?? [];
    const total =
      mine.length === 0
        ? width(id) + LAYOUT_GAP
        : mine.reduce((sum, child) => sum + weigh(child), 0);
    rim.set(id, total);
    return total;
  };
  for (const root of roots) weigh(root);

  const placed = new Map<string, { x: number; y: number }>();
  let clusterTop = LAYOUT_START_Y;

  for (const root of roots) {
    const slots: Slot[] = [];

    const cut = (id: string, depth: number, from: number, to: number) => {
      slots.push({ id, depth, angle: (from + to) / 2, span: to - from });

      const mine = kids.get(id) ?? [];
      if (mine.length === 0) return;
      const total = mine.reduce((sum, child) => sum + (rim.get(child) ?? 1), 0) || 1;

      let at = from;
      for (const child of mine) {
        const share = ((rim.get(child) ?? 1) / total) * (to - from);
        cut(child, depth + 1, at, at + share);
        at += share;
      }
    };

    /*
      Pełne koło przesunięte tak, żeby PIERWSZE dziecko wypadło dokładnie po
      prawej. Przy jednej gałęzi wychodzi z tego węzeł obok korzenia, przy
      dwóch - lewo i prawo, przy czterech - krzyż. Zaczynanie od góry dawało
      przy jednej gałęzi węzeł pod spodem, co wygląda jak zwykły spis.
    */
    const rootKids = kids.get(root) ?? [];
    const wholeRim = rootKids.reduce((sum, child) => sum + (rim.get(child) ?? 1), 0) || 1;
    const firstShare =
      rootKids.length > 0 ? ((rim.get(rootKids[0]) ?? 1) / wholeRim) * 2 * Math.PI : 0;
    cut(root, 0, -firstShare / 2, -firstShare / 2 + 2 * Math.PI);

    // --- promienie pierścieni --------------------------------------------
    const byDepth = new Map<number, Slot[]>();
    for (const slot of slots) {
      byDepth.set(slot.depth, [...(byDepth.get(slot.depth) ?? []), slot]);
    }
    const parentOf = new Map<string, string>();
    for (const [id, mine] of kids) for (const child of mine) parentOf.set(child, id);

    const deepest = Math.max(...slots.map((slot) => slot.depth));
    const radius = new Map<number, number>([[0, 0]]);

    for (let depth = 1; depth <= deepest; depth += 1) {
      const here = byDepth.get(depth) ?? [];
      const previous = radius.get(depth - 1) ?? 0;

      // W głąb: od boku rodzica do boku dziecka. `reach` to odległość od
      // środka węzła do jego brzegu w stronę, w którą leci promień - dla
      // prostokąta liczy się ją dokładnie, bez zgadywania.
      //
      // OBA boki mierzymy w kierunku DZIECKA, bo tamtędy biegnie odcinek
      // między nimi. Mierzenie rodzica w jego własnym kierunku wpuszczało
      // dziecko na korzeń: korzeń pełnego koła „patrzy" w bok, więc wychodziło
      // z niego pół wysokości zamiast pół szerokości.
      let inward = 0;
      for (const slot of here) {
        const parent = parentOf.get(slot.id);
        const mine = reach(width(slot.id), height(slot.id), slot.angle);
        const theirs = parent ? reach(width(parent), height(parent), slot.angle) : 0;
        inward = Math.max(inward, mine + theirs);
      }

      // W poprzek: łuk przypadający na węzeł musi pomieścić jego bok.
      let sideways = 0;
      for (const slot of here) {
        if (slot.span <= 0) continue;
        const across = span(width(slot.id), height(slot.id), slot.angle);
        sideways = Math.max(sideways, (across + LAYOUT_GAP) / slot.span);
      }

      radius.set(depth, Math.max(previous + inward + LAYOUT_GAP, sideways));
    }

    // --- z biegunowych na zwykłe ------------------------------------------
    const local = new Map<string, { x: number; y: number }>();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const slot of slots) {
      const distance = radius.get(slot.depth) ?? 0;
      const x = Math.round(distance * Math.cos(slot.angle) - width(slot.id) / 2);
      const y = Math.round(distance * Math.sin(slot.angle) - height(slot.id) / 2);
      local.set(slot.id, { x, y });
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + width(slot.id));
      bottom = Math.max(bottom, y + height(slot.id));
    }

    for (const [id, at] of local) {
      placed.set(id, {
        x: at.x - left + LAYOUT_START_X,
        y: at.y - top + clusterTop,
      });
    }

    clusterTop += bottom - top + LAYOUT_CLUSTER_GAP;
  }

  return nodes.map((node) => {
    const at = placed.get(node.id);
    return at ? { ...node, x: at.x, y: at.y } : node;
  });
}

/** Odległość od środka prostokąta do jego brzegu w podanym kierunku. */
function reach(w: number, h: number, angle: number): number {
  return Math.abs(Math.cos(angle)) * (w / 2) + Math.abs(Math.sin(angle)) * (h / 2);
}

/** Szerokość prostokąta mierzona W POPRZEK podanego kierunku. */
function span(w: number, h: number, angle: number): number {
  return Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
}
