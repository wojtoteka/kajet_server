import { describe, expect, it, vi, beforeEach } from "vitest";

/*
  Testy wpuszczania przez odnośnik do udostępnienia.

  Najważniejsze zdanie: odnośnik „tylko do czytania" NIE MOŻE zapisać - także
  przy wywołaniu akcji wprost, z pominięciem interfejsu. Każda akcja zapisu na
  /n/[token] przechodzi przez tokenWriteAccess, a ten przez shareWriteDecision,
  więc pilnujemy obu pięter: czystej decyzji i bramki z bazą.
*/

vi.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
}));

import {
  shareAccessDecision,
  shareWriteDecision,
  tokenAccess,
  tokenWriteAccess,
  type ShareRules,
} from "./sharing";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { words } from "./i18n";

const OWNER = "owner-1";
const NOW = new Date("2026-08-09T12:00:00Z");

/** Zwykły odnośnik „dla każdego, kto ma link". */
function link(partial: Partial<ShareRules> = {}): ShareRules {
  return {
    permission: "READ",
    email: null,
    anonymousAllowed: true,
    expiresAt: null,
    ...partial,
  };
}

const nobody = { userId: null, email: null };
const stranger = { userId: "user-2", email: "ktos@poczta.pl" };

describe("shareAccessDecision (odczyt)", () => {
  it("wpuszcza każdego na zwykły odnośnik do czytania", () => {
    const decision = shareAccessDecision(link(), OWNER, nobody, NOW);
    expect(decision).toEqual({ allowed: true, canEdit: false, isOwner: false });
  });

  it("odnośnik EDIT daje prawo do zmian", () => {
    const decision = shareAccessDecision(link({ permission: "EDIT" }), OWNER, nobody, NOW);
    expect(decision).toEqual({ allowed: true, canEdit: true, isOwner: false });
  });

  it("wygasły odnośnik odmawia - także właścicielowi", () => {
    const expired = link({ permission: "EDIT", expiresAt: new Date(NOW.getTime() - 1000) });
    expect(shareAccessDecision(expired, OWNER, stranger, NOW)).toEqual({
      allowed: false,
      reason: "expired",
    });
    expect(shareAccessDecision(expired, OWNER, { userId: OWNER, email: null }, NOW)).toEqual({
      allowed: false,
      reason: "expired",
    });
  });

  it("odnośnik imienny bez zalogowania każe się zalogować", () => {
    const personal = link({ email: "ala@poczta.pl" });
    expect(shareAccessDecision(personal, OWNER, nobody, NOW)).toEqual({
      allowed: false,
      reason: "sign-in",
    });
  });

  it("odnośnik imienny otwarty z innego konta odmawia", () => {
    const personal = link({ email: "ala@poczta.pl" });
    expect(shareAccessDecision(personal, OWNER, stranger, NOW)).toEqual({
      allowed: false,
      reason: "someone-else",
    });
  });

  it("odnośnik imienny nie patrzy na wielkość liter adresu", () => {
    const personal = link({ email: "Ala@Poczta.pl", permission: "EDIT" });
    const ala = { userId: "user-3", email: "ala@poczta.PL" };
    expect(shareAccessDecision(personal, OWNER, ala, NOW)).toEqual({
      allowed: true,
      canEdit: true,
      isOwner: false,
    });
  });

  it("wyłączone wejście bez konta wymaga zalogowania", () => {
    const guarded = link({ anonymousAllowed: false });
    expect(shareAccessDecision(guarded, OWNER, nobody, NOW)).toEqual({
      allowed: false,
      reason: "sign-in",
    });
    expect(shareAccessDecision(guarded, OWNER, stranger, NOW)).toEqual({
      allowed: true,
      canEdit: false,
      isOwner: false,
    });
  });

  it("właściciel wchodzący własnym odnośnikiem ma pełne prawa", () => {
    const decision = shareAccessDecision(link(), OWNER, { userId: OWNER, email: null }, NOW);
    expect(decision).toEqual({ allowed: true, canEdit: true, isOwner: true });
  });
});

describe("shareWriteDecision (zapis)", () => {
  it("odnośnik tylko do czytania NIE daje zapisu", () => {
    expect(shareWriteDecision(link(), OWNER, nobody, NOW)).toEqual({
      allowed: false,
      reason: "read-only",
    });
    expect(shareWriteDecision(link(), OWNER, stranger, NOW)).toEqual({
      allowed: false,
      reason: "read-only",
    });
  });

  it("odnośnik EDIT pozwala zapisać - także bez konta", () => {
    const editable = link({ permission: "EDIT" });
    expect(shareWriteDecision(editable, OWNER, nobody, NOW)).toEqual({
      allowed: true,
      isOwner: false,
    });
  });

  it("wygaśnięcie odbiera zapis, choć uprawnienie to EDIT", () => {
    const expired = link({ permission: "EDIT", expiresAt: new Date(NOW.getTime() - 1) });
    expect(shareWriteDecision(expired, OWNER, stranger, NOW)).toEqual({
      allowed: false,
      reason: "expired",
    });
  });

  it("imienny odnośnik EDIT nie zapisze z cudzego konta ani bez konta", () => {
    const personal = link({ permission: "EDIT", email: "ala@poczta.pl" });
    expect(shareWriteDecision(personal, OWNER, stranger, NOW)).toEqual({
      allowed: false,
      reason: "someone-else",
    });
    expect(shareWriteDecision(personal, OWNER, nobody, NOW)).toEqual({
      allowed: false,
      reason: "sign-in",
    });
  });

  it("właściciel zapisuje nawet przez odnośnik tylko do czytania", () => {
    expect(shareWriteDecision(link(), OWNER, { userId: OWNER, email: null }, NOW)).toEqual({
      allowed: true,
      isOwner: true,
    });
  });
});

/*
  Bramka z bazą - dokładnie ta, przez którą przechodzą akcje zapisu strony
  /n/[token]. Cofnięcie udostępnienia to skasowany wiersz, więc "nie ma
  wiersza" MUSI znaczyć "nie ma zapisu" - to jest test na natychmiastowe
  odebranie dostępu po „Cofnij".
*/
describe("tokenWriteAccess", () => {
  const pl = words("pl");

  beforeEach(() => {
    vi.mocked(prisma.share.findUnique).mockReset();
    vi.mocked(auth).mockReset();
    vi.mocked(auth).mockResolvedValue(null as never);
  });

  function shareRow(partial: Record<string, unknown> = {}) {
    return {
      id: "share-1",
      token: "tok",
      permission: "READ",
      email: null,
      anonymousAllowed: true,
      expiresAt: null,
      note: {
        id: "note-1",
        ownerId: OWNER,
        deletedAt: null,
        kind: "TEXT",
        version: 3,
        favorite: false,
        tags: "",
        content: "{}",
      },
      ...partial,
    };
  }

  it("cofnięty (skasowany) odnośnik nie zapisze", async () => {
    vi.mocked(prisma.share.findUnique).mockResolvedValue(null as never);
    const result = await tokenWriteAccess("tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(pl.apiLinkDead);
  });

  it("odnośnik tylko do czytania nie zapisze, choć otwiera stronę", async () => {
    vi.mocked(prisma.share.findUnique).mockResolvedValue(shareRow() as never);

    const read = await tokenAccess("tok");
    expect(read.ok).toBe(true);

    const write = await tokenWriteAccess("tok");
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.reason).toBe(pl.apiShareReadOnly);
  });

  it("odnośnik EDIT zapisuje bez konta", async () => {
    vi.mocked(prisma.share.findUnique).mockResolvedValue(
      shareRow({ permission: "EDIT" }) as never,
    );
    const result = await tokenWriteAccess("tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.access.canEdit).toBe(true);
      expect(result.access.isOwner).toBe(false);
      expect(result.access.userId).toBeNull();
    }
  });

  it("wygasły odnośnik EDIT nie zapisze", async () => {
    vi.mocked(prisma.share.findUnique).mockResolvedValue(
      shareRow({ permission: "EDIT", expiresAt: new Date(Date.now() - 1000) }) as never,
    );
    const result = await tokenWriteAccess("tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(pl.apiLinkExpired);
  });

  it("notatka w koszu nie przyjmuje zapisu przez odnośnik", async () => {
    const row = shareRow({ permission: "EDIT" });
    (row.note as { deletedAt: Date | null }).deletedAt = new Date();
    vi.mocked(prisma.share.findUnique).mockResolvedValue(row as never);
    const result = await tokenWriteAccess("tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(pl.apiLinkDead);
  });
});
