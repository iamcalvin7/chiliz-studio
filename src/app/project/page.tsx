import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSessionUser, getOwnerNames } from "@/lib/auth";
import { readBranding } from "@/lib/branding.server";
import { isServerUp, listMessages, listPendingQuestions, listSessions } from "@/lib/opencode";
import type { PendingQuestion } from "@/lib/opencode";
import { getProjectByPath } from "@/lib/projects";
import { ProjectView } from "@/components/project-view";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  if (!p) {
    redirect("/");
  }

  const project = await getProjectByPath(p);
  if (!project) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <ShieldAlert className="size-10 text-zinc-600" />
          <p className="font-semibold text-white">Project not available</p>
          <p className="break-all font-mono text-xs text-zinc-500">{p}</p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = project.ownerId === user.id;
  const ownerNames = await getOwnerNames();
  const branding = await readBranding();

  const up = await isServerUp();
  let sessions = [] as Awaited<ReturnType<typeof listSessions>>;
  let activeId: string | null = null;
  let messages: Awaited<ReturnType<typeof listMessages>>["messages"] = [];
  let busy = false;
  let question: PendingQuestion | null = null;

  if (up) {
    try {
      sessions = await listSessions(p);
      const latest = sessions[0];
      if (latest) {
        activeId = latest.id;
        const result = await listMessages(latest.id, p);
        messages = result.messages;
        busy = result.busy;
        question = (await listPendingQuestions(p, latest.id))[0] ?? null;
      }
    } catch {
      sessions = [];
    }
  }

  return (
    <ProjectView
      directory={p}
      projectName={path.basename(p)}
      ownerName={ownerNames.get(project.ownerId) ?? "Unknown builder"}
      canEdit={canEdit}
      appName={branding.name}
      sessions={sessions}
      activeId={activeId}
      initialMessages={messages}
      initialBusy={busy}
      initialQuestion={question}
      serverUp={up}
    />
  );
}
