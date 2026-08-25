/*
  Co Next robi raz, przy podnoszeniu procesu serwera.

  Najpierw strefa czasowa, potem sprzątanie: kosz, konta, z których nikt nie
  korzysta, i przeterminowane liczniki zapór. Sprzątania nie trzeba dzięki temu
  wpisywać do crona: proces i tak chodzi pod pm2 przez całą dobę, a sprzątanie
  wisi na jego zegarze.
*/

export async function register() {
  // Middleware i brzeg dostają ten sam plik, a tam nie ma ani bazy, ani dysku.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  /*
    Strefa czasowa, zanim cokolwiek policzy jakąkolwiek datę.

    Bez tego „północ" znaczyła tyle, ile pokazuje zegar maszyny - a serwery
    stoją domyślnie na UTC. Limit KajetAI zeruje się o północy i tak mówi
    komunikat; na UTC zerowałby się latem o drugiej w nocy, czyli komunikat
    kłamałby o dwie godziny. Tą samą strefą idą też daty widoczne na stronie:
    data założenia konta, termin kodu zaproszenia, godziny w dzienniku.

    Node od wersji 16 przyjmuje zmianę `process.env.TZ` w locie i stosuje ją
    do dat tworzonych PÓŹNIEJ, a `register` chodzi, zanim serwer zacznie
    cokolwiek obsługiwać. Nadpisujemy tu TZ świadomie, także gdy coś już je
    ustawiło: innej strefy chce się przez KAJET_TZ (patrz settings.timeZone),
    a nie przez TZ, które maszyna potrafi ustawić sama i bez pytania.
  */
  const { settings } = await import("@/lib/settings");
  process.env.TZ = settings.timeZone;

  const { startTrashSweeper } = await import("@/lib/trash");
  startTrashSweeper();

  const { startInactiveSweeper } = await import("@/lib/inactive");
  startInactiveSweeper();

  const { startLimitSweeper } = await import("@/lib/rate-limit");
  startLimitSweeper();
}
