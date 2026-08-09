import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { aiWorks, mailWorks, settings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink, CopyButton } from "@/components/CopyableLink";
import { deleteCode, createCode } from "../actions";
import { currentWords } from "@/lib/language";

export default async function CodesPage() {
  const words = await currentWords();
  // Tak samo jak na liście kont: bez klucza asystenta nie ma czego obiecywać.
  const assistantHere = aiWorks();
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
        <p className="eyebrow">{words.newCodeEyebrow}</p>
        <h2 style={{ marginBottom: 6 }}>{words.issueInviteCodeHeading}</h2>
        <p className="lead">
          {words.codesLead}
        </p>

        <ActionForm action={createCode} label={words.issueCode} busyLabel={words.issuingCode} primary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label htmlFor="seats">{words.howManyAccounts}</label>
              <input id="seats" name="seats" type="number" min={1} max={500} defaultValue={1} />
            </div>
            <div>
              <label htmlFor="quotaMb">{words.quotaMbLabel}</label>
              <input id="quotaMb" name="quotaMb" type="number" min={0} defaultValue={0} />
              <p className="small" style={{ marginTop: 4 }}>
                Zero oznacza limit domyślny, czyli {humanSize(settings.quotas.default)}.
              </p>
            </div>
            <div>
              <label htmlFor="validDays">{words.validForDaysLabel}</label>
              <input id="validDays" name="validDays" type="number" min={0} defaultValue={30} />
              <p className="small" style={{ marginTop: 4 }}>Zero oznacza bez terminu.</p>
            </div>
            <div>
              <label htmlFor="email">{words.sendStraightTo}</label>
              <input id="email" name="email" type="email" placeholder={words.orJustTheLink} />
              {!mailWorks() ? (
                <p className="small" style={{ marginTop: 4 }}>
                  {words.mailNotSetCodes}
                  niżej.
                </p>
              ) : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">{words.descriptionForYou}</label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder={words.descriptionPlaceholder}
            />
          </div>

          {assistantHere ? (
            <div className="field">
              <label
                htmlFor="grantsAi"
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <input
                  id="grantsAi"
                  name="grantsAi"
                  type="checkbox"
                  style={{ width: "auto", margin: 0 }}
                />
                <span>{words.codeGrantsAi}</span>
              </label>
              <p className="small" style={{ marginTop: 4 }}>
                {words.codeGrantsAiHint}
              </p>
            </div>
          ) : null}
        </ActionForm>
      </div>

      <h2 style={{ marginBottom: 12 }}>{words.issuedCodes}</h2>

      {codes.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            {words.noCodesYet}
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th>{words.columnCode}</th>
                <th>{words.columnUse}</th>
                <th>{words.columnAccountQuota}</th>
                <th>{words.columnValidTo}</th>
                <th>{words.columnDescription}</th>
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
                      <span className="row" style={{ gap: 8 }}>
                        <span className="mono">{code.code}</span>
                        <CopyButton value={code.code} label={words.copyCode} />
                      </span>
                      {!spent && !expired ? (
                        <CopyableLink
                          url={`${settings.baseUrl}/register?code=${encodeURIComponent(code.code)}`}
                        />
                      ) : null}
                    </td>
                    <td>
                      {spent ? (
                        <span className="tag">{words.tagSpent}</span>
                      ) : expired ? (
                        <span className="tag danger">{words.tagExpired}</span>
                      ) : (
                        <span className="tag accent">{words.tagFree}</span>
                      )}
                      <p className="small" style={{ margin: "4px 0 0 0" }}>
                        {code.usedSeats} {words.ofWord} {code.seats}
                        {code.usedBy ? `, ${words.usedByWord} ${code.usedBy.login}` : ""}
                      </p>
                    </td>
                    <td>
                      {code.quotaBytes ? humanSize(code.quotaBytes) : words.defaultWord}
                      {assistantHere && code.grantsAi ? (
                        <p className="small" style={{ margin: "4px 0 0 0" }}>
                          <span className="tag accent">{words.tagAiAllowed}</span>
                        </p>
                      ) : null}
                    </td>
                    <td>
                      {code.expiresAt ? code.expiresAt.toLocaleDateString(words.locale) : words.noDeadline}
                    </td>
                    <td>
                      {code.description ?? "-"}
                      <p className="small" style={{ margin: "4px 0 0 0" }}>
                        wydał {code.issuedBy.login}
                      </p>
                    </td>
                    <td>
                      <ActionForm
                        action={deleteCode}
                        label={words.delete}
                        compact
                        danger
                        confirmation={words.confirmDeleteCode}
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
