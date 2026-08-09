import Link from "next/link";
import { Icon } from "@/components/Icon";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";

/*
  Strona pod nieznanym adresem. Bez tego pliku Next.js pokazuje swoją własną -
  białą kartkę z napisem „This page could not be found." po angielsku, bez
  śladu Kajetu i bez żadnego wyjścia dalej. Ta jest po polsku, w papierze
  Kajetu i z odnośnikami tam, dokąd człowiek zwykle chciał trafić.

  Nie dotyczy adresów /api - te mają własną odpowiedź w JSON, bo czyta je
  aplikacja, a nie człowiek (src/app/api/[...sciezka]/route.ts).
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaPageNotFound };
}

export default async function NotFound() {
  const words = await currentWords();

  return (
    <main className="page" style={{ maxWidth: 620 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.error404}</p>
        <p
          aria-hidden
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: "var(--accent)",
            margin: "0 0 12px 0",
          }}
        >
          404
        </p>
        <h1 style={{ marginBottom: 10 }}>{words.pageNotFoundHeading}</h1>
        <p className="lead">
          {words.pageGoneAbout}
        </p>

        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <Link className="button primary" href="/library">
            <Icon name="menu_book" size={18} />
            {words.myNotes}
          </Link>
          <Link className="button" href="/">
            <Icon name="home" size={18} />
            {words.homePage}
          </Link>
          <Link className="button" href="/account">
            <Icon name="account_circle" size={18} />
            {words.account}
          </Link>
        </div>

        <hr className="divider" />
        <p className="small" style={{ margin: 0 }}>
          {words.sharedLinkNote}
        </p>
      </div>
    </main>
  );
}
