import { describe, expect, it } from "vitest";
import { isServerActionNoise } from "./quiet-logs";

describe("isServerActionNoise", () => {
  it("łapie błąd złego formatu ID akcji", () => {
    const error = new Error(
      'The Server Reference ID did not match the expected format. Received "6d371b29573430f8ae4ae6fdbad7753e70631ec4".\nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    expect(isServerActionNoise([error])).toBe(true);
  });

  it("łapie nieznaną akcję po aktualizacji", () => {
    const error = new Error("Failed to find Server Action. This request might be from an older or newer deployment.");
    expect(isServerActionNoise([error])).toBe(true);
    expect(isServerActionNoise(["⨯", error])).toBe(true);
  });

  it("przepuszcza prawdziwe błędy", () => {
    expect(isServerActionNoise([new Error("ECONNREFUSED")])).toBe(false);
    expect(isServerActionNoise(["[live] zapis zmiany", new Error("x")])).toBe(false);
    expect(isServerActionNoise([{ message: "Failed to find Server Action" }])).toBe(false);
  });
});
