/**
 * Sprawdza żywy serwer Kajetu tak, jak robi to aplikacja na tablecie.
 *
 * Odpowiada na jedno pytanie: dlaczego aplikacja nie może się połączyć.
 * Puka w te same adresy co CloudClient.kt i tłumaczy odpowiedzi na polski.
 *
 * Użycie:
 *   node scripts/sprawdz-serwer.mjs
 *   node scripts/sprawdz-serwer.mjs https://kajet.wojtoteka.ovh
 */

const address = (process.argv[2] ?? "https://kajet.wojtoteka.ovh").replace(/\/+$/, "");

// Cloudflare przepuszcza aplikację, a gołe narzędzia potrafi zatrzymać.
// Przedstawiamy się tak samo jak Android, żeby zobaczyć to, co widzi aplikacja.
const headers = { "user-agent": "Dalvik/2.1.0 (Linux; U; Android 14) Kajet" };

let problems = 0;

function say(ok, name, detail) {
  if (!ok) problems += 1;
  console.log(`${ok ? "  ok  " : " ŹLE "} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function ask(path, options = {}) {
  try {
    const response = await fetch(`${address}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, body, text };
  } catch (problem) {
    return { status: 0, body: null, text: String(problem?.message ?? problem) };
  }
}

console.log(`\nSprawdzam ${address}\n`);

// 1. Czy strona w ogóle stoi.
const home = await ask("/");
say(home.status === 200, "strona główna", home.status ? `HTTP ${home.status}` : home.text);

// 2. Katalog public/ — logo bierze się właśnie stamtąd.
const logo = await ask("/logo.svg");
say(
  logo.status === 200,
  "pliki z katalogu public/ (logo.svg)",
  logo.status === 404
    ? "404 — katalog public/ nie pojechał na serwer przy wdrożeniu"
    : `HTTP ${logo.status}`,
);

// 3. Trasa notatek. Bez tokenu ma oddać 401, i to jest dobra odpowiedź:
//    znaczy, że trasa żyje i sprawdza tożsamość.
const notes = await ask("/api/v1/notes");
say(
  notes.status === 401,
  "GET /api/v1/notes (synchronizacja notatek)",
  notes.status === 401
    ? "401 bez tokenu, czyli tak jak trzeba"
    : `HTTP ${notes.status} ${notes.body?.message ?? ""}`,
);

// 4. Logowanie przez przeglądarkę — tu najczęściej siedzi brakująca tabela.
const device = await ask("/api/v1/signin/device", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ device: "Sprawdzenie serwera" }),
});
const missingTable = /nie istnieje|does not exist|db:push/i.test(device.body?.message ?? "");
say(
  device.status === 200 && Boolean(device.body?.code),
  "POST /api/v1/signin/device (logowanie Google i przez stronę)",
  missingTable
    ? "baza jest starsza niż program — na serwerze brakuje „npm run db:apply”"
    : device.status === 200
      ? "kod logowania wydany"
      : `HTTP ${device.status} ${device.body?.message ?? device.text.slice(0, 160)}`,
);

// 5. Formularz kontaktowy. Bez CONTACT_API_KEY w .env serwera strona /contact
//    chowa formularz i pokazuje zapasowy napis - łapiemy go w HTML. Napis jest
//    po polsku, bo bez ciasteczka język strony to polski.
const contact = await ask("/contact");
const contactOff = contact.text.includes("Formularz nie jest tu jeszcze pod");
say(
  contact.status === 200 && !contactOff,
  "formularz kontaktowy (/contact)",
  contactOff
    ? "w .env na serwerze brakuje CONTACT_API_KEY — dopisz (wartość jest w lokalnym .env) i przeładuj usługę"
    : contact.status === 200
      ? "formularz jest podłączony"
      : `HTTP ${contact.status}`,
);

console.log("");

if (problems === 0) {
  console.log("Wszystko odpowiada. Aplikacja ma się z czym łączyć.\n");
} else {
  console.log(`Do naprawy: ${problems}. Kolejność na serwerze:\n`);
  console.log("  1. wgraj kod RAZEM z katalogiem public/");
  console.log("  2. npm ci, a przy zmianie schematu npm run db:apply");
  console.log("  3. npm run build && restart usługi\n");
  process.exitCode = 1;
}
