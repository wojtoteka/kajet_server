import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { settings } from "./settings";
import { apiWords } from "./language";
import type { Words } from "./i18n";

export type Language = {
  id: string;
  namePl: string;
  /** Nazwa po angielsku, gdy różni się od polskiej. Języki mają nazwy własne. */
  nameEn?: string;
  extension: string;
  command: string[];
  executableTmp?: boolean;
  /**
   * Język, którego się nie uruchamia, tylko ogląda - na razie sam HTML.
   * Strona pokazuje wtedy podgląd zamiast przycisku „Uruchom”.
   */
  preview?: boolean;
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
    namePl: "Shell",
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
    id: "csharp",
    namePl: "C#",
    extension: "cs",
    // mcs kompiluje do /tmp, bo /code jest tylko do odczytu. Gotowy .exe czyta
    // potem mono jak zwykły plik z danymi, więc /tmp może zostać bez prawa
    // uruchamiania - inaczej niż przy C i C++, gdzie system startuje program
    // wprost i `exec` na /tmp jest konieczne.
    command: ["bash", "-c", "mcs -out:/tmp/program.exe %s && mono /tmp/program.exe"],
  },
  {
    id: "java",
    namePl: "Java",
    extension: "java",
    /*
      Jeden plik uruchamia się wprost, bez osobnego javac - tak działa Java od
      wydania 11. Nazwa klasy nie musi zgadzać się z nazwą pliku, więc uczeń
      może napisać `public class Main` i to zadziała.

      Nastawy pamięci stoją w linii polecenia, a nie w JAVA_TOOL_OPTIONS
      w obrazie, bo tamta droga wypisuje przy każdym starcie „Picked up..."
      na stderr - czyli w miejscu, w którym uczeń szuka błędów własnego
      programu. Kontener ma 256 MB na wszystko, a `java Plik.java` to
      kompilator i maszyna wirtualna w jednym procesie.
    */
    command: [
      "java",
      "-Xmx128m",
      "-Xss4m",
      "-XX:TieredStopAtLevel=1",
      "-XX:+UseSerialGC",
      "%s",
    ],
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
  /*
    MySQL osobno od SQL-a wyżej, bo to nie jest ten sam język. Szkoła uczy
    MySQL-a i pisze SHOW TABLES, DESCRIBE, NOW(), AUTO_INCREMENT,
    ENGINE=InnoDB - SQLite żadnego z nich nie zna i odpowiada „syntax error".

    Rozszerzenie jest celowo takie samo jak przy SQLite. `guessLanguageFromTitle`
    bierze PIERWSZE dopasowanie ze spisu, a SQLite stoi wyżej, więc plik .sql
    przyniesiony z tabletu rozpoznaje się dokładnie tak jak dotąd. Kto chce
    MySQL-a, wybiera go z listy.

    Serwer bazy wstaje wewnątrz kontenera - patrz docker/uruchom-mysql.sh.
  */
  {
    id: "mysql",
    namePl: "MySQL",
    extension: "sql",
    command: ["uruchom-mysql", "%s"],
  },
  /*
    HTML nie jest programem do policzenia - to strona do obejrzenia. Docker nie
    ma tu nic do roboty, więc zamiast przycisku „Uruchom" edytor pokazuje
    podgląd, tak samo jak edytor kodu w aplikacji. Wpis stoi w tym samym spisie,
    żeby plik `.html` z tabletu miał na serwerze swój język i nie wracał jako
    „nieznany".
  */
  {
    id: "html",
    namePl: "HTML",
    extension: "html",
    command: [],
    preview: true,
  },
];

/** Czy ten język da się w ogóle uruchomić na serwerze. */
export function runnableLanguage(id: string): boolean {
  const language = findLanguage(id);
  return Boolean(language) && !language?.preview;
}

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
  const words = await apiWords();
  const language = findLanguage(languageId);
  if (!language) {
    return refusal(words.apiCannotRunLanguage);
  }

  if (language.preview) {
    return refusal(
      `${language.namePl} ${words.apiNotAProgram} ${words.apiPreviewBelow}`,
    );
  }

  if (!settings.code.enabled) {
    return refusal(words.apiRunningOff);
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

    return await execute(language, directory, fileName, containerName, input, startedAt, words);
  } catch (problem) {
    // Failures here come from mkdtemp/writeFile/chmod and carry server paths
    // in the message - the client only hears that the run failed.
    console.error("[code-runner]", problem);
    return {
      output: "",
      errors: words.apiRunFailed,
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
  words: Words,
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

    // Output travels only through the attached stream. Without this Docker
    // would also copy every byte into a log file on the host disk, and a
    // program printing in a loop would be writing to our disk for as long
    // as it ran.
    "--log-driver",
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
    // `exec` przy językach kompilowanych musi stać jawnie: Docker dokłada do
    // `--tmpfs` własne `noexec`, więc samo pominięcie go nie wystarcza i
    // świeżo skompilowany /tmp/program nie chciał się uruchomić.
    "--read-only",
    "--tmpfs",
    language.executableTmp
      ? `/tmp:rw,exec,nosuid,size=${settings.code.tmpMb}m`
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
      // Zapas ponad granicę obcinania jest po to, żeby `truncate` miało co
      // obciąć. Gdy maxBuffer równał się granicy, execFile przerywał odczyt
      // dokładnie w tym samym miejscu, w którym `truncate` miało dopisać
      // zdanie o ucięciu - i zdanie nie pokazywało się nigdy.
      { maxBuffer: settings.code.maxOutputChars + BUFFER_SLACK, encoding: "utf8" },
      (problem, output, errors) => {
        clearTimeout(timer);

        done({
          output: truncate(output),
          errors: interrupted
            ? `Program działał dłużej niż ${settings.code.timeoutSeconds} s i został przerwany.`
            : failureText(problem, errors, words),
          exitCode: interrupted ? null : exitCodeOf(problem),
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

/** Zapas czytanego wyniku ponad granicę, po której go obcinamy. */
const BUFFER_SLACK = 4_096;

/**
 * Kod, którym kończy się sam Docker, gdy nie zdołał uruchomić kontenera -
 * brak obrazu, brak praw do gniazda, zła nazwa. Programu wtedy nie było.
 */
const DOCKER_FAILED = 125;

/** Zabity sygnałem KILL. Przy naszych nastawach znaczy to zwykle brak pamięci. */
const KILLED = 137;

/**
 * Numer, którym skończył się program.
 *
 * `problem.code` nie zawsze jest liczbą: przy awariach po stronie Node'a stoi
 * tam napis w rodzaju ERR_CHILD_PROCESS_STDIO_MAXBUFFER. Kiedyś szedł wprost
 * do klienta jako „kod wyjścia", więc na ekranie stawało „kod wyjścia
 * ERR_CHILD_PROCESS_STDIO_MAXBUFFER".
 */
function exitCodeOf(problem: unknown): number | null {
  if (!problem) return 0;
  const code = (problem as { code?: unknown }).code;
  return typeof code === "number" ? code : null;
}

/**
 * Co pokazać, gdy uruchomienie skończyło się niezerowym kodem.
 *
 * Rzecz, o którą tu chodzi: program, który zwraca 1 i nic nie pisze, jest
 * programem DZIAŁAJĄCYM. Wcześniej puste stderr było brane za brak treści
 * i wchodził komunikat „Uruchamianie kodu na tym serwerze nie działa",
 * ten sam co przy braku Dockera. Uczeń czytał, że serwer padł, choć to jego
 * `return 1` zadziałało dokładnie tak, jak napisał.
 *
 * Awaria samego uruchamiania ma własny numer (125) albo nie ma numeru wcale
 * (ENOENT, gdy nie ma polecenia docker) - i tylko wtedy tłumaczymy ją zdaniem.
 */
function failureText(problem: unknown, errors: string, words: Words): string {
  const stderr = truncate(errors);
  if (!problem) return stderr;

  const code = (problem as { code?: unknown }).code;

  if (typeof code === "number") {
    if (code === DOCKER_FAILED) return stderr || readableError(problem as Error, errors, words);
    if (code === KILLED) {
      return (
        stderr ||
        `Program został zatrzymany. Najczęściej znaczy to, że przekroczył limit ${settings.code.memoryMb} MB pamięci.`
      );
    }
    // Zwykły niezerowy kod wyjścia programu. Sam numer stoi obok wyniku.
    return stderr;
  }

  // Wynik dłuższy niż wolno: `truncate` dopisało już zdanie o ucięciu.
  if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return stderr;

  return readableError(problem as Error, errors, words);
}

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

function readableError(problem: Error, dockerErrors: string, words: Words): string {
  const code = (problem as { code?: string | number }).code;

  if (code === "ENOENT") {
    return (
      "Na tym serwerze nie ma Dockera, a bez niego nie uruchamiamy cudzego kodu. " +
      words.apiInstallDocker
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
      words.apiNoDockerRights +
      "Dodaj go do grupy docker i uruchom serwer ponownie."
    );
  }
  // An unrecognised failure of execFile has the whole docker command line in
  // the message - host paths, mounted directories, limits. The client gets a
  // plain sentence and the detail stays in the server log.
  console.error("[code-runner]", problem, dockerErrors);
  return words.apiRunnerBroken;
}

export async function runnerState(): Promise<{ works: boolean; description: string }> {
  const words = await apiWords();
  if (!settings.code.enabled) {
    return { works: false, description: words.apiOffInServerSettings };
  }

  return new Promise((done) => {
    execFile(settings.code.docker, ["image", "inspect", settings.code.image], (problem, _out, errors) => {
      if (!problem) {
        done({ works: true, description: words.apiRunnerReady });
        return;
      }
      done({ works: false, description: readableError(problem, errors, words) });
    });
  });
}
