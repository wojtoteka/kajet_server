/*
  Jedyne miejsce w Kajecie, które zna SDK Gemini.

  Reszta asystenta rozmawia z tym plikiem, nie z Google: dostaje nazwę
  wywołanego narzędzia, jego argumenty i zużyte tokeny. Dzięki temu przejście
  na inny model albo inne API to zmiana tutaj, a nie w punkcie końcowym,
  w limitach i w rozliczeniach naraz.

  Używane jest interactions.create - nowe API, oznaczone przez Google jako
  zalecane dla nowych projektów; generateContent zostało jako spuścizna.
  Trzy rzeczy są tu ustawione świadomie:

   - `store: false`. Bez tego Google trzyma u siebie stan rozmowy. Historię
     prowadzimy sami w bazie (history.ts) i wysyłamy ją za każdym razem od
     nowa, więc po ich stronie nie ma się co odkładać.
   - `tool_choice` z trybem `any` i listą dwóch narzędzi. Model MUSI wywołać
     jedno z nich - albo zmienia notatkę, albo dopytuje. Luźnego tekstu, który
     trzeba by parsować, nie ma jak dostać.
   - `thinking_level` niski. Myślenia w modelach 3.x nie da się wyłączyć
     zupełnie, a liczy się do tokenów wyjściowych; zadanie jest odtwórcze,
     więc wysoki poziom to sam koszt.
*/

import { GoogleGenAI } from "@google/genai";
import { settings } from "@/lib/settings";
import { systemPrompt } from "./prompt";
import { changeToolFor, toolsFor, NAZWA_PYTANIE, type AiKind } from "./tools";
import type { AiTurnRecord } from "./history";

export type TokenUse = { input: number; output: number };

/** Krótkie powody niepowodzenia. Trafiają do rozliczeń, więc bez zdań. */
export type AiFailure = "timeout" | "rate-limit" | "key" | "no-call" | "error";

export type GeminiResult =
  | {
      ok: true;
      toolName: string;
      args: Record<string, unknown>;
      usage: TokenUse;
      tookMs: number;
      /** Model, który naprawdę odpowiedział - niekoniecznie ten główny. */
      model: string;
    }
  | { ok: false; failure: AiFailure; usage: TokenUse; tookMs: number; model: string };

export type AskInput = {
  kind: AiKind;
  title: string;
  /** Notatka w postaci, w jakiej widzi ją model - patrz note-view.ts. */
  material: string;
  instruction: string;
  history: AiTurnRecord[];
};

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: settings.ai.apiKey });
  return client;
}

/**
 * Awarie, przy których warto sięgnąć po model zapasowy.
 *
 * Tylko te dwie, i to nie przypadkiem. „rate-limit" i „error" przychodzą
 * z Google OD RAZU - wyczerpany limit zapytań albo błąd po ich stronie - więc
 * kolejna próba nic człowieka nie kosztuje w oczekiwaniu.
 *
 * Czego tu świadomie nie ma:
 *  - „key": klucz jest ten sam dla wszystkich modeli, więc następny odbije się
 *    tak samo, tylko wolniej,
 *  - „timeout": człowiek odczekał już pełną minutę przed ekranem; druga i
 *    trzecia próba zrobiłyby z tego trzy minuty,
 *  - „no-call": model odpowiedział, tylko nie wywołał narzędzia. To nie jest
 *    awaria dostępności i kolejne podejście kosztowałoby cały rachunek za nic.
 */
function worthAnotherModel(failure: AiFailure): boolean {
  return failure === "rate-limit" || failure === "error";
}

/**
 * Pytanie do modelu, z przejściem na zapasowy, gdy główny odmówi obsługi.
 *
 * Przejście jest CICHE: człowiek dostaje zmienioną notatkę i nic go nie
 * informuje, którym modelem. Wszystkie modele w łańcuchu są Google, więc nic
 * z tego, co obiecuje zgoda i polityka prywatności, nie przestaje być prawdą.
 * Ślad zostaje tam, gdzie ma zostać: w logu serwera i w kolumnie „model"
 * w rozliczeniach.
 *
 * Tokeny sumują się przez wszystkie podejścia - za nieudane też się płaci.
 */
export async function askGemini(input: AskInput): Promise<GeminiResult> {
  const started = Date.now();
  const chain = [settings.ai.model, ...settings.ai.fallbackModels];
  const total: TokenUse = { input: 0, output: 0 };
  let last: GeminiResult | null = null;

  for (const [at, model] of chain.entries()) {
    const attempt = await askOneModel(model, input);
    total.input += attempt.usage.input;
    total.output += attempt.usage.output;
    last = attempt;

    if (attempt.ok) {
      if (at > 0) {
        console.warn(`[ai] odpowiedział model zapasowy ${model} (główny: ${chain[0]})`);
      }
      return { ...attempt, usage: { ...total }, tookMs: Date.now() - started };
    }

    const next = chain[at + 1];
    if (!next || !worthAnotherModel(attempt.failure)) break;
    console.warn(
      `[ai] ${model} odmówił obsługi (${attempt.failure}) - przechodzę na ${next}`,
    );
  }

  // Do tego miejsca dochodzi się tylko z niepowodzeniem: albo łańcuch się
  // skończył, albo awaria była taka, że kolejny model nic by nie dał.
  return {
    ...(last as Extract<GeminiResult, { ok: false }>),
    usage: { ...total },
    tookMs: Date.now() - started,
  };
}

/** Jedno podejście, jednym modelem. */
async function askOneModel(model: string, input: AskInput): Promise<GeminiResult> {
  const started = Date.now();
  const empty: TokenUse = { input: 0, output: 0 };

  try {
    const interaction = await gemini().interactions.create(
      {
        model,
        system_instruction: systemPrompt(input.kind),
        input: buildInput(input),
        // Typy SDK opisują narzędzie jako `parameters?: any`, więc nasz ścisły
        // kształt z tools.ts trzeba tu przepuścić bez sprawdzania.
        tools: toolsFor(input.kind) as never,
        generation_config: {
          thinking_level: settings.ai.thinking as never,
          tool_choice: {
            allowed_tools: {
              mode: "any",
              tools: [changeToolFor(input.kind), NAZWA_PYTANIE],
            },
          },
        },
        store: false,
      },
      {
        timeout: settings.ai.timeoutSeconds * 1_000,
        // Ponawianie zostawiamy SDK, ale krótko: człowiek patrzy w ekran
        // i czeka, a każda próba to osobny rachunek.
        maxRetries: 1,
      },
    );

    const usage: TokenUse = {
      input: interaction.usage?.total_input_tokens ?? 0,
      // Tokeny myślenia Google liczy osobno, a płaci się za nie jak za
      // wyjście - do rozliczeń idą więc razem.
      output:
        (interaction.usage?.total_output_tokens ?? 0) +
        (interaction.usage?.total_thought_tokens ?? 0),
    };

    const call = interaction.steps?.find((step) => step.type === "function_call");
    if (!call) {
      return { ok: false, failure: "no-call", usage, tookMs: Date.now() - started, model };
    }

    return {
      ok: true,
      toolName: call.name,
      args: call.arguments ?? {},
      usage,
      tookMs: Date.now() - started,
      model,
    };
  } catch (problem) {
    return {
      ok: false,
      failure: classify(problem, model),
      usage: empty,
      tookMs: Date.now() - started,
      model,
    };
  }
}

/**
 * Co dokładnie widzi model w jednej wiadomości: historia rozmowy, notatka
 * i polecenie.
 *
 * Wszystko idzie jednym kawałkiem, a nie tablicą wymian, bo `store: false`
 * znaczy, że i tak wysyłamy komplet za każdym razem - a jeden kawałek z
 * wyraźnymi nagłówkami jest przewidywalny i łatwo go obejrzeć w logu.
 */
function buildInput({ title, material, instruction, history }: AskInput): string {
  const parts: string[] = [];

  if (history.length > 0) {
    const earlier = history
      .map((turn) => `Polecenie: ${turn.request}\nCo zrobiłeś: ${turn.reply}`)
      .join("\n\n");
    parts.push(`WCZEŚNIEJ PRZY TEJ NOTATCE:\n\n${earlier}`);
  }

  parts.push(`TYTUŁ NOTATKI:\n${title}`);
  // Treść notatki jest zawsze ta świeża z bazy, także wtedy, gdy w historii
  // stoi coś innego - między jedną prośbą a drugą człowiek mógł ją poprawić
  // sam albo z innego urządzenia.
  parts.push(`TREŚĆ NOTATKI TERAZ:\n\n${material}`);
  parts.push(`POLECENIE UŻYTKOWNIKA:\n${instruction}`);

  return parts.join("\n\n---\n\n");
}

/**
 * Powód niepowodzenia z tego, co rzuciło SDK. Zgadywanie po treści komunikatu
 * jest brzydkie, ale kod stanu przychodzi tylko w części błędów, a rozróżnienie
 * „skończył się limit" od „zły klucz" decyduje o tym, co zobaczy człowiek.
 */
function classify(problem: unknown, model: string): AiFailure {
  const status = (problem as { status?: number })?.status;
  const text = problem instanceof Error ? problem.message : String(problem);

  if (status === 429 || /RESOURCE_EXHAUSTED|too many requests|quota/i.test(text)) {
    return "rate-limit";
  }
  if (status === 401 || status === 403 || /API key|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text)) {
    return "key";
  }
  if (/abort|timeout|timed out|ETIMEDOUT/i.test(text)) return "timeout";

  // Cała treść zostaje w logu serwera: niesie nazwy modeli, kawałki żądania
  // i szczegóły, których nie ma po co pokazywać w aplikacji.
  console.error(`[ai] wywołanie modelu ${model} nie przeszło`, problem);
  return "error";
}
