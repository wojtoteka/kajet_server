import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaAdmin };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/signin?next=/admin");

  const words = await currentWords();

  return (
    <main className="page wide">
      <KajetMark caption={words.adminCaption} />

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
