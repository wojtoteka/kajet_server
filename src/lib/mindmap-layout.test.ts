import { describe, expect, it } from "vitest";
import { arrangeMindMap, fitNodeSize } from "@/lib/mindmap-layout";
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

function box(node: MindNode) {
  return {
    left: node.x,
    top: node.y,
    right: node.x + (node.width ?? 160),
    bottom: node.y + (node.height ?? 64),
  };
}

/** Pary węzłów, które na siebie zachodzą. Pusta lista znaczy „mapa czytelna". */
function overlaps(nodes: MindNode[]): string[] {
  const bad: string[] = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const one = box(nodes[a]);
      const two = box(nodes[b]);
      const apart =
        one.right <= two.left ||
        two.right <= one.left ||
        one.bottom <= two.top ||
        two.bottom <= one.top;
      if (!apart) bad.push(`${nodes[a].id} × ${nodes[b].id}`);
    }
  }
  return bad;
}

function middle(node: MindNode) {
  return { x: node.x + (node.width ?? 160) / 2, y: node.y + (node.height ?? 64) / 2 };
}

describe("układ mapy myśli", () => {
  it("żadne dwa węzły na siebie nie zachodzą", () => {
    const { nodes, edges } = grunwald();
    expect(overlaps(arrangeMindMap(nodes, edges))).toEqual([]);
  });

  it("temat główny stoi w środku, gałęzie dookoła niego", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    const srodek = middle(przy("korzen"));
    const galezie = [0, 1, 2, 3].map((at) => middle(przy(`g${at}`)));

    // Dookoła znaczy: są i po prawej, i po lewej, i wyżej, i niżej.
    expect(galezie.some((at) => at.x > srodek.x)).toBe(true);
    expect(galezie.some((at) => at.x < srodek.x)).toBe(true);
    expect(galezie.some((at) => at.y > srodek.y)).toBe(true);
    expect(galezie.some((at) => at.y < srodek.y)).toBe(true);
  });

  it("pierwsza gałąź wychodzi w prawo, a nie w dół", () => {
    const korzen = { ...createMindNode({ x: 0, y: 0, text: "Temat" }), id: "korzen" };
    const jedno = { ...createMindNode({ x: 0, y: 0, text: "Jedyna gałąź" }), id: "jedno" };

    const ulozone = arrangeMindMap([korzen, jedno], [createMindEdge("korzen", "jedno")]);
    const srodek = middle(ulozone.find((node) => node.id === "korzen")!);
    const galaz = middle(ulozone.find((node) => node.id === "jedno")!);

    expect(galaz.x).toBeGreaterThan(srodek.x);
    expect(Math.abs(galaz.y - srodek.y)).toBeLessThanOrEqual(1);
  });

  it("poziom to pierścień: rodzeństwo stoi w równej odległości od środka", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);
    const przy = (id: string) => ulozone.find((node) => node.id === id)!;

    const srodek = middle(przy("korzen"));
    const odleglosc = (id: string) => {
      const at = middle(przy(id));
      return Math.hypot(at.x - srodek.x, at.y - srodek.y);
    };

    const pierwszy = [0, 1, 2, 3].map((at) => odleglosc(`g${at}`));
    for (const promien of pierwszy) {
      expect(Math.abs(promien - pierwszy[0])).toBeLessThanOrEqual(1);
    }

    const drugi = [0, 1, 2, 3].flatMap((at) => [odleglosc(`g${at}a`), odleglosc(`g${at}b`)]);
    for (const promien of drugi) {
      expect(Math.abs(promien - drugi[0])).toBeLessThanOrEqual(1);
    }
    // Dalszy pierścień jest dalej - inaczej wnuki siedziałyby na gałęziach.
    expect(drugi[0]).toBeGreaterThan(pierwszy[0]);
  });

  it("mapa rozchodzi się na boki, a nie w dół jednym paskiem", () => {
    const { nodes, edges } = grunwald();
    const ulozone = arrangeMindMap(nodes, edges);

    const szerokosc = Math.max(...ulozone.map((n) => box(n).right)) -
      Math.min(...ulozone.map((n) => box(n).left));
    const wysokosc = Math.max(...ulozone.map((n) => box(n).bottom)) -
      Math.min(...ulozone.map((n) => box(n).top));

    // Kolumnowy układ dawał tu pasek jakieś trzy razy wyższy niż szerszy.
    expect(szerokosc).toBeGreaterThan(wysokosc / 2);
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
    expect(overlaps(ulozone)).toEqual([]);
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
    expect(overlaps(ulozone)).toEqual([]);
  });

  it("kilka osobnych map na jednej kartce nie wchodzi jedna na drugą", () => {
    const nodes: MindNode[] = [];
    const edges: MindEdge[] = [];
    for (const mapa of ["a", "b"]) {
      nodes.push({ ...createMindNode({ x: 0, y: 0, text: mapa }), id: mapa });
      for (const dziecko of ["1", "2", "3"]) {
        nodes.push({
          ...createMindNode({ x: 0, y: 0, text: `${mapa}${dziecko}` }),
          id: `${mapa}${dziecko}`,
        });
        edges.push(createMindEdge(mapa, `${mapa}${dziecko}`));
      }
    }

    expect(overlaps(arrangeMindMap(nodes, edges))).toEqual([]);
  });

  it("nie nakłada węzłów także wtedy, gdy hasła są bardzo różnej długości", () => {
    const { nodes, edges } = grunwald();
    const zRozmiarem = nodes.map((node, at) => ({
      ...node,
      text: at % 3 === 0 ? `${node.text} ${"i tak dalej ".repeat(6)}` : node.text,
      ...fitNodeSize(at % 3 === 0 ? `${node.text} ${"i tak dalej ".repeat(6)}` : node.text),
    }));

    expect(overlaps(arrangeMindMap(zRozmiarem, edges))).toEqual([]);
  });
});

describe("rozmiar węzła pod hasło", () => {
  it("krótkie hasło zostaje w rozmiarze domyślnym", () => {
    expect(fitNodeSize("Zakupy")).toEqual({ width: 160, height: 64 });
  });

  it("pusty węzeł też - może w nim być pismo odręczne", () => {
    expect(fitNodeSize("")).toEqual({ width: 160, height: 64 });
    expect(fitNodeSize(undefined)).toEqual({ width: 160, height: 64 });
  });

  it("dłuższe hasło dostaje szerszy węzeł, żeby nie zostało ucięte", () => {
    const { width } = fitNodeSize("Koalicja polsko-litewska");
    expect(width).toBeGreaterThan(160);
  });

  it("szerokość ma górną granicę - inaczej jeden węzeł rozpychałby cały pierścień", () => {
    const { width } = fitNodeSize("bardzo długie hasło ".repeat(10));
    expect(width).toBeLessThanOrEqual(280);
  });

  it("po dojściu do granicy hasło schodzi do kolejnych wierszy", () => {
    const krotkie = fitNodeSize("Pokój w Toruniu");
    const dlugie = fitNodeSize("bardzo długie hasło ".repeat(10));
    expect(dlugie.height).toBeGreaterThan(krotkie.height);
  });

  /*
    Wersaliki są w każdym kroju wyraźnie szersze od małych liter, a „lll" węższe
    od „mmm". Przy jednej uśrednionej szerokości znaku wychodziło z tego
    oszacowanie na dwa wiersze tam, gdzie przeglądarka rysowała cztery - i dwa
    ostatnie były ucięte.
  */
  it("tyle samo znaków, ale szerszych, potrzebuje co najmniej tyle samo miejsca", () => {
    const dlugosc = 120;
    const waskie = fitNodeSize("l".repeat(dlugosc));
    const male = fitNodeSize("a".repeat(dlugosc));
    const duze = fitNodeSize("A".repeat(dlugosc));
    const najszersze = fitNodeSize("W".repeat(dlugosc));

    expect(male.height).toBeGreaterThan(waskie.height);
    expect(duze.height).toBeGreaterThan(male.height);
    expect(najszersze.height).toBeGreaterThan(duze.height);
  });

  it("napis na cztery wiersze dostaje wysokość czterech wierszy", () => {
    // Tyle wersalików mieści się w węźle o granicznej szerokości dopiero
    // w czwartym wierszu - taki właśnie napis był na zrzucie ucięty.
    const { height } = fitNodeSize("A".repeat(100));
    expect(height).toBeGreaterThanOrEqual(4 * 15 * 1.3);
  });

  it("każdy wiersz wpisany ręcznie liczy się osobno", () => {
    const jeden = fitNodeSize("Temat");
    const trzy = fitNodeSize("Temat\ndrugi\ntrzeci");
    expect(trzy.height).toBeGreaterThan(jeden.height);
  });
});
