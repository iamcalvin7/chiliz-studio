import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getPreview,
  startPreview,
  stopPreview,
  type PreviewInfo,
} from "@/lib/preview";
import { getOwnedProject } from "@/lib/projects";

async function resolveDirectory(raw: string | undefined) {
  const directory = (raw ?? "").trim();
  if (!directory) return null;
  const stat = await fs.stat(directory).catch(() => null);
  if (!stat?.isDirectory()) return null;
  return directory;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const directory = await resolveDirectory(
    new URL(request.url).searchParams.get("directory") ?? undefined,
  );
  if (!directory) {
    return NextResponse.json(
      { error: "directory is required and must exist" },
      { status: 400 },
    );
  }
  const preview = await getPreview(directory);
  const isOwner = Boolean(await getOwnedProject(directory, user.id));
  if (isOwner) {
    return NextResponse.json({ preview, canEdit: true });
  }
  const limited: PreviewInfo = {
    ...preview,
    command: "",
    pid: null,
    logs: [],
  };
  return NextResponse.json({ preview: limited, canEdit: false });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      directory?: string;
      action?: string;
    };
    const directory = await resolveDirectory(body.directory);
    if (!directory) {
      return NextResponse.json(
        { error: "directory is required and must exist" },
        { status: 400 },
      );
    }
    if (!(await getOwnedProject(directory, user.id))) {
      return NextResponse.json(
        { error: "you can only control previews in your own projects" },
        { status: 403 },
      );
    }

    let preview: PreviewInfo;
    if (body.action === "stop") {
      preview = await stopPreview(directory);
    } else if (body.action === "start") {
      preview = await startPreview(directory);
    } else {
      return NextResponse.json(
        { error: "action must be 'start' or 'stop'" },
        { status: 400 },
      );
    }
    return NextResponse.json({ preview, canEdit: true });
  } catch {
    return NextResponse.json(
      { error: "failed to control preview" },
      { status: 500 },
    );
  }
}
