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

/*
  Znaczenie zapisanego limitu konta.

  Pomyłka w tę albo w tamtą stronę jest tu droga: zero odczytane jako „bez
  ograniczeń" oddaje cały dysk pierwszemu założonemu kontu, a minus jeden
  odczytany dosłownie zatrzymuje zapisy komuś, kto miejsce ma bez końca.
  Stąd te cztery przypadki, sprawdzane bez bazy danych.
*/
describe("readQuota", () => {
  it("zero znaczy zero miejsca, a nie brak ograniczeń", async () => {
    const { readQuota } = await quotaWithLimit(0);
    const state = readQuota(0n, 0n);
    expect(state.unlimited).toBe(false);
    expect(state.free).toBe(0n);
  });

  it("liczba ujemna znaczy bez ograniczeń", async () => {
    const { readQuota } = await quotaWithLimit(0);
    const state = readQuota(-1n, 12_345n);
    expect(state.unlimited).toBe(true);
    expect(state.free).toBeNull();
  });

  it("zwykły limit oddaje to, co zostało", async () => {
    const { readQuota } = await quotaWithLimit(0);
    expect(readQuota(1_000n, 400n).free).toBe(600n);
  });

  it("odebrane miejsce daje ujemny zapas, a nie zawinięcie w plus", async () => {
    const { readQuota } = await quotaWithLimit(0);
    const state = readQuota(0n, 5_000n);
    expect(state.unlimited).toBe(false);
    expect(state.free).toBe(-5_000n);
  });
});

/*
  Sama zapora: czy tyle bajtów wolno dopisać.

  Te przypadki są tu dlatego, że raz już przeszły niezauważone. Reguła stała
  w dwóch miejscach - w sprawdzeniu z góry i w tym pod blokadą wiersza - a po
  zmianie znaczenia zera poprawione zostało tylko jedno. Konto z zerowym
  limitem zapisywało wtedy bez końca, mając na ekranie „0 B", a konto bez
  ograniczeń odbijało się od pierwszego zapisu.
*/
describe("fitsIn", () => {
  it("konto z zerowym limitem nie dopisze ani bajta", async () => {
    const { fitsIn, readQuota } = await quotaWithLimit(0);
    expect(fitsIn(readQuota(0n, 0n), 1)).toBe(false);
    expect(fitsIn(readQuota(0n, 10_000n), 1)).toBe(false);
  });

  it("konto bez ograniczeń przyjmuje wszystko", async () => {
    const { fitsIn, readQuota } = await quotaWithLimit(0);
    expect(fitsIn(readQuota(-1n, 10n ** 12n), 1_000_000_000)).toBe(true);
  });

  it("zwykły limit przepuszcza do samego brzegu i ani bajta dalej", async () => {
    const { fitsIn, readQuota } = await quotaWithLimit(0);
    expect(fitsIn(readQuota(1_000n, 900n), 100)).toBe(true);
    expect(fitsIn(readQuota(1_000n, 900n), 101)).toBe(false);
  });
});
