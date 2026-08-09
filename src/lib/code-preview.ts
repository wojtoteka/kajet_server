/*
  Podgląd strony HTML pisanej w notatce z kodem.

  Ramka podglądu jest odcięta od reszty serwisu (sandbox bez
  `allow-same-origin`), więc odnośnik kliknięty w środku próbuje otworzyć obcą
  stronę w tej właśnie ramce - a większość serwisów zabrania się osadzać
  i przeglądarka pokazuje wtedy „Serwer www.tiktok.com odrzucił połączenie"
  zamiast strony. W aplikacji na tablecie taki odnośnik wychodzi na wierzch, do
  przeglądarki, więc tutaj robimy to samo: odnośnik do innej strony otwiera się
  w nowej karcie, a podgląd zostaje tam, gdzie był.
*/

/**
 * Adres pisany pełny - tylko taki wyprowadzamy do nowej karty. Skoki po
 * kotwicach (`#dalej`), `mailto:` i ścieżki względne zostają przy swoim
 * zwykłym zachowaniu: tam nie ma obcego serwera, który mógłby odmówić.
 */
export const FULL_ADDRESS = /^(https?:)?\/\//i;

/*
  Skrypt idzie NA KOŃCU kodu, nie na początku: przed `<!DOCTYPE html>` nie wolno
  postawić niczego, bo przeglądarka wrzuciłaby podgląd w tryb zgodności i strona
  wyglądałaby inaczej niż naprawdę. Nasłuch zakładamy w fazie przechwytywania,
  żeby zadziałał także wtedy, gdy autor podglądu sam obsługuje kliknięcia.
*/
const OPEN_IN_NEW_TAB = `
<script>
(function () {
  document.addEventListener("click", function (event) {
    var node = event.target;
    while (node && String(node.nodeName).toUpperCase() !== "A") node = node.parentElement;
    if (!node) return;

    var written = node.getAttribute("href") || "";
    if (!${FULL_ADDRESS.toString()}.test(written)) return;
    // Autor sam napisał, gdzie odnośnik ma się otworzyć - nie poprawiamy go.
    if (node.target) return;

    event.preventDefault();
    window.open(node.href, "_blank", "noopener");
  }, true);
})();
</script>`;

/** Kod z notatki, gotowy do wstawienia w ramkę podglądu. */
export function previewDocument(source: string): string {
  return source + OPEN_IN_NEW_TAB;
}
