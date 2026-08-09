import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";
import { addressConfirmedBody, type Words } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await currentWords()).metaConfirm };
}

const KEY = "confirm:";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const words = await currentWords();
  const result = await confirm(token, words);

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.emailAddressEyebrow}</p>
        <h1 style={{ marginBottom: 12 }}>{result.heading}</h1>
        <p className="lead">{result.body}</p>

        <Link className="button primary" href={result.ok ? "/signin" : "/register"}>
          {result.ok ? words.goToSignIn : words.backToRegister}
        </Link>
      </div>
    </main>
  );
}

type ConfirmResult = { ok: boolean; heading: string; body: string };

async function confirm(token: string | undefined, words: Words): Promise<ConfirmResult> {
  if (!token) {
    return {
      ok: false,
      heading: words.noLinkHeading,
      body: words.noLinkBody,
    };
  }

  const entry = await prisma.verificationToken.findUnique({ where: { token } });

  if (!entry || !entry.identifier.startsWith(KEY)) {
    return {
      ok: false,
      heading: words.linkDeadHeading,
      body: words.linkDeadBody,
    };
  }

  if (entry.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return {
      ok: false,
      heading: words.linkExpiredHeading,
      body: words.linkExpiredBody,
    };
  }

  const email = entry.identifier.slice(KEY.length);

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return {
    ok: true,
    heading: words.addressConfirmed,
    body: addressConfirmedBody(words, email),
  };
}
