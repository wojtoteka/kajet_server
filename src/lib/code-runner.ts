import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { settings } from "./settings";

export type Language = {
  id: string;
  namePl: string;
  extension: string;
command: string[];
executableTmp?: boolean;
};

export const LANGUAGES: Language[] = [
  {
    id: "python",
    namePl: "Python",
    extension: "py",
    command: ["python3", "%s"],
  },
  {
    id: "javascript",
    namePl: "JavaScript",
    extension: "js",
    command: ["node", "%s"],
  },
  {
    id: "typescript",
    namePl: "TypeScript",
    extension: "ts",
    // tsx is installed in the image. We do not use npx, because it can fetch
    // packages from the network, and there is no network in the container.
    command: ["tsx", "%s"],
  },
  {
    id: "bash",
    namePl: "Powłoka",
    extension: "sh",
    command: ["bash", "%s"],
  },
  {
    id: "c",
    namePl: "C",
    extension: "c",
    command: ["bash", "-c", "gcc -O0 -w -o /tmp/program %s && /tmp/program"],
    executableTmp: true,
  },
  {
    id: "c++",
    namePl: "C++",
    extension: "cpp",
    command: ["bash", "-c", "g++ -O0 -w -o /tmp/program %s && /tmp/program"],
    executableTmp: true,
  },
  {
    id: "php",
    namePl: "PHP",
    extension: "php",
    command: ["php", "%s"],
  },
  {
    id: "ruby",
    namePl: "Ruby",
    extension: "rb",
    command: ["ruby", "%s"],
  },
  {
    id: "sqlite3",
    namePl: "SQL",
    extension: "sql",
    command: ["bash", "-c", "sqlite3 :memory: < %s"],
  },
];

export function findLanguage(id: string): Language | null {
  return LANGUAGES.find((language) => language.id === id) ?? null;
}

export type RunResult = {
  output: string;
  errors: string;
  exitCode: number | null;
interrupted: boolean;
  timeMs: number;
};

export async function run(languageId: string, code: string, input = ""): Promise<RunResult> {
  const language = findLanguage(languageId);
  if (!language) {
    return refusal(`Nie umiem uruchomić języka „${languageId}" na tym serwerze.`);
  }

  if (!settings.code.enabled) {
    return refusal("Uruchamianie kodu jest na tym serwerze wyłączone.");
  }

  const directory = await mkdtemp(path.join(tmpdir(), "kajet-code-"));
  const fileName = `program.${language.extension}`;
  const startedAt = Date.now();

  // Container name. Needed so that after the time limit we can kill this
  // particular container instead of hoping it goes away on its own.
  const containerName = `kajet-code-${randomBytes(8).toString("hex")}`;

  try {
    await writeFile(path.join(directory, fileName), code, "utf8");

    // A directory made by mkdtemp is owner-only, and inside the container the
    // program runs as nobody and would otherwise not be able to read its own
    // file.
    await chmod(directory, 0o755);
    await chmod(path.join(directory, fileName), 0o644);

    return await execute(language, directory, fileName, containerName, input, startedAt);
  } catch (problem) {
    return {
      output: "",
      errors: problem instanceof Error ? problem.message : "Nie udało się uruchomić programu.",
      exitCode: null,
      interrupted: false,
      timeMs: Date.now() - startedAt,
    };
  } finally {
    // A container with `--rm` disappears by itself, but should it survive a
    // failed kill, we clean it up here. The error is ignored: it usually means
    // the container is already gone.
    await removeContainer(containerName);
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function execute(
  language: Language,
  directory: string,
  fileName: string,
  containerName: string,
  input: string,
  startedAt: number,
): Promise<RunResult> {
  const command = language.command.map((part) => part.replaceAll("%s", `/code/${fileName}`));

  const args = [
    "run",
    "--rm",
    // The program's input arrives through stdin, so the container must accept it.
    "--interactive",
    "--name",
    containerName,

    // No network at all. This is the most important line in the whole file.
    "--network",
    "none",

    // Resources. Without these a single loop can take the machine down.
    "--memory",
    `${settings.code.memoryMb}m`,
    // The same limit for memory including swap, so in practice there is none.
    "--memory-swap",
    `${settings.code.memoryMb}m`,
    "--cpus",
    String(settings.code.cpus),
    "--pids-limit",
    String(settings.code.pidsLimit),

    // The container filesystem is read-only. The program writes only to /tmp,
    // which disappears with the container anyway.
    "--read-only",
    "--tmpfs",
    language.executableTmp
      ? `/tmp:rw,nosuid,size=${settings.code.tmpMb}m`
      : `/tmp:rw,noexec,nosuid,size=${settings.code.tmpMb}m`,

    // No system privileges and no way of gaining any.
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",

    // User nobody, in case somebody swaps the image for one that runs as root.
    "--user",
    "65534:65534",

    // The user's program, mounted read-only.
    "--volume",
    `${directory}:/code:ro`,
    "--workdir",
    "/code",

    settings.code.image,
    ...command,
  ];

  return new Promise<RunResult>((done) => {
    let interrupted = false;

    const child = execFile(
      settings.code.docker,
      args,
      { maxBuffer: settings.code.maxOutputChars, encoding: "utf8" },
      (problem, output, errors) => {
        clearTimeout(timer);

        done({
          output: truncate(output),
          errors: interrupted
            ? `Program działał dłużej niż ${settings.code.timeoutSeconds} s i został przerwany.`
            : truncate(errors) || (problem ? readableError(problem, errors) : ""),
          exitCode: interrupted ? null : ((problem as { code?: number } | null)?.code ?? 0),
          interrupted,
          timeMs: Date.now() - startedAt,
        });
      },
    );

    /*
     * The time limit.
     *
     * We kill the container, not the Docker client. The client is only a
     * middleman: its death would not stop the program running in the
     * container, and the program would stay on the machine forever.
     *
     * The second timer is in case Docker itself gets stuck. Without it the
     * callback would never arrive and the request from the tablet would hang
     * forever, and with it one server connection.
     */
    const timer = setTimeout(() => {
      interrupted = true;
      void removeContainer(containerName);

      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, KILL_GRACE_MS);
    }, settings.code.timeoutSeconds * 1000);

    if (input) child.stdin?.write(input);
    // We always close the input. Without this a program waiting for data would
    // hang until it ran out of time.
    child.stdin?.end();
  });
}

const KILL_GRACE_MS = 5_000;

function removeContainer(name: string): Promise<void> {
  return new Promise((done) => {
    execFile(settings.code.docker, ["rm", "--force", name], () => done());
  });
}

function refusal(reason: string): RunResult {
  return { output: "", errors: reason, exitCode: null, interrupted: false, timeMs: 0 };
}

function truncate(text: string): string {
  const limit = settings.code.maxOutputChars;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[...] Wynik był dłuższy niż ${limit} znaków i reszta została ucięta.`;
}

function readableError(problem: Error, dockerErrors: string): string {
  const code = (problem as { code?: string | number }).code;

  if (code === "ENOENT") {
    return (
      "Na tym serwerze nie ma Dockera, a bez niego nie uruchamiamy cudzego kodu. " +
      "Zainstaluj Dockera albo wyłącz uruchamianie w ustawieniach serwera."
    );
  }
  if (dockerErrors.includes("Unable to find image") || dockerErrors.includes("pull access denied")) {
    return (
      `Nie ma obrazu ${settings.code.image}. Zbuduj go poleceniem: ` +
      `docker build -t ${settings.code.image} docker/`
    );
  }
  if (dockerErrors.includes("permission denied") && dockerErrors.includes("docker.sock")) {
    return (
      "Użytkownik, na którym chodzi Kajet, nie ma prawa rozmawiać z Dockerem. " +
      "Dodaj go do grupy docker i uruchom serwer ponownie."
    );
  }
  return problem.message;
}

export async function runnerState(): Promise<{ works: boolean; description: string }> {
  if (!settings.code.enabled) {
    return { works: false, description: "Wyłączone w ustawieniach serwera." };
  }

  return new Promise((done) => {
    execFile(settings.code.docker, ["image", "inspect", settings.code.image], (problem, _out, errors) => {
      if (!problem) {
        done({ works: true, description: `Gotowe, obraz ${settings.code.image}.` });
        return;
      }
      done({ works: false, description: readableError(problem, errors) });
    });
  });
}
