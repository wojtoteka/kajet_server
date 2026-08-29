import { describe, expect, it } from "vitest";
import {
  NOTE_DISPLAY_LIMITS,
  downloadableNote,
  downloadDisposition,
  noteDisplayDecision,
} from "./note-display";

describe("note display limits", () => {
  it("allows the exact limit and blocks the first byte above it", () => {
    const limit = NOTE_DISPLAY_LIMITS.CODE;
    expect(
      noteDisplayDecision({ kind: "CODE", content: "x".repeat(limit), sizeBytes: 0 }),
    ).toMatchObject({ sizeBytes: limit, limitBytes: limit, tooLarge: false });
    expect(
      noteDisplayDecision({ kind: "CODE", content: "x".repeat(limit + 1), sizeBytes: 0 }),
    ).toMatchObject({ tooLarge: true });
  });

  it("measures UTF-8 instead of trusting a stale database size", () => {
    const content = "ą".repeat(NOTE_DISPLAY_LIMITS.TEXT / 2 + 1);
    expect(content.length).toBeLessThan(NOTE_DISPLAY_LIMITS.TEXT);
    expect(noteDisplayDecision({ kind: "TEXT", content, sizeBytes: 0 }).tooLarge).toBe(true);
  });

  it("uses a lower limit for rich text than for code", () => {
    expect(NOTE_DISPLAY_LIMITS.TEXT).toBeLessThan(NOTE_DISPLAY_LIMITS.CODE);
  });
});

describe("large note download", () => {
  it("extracts code source and keeps an imported file extension", () => {
    const content = JSON.stringify({
      id: "note-1",
      kind: "code",
      code: { language: "python", source: "print('ok')\n" },
    });
    expect(
      downloadableNote({ id: "note-1", kind: "CODE", title: "raport.log", content }),
    ).toEqual({
      body: "print('ok')\n",
      fileName: "raport.log",
      contentType: "text/plain; charset=utf-8",
    });
  });

  it("adds the language extension when a code title has none", () => {
    const content = JSON.stringify({
      id: "note-2",
      code: { language: "typescript", source: "const ok = true;" },
    });
    expect(
      downloadableNote({ id: "note-2", kind: "CODE", title: "program", content }).fileName,
    ).toBe("program.ts");
  });

  it("extracts markdown from a text note", () => {
    const content = JSON.stringify({ id: "note-3", text: { markdown: "# Tytuł\n" } });
    expect(
      downloadableNote({ id: "note-3", kind: "TEXT", title: "opis", content }),
    ).toMatchObject({ body: "# Tytuł\n", fileName: "opis.md" });
  });

  it("builds a safe attachment header with a UTF-8 filename", () => {
    const header = downloadDisposition("zażółć plik.py");
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain('filename="zaz-o-c-plik.py"');
    expect(header).toContain("filename*=UTF-8''za%C5%BC%C3%B3%C5%82%C4%87%20plik.py");
  });
});
