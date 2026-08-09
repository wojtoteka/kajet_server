import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize, quotaState } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { currentWords } from "@/lib/language";
import { deviceNameLabel, notesCount } from "@/lib/i18n";
import { TEXT_DEFAULT_SIZE, TEXT_FONTS, TEXT_LARGEST_SIZE, TEXT_SMALLEST_SIZE } from "@/lib/text-note";
import { TEXT_ALIGNMENTS, readWritingSettings } from "@/lib/writing-settings";
import {
  renameDevice,
  revokeDevice,
  revokeAllDevices,
  issueAppToken,
  changePassword,
  changeOwnLogin,
  logOut,
  logOutEverywhere,
  saveWritingSettings,
} from "./actions";

export const metadata = { title: "Moje konto - Kajet" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account");

  const [devices, storage, noteCount, googleLinked] = await Promise.all([
    prisma.appToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    quotaState(user.id),
    prisma.note.count({ where: { ownerId: user.id, deletedAt: null } }),
    prisma.account.findFirst({
      where: { userId: user.id, provider: "google" },
      select: { providerAccountId: true },
    }),
  ]);

  const words = await currentWords();
  const writing = readWritingSettings(user);

  const percent =
    storage.unlimited || storage.quota === 0n
      ? 0
      : Math.min(100, Math.round((Number(storage.used) / Number(storage.quota)) * 100));

  return (
    <main className="page">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{words.account}</h1>
        <div className="row">
          <Link className="button compact" href="/library">
            {words.myNotes}
          </Link>
          {user.role === "ADMIN" ? (
            <Link className="button compact" href="/admin">
              {words.adminPanelLink}
            </Link>
          ) : null}
          <form action={logOut}>
            <button type="submit" className="compact danger">
              {words.signOut}
            </button>
          </form>
        </div>
      </div>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.profileEyebrow}</p>
        <h2 style={{ marginBottom: 8 }}>{user.login}</h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 16px",
            margin: 0,
          }}
        >
          <dt className="small" style={{ margin: 0 }}>
            {words.emailAddress}
          </dt>
          <dd style={{ margin: 0 }}>{user.email}</dd>
          <dt className="small" style={{ margin: 0 }}>
            {words.roleWord}
          </dt>
          <dd style={{ margin: 0 }}>{user.role === "ADMIN" ? words.roleAdmin : words.roleUser}</dd>
          <dt className="small" style={{ margin: 0 }}>
            {words.signInOnSite}
          </dt>
          <dd style={{ margin: 0 }}>
            {[
              user.passwordHash ? words.viaPassword : null,
              googleLinked ? "Google" : null,
              !user.passwordHash && !googleLinked ? words.viaSession : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </dd>
          <dt className="small" style={{ margin: 0 }}>
            {words.lastSignIn}
          </dt>
          <dd style={{ margin: 0 }}>
            {user.lastSignInAt
              ? user.lastSignInAt.toLocaleString(words.locale)
              : words.notedNever}
          </dd>
          <dt className="small" style={{ margin: 0 }}>
            {words.accountSince}
          </dt>
          <dd style={{ margin: 0 }}>{user.createdAt.toLocaleDateString(words.locale)}</dd>
        </dl>
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href="/password">{words.forgotPassword}</Link>
          {" · "}
          <Link href="/library">{words.noteList}</Link>
        </p>
      </section>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.spaceEyebrow}</p>
        <p style={{ marginBottom: 8 }}>
          {humanSize(storage.used)} {words.ofWord}{" "}
          {storage.unlimited ? words.noLimit : humanSize(storage.quota)} ·{" "}
          {notesCount(words, noteCount)}
          {storage.quotaUntil
            ? ` · ${words.limitValidUntil} ${storage.quotaUntil.toLocaleDateString(words.locale)}`
            : ""}
        </p>
        <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
          <span style={{ width: `${storage.unlimited ? 4 : percent}%` }} />
        </div>
        {percent >= 90 && !storage.unlimited ? (
          <p className="small" style={{ marginTop: 8 }}>
            {words.spaceRunningOut}
          </p>
        ) : null}
      </section>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.writingEyebrow}</p>
        <h2 style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="edit_note" size={24} />
          {words.howIWriteHere}
        </h2>
        <p className="lead" style={{ marginBottom: 16 }}>
          {words.writingLead}
        </p>

        <ActionForm action={saveWritingSettings} label={words.saveSettings} compact>
          <label
            style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}
          >
            <input
              type="checkbox"
              name="autoSave"
              defaultChecked={writing.autoSave}
              style={{ width: "auto", marginTop: 3 }}
            />
            <span>
              <strong>{words.autoSaveTitle}</strong>
              <span className="small" style={{ display: "block" }}>
                {words.autoSaveAbout}
              </span>
            </span>
          </label>

          <label
            style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}
          >
            <input
              type="checkbox"
              name="bold"
              defaultChecked={writing.bold}
              style={{ width: "auto", marginTop: 3 }}
            />
            <span>
              <strong>{words.boldFontTitle}</strong>
              <span className="small" style={{ display: "block" }}>
                {words.boldFontAbout}
              </span>
            </span>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 14,
            }}
          >
            <div>
              <label htmlFor="font">{words.fontOfNewNote}</label>
              <select id="font" name="font" defaultValue={writing.font}>
                {TEXT_FONTS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {words.locale === "en-GB" ? entry.labelEn : entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fontSize">{words.textSizeLabel}</label>
              <input
                id="fontSize"
                name="fontSize"
                type="number"
                min={0}
                max={TEXT_LARGEST_SIZE}
                defaultValue={writing.fontSize}
              />
              <p className="small" style={{ marginTop: 4 }}>
                {words.zeroMeansDefault} ({TEXT_DEFAULT_SIZE}). {TEXT_SMALLEST_SIZE}–
                {TEXT_LARGEST_SIZE}.
              </p>
            </div>

            <div>
              <label htmlFor="align">{words.alignmentLabel}</label>
              <select id="align" name="align" defaultValue={writing.align}>
                {TEXT_ALIGNMENTS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {words.locale === "en-GB" ? entry.labelEn : entry.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </ActionForm>
      </section>

      <section
        className="sheet-ruled"
        style={{ paddingBlock: 24, paddingInlineEnd: 26, marginBottom: 20 }}
      >
        <p className="eyebrow">{words.deviceTokensEyebrow}</p>
        <h2 style={{ marginBottom: 8 }}>{words.tokenSignIn}</h2>
        <p className="lead" style={{ marginBottom: 16 }}>
          {words.tokenSignInAbout}
        </p>

        <ActionForm action={issueAppToken} label={words.issueToken} busyLabel={words.issuingToken}>
          <div className="field">
            <label htmlFor="device">{words.deviceName}</label>
            <input id="device" name="device" type="text" placeholder={words.deviceNamePlaceholder} />
          </div>
        </ActionForm>

        {devices.length > 0 ? (
          <>
            <hr className="divider" />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{words.columnDevice}</th>
                    <th style={{ width: 160 }}>{words.columnLastUse}</th>
                    <th style={{ width: 140 }} />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        {/*
                          Nazwa jest do zmiany na miejscu. Aplikacja zgłasza się
                          modelem sprzętu, a przy dwóch takich samych tabletach
                          nie sposób poznać, który token do którego należy.
                        */}
                        <ActionForm
                          action={renameDevice}
                          label={words.saveName}
                          icon="edit"
                          compact
                        >
                          <input type="hidden" name="id" value={device.id} />
                          <input
                            name="device"
                            type="text"
                            defaultValue={device.device}
                            maxLength={120}
                            aria-label={deviceNameLabel(words, device.device)}
                            style={{ minHeight: 34, padding: "4px 8px", fontWeight: 600 }}
                          />
                        </ActionForm>
                        <p className="small" style={{ margin: "2px 0 0 0" }}>
                          {words.issuedWord} {device.createdAt.toLocaleDateString(words.locale)}
                        </p>
                      </td>
                      <td className="small">
                        {device.lastUsedAt
                          ? device.lastUsedAt.toLocaleString(words.locale)
                          : words.neverUsed}
                      </td>
                      <td>
                        <ActionForm
                          action={revokeDevice}
                          label={words.revokeToken}
                          compact
                          danger
                          confirmation={words.confirmRevokeToken}
                        >
                          <input type="hidden" name="id" value={device.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16 }}>
              <ActionForm
                action={revokeAllDevices}
                label={words.revokeAllTokens}
                compact
                danger
                confirmation={words.confirmRevokeAll}
              />
            </div>
          </>
        ) : (
          <p className="small" style={{ marginTop: 16 }}>
            {words.noTokensYet}
          </p>
        )}
      </section>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.loginEyebrow}</p>
        <p className="lead">{words.loginIsVisible}</p>
        <ActionForm action={changeOwnLogin} label={words.saveLogin} compact>
          <div className="field">
            <input name="login" type="text" defaultValue={user.login} aria-label={words.loginEyebrow} />
          </div>
        </ActionForm>
      </section>

      <section className="sheet" style={{ padding: "22px 24px", marginBottom: 20 }}>
        <p className="eyebrow">{words.passwordEyebrow}</p>
        <p className="lead">
          {user.passwordHash
            ? words.passwordChangeAbout
            : words.passwordSetAbout}
        </p>
        <ActionForm
          action={changePassword}
          label={user.passwordHash ? words.changePasswordButton : words.setPasswordButton}
          compact
        >
          {user.passwordHash ? (
            <div className="field">
              <label htmlFor="current">{words.currentPassword}</label>
              <input id="current" name="current" type="password" autoComplete="current-password" />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="next">{words.newPasswordLabel}</label>
            <input
              id="next"
              name="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="repeat">{words.repeatNewPassword}</label>
            <input
              id="repeat"
              name="repeat"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
        </ActionForm>
      </section>

      <section className="sheet" style={{ padding: "22px 24px" }}>
        <p className="eyebrow">{words.signOutEyebrow}</p>
        <p className="lead" style={{ marginBottom: 12 }}>
          {words.signOutAbout}
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <form action={logOut}>
            <button type="submit">{words.signOutThisBrowser}</button>
          </form>
          <form action={logOutEverywhere}>
            <button
              type="submit"
              className="danger"
              title={words.signOutEverywhereTitle}
            >
              {words.signOutEverywhere}
            </button>
          </form>
        </div>
        <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
          {words.signOutEverywhereAbout}
        </p>
      </section>
    </main>
  );
}
