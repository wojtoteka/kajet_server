import { beforeEach, describe, expect, it } from "vitest";
import { crashAllowed, forgetAllCrashes, MAX_PER_WINDOW } from "./crash-limits";

describe("crashAllowed", () => {
  beforeEach(() => {
    forgetAllCrashes();
  });

  it("przepuszcza raporty do granicy, potem zamyka", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(crashAllowed("1.2.3.4").allowed).toBe(true);
    }

    const gate = crashAllowed("1.2.3.4");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryInSeconds).toBeGreaterThan(0);
  });

  it("liczy każdy adres osobno", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) crashAllowed("1.2.3.4");

    // Zapchany jeden tablet nie może zamknąć drogi wszystkim pozostałym.
    expect(crashAllowed("5.6.7.8").allowed).toBe(true);
  });

  it("zapytania bez rozpoznanego adresu idą na wspólny licznik", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(crashAllowed(null).allowed).toBe(true);
    }

    // Wspólny licznik jest gorszy niż osobny, ale lepszy niż żaden: bez tego
    // brak nagłówka od pośrednika byłby furtką bez żadnej granicy.
    expect(crashAllowed(null).allowed).toBe(false);
  });
});
