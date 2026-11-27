"use client";

import { useEffect, useRef, useState } from "react";
import { useWords } from "@/components/LanguageProvider";
import type { LiveNote, LiveStatus } from "@/components/useLiveNote";
import { calmLiveShown, calmRecheckIn, type LiveShown } from "@/lib/live/calm";

/**
 * Napis łącza bez migania: „Połączono" albo „Offline", krótkie zerwania
 * strumienia go nie ruszają (lib/live/calm.ts).
 */
function useCalmStatus(status: LiveStatus): LiveShown {
  const [shown, setShown] = useState<LiveShown>("none");
  // Od kiedy strumień nie jest na żywo - nie od każdej próby łączenia.
  const since = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (status === "live" || status === "off") since.current = null;
    else since.current ??= now;
    const start = since.current ?? now;
    const next = calmLiveShown(shown, status, now - start);
    setShown(next);
    const wait = calmRecheckIn(next, status, now - start);
    if (wait === null) return;
    const timer = setTimeout(() => setShown((current) => calmLiveShown(current, status, Date.now() - start)), wait);
    return () => clearTimeout(timer);
    // `shown` celowo poza zależnościami: liczy się tylko zmiana stanu strumienia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return shown;
}

/*
  Stan edycji na żywo w wierszu etykiety „Tytuł", po prawej: czy jesteśmy
  połączeni, kto jeszcze ma notatkę otwartą (kółko z inicjałem, w jego
  stałym kolorze) i - przez chwilę po zmianie - od kogo ta zmiana przyszła.
  Jak w Dokumentach Google, tylko skromniej: bez kursorów innych osób.

  Sam napis, bez kropki stanu: kropka, która przy otwieraniu notatki
  zmieniała kolor, wyglądała jak animacja i odciągała wzrok od pisania.
*/
export function LivePresence<P>({ live }: { live: LiveNote<P> }) {
  const words = useWords();
  const [fresh, setFresh] = useState(false);
  const shown = useCalmStatus(live.status);

  useEffect(() => {
    if (!live.lastAuthor) return;
    setFresh(true);
    const timer = setTimeout(() => setFresh(false), 4_000);
    return () => clearTimeout(timer);
  }, [live.lastAuthor]);

  if (live.status === "off") return null;

  if (live.gone) {
    return (
      <p className="error" role="alert">
        {words.liveGone}
      </p>
    );
  }

  // Pierwsze łączenie po otwarciu: chwila ciszy zamiast „Łączę…".
  if (shown === "none") return null;

  // Tylko dwa napisy: „Połączono" albo „Offline". Kółka z inicjałami stoją
  // obok i same mówią, kto jeszcze jest w notatce.
  const connected = shown === "connected";
  const label = connected ? words.liveNow : words.liveOffline;
  const look = connected ? "live" : "offline";

  return (
    <div
      className={`live-presence ${look}`}
      data-status={look}
      title={connected ? words.liveNowHint : undefined}
      aria-live="polite"
    >
      <span>{label}</span>
      {live.people.length > 0 ? (
        <span className="live-people" aria-label={words.liveAlsoHere}>
          {live.people.map((person) => (
            <span
              key={person.client}
              className={`live-person tone-${person.color}`}
              title={person.app ? `${person.name} (${words.liveAppMark})` : person.name}
            >
              {(person.name.trim()[0] ?? "?").toUpperCase()}
            </span>
          ))}
        </span>
      ) : null}
      {fresh && live.lastAuthor ? (
        <span className="live-author">
          {words.liveChangeFrom} {live.lastAuthor.name}
        </span>
      ) : null}
    </div>
  );
}
