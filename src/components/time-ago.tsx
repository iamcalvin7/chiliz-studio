"use client";

import { useEffect, useState } from "react";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relative(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ms);
}

export function TimeAgo({
  at,
  fallback = "",
}: {
  at: number | null | undefined;
  fallback?: string;
}) {
  const [label, setLabel] = useState(() => (at ? formatDate(at) : fallback));

  useEffect(() => {
    if (!at) {
      setLabel(fallback);
      return;
    }
    setLabel(relative(at));
    const timer = setInterval(() => setLabel(relative(at)), 60_000);
    return () => clearInterval(timer);
  }, [at, fallback]);

  return <span suppressHydrationWarning>{label}</span>;
}
