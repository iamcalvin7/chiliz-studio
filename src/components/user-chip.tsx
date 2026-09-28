"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

interface UserChipProps {
  name: string;
  email: string;
}

export function UserChip({ name, email }: UserChipProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-edge bg-panel py-1 pl-1 pr-1.5">
      <span className="grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-ink">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-xs font-medium text-white">{name}</span>
        <span className="text-[10px] text-zinc-500">{email}</span>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="grid size-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-edge hover:text-white disabled:opacity-50"
      >
        <LogOut className="size-3.5" />
      </button>
    </span>
  );
}
