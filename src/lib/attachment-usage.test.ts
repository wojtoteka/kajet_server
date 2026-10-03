import { describe, expect, it } from "vitest";
import { droppedAttachments, inUse, mentioned, textPartOf } from "./attachment-usage";

function textNote(markdown: string, drawings: { asset: string; source: string }[] = []): string {
  return JSON.stringify({
    format: 1,
    id: "note-1",
    kind: "text",
    text: { markdown, drawings: drawings.map((d) => ({ ...d, width: 560, height: 300 })) },
  });
}

const drawing = { asset: "rysunek-1.png", source: "rysunek-1.strokes.json" };

describe("attachment usage", () => {
  it("removing a drawing from the text drops its image and strokes", () => {
    const before = textNote("Ala\n\n![rysunek](assets/rysunek-1.png)", [drawing]);
    const after = textNote("Ala", [drawing]);

    expect(
      droppedAttachments(before, after, ["rysunek-1.png", "rysunek-1.strokes.json", "kot.png"]).sort(),
    ).toEqual(["rysunek-1.png", "rysunek-1.strokes.json"]);
  });

  it("an old orphaned drawing (removed before this fix) goes too", () => {
    // Treść już wcześniej nie wskazywała na rysunek, a pliki zostały.
    const before = textNote("Ala", [drawing]);
    const after = textNote("Ala ma kota", [drawing]);

    expect(droppedAttachments(before, after, ["rysunek-1.png", "rysunek-1.strokes.json"]).sort()).toEqual([
      "rysunek-1.png",
      "rysunek-1.strokes.json",
    ]);
  });

  it("a drawing still in the text keeps both files", () => {
    const content = textNote("![rysunek](assets/rysunek-1.png)", [drawing]);
    expect(droppedAttachments(content, content, ["rysunek-1.png", "rysunek-1.strokes.json"])).toEqual([]);
  });

  it("a removed photo goes, a file uploaded but never placed stays", () => {
    const before = textNote('![a|50%](assets/a.png "srodek") ![b](assets/b.png)');
    const after = textNote('![b](assets/b.png)');

    expect(droppedAttachments(before, after, ["a.png", "b.png", "czeka.png"])).toEqual(["a.png"]);
  });

  it("names with spaces and brackets count in every spelling", () => {
    expect(mentioned("![x](assets/zdjecie%20(2).png)", "zdjecie (2).png")).toBe(true);
    expect(mentioned("![x](assets/zdjecie (2).png)", "zdjecie (2).png")).toBe(true);
    expect(mentioned("![x](assets/inne.png)", "zdjecie (2).png")).toBe(false);
  });

  it("strokes count as used while their drawing is in the text", () => {
    const text = textPartOf(textNote("![r](assets/rysunek-1.png)", [drawing]))!;
    expect(inUse(text, "rysunek-1.strokes.json")).toBe(true);
  });

  it("other note kinds are never pruned", () => {
    const handwriting = JSON.stringify({ format: 1, id: "n", kind: "handwritten", handwriting: {} });
    expect(droppedAttachments(handwriting, handwriting, ["img.png"])).toEqual([]);
  });
});
