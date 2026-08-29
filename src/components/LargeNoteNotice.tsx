import { Icon } from "@/components/Icon";
import { largeNoteDisplayWarning, type Words } from "@/lib/i18n";
import { humanSize } from "@/lib/quota";

export function LargeNoteNotice({
  words,
  sizeBytes,
  limitBytes,
  downloadHref,
}: {
  words: Words;
  sizeBytes: number;
  limitBytes: number;
  downloadHref: string;
}) {
  return (
    <section className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 28 }}>
      <p
        className="eyebrow"
        style={{ display: "flex", alignItems: "center", gap: 7 }}
      >
        <Icon name="warning" size={18} />
        {words.largeNoteEyebrow}
      </p>
      <h2 style={{ marginBottom: 8 }}>{words.largeNoteHeading}</h2>
      <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 680 }}>
        {largeNoteDisplayWarning(
          words,
          humanSize(sizeBytes),
          humanSize(limitBytes),
        )}
      </p>
      <a className="button primary" href={downloadHref} download>
        <Icon name="download" size={18} />
        {words.downloadNote}
      </a>
    </section>
  );
}
