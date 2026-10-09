/*
  Odcisk certyfikatu, którym podpisano plik APK.

  Android otwiera adresy https://<serwer>/n/... od razu w aplikacji Kajet tylko
  wtedy, gdy serwer potwierdzi, że aplikacja jest jego: plik
  /.well-known/assetlinks.json musi podać odcisk SHA-256 certyfikatu, którym
  aplikację podpisano. Ręczne przepisywanie odcisku to proszenie się o literówkę
  (i linki, które po cichu otwierają się w przeglądarce), więc bierzemy go
  wprost z pliku wydania, który administrator i tak wgrywa w panelu.

  Podpis v2/v3 leży w „APK Signing Block" tuż przed spisem zawartości zipa:

    [rozmiar bloku: u64] [pary: (u64 długość, u32 id, wartość)...]
    [rozmiar bloku: u64] ["APK Sig Block 42": 16 bajtów]

  Wartość v2 (0x7109871a) i v3 (0xf05368c0) zaczyna się tak samo: lista
  podpisujących -> pierwszy podpisujący -> podpisane dane -> lista skrótów,
  lista certyfikatów (DER). Każdy element listy ma przed sobą długość u32.
  Skrót SHA-256 pierwszego certyfikatu to właśnie szukany odcisk.

  Jak w apk.ts: nic tu nie ufa zawartości pliku, każdy odczyt jest sprawdzany.
*/

import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

const END_OF_DIRECTORY = 0x06054b50;
const TAIL_BYTES = 66 * 1024;
const MAGIC = Buffer.from("APK Sig Block 42", "ascii");
const SIGNATURE_IDS = [0xf05368c0, 0x7109871a]; // v3, v2
/** Blok podpisu nie bywa większy niż kilka KB; limit chroni przed śmieciem. */
const LONGEST_BLOCK = 4 * 1024 * 1024;

/** Odcisk w zapisie, jakiego chce assetlinks.json: AA:BB:...:FF. */
export function fingerprint(der: Buffer): string {
  const hex = createHash("sha256").update(der).digest("hex").toUpperCase();
  return hex.match(/.{2}/g)!.join(":");
}

/** Kolejny element z długością u32 przed sobą; null przy wyjściu poza bufor. */
function prefixed(buffer: Buffer, at: number): { value: Buffer; next: number } | null {
  if (at + 4 > buffer.length) return null;
  const length = buffer.readUInt32LE(at);
  const end = at + 4 + length;
  if (end > buffer.length) return null;
  return { value: buffer.subarray(at + 4, end), next: end };
}

/** Certyfikat pierwszego podpisującego z wartości bloku v2/v3. */
export function firstCertificate(signature: Buffer): Buffer | null {
  const signers = prefixed(signature, 0);
  if (!signers) return null;
  const signer = prefixed(signers.value, 0);
  if (!signer) return null;
  const signedData = prefixed(signer.value, 0);
  if (!signedData) return null;
  const digests = prefixed(signedData.value, 0);
  if (!digests) return null;
  const certificates = prefixed(signedData.value, digests.next);
  if (!certificates) return null;
  const certificate = prefixed(certificates.value, 0);
  return certificate?.value.length ? certificate.value : null;
}

/** Wartość podpisu z bloku podpisów (v3, a gdy jej nie ma - v2). */
export function signatureFromBlock(block: Buffer): Buffer | null {
  // block = pary bez pól rozmiaru i magii
  const found = new Map<number, Buffer>();
  let at = 0;
  while (at + 12 <= block.length) {
    const length = Number(block.readBigUInt64LE(at));
    if (length < 4 || at + 8 + length > block.length) return null;
    const id = block.readUInt32LE(at + 8);
    found.set(id, block.subarray(at + 12, at + 8 + length));
    at += 8 + length;
  }
  for (const id of SIGNATURE_IDS) {
    const value = found.get(id);
    if (value) return value;
  }
  return null;
}

/**
 * Odcisk SHA-256 certyfikatu z pliku APK albo null, gdy pliku nie da się tak
 * odczytać (brak podpisu v2/v3, uszkodzony plik).
 */
export async function apkCertificateFingerprint(path: string): Promise<string | null> {
  try {
    const file = await open(path, "r");
    try {
      const size = (await file.stat()).size;
      if (size < 22) return null;
      const tailLength = Math.min(size, TAIL_BYTES);
      const tail = Buffer.alloc(tailLength);
      await file.read(tail, 0, tailLength, size - tailLength);

      let footer = -1;
      for (let i = tail.length - 22; i >= 0; i -= 1) {
        if (tail.readUInt32LE(i) === END_OF_DIRECTORY) {
          footer = i;
          break;
        }
      }
      if (footer < 0) return null;
      const directoryAt = tail.readUInt32LE(footer + 16);
      if (directoryAt < 32 || directoryAt > size) return null;

      const trailer = Buffer.alloc(24);
      await file.read(trailer, 0, 24, directoryAt - 24);
      if (!trailer.subarray(8).equals(MAGIC)) return null;
      const blockSize = Number(trailer.readBigUInt64LE(0));
      if (blockSize < 24 || blockSize > LONGEST_BLOCK || blockSize + 8 > directoryAt) return null;

      // Cały blok: [u64 rozmiar][pary][u64 rozmiar][magia]
      const pairsLength = blockSize - 24;
      const pairs = Buffer.alloc(pairsLength);
      await file.read(pairs, 0, pairsLength, directoryAt - blockSize - 8 + 8);
      const signature = signatureFromBlock(pairs);
      const certificate = signature ? firstCertificate(signature) : null;
      return certificate ? fingerprint(certificate) : null;
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}
