"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@ark-ui/react";
import { FolderPlus, Loader2 } from "lucide-react";

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/project?p=${encodeURIComponent(data.path)}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Dialog.Trigger className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90">
        <FolderPlus className="size-4" />
        New project
      </Dialog.Trigger>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content className="w-full max-w-md rounded-2xl border border-edge bg-panel p-6">
          <Dialog.Title className="text-lg font-semibold text-white">
            New project
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-zinc-400">
            Creates a folder in your workspace with git initialized, then opens
            a chat with the agent.
          </Dialog.Description>
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-new-app"
              aria-label="Project name"
              autoFocus
              className="h-11 rounded-xl border border-edge bg-ink px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger className="h-10 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
