/*
  Punkt `GET /api/v1/app/latest`, po którym aplikacja poznaje, że jest starsza.

  Bazę podstawiamy, tak jak w quota.test.ts - sprawdzana jest sama trasa:
  kształt odpowiedzi, nagłówki cache i zapora zapytań. Testy pilnują też tego,
  czego w odpowiedzi być NIE MOŻE: punkt stoi otworem dla każdego, więc nie ma
  prawa wynieść niczego o kontach ani liczby pobrań.

  Odbicie tych testów po stronie aplikacji siedzi w ServerContractTest.kt.
*/

import { describe, expect, it, vi } from "vitest";

const RELEASE = {
  id: "r1",
  version: "26.08.02",
  versionCode: 5,
  notes: "Powiadamianie o nowej wersji.",
  fileName: "app-release.apk",
  hash: "7bb54fc65421199d052d6b2d5ed03bd692d116958a4699a03b92754391ec2a01",
  sizeBytes: 34_371_499,
  current: true,
  downloads: 128,
  createdAt: new Date("2026-08-02T09:30:00.000Z"),
  uploadedById: "u1",
};

async function routeWith(release: unknown) {
  vi.resetModules();

  // Zapora zapytań liczy próby w bazie (rate-limit.ts), więc podstawiona baza
  // musi umieć i wydania, i liczniki. Tabela liczników zostaje między testami,
  // tak jak zostaje prawdziwa - stąd czyszczenie na wejściu.
  const { fakeRateLimits } = await import("./rate-limit.fake");
  const prisma = {
    appRelease: { findFirst: async () => release },
    ...fakeRateLimits(),
  };
  await prisma.rateLimit.deleteMany({});

  vi.doMock("./prisma", () => ({ prisma }));
  vi.doMock("@/lib/prisma", () => ({ prisma }));
  return import("@/app/api/v1/app/latest/route");
}

function ask(from = "192.0.2.7") {
  return new Request("https://kajet.wojtoteka.ovh/api/v1/app/latest", {
    headers: { "x-forwarded-for": from },
  });
}

describe("GET /api/v1/app/latest", () => {
  it("oddaje wystawione wydanie razem z adresem strony", async () => {
    const { GET } = await routeWith(RELEASE);

    const response = await GET(ask());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.release.version).toBe("26.08.02");
    expect(body.release.versionCode).toBe(5);
    expect(body.release.pageUrl).toMatch(/\/download$/);
    expect(body.release.url).toMatch(/\/download\/file$/);
  });

  it("podaje datę wydania i najstarsze obsługiwane, choć nic nie wymusza", async () => {
    const { GET } = await routeWith(RELEASE);

    const body = await (await GET(ask())).json();

    expect(body.release.releaseDate).toBe("2026-08-02");
    // Zero znaczy: nic nie jest wymuszane. Pole jest zapasem na przyszłość,
    // aplikacja ma je na razie tylko odczytywać.
    expect(body.release.minSupportedRelease).toBe(0);
  });

  it("każe trzymać odpowiedź przez pięć minut, żeby nie odpytywać bazy bez potrzeby", async () => {
    const { GET } = await routeWith(RELEASE);

    const response = await GET(ask());

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("nie wynosi niczego o kontach ani statystyk", async () => {
    const { GET } = await routeWith(RELEASE);

    const body = await (await GET(ask())).json();

    // Spis pól jest zamknięty: dopisanie czegokolwiek do trasy ma tu zapalić
    // czerwone światło, zanim wyjedzie na świat.
    expect(Object.keys(body.release).sort()).toEqual(
      [
        "fileName",
        "hash",
        "minSupportedRelease",
        "notes",
        "pageUrl",
        "publishedAt",
        "releaseDate",
        "sizeBytes",
        "url",
        "version",
        "versionCode",
      ].sort(),
    );
    expect(JSON.stringify(body)).not.toContain("uploadedById");
    expect(JSON.stringify(body)).not.toContain("downloads");
  });

  it("mówi wprost, gdy żadnego wydania jeszcze nie wystawiono", async () => {
    const { GET } = await routeWith(null);

    const response = await GET(ask());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.release).toBeNull();
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("odmawia adresowi, który pyta za często, i mówi kiedy wrócić", async () => {
    const { GET } = await routeWith(RELEASE);
    const { MAX_PER_WINDOW } = await import("./version-limits");

    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      expect((await GET(ask("198.51.100.4"))).status).toBe(200);
    }

    const refused = await GET(ask("198.51.100.4"));

    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await refused.json()).error).toBe("too-often");
  });

  it("liczy każdy adres osobno", async () => {
    const { GET } = await routeWith(RELEASE);
    const { MAX_PER_WINDOW } = await import("./version-limits");

    for (let i = 0; i < MAX_PER_WINDOW; i += 1) await GET(ask("203.0.113.1"));

    // Sąsiad zza tego samego wyjścia nie ma płacić za cudze pytania.
    expect((await GET(ask("203.0.113.2"))).status).toBe(200);
  });
});
