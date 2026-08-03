import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { ActionForm } from "@/components/ActionForm";
import {
  toggleAdmin,
  toggleBlock,
  toggleCodeRunning,
  recomputeStorage,
  setQuota,
  changeLogin,
} from "../actions";

export default async function AccountsPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { notes: true, tokens: true } } },
    take: 200,
  });

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>Konta</h2>
      <p className="lead">
        Limit zero oznacza miejsce bez ograniczeń. Limit podany na określoną liczbę dni wraca po
        terminie do poprzedniej wartości.
      </p>

      <div className="column" style={{ gap: 16 }}>
        {users.map((user) => {
          const quota = Number(user.quotaBytes);
          const used = Number(user.usedBytes);
          const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

          return (
            <div key={user.id} className="sheet" style={{ padding: "20px 22px" }}>
              <div className="row-spread" style={{ marginBottom: 14 }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>
                    {user.login}{" "}
                    {user.role === "ADMIN" ? (
                      <span className="tag accent">administrator</span>
                    ) : null}{" "}
                    {user.blocked ? <span className="tag danger">zablokowane</span> : null}{" "}
                    {!user.canRunCode ? (
                      <span className="tag">bez uruchamiania kodu</span>
                    ) : null}
                  </h3>
                  <p className="small" style={{ margin: 0 }}>
                    {user.email} · {user._count.notes} notatek · {user._count.tokens} urządzeń ·
                    konto z {user.createdAt.toLocaleDateString("pl-PL")}
                  </p>
                  {user.blockReason ? (
                    <p className="small" style={{ margin: "4px 0 0 0", color: "var(--warning)" }}>
                      Powód blokady: {user.blockReason}
                    </p>
                  ) : null}
                </div>

                <div style={{ minWidth: 200 }}>
                  <p className="small" style={{ margin: "0 0 4px 0" }}>
                    {humanSize(user.usedBytes)} z{" "}
                    {quota === 0 ? "bez limitu" : humanSize(user.quotaBytes)}
                    {user.quotaUntil ? ` (do ${user.quotaUntil.toLocaleDateString("pl-PL")})` : ""}
                  </p>
                  <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
                    <span style={{ width: `${quota === 0 ? 4 : percent}%` }} />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 18,
                  borderTop: "1px solid var(--rule)",
                  paddingTop: 16,
                }}
              >
                <div>
                  <p className="eyebrow">Limit miejsca</p>
                  <ActionForm action={setQuota} label="Ustaw limit" compact>
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="row" style={{ marginBottom: 8 }}>
                      <input
                        name="quotaMb"
                        type="number"
                        min={0}
                        defaultValue={Math.round(quota / 1024 / 1024)}
                        aria-label="Limit w MB"
                        style={{ width: 110 }}
                      />
                      <span className="small">MB</span>
                      <input
                        name="forDays"
                        type="number"
                        min={0}
                        defaultValue={0}
                        aria-label="Na ile dni"
                        style={{ width: 90 }}
                      />
                      <span className="small">dni</span>
                    </div>
                    <p className="small" style={{ margin: "0 0 8px 0" }}>
                      Zero MB to brak limitu. Zero dni to na stałe.
                    </p>
                  </ActionForm>
                </div>

                <div>
                  <p className="eyebrow">Login</p>
                  <ActionForm action={changeLogin} label="Zmień login" compact>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      name="login"
                      type="text"
                      defaultValue={user.login}
                      aria-label="Nowy login"
                      style={{ marginBottom: 8 }}
                    />
                  </ActionForm>
                </div>

                <div>
                  <p className="eyebrow">Dostęp</p>
                  <ActionForm
                    action={toggleBlock}
                    label={user.blocked ? "Odblokuj konto" : "Zablokuj konto"}
                    compact
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
                        placeholder="Powód (opcjonalnie)"
                        aria-label="Powód blokady"
                        style={{ marginBottom: 8 }}
                      />
                    ) : null}
                  </ActionForm>

                  <div style={{ marginTop: 10 }}>
                    <ActionForm
                      action={toggleAdmin}
                      label={user.role === "ADMIN" ? "Odbierz uprawnienia" : "Zrób administratorem"}
                      compact
                      confirmation={
                        user.role === "ADMIN"
                          ? undefined
                          : `Nadać ${user.login} uprawnienia administratora?`
                      }
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <ActionForm
                      action={toggleCodeRunning}
                      label={
                        user.canRunCode ? "Zabierz uruchamianie kodu" : "Pozwól uruchamiać kod"
                      }
                      compact
                    >
                      <input type="hidden" name="userId" value={user.id} />
                    </ActionForm>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <ActionForm action={recomputeStorage} label="Przelicz miejsce" compact>
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
