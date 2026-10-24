import { previewFrameDocument } from "@/lib/code-preview";

/*
  Strona, w której ramka podglądu rysuje HTML z notatki z kodem
  (opis w lib/code-preview.ts).

  Polityka jest celowo luźna - kod ucznia może ładować skrypty, style
  i obrazki skądkolwiek, jak w zwykłej karcie przeglądarki. Bezpieczeństwo
  daje `sandbox` bez `allow-same-origin`: strona ma odcięte pochodzenie
  także wtedy, gdy ktoś otworzy ją bezpośrednio, więc nie sięgnie ani do
  ciasteczek Kajetu, ani do notatek. Lista zgód jest ta sama, co w atrybucie
  `sandbox` ramki w CodeNotePanel. Osadzić ją może tylko sam Kajet.

  Middleware tej ścieżki nie dotyka, żeby nie dołożył CSP stron.
*/
export function GET() {
  return new Response(previewFrameDocument(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "content-security-policy":
        "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox; frame-ancestors 'self'",
      "x-frame-options": "SAMEORIGIN",
    },
  });
}
