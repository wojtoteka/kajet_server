import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { mailWorks, settings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink } from "@/components/CopyableLink";
import { deleteCode, createCode } from "../actions";

export default async function CodesPage() {
  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      issuedBy: { select: { login: true } },
      usedBy: { select: { login: true } },
    },
    take: 100,
  });

  return (
    <>
      <div
        className="sheet-ruled"
        style={{ paddingBlock: 24, paddingInlineEnd: 26, marginBottom: 24 }}
      >
        <p className="eyebrow">Nowy kod</p>
        <h2 style={{ marginBottom: 6 }}>Wydaj kod zaproszenia</h2>
        <p className="lead">
          Kod na jedno miejsce to zwykłe zaproszenie dla jednej osoby. Większa liczba miejsc
          przydaje się, gdy zapraszasz całą klasę jednym kodem.
        </p>

        <ActionForm action={createCode} label="Wydaj kod" busyLabel="Wydaję..." primary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label htmlFor="seats">Na ile kont</label>
              <input id="seats" name="seats" type="number" min={1} max={500} defaultValue={1} />
            </div>
            <div>
              <label htmlFor="quotaMb">Limit miejsca w MB</label>
              <input id="quotaMb" name="quotaMb" type="number" min={0} defaultValue={0} />
              <p className="small" style={{ marginTop: 4 }}>
                Zero oznacza limit domyślny, czyli {humanSize(settings.quotas.default)}.
              </p>
            </div>
            <div>
              <label htmlFor="validDays">Ważny przez (dni)</label>
              <input id="validDays" name="validDays" type="number" min={0} defaultValue={30} />
              <p className="small" style={{ marginTop: 4 }}>Zero oznacza bez terminu.</p>
            </div>
            <div>
              <label htmlFor="email">Wyślij od razu na adres</label>
              <input id="email" name="email" type="email" placeholder="możesz zostawić pusty" />
              {!mailWorks() ? (
                <p className="small" style={{ marginTop: 4 }}>
                  Poczta nie jest ustawiona, więc mail nie wyjdzie. Odnośnik skopiujesz z listy
                  niżej.
                </p>
              ) : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Opis (dla Ciebie)</label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="np. klasa 2B, wrzesień"
            />
          </div>
        </ActionForm>
      </div>

      <h2 style={{ marginBottom: 12 }}>Wydane kody</h2>

      {codes.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            Nie ma jeszcze żadnego kodu. Wydaj pierwszy formularzem powyżej.
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Wykorzystanie</th>
                <th>Limit konta</th>
                <th>Ważny do</th>
                <th>Opis</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const spent = code.usedSeats >= code.seats;
                const expired = Boolean(code.expiresAt && code.expiresAt < new Date());
                return (
                  <tr key={code.id}>
                    <td>
                      <span className="mono">{code.code}</span>
                      {!spent && !expired ? (
                        <CopyableLink
                          url={`${settings.baseUrl}/register?code=${encodeURIComponent(code.code)}`}
                        />
                      ) : null}
                    </td>
                    <td>
                      {spent ? (
                        <span className="tag">wykorzystany</span>
                      ) : expired ? (
                        <span className="tag danger">przeterminowany</span>
                      ) : (
                        <span className="tag accent">wolny</span>
                      )}
                      <p className="small" style={{ margin: "4px 0 0 0" }}>
                        {code.usedSeats} z {code.seats}
                        {code.usedBy ? `, użył: ${code.usedBy.login}` : ""}
                      </p>
                    </td>
                    <td>{code.quotaBytes ? humanSize(code.quotaBytes) : "domyślny"}</td>
                    <td>
                      {code.expiresAt ? code.expiresAt.toLocaleDateString("pl-PL") : "bez terminu"}
                    </td>
                    <td>
                      {code.description ?? "—"}
                      <p className="small" style={{ margin: "4px 0 0 0" }}>
                        wydał {code.issuedBy.login}
                      </p>
                    </td>
                    <td>
                      <ActionForm
                        action={deleteCode}
                        label="Skasuj"
                        compact
                        danger
                        confirmation="Skasować ten kod? Kto go jeszcze nie użył, nie założy już konta."
                      >
                        <input type="hidden" name="id" value={code.id} />
                      </ActionForm>
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
