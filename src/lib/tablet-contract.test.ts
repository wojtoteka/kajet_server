import { describe, expect, it } from "vitest";
import { outgoingNoteSchema, SYNC_KINDS } from "./note-write";
import { json } from "./api";

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

  it("serialises BigInt quotas as text, the way the tablet reads them", async () => {
    const response = json({ storage: { quota: 524288000n, used: 1234n } });
    const body = await response.json();
    // Storage in CloudClient.kt declares quota/used as String.
    expect(body.storage.quota).toBe("524288000");
    expect(body.storage.used).toBe("1234");
  });
});
