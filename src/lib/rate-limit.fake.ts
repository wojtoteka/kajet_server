/*
  Podrobiona tabela liczników - wyłącznie dla testów.

  Zapory (logowanie, awarie, wersja, captcha, uruchamianie kodu) liczą próby
  w bazie, a testy mają chodzić bez MySQL-a. To jest ta jedna tabela w pamięci,
  udająca `prisma.rateLimit` dokładnie w tym zakresie, z którego korzysta
  rate-limit.ts - i ani trochę szerzej, żeby podróbka nie zaczęła obiecywać
  czegoś, czego prawdziwa Prisma nie robi.

  Plik nie kończy się na `.test.ts`, więc vitest nie bierze go za zestaw
  testów; to sam sprzęt do nich.
*/

type Row = { bucket: string; hits: number; startedAt: Date };

type Where = {
  bucket?: string | { in: string[] };
  startedAt?: { lt: Date };
};

/*
  Wiersze wiszą przy globalThis, a nie przy module - tak samo jak prawdziwy
  klient Prismy w prisma.ts. Dzięki temu `vi.resetModules()` w teście znaczy
  to, co ma znaczyć: moduły wstają od nowa, a tabela zostaje. Restart procesu
  na serwerze wygląda dokładnie tak i o to w tej zmianie chodziło.
*/
const kept = globalThis as { fakeRateLimitRows?: Map<string, Row> };

/** Tabela `rate_limits` w pamięci, w kształcie klienta Prismy. */
export function fakeRateLimits() {
  const rows = (kept.fakeRateLimitRows ??= new Map<string, Row>());

  const copy = (row: Row): Row => ({ ...row, startedAt: new Date(row.startedAt) });

  const matches = (row: Row, where: Where | undefined): boolean => {
    if (!where) return true;
    if (typeof where.bucket === "string" && row.bucket !== where.bucket) return false;
    if (
      where.bucket &&
      typeof where.bucket === "object" &&
      !where.bucket.in.includes(row.bucket)
    ) {
      return false;
    }
    if (where.startedAt && !(row.startedAt < where.startedAt.lt)) return false;
    return true;
  };

  return {
    rateLimit: {
      async upsert(args: {
        where: { bucket: string };
        create: Row;
        update: { hits: { increment: number } };
      }): Promise<Row> {
        const found = rows.get(args.where.bucket);
        if (!found) {
          const born = copy(args.create);
          rows.set(born.bucket, born);
          return copy(born);
        }
        found.hits += args.update.hits.increment;
        return copy(found);
      },

      async update(args: {
        where: { bucket: string };
        data: { hits: number; startedAt: Date };
      }): Promise<Row> {
        const found = rows.get(args.where.bucket);
        // Prawdziwa Prisma rzuca tu P2025 - w testach wystarczy, że nie
        // udajemy, że wiersz był.
        if (!found) throw new Error(`Brak licznika ${args.where.bucket}`);
        found.hits = args.data.hits;
        found.startedAt = new Date(args.data.startedAt);
        return copy(found);
      },

      async findMany(args?: { where?: Where }): Promise<Row[]> {
        return [...rows.values()].filter((row) => matches(row, args?.where)).map(copy);
      },

      async deleteMany(args?: { where?: Where }): Promise<{ count: number }> {
        let count = 0;
        for (const [bucket, row] of [...rows]) {
          if (!matches(row, args?.where)) continue;
          rows.delete(bucket);
          count += 1;
        }
        return { count };
      },
    },
  };
}
