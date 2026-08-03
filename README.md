# Kajet, serwer

Konta, notatki w chmurze, udostępnianie i panel administratora.
Aplikacja na tablet łączy się z tym serwerem przez API opisane niżej.

Napisane w Next.js 15 (App Router) i TypeScript, baza MySQL przez Prismę,
logowanie przez Auth.js. Serwer nasłuchuje na `localhost:9081`,
a nginx przekazuje na niego ruch z `kajet.wojtoteka.ovh`.

## Uwaga o katalogu D:

Ten katalog leży na dysku wymiennym sformatowanym w exFAT. exFAT nie zna
dowiązań symbolicznych, a Next.js sprawdza je przy budowaniu i wywala się
błędem `EISDIR: illegal operation on a directory, readlink`.

Kod jest poprawny i buduje się bez uwag — sprawdzone na NTFS.
**Zanim uruchomisz `npm install` i `npm run build`, przenieś projekt na dysk
z systemem NTFS albo od razu na serwer z Linuksem.** Na docelowym serwerze
problemu nie ma, bo ext4 obsługuje dowiązania.

## Uruchomienie

```bash
cp .env.example .env      # i wypełnij, opis każdego pola jest w pliku
npm install
npx prisma db push        # zakłada tabele w pustej bazie
npm run build
npm start                 # nasłuchuje na porcie 9081
```

Pierwszego administratora nadaje się skryptem, bo do panelu trzeba już nim być:

```bash
npm run admin -- twoj@adres.pl
```

Przy pustej bazie skrypt sam wyda pierwszy kod zaproszenia i wypisze go
na ekranie. Zakładasz na niego konto na `/register`, uruchamiasz skrypt
jeszcze raz i masz dostęp do `/admin`.

## Ustawienia

Wszystko siedzi w `.env`, opisane po kolei w `.env.example`. Rzeczy,
o które najłatwiej się potknąć:

**Poczta.** Port 587 to STARTTLS: połączenie zaczyna się jawnie i szyfruje
dopiero po komendzie. Dlatego `SMTP_SECURE=false`. Wartość `true` jest dla
portu 465. Bez SMTP serwer nadal działa, tylko nie wysyła zaproszeń,
potwierdzeń i powiadomień o udostępnieniu — odnośniki kopiuje się wtedy
ze strony ręcznie.

**Google.** W konsoli Google Cloud identyfikator klienta typu „aplikacja
sieciowa”, a jako adres powrotu dokładnie:
`https://kajet.wojtoteka.ovh/api/auth/callback/google`

**Klucz sesji.** `AUTH_SECRET` wygeneruj sobie: `openssl rand -base64 32`.
Zmiana tego klucza wylogowuje wszystkich.

## Nginx

```nginx
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

        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name kajet.wojtoteka.ovh;
    return 301 https://$host$request_uri;
}
```

## Co jest zrobione

- Konta: rejestracja tylko na kod zaproszenia, logowanie hasłem i przez Google,
  potwierdzanie adresu (`/confirm`), odzyskiwanie hasła (`/password`).
- Ustawienia konta (`/account`): profil, wylogowanie, własny login, hasło,
  wydawanie i unieważnianie tokenów urządzeń (także wszystkich naraz).
- Tokeny dla aplikacji: każde urządzenie dostaje własny, unieważnialny osobno.
- Panel administratora: wydawanie kodów (ręcznych i w postaci gotowego
  odnośnika), limity miejsca na stałe i na czas określony, limit zerowy
  jako brak limitu, blokowanie kont, zmiana loginów, nadawanie uprawnień,
  dziennik czynności.
- Limity miejsca liczone przy każdym zapisie, z przeliczeniem od nowa
  na żądanie administratora.
- API dla aplikacji: logowanie, stan konta, synchronizacja notatek
  z wykrywaniem rozbieżności, wysyłanie i pobieranie załączników,
  uruchamianie kodu.
- Podgląd notatki w przeglądarce: pismo odręczne rysowane jako SVG wprost
  z zapisanych punktów, mapy myśli, notatki tekstowe ze zdjęciami.
- Udostępnianie: odnośnikiem (działa bez konta) albo imiennie na adres e-mail,
  do czytania albo do poprawiania, z terminem ważności i cofaniem.

## Format notatki

Opis JSON-u notatki (`FORMAT.md`) należy do repozytorium aplikacji na tablet
(`C:\Users\Wojte\AndroidStudioProjects\Notatnik\FORMAT.md`). To jest źródło
prawdy; serwer nie trzyma już kopii w `apka/`. Do odczytu na stronie służy
lustro typów w `src/lib/document.ts` (m.in. czcionki mapy myśli:
`heading` | `body` | `mono`). Zapis z tabletu i przyszły zapis z WWW musi iść
przez `src/lib/note-write.ts` (wersja, hash, konflikt, limit miejsca).

## Czego jeszcze nie ma

- Pełnego edytora w przeglądarce: notatki tekstowe (Markdown) da się już tworzyć
  i poprawiać na stronie (`/note/new`, edycja na `/note/<id>`); odręczne i mapy
  myśli zostają tylko do odczytu. Udostępnienie „do poprawiania" dla gościa
  nadal nie ma formularza edycji.
- Edycji na żywo. Tabela `LiveChange` czeka, gniazda WebSocket jeszcze nie ma.
- Folderów w przeglądarce — model jest, lista jest płaska.
- Kosza i trwałego kasowania po stronie strony.

## Uruchamianie kodu

`/api/v1/code` uruchamia kod na serwerze i zastępuje `emkc.org/api/v2/piston`.
**Każdy program dostaje własny kontener Dockera** i tam żyje przez chwilę,
po czym kontener znika razem ze wszystkim, co program zdążył zrobić.

Uruchomienie:

```bash
docker build -t kajet-runner:1 docker/
# w .env:
CODE_ENABLED=true
```

Użytkownik, na którym chodzi Kajet, musi należeć do grupy `docker`.
**Bez Dockera serwer odmawia uruchomienia i mówi dlaczego** — domyślnie
`CODE_ENABLED=false`. To świadoma decyzja: lepiej, żeby ta jedna rzecz
nie działała, niż żeby działała bez izolacji na maszynie w internecie.

### Co odcina kontener

| Zagrożenie | Zapora |
| --- | --- |
| Wysłanie danych na zewnątrz, atak na cudzy serwer z Twojego IP | `--network none` |
| Odczyt `.env`, notatek innych osób, kluczy SSH | tylko własny plik, podpięty `:ro` |
| Zapis do plików serwera, cron, `.bashrc` | `--read-only`, zapis wyłącznie w `/tmp` (tmpfs) |
| Podniesienie uprawnień | `--cap-drop ALL`, `no-new-privileges`, `--user 65534` |
| Bomba forkowa | `--pids-limit` |
| Zjedzenie pamięci i procesora | `--memory`, `--memory-swap`, `--cpus` |
| Proces w tle przeżywający limit czasu | zabijamy **kontener**, nie klienta Dockera |

`/tmp` dostaje `noexec` dla języków tłumaczonych. Języki kompilowane (C, C++)
muszą uruchomić plik, który dopiero co skompilowały, więc dla nich `noexec`
jest zdejmowane — pozostałe zapory zostają.

### Limity na konto

Jedno konto może uruchomić kod `CODE_RUNS_PER_MINUTE` razy na minutę (domyślnie
12). Licznik siedzi w pamięci procesu — to hamulec na kogoś, kto trzyma palec
na przycisku, a nie zapora bezpieczeństwa; zaporą jest kontener.

Administrator może odebrać uruchamianie pojedynczemu kontu w `/admin/accounts`.
Pisanie i zapisywanie kodu działa dalej.

### Języki

Wypisane w `src/lib/code-runner.ts`, zainstalowane w `docker/Dockerfile`:
Python, JavaScript, TypeScript, powłoka, C, C++, PHP, Ruby, SQL.

Celowo nie ma Javy, Kotlina, Go, Rusta ani C# — każdy dokłada od kilkuset MB
do kilku GB do obrazu. Jeśli są potrzebne, zbuduj własny obraz i wskaż go
w `CODE_IMAGE`.

## API dla aplikacji

Wszystko pod `/api/v1`. Poza logowaniem każde zapytanie niesie nagłówek
`Authorization: Bearer <token>`. Odpowiedzi błędu mają postać
`{ "error": "kod-dla-programu", "message": "zdanie dla człowieka" }`.

| Metoda i adres | Do czego |
| --- | --- |
| `POST /api/v1/signin` | Adres i hasło w zamian za token urządzenia |
| `POST /api/v1/signin/device` | Start logowania z aplikacji (Google/hasło na WWW); zwraca `code` i `verificationUri` |
| `GET /api/v1/signin/device?code=` | Poll: `pending` (202) albo gotowy token (jak signin) |
| `GET /api/v1/account` | Kim jestem, ile mam miejsca |
| `GET /api/v1/notes?since=<ms>&afterId=<id>` | Co się zmieniło od ostatniej synchronizacji |
| `PUT /api/v1/notes` | Wysłanie notatki; przy rozbieżności odpowiada 200 ze `status: "conflict"` |
| `GET /api/v1/notes/<id>/attachments` | Spis załączników ze skrótami |
| `GET /api/v1/notes/<id>/attachments?name=<nazwa>` | Pobranie jednego pliku |
| `POST /api/v1/notes/<id>/attachments` | Wysłanie pliku (formularz: `file`, `name`) |
| `DELETE /api/v1/notes/<id>/attachments?name=<nazwa>` | Skasowanie pliku |
| `GET /api/v1/code` | Spis języków, które ten serwer umie uruchomić |
| `POST /api/v1/code` | Uruchomienie kodu (`language`, `code`, `input`; akceptuje też `stdin`) |

Konto założone przez Google nie ma hasła, więc `POST /api/v1/signin` na nim
nie zadziała. Aplikacja loguje się wtedy przez `POST/GET /api/v1/signin/device`
(otwiera `/signin/device` w przeglądarce w aplikacji — Google lub hasło —
i odbiera token po zatwierdzeniu). Awaryjnie nadal działa wklejenie tokenu
ze strony `/account`.

Parametr `withContent=no` przy `GET /api/v1/notes` zwraca same nagłówki
bez treści notatek. Przydaje się, gdy chcesz tylko sprawdzić, co się zmieniło,
bez ściągania kilku megabajtów pisma.

Stronicowanie synchronizacji stoi na kursorze `(updatedAt, id)`. Odpowiedź
niesie `upTo` (czas ostatniej notatki w milisekundach), `upToId` (jej
identyfikator) oraz `hasMore`. Kolejne pytanie powinno wysłać poprzednie
`upTo` jako `since` i `upToId` jako `afterId`. Samo `since` bez `afterId`
działa jak dawniej (zgodność wstecz), ale przy wielu notatkach z tym samym
czasem może pominąć część strony — klient powinien zawsze przekazywać
`afterId`, gdy je dostał. API synchronizuje tylko `HANDWRITTEN`, `TEXT` i
`MINDMAP`; notatki `CODE` zostają po stronie serwera WWW.

Synchronizacja stoi na numerze wersji. Każdy zapis podbija go o jeden.
Tablet wysyła wersję, którą miał przed zmianą; gdy na serwerze jest inna,
serwer nie nadpisuje niczyjej pracy, tylko odpowiada `200` ze
`status: "conflict"` i oddaje swoją wersję, a aplikacja zapisuje swoją obok.
(Celowo nie ma tu `409`: tablet traktuje każdy status spoza 2xx jako twardy
błąd, zanim zajrzy do treści.)
