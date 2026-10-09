import { describe, expect, it } from "vitest";
import { expectedTables, missingColumns } from "./schema-check";

/*
  Sprawdzenie przy starcie: kod chce kolumn, których stara baza nie ma.
  Przypadek z 9 października 2026 - kod z udostępnianiem folderów, baza sprzed
  `npm run db:apply`.
*/

describe("expectedTables", () => {
  it("bierze nazwy tabel z @@map i tylko prawdziwe kolumny, bez relacji", () => {
    const share = expectedTables().find((table) => table.table === "shares");
    expect(share).toBeDefined();
    expect(share!.columns).toEqual(
      expect.arrayContaining(["noteId", "folderId", "acceptedById", "acceptedAt", "permission"]),
    );
    // Relacje to nie kolumny.
    expect(share!.columns).not.toContain("note");
    expect(share!.columns).not.toContain("folder");
    expect(share!.columns).not.toContain("acceptedBy");
  });
});

describe("missingColumns", () => {
  const expected = [
    { table: "shares", columns: ["id", "noteId", "folderId", "acceptedById"] },
    { table: "live_changes", columns: ["id", "version", "clientId"] },
  ];

  it("nic nie zgłasza, gdy baza ma wszystko - bez względu na wielkość liter", () => {
    const existing = [
      { table: "shares", column: "id" },
      { table: "shares", column: "noteId" },
      { table: "shares", column: "FOLDERID" },
      { table: "SHARES", column: "acceptedById" },
      { table: "live_changes", column: "id" },
      { table: "live_changes", column: "version" },
      { table: "live_changes", column: "clientId" },
      // Kolumna, której kod już nie chce, nie przeszkadza.
      { table: "live_changes", column: "old" },
    ];
    expect(missingColumns(expected, existing)).toEqual([]);
  });

  it("wymienia brakujące kolumny starej bazy", () => {
    const existing = [
      { table: "shares", column: "id" },
      { table: "shares", column: "noteId" },
      { table: "live_changes", column: "id" },
    ];
    expect(missingColumns(expected, existing)).toEqual([
      "shares.folderId",
      "shares.acceptedById",
      "live_changes.version",
      "live_changes.clientId",
    ]);
  });

  it("brak całej tabeli zgłasza raz, bez listy jej kolumn", () => {
    const existing = [
      { table: "shares", column: "id" },
      { table: "shares", column: "noteId" },
      { table: "shares", column: "folderId" },
      { table: "shares", column: "acceptedById" },
    ];
    expect(missingColumns(expected, existing)).toEqual(["live_changes"]);
  });
});
