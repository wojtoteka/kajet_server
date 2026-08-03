import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";

export const metadata = { title: "Panel administratora — Kajet" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/signin?next=/admin");

  return (
    <main className="page wide">
      <KajetMark caption="panel administratora" />

      <nav className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <Link className="button compact" href="/admin">
          Przegląd
        </Link>
        <Link className="button compact" href="/admin/accounts">
          Konta
        </Link>
        <Link className="button compact" href="/admin/codes">
          Kody zaproszeń
        </Link>
        <Link className="button compact" href="/admin/log">
          Dziennik
        </Link>
        <span style={{ flex: 1 }} />
        <Link className="button compact" href="/library">
          Moje notatki
        </Link>
      </nav>

      {children}
    </main>
  );
}
