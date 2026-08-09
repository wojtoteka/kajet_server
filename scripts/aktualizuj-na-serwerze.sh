#!/usr/bin/env bash
#
# Aktualizacja Kajetu na serwerze - jedna komenda zamiast listy kroków.
#
# Użycie (na serwerze, po wgraniu nowych plików):
#
#   bash /home/Nodejs/kajet/scripts/aktualizuj-na-serwerze.sh
#
# Innym katalogiem: podaj go jako pierwszy argument.
#
# Skrypt najpierw sprawdza, czy nowe źródła NAPRAWDĘ leżą w katalogu serwera
# (o to rozbiły się poprzednie próby: build szedł ze starych plików i wychodził
# bajt w bajt taki sam), dopiero potem buduje i przeładowuje usługę. Gdy
# budowanie padnie, stara wersja chodzi dalej.

set -euo pipefail

KATALOG="${1:-/home/Nodejs/kajet}"
# Nazwa procesu w pm2 (tak stoi produkcja) oraz zapasowo usługa systemd.
PROCES_PM2="kajet_server"
USLUGA_SYSTEMD="kajet"

cd "$KATALOG"

if [ ! -f package.json ] || [ ! -f .env ]; then
  echo "ŹLE: $KATALOG nie wygląda na katalog serwera (brak package.json albo .env)." >&2
  exit 1
fi

# Napisy z NAJŚWIEŻSZEJ zmiany. Jeśli któregoś nie ma, wgranie trafiło w złe
# miejsce albo w ogóle się nie odbyło - a wtedy build wyszedłby ze starych
# plików, bajt w bajt taki sam jak poprzedni. Przy kolejnej zmianie w kodzie
# podmień te napisy na coś, co istnieje wyłącznie w niej.
#
# Bierz nazwy, a nie napisy z ekranu: napis z przycisku znika, gdy przycisk
# zniknie, i skrypt zaczyna krzyczeć na poprawnie wgrany kod. Tak padło
# „Wygląd obok" - przycisk skasowany razem z trybem podglądu obok.
for znacznik in "markdownToHtml" "htmlToMarkdown" "saveWritingSettings"; do
  if ! grep -rq "$znacznik" src/ 2>/dev/null; then
    echo "ŹLE: w $KATALOG/src nie ma nowego kodu (brak: $znacznik)." >&2
    echo "Nowe pliki nie dojechały - wgraj je jeszcze raz i powtórz." >&2
    exit 1
  fi
done
echo "  ok   nowe źródła są na miejscu"

stary_build="$(ls .next/static/chunks/webpack-*.js 2>/dev/null | head -1 || true)"

echo "==> npm install"
npm install

# Baza pierwsza: gdy w nowej wersji doszła kolumna, aplikacja bez niej wstanie
# i dopiero na żywym ruchu zacznie sypać błędami. Bez zmian w schemacie krok
# ten nic nie robi.
echo "==> Dociągam bazę do schematu (npm run db:push)"
npm run db:push

echo "==> Buduję (npm run build)"
npm run build

echo "==> Przeładowuję usługę"
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PROCES_PM2" >/dev/null 2>&1; then
  pm2 restart "$PROCES_PM2" --update-env
  pm2 list
elif command -v systemctl >/dev/null 2>&1; then
  systemctl restart "$USLUGA_SYSTEMD"
  systemctl --no-pager --lines 5 status "$USLUGA_SYSTEMD" || true
else
  echo "UWAGA: nie znalazłem ani pm2, ani systemd - przeładuj serwer ręcznie." >&2
fi

nowy_build="$(ls .next/static/chunks/webpack-*.js 2>/dev/null | head -1 || true)"
echo
echo "Plik builda przed: ${stary_build:-brak}"
echo "Plik builda po:    ${nowy_build:-brak}"
if [ -n "$nowy_build" ] && [ "$nowy_build" = "$stary_build" ]; then
  echo "UWAGA: nazwa pliku builda się nie zmieniła - to by znaczyło, że źródła"
  echo "wciąż są stare. Napisz, co wypisał ten skrypt."
fi
echo
echo "Sprawdzenie w przeglądarce:"
echo
echo "1. „Moje konto\" ma sekcję „Pisanie\": przełącznik „Auto zapis\", „Gruba"
echo "   czcionka\" oraz krój, rozmiar i wyrównanie nowej notatki tekstowej."
echo "   Wyłącz autozapis, zapisz - w notatce przy przycisku ma stać „Auto zapis"
echo "   wyłączony w ustawieniach konta\", a pisanie ma NIE zapisywać samo"
echo "   (zapisuje przycisk „Zapisz\" albo Ctrl+S)."
echo
echo "2. NAJWAŻNIEJSZE: notatka tekstowa pisze się w gotowym wyglądzie."
echo "   Otwórz notatkę z pogrubieniem - ma być GRUBE, a nie „**tekst**\"."
echo "   Zaznacz słowo, kliknij B (albo Ctrl+B) - grubieje od razu. To samo"
echo "   z kursywą, przekreśleniem, podkreśleniem, zakreślaczem i kodem."
echo "   Nagłówek jest duży, lista ma kropki, cytat kreskę z boku."
echo "   Pasek jest na ikonach (fonts.google.com/icons), a przyciski świecą,"
echo "   gdy kursor stoi w takim właśnie kawałku tekstu."
echo
echo "   Zapisz i otwórz notatkę ponownie - treść ma być ta sama. Zerknij też"
echo "   na nią w aplikacji na tablecie: zapis w pliku dalej jest markdownem."
echo
echo "3. Zmyślony adres, na przykład /nie-ma-takiej-strony, pokazuje polską"
echo "   kartkę „Nie ma takiej strony\" z 404, a nie angielskie „This page could"
echo "   not be found.\". Zmyślona notatka (/note/cokolwiek) - „Nie ma takiej"
echo "   notatki\". Zmyślony adres API (/api/v1/nic) oddaje JSON z „message\"."
