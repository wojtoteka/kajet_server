function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USER ?? "");
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? "");
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "3306";
  const name = process.env.DB_NAME || "kajet";

  return `mysql://${user}:${password}@${host}:${port}/${name}`;
}

export const settings = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:9081",
  port: number("PORT", 9081),

  database: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: number("DB_PORT", 3306),
    user: process.env.DB_USER ?? "",
    name: process.env.DB_NAME || "kajet",
  },

  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: number("SMTP_PORT", 587),
    // Port 587 starts the connection in the clear and encrypts it with the
    // STARTTLS command, so "secure" must be false here. True is for port 465.
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "Kajet <kajet@wojtoteka.ovh>",
  },

  files: {
    directory: process.env.FILES_DIR ?? "./data/files",
    maxFileBytes: number("MAX_FILE_BYTES", 26_214_400),
  },

  trash: {
    /**
     * Po tylu dniach notatka z kosza znika na zawsze, razem z załącznikami na
     * dysku. 0 wyłącza sprzątanie i kosz znowu rośnie bez końca.
     */
    days: number("TRASH_DAYS", 30),
  },

  quotas: {
    default: number("DEFAULT_QUOTA_BYTES", 524_288_000),

    /**
     * Górna granica dla całego serwera: tyle łącznie mogą zająć notatki
     * i załączniki wszystkich kont razem. Limity pojedynczych kont nie sumują
     * się do niczego sensownego - konto z limitem „bez ograniczeń" albo kilka
     * hojnie podniesionych potrafi wypełnić dysk, a wtedy staje cały serwer,
     * nie jedno konto. Ta granica zatrzymuje zapis, zanim to się stanie.
     * 0 zdejmuje ją zupełnie.
     */
    server: number("SERVER_QUOTA_BYTES", 21_474_836_480),
  },

  inactive: {
    /**
     * Po tylu dniach bez śladu życia konto dostaje ostrzeżenie na pocztę.
     * Za ślad życia uchodzi logowanie, zapis notatki i synchronizacja z
     * aplikacji - patrz inactive.ts. 0 wyłącza całe sprzątanie kont.
     */
    days: number("INACTIVE_DAYS", 365),
    /**
     * Ile dni po ostrzeżeniu konto jeszcze czeka. Powrót w tym czasie kasuje
     * ostrzeżenie i konto zostaje.
     */
    graceDays: number("INACTIVE_GRACE_DAYS", 30),
  },

  // Releases of the Android application. They belong to the server, not to any
  // account, so they lie apart from user files and count towards nobody's quota.
  app: {
    directory: process.env.APP_DIR ?? "./data/app",
    maxBytes: number("MAX_APP_BYTES", 314_572_800),

    /**
     * Najstarsze wydanie, które serwer jeszcze obsługuje. Idzie w odpowiedzi
     * `/api/v1/app/latest` jako zapas na przyszłość - na wypadek aktualizacji
     * obowiązkowej. Aplikacja na razie tylko to odczytuje i nic z tym nie robi,
     * a zero znaczy, że nic nie jest wymuszane.
     */
    minSupportedRelease: number("MIN_SUPPORTED_RELEASE", 0),
  },

  // Formularz kontaktowy. Wiadomości idą do skrzynki Wojtoteki przez jej API,
  // prosto z przeglądarki gościa - patrz app/contact/ContactForm.tsx, czemu
  // nie przez serwer. Klucz jest jawny w kodzie strony, tak jak przewiduje
  // dokumentacja API. Bez klucza strona kontaktu pokazuje sam adres poczty.
  contact: {
    apiUrl: process.env.CONTACT_API_URL ?? "https://wojtoteka.ovh/api/v1/contact",
    apiKey: process.env.CONTACT_API_KEY ?? "",
    email: process.env.CONTACT_EMAIL ?? "kontakt@wojtoteka.ovh",

    /*
      hCaptcha na formularzu. Klucz strony jedzie do przeglądarki (rysuje
      okienko), sekret zostaje na serwerze i sprawdza token - patrz
      app/contact/actions.ts. Bez pary kluczy formularz działa jak dotąd,
      bez okienka.
    */
    hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY ?? "",
    hcaptchaSecret: process.env.HCAPTCHA_SECRET ?? "",
  },

  code: {
enabled: process.env.CODE_ENABLED === "true",
    docker: process.env.CODE_DOCKER ?? "docker",
    image: process.env.CODE_IMAGE ?? "kajet-runner:1",

    timeoutSeconds: number("CODE_TIMEOUT_SECONDS", 10),
    maxOutputChars: number("CODE_MAX_OUTPUT_CHARS", 100_000),
    memoryMb: number("CODE_MEMORY_MB", 256),
    cpus: Number(process.env.CODE_CPUS ?? "0.5"),
    pidsLimit: number("CODE_PIDS_LIMIT", 64),
    tmpMb: number("CODE_TMP_MB", 64),

runsPerMinute: number("CODE_RUNS_PER_MINUTE", 12),

maxConcurrent: number("CODE_MAX_CONCURRENT", 3),
  },

  /*
    Asystent KajetAI. Bez klucza cała funkcja po prostu nie istnieje - punkt
    końcowy odpowiada tak samo jak nieznany adres, a w panelu i w aplikacji
    nie ma po niej śladu.

    UWAGA na poziom darmowy: warunki Gemini API mówią wprost, że treść wysłaną
    na darmowym poziomie Google wykorzystuje do rozwoju swoich produktów i że
    mogą ją czytać ludzie. Tak też jest napisane w polityce prywatności
    (punkt 3.10) i na ekranie zgody. Po włączeniu rozliczania w Google trzeba
    poprawić TAMTE dwa miejsca - tutaj nic się nie zmienia.
  */
  ai: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",

    /**
     * Ile modelowi wolno myśleć: minimal, low, medium albo high. Myślenie
     * liczy się do tokenów wyjściowych, a zadanie jest odtwórcze - przepisz
     * ten akapit krócej - więc niski poziom wystarcza.
     */
    thinking: process.env.GEMINI_THINKING || "low",

    timeoutSeconds: number("AI_TIMEOUT_SECONDS", 60),

    /**
     * Ile znaków materiału wolno wysłać do modelu: sam markdown, źródło albo
     * teksty węzłów mapy - bez pisma odręcznego, którego model i tak nie
     * czyta. Powyżej tej granicy punkt odmawia z czytelnym zdaniem. Nigdy nie
     * obcina po cichu: notatka wróciłaby wtedy skrócona o połowę.
     */
    maxChars: number("AI_MAX_CHARS", 60_000),

    callsPerHour: number("AI_CALLS_PER_HOUR", 20),
    callsPerDay: number("AI_CALLS_PER_DAY", 100),

    /**
     * Ile ostatnich wymian jedzie do modelu jako historia rozmowy. Pełna treść
     * notatki leci przy każdym żądaniu, więc historia dokłada się do rachunku
     * bez końca; sześć wymian to jakieś trzysta tokenów, a dalej rośnie sam
     * koszt.
     */
    historyTurns: number("AI_HISTORY_TURNS", 6),

    /** Po tylu godzinach bez słowa rozmowa przy notatce zaczyna się od nowa. */
    historyHours: number("AI_HISTORY_HOURS", 24),
  },
};

/**
 * Czy asystent w ogóle istnieje na tym serwerze. Bez klucza nie ma po co
 * pokazywać przełącznika w panelu ani mówić aplikacji, że coś takiego jest.
 */
export function aiWorks(): boolean {
  return Boolean(settings.ai.apiKey);
}

export function mailWorks(): boolean {
  return Boolean(settings.mail.host && settings.mail.from);
}

export function contactWorks(): boolean {
  return Boolean(settings.contact.apiKey);
}

/** Okienko hCaptcha pokazuje się tylko z pełną parą kluczy - sam klucz strony
    bez sekretu dawałby zaporę, której serwer nie umie sprawdzić. */
export function hcaptchaWorks(): boolean {
  return Boolean(settings.contact.hcaptchaSiteKey && settings.contact.hcaptchaSecret);
}

export function googleWorks(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function checkSettings(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) {
    if (!process.env.DB_USER) missing.push("DB_USER: missing MySQL database user");
    if (!process.env.DB_PASSWORD) missing.push("DB_PASSWORD: missing MySQL database password");
    if (!process.env.DB_NAME) missing.push("DB_NAME: missing MySQL database name");
  }
  if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET: missing session signing key");
  // Połówka pary kluczy hCaptchy to na pewno pomyłka w .env - z całą parą
  // okienko działa, bez obu przechodzi się bez okienka, jak dotąd.
  if (Boolean(settings.contact.hcaptchaSiteKey) !== Boolean(settings.contact.hcaptchaSecret)) {
    missing.push("HCAPTCHA_SITE_KEY/HCAPTCHA_SECRET: only one of the pair is set");
  }
  return missing;
}
