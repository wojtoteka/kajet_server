import { prisma } from "@/lib/prisma";

export default async function AuditLogPage() {
  const entries = await prisma.auditEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorIds = [...new Set(entries.map((entry) => entry.actorId).filter(Boolean))] as string[];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, login: true },
  });
  const logins = new Map(actors.map((actor) => [actor.id, actor.login]));

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>Dziennik</h2>
      <p className="lead">Ostatnie dwieście czynności administratorów.</p>

      {entries.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            Dziennik jest pusty. Wpisy pojawią się po pierwszej czynności w panelu.
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 170 }}>Kiedy</th>
                <th style={{ width: 140 }}>Kto</th>
                <th style={{ width: 180 }}>Czynność</th>
                <th>Szczegóły</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={String(entry.id)}>
                  <td className="small">{entry.createdAt.toLocaleString("pl-PL")}</td>
                  <td>{entry.actorId ? (logins.get(entry.actorId) ?? "konto skasowane") : "—"}</td>
                  <td>
                    <span className="mono">{entry.action}</span>
                  </td>
                  <td className="small">{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
