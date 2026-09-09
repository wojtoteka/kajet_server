import { describe, expect, it, vi } from "vitest";
import { safeAction } from "./safe-action";

type Result = { error?: string; version?: number };

const lost: Result = { error: "Zapis nie doszedł do serwera." };
const outdated: Result = { error: "Ta strona jest starsza niż serwer." };

/*
  Tak wygląda odmowa, którą Next wystawia stronie starszej niż serwer:
  odpowiedź 404 z nagłówkiem `x-nextjs-action-not-found`, a w przeglądarce
  wyjątek o tej nazwie.
*/
const unrecognized = () =>
  Object.assign(new Error('Server Action "abc" was not found on the server.'), {
    name: "UnrecognizedActionError",
  });

/*
  „Raz stara, zawsze stara” siedzi w zmiennej modułu, więc każdy test o
  starej stronie musi zaczynać od świeżo wczytanego modułu.
*/
async function freshSafeAction() {
  vi.resetModules();
  return (await import("./safe-action")).safeAction;
}

describe("akcja, która nie zabiera ze sobą strony", () => {
  it("oddaje odpowiedź serwera, gdy wszystko poszło dobrze", async () => {
    const action = async (): Promise<Result> => ({ version: 7 });
    await expect(safeAction(action, lost)({}, new FormData())).resolves.toEqual({ version: 7 });
  });

  it("zamienia zerwane wywołanie w zwykły błąd zamiast je rzucać", async () => {
    // Tak wygląda 404 z akcji, której serwer już nie zna: React odrzuca
    // obietnicę, a useActionState rzuciłby to w renderze - czyli edytor razem
    // z niezapisaną notatką zniknąłby za granicą błędu.
    const action = async (): Promise<Result> => {
      throw new Error("Server action not found.");
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(safeAction(action, lost)({}, new FormData())).resolves.toEqual(lost);
    quiet.mockRestore();
  });

  it("odróżnia stronę starszą niż serwer od zwykłego zerwanego wywołania", async () => {
    const safeAction = await freshSafeAction();
    const action = async (): Promise<Result> => {
      throw unrecognized();
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(safeAction(action, lost, outdated)({}, new FormData())).resolves.toEqual(
      outdated,
    );
    quiet.mockRestore();
  });

  it("po takiej odpowiedzi nie zaczepia serwera drugi raz", async () => {
    // Identyfikatory akcji siedzą we wczytanym kawałku strony - druga próba
    // trafiłaby w to samo 404 i dopisała kolejny wiersz do logu serwera.
    const safeAction = await freshSafeAction();
    const action = vi.fn(async (): Promise<Result> => {
      throw unrecognized();
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await safeAction(action, lost, outdated)({}, new FormData());
    await expect(safeAction(action, lost, outdated)({}, new FormData())).resolves.toEqual(
      outdated,
    );
    expect(action).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it("bez osobnego napisu wraca zwykłe „nie doszło”", async () => {
    const safeAction = await freshSafeAction();
    const action = async (): Promise<Result> => {
      throw unrecognized();
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(safeAction(action, lost)({}, new FormData())).resolves.toEqual(lost);
    quiet.mockRestore();
  });

  it("przepuszcza przekierowanie, bo to nie jest awaria", async () => {
    // Tym wyjątkiem Next.js przenosi na stronę świeżo założonej notatki.
    // Połknięty zatrzymałby przejście i człowiek zostałby na pustym formularzu.
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/note/abc;303;",
    });
    const action = async (): Promise<Result> => {
      throw redirect;
    };
    await expect(safeAction(action, lost)({}, new FormData())).rejects.toBe(redirect);
  });

  it("przepuszcza też „nie ma takiej notatki”", async () => {
    const missing = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    const action = async (): Promise<Result> => {
      throw missing;
    };
    await expect(safeAction(action, lost)({}, new FormData())).rejects.toBe(missing);
  });
});
