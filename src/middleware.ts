import { NextResponse, type NextRequest } from "next/server";

/*
  Nagłówki bezpieczeństwa stron.

  CSP ma jednorazowy nonce: Next.js znajduje go w nagłówku CSP żądania i dopisuje
  do swoich skryptów inline, a layout.tsx do skryptu z motywem. Dzięki temu
  script-src obywa się bez 'unsafe-inline' - skrypt wstrzyknięty w treść strony
  (XSS) nie ma nonce i przeglądarka go nie wykona.

  Podgląd HTML z notatki z kodem nie mieści się w takiej polityce (kod ucznia
  ma działać jak w zwykłej przeglądarce), dlatego ramka podglądu ładuje osobną
  stronę /code-preview z własną polityką - patrz src/app/code-preview/route.ts.
  Ramka srcdoc dziedziczyłaby CSP strony i skrypty w podglądzie by stanęły.

  Reszta nagłówków, wspólna także dla API, siedzi w next.config.ts.
*/

const dev = process.env.NODE_ENV !== "production";

const HCAPTCHA = "https://hcaptcha.com https://*.hcaptcha.com";

/*
  W trybie deweloperskim Next.js potrzebuje 'unsafe-eval' (odświeżanie na
  żywo) i wstrzykuje style inline, na produkcji style idą wyłącznie z plików.
  Atrybuty style="" nie mogą mieć nonce, stąd osobne style-src-attr.

  Cloudflare dokłada do stron licznik odwiedzin (static.cloudflareinsights.com),
  a obrazki w notatce tekstowej mogą wskazywać dowolny adres https.
  Logowanie przez Google bez JavaScriptu to zwykły formularz z przekierowaniem
  do Google, a form-action pilnuje całego łańcucha przekierowań.
*/
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""} https://js.hcaptcha.com ${HCAPTCHA} https://static.cloudflareinsights.com`,
    "script-src-attr 'none'",
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`} ${HCAPTCHA}`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    `connect-src 'self' ${HCAPTCHA} https://cloudflareinsights.com${dev ? " ws:" : ""}`,
    `frame-src 'self' ${HCAPTCHA}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

/*
  Pliki (załączniki, pobieranie) ustawiają własne nagłówki w odpowiedzi
  i nie są stronami - zostawiamy je w spokoju.
*/
const FILE_PATH = /^\/(note|n)\/[^/]+\/(attachment|download)$|^\/download\/file$/;

export function middleware(request: NextRequest) {
  if (FILE_PATH.test(request.nextUrl.pathname)) return NextResponse.next();

  // Nagłówek CSP żądania zawsze nadpisujemy, więc klient nie podsunie własnego nonce.
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}

export const config = {
  /*
    Node.js zamiast Edge: z middleware na Edge Next.js kompiluje pod Edge także
    instrumentation.ts, a ten ciągnie bazę i pocztę (nodemailer), których tam nie ma.
  */
  runtime: "nodejs",
  matcher: [
    {
      /*
        Bez API, plików statycznych, ramki podglądu i .well-known (assetlinks
        dla Androida). Wywołania akcji serwera (nagłówek Next-Action) też
        omijają middleware: Next.js buforuje w nim treść żądania tylko do 10 MB,
        a gęsta notatka odręczna albo plik do biblioteki potrafi ważyć więcej.
      */
      source: "/((?!api/|_next/static|_next/image|code-preview|\\.well-known/|icon\\.svg|favicon\\.ico).*)",
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
