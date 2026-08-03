/**
 * Runs the prisma tool with a ready DATABASE_URL.
 *
 * Prisma reads only DATABASE_URL, while .env keeps the database pieces apart.
 * This go-between assembles the URL and passes it along, so commands such as
 * "npm run db:push" work exactly as before.
 *
 * Usage: node scripts/prisma.mjs db push
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareDatabase } from "./database.mjs";

prepareDatabase();

// We prefer the tool from this project's node_modules. When the script goes
// through "npm run" it is on PATH anyway, but run by hand it would not be.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = path.join(project, "node_modules", "prisma", "build", "index.js");

const child = existsSync(local)
  ? spawn(process.execPath, [local, ...process.argv.slice(2)], { stdio: "inherit" })
  : spawn("prisma", process.argv.slice(2), {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

child.on("exit", (code) => process.exit(code ?? 1));
