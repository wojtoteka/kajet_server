import { describe, expect, it } from "vitest";
import {
  VALUES_PER_POINT,
  packStrokePoint,
  eraseStrokeFragment,
  strokeHitsCircle,
  argbColor,
  argbFromHex,
  hexFromArgb,
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
  parseExistingHandwritingDocument,
  parseHandwritingNote,
  beginStroke,
  appendStrokePoint,
  defaultHandwritingSeed,
  emptyPage,
  preservePageDimensions,
} from "./handwriting-note";
import {
  TEXT_DEFAULT_SIZE,
  TEXT_LARGEST_SIZE,
  TEXT_SMALLEST_SIZE,
  buildTextNoteContent,
  joinTextBlocks,
  persistFontSize,
  readImageAlt,
  splitTextBlocks,
  writeImageAlt,
  storedFontSize,
  textAppearanceFromContent,
  textMarkdownFromContent,
} from "./text-note";

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

  /*
    Kształty przychodzą z tabletu w tym samym pliku co kreski. Zapis ze strony
    nie ma prawa ich zgubić - inaczej otwarcie notatki w przeglądarce kasowałoby
    to, co ktoś narysował rysikiem.
  */
  it("zapis ze strony nie gubi kształtów przyniesionych z tabletu", () => {
    const fromTablet = JSON.stringify({
      format: 1,
      id: "hw2",
      kind: "handwritten",
      title: "Rysunek",
      handwriting: {
        pageMode: "a4",
        background: "lined",
        pages: [
          {
            id: "s1",
            width: 595,
            height: 842,
            strokes: [],
            shapes: [
              {
                id: "f1",
                kind: "ellipse",
                x: 60,
                y: 400,
                width: 180,
                height: 120,
                rotation: 30,
                color: -5000000,
                strokeWidth: 3,
                fill: 872349519,
                opacity: 0.8,
              },
            ],
          },
        ],
      },
    });

    const parsed = parseHandwritingNote(fromTablet);
    expect(parsed?.pages[0].shapes).toHaveLength(1);

    // Tak zapisuje edytor na stronie: strony idą dalej takie, jakie przyszły.
    const saved = buildHandwritingNoteContent({
      id: "hw2",
      title: "Rysunek",
      pages: parsed!.pages,
    });
    const shape = parseHandwritingNote(saved)?.pages[0].shapes?.[0];

    expect(shape?.kind).toBe("ellipse");
    expect(shape?.rotation).toBe(30);
    expect(shape?.opacity).toBe(0.8);
  });

  it("świeża strona ma spis kształtów, więc jest gdzie je dopisać", () => {
    expect(emptyPage().shapes).toEqual([]);
  });

  /*
    Tablet rozróżnia kartkę A4 od jednej długiej strony po wysokości w
    content.json. Edytor WWW doliczał wysokość z atramentu i wpisywał ją
    z powrotem - krótka notatka na długiej kartce stawała się A4.
  */
  it("zapis ze strony nie przepisuje wysokości kartki z tabletu", () => {
    const fromTablet = JSON.stringify({
      format: 1,
      id: "hw3",
      kind: "handwritten",
      title: "Długa",
      handwriting: {
        pageMode: "scroll",
        background: "lined",
        pages: [
          {
            id: "s1",
            width: 595,
            height: 1684,
            strokes: [],
          },
        ],
      },
    });

    const existing = parseExistingHandwritingDocument(fromTablet);
    const parsed = parseHandwritingNote(fromTablet);
    const refitted = parsed!.pages.map((entry) => ({ ...entry, height: 960 }));

    expect(preservePageDimensions(refitted, existing)[0].height).toBe(1684);

    const saved = buildHandwritingNoteContent({
      id: "hw3",
      title: "Długa",
      pages: refitted,
      pageMode: parsed!.pageMode,
      background: parsed!.background,
      existing,
    });
    const body = JSON.parse(saved).handwriting;
    expect(body.pageMode).toBe("scroll");
    expect(body.pages[0].width).toBe(595);
    expect(body.pages[0].height).toBe(1684);
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

  it("writes the appearance fields the tablet declares in TextContent", () => {
    // Serial names from NoteDocument.kt in the app: font ("body"/"heading"/
    // "mono"), fontSize, textColor, align ("left"/"center"/"right").
    const content = buildTextNoteContent({
      id: "t1",
      title: "Tekst",
      markdown: "abc",
      appearance: { font: "mono", fontSize: 20, align: "center" },
    });
    const text = JSON.parse(content).text;
    expect(text.font).toBe("mono");
    expect(text.fontSize).toBe(20);
    expect(text.align).toBe("center");
    expect(text.textColor).toBe(0);
  });

  it("keeps the appearance chosen on the tablet when the web saves", () => {
    const existing = JSON.parse(
      buildTextNoteContent({
        id: "t1",
        title: "Tekst",
        markdown: "abc",
        appearance: { font: "heading", fontSize: 24, align: "right" },
      }),
    );
    const resaved = JSON.parse(
      buildTextNoteContent({ id: "t1", title: "Tekst", markdown: "abcd", existing }),
    );
    expect(resaved.text.font).toBe("heading");
    expect(resaved.text.fontSize).toBe(24);
    expect(resaved.text.align).toBe("right");
  });

  it("writes and reads the whole-note text colour", () => {
    // Android ARGB is a SIGNED 32-bit int - kotlinx.serialization writes
    // values like -10079710 into content.json.
    const content = buildTextNoteContent({
      id: "t1",
      title: "Tekst",
      markdown: "abc",
      appearance: { textColor: -10079710 },
    });
    expect(JSON.parse(content).text.textColor).toBe(-10079710);
    expect(textAppearanceFromContent(content).textColor).toBe(-10079710);
  });

  it("keeps the tablet's text colour when the web form does not send one", () => {
    const existing = JSON.parse(
      buildTextNoteContent({
        id: "t1",
        title: "Tekst",
        markdown: "abc",
        appearance: { textColor: -10079710 },
      }),
    );
    const resaved = buildTextNoteContent({
      id: "t1",
      title: "Tekst",
      markdown: "abcd",
      appearance: { font: "mono" },
      existing,
    });
    expect(JSON.parse(resaved).text.textColor).toBe(-10079710);
  });

  it("keeps fontSize 0 (theme default) when the web resaves it", () => {
    const existing = JSON.parse(
      buildTextNoteContent({
        id: "t1",
        title: "Tekst",
        markdown: "abc",
        appearance: { fontSize: 0 },
      }),
    );
    expect(existing.text.fontSize).toBe(0);
    const resaved = JSON.parse(
      buildTextNoteContent({
        id: "t1",
        title: "Tekst",
        markdown: "abcd",
        appearance: { fontSize: 0 },
        existing,
      }),
    );
    expect(resaved.text.fontSize).toBe(0);
  });

  it("does not persist preview 17 when stored size is still the theme default", () => {
    expect(storedFontSize(0)).toBe(0);
    expect(storedFontSize(-1)).toBe(0);
    expect(storedFontSize(TEXT_SMALLEST_SIZE)).toBe(TEXT_SMALLEST_SIZE);
    expect(storedFontSize(TEXT_DEFAULT_SIZE)).toBe(TEXT_DEFAULT_SIZE);
    expect(storedFontSize(TEXT_LARGEST_SIZE)).toBe(TEXT_LARGEST_SIZE);
    expect(storedFontSize(9)).toBe(TEXT_SMALLEST_SIZE);
    expect(storedFontSize(49)).toBe(TEXT_LARGEST_SIZE);

    expect(persistFontSize(0, TEXT_DEFAULT_SIZE)).toBe(0);
    expect(persistFontSize(0, 18)).toBe(18);
    expect(persistFontSize(0, 16)).toBe(16);
    expect(persistFontSize(16, TEXT_DEFAULT_SIZE)).toBe(TEXT_DEFAULT_SIZE);
    expect(persistFontSize(20, 0)).toBe(0);
  });

});

/*
  Pole do pisania na WWW pokazuje notatkę w kawałkach, żeby zdjęcie było
  zdjęciem, a nie zapisem `![...](...)`. Notatka zapisana jest dalej jednym
  markdownem, więc podział i sklejenie muszą oddać dokładnie tę samą treść -
  inaczej samo otwarcie notatki po cichu by ją przerabiało.
*/
describe("bloki treści tekstowej", () => {
  it("wyjmuje zdjęcie do osobnego bloku", () => {
    const blocks = splitTextBlocks("Przed\n![zdjęcie](assets/kot.gif)\nPo");
    expect(blocks).toEqual([
      { kind: "text", text: "Przed" },
      {
        kind: "image",
        alt: "zdjęcie",
        target: "assets/kot.gif",
        width: 100,
        align: "left",
        beside: false,
      },
      { kind: "text", text: "Po" },
    ]);
  });

  it("zostawia miejsce do pisania przy każdym zdjęciu", () => {
    // Notatka z samych zdjęć: bez pustych bloków tekstu nie byłoby gdzie
    // kliknąć, żeby cokolwiek dopisać.
    const blocks = splitTextBlocks("![a](assets/1.png)\n![b](assets/2.png)");
    expect(blocks.map((block) => block.kind)).toEqual([
      "text",
      "image",
      "text",
      "image",
      "text",
    ]);
    expect(joinTextBlocks(blocks)).toBe("![a](assets/1.png)\n![b](assets/2.png)");
  });

  it("oddaje tę samą treść po podziale i sklejeniu", () => {
    for (const markdown of [
      "",
      "sam tekst",
      "# Nagłówek\n\nakapit\n\n- lista",
      "![zdjęcie](assets/kot.gif)",
      "Przed\n\n![zdjęcie](assets/kot.gif)\n\nPo",
      "![a](assets/1.png)\ntekst\n![b](assets/2.png)",
      "![a|25%](assets/1.png) ![b|25%](assets/2.png)",
      '![a|25%](assets/1.png "srodek") ![b|25%](assets/2.png "srodek")',
      '![a|30%](assets/1.png "prawo")',
      "przed wierszem\n![a|25%](assets/1.png) ![b|25%](assets/2.png)\npo wierszu",
      "![zdjęcie|60%](assets/kot.gif)",
      "wiersz\n",
    ]) {
      expect(joinTextBlocks(splitTextBlocks(markdown))).toBe(markdown);
    }
  });

  it("czyta nazwy z nawiasami, tak jak podgląd", () => {
    // Magazyn przy kolizji nazw dokleja „ (2)" - taki odnośnik też ma być
    // zdjęciem, a nie tekstem.
    const blocks = splitTextBlocks("![zdjęcie](assets/zdjecie (2).png)");
    expect(blocks[1]).toEqual({
      kind: "image",
      alt: "zdjęcie",
      target: "assets/zdjecie (2).png",
      width: 100,
      align: "left",
      beside: false,
    });
  });

  it("zdjęcia z jednego wiersza stoją obok siebie", () => {
    const line = "![a|25%](assets/a.png) ![b|25%](assets/b.png)";
    const blocks = splitTextBlocks(line);
    const photos = blocks.filter((block) => block.kind === "image");
    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({ target: "assets/a.png", beside: false });
    expect(photos[1]).toMatchObject({ target: "assets/b.png", beside: true });
    // Między zdjęciami stojącymi obok siebie ma zostać sam odstęp - nowy
    // wiersz rozsunąłby je z powrotem jedno pod drugie.
    expect(joinTextBlocks(blocks)).toBe(line);
  });

  it("ułożenie ma cały wiersz, nie pojedyncze zdjęcie", () => {
    const blocks = splitTextBlocks('![a](assets/a.png "srodek") ![b](assets/b.png)');
    const photos = blocks.filter((block) => block.kind === "image");
    expect(photos.every((photo) => photo.kind === "image" && photo.align === "center")).toBe(
      true,
    );
    expect(joinTextBlocks(blocks)).toBe(
      '![a](assets/a.png "srodek") ![b](assets/b.png "srodek")',
    );
  });

  it("zdjęcie odsunięte do własnego wiersza schodzi pod poprzednie", () => {
    const blocks = splitTextBlocks("![a|25%](assets/a.png) ![b|25%](assets/b.png)");
    const apart = blocks.map((block) =>
      block.kind === "image" && block.beside ? { ...block, beside: false } : block,
    );
    expect(joinTextBlocks(apart)).toBe("![a|25%](assets/a.png)\n![b|25%](assets/b.png)");
  });

  it("puste kawałki do pisania nie zostają w treści", () => {
    const joined = joinTextBlocks([
      { kind: "text", text: "" },
      {
        kind: "image",
        alt: "zdjęcie",
        target: "assets/kot.gif",
        width: 100,
        align: "left",
        beside: false,
      },
      { kind: "text", text: "" },
    ]);
    expect(joined).toBe("![zdjęcie](assets/kot.gif)");
  });
});

/*
  Rozmiar zdjęcia nie ma gdzie stanąć w markdownie, więc kanonicznie siedzi
  w opisie: `![zdjęcie|60%](url)`. Tablet kiedyś pisał go w tytule
  (`![zdjęcie](url "60%")`). Oba zapisy muszą wrócić tym samym markdownem,
  inaczej synchronizacja gubi szerokość.
*/
describe("rozmiar zdjęcia w treści", () => {
  it("czyta szerokość z opisu", () => {
    expect(readImageAlt("zdjęcie|60%")).toEqual({ alt: "zdjęcie", width: 60 });
    expect(readImageAlt("zdjęcie")).toEqual({ alt: "zdjęcie", width: 100 });
  });

  it("czyta szerokość ze starego tytułu w cudzysłowie", () => {
    expect(readImageAlt("zdjęcie", "60%")).toEqual({ alt: "zdjęcie", width: 60 });
  });

  it("trzyma szerokość przy podziale i sklejeniu", () => {
    const blocks = splitTextBlocks("![zdjęcie|40%](assets/kot.gif)");
    expect(blocks[1]).toEqual({
      kind: "image",
      alt: "zdjęcie",
      target: "assets/kot.gif",
      width: 40,
      align: "left",
      beside: false,
    });
    expect(joinTextBlocks(blocks)).toBe("![zdjęcie|40%](assets/kot.gif)");
  });

  it("stary zapis z tytułem wraca kanonicznym dopiskiem w opisie", () => {
    const blocks = splitTextBlocks('![zdjęcie](assets/kot.gif "40%")');
    expect(blocks[1]).toEqual({
      kind: "image",
      alt: "zdjęcie",
      target: "assets/kot.gif",
      width: 40,
      align: "left",
      beside: false,
    });
    expect(joinTextBlocks(blocks)).toBe("![zdjęcie|40%](assets/kot.gif)");
  });

  it("czyta oba zapisy przy nazwie z nawiasem", () => {
    const fromAlt = splitTextBlocks("![z|40%](assets/zdjecie (2).png)");
    const fromTitle = splitTextBlocks('![z](assets/zdjecie (2).png "40%")');
    expect(fromAlt[1]).toEqual({
      kind: "image",
      alt: "z",
      target: "assets/zdjecie (2).png",
      width: 40,
      align: "left",
      beside: false,
    });
    expect(fromTitle[1]).toEqual(fromAlt[1]);
    expect(joinTextBlocks(fromTitle)).toBe("![z|40%](assets/zdjecie (2).png)");
  });

  it("zdjęcie na całą szerokość zapisuje się bez dopisku", () => {
    const joined = joinTextBlocks([
      {
        kind: "image",
        alt: "zdjęcie",
        target: "assets/kot.gif",
        width: 100,
        align: "left",
        beside: false,
      },
    ]);
    expect(joined).toBe("![zdjęcie](assets/kot.gif)");
  });

  it("z pliku czyta małe wartości, a zapis ściąga do 20%", () => {
    // 5% ze starego suwaka w aplikacji zostaje przy odczycie; zapis dopiero
    // schodzi do wspólnego progu ze stroną.
    expect(readImageAlt("a|5%").width).toBe(5);
    expect(readImageAlt("a|400%").width).toBe(100);
    expect(writeImageAlt("a", 5)).toBe("a|20%");
    expect(writeImageAlt("a", 400)).toBe("a");
    expect(joinTextBlocks(splitTextBlocks("![a|5%](assets/x.png)"))).toBe(
      "![a|20%](assets/x.png)",
    );
  });
});

/*
  Listy pisane z klawiatury. Bez tego wychodziło „1. 1. 1.": Enter nie zaczynał
  kolejnej pozycji, więc znacznik trzeba było doklejać przyciskiem - a przycisk
  dokładał go do wiersza, który już go miał.
*/
describe("własne kolory", () => {
  it("zapisuje kolor tak, jak robi to tablet", () => {
    expect(argbFromHex("#0f6b5c")).toBe(argbColor(15, 107, 92));
    // Pełna nieprzezroczystość ustawia najstarszy bit, więc liczba jest ujemna
    // - dokładnie tak, jak zapisuje ją Android.
    expect(argbFromHex("#0f6b5c")).toBeLessThan(0);
  });

  it("wraca z liczby na kolor bez zmiany odcienia", () => {
    for (const hex of ["#0f6b5c", "#a6392e", "#2850a0", "#ffffff", "#000000"]) {
      expect(hexFromArgb(argbFromHex(hex))).toBe(hex);
    }
  });

  it("przyjmuje krótki zapis i odrzuca śmieci", () => {
    expect(argbFromHex("#abc")).toBe(argbFromHex("#aabbcc"));
    // Zero znaczy „bez własnego koloru" i tyle też trzyma tablet jako domyślne.
    expect(argbFromHex("nie kolor")).toBe(0);
    expect(hexFromArgb(0, "#123456")).toBe("#123456");
  });

  it("przenosi własny kolor węzła przez zapis i odczyt notatki", () => {
    const wybrany = argbFromHex("#6b3fa0");
    const content = buildMindMapNoteContent({
      id: "m1",
      title: "Mapa",
      nodes: [createMindNode({ x: 0, y: 0, customColor: wybrany, textColor: argbFromHex("#a6392e") })],
      edges: [],
    });
    const node = parseMindMapNote(content)!.nodes[0];
    expect(node.customColor).toBe(wybrany);
    expect(hexFromArgb(node.textColor)).toBe("#a6392e");
  });
});
