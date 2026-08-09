/*
  Umowa edytora z asystentem.

  Sprawdzane jest dokładnie to, co było zepsute: że asystent dostaje wersję PO
  ostatnim autozapisie (a nie tę wypisaną przy otwieraniu strony), że dostaje
  identyfikator notatki założonej dopiero przez ten zapis, i że czekanie na
  zapis zawsze się kończy.
*/

import { describe, expect, it } from "vitest";
import { createNoteSync } from "@/lib/note-sync-store";

/** Zegar, który nie tyka sam - próby przesuwają go ręcznie. */
function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    timers: {
      set: (run: () => void) => {
        const handle = next++;
        pending.set(handle, run);
        return handle;
      },
      clear: (handle: number) => {
        pending.delete(handle);
      },
    },
    fire: () => {
      const all = [...pending.values()];
      pending.clear();
      for (const run of all) run();
    },
    waiting: () => pending.size,
  };
}

describe("umowa edytora z asystentem", () => {
  it("na początku nie wie o notatce nic", () => {
    expect(createNoteSync().now()).toEqual({});
  });

  it("bez zarejestrowanego zapisu oddaje to, co wie, i nie czeka", async () => {
    const sync = createNoteSync();
    sync.publish({ noteId: "abc", version: 3 });
    await expect(sync.settle()).resolves.toEqual({ noteId: "abc", version: 3 });
  });

  it("gdy nie ma czego zapisywać, odpowiada natychmiast", async () => {
    const clock = fakeTimers();
    const sync = createNoteSync({ timers: clock.timers });
    sync.publish({ noteId: "abc", version: 3 });
    // false znaczy „serwer ma już wszystko".
    sync.register(() => false);

    await expect(sync.settle()).resolves.toEqual({ noteId: "abc", version: 3 });
    expect(clock.waiting()).toBe(0);
  });

  /*
    Sedno naprawy: strona wypisała wersję 1, potem autozapis podbił ją do 4,
    a strona się nie odświeżyła. Asystent musi dostać 4.
  */
  it("oddaje wersję po ostatnim zapisie, a nie tę z otwarcia strony", async () => {
    const sync = createNoteSync();
    sync.publish({ noteId: "abc", version: 1 });

    let saved = false;
    sync.register(() => {
      saved = true;
      return true;
    });

    const czekanie = sync.settle();
    expect(saved).toBe(true);
    sync.publish({ noteId: "abc", version: 4 });

    await expect(czekanie).resolves.toEqual({ noteId: "abc", version: 4 });
  });

  it("notatka założona dopiero tym zapisem oddaje swój identyfikator", async () => {
    const sync = createNoteSync();
    sync.register(() => true);

    const czekanie = sync.settle();
    sync.publish({ noteId: "swiezy", version: 1 });

    await expect(czekanie).resolves.toEqual({ noteId: "swiezy", version: 1 });
    expect(sync.now().noteId).toBe("swiezy");
  });

  /*
    Meldunki z dwóch zapisów potrafią przyjść nie po kolei. Starsza wersja jako
    podstawa następnego zapisu to dokładnie ten konflikt, który naprawiamy -
    więc wersja ma tylko rosnąć.
  */
  it("nie cofa wersji, gdy meldunki przyjdą nie po kolei", () => {
    const sync = createNoteSync();
    sync.publish({ noteId: "abc", version: 7 });
    sync.publish({ noteId: "abc", version: 5 });
    expect(sync.now().version).toBe(7);
  });

  it("meldunek bez wersji nie kasuje tego, co już wiadomo", () => {
    const sync = createNoteSync();
    sync.publish({ noteId: "abc", version: 7 });
    sync.publish({});
    expect(sync.now()).toEqual({ noteId: "abc", version: 7 });
  });

  it("milczący serwer nie zawiesza asystenta na zawsze", async () => {
    const clock = fakeTimers();
    const sync = createNoteSync({ timers: clock.timers });
    sync.publish({ noteId: "abc", version: 2 });
    sync.register(() => true);

    const czekanie = sync.settle();
    expect(clock.waiting()).toBe(1);
    // Odpowiedź nie przyszła - cierpliwość się kończy.
    clock.fire();

    await expect(czekanie).resolves.toEqual({ noteId: "abc", version: 2 });
  });

  it("odpowiedź serwera kasuje odliczanie cierpliwości", async () => {
    const clock = fakeTimers();
    const sync = createNoteSync({ timers: clock.timers });
    sync.register(() => true);

    const czekanie = sync.settle();
    sync.publish({ noteId: "abc", version: 1 });
    await czekanie;

    expect(clock.waiting()).toBe(0);
  });

  it("jeden meldunek budzi wszystkich, którzy czekają", async () => {
    const sync = createNoteSync();
    sync.register(() => true);

    const oba = Promise.all([sync.settle(), sync.settle()]);
    sync.publish({ noteId: "abc", version: 9 });

    await expect(oba).resolves.toEqual([
      { noteId: "abc", version: 9 },
      { noteId: "abc", version: 9 },
    ]);
  });

  it("wyrejestrowany edytor nie zostawia po sobie czekania", async () => {
    const sync = createNoteSync();
    sync.register(() => true);
    sync.register(null);
    sync.publish({ noteId: "abc", version: 2 });

    await expect(sync.settle()).resolves.toEqual({ noteId: "abc", version: 2 });
  });
});
