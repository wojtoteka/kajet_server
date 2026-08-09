/*
  Przejście na model zapasowy, gdy główny odmówi obsługi.

  Podstawione jest samo SDK Google - sprawdzamy, ILE razy i JAKIM modelem
  Kajet zapytał, i co z tego zostało w wyniku. Sedno: przejście ma być ciche
  dla człowieka, ale policzone uczciwie w tokenach i prawdomówne w kolumnie
  „model", bo to jedyny ślad, po którym widać, że główny model przestał
  odpowiadać.
*/

import { describe, expect, it, vi, beforeEach } from "vitest";

const GLOWNY = "gemini-3.6-flash";
const ZAPASOWY_1 = "gemini-3.1-flash-lite";
const ZAPASOWY_2 = "gemini-2.5-flash";

/** Odpowiedź SDK, w której model wywołał narzędzie. */
function udana(tokens = 10) {
  return {
    steps: [{ type: "function_call", name: "zmien_tekst", arguments: { markdown: "x", opis: "y" } }],
    usage: { total_input_tokens: tokens, total_output_tokens: tokens, total_thought_tokens: 0 },
  };
}

function blad(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

type Odpowiedz = ReturnType<typeof udana> | Error;

/**
 * Ładuje gemini.ts z podstawionym SDK i podanym łańcuchem modeli.
 * `kolejno` to odpowiedzi na kolejne wywołania - błąd zostaje rzucony.
 */
async function zapytaj(kolejno: Odpowiedz[], fallbacks = [ZAPASOWY_1, ZAPASOWY_2]) {
  vi.resetModules();

  const uzyteModele: string[] = [];
  let numer = 0;

  const create = vi.fn(async ({ model }: { model: string }) => {
    uzyteModele.push(model);
    const odpowiedz = kolejno[numer++];
    if (odpowiedz instanceof Error) throw odpowiedz;
    return odpowiedz;
  });

  vi.doMock("@google/genai", () => ({
    GoogleGenAI: class {
      interactions = { create };
    },
  }));

  vi.doMock("@/lib/settings", async (importOriginal) => {
    const original = (await importOriginal()) as { settings: Record<string, unknown> };
    return {
      ...original,
      settings: {
        ...original.settings,
        ai: {
          ...(original.settings.ai as Record<string, unknown>),
          apiKey: "klucz",
          model: GLOWNY,
          fallbackModels: fallbacks,
        },
      },
    };
  });

  const { askGemini } = await import("./gemini");
  const wynik = await askGemini({
    kind: "TEXT",
    title: "Zakupy",
    material: "- mleko",
    instruction: "dopisz chleb",
    history: [],
  });

  return { wynik, uzyteModele };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("model zapasowy", () => {
  it("przy działającym głównym nie pyta nikogo więcej", async () => {
    const { wynik, uzyteModele } = await zapytaj([udana()]);

    expect(uzyteModele).toEqual([GLOWNY]);
    expect(wynik.ok).toBe(true);
    expect(wynik.model).toBe(GLOWNY);
  });

  it("przy wyczerpanym limicie przechodzi na pierwszy zapasowy", async () => {
    const { wynik, uzyteModele } = await zapytaj([
      blad(429, "RESOURCE_EXHAUSTED"),
      udana(),
    ]);

    expect(uzyteModele).toEqual([GLOWNY, ZAPASOWY_1]);
    expect(wynik.ok).toBe(true);
    // Kolumna w rozliczeniach ma pokazać model, który NAPRAWDĘ odpowiedział.
    expect(wynik.model).toBe(ZAPASOWY_1);
  });

  it("schodzi do końca łańcucha, gdy padają kolejne", async () => {
    const { wynik, uzyteModele } = await zapytaj([
      blad(429, "RESOURCE_EXHAUSTED"),
      blad(503, "model overloaded"),
      udana(),
    ]);

    expect(uzyteModele).toEqual([GLOWNY, ZAPASOWY_1, ZAPASOWY_2]);
    expect(wynik.model).toBe(ZAPASOWY_2);
  });

  it("gdy padnie cały łańcuch, oddaje niepowodzenie ostatniego", async () => {
    const { wynik, uzyteModele } = await zapytaj([
      blad(429, "RESOURCE_EXHAUSTED"),
      blad(429, "RESOURCE_EXHAUSTED"),
      blad(429, "RESOURCE_EXHAUSTED"),
    ]);

    expect(uzyteModele).toHaveLength(3);
    expect(wynik.ok).toBe(false);
    if (wynik.ok) return;
    expect(wynik.failure).toBe("rate-limit");
  });

  it("zły klucz nie uruchamia zapasowych - jest wspólny dla wszystkich", async () => {
    const { wynik, uzyteModele } = await zapytaj([blad(403, "PERMISSION_DENIED")]);

    expect(uzyteModele).toEqual([GLOWNY]);
    expect(wynik.ok).toBe(false);
    if (wynik.ok) return;
    expect(wynik.failure).toBe("key");
  });

  it("przekroczony czas nie uruchamia zapasowych - człowiek już odczekał swoje", async () => {
    const { uzyteModele } = await zapytaj([new Error("request timed out")]);

    expect(uzyteModele).toEqual([GLOWNY]);
  });

  it("brak wywołania narzędzia nie uruchamia zapasowych - to nie awaria", async () => {
    const bezNarzedzia = {
      steps: [{ type: "text", text: "proszę bardzo" }],
      usage: { total_input_tokens: 5, total_output_tokens: 5, total_thought_tokens: 0 },
    };
    const { wynik, uzyteModele } = await zapytaj([bezNarzedzia as never]);

    expect(uzyteModele).toEqual([GLOWNY]);
    expect(wynik.ok).toBe(false);
    if (wynik.ok) return;
    expect(wynik.failure).toBe("no-call");
  });

  it("tokeny sumują się przez wszystkie podejścia - za nieudane też się płaci", async () => {
    // Pierwsze podejście przechodzi przez SDK i zwraca zużycie, ale bez
    // wywołania narzędzia; drugie się udaje. Liczy się suma obu.
    const bezNarzedzia = {
      steps: [] as unknown[],
      usage: { total_input_tokens: 7, total_output_tokens: 3, total_thought_tokens: 2 },
    };
    const { wynik } = await zapytaj([bezNarzedzia as never], []);

    expect(wynik.usage.input).toBe(7);
    // Tokeny myślenia płaci się jak wyjściowe, więc idą razem.
    expect(wynik.usage.output).toBe(5);
  });

  it("pusty spis zapasowych znaczy: pytamy tylko głównego", async () => {
    const { uzyteModele } = await zapytaj([blad(429, "RESOURCE_EXHAUSTED")], []);

    expect(uzyteModele).toEqual([GLOWNY]);
  });
});
