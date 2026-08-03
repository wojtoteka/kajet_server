# Do naprawy po stronie serwera

Spisane 3 sierpnia 2026, przy okazji naprawiania aplikacji na tablet.
Kolejność od najgroźniejszego. Każdy punkt mówi, co jest źle, skąd to widać
i co z tym zrobić.

Aplikacja rozmawia z serwerem tylko przez `src/app/api/v1/*`. Po stronie
tabletu odpowiada za to `cloud/src/main/java/wojtoteka/ovh/kajet/cloud/`,
głównie `CloudClient.kt` (połączenie) i `Sync.kt` (co po czym leci).

---

## 1. Konflikt wraca jako 409 i aplikacja nigdy go nie obsłuży

**Gdzie:** `src/app/api/v1/notes/route.ts`, funkcja `PUT`, gałąź `status: "conflict"`.

Serwer odsyła konflikt tak:

```ts
return json({ status: "conflict", message: "...", onServer: { ... } }, 409);
```

Aplikacja każdą odpowiedź spoza zakresu 2xx zamienia na błąd, zanim w ogóle
zajrzy do treści (`CloudClient.connect` → `toError`). Skutek: kod w `Sync.kt`,
który miał zapisać wersję z serwera obok notatki człowieka
(`saveVersionAlongside`), nigdy się nie wykonuje. Zamiast tego notatka wraca
do kolejki jako nieudana i zostaje tam.

**Do zrobienia:** odesłać konflikt ze statusem **200** i zostawić
`status: "conflict"` w treści. Aplikacja już to rozumie i ma na to gotową
obsługę. Jeśli 409 ma zostać ze względów czystości HTTP, trzeba to zgłosić,
bo wtedy zmiana musi pójść po stronie tabletu.

## 2. Stronicowanie po `updatedAt` gubi notatki

**Gdzie:** `src/app/api/v1/notes/route.ts`, funkcja `GET`.

Warunek to `updatedAt > since`, a znacznik następnego pytania bierze się
z ostatniej notatki na stronie:

```ts
upTo: notes.at(-1)?.updatedAt.getTime() ?? ...
```

Kiedy dwie notatki mają ten sam `updatedAt` co do milisekundy i granica strony
(`PAGE_SIZE = 200`) wypadnie dokładnie między nimi, druga z nich przepada na
zawsze — następne pytanie zaczyna się już po jej znaczniku czasu.

Zapis wielu notatek naraz zdarza się przy pierwszej synchronizacji po
zalogowaniu, czyli dokładnie wtedy, kiedy notatek jest najwięcej.

**Do zrobienia:** stronicować kursorem po parze `(updatedAt, id)`, a nie po
samym czasie. Sortowanie `orderBy: [{ updatedAt: "asc" }, { id: "asc" }]`
i warunek „updatedAt > since **albo** (updatedAt = since i id > lastId)".
`upTo` powinno wtedy nieść obie części kursora.

## 3. `hasMore` nikt nie czyta

**Gdzie:** serwer zwraca `hasMore`, aplikacja go ignoruje (`Sync.fetchChanges`
pyta raz i kończy).

Przy ponad 200 zmienionych notatkach jedna synchronizacja pobiera pierwsze 200
i uznaje, że skończyła. Reszta przyjdzie dopiero przy następnej, i tak w kółko.

**Do zrobienia:** to poprawka po stronie tabletu (pętla, dopóki `hasMore`), ale
zapisuję ją tutaj, bo bez punktu 2 pętla dopiero pokaże, ile notatek ucieka.
Najpierw kursor, potem pętla.

## 4. `onServer` wysyła cały wiersz z bazy

**Gdzie:** `src/app/api/v1/notes/route.ts`, gałąź konfliktu:

```ts
const full = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
return json({ ..., onServer: { ...full, ... } }, 409);
```

`...full` to wszystkie kolumny, razem z `ownerId`, `folderId`, `path` i czym
tam jeszcze urośnie tabela. Reszta odpowiedzi w tym pliku starannie wybiera
pola przez `select`, tylko to jedno miejsce wysypuje wszystko.

**Do zrobienia:** dopisać `select` z tym, czego naprawdę potrzebuje aplikacja:
`id`, `title`, `kind`, `favorite`, `tags`, `content`, `version`, `updatedAt`.

## 5. Rodzaj `CODE` przychodzi, a tablet go nie zna

**Gdzie:** `outgoingNote` w `notes/route.ts` przyjmuje
`z.enum(["HANDWRITTEN", "TEXT", "MINDMAP", "CODE"])`.

Aplikacja zna tylko trzy pierwsze (`core/.../NoteKind.kt`). Notatka z rodzajem
`CODE` pobrana z serwera nie da się odczytać, `Sync` po cichu ją pomija —
i pomija ją znowu przy każdej następnej synchronizacji, bo wersji nieudanej
notatki nie zapamiętuje.

**Do zrobienia:** zdecydować, czy `CODE` w ogóle ma jeździć przez to API.
Jeśli nie — wyrzucić z enuma. Jeśli tak — dopisać rodzaj po stronie tabletu.
Tak czy siak notatka, której aplikacja nie rozumie, nie może wracać w każdej
synchronizacji bez końca.

## 6. Każdy błąd ma trzymać się jednego kształtu

Aplikacja czyta z błędu pole `message` (`ServerError` w `CloudClient.kt`).
Kiedy serwer odpowie czymkolwiek innym — pustą treścią, stroną błędu Next.js,
HTML-em z proxy — człowiek dostaje „Serwer odpowiedział czymś, czego nie
rozumiem".

Zdarzyło się przy tym gorzej: nieobsłużony błąd wysyłki zamykał całą aplikację
i zostawał czarny ekran. **To już naprawione po stronie tabletu** (synchronizacja
ma teraz własny uchwyt na błędy i nie przewraca procesu), ale serwer i tak
powinien trzymać format.

**Do zrobienia:** sprawdzić, czy wszystkie ścieżki wyjścia z `/api/v1/*` —
razem z timeoutem, przewróconą bazą i limitem proxy — kończą się JSON-em
z `message`. Warto na to dołożyć test.

## 7. Załączniki: przy pobieraniu notatki nikt ich nie ściąga

`Sync.sendAttachments` wysyła zdjęcia na serwer, ale w drugą stronę nic nie
idzie: `writeNoteFromCloud` zapisuje samą treść notatki. Notatka pobrana na
nowym tablecie ma w treści `![zdjęcie](assets/…)`, a pliku obok niej nie ma.

Serwer ma wszystko, czego trzeba (`GET /api/v1/notes/{id}/attachments` listuje,
`?name=` oddaje plik z etagiem). **To brakująca robota po stronie tabletu** —
zapisuję tu, żeby nie zginęła.

## 8. Drobne

- `POST` załącznika bierze `file.type` prosto z formularza i tylko sprawdza go
  przez `mayUpload`. Warto dołożyć sprawdzenie po nagłówku samego pliku, bo
  `Content-Type` w multiparcie ustawia ten, kto wysyła.
- `GET` załącznika oddaje `cache-control: immutable` z rocznym czasem życia
  pod adresem, który nie zawiera hasha. Zmiana pliku pod tą samą nazwą może
  nie dojść do przeglądarki. Etag to ratuje przy odświeżeniu, ale adres
  z hashem byłby uczciwszy.
- Limit miejsca liczy się przez `changeUsed` po zapisie. Przy równoległych
  wysyłkach z dwóch urządzeń dwa zapisy mogą przejść przez `fitsInQuota`
  jednocześnie. Jeśli limit ma być twardy, trzeba to zamknąć w transakcji.

---

## Co zostało naprawione w aplikacji (dla porządku)

Żeby przy testach serwera było wiadomo, co się zmieniło po drugiej stronie:

- synchronizacja nie zamyka już aplikacji, kiedy coś pójdzie nie tak;
- logowanie i „Synchronizuj teraz" łapią wyjątki i pokazują komunikat;
- biblioteka nie gaśnie na czarno, gdy nie da się odczytać folderu;
- z ustawień zniknęła sekcja „Uruchamianie kodu", a z ekranu konta napis
  „Serwer" razem z adresem — adres i tak jest jeden, wpisany na stałe.
