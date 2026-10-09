"use client";

import { useEffect, useState } from "react";
import { useWords } from "@/components/LanguageProvider";
import type { LiveNote } from "@/components/useLiveNote";

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

  // Gdy w notatce jest ktoś jeszcze, jego inicjały same mówią, że jesteśmy
  // połączeni - napis mówi wtedy, czyje to kółka.
  const together = live.status === "live" && live.people.length > 0;
  const label = together
    ? words.liveAlsoHere
    : live.status === "live"
      ? words.liveNow
      : live.status === "connecting"
        ? words.liveConnecting
        : words.liveOffline;

  return (
    <div
      className={`live-presence ${live.status}`}
      data-status={live.status}
      title={live.status === "live" ? words.liveNowHint : undefined}
      aria-live="polite"
    >
      <span>{label}</span>
      {live.people.length > 0 ? (
        <span className="live-people" aria-label={together ? undefined : words.liveAlsoHere}>
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
