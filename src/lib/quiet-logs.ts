/*
  Szum w dzienniku, który tylko straszy.

  Next.js wypisuje cały stos błędu za każdym razem, gdy przychodzi POST
  z nagłówkiem Next-Action, którego nie zna: „Failed to find Server Action"
  albo „The Server Reference ID did not match the expected format". Robią to
  głównie boty skanujące strony na Next.js (szukają dziur w akcjach serwera)
  oraz karty przeglądarki otwarte jeszcze przed ostatnią aktualizacją.
  Serwer i tak odpowiada im 404 i nic więcej się nie dzieje - nie ma tu czego
  naprawiać, a dziennik zapycha się stosami, które wyglądają jak awaria.

  Wyciszamy tylko te dwa komunikaty; każdy inny błąd idzie dalej jak zawsze.
  Żeby nie stracić całkiem obrazu, raz na godzinę pada jedna krótka linijka
  z liczbą odrzuconych zapytań (o ile jakieś były).
*/

const NOISE = [
  "failed-to-find-server-action",
  "Failed to find Server Action",
  "The Server Reference ID did not match the expected format",
];

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return "";
}

export function isServerActionNoise(args: unknown[]): boolean {
  return args.some((arg) => {
    const message = text(arg);
    return message !== "" && NOISE.some((needle) => message.includes(needle));
  });
}

let installed = false;
let silenced = 0;

export function installQuietLogs(): void {
  if (installed) return;
  installed = true;

  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (isServerActionNoise(args)) {
        silenced++;
        return;
      }
      original(...args);
    };
  }

  const timer = setInterval(() => {
    if (silenced === 0) return;
    console.info(`[akcje] odrzucono ${silenced} zapytań z nieznaną akcją serwera (boty albo stare karty)`);
    silenced = 0;
  }, 60 * 60 * 1000);
  timer.unref?.();
}
