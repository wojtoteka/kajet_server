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

      <nav className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
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
        <span style={{ flex: 1 }} />
        <Link className="button compact" href="/library">
          {words.myNotes}
        </Link>
      </nav>

      {children}
    </main>
  );
}
