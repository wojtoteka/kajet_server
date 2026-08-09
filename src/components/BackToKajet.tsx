import Link from "next/link";
import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { currentWords } from "@/lib/language";

/*
  Wyjście z dokumentu z powrotem do Kajetu.

  Regulamin i politykę otwiera się zwykle z odnośnika - ze stopki, z aplikacji,
  z cudzej wiadomości - i wtedy „wstecz" w przeglądarce nie ma dokąd wrócić.
  Zalogowanego odsyłamy prosto do jego notatek, resztę na stronę tytułową:
  dla kogoś bez konta biblioteka byłaby tylko ekranem logowania.
*/

export async function BackToKajet() {
  const session = await auth();
  const words = await currentWords();
  const signedIn = Boolean(session?.user?.id);

  return (
    <p style={{ margin: "0 0 20px 0" }}>
      <Link className="button" href={signedIn ? "/library" : "/"}>
        <Icon name="arrow_back" size={18} />
        {signedIn ? words.myNotes : words.homePage}
      </Link>
    </p>
  );
}
