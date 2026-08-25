import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("./rate-limit.fake")).fakeRateLimits(),
}));

import { prisma } from "@/lib/prisma";
import { crashAllowed, MAX_PER_WINDOW } from "./crash-limits";

describe("crashAllowed", () => {
  beforeEach(async () => {
    await prisma.rateLimit.deleteMany({});
  });

  it("przepuszcza raporty do granicy, potem zamyka", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect((await crashAllowed("1.2.3.4")).allowed).toBe(true);
    }

    const gate = await crashAllowed("1.2.3.4");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryInSeconds).toBeGreaterThan(0);
  });

  it("liczy każdy adres osobno", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) await crashAllowed("1.2.3.4");

    // Zapchany jeden tablet nie może zamknąć drogi wszystkim pozostałym.
    expect((await crashAllowed("5.6.7.8")).allowed).toBe(true);
  });

  it("zapytania bez rozpoznanego adresu idą na wspólny licznik", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect((await crashAllowed(null)).allowed).toBe(true);
    }

    // Wspólny licznik jest gorszy niż osobny, ale lepszy niż żaden: bez tego
    // brak nagłówka od pośrednika byłby furtką bez żadnej granicy.
    expect((await crashAllowed(null)).allowed).toBe(false);
  });
});
