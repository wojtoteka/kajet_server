"use client";

import { useEffect, useRef, useState } from "react";
import { useNoteSync } from "@/components/NoteSync";

/**
 * Trzyma to, co o notatce wie serwer: jej identyfikator i ostatnią wersję.
 *
 * Nowa notatka nie ma jeszcze identyfikatora. Pierwszy autozapis ją zakłada
 * i oddaje `noteId` — od tej chwili edytor dopisuje do tej samej notatki
 * zamiast zakładać kolejną, a adres w pasku podmieniamy na `/note/<id>`
 * (bez przeładowania, żeby nie przerwać pisania). Odświeżenie strony trafia
 * już w notatkę, nie w pusty formularz.
 *
 * Wersja z odpowiedzi jedzie jako `baseVersion` następnego zapisu — bez tego
 * drugi zapis z rzędu wpadałby w konflikt sam ze sobą.
 */
export function useSavedNote({
  noteId,
  version,
  state,
}: {
  noteId?: string;
  version?: number;
  state: { version?: number; noteId?: string };
}): { noteId?: string; version?: number; saved: boolean } {
  const [currentId, setCurrentId] = useState(noteId);
  const [liveVersion, setLiveVersion] = useState(version);
  const [saved, setSaved] = useState(false);
  const addressed = useRef(Boolean(noteId));
  const sync = useNoteSync();
  const known = useRef({ noteId, version });

  useEffect(() => {
    if (state.version != null) {
      setLiveVersion(state.version);
      setSaved(true);
      known.current.version = state.version;
    }
    if (state.noteId) {
      const fresh = state.noteId;
      setCurrentId((previous) => previous ?? fresh);
      known.current.noteId = known.current.noteId ?? fresh;
      if (!addressed.current) {
        addressed.current = true;
        window.history.replaceState(null, "", `/note/${fresh}`);
      }
    }
    /*
      Meldunek dla asystenta idzie po KAŻDEJ odpowiedzi serwera, także po
      takiej, z której nic nie wynika (błąd, konflikt, „bez zmian"). Panel
      czeka na ten meldunek przed wysłaniem notatki do modelu i musi się
      doczekać - inaczej stałby do wyczerpania cierpliwości przy każdym
      nieudanym zapisie.
    */
    sync?.publish({ ...known.current });
  }, [state, sync]);

  return { noteId: currentId, version: liveVersion, saved };
}
