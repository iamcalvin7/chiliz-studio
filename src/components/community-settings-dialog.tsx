"use client";

import { useState } from "react";
import { Dialog } from "@ark-ui/react";
import { Check, Loader2, Settings2 } from "lucide-react";

interface CommunitySettingsView {
  configured: boolean;
  owner: string;
  repo: string;
  branch: string;
  tokenSet: boolean;
}

export function CommunitySettingsDialog() {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/community/settings");
      if (!res.ok) return;
      const data = (await res.json()) as { settings?: CommunitySettingsView };
      if (data.settings) {
        setOwner(data.settings.owner);
        setRepo(data.settings.repo);
        setBranch(data.settings.branch || "main");
        setLoaded(true);
      }
    } catch {
      return;
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/community/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          ...(token.trim() ? { token: token.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save settings");
        return;
      }
      setSaved(true);
      setToken("");
    } catch {
      setError("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-10 rounded-xl border border-edge bg-ink px-3.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (details.open && !loaded) void load();
      }}
    >
      <Dialog.Trigger
        aria-label="Community settings"
        className="grid size-9 place-items-center rounded-xl border border-edge bg-panel text-zinc-400 transition-colors hover:border-brand/40 hover:text-white"
      >
        <Settings2 className="size-4" />
      </Dialog.Trigger>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content className="w-full max-w-md rounded-2xl border border-edge bg-panel p-6">
          <Dialog.Title className="text-lg font-semibold text-white">
            Community directory
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-zinc-400">
            Point the studio at a GitHub repository that holds the shared
            projects.json. Reading works for any public repo; publishing needs
            a token with write access.
          </Dialog.Description>
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="owner (user or org)"
              aria-label="GitHub owner"
              className={inputClass}
            />
            <input
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="repository name"
              aria-label="Repository"
              className={inputClass}
            />
            <input
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="branch (main)"
              aria-label="Branch"
              className={inputClass}
            />
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                loaded
                  ? "paste a new token to update"
                  : "GitHub token with repo scope (optional)"
              }
              aria-label="GitHub token"
              type="password"
              className={inputClass}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            {saved && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="size-3.5" />
                Saved
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger className="h-10 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="submit"
                disabled={saving || !owner.trim() || !repo.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
