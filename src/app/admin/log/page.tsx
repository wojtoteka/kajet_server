import { prisma } from "@/lib/prisma";
import { currentWords } from "@/lib/language";

export default async function AuditLogPage() {
  const words = await currentWords();
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
      <h2 style={{ marginBottom: 6 }}>{words.adminLog}</h2>
      <p className="lead">{words.logLead}</p>

      {entries.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            {words.logEmpty}
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 170 }}>{words.columnWhen}</th>
                <th style={{ width: 140 }}>{words.columnWho2}</th>
                <th style={{ width: 180 }}>{words.columnAction}</th>
                <th>{words.columnDetails}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={String(entry.id)}>
                  <td className="small">{entry.createdAt.toLocaleString(words.locale)}</td>
                  <td>{entry.actorId ? (logins.get(entry.actorId) ?? words.deletedAccount) : "-"}</td>
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
