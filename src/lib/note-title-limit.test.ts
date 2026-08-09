/*
  Limit tytułu wpisanego ręcznie.

  Bramki przepuszczały trzysta znaków, a kolumna Note.title w bazie to zwykły
  String, czyli VARCHAR(191) w MySQL. Tytuł między tymi liczbami nie zapisywał
  się WCALE - wywracał zapis błędem bazy. Praktycznie więc limitu nie było,
  a tam, gdzie się zaczynał, kończyło się awarią zamiast komunikatem.
*/

import { describe, expect, it } from "vitest";
import { TITLE_LIMIT, fitTitle } from "./note-title";

describe("limit tytułu", () => {
  it("mieści się w kolumnie bazy (VARCHAR(191))", () => {
    expect(TITLE_LIMIT).toBeLessThan(191);
  });

  it("krótki tytuł zostaje bez zmian", () => {
    expect(fitTitle("Zakupy na sobotę")).toBe("Zakupy na sobotę");
  });

  it("obcina białe znaki z brzegów", () => {
    expect(fitTitle("  Zakupy  ")).toBe("Zakupy");
  });

  it("przycina, zamiast odmawiać", () => {
    // Odmowa zatrzymałaby synchronizację starszych wydań aplikacji na zawsze.
    const dlugi = "słowo ".repeat(60).trim();
    const wynik = fitTitle(dlugi);

    expect(wynik.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(wynik.length).toBeGreaterThan(0);
  });

  it("tnie na spacji, nie w połowie słowa", () => {
    const dlugi = "słowo ".repeat(60).trim();
    const wynik = fitTitle(dlugi);

    expect(dlugi.startsWith(wynik)).toBe(true);
    expect(dlugi[wynik.length]).toBe(" ");
  });

  it("nie dokłada wielokropka - to tytuł człowieka, nie podpowiedź", () => {
    expect(fitTitle("a ".repeat(200).trim()).endsWith("...")).toBe(false);
  });

  it("jedno słowo dłuższe niż granica tniemy równo", () => {
    expect(fitTitle("x".repeat(500))).toBe("x".repeat(TITLE_LIMIT));
  });

  it("tytuł dokładnie na granicy zostaje cały", () => {
    const rowno = "y".repeat(TITLE_LIMIT);
    expect(fitTitle(rowno)).toBe(rowno);
  });
});
