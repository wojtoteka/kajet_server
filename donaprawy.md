# Do naprawy po stronie serwera

Spisane 3 sierpnia 2026, przy okazji naprawiania aplikacji na tablet.
Stan weryfikacji: **3 sierpnia 2026 (wieczór)** — po wdrożeniu poprawek sync
na serwerze. Każdy punkt mówi, co było źle i gdzie to dziś stoi.

Aplikacja rozmawia z serwerem tylko przez `src/app/api/v1/*`. Po stronie
tabletu odpowiada za to `cloud/src/main/java/wojtoteka/ovh/kajet/cloud/`,
głównie `CloudClient.kt` (połączenie) i `Sync.kt` (co po czym leci).

---

## Stan: co jest naprawione na serwerze

| # | Temat | Stan |
| --- | --- | --- |
| 1 | Konflikt jako HTTP 200 + `status: "conflict"` | **naprawione** |
| 2 | Kursor `(updatedAt, id)` — `since`/`afterId`, `upTo`/`upToId` | **naprawione** |
| 3 | Pętla po `hasMore` | **tablet** (serwer już zwraca `hasMore`) |
| 4 | `onServer` z wąskim `select` | **naprawione** |
| 5 | `CODE` poza sync GET/enum tabletu | **naprawione** (zostaje na WWW) |
| 6 | `wrapApi` — błędy `/api/v1/*` jako JSON z `message` | **naprawione** |
| 7 | Ściąganie załączników przy sync | **tablet** |
| 8a | Sniff MIME przy `POST` załącznika | **naprawione** (`resolveUploadMime`) |
| 8b | `cache-control` bez `immutable` na GET załącznika API | **naprawione** |
| 8c | Limit miejsca przez `reserveBytes` (transakcja) | **naprawione** |

Jedna droga zapisu notatki (wersja / hash / konflikt / limit) siedzi w
`src/lib/note-write.ts` i jest wołana z `PUT /api/v1/notes`. To podstawa pod
przyszły edytor na stronie — server action ma wołać tę samą funkcję.

---

## 1. Konflikt wraca jako 409 i aplikacja nigdy go nie obsłuży — NAPRAWIONE

**Gdzie:** `src/lib/note-write.ts` → `PUT` w `src/app/api/v1/notes/route.ts`.

Konflikt wraca jako **HTTP 200** z `status: "conflict"` i `onServer`.
Tablet czyta treść (traktuje nie-2xx jako twardy błąd zanim zajrzy do JSON).

## 2. Stronicowanie po `updatedAt` gubi notatki — NAPRAWIONE

Kursor to para `(updatedAt, id)`. Parametry: `since`, `afterId`.
Odpowiedź: `upTo`, `upToId`, `hasMore`. Sortowanie
`orderBy: [{ updatedAt: "asc" }, { id: "asc" }]`.

## 3. `hasMore` nikt nie czyta — TABLET

Serwer zwraca `hasMore` poprawnie. Brakuje pętli po stronie tabletu
(`Sync.fetchChanges` pyta raz i kończy). Bez punktu 2 pętla dopiero pokazałaby,
ile notatek ucieka — kursor jest, zostaje pętla w aplikacji.

## 4. `onServer` wysyła cały wiersz z bazy — NAPRAWIONE

`select`: `id`, `title`, `kind`, `favorite`, `tags`, `content`, `version`,
`updatedAt`.

## 5. Rodzaj `CODE` przychodzi, a tablet go nie zna — NAPRAWIONE (serwer)

Sync API (`GET`/`PUT`) zna tylko `HANDWRITTEN` | `TEXT` | `MINDMAP`.
Notatki `CODE` zostają po stronie WWW / w bazie, nie jadą w syncu tabletu.

## 6. Każdy błąd ma trzymać się jednego kształtu — NAPRAWIONE (główna ścieżka)

`wrapApi` w `src/lib/api.ts` łapie nieobsłużone wyjątki w handlerach `/api/v1/*`
i oddaje JSON `{ error, message }`. Timeout / HTML z proxy poza procesem Node
nadal może wyglądać inaczej — to nie jest w tym kodzie.

## 7. Załączniki: przy pobieraniu notatki nikt ich nie ściąga — TABLET

Serwer ma listę i plik z etagiem. Brakuje ściągania w `Sync` po stronie tabletu.

## 8. Drobne — NAPRAWIONE na serwerze

- `POST` załącznika: sniff nagłówka pliku przez `resolveUploadMime`.
- `GET` załącznika API: `cache-control: private, max-age=0, must-revalidate` + ETag
  (bez `immutable` na adresie bez hasha).
- Limit miejsca: `reserveBytes` z `FOR UPDATE` przed zapisem; przy nieudanym
  zapisie rezerwacja jest zwalniana.

Uwaga: `src/lib/serve-attachment.ts` (podgląd WWW) nadal może używać dłuższej
pamięci podręcznej — to osobna ścieżka od API tabletu.

---

## Co zostało naprawione w aplikacji (dla porządku)

Żeby przy testach serwera było wiadomo, co się zmieniło po drugiej stronie:

- synchronizacja nie zamyka już aplikacji, kiedy coś pójdzie nie tak;
- logowanie i „Synchronizuj teraz" łapią wyjątki i pokazują komunikat;
- biblioteka nie gaśnie na czarno, gdy nie da się odczytać folderu;
- z ustawień zniknęła sekcja „Uruchamianie kodu", a z ekranu konta napis
  „Serwer" razem z adresem — adres i tak jest jeden, wpisany na stałe.

Otwarte po stronie tabletu (patrz wyżej): pętla `hasMore`, ściąganie załączników,
oraz ewentualnie dalsze dopięcie kursora `afterId` w kliencie.
