import { describe, expect, it } from "vitest";
import {
  LIBRARY_FILE_EXTENSIONS,
  LIBRARY_FILE_NAME_LIMIT,
  checkLibraryFileMetadata,
  decodeLibraryFile,
  libraryFileMimeMatches,
  libraryFileType,
  safeLibraryFileName,
} from "./library-file";

describe("library file contract with Android", () => {
  it("accepts exactly the extensions from CodeLanguage.kt", () => {
    expect(LIBRARY_FILE_EXTENSIONS).toEqual([
      "py",
      "js",
      "mjs",
      "ts",
      "sh",
      "bash",
      "c",
      "h",
      "cpp",
      "cc",
      "cxx",
      "hpp",
      "cs",
      "java",
      "php",
      "rb",
      "sql",
      "html",
      "htm",
      "kt",
      "kts",
      "go",
      "rs",
      "txt",
      "log",
      "csv",
    ]);

    for (const unsupported of ["md", "json", "xml", "pdf", "png", "exe", "zip"]) {
      expect(libraryFileType(`plik.${unsupported}`)).toBeNull();
    }
  });

  it("resolves aliases and the SQL collision just like the app", () => {
    expect(libraryFileType("modul.mjs")?.language).toBe("javascript");
    expect(libraryFileType("naglowek.H")?.language).toBe("c");
    expect(libraryFileType("program.kts")?.language).toBe("kotlin");
    expect(libraryFileType("zapytanie.sql")?.language).toBe("sqlite3");
    expect(libraryFileType("serwer.log")?.language).toBe("text");
  });

  it("allows textual and common picker MIME values but rejects binary disguise", () => {
    const python = libraryFileType("main.py")!;
    const typescript = libraryFileType("main.ts")!;

    expect(libraryFileMimeMatches(python, "text/x-python; charset=utf-8")).toBe(true);
    expect(libraryFileMimeMatches(python, "application/octet-stream")).toBe(true);
    expect(libraryFileMimeMatches(typescript, "video/mp2t")).toBe(true);
    expect(libraryFileMimeMatches(python, "image/png")).toBe(false);
    expect(libraryFileMimeMatches(python, "application/pdf")).toBe(false);
  });

  it("strips paths and unsafe device names while retaining the extension", () => {
    expect(safeLibraryFileName("../../lekcja.py")).toBe("lekcja.py");
    expect(safeLibraryFileName("C:\\Users\\Ada\\CON.py")).toBe("_CON.py");
    expect(safeLibraryFileName(".sekret.kt")).toBe("_sekret.kt");

    const long = safeLibraryFileName(`${"a".repeat(150)}.kts`);
    expect(long).toHaveLength(LIBRARY_FILE_NAME_LIMIT);
    expect(long.endsWith(".kts")).toBe(true);
  });

  it("checks the byte limit before reading the body", () => {
    expect(
      checkLibraryFileMetadata(
        { name: "duzy.log", type: "text/plain", size: 800_000 },
        25 * 1024 * 1024,
      ),
    ).toMatchObject({ ok: true, file: { name: "duzy.log" } });
    expect(
      checkLibraryFileMetadata(
        { name: "za-duzy.log", type: "text/plain", size: 101 },
        100,
      ),
    ).toEqual({ ok: false, problem: "too-large" });
  });

  it("requires real UTF-8 text and refuses NUL bytes", () => {
    expect(decodeLibraryFile(new TextEncoder().encode("zażółć\n"))).toBe("zażółć\n");
    expect(decodeLibraryFile(Uint8Array.from([0xc3, 0x28]))).toBeNull();
    expect(decodeLibraryFile(Uint8Array.from([0x61, 0x00, 0x62]))).toBeNull();
  });
});
