import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./settings";
import { unpackNoteContent } from "./note-content";

function createClient() {
  return new PrismaClient({
    // We build the URL ourselves from the DB_* entries in .env, because
    // schema.prisma only ever sees DATABASE_URL.
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends({
    result: {
      note: {
        /*
          Treść notatki leży w bazie spakowana (note-content.ts), a rozpakowuje
          ją dopiero tu - przy każdym odczycie, także przez relację
          (udostępnienie → notatka). Reszta kodu widzi więc zwykły dokument.
          Rozpakowanie idzie przy pierwszym sięgnięciu po pole, nie przy
          samym odczycie wiersza, i zostaje zapamiętane.
        */
        content: {
          needs: { content: true },
          compute: (note) => unpackNoteContent(note.content),
        },
      },
    },
  });
}

const globals = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globals.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globals.prisma = prisma;
