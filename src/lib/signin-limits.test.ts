import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("./rate-limit.fake")).fakeRateLimits(),
}));

import { prisma } from "@/lib/prisma";
import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  callerAddress,
  clearFailedSignIns,
  noteFailedSignIn,
  signInAllowed,
} from "./signin-limits";

const IP = "203.0.113.7";

async function failTimes(count: number, email = "kto@example.com", from: string | null = IP) {
  for (let i = 0; i < count; i += 1) await noteFailedSignIn(email, from);
}

describe("zapora logowania", () => {
  beforeEach(async () => {
    await prisma.rateLimit.deleteMany({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("przepuszcza, dopóki nie ma nieudanych prób", async () => {
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(true);
  });

  it("przepuszcza cztery pomyłki, zamyka po piątej", async () => {
    await failTimes(MAX_ATTEMPTS - 1);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(true);

    await noteFailedSignIn("kto@example.com", IP);
    const gate = await signInAllowed("kto@example.com", IP);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.retryInSeconds).toBeGreaterThan(0);
      expect(gate.retryInSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("udane logowanie kasuje licznik", async () => {
    await failTimes(MAX_ATTEMPTS);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(false);

    await clearFailedSignIns("kto@example.com", IP);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(true);
  });

  it("po kwadransie wpuszcza z powrotem", async () => {
    /*
      Okno liczy się od PIERWSZEJ pomyłki, nie od ostatniej - inaczej ktoś,
      kto próbuje bez przerwy, przedłużałby sobie karę w nieskończoność, a
      człowiek, który zapomniał hasła, nie wiedziałby, ile czekać.
    */
    vi.useFakeTimers();
    await failTimes(MAX_ATTEMPTS);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS - 1000);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(false);

    vi.advanceTimersByTime(1000);
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(true);
  });

  it("przerwa przeżywa restart serwera", async () => {
    /*
      Licznik siedzi w bazie, a nie w pamięci procesu. Gdyby siedział w
      pamięci, kwadrans przerwy kończyłby się przy najbliższym wdrożeniu -
      a wdrożenie to jedna komenda.
    */
    await failTimes(MAX_ATTEMPTS);

    vi.resetModules();
    const restarted = await import("./signin-limits");

    expect((await restarted.signInAllowed("kto@example.com", IP)).allowed).toBe(false);
  });

  it("liczy adres e-mail bez względu na wielkość liter", async () => {
    await failTimes(MAX_ATTEMPTS, "KTO@Example.com");
    expect((await signInAllowed("kto@example.com", IP)).allowed).toBe(false);
  });

  it("zamyka konto także wtedy, gdy próby idą z wielu miejsc", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await noteFailedSignIn("kto@example.com", `198.51.100.${i}`);
    }
    // Nowy adres, to samo konto - dalej zamknięte.
    expect((await signInAllowed("kto@example.com", "198.51.100.200")).allowed).toBe(false);
  });

  it("zamyka też komputer, który obchodzi wiele kont", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await noteFailedSignIn(`kto${i}@example.com`, IP);
    }
    // Kolejne konto z tego samego miejsca nie ma już prawa próbować.
    expect((await signInAllowed("ktos-zupelnie-inny@example.com", IP)).allowed).toBe(false);
  });

  it("nie miesza kont, gdy pomyłki idą z różnych miejsc", async () => {
    await failTimes(MAX_ATTEMPTS, "kto@example.com", IP);
    expect((await signInAllowed("inny@example.com", "198.51.100.9")).allowed).toBe(true);
  });

  it("nie myli dwóch bardzo długich adresów e-mail", async () => {
    // Klucz licznika mieści 190 znaków, a adres e-mail bywa dłuższy. Gdyby
    // za długie po prostu ucinać, jeden zamknąłby logowanie drugiemu.
    const jeden = `${"a".repeat(240)}@example.com`;
    const drugi = `${"a".repeat(239)}b@example.com`;

    await failTimes(MAX_ATTEMPTS, jeden, null);
    expect((await signInAllowed(jeden, null)).allowed).toBe(false);
    expect((await signInAllowed(drugi, null)).allowed).toBe(true);
  });

  it("czyta adres zza odwrotnego pośrednika", () => {
    /*
      Rzeczywista topologia: nginx DOKLEJA adres połączenia na końcu
      x-forwarded-for (proxy_add_x_forwarded_for), więc wiarygodny jest
      OSTATNI element. Pierwszy przysyła klient - może tam stać cokolwiek
      i dlatego nie wolno go czytać.
    */
    const request = new Request("https://kajet.example/api/v1/signin", {
      headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.4" },
    });
    expect(callerAddress(request)).toBe("198.51.100.4");
  });

  it("wierzy Cloudflare przed wszystkim innym", () => {
    // Przez Cloudflare adres połączenia z nginxem to krawędź CF - prawdziwy
    // adres użytkownika niesie cf-connecting-ip.
    const request = new Request("https://kajet.example/api/v1/signin", {
      headers: {
        "cf-connecting-ip": "203.0.113.7",
        "x-real-ip": "172.71.0.1",
        "x-forwarded-for": "6.6.6.6, 172.71.0.1",
      },
    });
    expect(callerAddress(request)).toBe("203.0.113.7");
  });

  it("bez Cloudflare bierze x-real-ip przed x-forwarded-for", () => {
    const request = new Request("https://kajet.example/api/v1/signin", {
      headers: {
        "x-real-ip": "198.51.100.4",
        "x-forwarded-for": "6.6.6.6, 198.51.100.4",
      },
    });
    expect(callerAddress(request)).toBe("198.51.100.4");
  });

  it("bez nagłówków nie zna adresu i liczy sam e-mail", async () => {
    const request = new Request("https://kajet.example/api/v1/signin");
    expect(callerAddress(request)).toBeNull();

    await failTimes(MAX_ATTEMPTS, "kto@example.com", null);
    expect((await signInAllowed("kto@example.com", null)).allowed).toBe(false);
    expect((await signInAllowed("inny@example.com", null)).allowed).toBe(true);
  });
});
