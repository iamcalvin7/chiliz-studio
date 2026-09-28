import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  addExistingProject,
  workspaceProjectDir,
} from "@/lib/projects";

const exec = promisify(execFile);

const TIMEOUT_MS = 120_000;

function baseNameFromRepo(repo: string): string {
  const clean = repo.replace(/\.git$/i, "").replace(/\/+$/, "");
  const last = clean.split(/[/:]/).pop() ?? "imported-project";
  return last.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "imported-project";
}

async function uniqueTarget(userId: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = workspaceProjectDir(
      userId,
      attempt === 0 ? name : `${name}-${attempt + 1}`,
    );
    const stat = await fs.stat(candidate).catch(() => null);
    if (!stat) return candidate;
  }
  return workspaceProjectDir(userId, `${name}-${Date.now()}`);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { repo?: string };
    const repo = (body.repo ?? "").trim();
    if (!repo || /\s/.test(repo)) {
      return NextResponse.json(
        { error: "a single git repository URL is required" },
        { status: 400 },
      );
    }
    const name = baseNameFromRepo(repo);
    const target = await uniqueTarget(user.id, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await exec(
        "git",
        ["clone", "--depth", "1", repo, target],
        { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
    } catch (error) {
      const err = error as { stderr?: string };
      const detail = (err.stderr ?? "").trim().split("\n").pop() ?? "clone failed";
      await fs.rm(target, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: `git clone failed: ${detail}` },
        { status: 400 },
      );
    }
    const registered = await addExistingProject(user.id, target);
    if (!registered.path) {
      await fs.rm(target, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: registered.error ?? "failed to register project" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, path: target, name });
  } catch {
    return NextResponse.json(
      { error: "failed to import project" },
      { status: 500 },
    );
  }
}
