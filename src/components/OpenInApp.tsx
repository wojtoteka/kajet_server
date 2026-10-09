"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";

/*
  „Otwórz w aplikacji Kajet" - na Androidzie, kiedy odnośnik otworzył się
  w przeglądarce zamiast od razu w aplikacji.

  Kiedy aplikacja z tego samego podpisu co plik na stronie pobierania jest
  zainstalowana, system sam otwiera w niej adresy /n/... (plik
  /.well-known/assetlinks.json). Ten przycisk to droga zapasowa: przeglądarka
  w trybie prywatnym, stara wersja aplikacji, odnośnik wklejony ręcznie.
  intent:// mówi Androidowi „otwórz to w Kajecie", a bez aplikacji przeglądarka
  idzie na stronę pobierania.
*/
export function OpenInApp({ path }: { path: string }) {
  const words = useWords();
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    setAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  if (!android) return null;

  const host = window.location.host;
  const fallback = encodeURIComponent(`${window.location.origin}/download`);
  const href =
    `intent://${host}${path}#Intent;scheme=https;package=wojtoteka.ovh.kajet;` +
    `S.browser_fallback_url=${fallback};end`;

  return (
    <a className="button compact primary" href={href}>
      <Icon name="open_in_new" size={18} />
      {words.openInApp}
    </a>
  );
}
