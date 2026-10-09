import { describe, expect, it } from "vitest";
import { unixLineEnds } from "./text-note";

/*
  Końce linii z formularza. Strona zapisuje notatkę akcją serwera, a ta
  dostaje treść jako multipart/form-data - w nim każde "\n" staje się "\r\n".
  Do 9 października 2026 to "\r" lądowało w bazie i rozjeżdżało edycję na
  żywo: strona miała "\n", serwer "\r\n", a pozycje zmian liczone na jednym
  trafiały w złe miejsca drugiego.
*/

describe("unixLineEnds", () => {
  it("cofa to, co z końcami linii robi wysyłka formularza", async () => {
    const markdown = "Pierwszy akapit\n\nDrugi akapit\n- punkt\n";
    const form = new FormData();
    form.set("markdown", markdown);

    // Ta sama droga co akcja serwera: formularz zakodowany i odczytany z powrotem.
    const received = (await new Response(form).formData()).get("markdown") as string;
    expect(received).toBe("Pierwszy akapit\r\n\r\nDrugi akapit\r\n- punkt\r\n");

    expect(unixLineEnds(received)).toBe(markdown);
  });

  it("samotne \\r też staje się końcem linii, reszta tekstu bez zmian", () => {
    expect(unixLineEnds("a\rb\r\nc\nd")).toBe("a\nb\nc\nd");
    expect(unixLineEnds("bez końców linii")).toBe("bez końców linii");
    expect(unixLineEnds("")).toBe("");
  });
});
