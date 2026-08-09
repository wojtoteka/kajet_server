"use client";

/*
  Wgranie nowego wydania aplikacji.

  Idzie to w dwóch krokach, bo plik potrafi ważyć kilkadziesiąt megabajtów.
  Najpierw sam plik, zapytaniem z paskiem postępu - inaczej człowiek przez minutę
  patrzy w nieruchomy przycisk i nie wie, czy cokolwiek się dzieje. Potem wersja
  i opis zmian, zwykłą akcją formularza, ze skrótem pliku w ukrytym polu.

  Pasek postępu wymaga XMLHttpRequest: fetch nie mówi, ile już poszło.
*/

import { useRef, useState } from "react";
import { CopyButton } from "@/components/CopyableLink";
import { Icon } from "@/components/Icon";
import { publishRelease } from "../actions";
import { useWords } from "@/components/LanguageProvider";

type Answer = {
  error?: string;
  success?: string;
  copyable?: { value: string; label?: string };
};

function sendFile(file: File, onProgress: (fraction: number) => void): Promise<string> {
  const words = useWords();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/admin/app/upload");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener("load", () => {
      let answer: { upload?: string; error?: string } = {};
      try {
        answer = JSON.parse(request.responseText);
      } catch {
        // Odpowiedź nie jest JSON-em: prawie na pewno strona błędu z nginxa.
      }
      if (request.status >= 200 && request.status < 300 && answer.upload) {
        resolve(answer.upload);
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
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [answer, setAnswer] = useState<Answer>({});

  const busy = progress !== null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    setAnswer({});

    if (!file) {
      setAnswer({ error: words.pickApkFile });
      return;
    }

    setProgress(0);
    setStage(words.sendingFileStage);

    let upload: string;
    try {
      upload = await sendFile(file, setProgress);
    } catch (problem) {
      setProgress(null);
      setStage("");
      setAnswer({ error: problem instanceof Error ? problem.message : words.uploadFailed });
      return;
    }

    setStage(words.savingReleaseStage);
    data.set("upload", upload);
    data.set("fileName", file.name);

    const outcome = await publishRelease({}, data);

    setProgress(null);
    setStage("");
    setAnswer(outcome);

    if (outcome.success) {
      form.current?.reset();
      setFile(null);
    }
  }

  return (
    <form ref={form} onSubmit={submit}>
      {answer.error ? <p className="error">{answer.error}</p> : null}
      {answer.success ? (
        <div className="success" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
              <CopyButton value={answer.copyable.value} label={answer.copyable.label ?? words.copyWord} />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="apk">{words.apkFileLabel}</label>
        <input
          id="apk"
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          disabled={busy}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

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
            defaultValue={nextVersionCode}
            disabled={busy}
          />
          <p className="small" style={{ marginTop: 4 }}>
            versionCode z aplikacji. Po nim telefon poznaje, że ma starszą.
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

      <button type="submit" className="primary" disabled={busy}>
        <Icon name={busy ? "hourglass_top" : "publish"} />
        {busy ? words.justAMoment : words.publishRelease}
      </button>
    </form>
  );
}
