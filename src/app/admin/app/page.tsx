import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { settings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink } from "@/components/CopyableLink";
import { deleteRelease, makeReleaseCurrent } from "../actions";
import { ReleaseForm } from "./ReleaseForm";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaAdminApp };
}

export default async function AppReleasesPage() {
  const releases = await prisma.appRelease.findMany({
    orderBy: { versionCode: "desc" },
    include: { uploadedBy: { select: { login: true } } },
    take: 50,
  });

  const highest = releases[0]?.versionCode ?? 0;
  const words = await currentWords();

  return (
    <>
      <div
        className="sheet-ruled"
        style={{ paddingBlock: 24, paddingInlineEnd: 26, marginBottom: 24 }}
      >
        <p className="eyebrow">{words.newReleaseEyebrow}</p>
        <h2 style={{ marginBottom: 6 }}>{words.publishAppHeading}</h2>
        <p className="lead">
          {words.publishAppLead}
        </p>

        <ReleaseForm nextVersionCode={highest + 1} />
      </div>

      <h2 style={{ marginBottom: 12 }}>{words.publishedReleases}</h2>

      {releases.length === 0 ? (
        <div className="sheet" style={{ padding: "24px 26px" }}>
          <p className="lead" style={{ margin: 0 }}>
            {words.noReleasesYet}
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          {/*
            Własna klasa, bo changelog bywa długi. Domyślne wyrównanie do
            środka wieszało wersję i przyciski w połowie wysokości wiersza.
          */}
          <table className="releases-table">
            <thead>
              <tr>
                <th>{words.columnVersion}</th>
                <th>{words.columnFile}</th>
                <th>{words.columnDownloads}</th>
                <th>{words.columnPublished}</th>
                <th>{words.whatChangedLabel}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {releases.map((release) => (
                <tr key={release.id}>
                  <td>
                    <span className="row release-version-row" style={{ gap: 8 }}>
                      <span className="mono release-version">{release.version}</span>
                      {release.current ? <span className="tag accent">{words.tagDownloadable}</span> : null}
                    </span>
                    <p className="small" style={{ margin: "4px 0 0 0" }}>
                      {words.releaseNumberWord} {release.versionCode}
                    </p>
                  </td>
                  <td>
                    {release.fileName}
                    <p className="small" style={{ margin: "4px 0 0 0" }}>
                      {humanSize(release.sizeBytes)}
                    </p>
                    {release.current ? (
                      <CopyableLink url={`${settings.baseUrl}/download`} />
                    ) : null}
                  </td>
                  <td>{release.downloads}</td>
                  <td>
                    {release.createdAt.toLocaleDateString(words.locale)}
                    <p className="small" style={{ margin: "4px 0 0 0" }}>
                      {release.uploadedBy ? `${words.publishedByWord} ${release.uploadedBy.login}` : "-"}
                    </p>
                  </td>
                  <td>
                    <div className="release-notes">{release.notes ?? "-"}</div>
                  </td>
                  <td className="cell-actions">
                    <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                      <a
                        className="button compact"
                        href={`/download/file?release=${release.id}`}
                        download
                      >
                        {words.downloadWord}
                      </a>
                      {release.current ? null : (
                        <ActionForm action={makeReleaseCurrent} label={words.makeCurrent} compact quiet>
                          <input type="hidden" name="id" value={release.id} />
                        </ActionForm>
                      )}
                      <ActionForm
                        action={deleteRelease}
                        label={words.delete}
                        compact
                        danger
                        quiet
                        confirmation={words.confirmDeleteRelease}
                      >
                        <input type="hidden" name="id" value={release.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
