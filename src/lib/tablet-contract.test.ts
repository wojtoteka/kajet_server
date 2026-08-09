import { describe, expect, it } from "vitest";
import { outgoingNoteSchema, SYNC_KINDS } from "./note-write";
import { json } from "./api";
import { crashBody } from "./crash-report";
import { LONGEST_REPORT } from "./crash-limits";
import {
  buildTextNoteContent,
  parseExistingTextDocument,
  textAppearanceFromContent,
} from "./text-note";

/**
 * Contract tests against the tablet app (cloud/…/CloudClient.kt).
 *
 * The JSON strings below are exactly what kotlinx.serialization produces with
 * the client configuration (encodeDefaults = true, explicitNulls = false).
 * The mirror image of these tests lives in the app repository as
 * ServerContractTest.kt. When one side changes shape, both suites must agree.
 */
describe("tablet contract", () => {
  it("accepts the note body the tablet sends", () => {
    // OutgoingNote with defaults encoded: favorite/tags/deleted present,
    // folderId absent because it is null and explicitNulls is off.
    const body =
      '{"id":"n1","title":"Fizyka","kind":"HANDWRITTEN","favorite":true,' +
      '"tags":["szkola","fizyka"],"content":"{\\"id\\":\\"n1\\"}",' +
      '"baseVersion":3,"deleted":false}';

    const parsed = outgoingNoteSchema.safeParse(JSON.parse(body));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.folderId).toBeUndefined();
      expect(parsed.data.tags).toEqual(["szkola", "fizyka"]);
    }
  });

  it("accepts a minimal body without the optional fields", () => {
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "",
      kind: "TEXT",
      content: "{}",
      baseVersion: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("round-trips the text colour the tablet writes into content.json", () => {
    // TextContent from NoteDocument.kt with a non-zero textColor: a signed
    // 32-bit ARGB, exactly as kotlinx.serialization encodes it.
    const content =
      '{"format":1,"id":"n1","kind":"text","title":"Tekst",' +
      '"createdAt":1,"updatedAt":2,"tags":[],"favorite":false,' +
      '"text":{"markdown":"abc","drawings":[],"font":"body","fontSize":0,' +
      '"textColor":-10079710,"align":"left"}}';

    const appearance = textAppearanceFromContent(content);
    expect(appearance.textColor).toBe(-10079710);

    const resaved = buildTextNoteContent({
      id: "n1",
      title: "Tekst",
      markdown: "abcd",
      existing: parseExistingTextDocument(content),
    });
    expect(JSON.parse(resaved).text.textColor).toBe(-10079710);
  });

  it("keeps CODE outside the legacy GET kinds but accepts it on PUT", () => {
    // Old apps read GET /api/v1/notes without ?kinds=all and must never see
    // CODE content; new apps both send and receive it.
    expect(SYNC_KINDS).not.toContain("CODE");
    const parsed = outgoingNoteSchema.safeParse({
      id: "n1",
      title: "program.py",
      kind: "CODE",
      content: '{"code":{"language":"python","source":"print(1)"}}',
      baseVersion: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts the tombstone body the app sends when a note is binned", () => {
    // OutgoingNote with deleted=true and empty content, kotlinx defaults on.
    const body =
      '{"id":"n1","title":"","kind":"TEXT","favorite":false,"tags":[],' +
      '"content":"","baseVersion":3,"deleted":true}';

    const parsed = outgoingNoteSchema.safeParse(JSON.parse(body));

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.deleted).toBe(true);
  });

  it("accepts a note body carrying the folder field the new app sends", () => {
    // Since folder sync: a note inside a folder carries that folder's id,
    // a note at the root carries "" (the client serialiser drops nulls, so
    // an explicit root needs a value). Absent still means "leave it".
    const inFolder =
      '{"id":"n1","title":"Fizyka","kind":"TEXT","favorite":false,"tags":[],' +
      '"folderId":"f-123","content":"{}","baseVersion":1,"deleted":false}';
    const atRoot =
      '{"id":"n1","title":"Fizyka","kind":"TEXT","favorite":false,"tags":[],' +
      '"folderId":"","content":"{}","baseVersion":1,"deleted":false}';

    const parsedFolder = outgoingNoteSchema.safeParse(JSON.parse(inFolder));
    const parsedRoot = outgoingNoteSchema.safeParse(JSON.parse(atRoot));

    expect(parsedFolder.success).toBe(true);
    if (parsedFolder.success) expect(parsedFolder.data.folderId).toBe("f-123");
    expect(parsedRoot.success).toBe(true);
    if (parsedRoot.success) expect(parsedRoot.data.folderId).toBe("");
  });

  // --- POST /api/v1/crash ---

  it("accepts the crash report the tablet sends", () => {
    // CrashReporter.Body encoded by CloudClient.json: explicitNulls is off, so
    // fields the app could not read from the header are simply absent.
    const body =
      '{"report":"Kajet 1.0 (2)\\nWątek: main\\n\\njava.lang.IllegalStateException: pękło",' +
      '"appVersion":"1.0","versionCode":2,"device":"LENOVO TB520FU","android":"16",' +
      '"thread":"main"}';

    const parsed = crashBody.safeParse(JSON.parse(body));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.versionCode).toBe(2);
      expect(parsed.data.device).toBe("LENOVO TB520FU");
    }
  });

  it("accepts a crash report stripped down to the report itself", () => {
    // An older file whose header the app could not read: everything optional
    // falls away and only the text is left. It must still get through, because
    // a report nobody can classify is still a report.
    const parsed = crashBody.safeParse(JSON.parse('{"report":"java.lang.OutOfMemoryError"}'));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.appVersion).toBeUndefined();
      expect(parsed.data.versionCode).toBeUndefined();
    }
  });

  it("turns away an empty or oversized crash report", () => {
    expect(crashBody.safeParse({ report: "" }).success).toBe(false);
    expect(crashBody.safeParse({ report: "x".repeat(LONGEST_REPORT + 1) }).success).toBe(false);
  });

  it("serialises BigInt quotas as text, the way the tablet reads them", async () => {
    const response = json({ storage: { quota: 524288000n, used: 1234n } });
    const body = await response.json();
    // Storage in CloudClient.kt declares quota/used as String.
    expect(body.storage.quota).toBe("524288000");
    expect(body.storage.used).toBe("1234");
  });
});
