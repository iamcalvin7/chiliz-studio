import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  abortSession,
  listMessages,
  renameSession,
  sendPrompt,
} from "@/lib/opencode";
import { getOwnedProject, getProjectByPath } from "@/lib/projects";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
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
    const { messages, busy } = await listMessages(id, directory);
    return NextResponse.json({ messages, busy });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      directory?: string;
      text?: string;
    };
    if (!body.directory || !body.text?.trim()) {
      return NextResponse.json(
        { error: "directory and text are required" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(body.directory, user.id))) {
      return NextResponse.json(
        { error: "you can only chat in your own projects" },
        { status: 403 },
      );
    }
    await sendPrompt(id, body.directory, body.text.trim());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      directory?: string;
      title?: string;
    };
    const title = (body.title ?? "").trim().slice(0, 80);
    if (!body.directory || !title) {
      return NextResponse.json(
        { error: "directory and title are required" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(body.directory, user.id))) {
      return NextResponse.json(
        { error: "you can only rename chats in your own projects" },
        { status: 403 },
      );
    }
    const session = await renameSession(id, body.directory, title);
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const directory = new URL(request.url).searchParams.get("directory");
  if (!directory) {
    return NextResponse.json(
      { error: "directory is required" },
      { status: 400 },
    );
  }
  if (!(await getOwnedProject(directory, user.id))) {
    return NextResponse.json(
      { error: "you can only stop sessions in your own projects" },
      { status: 403 },
    );
  }
  await abortSession(id, directory).catch(() => {});
  return NextResponse.json({ ok: true });
}
