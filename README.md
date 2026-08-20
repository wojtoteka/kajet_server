# Kajet — serwer

Chmura dla notatnika **Kajet**: konta, synchronizacja notatek z tabletem, udostępnianie
linkiem, asystent AI i uruchamianie kodu w kontenerze. Napisane w Next.js 15 (App Router,
React 19, TypeScript), z MySQL/MariaDB przez Prismę.

Aplikacja na Androida, która się z tym serwerem synchronizuje, leży w repo
[`kajet_apk`](https://github.com/Wojtoteka/kajet_apk).

---

## Co to robi

**Konta i sesje.** Rejestracja e-mailem z potwierdzeniem, logowanie hasłem albo przez Google
(NextAuth v5 + adapter Prismy). Osobna ścieżka logowania dla urządzenia — tablet dostaje
własny token, więc telefon nie wylogowuje tabletu.

**Notatki w chmurze.** Prawda o treści notatki to jeden dokument JSON — dokładnie ten sam,
który leży w pliku `content.json` w katalogu notatki na tablecie. Baza trzyma ten dokument
plus to, czego w nim nie ma: właściciela, zajęte miejsce i listę udostępnień. Dzięki temu
synchronizacja jest porównaniem dwóch dokumentów, a nie tłumaczeniem modelu na model.

**Rodzaje notatek.** Tekstowa (Markdown z tabelami, obrazkami i skalowaniem szerokości),
odręczna, mapa myśli, notatka z kodem, podgląd HTML. Każda ma edytor po stronie www, więc
notatka zrobiona na tablecie jest edytowalna w przeglądarce i odwrotnie.

**Udostępnianie.** Link `/n/<token>` do notatki — z podglądem, załącznikami i opcjonalnym
hasłem. Bez konta po drugiej stronie.

**KajetAI.** Asystent oparty o Gemini (`@google/genai`), który edytuje notatkę narzędziami
(a nie przez podmianę całego tekstu): zna markdown Kajetu, limity dzienne, zgodę użytkownika
na przetwarzanie treści i historię swoich zmian, żeby dało się je cofnąć.

**Uruchamianie kodu.** Notatka z kodem może zostać wykonana w izolowanym kontenerze Dockera,
z limitem czasu i liczby uruchomień na minutę. Domyślnie wyłączone (`CODE_ENABLED=false`).

**Panel administratora.** Konta i blokady, limity miejsca, wydania aplikacji na Androida
(upload APK + notatki wydania), zgłoszenia awarii z tabletu, log akcji, limity KajetAI.

**Dwujęzyczność.** Cały interfejs idzie przez słownik (`src/lib/i18n.ts`) — polski i angielski,
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
  n/[token]/      publiczny podgląd udostępnionej notatki
  library/        biblioteka notatek zalogowanego użytkownika
src/components/   edytory (tekst, odręczne, mapa myśli, kod) i reszta UI
src/lib/          logika: auth, synchronizacja, limity, markdown, KajetAI, wydania APK
prisma/           schemat bazy
scripts/          narzędzia serwisowe (migracje, wdrożenie, kontrola stanu)
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
npm run admin     # nadaje kontu rolę administratora
npm run sprawdz   # kontrola stanu działającego serwera
```

Wszystkie ustawienia są w `.env` — jego wzór z opisem każdej zmiennej leży w
[`.env.example`](.env.example). Prawdziwy `.env`, katalog `data/` z notatkami użytkowników
i zrzuty bazy nigdy nie trafiają do repozytorium.

## Uwagi

Repozytorium jest wycinkiem działającej instalacji z `kajet.wojtoteka.ovh` — kod, schemat bazy
i skrypty. Nie ma tu danych użytkowników, kluczy ani plików wydań.

## Licencja

Kod udostępniony do wglądu w celach portfolio.
