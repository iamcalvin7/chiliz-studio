"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@ark-ui/react";
import { Check, Copy, Loader2, Plus, Ticket, Trash2 } from "lucide-react";

interface Invite {
  code: string;
  createdAt: number;
  usedByEmail: string | null;
  revoked: boolean;
}

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/invites");
      if (!res.ok) {
        setError("Could not load invites");
        return;
      }
      const data = (await res.json()) as { invites?: Invite[] };
      setInvites(data.invites ?? []);
    } catch {
      setError("Could not load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/invites", { method: "POST" });
      if (res.ok) await load();
    } catch {
      setError("Could not create invite");
    } finally {
      setGenerating(false);
    }
  }

  async function revoke(code: string) {
    try {
      const res = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) await load();
    } catch {
      setError("Could not revoke invite");
    }
  }

  function copy(code: string) {
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {});
  }

  return (
    <Dialog.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Dialog.Trigger className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge bg-panel px-5 text-sm font-semibold text-white transition-colors hover:border-brand/40">
        <Ticket className="size-4 text-brand" />
        Invite
      </Dialog.Trigger>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-edge bg-panel p-6">
          <Dialog.Title className="text-lg font-semibold text-white">
            Invite builders
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-zinc-400">
            Generate a code and share it with the person you want to invite.
            Each code works once, at sign-up.
          </Dialog.Description>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Invite codes
            </p>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Generate code
            </button>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            {invites.length === 0 && !loading ? (
              <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-xs text-zinc-500">
                No invite codes yet. Generate one to start inviting people.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.code}
                    className="flex items-center gap-2 rounded-xl border border-edge bg-ink px-3 py-2.5"
                  >
                    <code
                      className={`min-w-0 flex-1 truncate font-mono text-xs ${
                        invite.revoked || invite.usedByEmail
                          ? "text-zinc-600 line-through"
                          : "text-zinc-200"
                      }`}
                    >
                      {invite.code}
                    </code>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {invite.revoked
                        ? "revoked"
                        : invite.usedByEmail
                          ? `used by ${invite.usedByEmail}`
                          : "available"}
                    </span>
                    {!invite.usedByEmail && !invite.revoked && (
                      <>
                        <button
                          type="button"
                          onClick={() => copy(invite.code)}
                          aria-label={`Copy ${invite.code}`}
                          className="grid size-7 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-edge hover:text-white"
                        >
                          {copied === invite.code ? (
                            <Check className="size-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void revoke(invite.code)}
                          aria-label={`Revoke ${invite.code}`}
                          className="grid size-7 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-edge hover:text-red-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.CloseTrigger className="h-10 rounded-xl border border-edge px-4 text-sm text-zinc-300 transition-colors hover:text-white">
              Done
            </Dialog.CloseTrigger>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
