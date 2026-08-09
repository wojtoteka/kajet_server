import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  knownLanguage,
  languageFromCookies,
  words,
} from "./i18n";

describe("język strony", () => {
  it("bez wyboru strona jest po polsku", () => {
    expect(DEFAULT_LANGUAGE).toBe("pl");
    expect(languageFromCookies(null)).toBe("pl");
    expect(languageFromCookies("")).toBe("pl");
    expect(languageFromCookies("cos-innego=1")).toBe("pl");
  });

  it("czyta wybór z ciasteczka", () => {
    expect(languageFromCookies(`${LANGUAGE_COOKIE}=en`)).toBe("en");
    expect(languageFromCookies(`inne=1; ${LANGUAGE_COOKIE}=en; jeszcze=2`)).toBe("en");
    expect(languageFromCookies(`${LANGUAGE_COOKIE}=pl`)).toBe("pl");
  });

  it("nieznana wartość wraca na polski", () => {
    // Ciasteczko może ruszyć ktokolwiek - strona ma się wtedy co najwyżej
    // pokazać po polsku, a nie wywrócić na braku słownika.
    expect(knownLanguage("de")).toBe("pl");
    expect(knownLanguage("")).toBe("pl");
    expect(knownLanguage(undefined)).toBe("pl");
    expect(languageFromCookies(`${LANGUAGE_COOKIE}=klingon`)).toBe("pl");
  });

  it("oba języki mają komplet napisów", () => {
    const pl = words("pl");
    const en = words("en");

    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    for (const [key, value] of Object.entries(en)) {
      expect(value, `pusty napis „${key}" po angielsku`).not.toBe("");
    }
    for (const [key, value] of Object.entries(pl)) {
      expect(value, `pusty napis „${key}" po polsku`).not.toBe("");
    }
  });

  it("angielski naprawdę różni się od polskiego", () => {
    const pl = words("pl");
    const en = words("en");
    // Nazwy własne („Kajet") wolno zostawić, ale nie wszystko naraz.
    const same = Object.keys(pl).filter(
      (key) => pl[key as keyof typeof pl] === en[key as keyof typeof en],
    );
    expect(same.length).toBeLessThan(Object.keys(pl).length / 4);
  });
});
