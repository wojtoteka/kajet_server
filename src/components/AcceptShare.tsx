"use client";

import { useEffect, useRef, useState } from "react";
import { useWords } from "@/components/LanguageProvider";

/*
  Przyjęcie udostępnienia imiennego - zaraz po otwarciu strony.

  Celowo z przeglądarki i żądaniem POST, a nie przy samym wyświetleniu
  strony: skaner linków w skrzynce pocztowej pobiera adres, ale nie uruchamia
  strony ani nie ma sesji odbiorcy. Do biblioteki trafia więc tylko to, co
  naprawdę otworzył człowiek zalogowany adresem z zaproszenia.
*/
export function AcceptShare({ accept }: { accept: () => Promise<{ accepted: boolean }> }) {
  const words = useWords();
  const [accepted, setAccepted] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    accept()
      .then((result) => setAccepted(result.accepted))
      .catch(() => undefined);
  }, [accept]);

  if (!accepted) return null;
  return (
    <p className="notice" role="status" style={{ marginBottom: 16 }}>
      {words.addedToLibrary}
    </p>
  );
}
