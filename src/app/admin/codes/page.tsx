import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { hasFreeSeat } from "@/lib/invite";
import { aiWorks, mailWorks, settings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink, CopyButton } from "@/components/CopyableLink";
import { deleteCode, createCode } from "../actions";
import { currentWords } from "@/lib/language";
import { aiPerDayTag, seatsUsed } from "@/lib/i18n";

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

        {/*
          Jedna zasada nad wszystkimi polami, zamiast zgadywania przy każdym
          z osobna. Wcześniej to samo zero znaczyło tu trzy różne rzeczy: przy
          miejscu „tyle, ile domyślnie", przy dniach „bez terminu", a przy
          asystencie „bez asystenta".
        */}
        <p className="small" style={{ marginBottom: 16 }}>
          {words.codeNumbersRule}
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
              <input id="seats" name="seats" type="number" min={-1} max={500} defaultValue={1} />
              <p className="small" style={{ marginTop: 4 }}>{words.seatsHint}</p>
            </div>
            <div>
              <label htmlFor="quotaMb">{words.quotaMbLabel}</label>
              <input id="quotaMb" name="quotaMb" type="number" min={-1} defaultValue={0} />
              <p className="small" style={{ marginTop: 4 }}>{words.codeQuotaHint}</p>
            </div>
            <div>
              <label htmlFor="validDays">{words.validForDaysLabel}</label>
              <input id="validDays" name="validDays" type="number" min={-1} defaultValue={30} />
              <p className="small" style={{ marginTop: 4 }}>{words.validDaysHint}</p>
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

          {/*
            Jedna liczba zamiast znacznika „daj asystenta" obok pola „ile
            razy dziennie". Dostęp bez limitu i limit bez dostępu to były dwa
            stany, których nikt nie potrzebował, a dało się je nastawić.
          */}
          {assistantHere ? (
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor="aiPerDay">{words.codeAiPerDayLabel}</label>
              <input
                id="aiPerDay"
                name="aiPerDay"
                type="number"
                min={0}
                max={10_000}
                defaultValue={0}
              />
              <p className="small" style={{ marginTop: 4 }}>
                {words.codeAiPerDayHint}
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
          {/*
            Własna klasa, bo ten spis ma w pierwszej komórce trzy wiersze
            (kod, przycisk, odnośnik), a reszta po jednym. Przy wyrównaniu do
            środka - takim jak w każdej innej tabeli panelu - data i opis
            zawisały w połowie wysokości wiersza, jakby ktoś je upuścił.
          */}
          <table className="codes-table">
            <thead>
              <tr>
                <th>{words.columnCode}</th>
                <th>{words.columnUse}</th>
                <th>{words.columnCodeGrants}</th>
                <th>{words.columnValidTo}</th>
                <th>{words.columnDescription}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const spent = !hasFreeSeat(code);
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
                        {/* „0 z bez limitu" nie jest zdaniem — kod bez
                            ograniczeń mówi tylko, ile razy go użyto. */}
                        {seatsUsed(words, code.usedSeats, code.seats)}
                        {code.usedBy ? `, ${words.usedByWord} ${code.usedBy.login}` : ""}
                      </p>
                    </td>
                    <td>
                      {/* Zero jest teraz zwykłą liczbą, a nie brakiem wpisu,
                          więc porównujemy z null wprost - `code.quotaBytes ?`
                          uznawało zero za „nie podano". */}
                      {code.quotaBytes === null
                        ? words.defaultWord
                        : code.quotaBytes < 0n
                          ? words.noLimit
                          : humanSize(code.quotaBytes)}
                      {assistantHere && (code.grantsAi || code.aiDailyLimit > 0) ? (
                        <p className="small" style={{ margin: "4px 0 0 0" }}>
                          <span className="tag accent">
                            {code.aiDailyLimit > 0
                              ? aiPerDayTag(words, code.aiDailyLimit)
                              : words.tagAiAllowed}
                          </span>
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
