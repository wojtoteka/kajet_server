/*
  Aktualna wersja aplikacji na Androida.

  Aplikacja pyta o to sama, żeby powiedzieć użytkownikowi, że ma starszą wersję.
  Porównuje swój versionCode z tym, co przyjdzie tutaj, i jeśli serwer ma wyższy,
  otwiera `url`.

  Bez tokenu: sprawdzić aktualizację trzeba móc także przed zalogowaniem, a plik
  i tak leży na stronie do wzięcia przez każdego.
*/

import { json, wrapApi } from "@/lib/api";
import { currentRelease } from "@/lib/app-release";
import { settings } from "@/lib/settings";

export { OPTIONS } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = wrapApi(async () => {
  const release = await currentRelease();

  if (!release) return json({ release: null });

  return json({
    release: {
      version: release.version,
      versionCode: release.versionCode,
      notes: release.notes,
      fileName: release.fileName,
      sizeBytes: release.sizeBytes,
      hash: release.hash,
      url: `${settings.baseUrl}/download/file`,
      pageUrl: `${settings.baseUrl}/download`,
      publishedAt: release.createdAt.getTime(),
    },
  });
});
