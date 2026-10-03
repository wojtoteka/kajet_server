import { Icon } from "@/components/Icon";
import { currentWords } from "@/lib/language";

/*
  „Drukuj" przy notatce - u właściciela i na stronie z odnośnika.

  Nie drukujemy strony z edytorem: pole do pisania, pasek narzędzi, pliki
  i udostępnianie wyszłyby na papierze razem z treścią. Przycisk otwiera
  w nowej karcie osobną stronę z samą notatką (…/print), a ta sama woła okno
  drukowania. Na telefonie to jedyna droga, która działa wszędzie - druk
  z ukrytej ramki iOS i część Androidów zamieniają na druk całej strony.
*/
export async function PrintButton({ href }: { href: string }) {
  const words = await currentWords();
  return (
    <a className="button compact" href={href} target="_blank" rel="noopener">
      <Icon name="print" size={18} />
      {words.printNote}
    </a>
  );
}
