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
# nizej i przebuduj obraz, a potem dopisz jezyk w src/lib/uruchamianie-kodu.ts.

FROM debian:bookworm-slim

# Jezyki. Celowo nie ma tu Javy, Kotlina, Go, Rusta ani C#: kazdy z nich
# dokłada od kilkuset megabajtow do kilku gigabajtow. Jesli sa potrzebne,
# zrob osobny obraz i wskaz go w KOD_OBRAZ.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        nodejs \
        npm \
        bash \
        gcc \
        g++ \
        libc6-dev \
        php-cli \
        ruby \
        sqlite3 \
        ca-certificates \
    && npm install -g tsx@4 \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*

# Katalog, w ktorym lezy program uzytkownika. Podpinany przy uruchomieniu
# tylko do odczytu, wiec program nie podmieni sam siebie w trakcie dzialania.
WORKDIR /kod

# Program chodzi jako nikt. Numer 65534 to w Debianie nobody:nogroup.
# Podajemy go tez przy docker run, bo obraz da sie nadpisac.
USER 65534:65534

# Bez tego czesc narzedzi szuka katalogu domowego roota i wywala sie
# na systemie plikow tylko do odczytu.
ENV HOME=/tmp \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_OPTIONS=--max-old-space-size=192

# Nic nie uruchamiamy domyslnie. Polecenie podaje serwer przy kazdym wywolaniu.
ENTRYPOINT []
CMD ["/bin/true"]
