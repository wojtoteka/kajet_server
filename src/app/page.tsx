import Link from "next/link";
import { auth } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="page">
      <KajetMark />

      <div
        className="sheet-ruled"
        style={{ paddingBlock: 34, paddingInlineEnd: 30, marginBottom: 24 }}
      >
        <p className="eyebrow">Notatnik</p>
        <h1 style={{ marginBottom: 12 }}>Jeden Kajet — telefon, tablet i komputer</h1>
        <p className="lead" style={{ maxWidth: 560 }}>
          Kajet to notatnik z pismem odręcznym, tekstem, mapami myśli i kodem. Panel na stronie
          to pełny klient: te same notatki, kosz, udostępnianie i uruchamianie programów — gdy
          serwer na to pozwala. Aplikacja mobilna i WWW dzielą jedno konto.
        </p>

        <div className="row" style={{ marginTop: 22 }}>
          {session?.user?.id ? (
            <Link className="button primary" href="/library">
              Moje notatki
            </Link>
          ) : (
            <>
              <Link className="button primary" href="/signin">
                Zaloguj się
              </Link>
              <Link className="button" href="/register">
                Mam kod zaproszenia
              </Link>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <Tile
          eyebrow="Bez konta"
          heading="Tylko urządzenie"
          body="Aplikacja działa bez logowania. Notatki leżą wtedy wyłącznie lokalnie, w katalogu, który sam wskazujesz."
        />
        <Tile
          eyebrow="Z kontem"
          heading="Wszędzie to samo"
          body="Po zalogowaniu notatki idą na serwer. Otworzysz je w panelu WWW i w aplikacji — i odzyskasz po zmianie telefonu czy tabletu."
        />
        <Tile
          eyebrow="Razem"
          heading="Udostępnianie i kod"
          body="Notatkę dasz odnośnikiem albo na e-mail. Pliki z kodem uruchomisz na serwerze z panelu albo z aplikacji."
        />
      </div>

      <p className="small" style={{ marginTop: 28 }}>
        Konto zakłada się na kod od administratora. Jeśli go nie masz, poproś osobę, która
        prowadzi ten serwer.
      </p>
    </main>
  );
}

function Tile({
  eyebrow,
  heading,
  body,
}: {
  eyebrow: string;
  heading: string;
  body: string;
}) {
  return (
    <div className="sheet" style={{ padding: "20px 22px" }}>
      <p className="eyebrow">{eyebrow}</p>
      <h3 style={{ marginBottom: 6 }}>{heading}</h3>
      <p className="small" style={{ margin: 0 }}>
        {body}
      </p>
    </div>
  );
}
