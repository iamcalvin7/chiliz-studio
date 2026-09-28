"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Line {
  kind: "info" | "command" | "output" | "error";
  text: string;
}

interface TerminalProps {
  directory: string;
  serverUp: boolean;
  appName: string;
}

const QUICK_COMMANDS = ["git status", "ls -la", "git log --oneline -5"];

export function Terminal({ directory, serverUp, appName }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>([
    {
      kind: "info",
      text: `${appName} terminal — commands run locally in ${directory}`,
    },
    { kind: "info", text: "Avoid long-running commands (60s timeout). Type 'clear' to reset." },
  ]);
  const [cwd, setCwd] = useState(directory);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length, running]);

  function append(newLines: Line[]) {
    setLines((prev) => [...prev, ...newLines]);
  }

  async function run(rawCommand: string) {
    const text = rawCommand.trim();
    if (!text || running || !serverUp) return;

    if (text === "clear") {
      setLines([
        {
          kind: "info",
          text: `${appName} terminal — commands run locally in ${directory}`,
        },
      ]);
      setCommand("");
      return;
    }

    setRunning(true);
    setCommand("");
    setHistory((prev) => [...prev, text]);
    setHistoryIndex(-1);
    const shortCwd = cwd.replace(/^\/Users\/[^/]+/, "~");
    append([{ kind: "command", text: `${shortCwd} $ ${text}` }]);

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, command: text }),
      });
      const data = (await res.json()) as {
        output?: string;
        exitCode?: number;
        cwd?: string;
        error?: string;
      };
      if (!res.ok) {
        append([{ kind: "error", text: data.error ?? "command failed" }]);
      } else {
        if (typeof data.cwd === "string") setCwd(data.cwd);
        if (data.output) {
          const outputLines = data.output
            .replace(/\n$/, "")
            .split("\n")
            .map(
              (line): Line => ({
                kind: (data.exitCode ?? 0) === 0 ? "output" : "error",
                text: line,
              }),
            );
          append(outputLines);
        }
        if ((data.exitCode ?? 0) !== 0) {
          append([{ kind: "error", text: `exit ${data.exitCode}` }]);
        }
      }
    } catch {
      append([{ kind: "error", text: "failed to reach the server" }]);
    } finally {
      setRunning(false);
    }
  }

  const shortCwd = cwd.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-ink">
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
          {lines.map((line, index) => (
            <p
              key={index}
              className={
                line.kind === "command"
                  ? "text-brand"
                  : line.kind === "error"
                    ? "whitespace-pre-wrap text-red-400"
                    : line.kind === "info"
                      ? "whitespace-pre-wrap text-zinc-500"
                      : "whitespace-pre-wrap text-zinc-200"
              }
            >
              {line.text}
            </p>
          ))}
          {running && (
            <p className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-3.5 animate-spin text-brand" />
              running...
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-center gap-2 border-t border-edge px-4 py-3 font-mono text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            void run(command);
          }}
        >
          <span className="shrink-0 text-brand">{shortCwd}</span>
          <span className="shrink-0 text-zinc-500">$</span>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (history.length === 0) return;
                const next =
                  historyIndex === -1
                    ? history.length - 1
                    : Math.max(0, historyIndex - 1);
                setHistoryIndex(next);
                setCommand(history[next] ?? "");
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                if (historyIndex === -1) return;
                const next = historyIndex + 1;
                if (next >= history.length) {
                  setHistoryIndex(-1);
                  setCommand("");
                } else {
                  setHistoryIndex(next);
                  setCommand(history[next] ?? "");
                }
              }
            }}
            placeholder={serverUp ? "" : "agent offline"}
            disabled={!serverUp || running}
            aria-label="Terminal command"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
          />
          <div className="flex shrink-0 gap-1.5">
            {QUICK_COMMANDS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => void run(quick)}
                disabled={running || !serverUp}
                className="rounded-md border border-edge bg-panel px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-brand/40 hover:text-white disabled:opacity-40"
              >
                {quick}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
