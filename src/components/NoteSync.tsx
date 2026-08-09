"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createNoteSync, type NoteNow, type NoteSyncStore } from "@/lib/note-sync-store";

/*
  Wspólna wiedza edytora i asystenta o tym, co o notatce wie SERWER.

  Był tu cichy, brzydki błąd. Autozapis celowo nie odświeża strony notatki -
  przerysowanie wszystkiego w trakcie pisania gubiło kursor. Skutek: numer
  wersji wypisany przez serwer starzeje się po pierwszym autozapisie, a panel
  asystenta brał go prosto z propsa. Wystarczyło dopisać jedno słowo i poprosić
  KajetAI o cokolwiek, żeby dostać „Ta notatka zmieniła się w innym miejscu" -
  choć zmieniła się w tym samym oknie, przed chwilą, ręką tego samego
  człowieka.

  Teraz edytor melduje tutaj każdy zapis, a asystent czyta stąd, a nie z propsa.

  Drugie zadanie tego miejsca: `settle()`. Zanim KajetAI cokolwiek przeczyta,
  to co jest w edytorze musi być na serwerze - model czyta notatkę z bazy, nie
  z ekranu. `settle()` wymusza zapis i czeka na odpowiedź. Przy notatce, której
  jeszcze nie ma, ten sam zapis ją zakłada i oddaje jej identyfikator - dzięki
  temu można poprosić o pomoc, zanim notatka w ogóle zostanie nazwana.

  Sam rachunek siedzi w lib/note-sync-store.ts, bez Reacta - dzięki temu ma
  własne próby. Tutaj zostaje samo przekazanie go w dół drzewa.
*/

export type { NoteNow };

const NoteSyncContext = createContext<NoteSyncStore | null>(null);

export function NoteSyncProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createNoteSync);
  return <NoteSyncContext.Provider value={store}>{children}</NoteSyncContext.Provider>;
}

/** Null poza stroną notatki - wtedy nie ma z czym się umawiać. */
export function useNoteSync(): NoteSyncStore | null {
  return useContext(NoteSyncContext);
}

/**
 * Edytor zostawia swój zapis do dyspozycji asystenta.
 *
 * Przekazana funkcja oddaje `true`, gdy jest na co czekać - czyli gdy zapis
 * ruszył albo właśnie leci. `false` znaczy „serwer ma już wszystko".
 */
export function useNoteFlush(save: () => boolean): void {
  const sync = useNoteSync();
  const latest = useRef(save);
  latest.current = save;

  useEffect(() => {
    if (!sync) return;
    sync.register(() => latest.current());
    return () => sync.register(null);
  }, [sync]);
}
