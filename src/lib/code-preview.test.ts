import { describe, expect, it } from "vitest";
import { FULL_ADDRESS, PREVIEW_MESSAGE, previewDocument } from "./code-preview";

describe("podgląd HTML z notatki", () => {
  it("nie stawia niczego przed doctype", () => {
    // Cokolwiek przed `<!DOCTYPE html>` wrzuca stronę w tryb zgodności
    // i podgląd wygląda inaczej niż strona naprawdę.
    const source = "<!DOCTYPE html>\n<h1>Cześć</h1>";
    const document = previewDocument(source);

    expect(document.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(document).toContain("<h1>Cześć</h1>");
    expect(document).toContain("window.open");
  });

  it("bez doctype wchodzi na samym początku", () => {
    const document = previewDocument("<h1>Cześć</h1>");

    expect(document.startsWith("\n<style>")).toBe(true);
    expect(document.endsWith("<h1>Cześć</h1>")).toBe(true);
  });

  it("płótno jest białe, a arkusz autora zostaje bez zmian", () => {
    // Jak WebView.setBackgroundColor(WHITE): początkowe html/body są białe
    // i jasne. Tego nie wolno wklejać w treść notatki - tylko przed nią,
    // żeby `body { background: navy }` ucznia nadal wygrywał.
    const source = "<!DOCTYPE html>\n<style>body{background:navy}</style><p>Hej</p>";
    const document = previewDocument(source);

    expect(document).toContain("color-scheme: light");
    expect(document).toContain("background-color: #fff");
    expect(document).toContain("body{background:navy}");
    expect(document.indexOf("background-color: #fff")).toBeLessThan(
      document.indexOf("body{background:navy}"),
    );
  });

  it("wchodzi PRZED skrypty autora, inaczej nie złapałby ich console.log", () => {
    // O to chodzi w całej konsoli: uczeń pisze `console.log` w pierwszym
    // wierszu strony. Skrypt doklejony na końcu dokumentu obudziłby się,
    // gdy tamten już dawno by się wykonał.
    const source = '<!DOCTYPE html>\n<script>console.log("suma")</script>';
    const document = previewDocument(source);

    expect(document.indexOf(PREVIEW_MESSAGE)).toBeLessThan(
      document.indexOf('console.log("suma")'),
    );
  });

  it("wstrzykiwany skrypt jest poprawnym JavaScriptem", () => {
    // Skrypt jest zwykłym napisem, więc literówki w nim nie złapie ani
    // TypeScript, ani lint - dopiero przeglądarka, i to po cichu.
    const document = previewDocument("");
    const js = document.slice(document.indexOf("<script>") + 8, document.lastIndexOf("</script>"));

    expect(js).not.toBe("");
    expect(() => new Function(js)).not.toThrow();
  });

  it("przechwytuje console i błędy", () => {
    const js = previewDocument("");

    for (const rodzaj of ["log", "info", "warn", "error", "debug"]) {
      expect(js).toContain(`"${rodzaj}"`);
    }
    expect(js).toContain("unhandledrejection");
    expect(js).toContain("postMessage");
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
