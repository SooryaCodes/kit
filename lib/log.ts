// Small leveled logger. One line per event: time, level, scope, message, JSON fields.
// LOG_LEVEL = debug | info | warn | error (default info).

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLOR: Record<Level, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? "info") as Level;
  return ORDER[level] ?? ORDER.info;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(scope: string): Logger;
  /** Runs fn, logs its duration at info, and returns [result, milliseconds]. */
  time<T>(msg: string, fn: () => Promise<T>, fields?: Record<string, unknown>): Promise<[T, number]>;
}

export function createLogger(scope: string): Logger {
  const write = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < threshold()) return;
    const time = new Date().toISOString().slice(11, 23);
    const extra = fields && Object.keys(fields).length ? " " + JSON.stringify(fields) : "";
    const tty = typeof process !== "undefined" && process.stdout?.isTTY;
    const tag = tty ? `${COLOR[level]}${level.toUpperCase().padEnd(5)}\x1b[0m` : level.toUpperCase().padEnd(5);
    const line = `${time} ${tag} [${scope}] ${msg}${extra}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  const logger: Logger = {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
    child: (sub) => createLogger(`${scope}:${sub}`),
    async time(msg, fn, fields) {
      const start = performance.now();
      write("debug", `${msg} started`, fields);
      try {
        const result = await fn();
        const ms = Math.round(performance.now() - start);
        write("info", `${msg} done`, { ...fields, ms });
        return [result, ms];
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        write("error", `${msg} failed`, { ...fields, ms, error: errorMessage(err) });
        throw err;
      }
    },
  };
  return logger;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : JSON.stringify(err);
}

export const log = createLogger("kit");
