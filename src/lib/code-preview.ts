/*
  Podgląd strony HTML pisanej w notatce z kodem.

  Ramka podglądu jest odcięta od reszty serwisu (sandbox bez
  `allow-same-origin`), więc odnośnik kliknięty w środku próbuje otworzyć obcą
  stronę w tej właśnie ramce - a większość serwisów zabrania się osadzać
  i przeglądarka pokazuje wtedy „Serwer www.tiktok.com odrzucił połączenie"
  zamiast strony. W aplikacji na tablecie taki odnośnik wychodzi na wierzch, do
  przeglądarki, więc tutaj robimy to samo: odnośnik do innej strony otwiera się
  w nowej karcie, a podgląd zostaje tam, gdzie był.

  Drugie zadanie wstrzykiwanego skryptu to konsola. `console.log` z podglądu
  szedł dotąd do konsoli przeglądarki, czyli w miejsce, do którego na tablecie
  nikt nie zajrzy - a to właśnie w notatce HTML pisze się szkolny JavaScript,
  bo w notatce „JavaScript" stoi Node i nie ma tam ani `document`, ani `alert`.
  Skrypt przechwytuje więc `console.*` oraz błędy i wypycha je do strony
  `postMessage`-em, a panel pokazuje je pod podglądem.
*/

/**
 * Adres pisany pełny - tylko taki wyprowadzamy do nowej karty. Skoki po
 * kotwicach (`#dalej`), `mailto:` i ścieżki względne zostają przy swoim
 * zwykłym zachowaniu: tam nie ma obcego serwera, który mógłby odmówić.
 */
export const FULL_ADDRESS = /^(https?:)?\/\//i;

/**
 * Znak rozpoznawczy wiadomości z podglądu.
 *
 * Ramka ma własne, obce pochodzenie (sandbox bez `allow-same-origin`), więc
 * `event.origin` przychodzi jako "null" i nie da się po nim niczego poznać.
 * Panel sprawdza `event.source` - czy wiadomość przyszła z JEGO ramki - a ten
 * napis jest drugim sitem, na wypadek gdyby ramka wpuściła cudzy skrypt.
 */
export const PREVIEW_MESSAGE = "kajet-podglad-konsola";

/** Początek dokumentu: `<!DOCTYPE html>`, jeśli autor go napisał. */
const DOCTYPE = /^(\s*<!doctype[^>]*>)/i;

/*
  Białe płótno jak w zwykłej karcie przeglądarki.

  Domyślny HTML ma przezroczyste html i body, a ramka bez własnego
  `color-scheme` bierze ciemny schemat ze strony Kajetu - wtedy kartka
  wygląda na ciemny arkusz. Tu jest tylko nieprzezroczysta biel i jasny
  schemat, bez kroju, barwy pisma i reszty chrome. Arkusz autora stoi
  później w dokumencie i wygrywa: `body { background }` maluje się na
  wierzchu, tak samo jak w WebView na tablecie.
*/
const STRONA = `
<style>
html { color-scheme: light; background-color: #fff; }
body { background-color: #fff; }
</style>`;

/*
  Skrypt wchodzi ZARAZ ZA `<!DOCTYPE html>`, a nie na końcu dokumentu.

  Przed doctype nie wolno postawić niczego, bo przeglądarka wrzuciłaby podgląd
  w tryb zgodności i strona wyglądałaby inaczej niż naprawdę. Ale i koniec
  dokumentu jest za późno: skrypty autora zdążyły już wtedy wykonać się do
  końca, więc `console.log` z pierwszego wiersza strony nie miałby kto złapać.
  Zaraz za doctype spełnia oba warunki naraz.

  Nasłuch kliknięć zakładamy w fazie przechwytywania, żeby zadziałał także
  wtedy, gdy autor podglądu sam obsługuje kliknięcia.
*/
const WSTRZYKNIETY = `${STRONA}
<script>
(function () {
  var ZNAK = ${JSON.stringify(PREVIEW_MESSAGE)};

  function slowo(wartosc) {
    if (typeof wartosc === "string") return wartosc;
    if (wartosc instanceof Error) return wartosc.name + ": " + wartosc.message;
    try {
      var tekst = JSON.stringify(wartosc);
      return typeof tekst === "string" ? tekst : String(wartosc);
    } catch (klopot) {
      return String(wartosc);
    }
  }

  function wyslij(rodzaj, tekst) {
    try {
      window.parent.postMessage({ zrodlo: ZNAK, rodzaj: rodzaj, tekst: tekst }, "*");
    } catch (klopot) {
      // Strona nadrzedna moze nie chciec sluchac. Podglad ma dzialac dalej.
    }
  }

  // Panel czysci spis przy kazdym wczytaniu podgladu. Podglad odswieza sie po
  // kazdej literze, wiec bez tego wpisy z poprzedniego brzmienia strony
  // zostawalyby na ekranie i mieszaly sie z nowymi.
  wyslij("start", "");

  var rodzaje = ["log", "info", "warn", "error", "debug"];
  for (var i = 0; i < rodzaje.length; i++) {
    (function (rodzaj) {
      var wlasny = console[rodzaj];
      console[rodzaj] = function () {
        var czesci = [];
        for (var j = 0; j < arguments.length; j++) czesci.push(slowo(arguments[j]));
        wyslij(rodzaj, czesci.join(" "));
        if (typeof wlasny === "function") wlasny.apply(console, arguments);
      };
    })(rodzaje[i]);
  }

  window.addEventListener("error", function (zdarzenie) {
    var gdzie = zdarzenie.lineno ? " (wiersz " + zdarzenie.lineno + ")" : "";
    wyslij("error", (zdarzenie.message || "Błąd w skrypcie") + gdzie);
  });

  window.addEventListener("unhandledrejection", function (zdarzenie) {
    wyslij("error", "Nieobsłużona obietnica: " + slowo(zdarzenie.reason));
  });

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
  const doctype = source.match(DOCTYPE);
  if (!doctype) return WSTRZYKNIETY + source;

  const poczatek = doctype[1];
  return poczatek + WSTRZYKNIETY + source.slice(poczatek.length);
}
