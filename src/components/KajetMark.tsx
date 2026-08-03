export function KajetMark({ caption }: { caption?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        padding: "0 0 26px 0",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 2,
          height: 34,
          background: "var(--accent)",
          transform: "translateY(6px)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        Kajet
      </span>
      {caption ? <span className="small">{caption}</span> : null}
    </div>
  );
}
