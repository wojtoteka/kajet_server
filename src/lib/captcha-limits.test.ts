import { beforeEach, describe, expect, it } from "vitest";
import { captchaCheckAllowed, forgetAllCaptchaChecks, MAX_PER_WINDOW } from "./captcha-limits";

describe("captchaCheckAllowed", () => {
  beforeEach(() => {
    forgetAllCaptchaChecks();
  });

  it("przepuszcza sprawdzenia do granicy, potem zamyka", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(captchaCheckAllowed("1.2.3.4")).toBe(true);
    }

    expect(captchaCheckAllowed("1.2.3.4")).toBe(false);
  });

  it("liczy każdy adres osobno", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) captchaCheckAllowed("1.2.3.4");

    // Jeden zalany adres nie może zamknąć formularza wszystkim pozostałym.
    expect(captchaCheckAllowed("5.6.7.8")).toBe(true);
  });

  it("zapytania bez rozpoznanego adresu idą na wspólny licznik", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect(captchaCheckAllowed(null)).toBe(true);
    }

    // Wspólny licznik jest gorszy niż osobny, ale lepszy niż żaden: bez tego
    // brak nagłówka od pośrednika byłby furtką bez żadnej granicy.
    expect(captchaCheckAllowed(null)).toBe(false);
  });
});
