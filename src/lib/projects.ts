import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

const exec = promisify(execFile);

const HOME = os.homedir();
const REGISTRY_FILE = path.join(process.cwd(), "data", "projects.json");
const WORKSPACE_ROOT = path.join(process.cwd(), "data", "workspaces");

const SKIP_DIRS = new Set([
  ".Trash",
  "Applications",
  "Desktop",
  "Documents",
  "Downloads",
  "Library",
  "Movies",
  "Music",
  "Pictures",
  "Public",
  "node_modules",
  "go",
  ".cache",
  ".config",
  ".local",
]);

export interface ProjectRecord {
  id: string;
  name: string;
  ownerId: string;
  path: string;
  createdAt: number;
}

export interface ProjectInfo extends ProjectRecord {
  exists: boolean;
  stack: string[];
  isGit: boolean;
  branch: string;
  dirty: number;
  lastCommitAt: number | null;
  lastCommitMessage: string | null;
  sessions: number;
  lastSessionAt: number | null;
}

interface LegacyRegistry {
  extraPaths?: string[];
}

async function readRegistry(): Promise<ProjectRecord[]> {
  try {
    const raw = await fs.readFile(REGISTRY_FILE, "utf8");
    const data = JSON.parse(raw) as { projects?: ProjectRecord[] };
    const records = Array.isArray(data.projects) ? data.projects : [];
    return records.filter(
      (record) =>
        record &&
        typeof record.path === "string" &&
        typeof record.ownerId === "string" &&
        record.ownerId.length > 0 &&
        typeof record.name === "string",
    );
  } catch {
    return [];
  }
}

async function writeRegistry(records: ProjectRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  await fs.writeFile(REGISTRY_FILE, JSON.stringify({ projects: records }, null, 2));
}

export async function listProjectRecords(): Promise<ProjectRecord[]> {
  return readRegistry();
}

export async function getProjectByPath(
  directory: string,
): Promise<ProjectRecord | null> {
  const records = await readRegistry();
  return records.find((record) => record.path === directory) ?? null;
}

export async function getOwnedProject(
  directory: string,
  userId: string,
): Promise<ProjectRecord | null> {
  const record = await getProjectByPath(directory);
  return record && record.ownerId === userId ? record : null;
}

export function workspaceProjectDir(
  userId: string,
  name: string,
): string {
  return path.join(WORKSPACE_ROOT, userId, name);
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createProject(
  userId: string,
  rawName: string,
): Promise<{ path: string | null; error: string | null }> {
  const name = rawName.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    return { path: null, error: "use letters, numbers, dots, dashes or underscores" };
  }
  const target = workspaceProjectDir(userId, name);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.mkdir(target, { recursive: false });
  } catch {
    return { path: null, error: "a project with this name already exists" };
  }
  await exec("git", ["init", "-q"], { cwd: target }).catch(() => {});
  const records = await readRegistry();
  records.push({
    id: `p_${randomBytes(6).toString("hex")}`,
    name,
    ownerId: userId,
    path: target,
    createdAt: Date.now(),
  });
  await writeRegistry(records);
  return { path: target, error: null };
}

export async function addExistingProject(
  userId: string,
  projectPath: string,
): Promise<{ path: string | null; error: string | null }> {
  const stat = await fs.stat(projectPath).catch(() => null);
  if (!stat?.isDirectory()) {
    return { path: null, error: "path not found" };
  }
  const records = await readRegistry();
  if (records.some((record) => record.path === projectPath)) {
    return { path: null, error: "this project is already registered" };
  }
  records.push({
    id: `p_${randomBytes(6).toString("hex")}`,
    name: path.basename(projectPath),
    ownerId: userId,
    path: projectPath,
    createdAt: Date.now(),
  });
  await writeRegistry(records);
  return { path: projectPath, error: null };
}

async function detectStack(dir: string): Promise<string[]> {
  const stack: string[] = [];
  try {
    const pkgRaw = await fs.readFile(path.join(dir, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) stack.push("Next.js");
    if (deps.react) stack.push("React");
    if (deps.vue) stack.push("Vue");
    if (deps.svelte) stack.push("Svelte");
    if (deps.express) stack.push("Express");
    if (deps.typescript) stack.push("TypeScript");
    if (deps.tailwindcss || deps["@tailwindcss/postcss"]) stack.push("Tailwind");
  } catch {
    try {
      const text = await fs.readFile(path.join(dir, "pyproject.toml"), "utf8");
      if (text.includes("fastapi")) stack.push("FastAPI");
      if (text.includes("django")) stack.push("Django");
      if (stack.length === 0) stack.push("Python");
    } catch {
      stack.push("Unknown");
    }
  }
  return stack;
}

export async function projectStack(dir: string): Promise<string[]> {
  return detectStack(dir);
}

async function gitInfo(dir: string): Promise<{
  branch: string;
  dirty: number;
  lastCommitAt: number | null;
  lastCommitMessage: string | null;
}> {
  try {
    const { stdout: branch } = await exec("git", [
      "-C",
      dir,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    let dirty = 0;
    try {
      const { stdout: status } = await exec("git", [
        "-C",
        dir,
        "status",
        "--porcelain",
      ]);
      dirty = status.split("\n").filter((line) => line.trim()).length;
    } catch {
      dirty = 0;
    }
    let lastCommitAt: number | null = null;
    let lastCommitMessage: string | null = null;
    try {
      const { stdout: log } = await exec("git", [
        "-C",
        dir,
        "log",
        "-1",
        "--format=%ct|%s",
      ]);
      const [seconds, subject] = log.trim().split("|");
      lastCommitAt = Number(seconds) * 1000;
      lastCommitMessage = subject ?? null;
    } catch {
      lastCommitAt = null;
    }
    return {
      branch: branch.trim() || "main",
      dirty,
      lastCommitAt,
      lastCommitMessage,
    };
  } catch {
    return {
      branch: "",
      dirty: 0,
      lastCommitAt: null,
      lastCommitMessage: null,
    };
  }
}

export async function enrichProject(
  record: ProjectRecord,
  sessionCounts: Map<string, { count: number; lastAt: number }>,
): Promise<ProjectInfo> {
  const stat = await fs.stat(record.path).catch(() => null);
  const info = stat?.isDirectory() ? await gitInfo(record.path) : null;
  const sessionInfo = sessionCounts.get(record.path) ?? {
    count: 0,
    lastAt: 0,
  };
  return {
    ...record,
    exists: Boolean(stat?.isDirectory()),
    stack: stat?.isDirectory() ? await detectStack(record.path) : [],
    isGit: Boolean(info && info.branch),
    branch: info?.branch ?? "",
    dirty: info?.dirty ?? 0,
    lastCommitAt: info?.lastCommitAt ?? null,
    lastCommitMessage: info?.lastCommitMessage ?? null,
    sessions: sessionInfo.count,
    lastSessionAt: sessionInfo.lastAt,
  };
}

export async function enrichProjects(
  records: ProjectRecord[],
  sessionCounts: Map<string, { count: number; lastAt: number }>,
): Promise<ProjectInfo[]> {
  const enriched = await Promise.all(
    records.map((record) => enrichProject(record, sessionCounts)),
  );
  return enriched.filter((info) => info.exists).sort((a, b) => {
    const aTime = Math.max(a.lastSessionAt ?? 0, a.lastCommitAt ?? 0, a.createdAt);
    const bTime = Math.max(b.lastSessionAt ?? 0, b.lastCommitAt ?? 0, b.createdAt);
    return bTime - aTime;
  });
}

async function candidateProjectDirs(): Promise<string[]> {
  const candidates = new Set<string>();
  try {
    const entries = await fs.readdir(HOME, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      candidates.add(path.join(HOME, entry.name));
    }
  } catch {
    return [];
  }
  try {
    const raw = await fs.readFile(REGISTRY_FILE, "utf8");
    const data = JSON.parse(raw) as LegacyRegistry;
    for (const extra of Array.isArray(data.extraPaths) ? data.extraPaths : []) {
      if (typeof extra === "string") candidates.add(extra);
    }
  } catch {
    // no legacy registry
  }
  return [...candidates];
}

function looksLikeProject(dir: string): Promise<boolean> {
  return fs
    .readdir(dir)
    .then((names) =>
      names.some((name) =>
        [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"].includes(
          name,
        ),
      ),
    )
    .catch(() => false);
}

export async function seedProjectsForUser(userId: string): Promise<number> {
  const records = await readRegistry();
  const known = new Set(records.map((record) => record.path));
  const candidates = await candidateProjectDirs();
  let added = 0;
  for (const dir of candidates) {
    if (known.has(dir)) continue;
    if (!(await looksLikeProject(dir))) continue;
    records.push({
      id: `p_${randomBytes(6).toString("hex")}`,
      name: path.basename(dir),
      ownerId: userId,
      path: dir,
      createdAt: Date.now(),
    });
    added++;
  }
  if (added > 0) await writeRegistry(records);
  return added;
}
