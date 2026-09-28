import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOwnedProject } from "@/lib/projects";

const run = promisify(exec);

const cwdMap = new Map<string, string>();
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 40_000;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      directory?: string;
      command?: string;
    };
    const directory = body.directory ?? "";
    const command = (body.command ?? "").trim();

    if (!directory || !command) {
      return NextResponse.json(
        { error: "directory and command are required" },
        { status: 400 },
      );
    }

    if (!(await getOwnedProject(directory, user.id))) {
      return NextResponse.json(
        { error: "you can only run commands in your own projects" },
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

    let cwd = cwdMap.get(directory) ?? directory;

    const trimmed = command.replace(/\s+$/, "");
    if (/^cd(\s|$)/.test(trimmed)) {
      const arg = trimmed.replace(/^cd\s*/, "").trim() || "~";
      const expanded = arg.startsWith("~")
        ? path.join(os.homedir(), arg.slice(1))
        : path.resolve(cwd, arg);
      const target = await fs.stat(expanded).catch(() => null);
      if (!target?.isDirectory()) {
        return NextResponse.json({
          output: `cd: not a directory: ${arg}`,
          exitCode: 1,
          cwd,
        });
      }
      cwd = expanded;
      cwdMap.set(directory, cwd);
      return NextResponse.json({ output: "", exitCode: 0, cwd });
    }

    if (trimmed === "clear") {
      return NextResponse.json({ output: "", exitCode: 0, cwd });
    }

    try {
      const { stdout, stderr } = await run(
        `cd ${shellQuote(cwd)} && ${command}`,
        {
          cwd,
          timeout: TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, TERM: "dumb" },
        },
      );
      return NextResponse.json({
        output: `${stdout}${stderr}`.slice(-MAX_OUTPUT),
        exitCode: 0,
        cwd,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        killed?: boolean;
      };
      const output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      if (err.killed) {
        return NextResponse.json({
          output:
            output.slice(-MAX_OUTPUT) +
            `\ncommand timed out after ${TIMEOUT_MS / 1000}s`,
          exitCode: 124,
          cwd,
        });
      }
      return NextResponse.json({
        output: output.slice(-MAX_OUTPUT),
        exitCode: typeof err.code === "number" ? err.code : 1,
        cwd,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "failed to run command" },
      { status: 500 },
    );
  }
}
