#!/usr/bin/env bash
#
# Świadoma zmiana schematu bazy: pokaż różnice, potwierdź, dopiero potem push.
#
# Użycie (na serwerze, RĘCZNIE, nigdy z wdrożenia):
#
#   npm run db:apply
#
# Dlaczego osobno od wdrożenia: "prisma db push" potrafi skasować kolumnę albo
# odbić się od duplikatów w połowie zmian. Taka decyzja nie może się trafiać
# sama, w środku wdrożenia, gdy zależności są już podmienione a build stary.
#
# UWAGA: kopii bazy nie ma. Cokolwiek tu zniknie, zniknie na zawsze - dlatego
# skrypt pokazuje SQL przed wykonaniem i przy zmianach kasujących dane żąda
# wpisania nazwy bazy.
#
# Tu nie ma i nie będzie --accept-data-loss. Gdy Prisma ostrzeże o utracie
# danych, odpowiadasz świadomie, patrząc na to, co za chwilę zniknie.

set -euo pipefail

KATALOG="${1:-$PWD}"
cd "$KATALOG"

if [ ! -f package.json ] || [ ! -f prisma/schema.prisma ] || [ ! -f .env ]; then
  echo "ŹLE: $KATALOG nie wygląda na katalog serwera." >&2
  exit 1
fi
KATALOG="$PWD"

if [ ! -t 0 ]; then
  echo "ŹLE: ten skrypt pyta o potwierdzenie, więc musi mieć klawiaturę." >&2
  echo "Uruchom go w zwykłej sesji na serwerze, nie z potoku ani z crona." >&2
  exit 1
fi

ROBOCZY="$(mktemp -d)"
trap 'rm -rf "$ROBOCZY"' EXIT

# Różnice liczymy z bazy DO schematu: "co trzeba zrobić bazie, żeby dogoniła
# schema.prisma". --exit-code oddaje 0 przy braku różnic i 2, gdy są.
#
# Dlaczego migrate diff, a nie "db push w trybie podglądu": db push takiego
# trybu nie ma (zna tylko --accept-data-loss, --force-reset, --skip-generate).
# migrate diff bazy NIE RUSZA, a przy --script wypisuje gotowy SQL, więc DROP
# COLUMN widać czarno na białym, zanim cokolwiek się wykona.
roznice() {
  node scripts/prisma.mjs migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma \
    "$@"
}

echo "==> Sprawdzam, czym baza różni się od schematu"
if roznice --script --exit-code >"$ROBOCZY/zmiany.sql" 2>"$ROBOCZY/blad"; then
  echo "  ok   baza jest zgodna ze schematem - nie ma czego stosować."
  exit 0
else
  kod=$?
  if [ "$kod" -ne 2 ]; then
    echo "ŹLE: nie udało się porównać schematu z bazą (kod $kod)." >&2
    sed 's/^/      /' "$ROBOCZY/blad" >&2 || true
    exit 1
  fi
fi

echo
echo "Baza RÓŻNI SIĘ od schematu. Po ludzku:"
echo
roznice 2>/dev/null | sed 's/^/  /' || true
echo
echo "A dokładnie tym SQL-em:"
echo
sed 's/^/  /' "$ROBOCZY/zmiany.sql"
echo

# Rzeczy, po których dane nie wracają same. MODIFY jest tu celowo: zmiana typu
# kolumny potrafi obciąć albo wyzerować wartości.
GROZNE="$(grep -inE 'DROP COLUMN|DROP TABLE|DROP PRIMARY KEY|TRUNCATE|RENAME COLUMN|MODIFY COLUMN' "$ROBOCZY/zmiany.sql" || true)"
UNIKATY="$(grep -inE 'ADD UNIQUE|CREATE UNIQUE INDEX' "$ROBOCZY/zmiany.sql" || true)"

if [ -n "$GROZNE" ]; then
  echo "!!! W tych zmianach dane GINĄ. Zwróć uwagę na linie:"
  echo "$GROZNE" | sed 's/^/    /'
  echo
  echo "    Zmiana nazwy pola w schemacie to dla Prismy DROP + ADD, czyli"
  echo "    stara kolumna leci razem z zawartością. Jeśli chcesz przenieść"
  echo "    dane, zrób to ręcznym UPDATE-em PRZED tą komendą."
  echo
fi

if [ -n "$UNIKATY" ]; then
  echo "!!! Dochodzi warunek unikatowości:"
  echo "$UNIKATY" | sed 's/^/    /'
  echo
  echo "    Jeśli w tej kolumnie są już duplikaty, MySQL odrzuci indeks w"
  echo "    połowie zmian - część zastosowana, część nie. Sprawdź duplikaty"
  echo "    zapytaniem GROUP BY ... HAVING COUNT(*) > 1, zanim ruszysz."
  echo
fi

if [ -n "$GROZNE" ]; then
  echo "Aby to wykonać, wpisz nazwę bazy (tak jak w .env, DB_NAME):"
  read -r -p "  nazwa bazy: " potwierdzenie
  # Nazwa bazy z .env, tym samym parserem co reszta projektu.
  spodziewane="$(node -e 'import("./scripts/database.mjs").then((m) => {
    m.loadEnv();
    const url = process.env.DATABASE_URL;
    if (!process.env.DB_NAME && url) {
      console.log(decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) || "kajet");
    } else {
      console.log(process.env.DB_NAME || "kajet");
    }
  })')"
  if [ "$potwierdzenie" != "$spodziewane" ]; then
    echo "Przerwane. Nic nie zmieniono." >&2
    exit 1
  fi
else
  read -r -p "Zastosować te zmiany? (wpisz: tak) " potwierdzenie
  if [ "$potwierdzenie" != "tak" ]; then
    echo "Przerwane. Nic nie zmieniono." >&2
    exit 1
  fi
fi

echo
echo "==> Stosuję schemat (prisma db push)"
if ! npm run db:push; then
  echo >&2
  echo "ŹLE: zmiana schematu NIE PRZESZŁA do końca." >&2
  echo "Baza może być w stanie mieszanym: część zmian zastosowana, część nie." >&2
  echo >&2
  echo "Kopii do przywrócenia nie ma. Co możesz zrobić:" >&2
  echo "  npm run db:diff   <- pokaże, czego jeszcze brakuje bazie" >&2
  echo "  reszta ręcznie, zapytaniami ALTER TABLE" >&2
  exit 1
fi

echo
echo "  ok   schemat zastosowany. Teraz zbuduj i przeładuj:"
echo "       bash scripts/aktualizuj-na-serwerze.sh"
