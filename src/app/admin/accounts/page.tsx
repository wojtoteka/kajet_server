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
import { accountSummary } from "@/lib/i18n";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const words = await currentWords();
  const query = (params.q ?? "").trim();

  // Bez klucza do modelu asystenta nie ma na tym serwerze wcale, więc nie ma
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
        {query ? `Pasujące konta: ${matching}` : `Wszystkie konta: ${matching}`}
        {matching > users.length ? ` (widocznych ${users.length} — zawęź wyszukiwanie)` : ""}
      </p>

      <div className="column" style={{ gap: 16 }}>
        {users.length === 0 ? (
          <div className="sheet" style={{ padding: "20px 22px" }}>
            <p className="lead" style={{ margin: 0 }}>
              Nie znaleziono konta o nicku lub e-mailu zawierającym „{query}”.
            </p>
          </div>
        ) : null}
        {users.map((user) => {
          const quota = Number(user.quotaBytes);
          const used = Number(user.usedBytes);
          const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

          return (
            <div key={user.id} className="sheet" style={{ padding: "20px 22px" }}>
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
                    {quota === 0 ? words.noLimit : humanSize(user.quotaBytes)}
                    {user.quotaUntil
                      ? ` (${words.until} ${user.quotaUntil.toLocaleDateString(words.locale)})`
                      : ""}
                  </p>
                  <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
                    <span style={{ width: `${quota === 0 ? 4 : percent}%` }} />
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
                        min={0}
                        defaultValue={Math.round(quota / 1024 / 1024)}
                        aria-label={words.quotaInMb}
                      />
                      <span className="small">MB</span>
                      <input
                        name="forDays"
                        type="number"
                        min={0}
                        defaultValue={0}
                        aria-label={words.forHowManyDays}
                      />
                      <span className="small">dni</span>
                    </div>
                    <p className="small" style={{ margin: "0 0 8px 0" }}>
                      {words.quotaHint}
                    </p>
                  </ActionForm>
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
                    E-mail
                  </p>
                  <ActionForm
                    action={changeEmail}
                    label={words.changeEmail}
                    compact
                    toast
                    confirmation={`Zmienić adres konta ${user.login}? Odnośniki wysłane na stary adres przestaną działać.`}
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
                      confirmation={`Ustawić nowe hasło dla ${user.login}? Konto zostanie wylogowane ze wszystkich urządzeń.`}
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

                {assistantHere && user.canUseAi ? (
                  <div>
                    <p className="eyebrow">{words.aiSection}</p>
                    <p className="small" style={{ margin: "0 0 8px 0" }}>
                      {(usage.get(user.id) ?? NO_AI_USAGE).week === 0
                        ? words.aiNoUsageYet
                        : `Doba: ${(usage.get(user.id) ?? NO_AI_USAGE).today} z ${dailyLimitFor(user)}. ` +
                          `Tydzień: ${(usage.get(user.id) ?? NO_AI_USAGE).week} wywołań, ` +
                          `${(usage.get(user.id) ?? NO_AI_USAGE).tokens.toLocaleString(words.locale)} tokenów.`}
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

                <div>
                  <p className="eyebrow">{words.accessEyebrow}</p>
                  <div className="account-actions">
                    <ActionForm
                      action={toggleBlock}
                      label={user.blocked ? words.unblockAccount : words.blockAccount}
                      compact
                      toast
                      danger={!user.blocked}
                      confirmation={
                        user.blocked
                          ? undefined
                          : `Zablokować konto ${user.login}? Zostanie wylogowane ze wszystkich urządzeń.`
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
                        user.role === "ADMIN"
                          ? undefined
                          : `Nadać ${user.login} uprawnienia administratora?`
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
                          user.canUseAi
                            ? undefined
                            : `Pozwolić ${user.login} korzystać z asystenta AI? Treść notatek, ` +
                              `przy których go użyje, będzie wysyłana do Google.`
                        }
                      >
                        <input type="hidden" name="userId" value={user.id} />
                      </ActionForm>
                    ) : null}

                    <ActionForm action={recomputeStorage} label={words.recomputeStorage} compact toast>
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>

                    <ActionForm
                      action={deleteUser}
                      label={words.deleteAccount}
                      compact
                      danger
                      toast
                      confirmation={`Skasować konto ${user.login} razem ze wszystkimi notatkami (${user._count.notes})? Tego nie da się cofnąć.`}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>
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
