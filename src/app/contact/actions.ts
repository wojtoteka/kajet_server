"use server";

import { headers } from "next/headers";
import { captchaCheckAllowed, LONGEST_TOKEN } from "@/lib/captcha-limits";
import { callerAddress } from "@/lib/signin-limits";
import { settings, hcaptchaWorks } from "@/lib/settings";

/*
  Sprawdzenie tokenu hCaptchy.

  Sama wiadomość leci z przeglądarki prosto do API Wojtoteki (Cloudflare tnie
  żądania między serwerami - patrz ContactForm.tsx), ale tokenu captchy nie da
  się sprawdzić w przeglądarce: do tego trzeba sekretu, a sekret nie może
  wyjechać poza serwer. Stąd ta akcja: przeglądarka podaje token, serwer pyta
  hCaptchę (api.hcaptcha.com nie stoi za tym samym Cloudflarem, więc wolno mu)
  i mówi tak albo nie. Dopiero po „tak" formularz wysyła wiadomość.
*/

export async function checkCaptcha(token: string): Promise<boolean> {
  // Bez pary kluczy okienka nie ma, więc nie ma czego sprawdzać.
  if (!hcaptchaWorks()) return true;

  /*
    Akcja jest publiczna, a każde wywołanie kosztuje zapytanie do hCaptchy -
    więc zanim cokolwiek pojedzie w świat: token musi wyglądać jak token
    (napis rozsądnej długości), a adres nie może pytać bez opamiętania.
    Granice siedzą w lib/captcha-limits.ts.
  */
  if (typeof token !== "string" || !token || token.length > LONGEST_TOKEN) return false;
  if (!(await captchaCheckAllowed(callerAddress(await headers())))) return false;

  try {
    const answer = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: settings.contact.hcaptchaSecret,
        sitekey: settings.contact.hcaptchaSiteKey,
        response: token,
      }),
    });
    if (!answer.ok) return false;
    const data: unknown = await answer.json();
    return typeof data === "object" && data !== null && (data as { success?: unknown }).success === true;
  } catch {
    return false;
  }
}
