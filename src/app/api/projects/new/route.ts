import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createProject } from "@/lib/projects";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { name?: string };
    const result = await createProject(user.id, body.name ?? "");
    if (!result.path) {
      return NextResponse.json(
        { error: result.error ?? "failed to create project" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, path: result.path });
  } catch {
    return NextResponse.json(
      { error: "failed to create project" },
      { status: 500 },
    );
  }
}
