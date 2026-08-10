/*
  Kod zaproszenia przy zakładaniu konta Google.

  Konto Google zakłada się jednym ruchem: użytkownik wpisuje kod, serwer go
  sprawdza i od razu przerzuca na Google. Kod jedzie z nim w krótkim
  ciasteczku - nie pytamy o adres e-mail, bo ten i tak przychodzi od Google, a
  wcześniejsza wersja wymagała, żeby wpisany adres trafił w konto Google co do
  znaku.
*/

import { cookies } from "next/headers";
import type { InviteCode } from "@prisma/client";
import { prisma } from "./prisma";
import { settings } from "./settings";
import { apiWords } from "./language";

export const inviteCookie = "kajet.kod";

/** Ciasteczko przeżywa tylko przejście do Google i z powrotem. */
const inviteCookieSeconds = 30 * 60;

export type InviteCheck = { invite: InviteCode } | { error: string };

/**
 * Czy kodem można jeszcze założyć konto.
 *
 * Ujemna liczba miejsc znaczy „bez ograniczeń" - tak samo jak przy limicie
 * miejsca na notatki, żeby minus wszędzie w panelu znaczył to samo. Taki kod
 * nie wyczerpuje się nigdy, więc jest zwykłym otwartym odnośnikiem do
 * rejestracji; termin ważności obowiązuje go tak samo jak każdy inny.
 *
 * Bez tej funkcji porównanie `usedSeats >= seats` uznawało kod bez ograniczeń
 * za zużyty od pierwszej chwili (zero jest większe od minus jednego).
 */
export function hasFreeSeat(invite: { seats: number; usedSeats: number }): boolean {
  return invite.seats < 0 || invite.usedSeats < invite.seats;
}

/** Czy kodem można teraz założyć konto. */
export async function checkInvite(rawCode: string): Promise<InviteCheck> {
  const code = rawCode.trim();
  if (!code) return { error: "Wpisz kod zaproszenia." };

  const invite = await prisma.inviteCode.findUnique({ where: { code } });
  if (!invite) {
    return { error: (await apiWords()).apiNoSuchCode };
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { error: (await apiWords()).apiCodeExpired };
  }
  if (!hasFreeSeat(invite)) {
    return { error: (await apiWords()).apiCodeUsedUp };
  }
  return { invite };
}

export async function rememberInvite(code: string): Promise<void> {
  const jar = await cookies();
  jar.set(inviteCookie, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: settings.baseUrl.startsWith("https://"),
    path: "/",
    maxAge: inviteCookieSeconds,
  });
}

/**
 * Kod z ciasteczka, sprawdzony jeszcze raz w bazie. Sprawdzamy powtórnie, bo
 * między wpisaniem kodu a powrotem z Google mogło zabraknąć miejsc.
 */
export async function inviteFromCookie(): Promise<InviteCode | null> {
  const jar = await cookies();
  const code = jar.get(inviteCookie)?.value;
  if (!code) return null;

  const result = await checkInvite(code);
  return "invite" in result ? result.invite : null;
}

export async function forgetInvite(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(inviteCookie);
  } catch {
    // Poza obsługą żądania ciasteczka nie da się skasować. Wygaśnie samo.
  }
}
