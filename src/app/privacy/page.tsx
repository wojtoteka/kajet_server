import { BackToKajet } from "@/components/BackToKajet";
import { KajetMark } from "@/components/KajetMark";
import { currentLanguage, currentWords } from "@/lib/language";
import { PolitykaEn, PolitykaPl } from "./tresc";

/*
  Polityka prywatności. Tak samo jak regulamin: zwykła strona serwisu, język
  bierze z przełącznika PL/EN w nagłówku.
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaPrivacy };
}

export default async function PrivacyPage() {
  const language = await currentLanguage();

  return (
    <main className="page site-frame legal">
      <KajetMark />
      <BackToKajet />
      {/* Tak jak w regulaminie: pasek ze znakiem na szerokość serwisu, sam
          dokument w węższej kolumnie. */}
      <div className="page-column">
        {language === "en" ? <PolitykaEn /> : <PolitykaPl />}
      </div>
    </main>
  );
}
