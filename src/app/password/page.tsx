import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mailWorks } from "@/lib/settings";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import { requestLink, setNewPassword } from "./actions";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await currentWords()).metaNewPassword };
}

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const words = await currentWords();
  const valid = token ? await isTokenValid(token) : false;

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        {token && valid ? (
          <>
            <p className="eyebrow">{words.newPasswordEyebrow}</p>
            <h1 style={{ marginBottom: 8 }}>{words.setNewPasswordHeading}</h1>
            <p className="lead">
              {words.newPasswordAbout}
            </p>

            <ActionForm
              action={setNewPassword}
              label={words.saveNewPassword}
              busyLabel={words.savingWord}
              primary
            >
              <input type="hidden" name="token" value={token} />
              <div className="field">
                <label htmlFor="password">{words.newPasswordLabel}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="small" style={{ marginTop: 4 }}>{words.atLeastEightChars}</p>
              </div>
              <div className="field">
                <label htmlFor="passwordRepeat">{words.repeatPassword}</label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </ActionForm>
          </>
        ) : token ? (
          <>
            <p className="eyebrow">{words.linkEyebrow}</p>
            <h1 style={{ marginBottom: 8 }}>{words.linkDeadHeading2}</h1>
            <p className="lead">
              {words.linkOneHourAbout}
            </p>
            <LinkForm words={words} />
          </>
        ) : (
          <>
            <p className="eyebrow">{words.passwordEyebrow}</p>
            <h1 style={{ marginBottom: 8 }}>{words.forgotPasswordHeading}</h1>
            <p className="lead">
              {words.forgotPasswordAbout}
            </p>
            {!mailWorks() ? (
              <p className="error">
                {words.mailNotSetHere}
              </p>
            ) : null}
            <LinkForm words={words} />
          </>
        )}
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        <Link href="/signin">{words.backToSignIn}</Link>
      </p>
    </main>
  );
}

function LinkForm({ words }: { words: Words }) {
  return (
    <ActionForm action={requestLink} label={words.sendLinkButton} busyLabel={words.sendingWord} primary>
      <div className="field">
        <label htmlFor="email">{words.emailAddress}</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
    </ActionForm>
  );
}

async function isTokenValid(token: string): Promise<boolean> {
  const entry = await prisma.verificationToken.findUnique({ where: { token } });
  return Boolean(entry && entry.identifier.startsWith("password:") && entry.expires > new Date());
}
