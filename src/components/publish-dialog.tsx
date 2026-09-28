"use client";

import { useState } from "react";
import { Dialog } from "@ark-ui/react";
import { Loader2, Upload } from "lucide-react";

interface PublishDialogProps {
  directory: string;
  projectName: string;
}

export function PublishDialog({ directory, projectName }: PublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/community/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          directory,
          description,
          repo: repo.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not publish");
        return;
      }
      setOpen(false);
      setDescription("");
      setRepo("");
    } catch {
      setError("Could not publish");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-10 rounded-xl border border-edge bg-ink px-3.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

  return (
    <Dialog.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Dialog.Trigger
        aria-label={`Publish ${projectName} to the community`}
        title="Publish to community"
        className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-brand/40 hover:text-white"
      >
        <Upload className="size-3.5" />
        Publish
      </Dialog.Trigger>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content className="w-full max-w-md rounded-2xl border border-edge bg-panel p-6">
          <Dialog.Title className="text-lg font-semibold text-white">
            Publish {projectName}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-zinc-400">
            Adds this project to the community directory so others can browse
            and import it. Code is shared through the git repository.
          </Dialog.Description>
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void publish();
            }}
          >
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What is this project? (optional)"
              aria-label="Project description"
              className="resize-none rounded-xl border border-edge bg-ink px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            <input
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="Repo URL (defaults to the git origin)"
              aria-label="Repository URL"
              className={inputClass}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger className="h-10 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Publish
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
