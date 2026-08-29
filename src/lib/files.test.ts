import { describe, expect, it } from "vitest";
import { isAttachmentPathForNote, safeAttachmentName } from "./files";

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

describe("isAttachmentPathForNote", () => {
  const ownerId = "user-1";
  const noteId = "note-1";

  it("accepts only a direct file in the expected owner/note directory", () => {
    expect(
      isAttachmentPathForNote(
        ownerId,
        noteId,
        "user-1/note-1/0123456789abcdef0123456789abcdef.log",
      ),
    ).toBe(true);
    // Paths persisted on Windows remain removable after moving the data to a
    // different host, and vice versa.
    expect(
      isAttachmentPathForNote(
        ownerId,
        noteId,
        "user-1\\note-1\\0123456789abcdef0123456789abcdef.log",
      ),
    ).toBe(true);
  });

  it.each([
    "../outside.log",
    "user-1/note-1/../../outside.log",
    "user-1/note-1/subdirectory/file.log",
    "other-user/note-1/0123456789abcdef0123456789abcdef.log",
    "user-1/other-note/0123456789abcdef0123456789abcdef.log",
    "/user-1/note-1/0123456789abcdef0123456789abcdef.log",
    "C:\\user-1\\note-1\\0123456789abcdef0123456789abcdef.log",
  ])("refuses traversal or a path outside the exact note scope: %s", (relativePath) => {
    expect(isAttachmentPathForNote(ownerId, noteId, relativePath)).toBe(false);
  });
});
