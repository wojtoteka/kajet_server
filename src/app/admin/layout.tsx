import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaAdmin };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /*
    Dwa różne „nie wolno", dwie różne odpowiedzi.

    Niezalogowany idzie do logowania i wraca tutaj - to ma sens, bo po
    zalogowaniu może się okazać, że wolno mu wejść.

    Zalogowany bez uprawnień dostaje to samo co pod adresem, którego nie ma.
    Dwa powody. Po pierwsze, odmowa nie ma prawa zdradzać, że panel w ogóle
    istnieje - ta sama zasada co przy asystencie (lib/ai/access.ts). Po
    drugie, odesłanie go do logowania robiło PĘTLĘ: strona logowania widziała
    ważną sesję i odsyłała pod `next`, czyli z powrotem tutaj, a tutaj znowu
    brakowało uprawnień. Przeglądarka pokazywała „zbyt wiele przekierowań"
    zamiast czegokolwiek do przeczytania.
  */
  const user = await currentUser();
  if (!user) redirect("/signin?next=/admin");
  if (user.role !== "ADMIN") notFound();

  const words = await currentWords();

  return (
    <main className="page wide">
      <KajetMark home="/library" caption={words.adminCaption} />

      <nav className="row admin-nav">
        <Link className="button compact" href="/admin">
          {words.adminOverview}
        </Link>
        <Link className="button compact" href="/admin/accounts">
          {words.adminAccounts}
        </Link>
        <Link className="button compact" href="/admin/codes">
          {words.adminCodes}
        </Link>
        <Link className="button compact" href="/admin/app">
          {words.adminApp}
        </Link>
        <Link className="button compact" href="/admin/log">
          {words.adminLog}
        </Link>
        <Link className="button compact" href="/admin/crashes">
          {words.adminCrashes}
        </Link>
        {/* Odsunięcie w prawo (i pełny wiersz na telefonie) daje klasa
            admin-nav-out - patrz .admin-nav w globals.css. */}
        <Link className="button compact admin-nav-out" href="/library">
          {words.myNotes}
        </Link>
      </nav>

      {children}
    </main>
  );
}
