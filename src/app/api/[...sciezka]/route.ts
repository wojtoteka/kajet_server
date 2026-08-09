import { error } from "@/lib/api";
import { apiWords } from "@/lib/language";

/*
  Nieznany adres pod /api. Bez tego pliku Next.js oddawał tu całą stronę 404
  w HTML - a pod /api pyta aplikacja, nie człowiek: zamiast komunikatu widziała
  wtedy kawał HTML-a i mówiła „nieoczekiwana odpowiedź serwera".

  Odpowiedź ma ten sam kształt co każdy inny błąd API (`error` i `message`),
  więc aplikacja pokaże zdanie po polsku. Prawdziwe trasy - /api/v1/... oraz
  /api/auth/... - są bardziej szczegółowe, więc idą swoją drogą i ten plik
  ich nie dotyka.
*/

async function missing(): Promise<Response> {
  return error("no-route", (await apiWords()).apiUnknownAddress, 404);
}

export const GET = missing;
export const POST = missing;
export const PUT = missing;
export const PATCH = missing;
export const DELETE = missing;
export const HEAD = missing;

export { OPTIONS } from "@/lib/api";
