import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSession, listSessions } from "@/lib/opencode";
import { getProjectByPath, getOwnedProject } from "@/lib/projects";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const directory = new URL(request.url).searchParams.get("directory");
  if (!directory) {
    return NextResponse.json(
      { error: "directory is required" },
      { status: 400 },
    );
  }
  if (!(await getProjectByPath(directory))) {
    return NextResponse.json(
      { error: "project not registered" },
      { status: 404 },
    );
  }
  try {
    const sessions = await listSessions(directory);
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
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
      title?: string;
    };
    if (!body.directory) {
      return NextResponse.json(
        { error: "directory is required" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(body.directory, user.id))) {
      return NextResponse.json(
        { error: "you can only create chats in your own projects" },
        { status: 403 },
      );
    }
    const session = await createSession(body.directory, body.title);
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}
