"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs } from "@ark-ui/react";
import {
  ArrowLeft,
  MessagesSquare,
  MonitorPlay,
  TerminalSquare,
} from "lucide-react";
import { Chat } from "@/components/chat";
import { Preview } from "@/components/preview";
import { Terminal } from "@/components/terminal";
import { PublishDialog } from "@/components/publish-dialog";
import type { OcSession, UiMessage } from "@/lib/opencode";

interface ProjectViewProps {
  directory: string;
  projectName: string;
  ownerName: string;
  canEdit: boolean;
  appName: string;
  sessions: OcSession[];
  activeId: string | null;
  initialMessages: UiMessage[];
  initialBusy: boolean;
  serverUp: boolean;
}

type Tab = "chat" | "preview" | "terminal";

export function ProjectView({
  directory,
  projectName,
  ownerName,
  canEdit,
  appName,
  sessions,
  activeId,
  initialMessages,
  initialBusy,
  serverUp,
}: ProjectViewProps) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-edge px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Projects
          </Link>
          <span className="h-4 w-px shrink-0 bg-edge" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {projectName}
            </p>
            <p className="truncate font-mono text-[11px] text-zinc-500">
              {directory}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {!canEdit && (
            <span className="hidden items-center gap-1.5 rounded-full border border-edge bg-panel px-2.5 py-1 text-[11px] text-zinc-400 sm:inline-flex">
              <span className="grid size-4 place-items-center rounded-full bg-edge text-[8px] font-bold text-zinc-300">
                {ownerName.slice(0, 1).toUpperCase()}
              </span>
              {ownerName}
            </span>
          )}
          {canEdit && <PublishDialog directory={directory} projectName={projectName} />}
          <Tabs.Root
            value={tab}
            onValueChange={(details) => setTab(details.value as Tab)}
          >
            <Tabs.List className="inline-flex gap-1 rounded-full border border-edge bg-panel p-1">
              <Tabs.Trigger
                value="chat"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white data-[selected]:bg-brand data-[selected]:text-ink"
              >
                <MessagesSquare className="size-3.5" />
                Chat
              </Tabs.Trigger>
              <Tabs.Trigger
                value="preview"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white data-[selected]:bg-brand data-[selected]:text-ink"
              >
                <MonitorPlay className="size-3.5" />
                Preview
              </Tabs.Trigger>
              {canEdit && (
                <Tabs.Trigger
                  value="terminal"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white data-[selected]:bg-brand data-[selected]:text-ink"
                >
                  <TerminalSquare className="size-3.5" />
                  Terminal
                </Tabs.Trigger>
              )}
            </Tabs.List>
          </Tabs.Root>
        </div>
      </header>

      <div className={tab === "chat" ? "flex min-h-0 flex-1" : "hidden"}>
        <Chat
          directory={directory}
          sessions={sessions}
          activeId={activeId}
          initialMessages={initialMessages}
          initialBusy={initialBusy}
          serverUp={serverUp}
          canEdit={canEdit}
        />
      </div>
      <div className={tab === "preview" ? "flex min-h-0 flex-1" : "hidden"}>
        <Preview directory={directory} canEdit={canEdit} />
      </div>
      {canEdit && (
        <div className={tab === "terminal" ? "flex min-h-0 flex-1" : "hidden"}>
          <Terminal directory={directory} serverUp={serverUp} appName={appName} />
        </div>
      )}
    </div>
  );
}
