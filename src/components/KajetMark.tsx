import { LanguageSwitch } from "./LanguageSwitch";
import { currentLanguage } from "@/lib/language";
import { ThemeSwitch } from "./ThemeSwitch";

export async function KajetMark({ caption }: { caption?: string }) {
  const language = await currentLanguage();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        rowGap: 8,
        // Na telefonie przełączniki języka i motywu schodzą do drugiego
        // rzędu, zamiast wypychać nagłówek poza ekran.
        flexWrap: "wrap",
        padding: "0 0 26px 0",
      }}
    >
      {/* The mark is drawn inline, in the accent colour of the current theme -
          the same rule as KajetMark in the tablet app. No file to fetch, so it
          can never appear as a broken image. */}
      <svg
        viewBox="0 0 96 96"
        width={40}
        height={40}
        role="img"
        aria-label="Kajet"
        style={{ display: "block", flexShrink: 0, color: "var(--accent)" }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 10 H66 L80 24 V86 H16 Z" />
          <path d="M36 10 V86" />
        </g>
        <path
          d="M22 62 C34 56, 44 44, 74 38"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="6"
        />
      </svg>
      <span
        style={{
          // Ten sam krój co nagłówki i znak na stronie tytułowej.
          fontFamily: '"Bricolage Grotesque", var(--font-heading)',
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        Kajet
      </span>
      {caption ? <span className="small">{caption}</span> : null}
      {/* Wybór języka i motywu stoi przy znaku, więc jest na każdej stronie -
          także przed zalogowaniem i przy notatce otwartej z odnośnika. */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <LanguageSwitch current={language} />
        <ThemeSwitch />
      </div>
    </div>
  );
}
