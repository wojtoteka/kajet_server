import { DEFAULT_LANGUAGE, tooManySignInsIn, words as dictionary, type Words } from "./i18n";
/*
  Zapora przed zgadywaniem hasła.

  Pięć nieudanych prób pod rząd zamykają logowanie na kwadrans. Liczy się
  osobno adres e-mail i osobno komputer/telefon, z którego przyszło zapytanie:
  ktoś, kto wali w jedno konto z wielu miejsc, i ktoś, kto z jednego miejsca
  próbuje wielu kont, zatrzymują się tak samo. Udane logowanie kasuje licznik,
  więc pomyłka we własnym haśle nie ma żadnych skutków.

  Licznik siedzi w pamięci procesu - tak samo jak limit uruchomień kodu
  (run-limits.ts). Kajet chodzi jako jeden serwer, a restart i tak przerywa
  każdą próbę zgadywania.
*/

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

type Window = { start: number; count: number };

const failures = new Map<string, Window>();

const CLEANUP_EVERY = 200;
let sinceCleanup = 0;

export type SignInGate =
  | { allowed: true }
  | { allowed: false; retryInSeconds: number; message: string };

/** Klucze, na których stoi licznik dla jednej próby logowania. */
function keysFor(email: string, from: string | null): string[] {
  const keys = [`mail:${email.trim().toLowerCase()}`];
  if (from) keys.push(`skad:${from}`);
  return keys;
}

/**
 * Adres, z którego przyszło zapytanie.
 *
 * Topologia (z `nginx -T` na produkcji, 2026-08-08): użytkownik → Cloudflare
 * → nginx → Node. nginx ustawia `X-Real-IP: $remote_addr` (adres POŁĄCZENIA,
 * niepodrabialny) i DOKLEJA $remote_addr NA KOŃCU `X-Forwarded-For`
 * (proxy_add_x_forwarded_for nie kasuje tego, co przysłał klient). Pierwszego
 * elementu XFF nie wolno czytać NIGDY: wpisuje go klient i może go podmieniać
 * przy każdym żądaniu, a wtedy limity per adres przestają istnieć.
 *
 * Modułu real_ip w nginxie nie ma, więc przy ruchu przez Cloudflare
 * $remote_addr to adres krawędzi CF, nie użytkownika - prawdziwy adres niesie
 * wtedy `cf-connecting-ip`, wpisywany przez Cloudflare. Stąd kolejność:
 * cf-connecting-ip → x-real-ip → OSTATNI element XFF → null. Gdyby origin
 * dało się kiedyś osiągnąć z pominięciem Cloudflare, cf-connecting-ip mógłby
 * wpisać sam napastnik - wtedy trzeba by go przyjmować tylko z adresów CF.
 *
 * Gołe nagłówki zamiast Request przychodzą z akcji serwerowych - tam Request
 * nie istnieje, jest tylko `headers()` z next/headers.
 */
export function callerAddress(source: Request | Headers): string | null {
  const headers = source instanceof Request ? source.headers : source;

  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return null;
}

/** Czy wolno teraz próbować. Nic nie zapisuje - samo pytanie. */
export function signInAllowed(
  email: string,
  from: string | null,
  /*
    Zdanie o zaporze widzi człowiek, więc idzie w jego języku. Domyślny
    słownik jest dla testów jednostkowych, które o język nie pytają.
  */
  words: Words = dictionary(DEFAULT_LANGUAGE),
): SignInGate {
  const now = Date.now();
  cleanupSometimes(now);

  let longestWait = 0;
  for (const key of keysFor(email, from)) {
    const window = failures.get(key);
    if (!window) continue;
    if (now - window.start >= WINDOW_MS) {
      failures.delete(key);
      continue;
    }
    if (window.count >= MAX_ATTEMPTS) {
      longestWait = Math.max(longestWait, WINDOW_MS - (now - window.start));
    }
  }

  if (longestWait === 0) return { allowed: true };

  const retryInSeconds = Math.ceil(longestWait / 1000);
  const minutes = Math.ceil(retryInSeconds / 60);
  return {
    allowed: false,
    retryInSeconds,
    message: tooManySignInsIn(words, minutes),
  };
}

/** Nieudana próba - licznik rośnie. */
export function noteFailedSignIn(email: string, from: string | null): void {
  const now = Date.now();
  for (const key of keysFor(email, from)) {
    const window = failures.get(key);
    if (!window || now - window.start >= WINDOW_MS) {
      failures.set(key, { start: now, count: 1 });
    } else {
      window.count += 1;
    }
  }
}

/** Udane logowanie - licznik od zera, żeby własna pomyłka nic nie kosztowała. */
export function clearFailedSignIns(email: string, from: string | null): void {
  for (const key of keysFor(email, from)) failures.delete(key);
}

function cleanupSometimes(now: number): void {
  sinceCleanup += 1;
  if (sinceCleanup < CLEANUP_EVERY) return;
  sinceCleanup = 0;

  for (const [key, window] of failures) {
    if (now - window.start >= WINDOW_MS) failures.delete(key);
  }
}

/** Do testów: czyści całą pamięć licznika. */
export function forgetAllSignInFailures(): void {
  failures.clear();
  sinceCleanup = 0;
}
