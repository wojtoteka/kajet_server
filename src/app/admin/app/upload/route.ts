/*
  Odbiór pliku APK z panelu administratora.

  Plik idzie osobno od reszty formularza, prosto w ciele zapytania, bez
  multipartu. Powody dwa: kilkadziesiąt megabajtów nie musi wtedy przechodzić
  przez pamięć serwera, a przeglądarka może pokazać pasek postępu. Wersję i opis
  zmian dopina zaraz potem zwykła akcja formularza, po skrócie, który tu zwracamy.

  Ta droga omija układ /admin, a ten pilnuje uprawnień - więc pilnujemy ich tutaj
  jeszcze raz, sami.
*/

import { currentAdmin } from "@/lib/auth";
import { receiveUpload } from "@/lib/app-release";
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

  return Response.json({ upload: outcome.hash, sizeBytes: outcome.sizeBytes });
}
