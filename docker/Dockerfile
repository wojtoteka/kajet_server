# Obraz, w ktorym Kajet uruchamia cudzy kod.
#
# Kazdy program dostaje wlasny kontener zbudowany z tego obrazu, bez sieci,
# z limitem pamieci i liczby procesow, z systemem plikow tylko do odczytu
# i bez zadnych uprawnien. Po zakonczeniu kontener znika razem ze wszystkim,
# co program zdazyl zrobic.
#
# Budowanie:
#   docker build -t kajet-runner:1 docker/
#
# Obraz nie ma sieci w trakcie uruchamiania programu, wiec wszystko, czego
# program moze potrzebowac, musi byc tutaj. Dokladanie jezykow: dopisz pakiet
# nizej i przebuduj obraz, a potem dopisz jezyk w src/lib/code-runner.ts.

FROM debian:bookworm-slim

# Jezyki. Celowo nie ma tu Kotlina, Go, Rusta ani Haskella: kazdy z nich
# dokłada od kilkuset megabajtow do gigabajta. Jesli sa potrzebne, zrob osobny
# obraz i wskaz go w CODE_IMAGE.
#
# Nie ma tu tez matplotliba, i nie chodzi o rozmiar: wynik uruchomienia jedzie
# do przegladarki jako sam tekst, wiec wykresu nie ma jak pokazac. Zapisalby
# PNG do /tmp, ktory znika razem z kontenerem. numpy i pandas zostaja, bo one
# pisza wynikiem na ekran.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-numpy \
        python3-pandas \
        nodejs \
        npm \
        bash \
        gcc \
        g++ \
        libc6-dev \
        php-cli \
        ruby \
        sqlite3 \
        mariadb-server \
        mariadb-client \
        mono-mcs \
        mono-runtime \
        default-jdk-headless \
        ca-certificates \
    && npm install -g tsx@4 \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*

# ---------------------------------------------------------------------------
# MariaDB
#
# Baza to jedyny jezyk na tej liscie, ktory potrzebuje wlasnego serwera. Ten
# serwer musi wstac WEWNATRZ kontenera, przy polowie rdzenia i dziesieciu
# sekundach na wszystko, wiec katalog danych przygotowujemy TUTAJ, przy
# budowaniu obrazu. Inicjowanie go przy kazdym uruchomieniu (mariadb-install-db
# tworzy tabele systemowe od zera) trwa kilkanascie sekund i nie zmiesciloby
# sie w limicie ani razu.
#
# Wlasny plik nastaw zamiast debianowego z dwoch powodow: tamten kaze bazie
# chodzic jako uzytkownik mysql i trzymac dane w /var/lib/mysql, a u nas
# program jest nikim i pisze wylacznie do /tmp. Dziennik InnoDB schodzi z
# domyslnych 96 MB do 8, bo /tmp ma w sumie 64 MB.
COPY kajet-mysql.cnf /etc/mysql/kajet.cnf

RUN set -eu; \
    mariadb-install-db \
        --defaults-file=/etc/mysql/kajet.cnf \
        --basedir=/usr \
        --datadir=/var/lib/mysql-wzor \
        --user=root \
        --auth-root-authentication-method=normal \
        --skip-test-db >/dev/null; \
    echo "CREATE DATABASE IF NOT EXISTS kajet;" | mariadbd \
        --defaults-file=/etc/mysql/kajet.cnf \
        --datadir=/var/lib/mysql-wzor \
        --user=root \
        --bootstrap >/dev/null; \
    chmod -R a+rX /var/lib/mysql-wzor

# Skrypt, ktory podnosi baze i przepuszcza przez nia plik uzytkownika.
# Stoi w obrazie, a nie w linii polecen w code-runner.ts, zeby tamta lista
# jezykow zostala czytelna.
COPY uruchom-mysql.sh /usr/local/bin/uruchom-mysql
RUN chmod 755 /usr/local/bin/uruchom-mysql

# ---------------------------------------------------------------------------

# Katalog, w ktorym lezy program uzytkownika. Podpinany przy uruchomieniu
# tylko do odczytu, wiec program nie podmieni sam siebie w trakcie dzialania.
WORKDIR /kod

# Program chodzi jako nikt. Numer 65534 to w Debianie nobody:nogroup.
# Podajemy go tez przy docker run, bo obraz da sie nadpisac.
USER 65534:65534

# Bez tego czesc narzedzi szuka katalogu domowego roota i wywala sie
# na systemie plikow tylko do odczytu.
#
# Nastaw JVM celowo NIE ma tutaj: i JAVA_TOOL_OPTIONS, i JDK_JAVA_OPTIONS
# wypisuja przy kazdym starcie "Picked up ..." na stderr, a stderr uczen widzi
# na ekranie jako blad wlasnego programu. Nastawy jada w linii polecen,
# w src/lib/code-runner.ts.
ENV HOME=/tmp \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_OPTIONS=--max-old-space-size=192

# Nic nie uruchamiamy domyslnie. Polecenie podaje serwer przy kazdym wywolaniu.
ENTRYPOINT []
CMD ["/bin/true"]
