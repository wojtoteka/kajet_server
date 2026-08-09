import { describe, expect, it } from "vitest";
import { FULL_ADDRESS, previewDocument } from "./code-preview";

describe("podgląd HTML z notatki", () => {
  it("zostawia kod nietknięty i dopisuje się dopiero na końcu", () => {
    const source = "<!DOCTYPE html>\n<h1>Cześć</h1>";
    const document = previewDocument(source);

    // Nic przed doctype - inaczej podgląd wpadłby w tryb zgodności.
    expect(document.startsWith(source)).toBe(true);
    expect(document).toContain("window.open");
  });

  it("wstrzykiwany skrypt jest poprawnym JavaScriptem", () => {
    // Skrypt jest zwykłym napisem, więc literówki w nim nie złapie ani
    // TypeScript, ani lint - dopiero przeglądarka, i to po cichu.
    const document = previewDocument("");
    const js = document.slice(document.indexOf("<script>") + 8, document.lastIndexOf("</script>"));

    expect(js).not.toBe("");
    expect(() => new Function(js)).not.toThrow();
  });

  it("do nowej karty wyprowadza tylko pełne adresy", () => {
    expect(FULL_ADDRESS.test("https://www.tiktok.com")).toBe(true);
    expect(FULL_ADDRESS.test("http://przyklad.pl/strona")).toBe(true);
    expect(FULL_ADDRESS.test("//przyklad.pl")).toBe(true);

    expect(FULL_ADDRESS.test("#dalej")).toBe(false);
    expect(FULL_ADDRESS.test("mailto:jan.kowalski@example.com")).toBe(false);
    expect(FULL_ADDRESS.test("druga-strona.html")).toBe(false);
  });
});
