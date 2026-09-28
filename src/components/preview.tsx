"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MonitorPlay,
  Play,
  RefreshCw,
  RotateCw,
  Square,
} from "lucide-react";
import type { PreviewInfo } from "@/lib/preview";

interface PreviewProps {
  directory: string;
  canEdit: boolean;
}

const STATUS_STYLES: Record<
  PreviewInfo["status"],
  { dot: string; label: string; text: string }
> = {
  running: {
    dot: "bg-emerald-400",
    label: "Running",
    text: "text-emerald-300",
  },
  starting: { dot: "bg-amber-400", label: "Starting", text: "text-amber-300" },
  stopped: { dot: "bg-zinc-500", label: "Stopped", text: "text-zinc-400" },
  error: { dot: "bg-red-400", label: "Error", text: "text-red-300" },
};

export function Preview({ directory, canEdit }: PreviewProps) {
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/preview?directory=${encodeURIComponent(directory)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { preview?: PreviewInfo };
      if (data.preview) setInfo(data.preview);
    } catch {
      return;
    }
  }, [directory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, info?.status === "starting" ? 1200 : 6000);
    return () => clearInterval(timer);
  }, [info?.status, refresh]);

  useEffect(() => {
    if (info?.status === "starting") setShowLogs(true);
  }, [info?.status]);

  async function control(action: "start" | "stop") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, action }),
      });
      const data = (await res.json()) as { preview?: PreviewInfo };
      if (data.preview) setInfo(data.preview);
      if (action === "start") setNonce((value) => value + 1);
    } catch {
      return;
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, action: "stop" }),
      });
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, action: "start" }),
      });
      const data = (await res.json()) as { preview?: PreviewInfo };
      if (data.preview) setInfo(data.preview);
      setNonce((value) => value + 1);
    } catch {
      return;
    } finally {
      setBusy(false);
    }
  }

  const status = info?.status ?? "stopped";
  const style = STATUS_STYLES[status];
  const shortCwd = directory.replace(/^\/Users\/[^/]+/, "~");
  const shortUrl = info?.url?.replace(/^http:\/\/127\.0\.0\.1/, "localhost");

  const toolButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-brand/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-panel">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-edge px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-ink px-2.5 py-1 text-[11px] font-medium">
            <span className={`size-1.5 rounded-full ${style.dot}`} />
            <span className={style.text}>{style.label}</span>
          </span>
          {info?.command && (
            <code className="hidden truncate rounded bg-ink px-2 py-1 font-mono text-[11px] text-zinc-400 sm:inline">
              {info.command}
            </code>
          )}
          {info?.url && (
            <span className="truncate font-mono text-[11px] text-zinc-500">
              {shortUrl}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {info?.url && (
              <>
                <button
                  type="button"
                  onClick={() => setNonce((value) => value + 1)}
                  className={toolButton}
                  aria-label="Reload preview"
                  title="Reload preview"
                >
                  <RotateCw className="size-3.5" />
                </button>
                <a
                  href={info.url}
                  target="_blank"
                  rel="noreferrer"
                  className={toolButton}
                  aria-label="Open in browser"
                  title="Open in browser"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </>
            )}
            {canEdit && status === "running" && (
              <button
                type="button"
                onClick={() => void restart()}
                disabled={busy}
                className={toolButton}
              >
                <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                Restart
              </button>
            )}
            {canEdit &&
              (status === "running" || status === "starting" ? (
                <button
                  type="button"
                  onClick={() => void control("stop")}
                  disabled={busy}
                  className={`${toolButton} hover:border-red-500/40 hover:text-red-400`}
                >
                  <Square className="size-3" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void control("start")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Start preview
                </button>
              ))}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {info?.url ? (
            <iframe
              key={`${info.url}-${nonce}`}
              src={info.url}
              title={`Preview of ${shortCwd}`}
              className="min-h-0 flex-1 border-0 bg-white"
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              {status === "starting" ? (
                <>
                  <Loader2 className="size-8 animate-spin text-brand" />
                  <p className="text-sm font-medium text-white">
                    Starting preview server...
                  </p>
                  <p className="max-w-md text-xs text-zinc-500">
                    Waiting for the server in {shortCwd} to respond. This can
                    take a few seconds on the first run.
                  </p>
                </>
              ) : status === "error" ? (
                <>
                  <MonitorPlay className="size-8 text-red-400" />
                  <p className="text-sm font-medium text-white">
                    Could not start the preview
                  </p>
                  <p className="max-w-md text-xs text-red-300/80">
                    {info?.message ?? "Something went wrong."}
                  </p>
                </>
              ) : (
                <>
                  <span className="grid size-12 place-items-center rounded-2xl bg-edge/60">
                    <MonitorPlay className="size-6 text-zinc-400" />
                  </span>
                  <p className="text-sm font-medium text-white">
                    No preview running
                  </p>
                  <p className="max-w-md text-xs text-zinc-500">
                    {info?.message ??
                      (canEdit
                        ? "Start the preview to see this project live. It runs the dev server (or serves a static build) on a local port."
                        : "The owner hasn't started a preview yet. Check back later.")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-edge">
          <button
            type="button"
            onClick={() => setShowLogs((value) => !value)}
            className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {showLogs ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Server logs
            {status === "starting" && (
              <Loader2 className="size-3 animate-spin text-brand" />
            )}
          </button>
          {showLogs && (
            <div className="max-h-40 overflow-y-auto border-t border-edge bg-ink px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-400">
              {info && info.logs.length > 0 ? (
                info.logs.map((line, index) => (
                  <p key={index} className="whitespace-pre-wrap break-all">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-zinc-600">
                  {status === "starting"
                    ? "Waiting for output..."
                    : "No logs available."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
