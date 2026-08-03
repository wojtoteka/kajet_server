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
        <h1 style={{ marginBottom: 12 }}>Zeszyt, który masz przy sobie i na komputerze</h1>
        <p className="lead" style={{ maxWidth: 560 }}>
          Kajet to notatnik na tablet z rysikiem: pismo odręczne, notatki tekstowe, mapy myśli
          i kod. Piszesz na tablecie, a notatki trafiają tutaj i możesz je otworzyć na komputerze.
          Kiedy nie ma internetu, wszystko zapisuje się na tablecie i dogrywa samo, gdy sieć wróci.
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
          heading="Sam tablet"
          body="Aplikacja działa bez logowania. Notatki leżą wtedy wyłącznie na tablecie, w katalogu, który sam wskazujesz."
        />
        <Tile
          eyebrow="Z kontem"
          heading="Notatki w chmurze"
          body="Po zalogowaniu notatki i rysunki idą na serwer. Otworzysz je na komputerze i odzyskasz po zmianie tabletu."
        />
        <Tile
          eyebrow="Razem"
          heading="Udostępnianie"
          body="Notatkę da się udostępnić odnośnikiem albo na adres e-mail, do czytania albo do wspólnego pisania."
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
