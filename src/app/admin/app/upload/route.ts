/*
  Odbiór pliku APK z panelu administratora.

  Plik idzie osobno od reszty formularza, prosto w ciele zapytania, bez
  multipartu. Powody dwa: kilkadziesiąt megabajtów nie musi wtedy przechodzić
  przez pamięć serwera, a przeglądarka może pokazać pasek postępu. Opis zmian
  dopina zaraz potem zwykła akcja formularza, po skrócie, który tu zwracamy.

  Razem ze skrótem oddajemy wersję odczytaną z samego pliku. Formularz pokazuje
  ją od razu po wgraniu, więc widać, co naprawdę pójdzie do bazy, zanim
  cokolwiek się zapisze.

  Ta droga omija układ /admin, a ten pilnuje uprawnień - więc pilnujemy ich tutaj
  jeszcze raz, sami.
*/

import { currentAdmin } from "@/lib/auth";
import { receiveUpload, releasePath } from "@/lib/app-release";
import { apkVersion } from "@/lib/apk";
import { currentWords } from "@/lib/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const admin = await currentAdmin();
  if (!admin) {
    return Response.json({ error: "To miejsce jest tylko dla administratora." }, { status: 403 });
  }

  if (!request.body) {
    return Response.json({ error: (await currentWords()).actNoFileArrived }, { status: 400 });
  }

  const outcome = await receiveUpload(request.body);
  if (!outcome.ok) {
    return Response.json({ error: outcome.reason }, { status: 400 });
  }

  // Pusta wersja nie jest tu błędem: plik już leży na dysku i da się go
  // wystawić po wpisaniu numeru ręcznie. Formularz sam o tym powie.
  const version = await apkVersion(releasePath(outcome.hash));

  return Response.json({
    upload: outcome.hash,
    sizeBytes: outcome.sizeBytes,
    versionCode: version?.versionCode ?? null,
    versionName: version?.versionName || null,
  });
}
