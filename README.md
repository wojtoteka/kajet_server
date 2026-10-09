# Kajet - serwer

Chmura dla notatnika **Kajet**: konta, synchronizacja notatek z tabletem, udostępnianie
linkiem, asystent AI i uruchamianie kodu w kontenerze. Napisane w Next.js 15 (App Router,
React 19, TypeScript), z MySQL/MariaDB przez Prismę.

Aplikacja na Androida, która się z tym serwerem synchronizuje, leży w repo
[`kajet_apk`](https://github.com/Wojtoteka/kajet_apk).

---

## Co to robi

**Konta i sesje.** Rejestracja e-mailem z potwierdzeniem, logowanie hasłem albo przez Google
(NextAuth v5 + adapter Prismy). Osobna ścieżka logowania dla urządzenia - tablet dostaje
własny token, więc telefon nie wylogowuje tabletu.

**Notatki w chmurze.** Prawda o treści notatki to jeden dokument JSON - dokładnie ten sam,
który leży w pliku `content.json` w katalogu notatki na tablecie. Baza trzyma ten dokument
plus to, czego w nim nie ma: właściciela, zajęte miejsce i listę udostępnień. Dzięki temu
synchronizacja jest porównaniem dwóch dokumentów, a nie tłumaczeniem modelu na model.

**Rodzaje notatek.** Tekstowa (Markdown z tabelami, obrazkami i skalowaniem szerokości),
odręczna, mapa myśli, notatka z kodem, podgląd HTML. Każda ma edytor po stronie www, więc
notatka zrobiona na tablecie jest edytowalna w przeglądarce i odwrotnie.

**Udostępnianie.** Link `/n/<token>` do notatki albo całego folderu (z podfolderami) -
do podglądu albo do edycji, z załącznikami i opcjonalnym hasłem. Zwykły link otwiera się
tylko na czas oglądania i nigdzie się nie zapisuje. Zaproszenie na adres e-mail trafia do
biblioteki odbiorcy („Udostępnione mi" - na stronie i w aplikacji) dopiero wtedy, gdy
osoba zalogowana tym adresem sama otworzy odnośnik; skaner linków w poczcie niczego nie
przyjmie. Kto ma prawo edycji folderu, dodaje, zmienia i usuwa w nim notatki i podfoldery -
wszystko należy do właściciela folderu, liczy się do jego miejsca, a usunięte trafia do
jego kosza. Na Androidzie z zainstalowanym Kajetem odnośnik otwiera się od razu w aplikacji.

**Edycja na żywo.** Kilka osób (i urządzeń) w jednej notatce naraz - tekst, pismo odręczne
i mapa myśli, na stronie i w aplikacji. Zmiany idą małymi deltami, a nie całym dokumentem;
gdy notatki nikt inny nie ma otwartej, przez sieć nie idzie nic poza krótkim „ping" co 20 s.
Zmiany zrobione bez sieci scalają się po powrocie z tym, co w tym czasie zrobili inni:
tekst do poziomu słów (prawdziwy konflikt w tym samym miejscu zostawia obie wersje, jedna
pod drugą), kreski zawsze się sumują, a przy tym samym węźle mapy wygrywa późniejsza zmiana.

**KajetAI.** Asystent oparty o Gemini (`@google/genai`), który edytuje notatkę narzędziami
(a nie przez podmianę całego tekstu): zna markdown Kajetu, limity dzienne, zgodę użytkownika
na przetwarzanie treści i historię swoich zmian, żeby dało się je cofnąć.

**Uruchamianie kodu.** Notatka z kodem może zostać wykonana w izolowanym kontenerze Dockera,
z limitem czasu i liczby uruchomień na minutę. Domyślnie wyłączone (`CODE_ENABLED=false`).

**Panel administratora.** Konta i blokady, limity miejsca, wydania aplikacji na Androida
(upload APK + notatki wydania), zgłoszenia awarii z tabletu, log akcji, limity KajetAI.

**Dwujęzyczność.** Cały interfejs idzie przez słownik (`src/lib/i18n.ts`) - polski i angielski,
bez tekstów zaszytych w komponentach.

---

## Stos

| Warstwa | Technologia |
|---|---|
| Aplikacja | Next.js 15 (App Router), React 19, Server Actions |
| Język | TypeScript, walidacja wejścia przez Zod |
| Baza | MySQL / MariaDB + Prisma 6 |
| Sesje | NextAuth v5 (credentials + Google) |
| AI | Google Gemini (`@google/genai`) |
| Poczta | Nodemailer (SMTP) |
| Testy | Vitest |
| Uruchamianie kodu | Docker (osobny obraz `kajet-runner`) |

## Układ katalogów

```
src/app/          strony i API (App Router)
  api/v1/         REST dla aplikacji na Androida: notatki, foldery, sync, konto, kod, awarie
  admin/          panel administratora
  api/v1/live/    edycja na żywo: strumień zmian (SSE) i wysyłanie delt
  api/v1/shared/  „udostępnione mi", otwieranie odnośników, praca w udostępnionym folderze
  n/[token]/      udostępniona notatka albo folder
  library/        biblioteka notatek zalogowanego użytkownika
src/components/   edytory (tekst, odręczne, mapa myśli, kod) i reszta UI
src/lib/          logika: auth, synchronizacja, limity, markdown, KajetAI, wydania APK
  live/           scalanie i delty (te same zasady co w aplikacji - wspólne przypadki
                  testowe w live-vectors.json), szyna zmian, dziennik LiveChange
prisma/           schemat bazy
scripts/          narzędzia serwisowe (migracje, wdrożenie, kontrola stanu, konta administratorów)
docker/           obraz do uruchamiania kodu + konfiguracja MySQL
```

## Uruchomienie

```bash
cp .env.example .env     # uzupełnij bazę, AUTH_SECRET, SMTP
npm install
npm run db:push          # schemat do bazy
npm run dev              # http://localhost:9081
```

Przydatne skrypty:

```bash
npm test          # Vitest
npm run typecheck # tsc --noEmit
npm run build     # generuje klienta Prismy i buduje Next.js
npm run konta     # konta administratorów - patrz niżej (panel tego nie robi)
npm run sprawdz   # kontrola stanu działającego serwera
```

Wszystkie ustawienia są w `.env` - jego wzór z opisem każdej zmiennej leży w
[`.env.example`](.env.example). Prawdziwy `.env`, katalog `data/` z notatkami użytkowników
i zrzuty bazy nigdy nie trafiają do repozytorium.

## Wdrożenie edycji na żywo i odnośników do aplikacji

**Baza.** Po aktualizacji kodu raz, ręcznie, na serwerze:

```bash
npm run db:apply
```

Zmiana tylko dokłada: kolumny `folderId`, `acceptedById` i `acceptedAt` w `Share`
(`noteId` może być teraz puste - udostępnienie folderu), `version` i `clientId`
w `LiveChange` oraz indeksy. Nic nie jest kasowane.

Najpewniej całość robi `bash scripts/aktualizuj-na-serwerze.sh`: zanim zbuduje, sprawdza
bazę i przy różnicach staje, a stara wersja chodzi dalej. Gdy nowa wersja ruszy na starej
bazie (np. po ręcznym `npm run build` i restarcie w pm2), strona pokazuje „Coś się
popsuło", w dzienniku pm2 stoi „The column `kajet.shares.folderId` does not exist", a przy
starcie procesu linijka `[baza] BAZA JEST STARSZA NIŻ KOD` z listą braków. Wtedy wystarczy
`npm run db:apply` i restart procesu - kodu nie trzeba wgrywać ponownie.

**nginx.** Strumień `/api/v1/live/<id>` to Server-Sent Events - jedno długie połączenie na
otwartą notatkę. Serwer sam wysyła `X-Accel-Buffering: no` i `Cache-Control: no-transform`,
a co 20 s linijkę „ping", więc zwykły `proxy_pass` wystarczy. Dla pewności można
dopisać osobny blok (przed ogólnym `location /`):

```nginx
location /api/v1/live/ {
    proxy_pass http://127.0.0.1:9081;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 1h;
}
```

`proxy_read_timeout` musi być dłuższy niż 20 s (domyślne 60 s wystarcza). Nie wolno
kompresować ani buforować `text/event-stream`, bo zmiany przychodziłyby paczkami.

**Cloudflare.** Strumień przechodzi przez proxy Cloudflare bez zmian (ping co 20 s mieści
się w jego 100 s bezczynności). Gdyby jakaś reguła („Cache Everything", Rocket Loader,
transformacje) obejmowała `/api/*`, trzeba ją z tej ścieżki zdjąć.

**Kilka procesów.** Zmiany między osobami w jednym procesie Node idą od razu; przy kilku
procesach (np. klaster PM2) dochodzą przez bazę - z opóźnieniem do 5 s, a znaczki „kto jest
w notatce" pokazują tylko osoby podłączone do tego samego procesu.

**Odnośniki w aplikacji (Android App Links).** `/.well-known/assetlinks.json` podaje odcisk
certyfikatu, którym podpisane jest bieżące wydanie z panelu (Aplikacja) - serwer czyta go
z pliku APK sam. `ANDROID_CERT_SHA256` w `.env` (po przecinku) jest potrzebne tylko dla
wydań podpisanych innym kluczem. Żeby Android otwierał `/n/...` od razu w Kajecie:

1. wgraj w panelu wydanie 26.10.06 podpisane kluczem wydań,
2. sprawdź, że `https://<domena>/.well-known/assetlinks.json` odpowiada 200, bez
   przekierowania, z `content-type: application/json` (blok nginx dla
   `/.well-known/acme-challenge` nie może łapać całego `/.well-known/`, a Cloudflare nie
   może tu stawiać wyzwania dla botów),
3. zainstaluj aplikację na nowo albo zaktualizuj - Android sprawdza plik przy instalacji.

Bez tego aplikacja i tak łapie odnośniki, ale Android pyta, czym je otworzyć; przycisk
„Otwórz w aplikacji Kajet" na stronie `/n/...` (tylko na Androidzie) działa zawsze.

## Konta administratorów

Panel administratora nie tyka kont administratorów: nie nadaje ani nie odbiera uprawnień,
nie zmieni hasła, adresu, blokady, limitów ani nie skasuje takiego konta. Robi to wyłącznie
`npm run konta`, czyli powłoka na maszynie, na której stoi serwer.

Chodzi o to, co się dzieje, gdy ktoś przejmie konto administratora. Wcześniej dostawał wtedy
pełnię władzy nad serwerem - mógł zrobić administratora z konta, które miał pod ręką,
i odebrać uprawnienia wszystkim prawowitym. Teraz najgorsze, co da się zrobić z panelu,
dotyczy zwykłych kont, a odzyskanie serwera zostaje przy tym, kto ma do niego dostęp powłoką.
Odmowa stoi w samych czynnościach serwerowych ([`src/app/admin/actions.ts`](src/app/admin/actions.ts)),
nie tylko w wyglądzie strony - ukryty przycisk to nie zabezpieczenie.

```bash
npm run konta                                lista kont administratorów
npm run konta -- lista [fraza]               wszystkie konta (fraza szuka po loginie i adresie)
npm run konta -- nadaj <konto>               nadaje uprawnienia administratora
npm run konta -- odbierz <konto>             odbiera uprawnienia
npm run konta -- haslo <konto> <hasło>       ustawia hasło i wylogowuje wszystkie urządzenia
npm run konta -- email <konto> <nowy>        zmienia adres (nowy czeka na potwierdzenie)
npm run konta -- login <konto> <nowy>        zmienia login
npm run konta -- zablokuj <konto> [powód]
npm run konta -- odblokuj <konto>
npm run konta -- miejsce <konto> <MB>        miejsce na notatki (-1 to bez ograniczeń, 0 to zero)
npm run konta -- kod <konto> tak|nie         uruchamianie kodu na serwerze
npm run konta -- kajetai <konto> tak|nie [na dobę]
npm run konta -- skasuj <konto> --na-pewno
```

Konto wskazuje się adresem e-mail albo loginem. Odebranie uprawnień ostatniemu administratorowi
i skasowanie konta wymagają dopisku `--na-pewno`. Każda zmiana trafia do dziennika w `/admin/log`
z dopiskiem „(z serwera)" i bez autora.

Pierwszy administrator: przy pustej bazie `npm run konta -- nadaj <adres>` wydaje kod
zaproszenia, bo konto trzeba najpierw założyć zwykłą rejestracją na `/register`. Po jej
zakończeniu to samo polecenie nadaje uprawnienia.

## Uwagi

Repozytorium jest wycinkiem działającej instalacji z `kajet.wojtoteka.ovh` - kod, schemat bazy
i skrypty. Nie ma tu danych użytkowników, kluczy ani plików wydań.

## Licencja

Kod udostępniony do wglądu w celach portfolio.
