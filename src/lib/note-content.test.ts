import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  PACKED,
  PACK_FROM_BYTES,
  isPacked,
  packNoteContent,
  unpackNoteContent,
} from "./note-content";

/** Notatka odręczna w miniaturze: kreska jako długi ciąg liczb, jak z tabletu. */
function handwriting(points: number): string {
  const values: string[] = [];
  for (let i = 0; i < points; i += 1) {
    values.push((100 + i * 0.47).toFixed(2), (300 + Math.sin(i / 9) * 4).toFixed(2), `${i * 4}.0`, "0.512", "0.785", "3.142");
  }
  return JSON.stringify({
    format: 1,
    id: "n1",
    kind: "handwritten",
    handwriting: { pages: [{ id: "p1", strokes: [{ id: "s1", points: [] }] }] },
  }).replace('"points":[]', `"points":[${values.join(",")}]`);
}

describe("packNoteContent", () => {
  it("packs a handwritten note several times smaller and gets it back byte for byte", async () => {
    const content = handwriting(3000);
    const stored = await packNoteContent(content);

    expect(isPacked(stored)).toBe(true);
    expect(stored.length).toBeLessThan(content.length / 3);
    expect(unpackNoteContent(stored)).toBe(content);
  });

  it("keeps Polish letters and emoji intact", async () => {
    const content = JSON.stringify({ text: { markdown: "Zażółć gęślą jaźń 🖋️ ".repeat(200) } });
    expect(unpackNoteContent(await packNoteContent(content))).toBe(content);
  });

  it("leaves a short note as it is", async () => {
    const content = '{"format":1,"id":"n1","kind":"text","text":{"markdown":"Hej"}}';
    expect(content.length).toBeLessThan(PACK_FROM_BYTES);
    expect(await packNoteContent(content)).toBe(content);
  });

  it("never stores more than the note itself", async () => {
    // Szum się nie kurczy: brotli w base64 wyszedłby dłuższy niż oryginał.
    const noise = randomBytes(6000).toString("base64");
    const stored = await packNoteContent(noise);
    expect(stored.length).toBeLessThanOrEqual(noise.length);
    expect(unpackNoteContent(stored)).toBe(noise);
  });

  it("always packs content that itself starts with the marker", async () => {
    const content = `${PACKED}to tylko tekst`;
    const stored = await packNoteContent(content);
    expect(stored).not.toBe(content);
    expect(unpackNoteContent(stored)).toBe(content);
  });
});

describe("unpackNoteContent", () => {
  it("passes through notes stored before packing", () => {
    const content = handwriting(10);
    expect(unpackNoteContent(content)).toBe(content);
    expect(unpackNoteContent("")).toBe("");
  });

  it("gives back what is stored when the packed part is broken", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = `${PACKED}to-nie-jest-brotli`;
    expect(unpackNoteContent(broken)).toBe(broken);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
