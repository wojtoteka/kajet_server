import { readDocument, type MindEdge, type MindNode, type NoteDocument } from "./document";

export type MindMapBody = {
  nodes: MindNode[];
  edges: MindEdge[];
  viewX: number;
  viewY: number;
  zoom: number;
};

/** Build content.json for a MINDMAP note in the shape the tablet expects. */
export function buildMindMapNoteContent(options: {
  id: string;
  title: string;
  nodes: MindNode[];
  edges: MindEdge[];
  viewX?: number;
  viewY?: number;
  zoom?: number;
  existing?: NoteDocument | null;
}): string {
  const now = Date.now();
  const existing = options.existing;

  return JSON.stringify({
    format: existing?.format ?? 1,
    id: options.id,
    kind: "mindmap",
    title: options.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    mindMap: {
      nodes: options.nodes,
      edges: options.edges,
      viewX: options.viewX ?? existing?.mindMap?.viewX ?? 0,
      viewY: options.viewY ?? existing?.mindMap?.viewY ?? 0,
      zoom: options.zoom ?? existing?.mindMap?.zoom ?? 1,
    },
  });
}

export function parseMindMapNote(content: string): MindMapBody | null {
  const document = readDocument(content);
  if (!document) return null;
  const map = document.mindMap;
  return {
    nodes: map?.nodes ?? [],
    edges: map?.edges ?? [],
    viewX: map?.viewX ?? 0,
    viewY: map?.viewY ?? 0,
    zoom: map?.zoom ?? 1,
  };
}

export function parseExistingMindMapDocument(content: string): NoteDocument | null {
  return readDocument(content);
}

/** Default root node for a brand-new mind map. */
export function defaultMindMapSeed(): { nodes: MindNode[]; edges: MindEdge[] } {
  return {
    nodes: [
      {
        id: cryptoRandomId(),
        x: 200,
        y: 160,
        width: 160,
        height: 64,
        shape: "rectangle",
        text: "Temat",
        ink: [],
        colorId: "grafit",
        customColor: 0,
        fontSize: 15,
        font: "body",
        bold: false,
        italic: false,
        align: "center",
        textColor: 0,
        collapsed: false,
      },
    ],
    edges: [],
  };
}

export function createMindNode(partial: Partial<MindNode> & Pick<MindNode, "x" | "y">): MindNode {
  return {
    id: partial.id ?? cryptoRandomId(),
    x: partial.x,
    y: partial.y,
    width: partial.width ?? 160,
    height: partial.height ?? 64,
    shape: partial.shape ?? "rectangle",
    text: partial.text ?? "",
    ink: partial.ink ?? [],
    colorId: partial.colorId ?? "grafit",
    customColor: partial.customColor ?? 0,
    fontSize: partial.fontSize ?? 15,
    font: partial.font ?? "body",
    bold: partial.bold ?? false,
    italic: partial.italic ?? false,
    align: partial.align ?? "center",
    textColor: partial.textColor ?? 0,
    collapsed: partial.collapsed ?? false,
  };
}

export function createMindEdge(fromId: string, toId: string): MindEdge {
  return { id: cryptoRandomId(), fromId, toId };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
