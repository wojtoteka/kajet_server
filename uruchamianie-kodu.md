# Uruchamianie kodu — jak włączyć na serwerze

Samo przełączenie `CODE_ENABLED` z `false` na `true` nie wystarczy. Kod nie
sprawdza, czy Docker jest gotowy — po prostu go wywołuje. Potrzebne są trzy
rzeczy: Docker na serwerze, zbudowany obraz `kajet-runner:1` i użytkownik pm2
z prawem do gniazda Dockera. Flaga jest ostatnim krokiem, nie pierwszym.

## 1. Docker na serwerze

```bash
docker --version
```

Jeśli nie ma:

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

Nie instaluj ze `snap`. Snapowy Docker nie widzi `/tmp` hosta, a
`src/lib/code-runner.ts` tworzy tam katalog z programem użytkownika i
podmontowuje go do kontenera. Kod by się nie wgrywał.

## 2. Zbuduj obraz

Z katalogu projektu na serwerze:

```bash
docker build -t kajet-runner:1 docker/
```

Trwa kilka minut i zajmuje ~800 MB: Python, Node, gcc/g++, PHP, Ruby,
sqlite3, tsx. Sprawdzenie:

```bash
docker image inspect kajet-runner:1 >/dev/null && echo OK
```

## 3. Uprawnienia dla użytkownika pm2

Jeśli pm2 chodzi na roocie — pomiń ten punkt. W przeciwnym razie:

```bash
sudo usermod -aG docker $USER
```

Tu jest pułapka: demon pm2 trzyma grupy z momentu swojego startu, więc
`pm2 restart` nie wystarczy. Trzeba go ubić i podnieść od nowa, po ponownym
zalogowaniu:

```bash
exit                      # wyloguj się i zaloguj ponownie (albo: newgrp docker)
pm2 kill
cd /sciezka/do/kajet_server
pm2 start npm --name kajet -- start
pm2 save
```

Test, że użytkownik faktycznie ma dostęp:

```bash
docker run --rm kajet-runner:1 python3 -c "print('dziala')"
```

## 4. Przełącz flagę

W `.env`:

```
CODE_ENABLED=true
```

`CODE_DOCKER` i `CODE_IMAGE` zostaw jak są — to i tak wartości domyślne
w `src/lib/settings.ts`.

## 5. Restart aplikacji

```bash
pm2 restart kajet --update-env
```

`next start` czyta `.env` przy starcie procesu, więc restart wystarcza. Bez
niego zmiana w `.env` nie ma żadnego efektu.

## 6. Weryfikacja

Panel admina pokazuje stan z `runnerState()` — powinien napisać „Gotowe,
obraz kajet-runner:1". Jeśli coś nie działa, komunikat sam mówi co: brak
Dockera, brak obrazu, albo brak praw do `docker.sock`. Potem wejdź na notatkę
z kodem i uruchom `print("test")`.

## Warto sprawdzić przy okazji

- **Pamięć.** `CODE_MAX_CONCURRENT=3` razy `CODE_MEMORY_MB=256` to do 768 MB
  szczytowo ponad to, co już zjada Next i MySQL. Na małym VPS-ie (1–2 GB)
  zejdź na `CODE_MAX_CONCURRENT=2`.
- **SELinux** (RHEL, Fedora, Rocky). Bind-mount `/code:ro` zostanie
  zablokowany — potrzebna byłaby etykieta `:z` przy woluminie
  w `src/lib/code-runner.ts`. Na Debianie i Ubuntu problemu nie ma.
- **Bez sieci.** Kontener startuje z `--network none`, więc `pip install`
  czy `npm i` w kodzie użytkownika nigdy nie zadziała. To zamierzone. Nowe
  języki dokłada się do `docker/Dockerfile` i do listy `LANGUAGES`
  w `src/lib/code-runner.ts`.
