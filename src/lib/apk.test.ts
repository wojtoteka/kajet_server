/*
  Sprawdzenie czytnika binarnego AndroidManifest.xml.

  Prawdziwy plik APK waży kilkadziesiąt megabajtów i nie ma go czego szukać
  w repozytorium, więc manifest składamy tu z bajtów sami - dokładnie tak, jak
  robi to Android. Dzięki temu da się sprawdzić także przypadki, których żaden
  gotowy plik nie pokaże: skład napisów w UTF-8 zamiast UTF-16 i manifest
  z pustymi nazwami atrybutów, gdzie zostaje tylko mapa zasobów.
*/

import { describe, expect, it } from "vitest";
import { manifestVersion } from "./apk";

const RESOURCE_VERSION_CODE = 0x0101021b;
const RESOURCE_VERSION_NAME = 0x0101021c;
const NOTHING = 0xffffffff;

type Attribute = { name: number; type: number; raw: number; data: number };

/** Skład napisów: nagłówek, przesunięcia i treść. */
function stringPool(strings: string[], utf8: boolean): Buffer {
  const bodies = strings.map((text) => {
    if (utf8) {
      const bytes = Buffer.from(text, "utf8");
      return Buffer.concat([Buffer.from([text.length, bytes.length]), bytes, Buffer.from([0])]);
    }
    const chars = Buffer.from(text, "utf16le");
    const head = Buffer.alloc(2);
    head.writeUInt16LE(text.length);
    return Buffer.concat([head, chars, Buffer.from([0, 0])]);
  });

  const offsets = Buffer.alloc(strings.length * 4);
  let running = 0;
  bodies.forEach((body, index) => {
    offsets.writeUInt32LE(running, index * 4);
    running += body.length;
  });

  const text = Buffer.concat(bodies);
  const padding = Buffer.alloc((4 - (text.length % 4)) % 4);
  const header = Buffer.alloc(28);
  const size = 28 + offsets.length + text.length + padding.length;

  header.writeUInt16LE(0x0001, 0); // rodzaj: skład napisów
  header.writeUInt16LE(28, 2); // długość nagłówka
  header.writeUInt32LE(size, 4);
  header.writeUInt32LE(strings.length, 8);
  header.writeUInt32LE(0, 12); // brak stylów
  header.writeUInt32LE(utf8 ? 1 << 8 : 0, 16);
  header.writeUInt32LE(28 + offsets.length, 20); // gdzie zaczyna się treść
  header.writeUInt32LE(0, 24);

  return Buffer.concat([header, offsets, text, padding]);
}

function resourceMap(ids: number[]): Buffer {
  const chunk = Buffer.alloc(8 + ids.length * 4);
  chunk.writeUInt16LE(0x0180, 0);
  chunk.writeUInt16LE(8, 2);
  chunk.writeUInt32LE(chunk.length, 4);
  ids.forEach((id, index) => chunk.writeUInt32LE(id, 8 + index * 4));
  return chunk;
}

function startElement(name: number, attributes: Attribute[]): Buffer {
  const chunk = Buffer.alloc(36 + attributes.length * 20);

  chunk.writeUInt16LE(0x0102, 0); // rodzaj: początek znacznika
  chunk.writeUInt16LE(16, 2);
  chunk.writeUInt32LE(chunk.length, 4);
  chunk.writeUInt32LE(1, 8); // numer wiersza
  chunk.writeUInt32LE(NOTHING, 12); // bez komentarza

  chunk.writeUInt32LE(NOTHING, 16); // przestrzeń nazw
  chunk.writeUInt32LE(name, 20);
  chunk.writeUInt16LE(20, 24); // gdzie zaczynają się atrybuty
  chunk.writeUInt16LE(20, 26); // długość jednego atrybutu
  chunk.writeUInt16LE(attributes.length, 28);

  attributes.forEach((attribute, index) => {
    const at = 36 + index * 20;
    chunk.writeUInt32LE(NOTHING, at); // przestrzeń nazw
    chunk.writeUInt32LE(attribute.name, at + 4);
    chunk.writeUInt32LE(attribute.raw, at + 8);
    chunk.writeUInt16LE(8, at + 12); // długość wartości
    chunk.writeUInt8(0, at + 14);
    chunk.writeUInt8(attribute.type, at + 15);
    chunk.writeUInt32LE(attribute.data, at + 16);
  });

  return chunk;
}

function manifest(chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.writeUInt16LE(0x0003, 0); // rodzaj: plik XML
  header.writeUInt16LE(8, 2);
  header.writeUInt32LE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

/** Manifest, jaki wypuszcza zwykłe budowanie aplikacji. */
function ordinary(versionCode: number, versionName: string, utf8 = false): Buffer {
  const strings = ["manifest", "versionCode", "versionName", versionName];
  return manifest([
    stringPool(strings, utf8),
    startElement(0, [
      { name: 1, type: 0x10, raw: NOTHING, data: versionCode },
      { name: 2, type: 0x03, raw: 3, data: 3 },
    ]),
  ]);
}

describe("manifestVersion", () => {
  it("czyta numer wydania i nazwę wersji", () => {
    expect(manifestVersion(ordinary(4, "26.08.01"))).toEqual({
      versionCode: 4,
      versionName: "26.08.01",
    });
  });

  it("czyta skład napisów zapisany w UTF-8", () => {
    expect(manifestVersion(ordinary(17, "26.09.03", true))).toEqual({
      versionCode: 17,
      versionName: "26.09.03",
    });
  });

  it("radzi sobie z pustymi nazwami atrybutów, po samych numerach zasobów", () => {
    const strings = ["manifest", "", "", "1.4.2"];
    const file = manifest([
      stringPool(strings, false),
      resourceMap([0, RESOURCE_VERSION_CODE, RESOURCE_VERSION_NAME, 0]),
      startElement(0, [
        { name: 1, type: 0x10, raw: NOTHING, data: 42 },
        { name: 2, type: 0x03, raw: 3, data: 3 },
      ]),
    ]);

    expect(manifestVersion(file)).toEqual({ versionCode: 42, versionName: "1.4.2" });
  });

  it("pomija znaczniki przed <manifest> i nie bierze ich atrybutów", () => {
    const strings = ["uses-permission", "manifest", "versionCode", "versionName", "9.9"];
    const file = manifest([
      stringPool(strings, false),
      startElement(0, [{ name: 2, type: 0x10, raw: NOTHING, data: 999 }]),
      startElement(1, [
        { name: 2, type: 0x10, raw: NOTHING, data: 7 },
        { name: 3, type: 0x03, raw: 4, data: 4 },
      ]),
    ]);

    expect(manifestVersion(file)).toEqual({ versionCode: 7, versionName: "9.9" });
  });

  it("przyjmuje manifest bez nazwy wersji", () => {
    const strings = ["manifest", "versionCode"];
    const file = manifest([
      stringPool(strings, false),
      startElement(0, [{ name: 1, type: 0x10, raw: NOTHING, data: 3 }]),
    ]);

    expect(manifestVersion(file)).toEqual({ versionCode: 3, versionName: "" });
  });

  it("odmawia, gdy w pliku nie ma znacznika <manifest>", () => {
    const file = manifest([
      stringPool(["application", "versionCode"], false),
      startElement(0, [{ name: 1, type: 0x10, raw: NOTHING, data: 5 }]),
    ]);

    expect(() => manifestVersion(file)).toThrow();
  });

  it("odmawia, gdy manifest nie podaje numeru wydania", () => {
    const strings = ["manifest", "versionName"];
    const file = manifest([
      stringPool(strings, false),
      startElement(0, [{ name: 1, type: 0x03, raw: 1, data: 1 }]),
    ]);

    expect(() => manifestVersion(file)).toThrow();
  });

  it("nie wywraca się na śmieciach zamiast pliku", () => {
    expect(() => manifestVersion(Buffer.from("to nie jest manifest, tylko tekst"))).toThrow();
    expect(() => manifestVersion(Buffer.alloc(0))).toThrow();
  });
});
