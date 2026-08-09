import { BackToKajet } from "@/components/BackToKajet";
import { KajetMark } from "@/components/KajetMark";
import { currentLanguage, currentWords } from "@/lib/language";
import { RegulaminEn, RegulaminPl } from "./tresc";

/*
  Regulamin.

  Zwykła strona serwisu, nie osobny plik HTML: ma nagłówek z przełącznikiem
  PL/EN i motywem, stopkę i te same barwy, co reszta - a język wybiera się tak
  samo jak wszędzie indziej, bez doklejania czegokolwiek do adresu.
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaTerms };
}

export default async function TermsPage() {
  const language = await currentLanguage();

  return (
    <main className="page legal">
      <KajetMark />
      <BackToKajet />
      {language === "en" ? <RegulaminEn /> : <RegulaminPl />}
    </main>
  );
}
