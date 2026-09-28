import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { publishToDirectory, slugForProjectName } from "@/lib/community";
import { getCommunitySettings } from "@/lib/settings";
import { getOwnedProject, projectStack } from "@/lib/projects";

const exec = promisify(execFile);

async function gitRemote(directory: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", [
      "-C",
      directory,
      "remote",
      "get-url",
      "origin",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      directory?: string;
      description?: string;
      repo?: string;
    };
    const directory = (body.directory ?? "").trim();
    if (!directory) {
      return NextResponse.json(
        { error: "directory is required" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(directory, user.id))) {
      return NextResponse.json(
        { error: "you can only publish your own projects" },
        { status: 403 },
      );
    }
    const stat = await fs.stat(directory).catch(() => null);
    if (!stat?.isDirectory()) {
      return NextResponse.json(
        { error: "project directory not found" },
        { status: 400 },
      );
    }
    if (!(await getCommunitySettings())) {
      return NextResponse.json(
        {
          error:
            "community directory is not configured yet — open Community settings to connect it",
        },
        { status: 400 },
      );
    }

    const remote = await gitRemote(directory);
    const repo = (body.repo ?? "").trim() || remote;
    if (!repo) {
      return NextResponse.json(
        {
          error:
            "this project has no git remote yet — push it to GitHub first (or paste a repo URL)",
        },
        { status: 400 },
      );
    }

    const name = directory.split("/").pop() ?? "project";
    const result = await publishToDirectory({
      slug: slugForProjectName(name),
      name,
      description: (body.description ?? "").trim().slice(0, 300),
      stack: await projectStack(directory),
      owner: user.name,
      repo,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "failed to publish project" },
      { status: 500 },
    );
  }
}
