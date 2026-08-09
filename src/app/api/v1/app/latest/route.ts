/*
  Aktualna wersja aplikacji na Androida.

  Aplikacja pyta o to sama, żeby powiedzieć użytkownikowi, że ma starszą wersję.
  Porównuje swój versionCode z tym, co przyjdzie tutaj, i jeśli serwer ma wyższy,
  otwiera `url`.

  Bez tokenu: sprawdzić aktualizację trzeba móc także przed zalogowaniem, a plik
  i tak leży na stronie do wzięcia przez każdego. Skoro punkt stoi otworem,
  pilnuje go licznik zapytań z jednego adresu (version-limits.ts), a odpowiedź
  idzie z pięciominutowym cache - aplikacja pyta raz na uruchomienie, więc nawet
  przy wielu urządzeniach serwer czyta bazę rzadko.

  Nie ma tu ani słowa o kontach: ani ilu ich jest, ani kto co pobrał. Wychodzi
  wyłącznie to, co i tak widać na stronie /download.
*/

import { error, json, wrapApi } from "@/lib/api";
import { currentRelease } from "@/lib/app-release";
import { apiWords } from "@/lib/language";
import { settings } from "@/lib/settings";
import { callerAddress } from "@/lib/signin-limits";
import { versionCheckAllowed } from "@/lib/version-limits";

export { OPTIONS } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Jak długo odpowiedź może leżeć w pamięci podręcznej pośredników. */
const CACHE_SECONDS = 300;

const CACHE_HEADERS = {
  "cache-control": `public, max-age=${CACHE_SECONDS}`,
};

export const GET = wrapApi(async (request: Request) => {
  const gate = versionCheckAllowed(callerAddress(request));
  if (!gate.allowed) {
    return error("too-often", (await apiWords()).apiVersionTooOften, 429, {
      "retry-after": String(gate.retryInSeconds),
    });
  }

  const release = await currentRelease();

  if (!release) return json({ release: null }, 200, CACHE_HEADERS);

  return json(
    {
      release: {
        version: release.version,
        versionCode: release.versionCode,
        notes: release.notes,
        fileName: release.fileName,
        sizeBytes: release.sizeBytes,
        hash: release.hash,
        url: `${settings.baseUrl}/download/file`,
        pageUrl: `${settings.baseUrl}/download`,
        publishedAt: release.createdAt.getTime(),
        /** Data wystawienia w postaci do pokazania, bez godziny. */
        releaseDate: release.createdAt.toISOString().slice(0, 10),
        /*
          Najstarsze wydanie, które ten serwer jeszcze obsługuje. Zapas na
          przyszłość, na wypadek aktualizacji obowiązkowej: aplikacja ma to na
          razie tylko odczytywać i nic z tym nie robić. Zero znaczy, że nic nie
          jest wymuszane - i tak zostaje, dopóki nie ustawi się
          MIN_SUPPORTED_RELEASE w ustawieniach serwera.
        */
        minSupportedRelease: settings.app.minSupportedRelease,
      },
    },
    200,
    CACHE_HEADERS,
  );
});
