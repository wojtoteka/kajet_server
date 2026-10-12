/*
  POST /api/v1/notes/[id]/ai-history - rozmowa z czasu wstrzymanej
  synchronizacji dociera na serwer dopiero po wznowieniu.
*/

import { describe, expect, it, vi } from "vitest";

async function routeWith(note: { ownerId: string } | null = { ownerId: "u1" }) {
  vi.resetModules();
  const prisma = {
    note: { findUnique: async () => note },
    aiTurn: {
      findMany: async () => [],
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  vi.doMock("@/lib/prisma", () => ({ prisma }));
  vi.doMock("@/lib/settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/settings")>()),
    aiWorks: () => true,
  }));
  vi.doMock("@/lib/api", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
    return {
      ...actual,
      userFromRequest: async () => ({
        user: { id: "u1", canUseAi: true, aiConsentAt: new Date(), aiDailyLimit: 0 },
      }),
    };
  });
  const route = await import("@/app/api/v1/notes/[id]/ai-history/route");
  return { route, prisma };
}

const params = { params: Promise.resolve({ id: "n1" }) };

function post(body: unknown) {
  return new Request("https://kajet.test/api/v1/notes/n1/ai-history", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("dosłanie rozmowy po wznowieniu synchronizacji", () => {
  it("dopisuje wymiany po kolei, od najstarszej", async () => {
    const { route, prisma } = await routeWith();

    const response = await route.POST(
      post({
        turns: [
          { request: "dopisz masło", reply: "Dopisano masło." },
          { request: "dopisz chleb", reply: "Dopisano chleb." },
        ],
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(prisma.aiTurn.create).toHaveBeenCalledTimes(2);
    const first = (prisma.aiTurn.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0];
    expect(first.data).toMatchObject({ userId: "u1", noteId: "n1", request: "dopisz masło" });
  });

  it("cudzej notatki nie dotyka", async () => {
    const { route, prisma } = await routeWith({ ownerId: "ktos-inny" });

    const response = await route.POST(post({ turns: [{ request: "a", reply: "b" }] }), params);

    expect(response.status).toBe(403);
    expect(prisma.aiTurn.create).not.toHaveBeenCalled();
  });

  it("notatki, której serwer jeszcze nie ma, nie przyjmuje - aplikacja spróbuje po synchronizacji", async () => {
    const { route } = await routeWith(null);

    const response = await route.POST(post({ turns: [{ request: "a", reply: "b" }] }), params);

    expect(response.status).toBe(404);
  });
});
