import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const REGISTRY_FILE = path.join(process.cwd(), "data", "preview.json");
const MAX_LOGS = 400;
const READY_TIMEOUT_MS = 45_000;
const ADOPT_TIMEOUT_MS = 15_000;

export type PreviewStatus = "starting" | "running" | "stopped" | "error";

export interface PreviewInfo {
  directory: string;
  command: string;
  pid: number | null;
  port: number | null;
  url: string | null;
  status: PreviewStatus;
  message: string | null;
  startedAt: number;
  stoppedAt: number | null;
  logs: string[];
}

interface InternalEntry {
  directory: string;
  command: string;
  pid: number | null;
  port: number | null;
  url: string | null;
  status: PreviewStatus;
  message: string | null;
  startedAt: number;
  stoppedAt: number | null;
  logs: string[];
  poller: NodeJS.Timeout | null;
}

interface RegistryEntry {
  directory: string;
  pid: number;
  command: string;
  startedAt: number;
}

interface RunPlan {
  command: string;
  args: string[];
  withPort: boolean;
  staticDir?: string;
}

const previews = new Map<string, InternalEntry>();

function pushLog(entry: InternalEntry, chunk: string) {
  const clean = chunk.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter(Boolean);
  entry.logs.push(...lines);
  if (entry.logs.length > MAX_LOGS) {
    entry.logs.splice(0, entry.logs.length - MAX_LOGS);
  }
}

function toInfo(entry: InternalEntry): PreviewInfo {
  return {
    directory: entry.directory,
    command: entry.command,
    pid: entry.pid,
    port: entry.port,
    url: entry.url,
    status: entry.status,
    message: entry.message,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt,
    logs: entry.logs.slice(-60),
  };
}

function stoppedInfo(directory: string): PreviewInfo {
  return {
    directory,
    command: "",
    pid: null,
    port: null,
    url: null,
    status: "stopped",
    message: null,
    startedAt: 0,
    stoppedAt: null,
    logs: [],
  };
}

async function loadRegistry(): Promise<Map<string, RegistryEntry>> {
  const out = new Map<string, RegistryEntry>();
  try {
    const raw = await fs.readFile(REGISTRY_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    for (const [directory, value] of Object.entries(data)) {
      const v = value as Partial<RegistryEntry>;
      if (typeof v.pid === "number" && typeof v.command === "string") {
        out.set(directory, {
          directory,
          pid: v.pid,
          command: v.command,
          startedAt: typeof v.startedAt === "number" ? v.startedAt : Date.now(),
        });
      }
    }
  } catch {
    return out;
  }
  return out;
}

async function saveRegistry(entries: Iterable<RegistryEntry>): Promise<void> {
  const data: Record<string, RegistryEntry> = {};
  for (const entry of entries) {
    data[entry.directory] = entry;
  }
  try {
    await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(data, null, 2));
  } catch {
    return;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function registryList(): Promise<RegistryEntry[]> {
  const stored = await loadRegistry();
  const list: RegistryEntry[] = [];
  for (const entry of previews.values()) {
    if (entry.pid && entry.status !== "stopped" && entry.status !== "error") {
      stored.delete(entry.directory);
      list.push({
        directory: entry.directory,
        pid: entry.pid,
        command: entry.command,
        startedAt: entry.startedAt,
      });
    }
  }
  for (const [directory, reg] of stored) {
    if (isAlive(reg.pid)) {
      list.push(reg);
    } else {
      stored.delete(directory);
    }
  }
  await saveRegistry(list);
  return list;
}

async function findFreePort(): Promise<number> {
  const used = new Set<number>();
  for (const entry of previews.values()) {
    if (entry.port) used.add(entry.port);
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = 4300 + Math.floor(Math.random() * 5700);
    if (used.has(candidate)) continue;
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(candidate, "127.0.0.1");
    });
    if (free) return candidate;
  }
  return 0;
}

function portsFromLogs(logs: string[]): number[] {
  const text = logs.join("\n");
  const counts = new Map<number, number>();
  for (const match of text.matchAll(
    /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/g,
  )) {
    const port = Number(match[1]);
    if (port >= 1024 && port <= 65535) {
      counts.set(port, (counts.get(port) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([port]) => port);
}

async function portsFromProcessGroup(pgid: number): Promise<number[]> {
  let pids: string[] = [];
  try {
    const res = await exec("pgrep", ["-g", String(pgid)]);
    pids = res.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    // not a process group leader; fall back to the single pid below
  }
  if (pids.length === 0 && isAlive(pgid)) pids = [String(pgid)];
  if (pids.length === 0) return [];
  try {
    const res = await exec("lsof", [
      "-nP",
      "-iTCP",
      "-sTCP:LISTEN",
      "-a",
      "-p",
      pids.join(","),
    ]);
    const ports = new Set<number>();
    for (const line of res.stdout.split("\n")) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) ports.add(Number(match[1]));
    }
    return [...ports];
  } catch {
    return [];
  }
}

async function probe(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    return res.status > 0;
  } catch {
    return false;
  }
}

function stopPoller(entry: InternalEntry) {
  if (entry.poller) {
    clearInterval(entry.poller);
    entry.poller = null;
  }
}

function setRunning(entry: InternalEntry, port: number) {
  entry.port = port;
  entry.url = `http://127.0.0.1:${port}`;
  entry.status = "running";
  entry.message = null;
  void registryList();
}

function startPoller(entry: InternalEntry, timeoutMs: number, timeoutMessage: string) {
  stopPoller(entry);
  const deadline = Date.now() + timeoutMs;
  let busy = false;
  entry.poller = setInterval(() => {
    if (busy || entry.status !== "starting") return;
    busy = true;
    void (async () => {
      try {
        const candidates = [
          entry.port,
          ...portsFromLogs(entry.logs),
          ...(entry.pid ? await portsFromProcessGroup(entry.pid) : []),
        ].filter(
          (value, index, all): value is number =>
            typeof value === "number" &&
            value > 0 &&
            all.indexOf(value) === index,
        );
        for (const candidate of candidates) {
          if (await probe(candidate)) {
            setRunning(entry, candidate);
            return;
          }
        }
        if (Date.now() > deadline) {
          stopPoller(entry);
          entry.status = "error";
          entry.message = timeoutMessage;
        }
      } finally {
        busy = false;
      }
    })();
  }, 1000);
}

async function resolvePackageManager(
  directory: string,
): Promise<{ command: string; argPrefix: string[]; forwards: boolean }> {
  const lockfiles: Array<[string, string, string[]]> = [
    ["pnpm-lock.yaml", "pnpm", ["run"]],
    ["yarn.lock", "yarn", []],
    ["bun.lockb", "bun", ["run"]],
    ["bun.lock", "bun", ["run"]],
  ];
  for (const [lockfile, command, argPrefix] of lockfiles) {
    const stat = await fs.stat(path.join(directory, lockfile)).catch(() => null);
    if (stat) return { command, argPrefix, forwards: true };
  }
  return { command: "npm", argPrefix: ["run"], forwards: false };
}

const PORT_AWARE =
  /\b(vite|next|astro|parcel|webpack|remix|svelte|servor|http-server|serve)\b/;

async function detectRunPlan(directory: string): Promise<RunPlan | null> {
  try {
    const pkgRaw = await fs.readFile(
      path.join(directory, "package.json"),
      "utf8",
    );
    const pkg = JSON.parse(pkgRaw) as {
      scripts?: Record<string, string | undefined>;
    };
    const scripts = pkg.scripts ?? {};
    for (const script of ["dev", "preview", "start"]) {
      const content = scripts[script];
      if (!content) continue;
      const pm = await resolvePackageManager(directory);
      const portAware = PORT_AWARE.test(content);
      const args = [...pm.argPrefix, script];
      if (portAware) {
        if (!pm.forwards) args.push("--");
        args.push("--port");
      }
      return {
        command: pm.command,
        args,
        withPort: portAware,
      };
    }
  } catch {
    // no package.json
  }

  for (const dir of ["out", "dist", "build", "."]) {
    const candidate = path.join(directory, dir);
    try {
      const stat = await fs.stat(path.join(candidate, "index.html"));
      if (stat.isFile()) {
        return {
          command: "python3",
          args: [
            "-m",
            "http.server",
            "--bind",
            "127.0.0.1",
            "--directory",
            candidate,
          ],
          withPort: true,
          staticDir: candidate,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function adoptEntry(directory: string): Promise<InternalEntry | null> {
  const reg = (await loadRegistry()).get(directory);
  if (!reg || !isAlive(reg.pid)) return null;
  const entry: InternalEntry = {
    directory,
    command: reg.command,
    pid: reg.pid,
    port: null,
    url: null,
    status: "starting",
    message: "Re-attaching to a preview started earlier...",
    startedAt: reg.startedAt,
    stoppedAt: null,
    logs: [],
    poller: null,
  };
  previews.set(directory, entry);
  startPoller(
    entry,
    ADOPT_TIMEOUT_MS,
    "The preview process is running, but its port could not be detected. Try Restart.",
  );
  return entry;
}

export async function getPreview(directory: string): Promise<PreviewInfo> {
  const existing = previews.get(directory);
  if (existing) {
    if (
      existing.pid &&
      (existing.status === "running" || existing.status === "starting") &&
      !isAlive(existing.pid)
    ) {
      stopPoller(existing);
      existing.status = "stopped";
      existing.message = "Preview server is no longer running";
      existing.stoppedAt = Date.now();
      existing.pid = null;
      existing.url = null;
      void registryList();
    }
    return toInfo(existing);
  }

  const adopted = await adoptEntry(directory);
  if (adopted) return toInfo(adopted);
  await registryList();
  return stoppedInfo(directory);
}

export async function startPreview(
  directory: string,
): Promise<PreviewInfo> {
  const current = previews.get(directory);
  if (
    current &&
    (current.status === "running" || current.status === "starting")
  ) {
    return toInfo(current);
  }
  if (current) stopPoller(current);
  previews.delete(directory);

  const plan = await detectRunPlan(directory);
  if (!plan) {
    return {
      ...stoppedInfo(directory),
      status: "error",
      message:
        "No dev server script (dev/preview/start in package.json) and no static build (out/dist/build with index.html) found.",
    };
  }

  const port = await findFreePort();
  if (!port) {
    return {
      ...stoppedInfo(directory),
      status: "error",
      message: "Could not find a free port for the preview server.",
    };
  }

  const spawnArgs = [...plan.args];
  if (plan.withPort) spawnArgs.push(String(port));
  const display = `${plan.command} ${spawnArgs.join(" ")}`;

  const entry: InternalEntry = {
    directory,
    command: display,
    pid: null,
    port: plan.staticDir ? port : null,
    url: null,
    status: "starting",
    message: null,
    startedAt: Date.now(),
    stoppedAt: null,
    logs: [],
    poller: null,
  };
  previews.set(directory, entry);

  const child: ChildProcess = spawn(plan.command, spawnArgs, {
    cwd: directory,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port), FORCE_COLOR: "0" },
  });

  entry.pid = child.pid ?? null;
  child.stdout?.on("data", (chunk: Buffer) => pushLog(entry, chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => pushLog(entry, chunk.toString()));
  child.on("error", (error) => {
    pushLog(entry, `spawn failed: ${error.message}`);
    stopPoller(entry);
    entry.status = "error";
    entry.message = `Failed to start ${entry.command}`;
    entry.stoppedAt = Date.now();
    void registryList();
  });
  child.on("exit", (code) => {
    stopPoller(entry);
    if (entry.status !== "error") {
      entry.status = "stopped";
      entry.message =
        code === null
          ? "Preview server was stopped"
          : `Preview server exited with code ${code}`;
    }
    entry.stoppedAt = Date.now();
    entry.pid = null;
    void registryList();
  });

  startPoller(
    entry,
    READY_TIMEOUT_MS,
    `No server responded within ${READY_TIMEOUT_MS / 1000}s. Check the logs below.`,
  );

  void registryList();
  return toInfo(entry);
}

export async function stopPreview(directory: string): Promise<PreviewInfo> {
  const entry = previews.get(directory);
  if (!entry) {
    const reg = (await loadRegistry()).get(directory);
    if (reg && isAlive(reg.pid)) {
      try {
        process.kill(-reg.pid, "SIGTERM");
      } catch {
        try {
          process.kill(reg.pid, "SIGTERM");
        } catch {
          await registryList();
          return { ...stoppedInfo(directory), stoppedAt: Date.now() };
        }
      }
      setTimeout(() => {
        try {
          process.kill(-reg.pid, "SIGKILL");
        } catch {
          return;
        }
      }, 2500);
    }
    await registryList();
    return { ...stoppedInfo(directory), stoppedAt: Date.now() };
  }

  stopPoller(entry);
  if (entry.pid) {
    const pid = entry.pid;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
    setTimeout(() => {
      if (isAlive(pid)) {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // already gone
          }
        }
      }
    }, 2500);
  }
  entry.status = "stopped";
  entry.message = "Preview server was stopped";
  entry.stoppedAt = Date.now();
  entry.pid = null;
  entry.url = null;
  await registryList();
  return toInfo(entry);
}
