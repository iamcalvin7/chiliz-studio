import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isServerUp, listSessions } from "@/lib/opencode";
import {
  addExistingProject,
  enrichProjects,
  listProjectRecords,
} from "@/lib/projects";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const up = await isServerUp();
    const sessionCounts = new Map<string, { count: number; lastAt: number }>();
    if (up) {
      const sessions = await listSessions();
      for (const session of sessions) {
        const current = sessionCounts.get(session.directory) ?? {
          count: 0,
          lastAt: 0,
        };
        sessionCounts.set(session.directory, {
          count: current.count + 1,
          lastAt: Math.max(current.lastAt, session.updatedAt),
        });
      }
    }
    const projects = await enrichProjects(
      await listProjectRecords(),
      sessionCounts,
    );
    return NextResponse.json({ projects, server: up });
  } catch {
    return NextResponse.json(
      { error: "failed to load projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "only the admin can register existing folders" },
      { status: 403 },
    );
  }
  try {
    const body = (await request.json()) as { path?: string };
    if (!body.path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    const result = await addExistingProject(user.id, body.path);
    if (!result.path) {
      return NextResponse.json(
        { error: result.error ?? "failed to register project" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, path: result.path });
  } catch {
    return NextResponse.json({ error: "failed to register project" }, { status: 500 });
  }
}
