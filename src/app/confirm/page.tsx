import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KajetMark } from "@/components/KajetMark";

export const metadata = { title: "Potwierdzenie adresu — Kajet" };

const KEY = "confirm:";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await confirm(token);

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <KajetMark />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">Adres e-mail</p>
        <h1 style={{ marginBottom: 12 }}>{result.heading}</h1>
        <p className="lead">{result.body}</p>

        <Link className="button primary" href={result.ok ? "/signin" : "/register"}>
          {result.ok ? "Przejdź do logowania" : "Wróć do rejestracji"}
        </Link>
      </div>
    </main>
  );
}

type ConfirmResult = { ok: boolean; heading: string; body: string };

async function confirm(token: string | undefined): Promise<ConfirmResult> {
  if (!token) {
    return {
      ok: false,
      heading: "Brak odnośnika",
      body: "Ten adres nie zawiera tokenu. Otwórz odnośnik prosto z wiadomości, którą dostałeś.",
    };
  }

  const entry = await prisma.verificationToken.findUnique({ where: { token } });

  if (!entry || !entry.identifier.startsWith(KEY)) {
    return {
      ok: false,
      heading: "Odnośnik już nie działa",
      body: "Ten odnośnik został już użyty albo jest nieprawidłowy. Jeśli konto działa, po prostu się zaloguj.",
    };
  }

  if (entry.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return {
      ok: false,
      heading: "Odnośnik wygasł",
      body: "Odnośnik był ważny przez dobę. Zaloguj się i poproś o nowe potwierdzenie w ustawieniach konta.",
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
    heading: "Adres potwierdzony",
    body: `Adres ${email} jest już potwierdzony. Możesz się zalogować tutaj i w aplikacji na tablecie.`,
  };
}
