"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { AiPanel, type AiPanelProps } from "@/components/AiPanel";
import { NoteSyncProvider } from "@/components/NoteSync";

/*
  Sklejka między asystentem a edytorem.

  Po zmianie od asystenta strona dostaje z serwera świeżą treść notatki - widać
  to po nagłówku, który od razu pokazuje nową wersję i rozmiar. Edytor jej
  jednak nie pokazywał: treść siedzi w nim w stanie ustawionym RAZ, przy
  pierwszym narysowaniu (splitTextBlocks(markdown), useState(initial.nodes),
  useState(source)), i do propsa więcej nie zagląda. Trzeba było odświeżyć
  kartę - a razem z tym zostawał stary numer wersji, więc pierwszy zapis po
  zmianie asystenta wpadał jeszcze w konflikt.

  Rozwiązanie: przemontowanie edytora kluczem. Klucz podbija się DOPIERO wtedy,
  gdy wersja podana przez serwer dogoni tę, którą zgłosił asystent - czyli gdy
  świeża treść naprawdę już przyszła. Dzięki temu nie ma wyścigu z odświeżaniem
  danych, a edytor przerysowuje się WYŁĄCZNIE po zmianie asystenta. Zwykły
  zapis i autozapis też podbijają wersję notatki, ale wtedy nikt niczego nie
  zgłosił - i kursor zostaje tam, gdzie był.

  NoteSyncProvider owija oba: to przez niego edytor melduje asystentowi, ile
  wynosi wersja PO ostatnim autozapisie, i to przez niego asystent każe
  zapisać notatkę, zanim wyśle ją do modelu.

  Panel stoi po dzieciach, bo asystent ma być pod edytorem, nie nad nim.
*/
export function NoteLive({
  version,
  ai,
  children,
}: {
  /** Wersja notatki prosto z serwera. Zero przy notatce jeszcze niezałożonej. */
  version: number;
  /** Propsy panelu albo null, gdy asystenta przy tej notatce nie ma. */
  ai: Omit<AiPanelProps, "onApplied"> | null;
  children: ReactNode;
}) {
  const [seed, setSeed] = useState(0);
  /** Wersja zgłoszona przez asystenta, na którą czekamy. Null = nie czekamy. */
  const wanted = useRef<number | null>(null);

  useEffect(() => {
    if (wanted.current === null || version < wanted.current) return;
    wanted.current = null;
    setSeed((count) => count + 1);
  }, [version]);

  return (
    <NoteSyncProvider>
      <Fragment key={seed}>{children}</Fragment>
      {ai ? (
        <AiPanel
          {...ai}
          onApplied={(applied) => {
            wanted.current = applied;
          }}
        />
      ) : null}
    </NoteSyncProvider>
  );
}
