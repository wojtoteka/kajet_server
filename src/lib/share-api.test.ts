/*
  Punkty udostępnień dla panelu w aplikacji:
  GET/POST /api/v1/notes/[id]/share i DELETE /api/v1/notes/[id]/share/[shareId].

  Baza podstawiona jak w app-latest.test.ts - sprawdzana jest sama trasa.
  Najważniejsze: cudzego udostępnienia nie da się cofnąć, imienne wymusza
  wejście tylko z kontem, a stare pole `links` (czytane przez aplikacje sprzed
  panelu) nie zmienia kształtu.
*/

import { describe, expect, it, vi } from "vitest";

const USER = { id: "u1", name: "Wojtek", login: "wojtek" };
const NOTE = { id: "n1", ownerId: "u1", deletedAt: null, title: "Notatka" };

const PLAIN_SHARE = {
  id: "s1",
  token: "tok-1",
  permission: "READ",
  email: null,
  anonymousAllowed: true,
  expiresAt: null,
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  lastUsedAt: new Date("2026-08-05T09:00:00.000Z"),
};

const PERSONAL_SHARE = {
  id: "s2",
  token: "tok-2",
  permission: "EDIT",
  email: "ala@poczta.pl",
  anonymousAllowed: false,
  expiresAt: null,
  createdAt: new Date("2026-08-02T10:00:00.000Z"),
  lastUsedAt: null,
};

type PrismaShape = {
  note?: { findUnique?: unknown };
  share?: Record<string, unknown>;
};

async function routesWith(prismaShape: PrismaShape, sendResult = true) {
  vi.resetModules();

  const sent = vi.fn(async () => sendResult);
  const prisma = {
    note: { findUnique: async () => NOTE, ...prismaShape.note },
    share: {
      findMany: async () => [PLAIN_SHARE, PERSONAL_SHARE],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async () => ({ id: "s-new" }),
      delete: vi.fn(async () => ({})),
      ...prismaShape.share,
    },
  };

  vi.doMock("@/lib/prisma", () => ({ prisma }));
  vi.doMock("./prisma", () => ({ prisma }));
  // sharing.ts ciągnie za sobą next-auth, który nie wstaje pod vitestem -
  // a trasy udostępnień sesji przeglądarki i tak nie używają.
  vi.doMock("@/lib/auth", () => ({
    auth: vi.fn(async () => null),
    currentUser: vi.fn(async () => null),
  }));
  vi.doMock("@/lib/settings", () => ({
    settings: { baseUrl: "https://kajet.test" },
    mailWorks: () => true,
  }));
  vi.doMock("@/lib/mail", () => ({
    shareMail: (...args: unknown[]) => ({ mail: args }),
    send: sent,
  }));
  vi.doMock("@/lib/api", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
    return { ...actual, userFromRequest: async () => ({ user: USER }) };
  });

  const listRoute = await import("@/app/api/v1/notes/[id]/share/route");
  const revokeRoute = await import("@/app/api/v1/notes/[id]/share/[shareId]/route");
  return { listRoute, revokeRoute, prisma, sent };
}

function ask(body?: unknown, method = body === undefined ? "GET" : "POST") {
  return new Request("https://kajet.test/api/v1/notes/n1/share", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const noteParams = { params: Promise.resolve({ id: "n1" }) };

describe("GET /api/v1/notes/[id]/share", () => {
  it("oddaje pełną listę shares i stare links bez imiennych", async () => {
    const { listRoute } = await routesWith({});

    const body = await (await listRoute.GET(ask(), noteParams)).json();

    // Stary kształt: tylko zwykłe, żywe odnośniki - imienny nie wchodzi.
    expect(body.links).toHaveLength(1);
    expect(body.links[0].url).toBe("https://kajet.test/n/tok-1");
    expect(Object.keys(body.links[0]).sort()).toEqual([
      "createdAt",
      "expiresAt",
      "permission",
      "url",
    ]);

    // Nowa lista: wszystko, z e-mailem i ostatnim otwarciem.
    expect(body.shares).toHaveLength(2);
    expect(body.shares[0]).toMatchObject({
      id: "s1",
      permission: "read",
      email: null,
      anonymousAllowed: true,
      lastUsedAt: PLAIN_SHARE.lastUsedAt.getTime(),
    });
    expect(body.shares[1]).toMatchObject({
      id: "s2",
      permission: "edit",
      email: "ala@poczta.pl",
      anonymousAllowed: false,
    });
  });

  it("cudza notatka dostaje 403", async () => {
    const { listRoute } = await routesWith({
      note: { findUnique: async () => ({ ...NOTE, ownerId: "kto-inny" }) },
    });

    const response = await listRoute.GET(ask(), noteParams);
    expect(response.status).toBe(403);
  });
});

describe("POST /api/v1/notes/[id]/share", () => {
  it("imienne udostępnienie wymusza wejście tylko z kontem i wysyła wiadomość", async () => {
    const { listRoute, sent } = await routesWith({});

    const response = await listRoute.POST(
      ask({ permission: "edit", email: "Ala@Poczta.pl" }),
      noteParams,
    );
    const body = await response.json();

    expect(body.email).toBe("ala@poczta.pl");
    expect(body.anonymousAllowed).toBe(false);
    expect(body.mailSent).toBe(true);
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("zero dni znaczy bezterminowo", async () => {
    const { listRoute, sent } = await routesWith({});

    const body = await (
      await listRoute.POST(ask({ permission: "read", expiresInDays: 0 }), noteParams)
    ).json();

    expect(body.expiresAt).toBeNull();
    expect(body.fresh).toBe(true);
    expect(sent).not.toHaveBeenCalled();
  });

  it("istniejący zwykły odnośnik wraca zamiast mnożyć wpisy", async () => {
    const { listRoute } = await routesWith({
      share: { findFirst: async () => PLAIN_SHARE },
    });

    const body = await (await listRoute.POST(ask({}), noteParams)).json();

    expect(body.id).toBe("s1");
    expect(body.fresh).toBe(false);
    expect(body.url).toBe("https://kajet.test/n/tok-1");
  });
});

describe("DELETE /api/v1/notes/[id]/share/[shareId]", () => {
  const revokeParams = { params: Promise.resolve({ id: "n1", shareId: "s1" }) };

  function askDelete() {
    return new Request("https://kajet.test/api/v1/notes/n1/share/s1", {
      method: "DELETE",
    });
  }

  it("cudzego udostępnienia nie da się cofnąć", async () => {
    const { revokeRoute, prisma } = await routesWith({
      share: {
        findUnique: async () => ({
          id: "s1",
          noteId: "n1",
          note: { ownerId: "kto-inny" },
        }),
      },
    });

    const response = await revokeRoute.DELETE(askDelete(), revokeParams);

    expect(response.status).toBe(403);
    expect(prisma.share.delete).not.toHaveBeenCalled();
  });

  it("właściciel cofa, a wiersz znika", async () => {
    const { revokeRoute, prisma } = await routesWith({
      share: {
        findUnique: async () => ({ id: "s1", noteId: "n1", note: { ownerId: "u1" } }),
      },
    });

    const body = await (await revokeRoute.DELETE(askDelete(), revokeParams)).json();

    expect(body.status).toBe("ok");
    expect(prisma.share.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("już cofnięte liczy się jako zrobione", async () => {
    const { revokeRoute, prisma } = await routesWith({
      share: { findUnique: async () => null },
    });

    const body = await (await revokeRoute.DELETE(askDelete(), revokeParams)).json();

    expect(body.status).toBe("ok");
    expect(prisma.share.delete).not.toHaveBeenCalled();
  });

  it("odnośnik spod innej notatki jest dla pytającego niebyły", async () => {
    const { revokeRoute, prisma } = await routesWith({
      share: {
        findUnique: async () => ({ id: "s1", noteId: "cudza", note: { ownerId: "u1" } }),
      },
    });

    const body = await (await revokeRoute.DELETE(askDelete(), revokeParams)).json();

    expect(body.status).toBe("ok");
    expect(prisma.share.delete).not.toHaveBeenCalled();
  });
});
