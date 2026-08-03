import Link from "next/link";
import { KajetMark } from "@/components/KajetMark";
import { RegistrationForm } from "./RegistrationForm";

export const metadata = { title: "Załóż konto — Kajet" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">Nowe konto</p>
        <h1 style={{ marginBottom: 8 }}>Załóż konto w Kajecie</h1>
        <p className="lead">
          Konto zakłada się na kod od administratora. Jeśli go nie masz, poproś o niego osobę,
          która prowadzi ten serwer. Bez konta nadal możesz pisać na tablecie, tylko notatki
          zostają wtedy wyłącznie na nim.
        </p>

        <RegistrationForm codeFromLink={code ?? ""} />
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        Masz już konto? <Link href="/signin">Zaloguj się</Link>
      </p>
    </main>
  );
}
