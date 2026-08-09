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
# Od tej pory ścieżka bezwzględna: podajemy ją dalej skryptowi kopii, a on
# robi swoje "cd" i względne "." by mu się rozjechało.
KATALOG="$PWD"

# Formularz kontaktowy działa tylko z kluczem w .env - bez niego /contact
# chowa formularz i pokazuje „Formularz nie jest tu jeszcze podłączony".
# To ostrzeżenie, nie błąd: wdrożenie idzie dalej.
if ! grep -q '^CONTACT_API_KEY=..*' .env; then
  echo "UWAGA: w .env nie ma CONTACT_API_KEY - formularz na /contact jest schowany."
  echo "       Dopisz linijkę CONTACT_API_KEY=... (wartość stoi w lokalnym .env"
  echo "       na komputerze) - restart na końcu tego skryptu ją podniesie."
fi

# Napisy z NAJŚWIEŻSZEJ zmiany. Jeśli któregoś nie ma, wgranie trafiło w złe
# miejsce albo w ogóle się nie odbyło - a wtedy build wyszedłby ze starych
# plików, bajt w bajt taki sam jak poprzedni. Przy kolejnej zmianie w kodzie
# podmień te napisy na coś, co istnieje wyłącznie w niej.
#
# Bierz nazwy, a nie napisy z ekranu: napis z przycisku znika, gdy przycisk
# zniknie, i skrypt zaczyna krzyczeć na poprawnie wgrany kod. Tak padło
# „Wygląd obok" - przycisk skasowany razem z trybem podglądu obok.
for znacznik in "admin-nav" "admin-nav-out" "forgetTombstone" "sweepInactiveAccounts"; do
  if ! grep -rq "$znacznik" src/ 2>/dev/null; then
    echo "ŹLE: w $KATALOG/src nie ma nowego kodu (brak: $znacznik)." >&2
    echo "Nowe pliki nie dojechały - wgraj je jeszcze raz i powtórz." >&2
    exit 1
  fi
done
echo "  ok   nowe źródła są na miejscu"

# Czy wgranie było KOMPLETNE.
#
# Powyższe sprawdza tylko, czy dojechał nowy kod. Nie łapie przypadku gorszego:
# nowe pliki są, a stare zniknęły. Tak padło wdrożenie 7 sierpnia 2026 - build
# poszedł i dopiero po minucie powiedział „Cannot find module './settings'",
# bo połowa katalogu lib/ nie dojechała. Te pliki są tu od dawna i mają
# istnieć zawsze; ich brak znaczy urwane wgranie, nie zmianę w kodzie.
for plik in \
  src/lib/settings.ts \
  src/lib/prisma.ts \
  src/lib/auth.ts \
  src/lib/api.ts \
  src/lib/i18n.ts \
  src/app/layout.tsx \
  src/app/globals.css \
  src/app/api/v1/sync/deleted/route.ts \
  prisma/schema.prisma \
  package.json \
  next.config.ts \
  scripts/zastosuj-schemat.sh
do
  if [ ! -f "$plik" ]; then
    echo "ŹLE: brakuje $KATALOG/$plik." >&2
    echo "Wgranie było niekompletne. Wgraj CAŁOŚĆ jeszcze raz i powtórz." >&2
    exit 1
  fi
done

# Schemat bazy musi znać to, czego kod od niego chce. Stary schema.prisma przy
# nowym kodzie to błąd typów w środku builda, a nie od razu widać dlaczego.
for kolumna in "inactiveWarnedAt" "DeletedNote"; do
  if ! grep -q "$kolumna" prisma/schema.prisma; then
    echo "ŹLE: prisma/schema.prisma jest starszy niż kod (brak: $kolumna)." >&2
    echo "Wgraj nowy schemat i powtórz." >&2
    exit 1
  fi
done
echo "  ok   wgranie jest kompletne"

stary_build="$(ls .next/static/chunks/webpack-*.js 2>/dev/null | head -1 || true)"

echo "==> npm install"
npm install

# Schemat bazy: TYLKO SPRAWDZENIE, żadnej zmiany.
#
# Wcześniej stało tu "npm run db:push" i to był błąd. Push potrafi skasować
# kolumnę (zmiana nazwy pola to dla Prismy DROP + ADD) albo odbić się od
# duplikatów i zostawić bazę w stanie mieszanym. Przy set -euo pipefail
# wywalał wdrożenie dokładnie w najgorszym miejscu: zależności podmienione,
# build jeszcze stary - i pod taką presją najłatwiej odruchowo dopisać
# --accept-data-loss. Zmiana schematu jest odtąd osobną, świadomą komendą.
#
# migrate diff czyta bazę i jej NIE RUSZA. --exit-code: 0 = zgodne, 2 = różnice.
echo "==> Sprawdzam, czy schemat bazy zgadza się z kodem"
roznice_plik="$(mktemp)"
blad_plik="$(mktemp)"
trap 'rm -f "$roznice_plik" "$blad_plik"' EXIT

if node scripts/prisma.mjs migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script --exit-code >"$roznice_plik" 2>"$blad_plik"; then
  echo "  ok   baza zgadza się ze schematem - nie ma czego zmieniać"
else
  kod_diff=$?
  if [ "$kod_diff" -ne 2 ]; then
    echo "ŹLE: nie udało się porównać schematu z bazą (kod $kod_diff)." >&2
    sed 's/^/      /' "$blad_plik" >&2 || true
    echo "Baza nie odpowiada albo dane w .env są nie te. Wdrożenie zatrzymane." >&2
    exit 1
  fi

  echo >&2
  echo "STOP: baza RÓŻNI SIĘ od schematu. Trzeba to zrobić świadomie." >&2
  echo >&2
  echo "Po ludzku:" >&2
  # To samo porównanie bez --script: Prisma wypisuje je zdaniami.
  node scripts/prisma.mjs migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma 2>/dev/null | sed 's/^/  /' >&2 || true
  echo >&2
  echo "A dokładnie tym SQL-em:" >&2
  sed 's/^/  /' "$roznice_plik" >&2
  echo >&2
  echo "Wdrożenia NIE kontynuuję - nowa wersja nie ruszy przy takiej bazie," >&2
  echo "a zmiany schematu nie wykonam przy okazji buildu." >&2
  echo >&2
  echo "Zrób to tak:" >&2
  echo "  1. npm run db:apply     <- pokaże różnice, zrobi kopię, zmieni schemat" >&2
  echo "  2. powtórz ten skrypt   <- zbuduje i przeładuje usługę" >&2
  echo >&2
  echo "Stara wersja chodzi dalej, nic się nie zepsuło." >&2
  exit 1
fi

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
echo "1. NAJWAŻNIEJSZE, na telefonie (albo w wąskim oknie): /library nie"
echo "   przewija się w bok - foldery i spis stoją jedno pod drugim, a tabela"
echo "   notatek przewija się w swojej ramce, tak jak w koszu."
echo
echo "2. Na telefonie /admin: przyciski podstron stoją w równych rzędach po"
echo "   trzy, a „Moje notatki\" ma własny wiersz na całą szerokość."
echo
echo "3. Złe hasło na /signin: „Zły adres albo złe hasło.\" staje POD"
echo "   przyciskiem „Zaloguj się\", a pola zostają na swoim miejscu. Tak samo"
echo "   /password - odpowiedź o wysłanym odnośniku staje pod „Wyślij"
echo "   odnośnik\", nie nad polami."
echo
echo "4. /contact wygląda jak strona tytułowa: nagłówek ze znakiem, podkreślone"
echo "   słowo w tytule, samolocik i formularz na jasnej kartce. Pokazuje"
echo "   formularz, a nie napis „Formularz nie jest tu jeszcze podłączony\""
echo "   (jeśli napis stoi, patrz UWAGA o CONTACT_API_KEY na początku)."
echo "   Odpowiedź po wysłaniu staje pod przyciskiem."
echo
echo "Z komputera: node scripts/sprawdz-serwer.mjs - sprawdzi też kontakt."
