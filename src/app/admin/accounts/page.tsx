import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { ActionForm } from "@/components/ActionForm";
import { aiWorks } from "@/lib/settings";
import { NO_AI_USAGE, aiUsageForMany, dailyLimitFor } from "@/lib/ai/limits";
import {
  toggleAdmin,
  toggleBlock,
  toggleCodeRunning,
  toggleAi,
  setAiLimit,
  recomputeStorage,
  setQuota,
  changeLogin,
  changeEmail,
  sendPasswordReset,
  setUserPassword,
  deleteUser,
} from "../actions";
import { currentWords } from "@/lib/language";
import {
  accountSummary,
  accountsFound,
  aiUsageLine,
  confirmAllowAi,
  confirmBlockAccount,
  confirmChangeEmail,
  confirmDeleteUser,
  confirmMakeAdmin,
  confirmSetPassword,
  noAccountMatches,
} from "@/lib/i18n";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const words = await currentWords();
  const query = (params.q ?? "").trim();

  // Bez klucza do modelu KajetAI nie ma na tym serwerze wcale, więc nie ma
  // też czego nadawać ani odbierać - przełącznik się wtedy nie pokazuje.
  const assistantHere = aiWorks();

  const where: Prisma.UserWhereInput = {};
  if (query) {
    where.OR = [{ login: { contains: query } }, { email: { contains: query } }];
  }

  const [users, matching] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { notes: true, tokens: true } } },
      take: 200,
    }),
    prisma.user.count({ where }),
  ]);

  // Zużycie dla całej strony dwoma zapytaniami, nie dwoma na konto.
  const usage = assistantHere
    ? await aiUsageForMany(users.filter((user) => user.canUseAi).map((user) => user.id))
    : new Map();

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>{words.adminAccounts}</h2>
      <p className="lead">
        {words.accountsLead}
      </p>

      <section className="sheet" style={{ padding: "16px 18px", marginBottom: 16 }}>
        <form method="get" className="library-filters">
          <div className="field field-search">
            <label htmlFor="q">{words.searchAccountLabel}</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={words.searchAccountPlaceholder}
            />
          </div>
          <div className="filter-actions">
            <button type="submit" className="compact primary">
              {words.search}
            </button>
            {query ? (
              <Link className="button compact" href="/admin/accounts">
                {words.clearWord}
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <p className="lead" style={{ marginBottom: 16 }}>
        {accountsFound(words, matching, users.length, Boolean(query))}
      </p>

      <div className="column" style={{ gap: 16 }}>
        {users.length === 0 ? (
          <div className="sheet" style={{ padding: "20px 22px" }}>
            <p className="lead" style={{ margin: 0 }}>
              {noAccountMatches(words, query)}
            </p>
          </div>
        ) : null}
        {users.map((user) => {
          const quota = Number(user.quotaBytes);
          const used = Number(user.usedBytes);
          // Ujemny limit to „bez ograniczeń", zerowy to zero miejsca - a przy
          // zerze pasek ma być pełny, nie pusty.
          const unlimited = quota < 0;
          const percent = unlimited ? 0 : quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100;

          return (
            <div key={user.id} className="sheet account-card">
              <div className="row-spread" style={{ alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>
                    {user.login}{" "}
                    {user.role === "ADMIN" ? (
                      <span className="tag accent">{words.tagAdministrator}</span>
                    ) : null}{" "}
                    {user.blocked ? <span className="tag danger">{words.tagBlocked}</span> : null}{" "}
                    {!user.canRunCode ? (
                      <span className="tag">{words.tagNoCodeRunning}</span>
                    ) : null}{" "}
                    {assistantHere && user.canUseAi ? (
                      <span className="tag accent">{words.tagAiAllowed}</span>
                    ) : null}
                  </h3>
                  <p className="small" style={{ margin: 0 }}>
                    {accountSummary(
                      words,
                      user.email,
                      user._count.notes,
                      user._count.tokens,
                      humanSize(user.usedBytes),
                      user.createdAt.toLocaleDateString(words.locale),
                    )}
                  </p>
                  {user.blockReason ? (
                    <p className="small" style={{ margin: "4px 0 0 0", color: "var(--warning)" }}>
                      {words.blockReasonLabel}: {user.blockReason}
                    </p>
                  ) : null}
                </div>

                <div style={{ minWidth: 200 }}>
                  <p className="small" style={{ margin: "0 0 4px 0" }}>
                    {humanSize(user.usedBytes)} {words.ofWord}{" "}
                    {unlimited ? words.noLimit : humanSize(user.quotaBytes)}
                    {user.quotaUntil
                      ? ` (${words.until} ${user.quotaUntil.toLocaleDateString(words.locale)})`
                      : ""}
                  </p>
                  <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
                    <span style={{ width: `${unlimited ? 4 : percent}%` }} />
                  </div>
                </div>
              </div>

              <div className="account-columns">
                <div>
                  <p className="eyebrow">{words.quotaSection}</p>
                  <ActionForm action={setQuota} label={words.setQuota} compact toast>
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="quota-row">
                      <input
                        name="quotaMb"
                        type="number"
                        // Minus jeden przechodzi, bo tak zapisuje się „bez
                        // ograniczeń"; zero znaczy zero megabajtów.
                        min={-1}
                        defaultValue={unlimited ? -1 : Math.round(quota / 1024 / 1024)}
                        aria-label={words.quotaInMb}
                      />
                      <span className="small">MB</span>
                      <input
                        name="forDays"
                        type="number"
                        // -1 znaczy „na stałe", tak samo jak przy kodzie
                        // zaproszenia znaczy „bez terminu".
                        min={-1}
                        defaultValue={-1}
                        aria-label={words.forHowManyDays}
                      />
                      <span className="small">{words.daysWord}</span>
                    </div>
                    <p className="small" style={{ margin: "0 0 8px 0" }}>
                      {words.quotaHint}
                    </p>
                  </ActionForm>

                  {/*
                    KajetAI siedzi W ŚRODKU kolumny limitów, za cienką kreską,
                    a nie jako osobna kolumna siatki. Jako osobna robił piątą
                    kolumnę tam, gdzie mieszczą się cztery - i „Dostęp" spadał
                    sam do drugiego rzędu, zostawiając pół karty pustki. Teraz
                    liczba kolumn jest stała, więc karta wygląda tak samo
                    z uprawnieniem do KajetAI i bez niego.
                  */}
                  {assistantHere && user.canUseAi ? (
                    <div className="account-sub">
                      <p className="eyebrow">{words.aiSection}</p>
                      <p className="small" style={{ margin: "0 0 8px 0" }}>
                        {(usage.get(user.id) ?? NO_AI_USAGE).week === 0
                          ? words.aiNoUsageYet
                          : aiUsageLine(
                              words,
                              (usage.get(user.id) ?? NO_AI_USAGE).today,
                              dailyLimitFor(user),
                              (usage.get(user.id) ?? NO_AI_USAGE).week,
                              (usage.get(user.id) ?? NO_AI_USAGE).tokens,
                            )}
                      </p>
                      <ActionForm action={setAiLimit} label={words.setAiLimit} compact toast>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          name="perDay"
                          type="number"
                          min={0}
                          defaultValue={user.aiDailyLimit}
                          aria-label={words.aiDailyLimitLabel}
                        />
                        <p className="small" style={{ margin: "4px 0 8px 0" }}>
                          {words.aiLimitHint}
                        </p>
                      </ActionForm>
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="eyebrow">{words.loginEyebrow}</p>
                  <ActionForm action={changeLogin} label={words.changeLogin} compact toast>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      name="login"
                      type="text"
                      defaultValue={user.login}
                      aria-label={words.newLogin}
                    />
                  </ActionForm>

                  <p className="eyebrow" style={{ marginTop: 14 }}>
                    {words.emailAddressEyebrow}
                  </p>
                  <ActionForm
                    action={changeEmail}
                    label={words.changeEmail}
                    compact
                    toast
                    confirmation={confirmChangeEmail(words, user.login)}
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      name="email"
                      type="email"
                      defaultValue={user.email}
                      aria-label={words.newEmail}
                    />
                  </ActionForm>
                </div>

                <div>
                  <p className="eyebrow">{words.passwordEyebrow}</p>
                  <div className="account-actions">
                    <ActionForm
                      action={sendPasswordReset}
                      label={words.sendPasswordLink}
                      compact
                      toast
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>

                    <ActionForm
                      action={setUserPassword}
                      label={words.setPasswordForUser}
                      compact
                      toast
                      confirmation={confirmSetPassword(words, user.login)}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        name="password"
                        type="text"
                        autoComplete="off"
                        placeholder={words.atLeast8Placeholder}
                        aria-label={words.newPasswordLabel}
                      />
                    </ActionForm>
                  </div>
                </div>

                {/*
                  Przełączniki i akcje konta idą pasem na całą szerokość karty,
                  poziomo. W pionowej kolumnie sześć przycisków dawało rząd
                  wysoki na 340 px, a obok niego pustkę na trzy kolumny.
                */}
                <div className="account-strip">
                  <p className="eyebrow">{words.accessEyebrow}</p>
                  <div className="account-buttons">
                    <ActionForm
                      action={toggleBlock}
                      label={user.blocked ? words.unblockAccount : words.blockAccount}
                      compact
                      toast
                      danger={!user.blocked}
                      confirmation={
                        user.blocked ? undefined : confirmBlockAccount(words, user.login)
                      }
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      {!user.blocked ? (
                        <input
                          name="reason"
                          type="text"
                          placeholder={words.blockReasonPlaceholder}
                          aria-label={words.blockReasonAria}
                        />
                      ) : null}
                    </ActionForm>

                    <ActionForm
                      action={toggleAdmin}
                      label={user.role === "ADMIN" ? words.takeAdminRights : words.makeAdmin}
                      compact
                      toast
                      confirmation={
                        user.role === "ADMIN" ? undefined : confirmMakeAdmin(words, user.login)
                      }
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>

                    <ActionForm
                      action={toggleCodeRunning}
                      label={
                        user.canRunCode ? words.takeCodeRunning : words.allowCodeRunning
                      }
                      compact
                      toast
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>

                    {assistantHere ? (
                      <ActionForm
                        action={toggleAi}
                        label={user.canUseAi ? words.takeAiAccess : words.allowAiAccess}
                        compact
                        toast
                        confirmation={
                          user.canUseAi ? undefined : confirmAllowAi(words, user.login)
                        }
                      >
                        <input type="hidden" name="userId" value={user.id} />
                      </ActionForm>
                    ) : null}

                    <ActionForm action={recomputeStorage} label={words.recomputeStorage} compact toast>
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>

                    <div className="account-last">
                      <ActionForm
                        action={deleteUser}
                        label={words.deleteAccount}
                        compact
                        danger
                        toast
                        confirmation={confirmDeleteUser(words, user.login, user._count.notes)}
                      >
                        <input type="hidden" name="userId" value={user.id} />
                      </ActionForm>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
