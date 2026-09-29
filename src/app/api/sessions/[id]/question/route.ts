import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rejectQuestion, replyQuestion } from "@/lib/opencode";
import { getOwnedProject } from "@/lib/projects";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      directory?: string;
      requestID?: string;
      answers?: string[][];
    };
    if (!body.directory || !body.requestID || !Array.isArray(body.answers)) {
      return NextResponse.json(
        { error: "directory, requestID and answers are required" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(body.directory, user.id))) {
      return NextResponse.json(
        { error: "you can only answer questions in your own projects" },
        { status: 403 },
      );
    }
    await replyQuestion(body.requestID, body.directory, body.answers);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const url = new URL(request.url);
  const directory = url.searchParams.get("directory");
  const requestID = url.searchParams.get("requestID");
  if (!directory || !requestID) {
    return NextResponse.json(
      { error: "directory and requestID are required" },
      { status: 400 },
    );
  }
  if (!(await getOwnedProject(directory, user.id))) {
    return NextResponse.json(
      { error: "you can only skip questions in your own projects" },
      { status: 403 },
    );
  }
  try {
    await rejectQuestion(requestID, directory);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 503 },
    );
  }
}
