import { attachmentUrl, cssAlign, cssFont, displayInkColor } from "@/lib/document";
import { markdownToHtml } from "@/lib/rich-text";
import { currentWords } from "@/lib/language";

/*
  Notatka tekstowa do czytania: podgląd notatki i strona z udostępnionym
  odnośnikiem.

  Rysuje ją dokładnie ten sam przekład, co pole do pisania (lib/rich-text.ts),
  i ten sam arkusz (klasa `rich-text`). Dzięki temu to, co widać w trakcie
  pisania, jest tym, co zobaczy druga osoba - wcześniej podgląd miał własnego,
  uboższego czytnika markdownu i pogrubienie zostawało w nim jako „**tekst**".

  Wstawianie gotowego HTML-a jest tu bezpieczne, bo ten HTML składamy sami:
  treść idzie przez `escapeHtml`, a adresy przez `safeUrl` - z notatki nie ma
  jak wyjść ani znacznik, ani odnośnik `javascript:`.
*/
export async function MarkdownPreview({
  markdown,
  noteId,
  token,
  appearance,
}: {
  markdown: string;
  noteId: string;
  token?: string;
  /** Whole-note appearance stored with the note (the same fields as on the tablet). */
  appearance?: { font?: string; fontSize?: number; textColor?: number; align?: string };
}) {
  if (!markdown.trim()) return <p className="lead">{(await currentWords()).emptyNoteText}</p>;

  const html = markdownToHtml(markdown, {
    imageUrl: (target) =>
      target.startsWith("assets/")
        ? attachmentUrl(noteId, target.slice("assets/".length), token)
        : target,
  });

  return (
    <div
      className="rich-text"
      style={{
        maxWidth: "var(--reading-width)",
        fontFamily: cssFont(appearance?.font),
        fontSize: appearance?.fontSize ? appearance.fontSize : undefined,
        textAlign: cssAlign(appearance?.align),
        color: appearance?.textColor ? displayInkColor(appearance.textColor) : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
