"use client";

import { useState } from "react";
import { useWords } from "@/components/LanguageProvider";

/** A compact button that puts the given text in the clipboard. */
export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const words = useWords();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="compact"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // The clipboard is sometimes blocked. The value stays visible on the page.
          setCopied(false);
        }
      }}
    >
      {copied ? (copiedLabel ?? words.copiedWord) : (label ?? words.copyWord)}
    </button>
  );
}

export function CopyableLink({ url }: { url: string }) {
  const words = useWords();
  return (
    <div style={{ marginTop: 6 }}>
      <CopyButton value={url} label={words.copyLink} copiedLabel={words.linkCopied} />
      <p className="small" style={{ margin: "4px 0 0 0", wordBreak: "break-all" }}>
        {url}
      </p>
    </div>
  );
}
