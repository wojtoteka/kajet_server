import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_COLORS,
  PALETTE_COOKIE,
  cookieValue,
  parsePalette,
  serializePalette,
} from "./palette";
import { argbColor } from "./document";

describe("parsePalette", () => {
  it("pusty zapis to pusta paleta", () => {
    expect(parsePalette(null)).toEqual([]);
    expect(parsePalette("")).toEqual([]);
  });

  it("czyta barwy po przecinku, z białymi znakami i wielkimi literami", () => {
    expect(parsePalette("ff23211d, FF0F6B5C")).toEqual([
      argbColor(35, 33, 29),
      argbColor(15, 107, 92),
    ]);
  });

  it("pomija śmieci, zamiast wysypywać się na całym zapisie", () => {
    expect(parsePalette("nic,ff0f6b5c,123,,#ffffff")).toEqual([argbColor(15, 107, 92)]);
  });

  it("nie wpuszcza więcej barw, niż mieści pasek", () => {
    const long = Array.from({ length: 20 }, () => "ff0f6b5c").join(",");
    expect(parsePalette(long)).toHaveLength(MAX_CUSTOM_COLORS);
  });

  it("wraca po zapisie tą samą paletą", () => {
    // Barwy z krycia poniżej pełnego - alfa musi przetrwać obie strony.
    const colors = [argbColor(15, 107, 92), argbColor(255, 230, 80, 120)];
    expect(parsePalette(serializePalette(colors))).toEqual(colors);
  });
});

describe("serializePalette", () => {
  it("pisze barwy po osiem znaków, z zerami na początku", () => {
    expect(serializePalette([argbColor(0, 0, 0)])).toBe("ff000000");
  });

  it("ucina nadmiar, żeby ciasteczko nie puchło", () => {
    const long = Array.from({ length: 20 }, () => argbColor(15, 107, 92));
    expect(serializePalette(long).split(",")).toHaveLength(MAX_CUSTOM_COLORS);
  });
});

describe("cookieValue", () => {
  it("wyjmuje właśnie to ciasteczko, nie sąsiada o podobnej nazwie", () => {
    const jar = `inne=1; ${PALETTE_COOKIE}=ff0f6b5c; ${PALETTE_COOKIE}_stare=nic`;
    expect(cookieValue(jar, PALETTE_COOKIE)).toBe("ff0f6b5c");
  });

  it("brak ciasteczka to null", () => {
    expect(cookieValue("inne=1", PALETTE_COOKIE)).toBeNull();
  });
});
