"use client";

import { useEffect, useState } from "react";
import { useWords } from "@/components/LanguageProvider";
import type { LiveNote } from "@/components/useLiveNote";

/*
  Pasek obecności przy edytorze: czy jesteśmy połączeni na żywo, kto jeszcze
  ma notatkę otwartą (kropka z inicjałem, w jego stałym kolorze) i - przez
  chwilę po zmianie - od kogo ta zmiana przyszła. Jak w Dokumentach Google,
  tylko skromniej: bez kursorów innych osób.
*/
export function LivePresence<P>({ live }: { live: LiveNote<P> }) {
  const words = useWords();
  const [fresh, setFresh] = useState(false);

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

  const label =
    live.status === "live"
      ? words.liveNow
      : live.status === "connecting"
        ? words.liveConnecting
        : words.liveOffline;

  return (
    <div className="live-presence" aria-live="polite">
      <span className={`live-dot ${live.status}`} aria-hidden="true" />
      <span className="small">{label}</span>
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
        <span className="small live-author">
          {words.liveChangeFrom} {live.lastAuthor.name}
        </span>
      ) : null}
    </div>
  );
}
