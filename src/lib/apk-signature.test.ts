import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apkCertificateFingerprint, fingerprint, firstCertificate } from "./apk-signature";

/*
  Odcisk certyfikatu z podpisu APK - do /.well-known/assetlinks.json. Na
  prawdziwym pliku z kompilacji aplikacji wynik zgadzał się co do bajtu
  z `apksigner verify --print-certs`; tu sprawdzamy sam układ bloku.
*/

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function prefixed(...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length), body]);
}

/** Wartość podpisu v2 z jednym podpisującym i jednym certyfikatem. */
function v2Value(certificate: Buffer): Buffer {
  const digests = prefixed(prefixed(u32(0x0103), prefixed(Buffer.from("skrot"))));
  const certificates = prefixed(prefixed(certificate));
  const signedData = prefixed(digests, certificates, prefixed());
  const signer = prefixed(signedData, prefixed(), prefixed(Buffer.from("klucz")));
  return prefixed(signer);
}

function fakeApk(certificate: Buffer): Buffer {
  const head = Buffer.from("PK\u0003\u0004 tu byłyby pliki aplikacji");
  const value = v2Value(certificate);
  const pair = Buffer.concat([u64(4 + value.length), u32(0x7109871a), value]);
  const blockSize = pair.length + 8 + 16;
  const block = Buffer.concat([u64(blockSize), pair, u64(blockSize), Buffer.from("APK Sig Block 42")]);
  const directoryAt = head.length + block.length;
  const directory = Buffer.from([0x50, 0x4b, 0x01, 0x02, 0, 0]);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt32LE(directory.length, 12);
  footer.writeUInt32LE(directoryAt, 16);
  return Buffer.concat([head, block, directory, footer]);
}

describe("odcisk certyfikatu z APK", () => {
  const certificate = Buffer.from("udawany certyfikat DER");
  const expected = createHash("sha256")
    .update(certificate)
    .digest("hex")
    .toUpperCase()
    .match(/.{2}/g)!
    .join(":");

  it("czyta pierwszy certyfikat z podpisu v2", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "kajet-apk-"));
    const file = path.join(directory, "app.apk");
    writeFileSync(file, fakeApk(certificate));
    expect(await apkCertificateFingerprint(file)).toBe(expected);
  });

  it("zapisuje odcisk tak, jak chce assetlinks.json", () => {
    expect(fingerprint(certificate)).toBe(expected);
  });

  it("nie wywraca się na pliku bez podpisu ani na śmieciach", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "kajet-apk-"));
    const file = path.join(directory, "zly.apk");
    writeFileSync(file, Buffer.from("to nie jest zip"));
    expect(await apkCertificateFingerprint(file)).toBeNull();
    expect(await apkCertificateFingerprint(path.join(directory, "brak.apk"))).toBeNull();
    expect(firstCertificate(Buffer.from([1, 2, 3]))).toBeNull();
  });
});
