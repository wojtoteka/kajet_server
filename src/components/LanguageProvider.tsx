"use client";

/*
  Napisy dla części klienckiej.

  Komponenty serwerowe biorą je przez `currentWords()` z lib/language.ts, ale
  edytory są klienckie („use client") i nie mają dostępu do ciasteczek serwera.
  Dlatego język, który serwer już zna, przekazujemy im w dół drzewa raz - tutaj -
  a one czytają go hakiem [useWords].

  Sam słownik siedzi w lib/i18n.ts i nie dotyka `next/headers`, więc wchodzi do
  paczki przeglądarki bez problemu.
*/

import { createContext, useContext } from "react";
import { DEFAULT_LANGUAGE, words, type Language, type Words } from "@/lib/i18n";

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** Napisy dla tego widoku. Bez dostawcy - polski, czyli domyślny język strony. */
export function useWords(): Words {
  return words(useContext(LanguageContext));
}
