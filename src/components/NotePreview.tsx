import {
  readDocument,
  cssColor,
  cssFont,
  cssAlign,
  strokePath,
  type NoteDocument,
  type Stroke,
  type Page,
  type MindNode,
} from "@/lib/document";

export function NotePreview({
  content,
  noteId,
  token,
}: {
  content: string;
  noteId: string;
token?: string;
}) {
  const document = readDocument(content);

  if (!document) {
    return (
      <p className="error">
        Nie udało się odczytać tej notatki. Być może została zapisana nowszą wersją aplikacji.
      </p>
    );
  }

  if (document.handwriting?.pages?.length) {
    return (
      <div className="column" style={{ gap: 20 }}>
        {document.handwriting.pages.map((page, index) => (
          <HandwrittenPage
            key={page.id ?? index}
            page={page}
            noteBackground={document.handwriting?.background}
            number={index + 1}
            total={document.handwriting?.pages?.length ?? 1}
            noteId={noteId}
            token={token}
          />
        ))}
      </div>
    );
  }

  if (document.mindMap?.nodes?.length) {
    return <MindMap map={document.mindMap} />;
  }

  if (document.text) {
    return <TextNote document={document} noteId={noteId} token={token} />;
  }

  if (document.code?.source != null || document.code?.language) {
    return (
      <pre
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          background: "var(--desk)",
          padding: "14px 16px",
          borderRadius: "var(--radius)",
          borderLeft: "2px solid var(--rule)",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {document.code.source ?? ""}
      </pre>
    );
  }

  return <p className="lead">Ta notatka jest pusta.</p>;
}

// --- Handwriting ---

const LINE_SPACING = 28;
const GRID_SPACING = 20;
const PAGE_MARGIN = 60;

function HandwrittenPage({
  page,
  noteBackground,
  number,
  total,
  noteId,
  token,
}: {
  page: Page;
  noteBackground?: string;
  number: number;
  total: number;
  noteId: string;
  token?: string;
}) {
  const width = page.width ?? 595;
  const height = page.height ?? 842;
  const background = page.background ?? noteBackground ?? "lined";

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Strona ${number} z ${total}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: "var(--sheet)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius)",
        }}
      >
        <PageBackground kind={background} width={width} height={height} />

        {(page.images ?? []).map((image) => (
          <image
            key={image.id}
            href={attachmentUrl(noteId, image.asset, token)}
            x={image.x}
            y={image.y}
            width={image.width}
            height={image.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ))}

        {(page.strokes ?? []).map((stroke) => (
          <StrokeSvg key={stroke.id} stroke={stroke} />
        ))}

        {(page.texts ?? []).map((box) => (
          <foreignObject key={box.id} x={box.x} y={box.y} width={box.width} height={box.height}>
            {/* React switches the namespace back to ordinary page content by
                itself once inside foreignObject, so we do not set it by hand. */}
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: 4,
                boxSizing: "border-box",
                fontFamily: cssFont(box.font),
                fontSize: `${box.fontSize ?? 14}px`,
                lineHeight: 1.35,
                color: cssColor(box.color),
                fontWeight: box.bold ? 600 : 400,
                fontStyle: box.italic ? "italic" : "normal",
                textDecoration: box.underline ? "underline" : "none",
                textAlign: cssAlign(box.align),
                background: box.background ? cssColor(box.background, "transparent") : "none",
                whiteSpace: "pre-wrap",
                overflow: "hidden",
              }}
            >
              {box.text ?? ""}
            </div>
          </foreignObject>
        ))}
      </svg>

      {total > 1 ? (
        <figcaption className="small" style={{ marginTop: 6 }}>
          Strona {number} z {total}
        </figcaption>
      ) : null}
    </figure>
  );
}

function StrokeSvg({ stroke }: { stroke: Stroke }) {
  const path = strokePath(stroke);
  if (!path) return null;

  const highlighter = stroke.tool === "highlighter";

  return (
    <path
      d={path}
      fill="none"
      stroke={cssColor(stroke.color)}
      strokeWidth={stroke.size || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // A highlighter should go under the text, not over it. SVG has no layers,
      // so we give it multiply blending: the stroke lets through what is beneath.
      style={highlighter ? { mixBlendMode: "multiply" } : undefined}
      strokeDasharray={stroke.tool === "dashed" ? `${(stroke.size || 2) * 3}` : undefined}
    />
  );
}

function PageBackground({
  kind,
  width,
  height,
}: {
  kind: string;
  width: number;
  height: number;
}) {
  const colour = "var(--rule)";
  const patternId = `background-${kind}`;

  if (kind === "plain") return null;

  return (
    <>
      <defs>
        {kind === "lined" ? (
          <pattern id={patternId} width={width} height={LINE_SPACING} patternUnits="userSpaceOnUse">
            <line
              x1="0"
              y1={LINE_SPACING}
              x2={width}
              y2={LINE_SPACING}
              stroke={colour}
              strokeWidth="0.6"
            />
          </pattern>
        ) : null}

        {kind === "grid" ? (
          <pattern
            id={patternId}
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`}
              fill="none"
              stroke={colour}
              strokeWidth="0.6"
            />
          </pattern>
        ) : null}

        {kind === "dots" ? (
          <pattern
            id={patternId}
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.9" cy="0.9" r="0.9" fill={colour} />
          </pattern>
        ) : null}

        {kind === "stave" ? (
          <pattern id={patternId} width={width} height={91} patternUnits="userSpaceOnUse">
            {[0, 9, 18, 27, 36].map((y) => (
              <line
                key={y}
                x1={30}
                y1={y + 9}
                x2={width - 30}
                y2={y + 9}
                stroke={colour}
                strokeWidth="0.6"
              />
            ))}
          </pattern>
        ) : null}
      </defs>

      <rect width={width} height={height} fill={`url(#${patternId})`} />

      {/* The margin line, the same one that runs through the whole app. */}
      <line x1={PAGE_MARGIN} y1="0" x2={PAGE_MARGIN} y2={height} stroke={colour} strokeWidth="0.9" />
    </>
  );
}

// --- Mind map ---

function MindMap({
  map,
}: {
  map: { nodes?: MindNode[]; edges?: { id: string; fromId: string; toId: string }[] };
}) {
  const nodes = map.nodes ?? [];
  const edges = map.edges ?? [];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // A frame around everything, with slack so edge nodes do not touch the border.
  const slack = 40;
  const left = Math.min(...nodes.map((n) => n.x)) - slack;
  const top = Math.min(...nodes.map((n) => n.y)) - slack;
  const right = Math.max(...nodes.map((n) => n.x + (n.width ?? 160))) + slack;
  const bottom = Math.max(...nodes.map((n) => n.y + (n.height ?? 64))) + slack;

  return (
    <svg
      viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
      role="img"
      aria-label="Mapa myśli"
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: "var(--sheet)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius)",
      }}
    >
      {edges.map((edge) => {
        const from = byId.get(edge.fromId);
        const to = byId.get(edge.toId);
        if (!from || !to) return null;

        const fromX = from.x + (from.width ?? 160) / 2;
        const fromY = from.y + (from.height ?? 64) / 2;
        const toX = to.x + (to.width ?? 160) / 2;
        const toY = to.y + (to.height ?? 64) / 2;

        return (
          <line
            key={edge.id}
            x1={fromX}
            y1={fromY}
            x2={toX}
            y2={toY}
            stroke="var(--rule)"
            strokeWidth="2"
          />
        );
      })}

      {nodes.map((node) => {
        const width = node.width ?? 160;
        const height = node.height ?? 64;
        const colour = node.customColor ? cssColor(node.customColor) : "var(--accent)";
        const align = cssAlign(node.align);

        return (
          <g key={node.id}>
            {node.shape === "oval" ? (
              <ellipse
                cx={node.x + width / 2}
                cy={node.y + height / 2}
                rx={width / 2}
                ry={height / 2}
                fill="var(--sheet)"
                stroke={colour}
                strokeWidth="2"
              />
            ) : (
              <rect
                x={node.x}
                y={node.y}
                width={width}
                height={height}
                rx="3"
                fill="var(--sheet)"
                stroke={colour}
                strokeWidth="2"
              />
            )}

            <foreignObject x={node.x} y={node.y} width={width} height={height}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    align === "center"
                      ? "center"
                      : align === "right"
                        ? "flex-end"
                        : "flex-start",
                  padding: "6px 10px",
                  boxSizing: "border-box",
                  fontFamily: cssFont(node.font),
                  fontSize: `${node.fontSize ?? 15}px`,
                  lineHeight: 1.3,
                  fontWeight: node.bold ? 600 : 400,
                  fontStyle: node.italic ? "italic" : "normal",
                  color: node.textColor ? cssColor(node.textColor) : "var(--text)",
                  textAlign: align,
                  overflow: "hidden",
                }}
              >
                {node.text ?? ""}
              </div>
            </foreignObject>

            {/* A caption written with the stylus lies in the node's coordinates. */}
            {node.ink?.length ? (
              <g transform={`translate(${node.x} ${node.y})`}>
                {node.ink.map((stroke) => (
                  <StrokeSvg key={stroke.id} stroke={stroke} />
                ))}
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// --- Text note ---

function TextNote({
  document,
  noteId,
  token,
}: {
  document: NoteDocument;
  noteId: string;
  token?: string;
}) {
  const markdown = document.text?.markdown ?? "";
  if (!markdown.trim()) return <p className="lead">Ta notatka jest pusta.</p>;

  return (
    <div style={{ maxWidth: "var(--reading-width)" }}>{markdownBlocks(markdown, noteId, token)}</div>
  );
}

function markdownBlocks(markdown: string, noteId: string, token?: string) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];

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
        // A plain image tag rather than a Next component: the URL points at our
        // own route, which serves the file after checking permissions.
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
