import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  callerAddress,
  clearFailedSignIns,
  forgetAllSignInFailures,
  noteFailedSignIn,
  signInAllowed,
} from "./signin-limits";

const IP = "203.0.113.7";

function failTimes(count: number, email = "kto@example.com", from: string | null = IP) {
  for (let i = 0; i < count; i += 1) noteFailedSignIn(email, from);
}

describe("zapora logowania", () => {
  beforeEach(() => {
    forgetAllSignInFailures();
  });

  it("przepuszcza, dopóki nie ma nieudanych prób", () => {
    expect(signInAllowed("kto@example.com", IP).allowed).toBe(true);
  });

  it("przepuszcza cztery pomyłki, zamyka po piątej", () => {
    failTimes(MAX_ATTEMPTS - 1);
    expect(signInAllowed("kto@example.com", IP).allowed).toBe(true);

    noteFailedSignIn("kto@example.com", IP);
    const gate = signInAllowed("kto@example.com", IP);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.retryInSeconds).toBeGreaterThan(0);
      expect(gate.retryInSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("udane logowanie kasuje licznik", () => {
    failTimes(MAX_ATTEMPTS);
    expect(signInAllowed("kto@example.com", IP).allowed).toBe(false);

    clearFailedSignIns("kto@example.com", IP);
    expect(signInAllowed("kto@example.com", IP).allowed).toBe(true);
  });

  it("liczy adres e-mail bez względu na wielkość liter", () => {
    failTimes(MAX_ATTEMPTS, "KTO@Example.com");
    expect(signInAllowed("kto@example.com", IP).allowed).toBe(false);
  });

  it("zamyka konto także wtedy, gdy próby idą z wielu miejsc", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      noteFailedSignIn("kto@example.com", `198.51.100.${i}`);
    }
    // Nowy adres, to samo konto - dalej zamknięte.
    expect(signInAllowed("kto@example.com", "198.51.100.200").allowed).toBe(false);
  });

  it("zamyka też komputer, który obchodzi wiele kont", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      noteFailedSignIn(`kto${i}@example.com`, IP);
    }
    // Kolejne konto z tego samego miejsca nie ma już prawa próbować.
    expect(signInAllowed("ktos-zupelnie-inny@example.com", IP).allowed).toBe(false);
  });

  it("nie miesza kont, gdy pomyłki idą z różnych miejsc", () => {
    failTimes(MAX_ATTEMPTS, "kto@example.com", IP);
    expect(signInAllowed("inny@example.com", "198.51.100.9").allowed).toBe(true);
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

  it("bez nagłówków nie zna adresu i liczy sam e-mail", () => {
    const request = new Request("https://kajet.example/api/v1/signin");
    expect(callerAddress(request)).toBeNull();

    failTimes(MAX_ATTEMPTS, "kto@example.com", null);
    expect(signInAllowed("kto@example.com", null).allowed).toBe(false);
    expect(signInAllowed("inny@example.com", null).allowed).toBe(true);
  });
});
