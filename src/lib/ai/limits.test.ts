import { describe, expect, it, vi } from "vitest";

/*
  Początek doby asystenta.

  Doba liczy się od północy, a nie „ostatnie 24 godziny" - po to, żeby dało
  się człowiekowi powiedzieć, kiedy limit wróci. Te przypadki pilnują tego,
  czego nie widać po samym kodzie: że granica leży dokładnie na północy
  zegara serwera i że dwie chwile tego samego dnia trafiają w tę samą granicę,
  a chwila zaraz po północy - już w następną.

  Bez bazy danych: prisma i ustawienia idą na atrapy, bo `startOfToday` nie
  dotyka ani jednego, a moduł je importuje.
*/

async function limity() {
  vi.resetModules();
  vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
  vi.doMock("@/lib/settings", () => ({
    settings: { ai: { callsPerDay: 20, callsPerHour: 5 } },
  }));
  return import("./limits");
}

/**
 * To samo, ale z atrapą bazy, która zapamiętuje warunki zapytań. Dzięki temu
 * widać nie tylko, co liczy `startOfToday`, ale i to, czy ta liczba naprawdę
 * trafia do zapytania o wywołania asystenta.
 */
async function limityZAtrapaBazy(pytania: Array<Record<string, unknown>>) {
  vi.resetModules();
  vi.doMock("@/lib/prisma", () => ({
    prisma: {
      aiCall: {
        count: async ({ where }: { where: Record<string, unknown> }) => {
          pytania.push(where);
          return 0;
        },
        groupBy: async ({ where }: { where: Record<string, unknown> }) => {
          pytania.push(where);
          return [];
        },
      },
    },
  }));
  vi.doMock("@/lib/settings", () => ({
    settings: { ai: { callsPerDay: 20, callsPerHour: 5 } },
  }));
  return import("./limits");
}

describe("startOfToday", () => {
  it("cofa do samej północy, zerując godziny, minuty i sekundy", async () => {
    const { startOfToday } = await limity();
    const start = startOfToday(new Date(2026, 7, 10, 16, 45, 12, 345).getTime());

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(10);
  });

  it("dwie chwile tego samego dnia mają tę samą północ", async () => {
    const { startOfToday } = await limity();
    const rano = startOfToday(new Date(2026, 7, 10, 0, 0, 1).getTime());
    const wieczorem = startOfToday(new Date(2026, 7, 10, 23, 59, 59).getTime());

    expect(rano.getTime()).toBe(wieczorem.getTime());
  });

  it("minuta po północy zaczyna już nową dobę", async () => {
    const { startOfToday } = await limity();
    const przed = startOfToday(new Date(2026, 7, 10, 23, 59, 59).getTime());
    const po = startOfToday(new Date(2026, 7, 11, 0, 0, 1).getTime());

    expect(po.getTime()).toBeGreaterThan(przed.getTime());
    expect(po.getDate()).toBe(11);
  });

  it("północ jest początkiem swojej doby, a nie końcem poprzedniej", async () => {
    const { startOfToday } = await limity();
    const polnoc = new Date(2026, 7, 11, 0, 0, 0, 0);

    expect(startOfToday(polnoc.getTime()).getTime()).toBe(polnoc.getTime());
  });
});

/*
  Czy ta północ naprawdę trafia do zapytania.

  Sam `startOfToday` może być bez zarzutu, a limit i tak liczyć się po
  staremu - wystarczy, że w zapytaniu zostanie dawne `now - 86 400 000`.
  Dlatego tu nie sprawdzamy funkcji pomocniczej, tylko warunek, z jakim
  [checkAiLimit] idzie do bazy.
*/
describe("checkAiLimit pyta bazę o właściwe okno", () => {
  it("dobę liczy od północy, a godzinę przesuwanym oknem", async () => {
    const pytania: Array<Record<string, unknown>> = [];
    const { checkAiLimit, startOfToday } = await limityZAtrapaBazy(pytania);

    const przed = Date.now();
    await checkAiLimit({ id: "u1", aiDailyLimit: 0 }, {} as never);
    const po = Date.now();

    expect(pytania).toHaveLength(2);

    const doba = (pytania[0].createdAt as { gte: Date }).gte;
    expect(doba.getTime()).toBe(startOfToday(przed).getTime());
    expect(doba.getHours()).toBe(0);
    expect(doba.getMinutes()).toBe(0);

    // Godzina zostaje przesuwana: granica leży godzinę wstecz od TERAZ,
    // a nie o pełnej godzinie.
    const godzina = (pytania[1].createdAt as { gte: Date }).gte;
    expect(godzina.getTime()).toBeGreaterThanOrEqual(przed - 3_600_000);
    expect(godzina.getTime()).toBeLessThanOrEqual(po - 3_600_000);
  });

  it("nie bierze okna sprzed doby, czyli nie liczy po staremu", async () => {
    const pytania: Array<Record<string, unknown>> = [];
    const { checkAiLimit } = await limityZAtrapaBazy(pytania);

    const teraz = Date.now();
    await checkAiLimit({ id: "u1", aiDailyLimit: 0 }, {} as never);

    const doba = (pytania[0].createdAt as { gte: Date }).gte;
    // Stare liczenie dawałoby dokładnie 24 godziny wstecz. Północ leży bliżej
    // (chyba że jest równo północ - wtedy oba są tą samą chwilą, ale nawet
    // wtedy stare okno sięgałoby doby wcześniej).
    expect(doba.getTime()).toBeGreaterThan(teraz - 86_400_000);
  });

  /*
    Licznik „dziś" w panelu administratora liczy TO SAMO, co zapora.

    Raz już się rozjechały: zapora dostała północ, a panel został przy
    dwudziestu czterech godzinach - i pokazywałby „dziś 3 z 5" komuś, komu
    asystent przed chwilą odmówił.
  */
  it("panel administratora liczy dobę tak samo jak zapora", async () => {
    const pytania: Array<Record<string, unknown>> = [];
    const { aiUsageForMany, startOfToday } = await limityZAtrapaBazy(pytania);

    const przed = Date.now();
    await aiUsageForMany(["u1"]);

    expect(pytania).toHaveLength(2);
    const doba = (pytania[0].createdAt as { gte: Date }).gte;
    expect(doba.getTime()).toBe(startOfToday(przed).getTime());
  });
});
