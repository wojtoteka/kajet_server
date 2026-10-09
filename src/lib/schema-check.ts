import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/*
  Czy baza nadąża za kodem.

  Kod i schemat bazy wdraża się dwoma krokami: nowe pliki z buildem i osobno,
  świadomie, `npm run db:apply` (scripts/zastosuj-schemat.sh). Gdy drugi krok
  wypadnie, Prisma pada na każdym zapytaniu o nową kolumnę („The column
  `kajet.shares.folderId` does not exist"), strona pokazuje „Coś się
  popsuło", a z dziennika nie widać, czy zawinił kod, czy baza. Tak było przy
  wdrożeniu udostępniania folderów, 9 października 2026.

  Dlatego przy starcie procesu porównujemy kolumny, których chce kod, z tym,
  co baza ma naprawdę. Gdy czegoś brakuje, w dzienniku staje jedno zdanie
  z listą braków i gotową komendą. Niczego tu nie zmieniamy: zmiana schematu
  zostaje świadomą komendą człowieka przy klawiaturze.
*/

export type ExpectedTable = { table: string; columns: string[] };
export type ExistingColumn = { table: string; column: string };

/** Tabele i kolumny, których chce wygenerowany klient Prismy. */
export function expectedTables(models = Prisma.dmmf.datamodel.models): ExpectedTable[] {
  return models.map((model) => ({
    table: model.dbName ?? model.name,
    columns: model.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .map((field) => field.dbName ?? field.name),
  }));
}

/**
 * Czego brakuje w bazie: „tabela", gdy nie ma całej tabeli, albo
 * „tabela.kolumna". Nazwy porównujemy bez wielkości liter, tak jak MySQL
 * porównuje nazwy kolumn.
 */
export function missingColumns(expected: ExpectedTable[], existing: ExistingColumn[]): string[] {
  const tables = new Map<string, Set<string>>();
  for (const { table, column } of existing) {
    const key = table.toLowerCase();
    let columns = tables.get(key);
    if (!columns) tables.set(key, (columns = new Set()));
    columns.add(column.toLowerCase());
  }

  const missing: string[] = [];
  for (const { table, columns } of expected) {
    const present = tables.get(table.toLowerCase());
    if (!present) {
      missing.push(table);
      continue;
    }
    for (const column of columns) {
      if (!present.has(column.toLowerCase())) missing.push(`${table}.${column}`);
    }
  }
  return missing;
}

/** Sprawdza bazę i, gdy jest starsza niż kod, mówi o tym w dzienniku. */
export async function checkDatabaseSchema(): Promise<void> {
  let rows: { t: string; c: string }[];
  try {
    rows = await prisma.$queryRaw<{ t: string; c: string }[]>`
      SELECT TABLE_NAME AS t, COLUMN_NAME AS c
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()`;
  } catch (problem) {
    // Baza nie odpowiada - to pokaże pierwsze zwykłe zapytanie, nie my.
    console.error(`[baza] nie sprawdziłem schematu: ${(problem as Error)?.message ?? problem}`);
    return;
  }

  const missing = missingColumns(
    expectedTables(),
    rows.map((row) => ({ table: String(row.t), column: String(row.c) })),
  );
  if (missing.length === 0) return;

  const shown = missing.slice(0, 20).join(", ") + (missing.length > 20 ? ", ..." : "");
  console.error(
    `[baza] BAZA JEST STARSZA NIŻ KOD - brakuje: ${shown}.\n` +
      `[baza] Dopóki tego nie uzupełnisz, część stron pokaże „Coś się popsuło".\n` +
      `[baza] W katalogu serwera: npm run db:apply, potem restart procesu w pm2.`,
  );
}
