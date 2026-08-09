import { describe, expect, it, vi } from "vitest";

/*
  Granica miejsca dla całego serwera.

  Samo porównanie, bez bazy: to ono decyduje o przyjęciu albo odrzuceniu
  każdego zapisu, więc ma być sprawdzone także wtedy, gdy MySQL-a nigdzie nie
  ma. Granicę wstrzykujemy przez podmienione ustawienia, bo `SERVER_QUOTA`
  liczy się raz, przy wczytaniu modułu.
*/

async function quotaWithLimit(serverBytes: number) {
  vi.resetModules();
  vi.doMock("./prisma", () => ({ prisma: {} }));
  vi.doMock("./settings", () => ({
    settings: { quotas: { default: 524_288_000, server: serverBytes } },
  }));
  return import("./quota");
}

describe("overServerLimit", () => {
  it("przepuszcza zapis mieszczący się w granicy", async () => {
    const { overServerLimit } = await quotaWithLimit(100);
    expect(overServerLimit(90n, 10)).toBe(false);
  });

  it("odrzuca zapis, który przekroczyłby granicę", async () => {
    const { overServerLimit } = await quotaWithLimit(100);
    expect(overServerLimit(90n, 11)).toBe(true);
  });

  it("na pełnym serwerze odrzuca nawet jeden bajt", async () => {
    const { overServerLimit } = await quotaWithLimit(100);
    expect(overServerLimit(100n, 1)).toBe(true);
  });

  it("zwalnianie miejsca przepuszcza zawsze", async () => {
    const { overServerLimit } = await quotaWithLimit(100);

    // Inaczej pełny serwer zamknąłby jedyną drogę wyjścia: kasowanie notatek
    // idzie tą samą ścieżką, co zapisywanie, tylko z ujemną liczbą bajtów.
    expect(overServerLimit(200n, -50)).toBe(false);
    expect(overServerLimit(200n, 0)).toBe(false);
  });

  it("zero zdejmuje granicę zupełnie", async () => {
    const { overServerLimit } = await quotaWithLimit(0);
    expect(overServerLimit(10n ** 15n, 1_000_000)).toBe(false);
  });

  it("domyślnie stoi na 20 GB", async () => {
    vi.resetModules();
    vi.doMock("./prisma", () => ({ prisma: {} }));
    vi.doUnmock("./settings");
    const { SERVER_QUOTA } = await import("./quota");
    expect(SERVER_QUOTA).toBe(21_474_836_480n);
  });
});
