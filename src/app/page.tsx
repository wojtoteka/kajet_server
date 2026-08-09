import Link from "next/link";
import { auth } from "@/lib/auth";
import { currentRelease } from "@/lib/app-release";
import { humanSize } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";

export default async function HomePage() {
  const session = await auth();
  const release = await currentRelease();
  const words = await currentWords();

  return (
    <main className="page">
      <KajetMark />

      <div
        className="sheet-ruled"
        style={{ paddingBlock: 34, paddingInlineEnd: 30, marginBottom: 24 }}
      >
        <p className="eyebrow">{words.homeEyebrow}</p>
        <h1 style={{ marginBottom: 12 }}>{words.homeHeading}</h1>
        <p className="lead" style={{ maxWidth: 560 }}>
          {words.homeLead}
        </p>

        <div className="row" style={{ marginTop: 22 }}>
          {session?.user?.id ? (
            <Link className="button primary" href="/library">
              {words.myNotes}
            </Link>
          ) : (
            <>
              <Link className="button primary" href="/signin">
                {words.signIn}
              </Link>
              <Link className="button" href="/register">
                {words.haveInviteCode}
              </Link>
            </>
          )}
          {release ? (
            <Link className="button" href="/download">
              {words.downloadForAndroid}
            </Link>
          ) : null}
        </div>

        {release ? (
          <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
            {words.latestRelease}: {release.version}, {humanSize(release.sizeBytes)}.
          </p>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <Tile
          eyebrow={words.tileNoAccountEyebrow}
          heading={words.tileNoAccountHeading}
          body={words.tileNoAccountBody}
        />
        <Tile
          eyebrow={words.tileAccountEyebrow}
          heading={words.tileAccountHeading}
          body={words.tileAccountBody}
        />
        <Tile
          eyebrow={words.tileTogetherEyebrow}
          heading={words.tileTogetherHeading}
          body={words.tileTogetherBody}
        />
      </div>

      <p className="small" style={{ marginTop: 28 }}>
        {words.inviteCodeNote}
      </p>
    </main>
  );
}

function Tile({
  eyebrow,
  heading,
  body,
}: {
  eyebrow: string;
  heading: string;
  body: string;
}) {
  return (
    <div className="sheet" style={{ padding: "20px 22px" }}>
      <p className="eyebrow">{eyebrow}</p>
      <h3 style={{ marginBottom: 6 }}>{heading}</h3>
      <p className="small" style={{ margin: 0 }}>
        {body}
      </p>
    </div>
  );
}
