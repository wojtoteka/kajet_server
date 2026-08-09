"use client";

/*
  Wgranie nowego wydania aplikacji.

  Idzie to w dwóch krokach, bo plik potrafi ważyć kilkadziesiąt megabajtów.
  Najpierw sam plik, zapytaniem z paskiem postępu - inaczej człowiek przez minutę
  patrzy w nieruchomy przycisk i nie wie, czy cokolwiek się dzieje. Potem opis
  zmian, zwykłą akcją formularza, ze skrótem pliku w ukrytym polu.

  Plik jedzie ZARAZ po wskazaniu, a nie dopiero przy wysyłaniu formularza.
  Powód nie jest kosmetyczny: serwer odczytuje z niego numer wydania i nazwę
  wersji, a te dwie liczby mają być widoczne, zanim cokolwiek trafi do bazy.
  Numer wydania jest tym, po którym aplikacja poznaje, że jest starsza - dopóki
  przepisywało się go z pamięci, jedna pomyłka wystarczała, żeby powiadamianie
  o aktualizacji przestało mieć sens. Plik wgrany i nieopisany nie zalega:
  sprząta go sweepUnused() po sześciu godzinach.

  Pasek postępu wymaga XMLHttpRequest: fetch nie mówi, ile już poszło.
*/

import { useRef, useState } from "react";
import { CopyButton } from "@/components/CopyableLink";
import { Icon } from "@/components/Icon";
import { publishRelease } from "../actions";
import { useWords } from "@/components/LanguageProvider";
import type { Words } from "@/lib/i18n";

type Answer = {
  error?: string;
  success?: string;
  copyable?: { value: string; label?: string };
};

/** Co serwer odczytał z wgranego pliku. */
type Uploaded = {
  hash: string;
  versionCode: number | null;
  versionName: string | null;
};

/*
  Napisy przychodzą parametrem, nie z useWords(): to zwykła funkcja, nie
  komponent, a hak wywołany poza komponentem wywraca całą stronę
  (React #321) przy pierwszej próbie wysłania pliku.
*/
function sendFile(
  file: File,
  words: Words,
  onProgress: (fraction: number) => void,
): Promise<Uploaded> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/admin/app/upload");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener("load", () => {
      let answer: {
        upload?: string;
        error?: string;
        versionCode?: number | null;
        versionName?: string | null;
      } = {};
      try {
        answer = JSON.parse(request.responseText);
      } catch {
        // Odpowiedź nie jest JSON-em: prawie na pewno strona błędu z nginxa.
      }
      if (request.status >= 200 && request.status < 300 && answer.upload) {
        resolve({
          hash: answer.upload,
          versionCode: answer.versionCode ?? null,
          versionName: answer.versionName ?? null,
        });
        return;
      }
      reject(
        new Error(
          answer.error ??
            (request.status === 413
              ? words.nginxTooBig
              : `Serwer odrzucił plik (błąd ${request.status}).`),
        ),
      );
    });

    request.addEventListener("error", () =>
      reject(new Error(words.connectionDropped2)),
    );
    request.addEventListener("abort", () => reject(new Error(words.uploadAborted)));

    request.send(file);
  });
}

export function ReleaseForm({ nextVersionCode }: { nextVersionCode: number }) {
  const words = useWords();
  const form = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState("");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [answer, setAnswer] = useState<Answer>({});

  // Pola wersji: wypełniane z pliku, a gdy odczyt zawiódł - do wpisania ręcznie.
  const [version, setVersion] = useState("");
  const [versionCode, setVersionCode] = useState(String(nextVersionCode));

  const busy = progress !== null;
  /** Plik leży na serwerze, ale nie dał się odczytać. Wtedy wersję podaje człowiek. */
  const unreadable = uploaded !== null && uploaded.versionCode === null;

  async function pick(file: File | null) {
    setAnswer({});
    setUploaded(null);
    setFileName(file?.name ?? "");
    if (!file) return;

    setProgress(0);
    setStage(words.sendingFileStage);

    try {
      const outcome = await sendFile(file, words, setProgress);
      setUploaded(outcome);
      if (outcome.versionCode !== null) setVersionCode(String(outcome.versionCode));
      if (outcome.versionName) setVersion(outcome.versionName);
    } catch (problem) {
      setAnswer({ error: problem instanceof Error ? problem.message : words.uploadFailed });
    } finally {
      setProgress(null);
      setStage("");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    setAnswer({});

    if (!uploaded) {
      setAnswer({ error: words.pickApkFile });
      return;
    }

    setProgress(1);
    setStage(words.savingReleaseStage);

    data.set("upload", uploaded.hash);
    data.set("fileName", fileName);

    const outcome = await publishRelease({}, data);

    setProgress(null);
    setStage("");
    setAnswer(outcome);

    if (outcome.success) {
      form.current?.reset();
      setUploaded(null);
      setFileName("");
      setVersion("");
      setVersionCode(String(nextVersionCode + 1));
    }
  }

  return (
    <form ref={form} onSubmit={submit}>
      <div className="field">
        <label htmlFor="apk">{words.apkFileLabel}</label>
        <input
          id="apk"
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          disabled={busy}
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
      </div>

      {unreadable ? <p className="error">{words.couldNotReadRelease}</p> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <label htmlFor="version">{words.versionLabel}</label>
          <input
            id="version"
            name="version"
            type="text"
            placeholder={words.versionPlaceholder}
            required
            maxLength={40}
            disabled={busy}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <p className="small" style={{ marginTop: 4 }}>
            {words.versionHint}
          </p>
        </div>
        <div>
          <label htmlFor="versionCode">{words.releaseNumberLabel}</label>
          <input
            id="versionCode"
            name="versionCode"
            type="number"
            min={1}
            required
            disabled={busy}
            // Odczytanego numeru nie da się poprawić - i tak wygrałby plik,
            // a pole do wpisywania obiecywałoby coś, czego serwer nie zrobi.
            readOnly={uploaded !== null && !unreadable}
            value={versionCode}
            onChange={(event) => setVersionCode(event.target.value)}
          />
          <p className="small" style={{ marginTop: 4 }}>
            {uploaded !== null && !unreadable
              ? `${words.releaseNumberHint} (${words.readFromFile})`
              : words.releaseNumberHint}
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">{words.whatChangedLabel}</label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={4000}
          placeholder={words.releaseNotesPlaceholder}
          disabled={busy}
        />
      </div>

      <div className="field">
        <label
          htmlFor="replacePrevious"
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <input
            id="replacePrevious"
            name="replacePrevious"
            type="checkbox"
            defaultChecked
            disabled={busy}
            style={{ width: "auto", margin: 0 }}
          />
          <span>{words.deleteOlderReleases}</span>
        </label>
        <p className="small" style={{ marginTop: 4 }}>
          {words.replacePreviousHint}
        </p>
      </div>

      {busy ? (
        <div style={{ marginBottom: 16 }}>
          <div className="storage-bar" aria-hidden>
            <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="small" style={{ margin: "6px 0 0 0" }}>
            {stage} {progress !== null ? `${Math.round(progress * 100)}%` : ""}
          </p>
        </div>
      ) : null}

      <button type="submit" className="primary" disabled={busy || !uploaded}>
        <Icon name={busy ? "hourglass_top" : "publish"} />
        {busy ? words.justAMoment : words.publishRelease}
      </button>

      {/* Odpowiedź pod przyciskiem - nad polami spychała cały formularz w dół
          w chwili wysłania. */}
      {answer.error ? (
        <p className="error" style={{ margin: "12px 0 0 0" }}>
          {answer.error}
        </p>
      ) : null}
      {answer.success ? (
        <div
          className="success"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "12px 0 0 0" }}
        >
          {answer.success}
          {answer.copyable ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span className="mono">{answer.copyable.value}</span>
              <CopyButton
                value={answer.copyable.value}
                label={answer.copyable.label ?? words.copyWord}
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
