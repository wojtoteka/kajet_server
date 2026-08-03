import { describe, expect, it } from "vitest";
import { buildCodeNoteContent, parseCodeNote, guessLanguageFromTitle } from "./code-note";

describe("code-note", () => {
  it("round-trips language and source", () => {
    const content = buildCodeNoteContent({
      id: "n1",
      title: "zadanie.py",
      language: "python",
      source: "print(1)",
    });
    const parsed = parseCodeNote(content);
    expect(parsed).toEqual({ language: "python", source: "print(1)" });
  });

  it("guesses language from extension", () => {
    expect(guessLanguageFromTitle("main.ts")).toBe("typescript");
    expect(guessLanguageFromTitle("bez-rozszerzenia")).toBeNull();
  });

  it("falls back for plain source", () => {
    expect(parseCodeNote("print('x')")).toEqual({
      language: "python",
      source: "print('x')",
    });
  });
});
