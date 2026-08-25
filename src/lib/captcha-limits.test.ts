import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("./rate-limit.fake")).fakeRateLimits(),
}));

import { prisma } from "@/lib/prisma";
import { captchaCheckAllowed, MAX_PER_WINDOW } from "./captcha-limits";

describe("captchaCheckAllowed", () => {
  beforeEach(async () => {
    await prisma.rateLimit.deleteMany({});
  });

  it("przepuszcza sprawdzenia do granicy, potem zamyka", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(await captchaCheckAllowed("1.2.3.4")).toBe(true);
    }

    expect(await captchaCheckAllowed("1.2.3.4")).toBe(false);
  });

  it("liczy każdy adres osobno", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) await captchaCheckAllowed("1.2.3.4");

    // Jeden zalany adres nie może zamknąć formularza wszystkim pozostałym.
    expect(await captchaCheckAllowed("5.6.7.8")).toBe(true);
  });

  it("zapytania bez rozpoznanego adresu idą na wspólny licznik", async () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(await captchaCheckAllowed(null)).toBe(true);
    }

    // Wspólny licznik jest gorszy niż osobny, ale lepszy niż żaden: bez tego
    // brak nagłówka od pośrednika byłby furtką bez żadnej granicy.
    expect(await captchaCheckAllowed(null)).toBe(false);
  });
});
