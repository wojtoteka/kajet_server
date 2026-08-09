/*
  Bramka asystenta.

  Najważniejsze jest tu ostatnie zadanie: odmowa dla konta bez uprawnienia musi
  być NIEODRÓŻNIALNA od odpowiedzi na nieistniejący adres. Gdyby różniła się
  choćby kodem błędu, wystarczyłoby wysłać jedno żądanie, żeby się dowiedzieć,
  że asystent w Kajecie jest - a tego nie chcemy nikomu mówić.

  Sprawdzane jest samo rozstrzyganie. To, że trasa /ai-edit faktycznie pyta
  bramkę, zanim cokolwiek zrobi, pilnuje ai-edit.test.ts.
*/

import { describe, expect, it, vi } from "vitest";

const NOBODY = { canUseAi: false, aiConsentAt: null };
const ALLOWED_NO_CONSENT = { canUseAi: true, aiConsentAt: null };
const READY = { canUseAi: true, aiConsentAt: new Date("2026-08-09T10:00:00.000Z") };

/**
 * Wczytuje bramkę z podstawionym „czy serwer ma klucz do modelu".
 *
 * Podmieniane jest samo `aiWorks`, reszta ustawień zostaje prawdziwa: przez
 * trasę od nieznanych adresów wchodzi tu prisma.ts, a ta woła `databaseUrl`.
 */
async function gateWith(keyPresent: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/settings")>()),
    aiWorks: () => keyPresent,
  }));
  return import("./access");
}

describe("kto może prosić asystenta o zmianę", () => {
  it("bez klucza na serwerze nie może nikt, choćby miał wszystko nadane", async () => {
    const { aiGate, aiVisibleFor, aiReadyFor } = await gateWith(false);

    expect(aiVisibleFor(READY)).toBe(false);
    expect(aiReadyFor(READY)).toBe(false);
    expect(aiGate(READY)).toEqual({ ok: false, hidden: true });
  });

  it("konto bez uprawnienia dostaje ukrytą odmowę", async () => {
    const { aiGate, aiVisibleFor } = await gateWith(true);

    expect(aiVisibleFor(NOBODY)).toBe(false);
    expect(aiGate(NOBODY)).toEqual({ ok: false, hidden: true });
  });

  it("samo uprawnienie bez zgody nie wystarcza, ale funkcji już nie ukrywa", async () => {
    const { aiGate, aiVisibleFor, aiReadyFor } = await gateWith(true);

    // Widoczna, bo o zgodę trzeba gdzieś poprosić.
    expect(aiVisibleFor(ALLOWED_NO_CONSENT)).toBe(true);
    expect(aiReadyFor(ALLOWED_NO_CONSENT)).toBe(false);

    const gate = aiGate(ALLOWED_NO_CONSENT);
    expect(gate).toEqual({ ok: false, hidden: false, code: "ai-no-consent", status: 403 });
  });

  it("uprawnienie i zgoda razem otwierają bramkę", async () => {
    const { aiGate, aiReadyFor } = await gateWith(true);

    expect(aiReadyFor(READY)).toBe(true);
    expect(aiGate(READY)).toEqual({ ok: true });
  });

  it("cofnięcie zgody zamyka bramkę z powrotem", async () => {
    const { aiGate } = await gateWith(true);

    expect(aiGate({ canUseAi: true, aiConsentAt: null }).ok).toBe(false);
  });
});

describe("odmowa nie zdradza, że asystent istnieje", () => {
  it("ukryta odmowa jest co do znaku tym samym, co odpowiedź na nieznany adres", async () => {
    const { aiGate, aiRefusal } = await gateWith(true);

    const gate = aiGate(NOBODY);
    expect(gate.ok).toBe(false);

    const refused = await aiRefusal(gate as Extract<typeof gate, { ok: false }>);

    // Ta sama trasa, którą Next.js oddaje na cokolwiek pod /api, czego nie zna.
    const unknown = await import("@/app/api/[...sciezka]/route");
    const missing = await unknown.GET();

    expect(refused.status).toBe(missing.status);
    expect(await refused.json()).toEqual(await missing.json());
  });

  it("brak zgody mówi wprost, czego brakuje - tu nie ma już czego ukrywać", async () => {
    const { aiGate, aiRefusal } = await gateWith(true);

    const gate = aiGate(ALLOWED_NO_CONSENT);
    const refused = await aiRefusal(gate as Extract<typeof gate, { ok: false }>);
    const body = await refused.json();

    expect(refused.status).toBe(403);
    expect(body.error).toBe("ai-no-consent");
    expect(body.message).toContain("zgod");
  });
});
