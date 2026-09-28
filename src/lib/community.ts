import {
  getCommunitySettings,
  type CommunitySettings,
} from "@/lib/settings";

export interface CommunityProject {
  slug: string;
  name: string;
  description: string;
  stack: string[];
  owner: string;
  repo: string;
  addedAt: number;
  updatedAt: number;
}

interface DirectoryCache {
  at: number;
  projects: CommunityProject[];
  error: string | null;
}

const CACHE_TTL_MS = 30_000;
let cache: DirectoryCache | null = null;

function directoryRawUrl(settings: CommunitySettings): string {
  const base = (settings.rawBase ?? "https://raw.githubusercontent.com").replace(/\/+$/, "");
  return `${base}/${settings.owner}/${settings.repo}/${settings.branch}/projects.json`;
}

function contentsApiUrl(settings: CommunitySettings): string {
  const base = (settings.apiBase ?? "https://api.github.com").replace(/\/+$/, "");
  return `${base}/repos/${settings.owner}/${settings.repo}/contents/projects.json`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDirectory(data: unknown): CommunityProject[] {
  const entries = Array.isArray(data) ? data : [];
  const projects: CommunityProject[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const repo = typeof entry.repo === "string" ? entry.repo.trim() : "";
    if (!name || !repo) continue;
    const slug =
      typeof entry.slug === "string" && entry.slug.trim()
        ? slugify(entry.slug)
        : slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    projects.push({
      slug,
      name,
      description:
        typeof entry.description === "string" ? entry.description.slice(0, 300) : "",
      stack: Array.isArray(entry.stack)
        ? entry.stack.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
      owner: typeof entry.owner === "string" ? entry.owner.slice(0, 60) : "Unknown",
      repo,
      addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
      updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
    });
  }
  return projects;
}

export async function fetchDirectory(
  force = false,
): Promise<{ projects: CommunityProject[]; error: string | null }> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { projects: cache.projects, error: cache.error };
  }
  const settings = await getCommunitySettings();
  if (!settings) {
    return {
      projects: [],
      error: "not-configured",
    };
  }
  try {
    const res = await fetch(directoryRawUrl(settings), {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.status === 404) {
      const result = { projects: [], error: null };
      cache = { at: Date.now(), ...result };
      return result;
    }
    if (!res.ok) {
      const result = {
        projects: [],
        error: `directory unreachable (HTTP ${res.status})`,
      };
      cache = { at: Date.now(), ...result };
      return result;
    }
    const data: unknown = await res.json();
    const result = { projects: parseDirectory(data), error: null };
    cache = { at: Date.now(), ...result };
    return result;
  } catch {
    const result = { projects: [], error: "directory unreachable" };
    cache = { at: Date.now(), ...result };
    return result;
  }
}

function mergeEntry(
  projects: CommunityProject[],
  entry: CommunityProject,
): CommunityProject[] {
  const existing = projects.findIndex((project) => project.slug === entry.slug);
  if (existing === -1) return [...projects, entry];
  const next = [...projects];
  next[existing] = entry;
  return next;
}

export async function publishToDirectory(
  entry: Omit<CommunityProject, "addedAt" | "updatedAt">,
): Promise<{ ok: true } | { error: string }> {
  const settings = await getCommunitySettings();
  if (!settings) {
    return { error: "community directory is not configured" };
  }
  const slug = slugify(entry.slug || entry.name);
  if (!slug) {
    return { error: "project name is required" };
  }

  let sha: string | undefined;
  let projects: CommunityProject[] = [];
  try {
    const res = await fetch(contentsApiUrl(settings), {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${settings.token ?? ""}`,
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (res.status === 404) {
      projects = [];
    } else if (res.ok) {
      const data = (await res.json()) as { sha?: string; content?: string };
      sha = data.sha;
      const content = data.content
        ? Buffer.from(data.content, "base64").toString("utf8")
        : "[]";
      projects = parseDirectory(JSON.parse(content));
    } else {
      return {
        error:
          res.status === 401 || res.status === 403
            ? "the stored GitHub token cannot access this repository"
            : `GitHub API returned ${res.status}`,
      };
    }
  } catch {
    return { error: "could not reach the GitHub API" };
  }

  const now = Date.now();
  const next = mergeEntry(projects, {
    ...entry,
    slug,
    addedAt: projects.find((project) => project.slug === slug)?.addedAt ?? now,
    updatedAt: now,
  });

  try {
    const res = await fetch(contentsApiUrl(settings), {
      method: "PUT",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${settings.token ?? ""}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Publish ${entry.name} (${slug})`,
        content: Buffer.from(
          JSON.stringify(next, null, 2) + "\n",
          "utf8",
        ).toString("base64"),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) {
      return {
        error:
          res.status === 401 || res.status === 403
            ? "publishing failed: the token cannot push to this repository"
            : `publishing failed: GitHub returned ${res.status}`,
      };
    }
  } catch {
    return { error: "could not reach the GitHub API" };
  }

  cache = { at: Date.now(), projects: next, error: null };
  return { ok: true };
}

export function slugForProjectName(name: string): string {
  return slugify(name);
}
