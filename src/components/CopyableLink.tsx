"use client";

import { useState } from "react";

export function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className="compact"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            // The clipboard is sometimes blocked. The address is still visible below.
            setCopied(false);
          }
        }}
      >
        {copied ? "Skopiowany" : "Kopiuj odnośnik"}
      </button>
      <p className="small" style={{ margin: "4px 0 0 0", wordBreak: "break-all" }}>
        {url}
      </p>
    </div>
  );
}
