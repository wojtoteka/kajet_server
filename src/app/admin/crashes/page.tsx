import { prisma } from "@/lib/prisma";
import { currentWords } from "@/lib/language";

/*
  Awarie aplikacji na Androida.

  Nie jest to lista wszystkiego po kolei - ta sama usterka potrafi przyjść
  dwadzieścia razy z rzędu i przykryć resztę. Wiersz to jeden odcisk awarii
  (rodzaj wyjątku plus miejsce), z liczbą powtórzeń i najnowszym raportem do
  rozwinięcia.
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaAdminCrashes };
}

export default async function CrashesPage() {
  const words = await currentWords();

  const groups = await prisma.crashReport.groupBy({
    by: ["fingerprint"],
    _count: { _all: true },
    _max: { createdAt: true, id: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 100,
  });

  // Do rozwinięcia bierzemy najnowszy raport z każdej grupy - starsze niosą
  // ten sam ślad wywołań, więc nic by nie dodały.
  const newestIds = groups.map((group) => group._max.id).filter((id) => id !== null);
  const newest = await prisma.crashReport.findMany({
    where: { id: { in: newestIds } },
  });
  const byId = new Map(newest.map((report) => [String(report.id), report]));

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>{words.adminCrashes}</h2>
      <p className="lead">{words.crashesLead}</p>

      {groups.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            {words.crashesEmpty}
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 170 }}>{words.columnWhen}</th>
                <th style={{ width: 90 }}>{words.columnHowMany}</th>
                <th style={{ width: 90 }}>{words.columnVersion}</th>
                <th style={{ width: 180 }}>{words.columnDevice}</th>
                <th>{words.columnDetails}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const report = byId.get(String(group._max.id));
                return (
                  <tr key={group.fingerprint}>
                    <td className="small">
                      {group._max.createdAt?.toLocaleString(words.locale) ?? "-"}
                    </td>
                    <td>{group._count._all}</td>
                    <td className="small">
                      {report?.appVersion ?? "-"}
                      {report?.versionCode ? ` (${report.versionCode})` : ""}
                    </td>
                    <td className="small">
                      {report?.device ?? "-"}
                      {report?.android ? `, Android ${report.android}` : ""}
                    </td>
                    <td className="small">
                      <span className="mono">{group.fingerprint}</span>
                      {report && (
                        <details style={{ marginTop: 6 }}>
                          <summary>{words.crashShowReport}</summary>
                          <pre
                            className="mono"
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowX: "auto",
                              marginTop: 8,
                            }}
                          >
                            {report.report}
                          </pre>
                          <p className="small" style={{ margin: 0 }}>
                            {report.thread ? `${words.columnWho2}: ${report.thread} · ` : ""}
                            {report.userId ?? words.crashNoAccount}
                          </p>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
