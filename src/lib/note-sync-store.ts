/*
  Umowa między edytorem a asystentem, bez Reacta.

  Rzecz jest mała, ale to na niej stoi naprawa dwóch usterek naraz, więc ma
  własne próby zamiast siedzieć w komponencie:

  - „Ta notatka zmieniła się w innym miejscu" po dopisaniu jednego słowa.
    Autozapis celowo nie odświeża strony notatki, więc numer wersji wypisany
    przez serwer starzeje się natychmiast, a panel brał go prosto z propsa.
    Teraz edytor melduje każdą odpowiedź serwera tutaj, a panel czyta stąd.

  - KajetAI przy notatce, której jeszcze nie ma. `settle()` każe edytorowi
    zapisać to, co ma, i czeka na odpowiedź; ten sam zapis notatkę ZAKŁADA
    i oddaje jej identyfikator.

  Dwie rzeczy są tu ważniejsze, niż wyglądają:

  1. Wersje tylko rosną. Meldunki z dwóch zapisów potrafią przyjść nie po
     kolei, a starsza wersja jako podstawa następnego zapisu to dokładnie ten
     konflikt, który naprawiamy.

  2. Czekanie ZAWSZE się kończy. Gdy zapis w ogóle nie ruszył - bo nie było co
     zapisywać - nie ma na co czekać i odpowiedź jest natychmiastowa. Gdy
     ruszył, ale serwer milczy, po `patienceMs` idziemy dalej z tym, co wiemy.
     Panel asystenta nie ma prawa zawisnąć na zapisie.
*/

export type NoteNow = {
  noteId?: string;
  version?: number;
};

export type NoteSyncStore = {
  /** Co wiadomo o notatce teraz. */
  now: () => NoteNow;
  /** Edytor: „tyle wie serwer po moim ostatnim zapisie". */
  publish: (fresh: NoteNow) => void;
  /**
   * Edytor zostawia sposób na „zapisz natychmiast". Funkcja oddaje true, gdy
   * jest na co czekać - czyli gdy zapis ruszył albo właśnie leci.
   */
  register: (save: (() => boolean) | null) => void;
  /** Zapisz to, co w edytorze, i poczekaj, aż serwer odpowie. */
  settle: () => Promise<NoteNow>;
};

export function createNoteSync(options?: {
  /** Ile czekamy na odpowiedź serwera, zanim ruszymy z tym, co wiemy. */
  patienceMs?: number;
  /** Wstrzykiwane w próbach, żeby nie czekać naprawdę. */
  timers?: {
    set: (run: () => void, ms: number) => number;
    clear: (handle: number) => void;
  };
}): NoteSyncStore {
  const patienceMs = options?.patienceMs ?? 20_000;
  const timers = options?.timers ?? {
    set: (run, ms) => globalThis.setTimeout(run, ms) as unknown as number,
    clear: (handle) => globalThis.clearTimeout(handle),
  };

  let state: NoteNow = {};
  let save: (() => boolean) | null = null;
  let waiting: ((fresh: NoteNow) => void)[] = [];

  return {
    now: () => state,

    publish(fresh) {
      state = {
        noteId: fresh.noteId ?? state.noteId,
        version: Math.max(fresh.version ?? 0, state.version ?? 0) || undefined,
      };
      const queue = waiting;
      waiting = [];
      for (const resolve of queue) resolve(state);
    },

    register(fn) {
      save = fn;
    },

    settle() {
      // Zapis nie ruszył, bo nie było czego zapisywać. Serwer ma już wszystko.
      const started = save?.() ?? false;
      if (!started) return Promise.resolve(state);

      return new Promise<NoteNow>((resolve) => {
        let waiter: (fresh: NoteNow) => void = () => {};
        const handle = timers.set(() => {
          waiting = waiting.filter((entry) => entry !== waiter);
          resolve(state);
        }, patienceMs);
        waiter = (fresh) => {
          timers.clear(handle);
          resolve(fresh);
        };
        waiting.push(waiter);
      });
    },
  };
}
