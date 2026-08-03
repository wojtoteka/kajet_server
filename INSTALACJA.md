# Jak postawić Kajet na serwerze

Poradnik pisany dla serwera, na którym **już coś stoi** — inne kontenery
Dockera, strony, gry. Cel jest taki, żeby Kajet dołożył się do tego, co masz,
i niczego nie przewrócił.

Czas: około pół godziny, licząc czekanie na `npm install` i budowanie obrazu.

---

## Najpierw jedna decyzja: npm czy Docker

Pytałeś, czy może być przez npm. **Tak, i to jest lepszy wybór.** Poniżej
powód, bo nie jest oczywisty.

Kajet uruchamia cudzy kod w kontenerach — po jednym na każdy program. Żeby
tworzyć kontenery, musi umieć rozmawiać z Dockerem, czyli mieć dostęp
do gniazda `/var/run/docker.sock`.

Gdyby **sam Kajet** siedział w kontenerze, musiałbyś podpiąć mu to gniazdo
do środka. A dostęp do gniazda Dockera jest **równoważny prawom roota na całej
maszynie** — każdy, kto je ma, może uruchomić kontener z podpiętym całym
dyskiem serwera. Zbudowaliśmy izolację uruchamiania kodu właśnie po to, żeby
tego uniknąć, więc pakowanie Kajetu do kontenera częściowo by ją cofało.

Dlatego:

| Co | Jak stoi |
| --- | --- |
| Sam Kajet (Next.js) | zwykły proces Node, przez npm, pod systemd |
| Uruchamianie cudzego kodu | osobny kontener Dockera na każdy program |

Docker jest tu narzędziem do izolacji cudzego kodu, a nie sposobem
na uruchomienie Kajetu.

Jeśli mimo to chcesz Kajet w kontenerze — da się, opis jest na końcu, razem
z tym, na co uważać.

---

## Czy to nie wywali moich innych kontenerów

Nie, i to jest wbudowane w sposób działania. Po kolei, czego się boisz:

**Sieć.** Kontenery Kajetu dostają `--network none`, czyli **nie mają sieci
w ogóle**. Nie widzą Twojego Minecrafta, nie widzą bazy, nie widzą internetu.
Nie dokładają się do żadnej sieci Dockera, więc nie mogą kolidować z Twoimi.

**Porty.** Kontenery Kajetu nie wystawiają żadnego portu. Sam Kajet słucha
na `127.0.0.1:9081`, czyli tylko lokalnie — z zewnątrz wpuszcza go nginx.
Jeśli 9081 jest u Ciebie zajęty, zmień `PORT` w `.env` i w konfiguracji nginx.

**Pamięć i procesor.** Każdy kontener ma twardy limit (domyślnie 256 MB
i pół rdzenia), a na całą maszynę wolno naraz liczyć `CODE_MAX_CONCURRENT`
programów (domyślnie 3). Czyli w szczycie Kajet zabierze najwyżej
**3 × 256 MB = 768 MB** i 1,5 rdzenia. Policz to pod swój serwer i zmniejsz,
jeśli masz mało pamięci — to najważniejsza liczba w tym pliku.

**Nazwy.** Kontenery nazywają się `kajet-kod-<losowe>`, więc nie wejdą
w drogę Twoim. Znikają same po zakończeniu (`--rm`).

**Miejsce na dysku.** Obraz `kajet-runner` waży około 700 MB, raz. Kontenery
nie zostawiają po sobie nic.

Jedno ostrzeżenie, uczciwie: Kajet i Twoje kontenery **dzielą ten sam demon
Dockera i to samo jądro systemu**. Jeśli demon Dockera padnie, padnie
wszystkim naraz. To jest cena za to, że nie stawiasz drugiej maszyny.

---

## Czego potrzebujesz

- Linux z systemd (Debian, Ubuntu, cokolwiek nowego)
- Node.js 20 lub nowszy
- MySQL 8 albo MariaDB 10.6+
- Docker (masz, skoro pytasz o inne kontenery)
- nginx
- domena `kajet.wojtoteka.ovh` wskazująca na ten serwer

Sprawdzenie, czy wszystko jest:

```bash
node --version     # v20+
docker --version
mysql --version
nginx -v
```

---

## 1. Skopiuj projekt na serwer

**Uwaga na dysk.** Katalog `D:\Inne\kajet_server` leży na dysku w systemie
exFAT, a exFAT nie zna dowiązań symbolicznych. Next.js sprawdza je przy
budowaniu i wywala się błędem `EISDIR: illegal operation on a directory,
readlink`. **Na serwerze z Linuksem tego problemu nie ma**, ale nie próbuj
budować projektu na tym dysku w Windowsie.

```bash
# z Windowsa, pomijając to, czego nie ma po co wysyłać
scp -r D:\Inne\kajet_server uzytkownik@serwer:/opt/kajet
```

Albo przez repozytorium, jeśli wolisz. Na serwerze:

```bash
cd /opt/kajet
rm -rf node_modules .next    # gdyby przyjechały razem z resztą
```

---

## 2. Osobny użytkownik systemu

Kajet nie ma chodzić jako root ani jako Ty.

```bash
sudo useradd --system --home /opt/kajet --shell /usr/sbin/nologin kajet
sudo chown -R kajet:kajet /opt/kajet
```

Ten użytkownik musi umieć rozmawiać z Dockerem:

```bash
sudo usermod -aG docker kajet
```

> Świadoma decyzja: to daje użytkownikowi `kajet` prawa równoważne rootowi
> na maszynie. Inaczej nie da się tworzyć kontenerów. Jeśli to dla Ciebie
> za dużo, zostaw `CODE_ENABLED=false` — cała reszta Kajetu działa bez tego,
> a Python i tak liczy się na tablecie bez internetu.

---

## 3. Baza danych

```bash
sudo mysql
```

```sql
CREATE DATABASE kajet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kajet'@'localhost' IDENTIFIED BY 'tu-wpisz-dlugie-haslo';
GRANT ALL PRIVILEGES ON kajet.* TO 'kajet'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

`utf8mb4` jest obowiązkowe — bez tego polskie znaki w notatkach się posypią.

---

## 4. Ustawienia

```bash
cd /opt/kajet
sudo -u kajet cp .env.example .env
sudo -u kajet nano .env
```

Wypełnij co najmniej to:

```bash
NEXT_PUBLIC_ADRES="https://kajet.wojtoteka.ovh"
AUTH_URL="https://kajet.wojtoteka.ovh"
AUTH_TRUST_HOST=true
PORT=9081

# openssl rand -base64 32
AUTH_SECRET="tu-wklej-wynik"

DB_HOST="127.0.0.1"
DB_PORT=3306
DB_USER="kajet"
DB_PASSWORD="tu-wpisz-dlugie-haslo"
DB_BAZA="kajet"

KATALOG_PLIKOW="/opt/kajet/dane/pliki"
```

Klucz podpisujący:

```bash
openssl rand -base64 32
```

Zmiana `AUTH_SECRET` później wylogowuje wszystkich, więc ustaw go raz.

Plik `.env` ma być czytelny tylko dla Kajetu — jest w nim hasło do bazy:

```bash
sudo chown kajet:kajet .env
sudo chmod 600 .env
```

### Poczta

Port 587 to STARTTLS: połączenie zaczyna się jawnie i szyfruje po komendzie.
Dlatego `SMTP_SECURE=false`. Wartość `true` jest tylko dla portu 465.

```bash
SMTP_HOST="poczta.twojhosting.pl"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="kajet@wojtoteka.ovh"
SMTP_PASSWORD="haslo"
SMTP_FROM="Kajet <kajet@wojtoteka.ovh>"
```

Bez SMTP wszystko działa poza wysyłką maili — odnośniki zaproszeń
i udostępnień kopiujesz wtedy ze strony ręcznie.

### Google

Konsola Google Cloud → identyfikator klienta typu „aplikacja sieciowa".
Adres powrotu musi się zgadzać **co do znaku**:

```
https://kajet.wojtoteka.ovh/api/auth/callback/google
```

```bash
AUTH_GOOGLE_ID="...apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="..."
```

---

## 5. Instalacja i baza

```bash
cd /opt/kajet
sudo -u kajet npm ci --omit=dev || sudo -u kajet npm install
sudo -u kajet npx prisma generate
sudo -u kajet npx prisma db push     # zakłada tabele
sudo -u kajet npm run build
```

`db push` przy pustej bazie po prostu zakłada tabele. Przy późniejszych
zmianach schematu też go używasz.

---

## 6. Obraz do uruchamiania kodu

Ten krok możesz pominąć i wrócić do niego później.

```bash
cd /opt/kajet
sudo docker build -t kajet-runner:1 docker/
```

Trwa kilka minut i zajmuje około 700 MB. Sprawdzenie:

```bash
sudo docker image inspect kajet-runner:1 >/dev/null && echo "jest"
```

Potem w `.env`:

```bash
CODE_ENABLED=true
CODE_MAX_CONCURRENT=3      # policz: to razy 256 MB to szczyt zużycia
CODE_MEMORY_MB=256
```

Szybki test, że izolacja działa — ten program **nie ma prawa** się połączyć:

```bash
sudo -u kajet docker run --rm --network none kajet-runner:1 \
  python3 -c "import urllib.request; urllib.request.urlopen('https://example.com')"
```

Ma się wywalić błędem sieci. Jeśli się połączy, coś jest nie tak
i nie włączaj uruchamiania kodu.

---

## 7. Usługa systemd

```bash
sudo nano /etc/systemd/system/kajet.service
```

```ini
[Unit]
Description=Kajet, serwer notatek
After=network.target mysql.service docker.service
Wants=mysql.service

[Service]
Type=simple
User=kajet
Group=kajet
WorkingDirectory=/opt/kajet
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

# Kajet ma sięgać tylko do siebie.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/kajet/dane /opt/kajet/.next

# Zapora na wypadek wycieku pamięci: przy przekroczeniu usługa
# jest restartowana zamiast dusić resztę serwera.
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

> `ProtectSystem=strict` sprawia, że Kajet nie zapisze niczego poza
> `ReadWritePaths`. Gdyby kiedyś trzeba było dołożyć katalog, dopisz go tam.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kajet
sudo systemctl status kajet
```

Podgląd tego, co się dzieje:

```bash
sudo journalctl -u kajet -f
```

---

## 8. Nginx

```bash
sudo nano /etc/nginx/sites-available/kajet.wojtoteka.ovh
```

```nginx
server {
    listen 80;
    server_name kajet.wojtoteka.ovh;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kajet.wojtoteka.ovh;

    ssl_certificate     /etc/letsencrypt/live/kajet.wojtoteka.ovh/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kajet.wojtoteka.ovh/privkey.pem;

    # Notatka odręczna z gęstym pismem waży kilka megabajtów,
    # a domyślny limit nginx to jeden.
    client_max_body_size 32M;

    location / {
        proxy_pass http://127.0.0.1:9081;
        proxy_http_version 1.1;

        # Auth.js buduje z tych nagłówków adres powrotu z Google.
        # Bez nich logowanie wraca na localhost i nie działa.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Pod edycję na żywo, gdy dojdzie.
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Uruchomienie programu może potrwać, a domyślne 60 s bywa za mało
        # przy kompilacji C++.
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kajet.wojtoteka.ovh /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Certyfikat, jeśli jeszcze go nie masz:

```bash
sudo certbot --nginx -d kajet.wojtoteka.ovh
```

---

## 9. Pierwsze konto

Do panelu administratora trzeba już być administratorem, więc pierwszego
robi się skryptem.

```bash
cd /opt/kajet
sudo -u kajet npm run admin -- twoj@adres.pl
```

Przy pustej bazie skrypt wypisze **pierwszy kod zaproszenia**. Wejdź na
`https://kajet.wojtoteka.ovh/rejestracja`, załóż na niego konto tym samym
adresem, a potem uruchom skrypt jeszcze raz:

```bash
sudo -u kajet npm run admin -- twoj@adres.pl
```

Teraz masz dostęp do `/admin`.

---

## 10. Sprawdzenie, że stoi

1. `https://kajet.wojtoteka.ovh` — strona powitalna
2. Zaloguj się, wejdź na `/admin`
3. W przeglądzie sprawdź wiersz **Uruchamianie kodu** — powie wprost,
   czy Docker i obraz są na miejscu
4. Wydaj kod zaproszenia i sprawdź, czy mail doszedł
5. Na tablecie: Ustawienia → Konto w chmurze → adres serwera i logowanie
6. Napisz notatkę i sprawdź, czy pojawiła się w `/biblioteka`

---

## Aktualizacja

```bash
cd /opt/kajet
sudo systemctl stop kajet
# wgraj nowe pliki
sudo -u kajet npm install
sudo -u kajet npx prisma generate
sudo -u kajet npx prisma db push
sudo -u kajet npm run build
sudo systemctl start kajet
```

Obraz `kajet-runner` przebudowujesz tylko wtedy, gdy zmienił się
`docker/Dockerfile`.

---

## Kopia zapasowa

Do odtworzenia wszystkiego potrzebne są trzy rzeczy:

```bash
# baza
mysqldump -u kajet -p kajet | gzip > kajet-baza-$(date +%F).sql.gz

# zdjęcia i rysunki
tar czf kajet-pliki-$(date +%F).tar.gz -C /opt/kajet dane/

# ustawienia (są w nim hasła, trzymaj bezpiecznie)
cp /opt/kajet/.env kajet-env-$(date +%F)
```

Notatki i tak leżą na tablecie, więc utrata serwera nie oznacza utraty pracy.
Chmura jest kopią, nie właścicielem.

---

## Kiedy coś nie działa

**`EADDRINUSE: address already in use 9081`**
Port zajęty przez coś innego. `sudo ss -tlnp | grep 9081` pokaże co.
Zmień `PORT` w `.env` i w nginx.

**Logowanie przez Google wraca na localhost**
Brakuje nagłówków `X-Forwarded-*` w nginx albo `AUTH_URL` nie zgadza się
z prawdziwym adresem. Sprawdź też, czy adres powrotu w konsoli Google
to dokładnie `https://kajet.wojtoteka.ovh/api/auth/callback/google`.

**`Can't reach database server at 127.0.0.1:3306`**
MySQL nie chodzi albo `DB_PASSWORD`, `DB_USER` czy `DB_HOST` się nie zgadzają.
`sudo systemctl status mysql`.

**`permission denied ... docker.sock`**
Użytkownik `kajet` nie jest w grupie docker. Dodaj i zrestartuj usługę
(sama grupa nie wystarczy, proces musi ruszyć od nowa):

```bash
sudo usermod -aG docker kajet
sudo systemctl restart kajet
```

**`Unable to find image kajet-runner:1`**
Obraz niezbudowany: `sudo docker build -t kajet-runner:1 docker/`

**Program zawsze zwraca „Serwer liczy teraz 3 programów naraz"**
Któryś kontener został i nie zwolnił miejsca. Sprawdź i posprzątaj:

```bash
sudo docker ps --filter "name=kajet-kod-"
sudo docker rm -f $(sudo docker ps -aq --filter "name=kajet-kod-")
sudo systemctl restart kajet
```

**Zdjęcia nie chcą się wysłać z tabletu**
`client_max_body_size` w nginx za małe albo `MAKS_PLIK_BAJTOW` w `.env`.

**Notatka odręczna nie dochodzi, a mniejsze dochodzą**
To samo co wyżej — gęste pismo potrafi ważyć kilka megabajtów.

---

## Gdybyś jednak chciał Kajet w kontenerze

Da się, ale przeczytaj najpierw, co z tego wynika.

Żeby Kajet mógł tworzyć kontenery do uruchamiania kodu, musisz podpiąć mu
gniazdo Dockera:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**To daje kontenerowi Kajetu prawa równoważne rootowi na całej maszynie**,
razem ze wszystkim, co na niej stoi. Jeśli ktoś znajdzie dziurę w Kajecie,
ma Twój serwer, a nie tylko Kajet.

Jeśli mimo to chcesz kontener, są dwa rozsądne warianty:

1. **Kajet w kontenerze, uruchamianie kodu wyłączone** (`CODE_ENABLED=false`).
   Wtedy gniazdo Dockera nie jest potrzebne i wszystko jest w porządku.
   Python i tak liczy się na tablecie bez internetu.

2. **Kajet w kontenerze plus pośrednik do Dockera**, na przykład
   `docker-socket-proxy`, przepuszczający tylko tworzenie kontenerów.
   Zmniejsza to szkody, ale nie znosi problemu.

Wariant z tego poradnika, czyli Kajet przez npm pod systemd, jest prostszy
i bezpieczniejszy. Dlatego jest pierwszy.
