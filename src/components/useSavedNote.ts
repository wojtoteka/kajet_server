"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (state.version != null) {
      setLiveVersion(state.version);
      setSaved(true);
    }
    if (!state.noteId) return;
    const fresh = state.noteId;
    setCurrentId((previous) => previous ?? fresh);
    if (addressed.current) return;
    addressed.current = true;
    window.history.replaceState(null, "", `/note/${fresh}`);
  }, [state]);

  return { noteId: currentId, version: liveVersion, saved };
}
