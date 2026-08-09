/*
  POST /api/v1/notes/[id]/ai-edit - od strony samej trasy.

  Sedno jest w pierwszym bloku: konto bez uprawnienia ma odbić się od punktu
  końcowego WPROST, z pominięciem aplikacji, i nie dowiedzieć się przy okazji,
  że asystent w ogóle istnieje. Ukrycie przycisku to nie jest zabezpieczenie -
  zabezpieczeniem jest to, że model nie zostaje nawet zapytany, a do bazy nie
  idzie ani jeden zapis.

  Baza i model podstawione, tak jak w share-api.test.ts. Sprawdzana jest sama
  trasa: kolejność bramek, co jedzie do zapisu i czego nie ma prawa zabraknąć.
*/

import { describe, expect, it, vi } from "vitest";
import { buildTextNoteContent } from "@/lib/text-note";

const NOTE_ID = "n1";

const NOTE = {
  id: NOTE_ID,
  ownerId: "u1",
  title: "Zakupy",
  kind: "TEXT",
  content: buildTextNoteContent({ id: NOTE_ID, title: "Zakupy", markdown: "- mleko" }),
  version: 7,
  favorite: true,
  tags: "dom|pilne",
  deletedAt: null as Date | null,
};

const UDANA_ODPOWIEDZ = {
  ok: true as const,
  toolName: "zmien_tekst",
  args: { markdown: "- mleko\n- chleb", opis: "Dopisano chleb." },
  usage: { input: 100, output: 50 },
  tookMs: 1200,
};

type Setup = {
  user?: Partial<{
    id: string;
    canUseAi: boolean;
    aiConsentAt: Date | null;
    aiDailyLimit: number;
  }>;
  note?: Partial<typeof NOTE> | null;
  answer?: unknown;
  /** Ile wywołań konto ma już w oknie limitu. */
  callsSoFar?: number;
};

async function routeWith(setup: Setup = {}) {
  vi.resetModules();

  const user = {
    id: "u1",
    canUseAi: true,
    aiConsentAt: new Date("2026-08-01T00:00:00.000Z"),
    aiDailyLimit: 0,
    ...setup.user,
  };
  const note = setup.note === null ? null : { ...NOTE, ...setup.note };

  const askGemini = vi.fn(async () => setup.answer ?? UDANA_ODPOWIEDZ);
  const upsertNoteForUser = vi.fn(async () => ({
    status: "saved" as const,
    version: 8,
    updatedAt: 1_754_000_000_000,
  }));
  const upsertCodeNoteForUser = vi.fn(async () => ({
    status: "saved" as const,
    version: 8,
    updatedAt: 1_754_000_000_000,
  }));

  const prisma = {
    note: { findUnique: async () => note },
    aiTurn: {
      findMany: async () => [],
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    aiCall: {
      // Ile wywołań ma już na koncie: zero, chyba że próba mówi inaczej.
      count: vi.fn(async () => setup.callsSoFar ?? 0),
      create: vi.fn(async () => ({})),
    },
  };

  vi.doMock("@/lib/prisma", () => ({ prisma }));
  vi.doMock("@/lib/settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/settings")>()),
    aiWorks: () => true,
  }));
  vi.doMock("@/lib/ai/gemini", () => ({ askGemini }));
  vi.doMock("@/lib/note-write", () => ({ upsertNoteForUser, upsertCodeNoteForUser }));
  vi.doMock("@/lib/api", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
    return { ...actual, userFromRequest: async () => ({ user }) };
  });

  const route = await import("@/app/api/v1/notes/[id]/ai-edit/route");
  return { route, askGemini, upsertNoteForUser, upsertCodeNoteForUser, prisma };
}

function ask(instruction = "dopisz chleb", extra: Record<string, unknown> = {}) {
  return new Request(`https://kajet.test/api/v1/notes/${NOTE_ID}/ai-edit`, {
    method: "POST",
    body: JSON.stringify({ instruction, ...extra }),
  });
}

const noteParams = { params: Promise.resolve({ id: NOTE_ID }) };

describe("bez uprawnienia nie da się wywołać punktu, także z pominięciem aplikacji", () => {
  it("odpowiada tak samo jak nieistniejący adres i nie pyta modelu", async () => {
    const { route, askGemini, upsertNoteForUser } = await routeWith({
      user: { canUseAi: false },
    });

    const response = await route.POST(ask(), noteParams);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("no-route");
    // Ani jednego tokenu i ani jednego zapisu.
    expect(askGemini).not.toHaveBeenCalled();
    expect(upsertNoteForUser).not.toHaveBeenCalled();

    // Co do znaku to samo, co na dowolny nieznany adres pod /api.
    const unknown = await import("@/app/api/[...sciezka]/route");
    const missing = await unknown.POST();
    expect(await missing.json()).toEqual(body);
  });

  it("nawet gdy serwer nie ma klucza, a konto ma wszystko nadane", async () => {
    vi.resetModules();
    vi.doMock("@/lib/settings", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/settings")>()),
      aiWorks: () => false,
    }));
    vi.doMock("@/lib/api", async () => {
      const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
      return {
        ...actual,
        userFromRequest: async () => ({
          user: { id: "u1", canUseAi: true, aiConsentAt: new Date() },
        }),
      };
    });
    const askGemini = vi.fn();
    vi.doMock("@/lib/ai/gemini", () => ({ askGemini }));

    const route = await import("@/app/api/v1/notes/[id]/ai-edit/route");
    const response = await route.POST(ask(), noteParams);

    expect(response.status).toBe(404);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("uprawnienie bez zgody odbija się na 403 i też nie rusza modelu", async () => {
    const { route, askGemini } = await routeWith({ user: { aiConsentAt: null } });

    const response = await route.POST(ask(), noteParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("ai-no-consent");
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("cudzej notatki nie tknie nawet konto z pełnym dostępem", async () => {
    const { route, askGemini } = await routeWith({ note: { ownerId: "ktos-inny" } });

    const response = await route.POST(ask(), noteParams);

    expect(response.status).toBe(403);
    expect(askGemini).not.toHaveBeenCalled();
  });
});

describe("czego asystent nie tyka", () => {
  it("notatki odręcznej", async () => {
    const { route, askGemini } = await routeWith({ note: { kind: "HANDWRITTEN" } });

    const response = await route.POST(ask(), noteParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("wrong-kind");
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("notatki z kosza", async () => {
    const { route } = await routeWith({ note: { deletedAt: new Date() } });
    expect((await route.POST(ask(), noteParams)).status).toBe(404);
  });

  it("notatki większej niż limit - i mówi ile ma znaków, zamiast ją obciąć", async () => {
    const huge = "x".repeat(70_000);
    const { route, askGemini } = await routeWith({
      note: {
        content: buildTextNoteContent({ id: NOTE_ID, title: "Duża", markdown: huge }),
      },
    });

    const response = await route.POST(ask(), noteParams);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.message).toContain("70");
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("pustego polecenia", async () => {
    const { route, askGemini } = await routeWith();
    const response = await route.POST(ask("   "), noteParams);

    expect(response.status).toBe(400);
    expect(askGemini).not.toHaveBeenCalled();
  });
});

describe("limity i rozliczanie", () => {
  it("wyczerpany limit odbija żądanie, zanim cokolwiek pójdzie do Google", async () => {
    const { route, askGemini } = await routeWith({ callsSoFar: 500 });

    const response = await route.POST(ask(), noteParams);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("ai-limit");
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("udane wywołanie zostawia ślad w rozliczeniach, bez treści notatki", async () => {
    const { route, prisma } = await routeWith();
    await route.POST(ask("dopisz chleb"), noteParams);

    const [[call]] = prisma.aiCall.create.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(call.data).toMatchObject({
      userId: "u1",
      kind: "TEXT",
      inputTokens: 100,
      outputTokens: 50,
      failure: null,
    });
    // Ani polecenia, ani treści, ani identyfikatora notatki.
    const written = JSON.stringify(call.data);
    expect(written).not.toContain("chleb");
    expect(written).not.toContain(NOTE_ID);
  });

  it("nieudane wywołanie też się liczy - za tokeny wejścia płaci się tak czy owak", async () => {
    const { route, prisma } = await routeWith({
      answer: { ok: false, failure: "no-call", usage: { input: 900, output: 12 }, tookMs: 800 },
    });

    await route.POST(ask(), noteParams);

    expect(prisma.aiCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failure: "no-call", inputTokens: 900 }),
      }),
    );
  });
});

describe("udana zmiana", () => {
  it("zapisuje zwykłą drogą, na wersji sprzed wywołania modelu", async () => {
    const { route, upsertNoteForUser } = await routeWith();

    const body = await (await route.POST(ask(), noteParams)).json();

    expect(body.status).toBe("zmieniono");
    expect(body.opis).toBe("Dopisano chleb.");
    expect(body.version).toBe(8);

    const [userId, sent] = upsertNoteForUser.mock.calls[0] as [string, Record<string, unknown>];
    expect(userId).toBe("u1");
    // Wersja odczytana PRZED pytaniem modelu - dzięki temu zapis człowieka,
    // który wpadł w międzyczasie, sam wygra na istniejącym wykrywaniu konfliktu.
    expect(sent.baseVersion).toBe(7);
    // Gwiazdka i znaczniki muszą wrócić takie, jakie były: upsert nadpisuje je
    // tym, co dostanie, więc pominięcie skasowałoby jedno i drugie.
    expect(sent.favorite).toBe(true);
    expect(sent.tags).toEqual(["dom", "pilne"]);
    expect(String(sent.content)).toContain("chleb");
  });

  it("zapamiętuje wymianę w historii", async () => {
    const { route, prisma } = await routeWith();
    await route.POST(ask("dopisz chleb"), noteParams);

    expect(prisma.aiTurn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ request: "dopisz chleb", reply: "Dopisano chleb." }),
      }),
    );
  });

  it("odmawia od razu, gdy urządzenie ma starszą wersję niż serwer", async () => {
    const { route, askGemini } = await routeWith();

    const body = await (await route.POST(ask("cokolwiek", { baseVersion: 3 }), noteParams)).json();

    expect(body).toEqual({ status: "konflikt", version: 7 });
    // Nie ma po co płacić za zmianę treści, której człowiek jeszcze nie widział.
    expect(askGemini).not.toHaveBeenCalled();
  });
});

describe("gdy coś pójdzie nie tak, notatka zostaje nietknięta", () => {
  it("model milczy za długo", async () => {
    const { route, upsertNoteForUser } = await routeWith({
      answer: { ok: false, failure: "timeout", usage: { input: 0, output: 0 }, tookMs: 60_000 },
    });

    const response = await route.POST(ask(), noteParams);

    expect(response.status).toBe(504);
    expect(upsertNoteForUser).not.toHaveBeenCalled();
  });

  it("skończył się limit po stronie Google", async () => {
    const { route, upsertNoteForUser } = await routeWith({
      answer: { ok: false, failure: "rate-limit", usage: { input: 0, output: 0 }, tookMs: 300 },
    });

    expect((await route.POST(ask(), noteParams)).status).toBe(429);
    expect(upsertNoteForUser).not.toHaveBeenCalled();
  });

  it("model oddał kształt, którego nie da się zapisać", async () => {
    const { route, upsertNoteForUser } = await routeWith({
      answer: {
        ok: true,
        toolName: "zmien_tekst",
        args: { markdown: 42, opis: "" },
        usage: { input: 10, output: 10 },
        tookMs: 500,
      },
    });

    const response = await route.POST(ask(), noteParams);

    expect(response.status).toBe(422);
    expect(upsertNoteForUser).not.toHaveBeenCalled();
  });

  it("ktoś zapisał notatkę, kiedy model nad nią pracował - jego wersja wygrywa", async () => {
    vi.resetModules();
    const { route } = await routeWith();
    // Podmieniamy wynik zapisu na konflikt, tak jak zrobiłby to prawdziwy upsert.
    const noteWrite = await import("@/lib/note-write");
    vi.mocked(noteWrite.upsertNoteForUser).mockResolvedValueOnce({
      status: "conflict",
      message: "Ktoś był szybszy.",
      onServer: { version: 9 },
    } as never);

    const body = await (await route.POST(ask(), noteParams)).json();
    expect(body).toEqual({ status: "konflikt", version: 9 });
  });
});

describe("dopytanie", () => {
  it("nie zapisuje niczego i oddaje pytanie", async () => {
    const { route, upsertNoteForUser, prisma } = await routeWith({
      answer: {
        ok: true,
        toolName: "dopytaj",
        args: { pytanie: "Który akapit skrócić?" },
        usage: { input: 80, output: 20 },
        tookMs: 700,
      },
    });

    const body = await (await route.POST(ask("skróć"), noteParams)).json();

    expect(body).toEqual({ status: "pytanie", pytanie: "Który akapit skrócić?" });
    expect(upsertNoteForUser).not.toHaveBeenCalled();
    // Pytanie też wchodzi do historii - inaczej odpowiedź „ten drugi" wisiałaby w próżni.
    expect(prisma.aiTurn.create).toHaveBeenCalled();
  });
});
