import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { currentRelease } from "@/lib/app-release";
import { KajetMark } from "@/components/KajetMark";
import { Icon } from "@/components/Icon";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaDownload };
}

// Strona ma pokazywać to, co administrator wystawił przed chwilą, a nie to, co
// stało tu przy budowaniu programu.
export const dynamic = "force-dynamic";

export default async function DownloadPage() {
  const release = await currentRelease();
  const words = await currentWords();
  const older = release
    ? await prisma.appRelease.findMany({
        where: { id: { not: release.id } },
        orderBy: { versionCode: "desc" },
        take: 10,
      })
    : [];

  return (
    <main className="page">
      <KajetMark caption={words.androidAppCaption} />

      <div
        className="sheet-ruled"
        style={{ paddingBlock: 34, paddingInlineEnd: 30, marginBottom: 24 }}
      >
        <p className="eyebrow">{words.toDownload}</p>

        {release ? (
          <>
            <h1 style={{ marginBottom: 12 }}>Kajet {release.version}</h1>
            <p className="lead" style={{ maxWidth: 560 }}>
              {words.downloadLead}
            </p>

            <div className="row" style={{ marginTop: 22, alignItems: "center" }}>
              <a className="button primary" href="/download/file" download>
                <Icon name="download" />
                {words.downloadWord} {release.fileName}
              </a>
              <Link className="button" href="/library">
                {words.myNotes}
              </Link>
            </div>
            {/* Co to za plik — system, rozmiar i data — w osobnej linijce
                pod przyciskami, a nie wciśnięte obok nich. */}
            <p className="small" style={{ margin: "10px 0 0 0" }}>
              Android · {humanSize(release.sizeBytes)} · {words.publishedWord}{" "}
              {release.createdAt.toLocaleDateString(words.locale)}
            </p>

            {release.notes ? (
              <div style={{ marginTop: 24 }}>
                <p className="eyebrow">{words.whatChanged}</p>
                <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0, maxWidth: 560 }}>
                  {release.notes}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: 12 }}>{words.noAppYet}</h1>
            <p className="lead" style={{ maxWidth: 560 }}>
              {words.noAppYetBody}
            </p>
            <div className="row" style={{ marginTop: 22 }}>
              <Link className="button primary" href="/library">
                {words.myNotes}
              </Link>
            </div>
          </>
        )}
      </div>

      {release ? (
        <div className="sheet" style={{ padding: "20px 22px", marginBottom: 20 }}>
          <p className="eyebrow">{words.howToInstall}</p>
          <p className="small" style={{ margin: "6px 0 0 0", maxWidth: 620 }}>
            {words.howToInstallBody}
          </p>
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            {words.fileChecksum}: <span className="mono">{release.hash}</span>
          </p>
        </div>
      ) : null}

      {older.length > 0 ? (
        <div className="sheet" style={{ padding: "20px 22px" }}>
          <p className="eyebrow">{words.olderVersions}</p>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>
            {older.map((one) => (
              <li key={one.id} className="small" style={{ marginBottom: 4 }}>
                <a href={`/download/file?release=${one.id}`} download>
                  Kajet {one.version}
                </a>{" "}
                - {humanSize(one.sizeBytes)}, {one.createdAt.toLocaleDateString(words.locale)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
