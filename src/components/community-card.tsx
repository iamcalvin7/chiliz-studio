"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Loader2 } from "lucide-react";

interface CommunityCardProps {
  slug: string;
  name: string;
  description: string;
  stack: string[];
  owner: string;
  repo: string;
}

export function CommunityCard({
  name,
  description,
  stack,
  owner,
  repo,
}: CommunityCardProps) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function importProject() {
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/community/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setError(data.error ?? "Could not import");
        return;
      }
      router.push(`/project?p=${encodeURIComponent(data.path)}`);
    } catch {
      setError("Could not import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-white">{name}</span>
        <a
          href={repo}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px] text-zinc-500 underline-offset-2 transition-colors hover:text-brand hover:underline"
        >
          repo
        </a>
      </div>
      {description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
          {description}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {stack.map((tech) => (
          <span
            key={tech}
            className="rounded-full bg-edge/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
          >
            {tech}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-edge pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-edge text-[9px] font-bold text-zinc-300">
            {owner.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{owner}</span>
        </span>
        <button
          type="button"
          onClick={() => void importProject()}
          disabled={importing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {importing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CloudDownload className="size-3.5" />
          )}
          Import
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
