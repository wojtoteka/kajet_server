/*
  Kod potwierdzający skasowanie konta.

  Skasowanie konta jest nieodwracalne, więc nie wystarczy kliknięcie w panelu:
  ktoś, kto na chwilę usiądzie przy cudzej otwartej przeglądarce, zmiótłby
  w dwie sekundy całą czyjąś bibliotekę. Dlatego drugim kluczem jest skrzynka
  pocztowa - krótki kod przychodzi na adres konta i dopiero on otwiera drzwi.

  Kod leży w tej samej tabeli co odnośniki do potwierdzenia adresu i zmiany
  hasła (`email_tokens`), pod znacznikiem `delete:<adres>`. Wysłanie nowego
  kodu unieważnia poprzedni, a zużyty znika od razu.

  Licznik nietrafionych prób siedzi w pamięci procesu - tak samo jak zapora
  logowania (signin-limits.ts) i limit uruchomień kodu (run-limits.ts).
*/

import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

/*
  Alfabet bez znaków, które ludzie mylą przy przepisywaniu: bez O i zera, bez
  I, J i jedynki. Ten sam pomysł co przy kodach zaproszeń.
*/
const ALPHABET = "ABCDEFGHKLMNPQRSTUVWXYZ23456789";

/** Osiem znaków, pokazywane jako ABCD-EFGH. */
const LENGTH = 8;

/** Jak długo kod jest ważny. */
export const CODE_MINUTES = 60;

/** Ile razy wolno wpisać zły kod, zanim trzeba odczekać. */
export const MAX_ATTEMPTS = 5;

export const WINDOW_MS = 15 * 60 * 1000;

function identifierFor(email: string): string {
  return `delete:${email.trim().toLowerCase()}`;
}

/** Kod tak, jak wygląda w wiadomości: ABCD-EFGH. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Kod sprowadzony do postaci, w jakiej leży w bazie. Człowiek przepisze go
 * z myślnikiem, ze spacją albo małymi literami - i za każdym razem ma zadziałać.
 */
export function normalizeCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/**
 * Wystawia nowy kod dla konta i unieważnia poprzedni. Zwraca kod jawnym
 * tekstem - jedyny raz, kiedy jest widoczny poza wiadomością.
 */
export async function issueDeletionCode(email: string): Promise<string> {
  const identifier = identifierFor(email);
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const code = newCode();
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: code,
      expires: new Date(Date.now() + CODE_MINUTES * 60_000),
    },
  });

  return code;
}

export type CodeCheck = { ok: true } | { ok: false; reason: "wrong" | "expired" };

/**
 * Sprawdza kod i - gdy pasuje - od razu go zużywa. Kod zły i kod nieistniejący
 * dają tę samą odpowiedź: nie ma po co podpowiadać, że trafiło się blisko.
 */
export async function useDeletionCode(email: string, typed: string): Promise<CodeCheck> {
  const code = normalizeCode(typed);
  if (!code) return { ok: false, reason: "wrong" };

  const entry = await prisma.verificationToken.findFirst({
    where: { identifier: identifierFor(email), token: code },
  });
  if (!entry) return { ok: false, reason: "wrong" };

  // Przeterminowany kod znika, żeby nie zalegał w tabeli.
  if (entry.expires < new Date()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: entry.identifier, token: entry.token },
    });
    return { ok: false, reason: "expired" };
  }

  await prisma.verificationToken.deleteMany({
    where: { identifier: entry.identifier, token: entry.token },
  });
  return { ok: true };
}

/** Sprząta kod, gdy człowiek rozmyślił się i wyszedł. Nie musi się udać. */
export async function forgetDeletionCode(email: string): Promise<void> {
  await prisma.verificationToken
    .deleteMany({ where: { identifier: identifierFor(email) } })
    .catch(() => undefined);
}

// --- Zapora przed zgadywaniem kodu ---

type Window = { start: number; count: number };

const tries = new Map<string, Window>();

export type CodeGate = { allowed: true } | { allowed: false; retryInSeconds: number };

/** Czy wolno teraz spróbować. Nic nie zapisuje - samo pytanie. */
export function deletionTryAllowed(userId: string): CodeGate {
  const now = Date.now();
  const window = tries.get(userId);
  if (!window) return { allowed: true };

  if (now - window.start >= WINDOW_MS) {
    tries.delete(userId);
    return { allowed: true };
  }

  if (window.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryInSeconds: Math.ceil((WINDOW_MS - (now - window.start)) / 1000),
    };
  }

  return { allowed: true };
}

export function noteFailedDeletionTry(userId: string): void {
  const now = Date.now();
  const window = tries.get(userId);
  if (!window || now - window.start >= WINDOW_MS) {
    tries.set(userId, { start: now, count: 1 });
    return;
  }
  window.count += 1;
}

export function clearDeletionTries(userId: string): void {
  tries.delete(userId);
}

/** Do testów: czyści całą pamięć licznika. */
export function forgetAllDeletionTries(): void {
  tries.clear();
}
