import { describe, expect, it } from "vitest";
import { safeAttachmentName } from "./files";

describe("safeAttachmentName", () => {
  it("zamienia spacje na myślniki, bo spacja urywa odnośnik do zdjęcia", () => {
    expect(safeAttachmentName("Avatar Wojtoteka.gif")).toBe("Avatar-Wojtoteka.gif");
  });

  it("wyrzuca nawiasy, które zamknęłyby odnośnik za wcześnie", () => {
    expect(safeAttachmentName("zdjęcie (2).png")).toBe("zdjęcie-2.png");
  });

  it("zostawia polskie znaki i zwykłe nazwy bez zmian", () => {
    expect(safeAttachmentName("ćwiczenie_1.png")).toBe("ćwiczenie_1.png");
  });

  it("bierze samą nazwę pliku, bez ścieżki z urządzenia", () => {
    expect(safeAttachmentName("C:\\Users\\Wojtek\\obraz.png")).toBe("obraz.png");
  });

  it("nie oddaje nazwy pustej ani zaczynającej się od kropki", () => {
    expect(safeAttachmentName("...")).toMatch(/^plik-\d+$/);
    expect(safeAttachmentName(".ukryty.png")).toBe("ukryty.png");
  });
});
