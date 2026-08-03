import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./settings";

const globals = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globals.prisma ??
  new PrismaClient({
    // We build the URL ourselves from the DB_* entries in .env, because
    // schema.prisma only ever sees DATABASE_URL.
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globals.prisma = prisma;
