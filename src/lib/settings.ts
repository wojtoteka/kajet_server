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

  quotas: {
    default: number("DEFAULT_QUOTA_BYTES", 524_288_000),
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
};

export function mailWorks(): boolean {
  return Boolean(settings.mail.host && settings.mail.from);
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
  return missing;
}
