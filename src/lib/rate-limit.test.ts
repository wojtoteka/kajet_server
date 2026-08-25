import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("./rate-limit.fake")).fakeRateLimits(),
}));

import { prisma } from "@/lib/prisma";
import {
  LONGEST_BUCKET,
  bucket,
  forgetAttempts,
  noteAttempt,
  passes,
  purgeOldAttempts,
  readAttempts,
  retryInSeconds,
} from "./rate-limit";

const MINUTE = 60_000;

describe("licznik prób", () => {
  beforeEach(async () => {
    await prisma.rateLimit.deleteMany({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("liczy od jednego w górę", async () => {
    expect((await noteAttempt("test", MINUTE)).hits).toBe(1);
    expect((await noteAttempt("test", MINUTE)).hits).toBe(2);
    expect((await noteAttempt("test", MINUTE)).hits).toBe(3);
  });

  it("każdy klucz ma swój licznik", async () => {
    await noteAttempt("jeden", MINUTE);
    await noteAttempt("jeden", MINUTE);

    expect((await noteAttempt("drugi", MINUTE)).hits).toBe(1);
  });

  it("okno liczy się od pierwszej próby, nie od ostatniej", async () => {
    vi.useFakeTimers();
    const first = await noteAttempt("test", MINUTE);

    vi.advanceTimersByTime(30_000);
    const second = await noteAttempt("test", MINUTE);

    expect(second.hits).toBe(2);
    expect(second.startedAt.getTime()).toBe(first.startedAt.getTime());
  });

  it("po oknie zaczyna liczyć od nowa", async () => {
    vi.useFakeTimers();
    await noteAttempt("test", MINUTE);
    await noteAttempt("test", MINUTE);

    vi.advanceTimersByTime(MINUTE);

    expect((await noteAttempt("test", MINUTE)).hits).toBe(1);
  });

  it("sam odczyt niczego nie dolicza", async () => {
    await noteAttempt("test", MINUTE);

    expect((await readAttempts(["test"], MINUTE))[0].hits).toBe(1);
    expect((await readAttempts(["test"], MINUTE))[0].hits).toBe(1);
  });

  it("odczyt pomija liczniki, którym okno minęło", async () => {
    vi.useFakeTimers();
    await noteAttempt("test", MINUTE);

    vi.advanceTimersByTime(MINUTE);

    expect(await readAttempts(["test"], MINUTE)).toEqual([]);
  });

  it("kasowanie zeruje licznik", async () => {
    await noteAttempt("test", MINUTE);
    await forgetAttempts(["test"]);

    expect(await readAttempts(["test"], MINUTE)).toEqual([]);
  });

  it("przepuszcza do granicy, potem zamyka i mówi, ile czekać", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i += 1) {
      expect((await passes("test", 3, MINUTE)).allowed).toBe(true);
    }

    const gate = await passes("test", 3, MINUTE);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryInSeconds).toBe(60);
  });

  it("odrzucone próby nie przedłużają przerwy", async () => {
    /*
      Zamknięte zapytanie też podbija licznik - inaczej przy doliczaniu
      trzeba by najpierw czytać, a dwa zapytania naraz przecisnęłyby się obok
      siebie. Początek okna zostaje na miejscu, więc przerwa i tak kończy się
      o tej samej godzinie, choćby ktoś walił bez przerwy.
    */
    vi.useFakeTimers();
    await passes("test", 1, MINUTE);

    for (let i = 0; i < 20; i += 1) await passes("test", 1, MINUTE);

    vi.advanceTimersByTime(MINUTE);
    expect((await passes("test", 1, MINUTE)).allowed).toBe(true);
  });

  it("zostawia co najmniej sekundę na powrót", async () => {
    // Zero sekund brzmiałoby jak „już" i aplikacja wracałaby od razu na
    // kolejne odmowne zapytanie.
    const attempt = { hits: 9, startedAt: new Date(1_000) };

    expect(retryInSeconds(attempt, MINUTE, 1_000 + MINUTE)).toBe(1);
    expect(retryInSeconds(attempt, MINUTE, 1_000 + MINUTE + 5_000)).toBe(1);
  });

  it("wyrzuca liczniki, których okno dawno minęło", async () => {
    vi.useFakeTimers();
    await noteAttempt("stary", MINUTE);

    vi.advanceTimersByTime(5 * 60 * 60 * 1000);
    await noteAttempt("swiezy", MINUTE);

    expect(await purgeOldAttempts()).toBe(1);
    expect(await readAttempts(["swiezy"], MINUTE)).toHaveLength(1);
  });
});

describe("klucz licznika", () => {
  it("zwykły klucz zostaje czytelny", () => {
    expect(bucket("logowanie:mail", "kto@example.com")).toBe(
      "logowanie:mail:kto@example.com",
    );
  });

  it("za długi klucz mieści się w kolumnie", () => {
    const key = bucket("logowanie:mail", `${"a".repeat(240)}@example.com`);

    expect(key.length).toBeLessThanOrEqual(LONGEST_BUCKET);
    expect(key.startsWith("logowanie:mail:")).toBe(true);
  });

  it("dwa różne długie adresy dostają różne klucze", () => {
    // Samo ucięcie dałoby im jeden licznik, a wtedy jeden zamykałby
    // logowanie drugiemu.
    const jeden = bucket("logowanie:mail", `${"a".repeat(240)}@example.com`);
    const drugi = bucket("logowanie:mail", `${"a".repeat(239)}b@example.com`);

    expect(jeden).not.toBe(drugi);
  });

  it("znaki spoza ASCII idą przez odcisk, a nie do bazy", () => {
    // MySQL liczy znaki, JavaScript jednostki UTF-16, a cięcie w połowie
    // znaku potrafi dać coś, czego baza nie przyjmie.
    const key = bucket("logowanie:mail", "zażółć@example.com");

    expect(key.length).toBeLessThanOrEqual(LONGEST_BUCKET);
    expect(key).not.toContain("ż");
    expect(key).not.toBe(bucket("logowanie:mail", "zazolc@example.com"));
  });
});
