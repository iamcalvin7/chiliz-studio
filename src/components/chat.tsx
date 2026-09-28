"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Brain,
  CheckCircle2,
  Flame,
  Loader2,
  Pencil,
  Plus,
  SendHorizontal,
  ServerOff,
  Square,
} from "lucide-react";
import { convertRawPart } from "@/lib/opencode";
import type { OcSession, UiMessage } from "@/lib/opencode";
import { TimeAgo } from "@/components/time-ago";
import { Markdown } from "@/components/markdown";

interface StreamEvent {
  type: string;
  properties?: Record<string, unknown>;
}

function upsertRawPart(
  messages: UiMessage[],
  raw: Record<string, unknown>,
): UiMessage[] {
  const messageID = typeof raw.messageID === "string" ? raw.messageID : "";
  if (!messageID) return messages;
  const converted = convertRawPart(raw);
  if (!converted) return messages;
  const partID = converted.pid ?? "";

  let found = false;
  const next = messages.map((message) => {
    if (message.id !== messageID) return message;
    found = true;
    const parts = [...message.parts];
    const index = parts.findIndex((part) => part.pid === partID);
    if (index === -1) parts.push(converted);
    else parts[index] = converted;
    return { ...message, parts };
  });

  if (!found) {
    return [
      ...messages,
      {
        id: messageID,
        role: "assistant",
        parts: [converted],
        createdAt: Date.now(),
      },
    ];
  }
  return next;
}

function applyDelta(
  messages: UiMessage[],
  messageID: string,
  partID: string,
  field: string,
  delta: string,
): UiMessage[] {
  const kind = field === "reasoning" ? "reasoning" : "text";
  return messages.map((message) => {
    if (message.id !== messageID) return message;
    const parts = [...message.parts];
    const index = parts.findIndex((part) => part.pid === partID);
    if (index === -1) {
      parts.push({ kind, pid: partID, text: delta });
    } else if (parts[index].kind === kind) {
      parts[index] = {
        ...parts[index],
        text: (parts[index].text ?? "") + delta,
      };
    }
    return { ...message, parts };
  });
}

interface ChatProps {
  directory: string;
  sessions: OcSession[];
  activeId: string | null;
  initialMessages: UiMessage[];
  initialBusy: boolean;
  serverUp: boolean;
  canEdit: boolean;
}

export function Chat({
  directory,
  sessions: initialSessions,
  activeId: initialActiveId,
  initialMessages,
  initialBusy,
  serverUp,
  canEdit,
}: ChatProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [busy, setBusy] = useState(initialBusy);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await fetch(
        `/api/sessions/${activeId}?directory=${encodeURIComponent(directory)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: UiMessage[];
        busy: boolean;
      };
      setMessages(data.messages);
      setBusy(data.busy);
    } catch {
      return;
    }
  }, [activeId, directory]);

  useEffect(() => {
    if (!activeId) return;
    void refresh();
  }, [activeId, refresh]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  useEffect(() => {
    if (!atBottom) return;
    const el = scrollRef.current;
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: busy ? "auto" : "smooth",
    });
  }, [messages, busy, atBottom]);

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      const props = event.properties ?? {};
      switch (event.type) {
        case "message.updated": {
          const info = props.info as Record<string, unknown> | undefined;
          if (!info || typeof info.id !== "string") return;
          const messageID = info.id;
          const isUser = info.role === "user";
          const time = (info.time ?? {}) as Record<string, unknown>;
          const createdAt =
            typeof time.created === "number" ? time.created : Date.now();
          setMessages((prev) => {
            if (prev.some((message) => message.id === messageID)) return prev;
            if (isUser) {
              const localIndex = prev.findIndex((message) =>
                message.id.startsWith("local-"),
              );
              if (localIndex !== -1) {
                const copy = [...prev];
                copy[localIndex] = { ...copy[localIndex], id: messageID };
                return copy;
              }
            }
            return [
              ...prev,
              {
                id: messageID,
                role: isUser ? "user" : "assistant",
                parts: [],
                createdAt,
              },
            ];
          });
          break;
        }
        case "message.part.updated": {
          const raw = props.part as Record<string, unknown> | undefined;
          if (!raw) return;
          setMessages((prev) => upsertRawPart(prev, raw));
          break;
        }
        case "message.part.delta": {
          const field = props.field;
          const delta = props.delta;
          const messageID = props.messageID;
          const partID = props.partID;
          if (
            (field !== "text" && field !== "reasoning") ||
            typeof delta !== "string" ||
            !delta ||
            typeof messageID !== "string" ||
            typeof partID !== "string"
          ) {
            return;
          }
          setMessages((prev) =>
            applyDelta(prev, messageID, partID, field, delta),
          );
          break;
        }
        case "session.status": {
          const status = props.status as Record<string, unknown> | undefined;
          if (!status) return;
          setBusy(status.type === "busy");
          break;
        }
        case "session.idle": {
          setBusy(false);
          void refresh();
          break;
        }
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!activeId) return;
    const source = new EventSource(
      `/api/events?directory=${encodeURIComponent(directory)}&sessionID=${encodeURIComponent(activeId)}`,
    );
    source.onmessage = (event) => {
      try {
        handleStreamEvent(JSON.parse(event.data) as StreamEvent);
      } catch {
        return;
      }
    };
    source.onerror = () => {
      void refresh();
    };
    return () => source.close();
  }, [activeId, directory, handleStreamEvent, refresh]);

  function startRename(session: OcSession) {
    setRenamingId(session.id);
    setRenameValue(session.title);
  }

  async function commitRename(id: string) {
    const title = renameValue.trim().slice(0, 80);
    setRenamingId(null);
    const current = sessions.find((session) => session.id === id);
    if (!title || !current || title === current.title) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, title }),
      });
      const data = (await res.json()) as { session?: OcSession };
      const renamed = data.session;
      if (!res.ok || !renamed) return;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id ? { ...session, title: renamed.title } : session,
        ),
      );
    } catch {
      return;
    }
  }

  async function newChat() {    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory }),
      });
      const data = (await res.json()) as { session?: OcSession };
      if (!data.session) return;
      setSessions((prev) => [data.session as OcSession, ...prev]);
      setActiveId(data.session.id);
      setMessages([]);
      setBusy(false);
    } catch {
      return;
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || !activeId || busy || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        parts: [{ kind: "text", text }],
        createdAt: Date.now(),
      },
    ]);
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${activeId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directory, text }),
      });
      if (!res.ok) {
        setInput(text);
        setMessages((prev) => prev.slice(0, -1));
        setBusy(false);
        return;
      }
      await refresh();
    } catch {
      setInput(text);
      setMessages((prev) => prev.slice(0, -1));
      setBusy(false);
    } finally {
      setSending(false);
    }
  }

  async function stop() {
    if (!activeId) return;
    await fetch(
      `/api/sessions/${activeId}?directory=${encodeURIComponent(directory)}`,
      { method: "DELETE" },
    ).catch(() => {});
    await refresh();
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge bg-panel/40 p-3 md:flex">
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sessions
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => void newChat()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-edge/60 hover:text-white"
            >
              <Plus className="size-3.5" />
              New
            </button>
          )}
        </div>
          {sessions.map((session) => (
            <div key={session.id} className="group relative">
              {renamingId === session.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitRename(session.id);
                    } else if (event.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  onBlur={() => void commitRename(session.id)}
                  maxLength={80}
                  aria-label="Session name"
                  className="h-11 w-full rounded-lg border border-brand/60 bg-ink px-3 text-sm text-white outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(session.id);
                    setMessages([]);
                    setBusy(false);
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 pr-7 text-left transition-colors ${
                    session.id === activeId
                      ? "bg-edge text-white"
                      : "text-zinc-400 hover:bg-edge/60 hover:text-white"
                  }`}
                >
                  <span className="w-full truncate text-sm">
                    {session.title}
                  </span>
              <span className="text-[11px] text-zinc-500">
                <TimeAgo at={session.updatedAt} fallback="new" />
              </span>
                </button>
              )}
              {canEdit && renamingId !== session.id && (
                <button
                  type="button"
                  onClick={() => startRename(session)}
                  aria-label={`Rename ${session.title}`}
                  className="absolute right-1.5 top-2 grid size-6 place-items-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-edge/60 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="size-3" />
                </button>
              )}
            </div>
          ))}
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
            }}
            className="relative flex-1 overflow-y-auto"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
              {!serverUp && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  <ServerOff className="mt-0.5 size-4 shrink-0" />
                  <p>
                    The agent server is offline. Start it with{" "}
                    <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">
                      ~/chiliz-studio/scripts/opencode-server.sh
                    </code>{" "}
                    and refresh.
                  </p>
                </div>
              )}

              {serverUp && messages.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-24 text-center">
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand text-ink">
                    <Flame className="size-6" />
                  </span>
                  <p className="font-medium text-white">
                    What should we build, Calvin?
                  </p>
                  <p className="max-w-sm text-sm text-zinc-500">
                    Describe an idea, a bug or a feature. The agent works
                    directly in this project folder.
                  </p>
                </div>
              )}

              {messages.map((message) => {
                if (message.role === "user") {
                  const text = message.parts
                    .filter((part) => part.kind === "text")
                    .map((part) => part.text)
                    .join("\n");
                  return (
                    <div
                      key={message.id}
                      className="flex justify-end"
                    >
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-3 text-sm font-medium text-ink">
                        {text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={message.id} className="flex gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-edge bg-panel">
                      <Flame className="size-4 text-brand" />
                    </span>
                    <div className="flex min-w-0 max-w-[92%] flex-col gap-2">
                      {message.parts.map((part, index) => {
                        if (part.kind === "reasoning") {
                          return (
                            <div
                              key={index}
                              className="rounded-lg border border-edge/60 bg-panel/50 px-3 py-2"
                            >
                              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                <Brain className="size-3" />
                                Thinking
                              </p>
                              <p className="mt-1 line-clamp-3 text-xs italic leading-relaxed text-zinc-500">
                                {part.text}
                              </p>
                            </div>
                          );
                        }
                        if (part.kind === "text") {
                          const isLastMessage =
                            message.id === messages[messages.length - 1]?.id;
                          const isLastPart =
                            index === message.parts.length - 1;
                          return (
                            <Markdown
                              key={index}
                              content={part.text ?? ""}
                              streaming={busy && isLastMessage && isLastPart}
                            />
                          );
                        }
                        return (
                          <div
                            key={index}
                            className="inline-flex max-w-full items-center gap-2 self-start rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-zinc-400"
                          >
                            {part.status === "running" ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" />
                            ) : (
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                            )}
                            <span className="truncate font-mono">
                              {part.label}
                            </span>
                          </div>
                        );
                      })}
                      {!message.parts.some(
                        (part) =>
                          part.kind === "text" || part.kind === "tool",
                      ) &&
                        busy && (
                          <div className="flex items-center gap-1 py-1">
                            {[0, 1, 2].map((dot) => (
                              <span
                                key={dot}
                                className="size-1.5 animate-bounce rounded-full bg-zinc-500"
                                style={{
                                  animationDelay: `${dot * 0.15}s`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!atBottom && messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const el = scrollRef.current;
                el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                setAtBottom(true);
              }}
              className="absolute bottom-20 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-edge bg-panel px-3.5 py-1.5 text-xs font-medium text-zinc-300 shadow-lg shadow-black/40 transition-colors hover:border-brand/40 hover:text-white"
            >
              <ArrowDown className="size-3.5" />
              Jump to latest
            </button>
          )}

          <div className="shrink-0 border-t border-edge bg-ink/90 backdrop-blur">
            {canEdit ? (
              <form
                className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={
                  serverUp ? "Describe what to build..." : "Agent offline"
                }
                disabled={!serverUp || !activeId}
                aria-label="Message the agent"
                className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-brand/60 focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  aria-label="Stop the agent"
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-edge bg-panel text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !activeId || sending || !serverUp}
                  aria-label="Send message"
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="size-4" />
                  )}
                </button>
              )}
              </form>
            ) : (
              <div className="mx-auto max-w-3xl px-4 py-4 text-xs text-zinc-500">
                You are viewing this project read-only. Only its owner can
                message the agent and run commands here.
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
