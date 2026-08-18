#!/bin/bash
# Uruchomienie pliku .sql na prawdziwej MariaDB, wewnatrz kontenera.
#
# Roznica wobec sqlite3 jest cala rzecza: szkola uczy MySQL-a, a tam dziala
# SHOW TABLES, DESCRIBE, NOW(), AUTO_INCREMENT i ENGINE=InnoDB - czyli
# dokladnie to, czego SQLite nie zna.
#
# Katalog danych jest gotowy w obrazie (/var/lib/mysql-wzor). Tutaj tylko go
# kopiujemy do /tmp, bo baza musi miec gdzie pisac, a rootfs jest tylko do
# odczytu. Kopia idzie do tmpfs, wiec jest szybka i znika z kontenerem.

set -u

PLIK="${1:-}"
if [ -z "$PLIK" ]; then
  echo "Brak pliku z zapytaniami." >&2
  exit 2
fi

DANE=/tmp/db
GNIAZDO=/tmp/mysql.sock
DZIENNIK=/tmp/mariadbd.log

cp -r /var/lib/mysql-wzor "$DANE" 2>/dev/null || {
  echo "Nie udalo sie przygotowac katalogu bazy." >&2
  exit 1
}

mariadbd \
  --defaults-file=/etc/mysql/kajet.cnf \
  --datadir="$DANE" \
  --socket="$GNIAZDO" \
  --pid-file=/tmp/mariadbd.pid \
  >"$DZIENNIK" 2>&1 &

# Czekamy na gniazdo, nie na staly czas. Baza wstaje rozmaicie szybko
# zaleznie od tego, ile maszyny akurat zostalo, a limit czasu na cale
# uruchomienie pilnuje i tak serwer Kajetu.
for _ in $(seq 1 60); do
  [ -S "$GNIAZDO" ] && break
  sleep 0.1
done

if [ ! -S "$GNIAZDO" ]; then
  echo "Baza nie wstala w wyznaczonym czasie." >&2
  # Wlasne narzekanie MariaDB idzie na koniec: bez niego nie da sie zgadnac,
  # czy zabraklo pamieci, czy miejsca w /tmp.
  tail -n 20 "$DZIENNIK" >&2
  exit 1
fi

# --table daje ramki wokol wyniku, a -vv „Query OK, 2 rows affected" pod kazdym
# poleceniem - tak samo jak klient mysql w szkole.
#
# To -vv jest wazniejsze, niz wyglada. Klient czytajacy plik zamiast klawiatury
# milczy przy CREATE TABLE i INSERT, bo one nie zwracaja zadnego wyniku. Uczen
# pisze wiec caly skrypt zakladajacy baze, klika „Uruchom" i widzi pustke - ani
# bledu, ani potwierdzenia, ze cokolwiek sie stalo.
#
# „Bye" na koncu wycinamy: to pozegnanie klienta, ktore ma sens przy pracy
# z klawiatury, a tutaj jest samym smieciem. Kod wyjscia bierzemy z PIPESTATUS,
# bo po potoku $? nalezaloby juz do seda.
mariadb --defaults-file=/etc/mysql/kajet.cnf --socket="$GNIAZDO" --table -vv kajet < "$PLIK" \
  | sed '/^Bye$/d'
KOD=${PIPESTATUS[0]}

# Bazy nie zatrzymujemy: skrypt jest pierwszym procesem w kontenerze, wiec
# jego koniec i tak konczy kontener, a czekanie na czyste zamkniecie zabiera
# sekundy z limitu.
exit $KOD
