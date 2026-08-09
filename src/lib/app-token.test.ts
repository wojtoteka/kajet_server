/*
  Odnotowywanie użycia tokenu aplikacji.

  Rzecz, o którą tu chodzi, widać było tylko na produkcji: w logu pm2 sypało
  się MySQL 1020 „Record has changed since last read in table 'app_tokens'".
  Tablet synchronizuje się kilkoma żądaniami naraz, a każde dotykało tego
  samego wiersza - i to przez `update` z warunkiem na kluczu, które w Prismie
  robi ODCZYT, a potem zapis.

  Sprawdzamy więc dwie rzeczy: że zapis idzie jednym poleceniem `updateMany`
  (bez odczytu przed nim, więc nie ma czego „zmienić od ostatniego odczytu")
  i że nie idzie przy każdym żądaniu.
*/

import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const updateMany = vi.fn(async () => ({ count: 1 }));
const update = vi.fn(async () => ({}));

vi.mock("./prisma", () => ({
  prisma: {
    appToken: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock("./language", () => ({ apiWords: async () => ({ unknownDeviceWord: "Urządzenie" }) }));

import { hashToken, userFromHeaders } from "./app-token";

const UZYTKOWNIK = { id: "u1", blocked: false } as never;

function naglowki(token = "sekret") {
  return new Headers({ authorization: `Bearer ${token}` });
}

function wiersz(lastUsedAt: Date | null) {
  return {
    id: "t1",
    tokenHash: hashToken("sekret"),
    lastUsedAt,
    expiresAt: null,
    user: UZYTKOWNIK,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  update.mockReset();
});

describe("odnotowanie użycia tokenu", () => {
  it("token nieużywany od dawna dostaje świeżą datę", async () => {
    findUnique.mockResolvedValue(wiersz(new Date(Date.now() - 60 * 60_000)));

    const wynik = await userFromHeaders(naglowki());

    expect(wynik.ok).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("token, którego nigdy nie użyto, też dostaje datę", async () => {
    findUnique.mockResolvedValue(wiersz(null));

    await userFromHeaders(naglowki());

    expect(updateMany).toHaveBeenCalledTimes(1);
    // Warunek na starej wartości musi umieć trafić w NULL, inaczej pierwszy
    // zapis nigdy by nie przeszedł.
    expect(updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "t1", lastUsedAt: null } });
  });

  it("token użyty przed chwilą NIE jest zapisywany", async () => {
    findUnique.mockResolvedValue(wiersz(new Date(Date.now() - 30_000)));

    await userFromHeaders(naglowki());

    // To jest sedno: przy synchronizacji tabletu takich żądań są dziesiątki
    // i żadne z nich nie ma prawa dotknąć wiersza.
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("zapis idzie przez updateMany, nigdy przez update", async () => {
    findUnique.mockResolvedValue(wiersz(null));

    await userFromHeaders(naglowki());

    // update() z warunkiem na kluczu robi w Prismie odczyt przed zapisem -
    // i to on dawał 1020. Ma tu nie być używany w ogóle.
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("zapis pilnuje starej wartości - przegrany wyścig trafia w zero wierszy", async () => {
    const stara = new Date(Date.now() - 60 * 60_000);
    findUnique.mockResolvedValue(wiersz(stara));

    await userFromHeaders(naglowki());

    const [argumenty] = updateMany.mock.calls[0];
    expect(argumenty).toMatchObject({ where: { id: "t1", lastUsedAt: stara } });
  });

  it("nieudany zapis nie przewraca uwierzytelnienia", async () => {
    findUnique.mockResolvedValue(wiersz(null));
    updateMany.mockRejectedValue(new Error("baza padła"));

    const wynik = await userFromHeaders(naglowki());

    expect(wynik.ok).toBe(true);
  });

  it("token wygasły odbija się i niczego nie zapisuje", async () => {
    findUnique.mockResolvedValue({
      ...wiersz(null),
      expiresAt: new Date(Date.now() - 1_000),
    });

    const wynik = await userFromHeaders(naglowki());

    expect(wynik.ok).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("konto zablokowane odbija się i niczego nie zapisuje", async () => {
    findUnique.mockResolvedValue({ ...wiersz(null), user: { id: "u1", blocked: true } });

    const wynik = await userFromHeaders(naglowki());

    expect(wynik.ok).toBe(false);
    if (wynik.ok) return;
    expect(wynik.reason).toBe("blocked");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("bez nagłówka nie ma nawet zapytania do bazy", async () => {
    const wynik = await userFromHeaders(new Headers());

    expect(wynik.ok).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
