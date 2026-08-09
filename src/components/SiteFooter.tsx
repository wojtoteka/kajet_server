import Link from "next/link";
import { currentWords } from "@/lib/language";
import { PRIVACY_URL, TERMS_URL } from "@/lib/documents";

/*
  Stopka strony.

  Stoi w układzie głównym, więc jest pod każdą stroną - regulamin i polityka
  prywatności mają być pod ręką wszędzie, nie tylko na stronie tytułowej.
  Oba dokumenty to gotowe pliki HTML z katalogu `public`, więc idą zwykłym
  odnośnikiem, nie przez `next/link`: ten ostatni próbowałby zaciągnąć je jak
  stronę Next i wywrócił się na braku danych.
*/

export async function SiteFooter() {
  const words = await currentWords();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="site-footer-mark">Kajet</span>
        {/* Adresy są gołe, bez języka: dokument sam otwiera się w tym, który
            wybrano w serwisie, i ma własny przełącznik PL/EN na wierzchu. */}
        <nav className="site-footer-links">
          <Link href="/contact">{words.footerContact}</Link>
          <a href={TERMS_URL}>{words.footerTerms}</a>
          <a href={PRIVACY_URL}>{words.footerPrivacy}</a>
        </nav>
        <span className="site-footer-year">© {year} Wojtoteka</span>
      </div>
    </footer>
  );
}
