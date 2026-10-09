import { prisma } from "@/lib/prisma";
import { releasePath } from "@/lib/app-release";
import { apkCertificateFingerprint } from "@/lib/apk-signature";

export const dynamic = "force-dynamic";

/*
  Digital Asset Links - potwierdzenie dla Androida, że aplikacja Kajet należy
  do tego serwera. Dzięki temu odnośnik https://<serwer>/n/... stuknięty
  w poczcie albo komunikatorze otwiera się od razu w aplikacji, a nie
  w przeglądarce (aplikacja zgłasza się do tych adresów z autoVerify).

  Odciski certyfikatów bierzemy z dwóch miejsc:
  - z podpisu pliku bieżącego wydania (panel → Aplikacja) - nic nie trzeba
    przepisywać ręcznie,
  - z ANDROID_CERT_SHA256 w .env (po przecinku) - na wypadek wydań
    podpisanych innym kluczem albo serwera bez wgranego pliku.

  Android pyta o ten plik przy instalacji aplikacji, więc po wgraniu
  pierwszego podpisanego wydania wystarczy zainstalować je na urządzeniu.
*/

const PACKAGE = "wojtoteka.ovh.kajet";

/** Odcisk z pliku wydania liczymy raz na plik - po skrócie pliku. */
const cache = new Map<string, string | null>();

async function releaseFingerprints(): Promise<string[]> {
  const releases = await prisma.appRelease.findMany({
    where: { current: true },
    select: { hash: true },
  });
  const found: string[] = [];
  for (const release of releases) {
    if (!cache.has(release.hash)) {
      let value: string | null = null;
      try {
        value = await apkCertificateFingerprint(releasePath(release.hash));
      } catch {
        value = null;
      }
      cache.set(release.hash, value);
    }
    const value = cache.get(release.hash);
    if (value) found.push(value);
  }
  return found;
}

function configuredFingerprints(): string[] {
  return (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(entry));
}

export async function GET(): Promise<Response> {
  let fromRelease: string[] = [];
  try {
    fromRelease = await releaseFingerprints();
  } catch (problem) {
    console.error("[assetlinks] odczyt wydania", problem);
  }
  const fingerprints = [...new Set([...configuredFingerprints(), ...fromRelease])];
  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
