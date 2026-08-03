export function KajetMark({ caption }: { caption?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 0 26px 0",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={40}
        height={40}
        style={{
          display: "block",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        Kajet
      </span>
      {caption ? <span className="small">{caption}</span> : null}
    </div>
  );
}
