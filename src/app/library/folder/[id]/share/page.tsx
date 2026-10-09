import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settings, mailWorks } from "@/lib/settings";
import { shareUrl } from "@/lib/sharing";
import { currentWords } from "@/lib/language";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink } from "@/components/CopyableLink";
import { Icon } from "@/components/Icon";
import { folderIcon, folderTint } from "@/lib/folder-look";
import { revokeFolderShare, shareFolder } from "../../../actions";

export async function generateMetadata() {
  return { title: (await currentWords()).folderSharingHeading };
}

/*
  Udostępnianie folderu - ten sam formularz co przy notatce. Folder idzie
  razem z podfolderami i wszystkim, co w nich jest albo dopiero powstanie.
*/
export default async function FolderSharePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const { id } = await params;
  const words = await currentWords();

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.ownerId !== user.id) notFound();

  const shares = await prisma.share.findMany({
    where: { folderId: id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="page">
      <KajetMark home="/library" caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{words.folderSharingHeading}</p>
          <h1 style={{ marginBottom: 4, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={folderTint(folder.colorId)}>
              <Icon name={folderIcon(folder.iconId)} className="folder-mark tinted" filled />
            </span>
            {folder.name}
          </h1>
        </div>
        <Link className="button compact" href={`/library?folder=${folder.id}`}>
          {words.backToList}
        </Link>
      </div>

      <section className="sheet-ruled" style={{ paddingBlock: 24, paddingInlineEnd: 26 }}>
        <h2 style={{ marginBottom: 8 }}>{words.shareThisFolder}</h2>
        <p className="lead">{words.shareFolderAbout}</p>

        <ActionForm action={shareFolder} label={words.shareButton} busyLabel={words.sharePreparing} primary>
          <input type="hidden" name="folderId" value={folder.id} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16,
              marginBottom: 14,
            }}
          >
            <div>
              <label htmlFor="permission">{words.whatTheyMayDo}</label>
              <select id="permission" name="permission" defaultValue="READ">
                <option value="READ">{words.readOnly}</option>
                <option value="EDIT">{words.readAndEdit}</option>
              </select>
            </div>
            <div>
              <label htmlFor="email">{words.emailOptional}</label>
              <input id="email" name="email" type="email" placeholder={words.orJustTheLink} />
              {!mailWorks() ? (
                <p className="small" style={{ marginTop: 4 }}>
                  {words.mailNotSet}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="validDays">{words.validForDays}</label>
              <input id="validDays" name="validDays" type="number" min={0} defaultValue={0} />
              <p className="small" style={{ marginTop: 4 }}>
                {words.zeroMeansForever}
              </p>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <input type="checkbox" name="anonymousAllowed" defaultChecked style={{ width: "auto" }} />
            <span>{words.allowWithoutAccount}</span>
          </label>
        </ActionForm>

        {shares.length > 0 ? (
          <>
            <hr className="divider" />
            <p className="eyebrow">{words.alreadyShared}</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{words.columnWho}</th>
                    <th style={{ width: 120 }}>{words.columnRights}</th>
                    <th style={{ width: 140 }}>{words.columnValidUntil}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shares.map((entry) => {
                    const expired = Boolean(entry.expiresAt && entry.expiresAt < new Date());
                    return (
                      <tr key={entry.id}>
                        <td>
                          {entry.email ? (
                            <>
                              <strong>{entry.email}</strong>
                              <p className="small" style={{ margin: "2px 0 0 0" }}>
                                {entry.acceptedAt ? words.acceptedMark : words.byNameNeedsSignIn}
                              </p>
                            </>
                          ) : (
                            <>
                              <span className="tag">{words.linkWord}</span>
                              {!expired ? (
                                <CopyableLink url={shareUrl(settings.baseUrl, entry.token)} />
                              ) : null}
                            </>
                          )}
                        </td>
                        <td>
                          <span className={entry.permission === "EDIT" ? "tag accent" : "tag"}>
                            {entry.permission === "EDIT" ? words.rightEdit : words.rightRead}
                          </span>
                        </td>
                        <td className="small">
                          {entry.expiresAt
                            ? `${entry.expiresAt.toLocaleDateString(words.locale)}${expired ? words.expiredMark : ""}`
                            : words.noDeadline}
                          {entry.lastUsedAt ? (
                            <p style={{ margin: "2px 0 0 0" }}>
                              {words.openedWord} {entry.lastUsedAt.toLocaleDateString(words.locale)}
                            </p>
                          ) : null}
                        </td>
                        <td>
                          <ActionForm
                            action={revokeFolderShare}
                            label={words.revoke}
                            compact
                            danger
                            confirmation={words.confirmRevoke}
                          >
                            <input type="hidden" name="id" value={entry.id} />
                          </ActionForm>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
