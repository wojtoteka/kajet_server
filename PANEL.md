# Panel WWW Kajet — plan i status

Stan: **3 sierpnia 2026**. Panel ma być pełnoprawnym klientem Kajetu (nie „podglądem urządzenia”).

Wspólna ścieżka zapisu: `src/lib/note-write.ts` (`upsertNoteForUser`, `upsertCodeNoteForUser`, soft-delete / ulubione / purge). Sync aplikacji: `PUT/GET /api/v1/notes` (bez `CODE`).

### Logowanie aplikacji (Google / hasło przez stronę)

1. Aplikacja: `POST /api/v1/signin/device` → `{ code, verificationUri, expiresIn, interval }`.
2. Otwiera `verificationUri` (Custom Tabs) → `/signin/device?code=…`.
3. Użytkownik loguje się na WWW (Google albo hasło), zatwierdza urządzenie.
4. Aplikacja polluje `GET /api/v1/signin/device?code=…` aż dostanie token (kształt jak `POST /api/v1/signin`).
5. Po zatwierdzeniu strona może też otworzyć `kajet://auth?code=…` (powrót do aplikacji); token i tak wychodzi tylko z poll/redeem.

Fallback: wklejenie tokenu ze `/account` albo `POST /api/v1/signin` (email+hasło).

**Deploy:** po tym commicie `npm run db:push` (nowa tabela `login_challenges`), potem build/restart. `NEXT_PUBLIC_BASE_URL` / `AUTH_URL` muszą wskazywać publiczny HTTPS (np. `https://kajet.wojtoteka.ovh`), żeby `verificationUri` i Google callback były poprawne.

---

## Mapa funkcji: aplikacja → WWW

| Obszar | Aplikacja | Panel WWW | Status |
| --- | --- | --- | --- |
| Biblioteka — lista | Tak | Lista + limity miejsca | **Done** |
| Wyszukiwanie | Tak | Po tytule / tagach | **Done** |
| Ulubione | Tak | Przełączanie w liście i na notatce | **Done** |
| Foldery | Tak | Lista, tworzenie, przenoszenie | **Done** (bez zagnieżdżania UI) |
| Kosz / przywracanie | Soft delete (`.trash`) | Soft delete (`deletedAt`), kosz, purge, opróżnianie | **Done** |
| TEXT — tworzenie / edycja | Tak | `/note/new`, edytor Markdown | **Done** |
| TEXT — usuwanie | Tak | Do kosza | **Done** |
| CODE — podgląd / edycja | Pliki lokalne + runner | Notatki `CODE` na serwerze, edycja | **Done** |
| CODE — uruchamianie | `/api/v1/code` | Ten sam runner (sesja WWW) | **Done** (wymaga `CODE_ENABLED` + Docker) |
| MINDMAP | Edycja | Podgląd SVG | **Done** (podgląd) / **Later** (edycja) |
| HANDWRITTEN | Edycja rysikiem | Podgląd SVG stron | **Done** (podgląd) / **Later** (silnik atramentu) |
| Załączniki | Sync API | Upload / podgląd / usuwanie na WWW | **Done** |
| Sync / wersje / konflikty | Sync | Zapis TEXT/CODE przez te same reguły wersji | **Done** |
| Konto — wylogowanie | Tak | Sesja przeglądarki | **Done** |
| Konto — tokeny | Logowanie tokenem | Wydaj / unieważnij / unieważnij wszystkie | **Done** |
| Konto — hasło | Tak | Ustaw / zmień | **Done** |
| Google OAuth | Device login (Custom Tabs + poll) | Prawdziwy OAuth na WWW | **Done** |
| Logowanie z aplikacji | Hasło / token / Google przez `/signin/device` | Zatwierdzenie challenge | **Done** |
| Udostępnianie | Link / e-mail | Formularz + lista + cofanie | **Done** |

---

## Priorytety po P0 (kolejność)

1. ~~Usuwanie + kosz~~ **Done**
2. ~~Wording bez „(tablet)”~~ **Done**
3. ~~CODE: podgląd + run~~ **Done**
4. ~~Biblioteka: ulubione, szukaj, foldery~~ **Done**
5. ~~Załączniki na WWW~~ **Done**
6. **Next:** zagnieżdżone foldery / drag-and-drop; bogatszy edytor TEXT (podgląd live)
7. **Later:** edycja mindmap w przeglądarce; pełny handwriting engine; live collaborative editing (`LiveChange`)

---

## Świadomie Later

- **Pełny silnik atramentu w przeglądarce** — za duży na jeden przebieg; podgląd SVG wystarczy do parytetu odczytu.
- **Edycja mapy myśli** — podgląd jest; edycja węzłów to osobny projekt UI.
- **Sync `CODE` do aplikacji jako `.note`** — w appce kod to zwykłe pliki; notatki `CODE` zostają WWW / runner API.
- **Zagnieżdżone foldery + DnD** — schemat ma `parentId`, UI na razie płaskie.

---

## Deploy (po wdrożeniu tego commita)

```bash
npm ci
npm run build
# restart procesu (pm2 / systemd / docker)
```

Środowisko:

- `CODE_ENABLED=true` + obraz `CODE_IMAGE` (np. `kajet-runner:1`) + dostęp do Dockera — bez tego panel pokaże edycję kodu, ale bez uruchamiania.
- `AUTH_*` / Google: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, poprawny `AUTH_URL` / callback.
- Baza i `FILES_DIR` jak dotychczas.

Testy lokalne przed deployem: `npm run typecheck` i `npm test`.
