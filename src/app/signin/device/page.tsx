import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findChallengeByCode } from "@/lib/login-challenge";
import { KajetMark } from "@/components/KajetMark";
import { DeviceApproveForm } from "./DeviceApproveForm";
import { currentWords } from "@/lib/language";
import { deviceAlreadyApproved, deviceAsksForAccess } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await currentWords()).metaConnectDevice };
}

export default async function DeviceSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const words = await currentWords();
  const code = (params.code ?? "").trim();

  if (!code) {
    return (
      <main className="page" style={{ maxWidth: 460 }}>
        <KajetMark />
        <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
          <p className="eyebrow">{words.appEyebrow}</p>
          <h1 style={{ marginBottom: 8 }}>{words.noCodeHeading}</h1>
          <p className="lead">
            {words.noCodeAbout}
          </p>
          <p className="small" style={{ marginTop: 18 }}>
            <Link href="/signin">{words.ordinarySignIn}</Link>
          </p>
        </div>
      </main>
    );
  }

  const user = await currentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/signin/device?code=${code}`)}`);
  }

  const challenge = await findChallengeByCode(code);
  const expired =
    !challenge ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.status === "REDEEMED";
  const denied = challenge?.status === "DENIED";
  const alreadyApproved =
    challenge?.status === "APPROVED" && challenge.userId === user.id;

  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <KajetMark caption={user.login} />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.mobileAppEyebrow}</p>
        <h1 style={{ marginBottom: 8 }}>{words.connectDeviceHeading}</h1>

        {expired ? (
          <>
            <p className="lead">
              {words.codeExpiredAbout}
            </p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">{words.myNotes}</Link>
            </p>
          </>
        ) : denied ? (
          <>
            <p className="lead">{words.signInDenied}</p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">{words.myNotes}</Link>
            </p>
          </>
        ) : alreadyApproved ? (
          <>
            <p className="lead">
              {deviceAlreadyApproved(words, challenge.device)}
            </p>
            <p style={{ marginTop: 16 }}>
              <a className="button primary" href={`kajet://auth?code=${encodeURIComponent(code)}`}>
                {words.openTheApp}
              </a>
            </p>
            <p className="small" style={{ marginTop: 18 }}>
              <Link href="/library">{words.orStayInPanel}</Link>
            </p>
          </>
        ) : (
          <>
            <p className="lead">
              {deviceAsksForAccess(words, challenge?.device ?? "…", user.login, user.email)}
            </p>
            <DeviceApproveForm code={code} device={challenge?.device ?? words.deviceFallback} />
          </>
        )}
      </div>
    </main>
  );
}
