import type { ReactNode } from "react";

/** Shared Markdown renderer for TEXT notes (editor preview + NotePreview). */
export function MarkdownPreview({
  markdown,
  noteId,
  token,
}: {
  markdown: string;
  noteId: string;
  token?: string;
}) {
  if (!markdown.trim()) return <p className="lead">Ta notatka jest pusta.</p>;
  return (
    <div style={{ maxWidth: "var(--reading-width)" }}>
      {markdownBlocks(markdown, noteId, token)}
    </div>
  );
}

function markdownBlocks(markdown: string, noteId: string, token?: string) {
  const lines = markdown.split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: { text: string; task?: boolean; done?: boolean }[] = [];
  let code: string[] | null = null;

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p key={`p${blocks.length}`}>{paragraph.join(" ")}</p>);
    paragraph = [];
  };

  const closeList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} style={{ paddingLeft: list[0].task ? 0 : "1.3em" }}>
        {list.map((item, i) => (
          <li key={i} style={item.task ? { listStyle: "none" } : undefined}>
            {item.task ? <span style={{ marginRight: 8 }}>{item.done ? "☑" : "☐"}</span> : null}
            <span
              style={
                item.done
                  ? { textDecoration: "line-through", color: "var(--text-muted)" }
                  : undefined
              }
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (code === null) {
        closeParagraph();
        closeList();
        code = [];
      } else {
        blocks.push(
          <pre
            key={`code${blocks.length}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              background: "var(--desk)",
              padding: "14px 16px",
              borderRadius: "var(--radius)",
              borderLeft: "2px solid var(--rule)",
              overflowX: "auto",
            }}
          >
            {code.join("\n")}
          </pre>,
        );
        code = null;
      }
      continue;
    }

    if (code !== null) {
      code.push(line);
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (image) {
      closeParagraph();
      closeList();
      const url = image[2].startsWith("assets/")
        ? attachmentUrl(noteId, image[2].slice("assets/".length), token)
        : image[2];
      blocks.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`img${blocks.length}`}
          src={url}
          alt={image[1] || "Zdjęcie w notatce"}
          style={{
            maxWidth: "100%",
            height: "auto",
            display: "block",
            margin: "1em 0",
            borderRadius: "var(--radius)",
            border: "1px solid var(--rule)",
          }}
        />,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2];
      blocks.push(
        level === 1 ? (
          <h2 key={`h${blocks.length}`} style={{ marginTop: "1.4em" }}>
            {text}
          </h2>
        ) : level === 2 ? (
          <h3 key={`h${blocks.length}`} style={{ marginTop: "1.3em" }}>
            {text}
          </h3>
        ) : (
          <h3 key={`h${blocks.length}`} style={{ marginTop: "1.2em", fontSize: 15 }}>
            {text}
          </h3>
        ),
      );
      continue;
    }

    const task = line.match(/^\s*-\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      closeParagraph();
      list.push({ text: task[2], task: true, done: task[1].toLowerCase() === "x" });
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      closeParagraph();
      list.push({ text: item[1] });
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      closeParagraph();
      closeList();
      blocks.push(
        <blockquote
          key={`q${blocks.length}`}
          style={{
            margin: "1em 0",
            padding: "2px 0 2px 16px",
            borderLeft: "2px solid var(--accent)",
            color: "var(--text-muted)",
          }}
        >
          {quote[1]}
        </blockquote>,
      );
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  closeParagraph();
  closeList();
  return blocks;
}

function attachmentUrl(noteId: string, name: string, token?: string): string {
  const encoded = encodeURIComponent(name);
  return token
    ? `/n/${token}/attachment?name=${encoded}`
    : `/note/${noteId}/attachment?name=${encoded}`;
}
