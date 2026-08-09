import Link from "next/link";
import { KajetMark } from "@/components/KajetMark";
import { googleWorks } from "@/lib/settings";
import { RegistrationForm } from "./RegistrationForm";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaRegister };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const words = await currentWords();

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.newAccountEyebrow}</p>
        <h1 style={{ marginBottom: 8 }}>{words.createAccountHeading}</h1>
        <p className="lead">
          {words.registerLead}
        </p>

        <RegistrationForm codeFromLink={code ?? ""} googleAvailable={googleWorks()} />
      </div>

      <p className="small" style={{ marginTop: 20, textAlign: "center" }}>
        {words.haveAccountAlready} <Link href="/signin">{words.signIn}</Link>
      </p>
    </main>
  );
}
