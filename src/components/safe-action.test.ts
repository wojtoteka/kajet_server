import { describe, expect, it, vi } from "vitest";
import { safeAction } from "./safe-action";

type Result = { error?: string; version?: number };

const lost: Result = { error: "Zapis nie doszedł do serwera." };

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
