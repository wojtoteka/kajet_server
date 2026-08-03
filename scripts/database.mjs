/**
 * Database URL for things run outside Next: scripts and the prisma tool.
 *
 * The .env file holds the ordinary pieces (host, port, user, password, database
 * name), while Prisma wants a single URL. We glue it together here. The same
 * job for the app itself is done by databaseUrl in src/lib/settings.ts — both
 * versions must produce the same result.
 *
 * There is no .env library here, because only this much is needed: a
 * NAME=value line, skipping comments and quotes.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/** Loads .env into process.env. Does not overwrite what is already set. */
export function loadEnv(directory = process.cwd()) {
  let content;
  try {
    content = readFileSync(path.join(directory, ".env"), "utf8");
  } catch {
    // A missing file is not an error: the values may come from the environment.
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;

    const name = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[name] === undefined) process.env[name] = value;
  }
}

/**
 * Builds mysql://user:password@host:port/database from the separate entries.
 * The user and password are encoded so that characters such as @ or : do not
 * break the URL.
 */
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USER ?? "");
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? "");
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "3306";
  const name = process.env.DB_NAME || "kajet";

  return `mysql://${user}:${password}@${host}:${port}/${name}`;
}

/** Loads .env and puts the ready URL into DATABASE_URL, which Prisma wants. */
export function prepareDatabase() {
  loadEnv();
  process.env.DATABASE_URL = databaseUrl();
  return process.env.DATABASE_URL;
}
