"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm({ needsInvite = true }: { needsInvite?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email, name, password, code }
            : { email, password },
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 rounded-xl border border-edge bg-ink px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {mode === "signup" && (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          className={inputClass}
        />
      )}
      {mode === "signup" && needsInvite && (
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Invite code (CHILIZ-XXXX-XXXX-XXXX)"
          aria-label="Invite code"
          autoFocus={false}
          className={inputClass}
        />
      )}
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        aria-label="Email"
        type="email"
        autoComplete="email"
        required
        className={inputClass}
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={mode === "signup" ? "At least 8 characters" : "Password"}
        aria-label="Password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        className={inputClass}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={
          loading ||
          !email.trim() ||
          !password ||
          (mode === "signup" && needsInvite && !code.trim())
        }
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
        }}
        className="text-xs text-zinc-400 transition-colors hover:text-white"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
