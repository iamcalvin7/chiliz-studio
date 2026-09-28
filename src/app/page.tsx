import {
  ArrowUpRight,
  FlaskConical,
  GitBranch,
  MessagesSquare,
  Pencil,
  ServerOff,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser, getOwnerNames } from "@/lib/auth";
import { readBranding } from "@/lib/branding.server";
import { brandingIcon } from "@/lib/branding-icons";
import { fetchDirectory } from "@/lib/community";
import { getCommunitySettingsView } from "@/lib/settings";
import { isServerUp, listSessions } from "@/lib/opencode";
import {
  enrichProjects,
  listProjectRecords,
} from "@/lib/projects";
import { TimeAgo } from "@/components/time-ago";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { BrandingDialog } from "@/components/branding-dialog";
import { CommunitySettingsDialog } from "@/components/community-settings-dialog";
import { CommunityCard } from "@/components/community-card";
import { InviteDialog } from "@/components/invite-dialog";
import { UserChip } from "@/components/user-chip";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const branding = await readBranding();
  const BrandIcon = brandingIcon(branding.icon);

  const up = await isServerUp();
  const sessionCounts = new Map<string, { count: number; lastAt: number }>();
  let totalSessions = 0;

  if (up) {
    try {
      const sessions = await listSessions();
      totalSessions = sessions.length;
      for (const session of sessions) {
        const current = sessionCounts.get(session.directory) ?? {
          count: 0,
          lastAt: 0,
        };
        sessionCounts.set(session.directory, {
          count: current.count + 1,
          lastAt: Math.max(current.lastAt, session.updatedAt),
        });
      }
    } catch {
      totalSessions = 0;
    }
  }

  const projects = await enrichProjects(
    await listProjectRecords(),
    sessionCounts,
  );
  const ownerNames = await getOwnerNames();
  const mine = projects.filter((project) => project.ownerId === user.id);
  const communitySettings = await getCommunitySettingsView();
  const directory = await fetchDirectory();

  function renderCards(items: typeof projects) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <a
            key={project.path}
            href={`/project?p=${encodeURIComponent(project.path)}`}
            className="group flex flex-col gap-3 rounded-2xl border border-edge bg-panel p-5 transition-colors hover:border-brand/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-white group-hover:text-brand">
                {project.name}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-zinc-600 transition-colors group-hover:text-brand" />
            </div>
            <p className="truncate font-mono text-xs text-zinc-500">
              {project.path}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-edge/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                >
                  {tech}
                </span>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {project.isGit && (
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="size-3" />
                  {project.branch}
                </span>
              )}
              {project.dirty > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Pencil className="size-3" />
                  {project.dirty} modified
                </span>
              )}
              {project.sessions > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessagesSquare className="size-3" />
                  {project.sessions}{" "}
                  {project.sessions === 1 ? "chat" : "chats"}
                </span>
              )}
                  {project.lastCommitAt && (
                    <span className="text-zinc-600">
                      <TimeAgo at={project.lastCommitAt} />
                    </span>
                  )}
            </div>
            <div className="flex items-center gap-1.5 border-t border-edge pt-3 text-xs text-zinc-500">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-edge text-[9px] font-bold text-zinc-300">
                {(ownerNames.get(project.ownerId) ?? "?")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span className="truncate">
                {ownerNames.get(project.ownerId) ?? "Unknown builder"}
              </span>
            </div>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-edge">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-ink">
              <BrandIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{branding.name}</p>
              <p className="text-xs text-zinc-500">{branding.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs">
              {up ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="text-zinc-300">Agent online</span>
                </>
              ) : (
                <>
                  <ServerOff className="size-3.5 text-amber-400" />
                  <span className="text-amber-300">Agent offline</span>
                </>
              )}
            </span>
            <UserChip name={user.name} email={user.email} />
            {user.isAdmin && <CommunitySettingsDialog />}
            <BrandingDialog branding={branding} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section className="flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Welcome back<span className="text-brand">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-lg text-zinc-400">
              Chat with the Chiliz agent, start new projects and follow what the
              community is building — all from your browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user.isAdmin && <InviteDialog />}
            <NewProjectDialog />
          </div>
        </section>

        {!up && (
          <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <ServerOff className="mt-0.5 size-4 shrink-0" />
            <p>
              The agent server is not running, so chat is disabled. Start it
              with{" "}
              <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">
                ~/chiliz-studio/scripts/opencode-server.sh
              </code>{" "}
              and refresh this page.
            </p>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
            <span className="font-semibold text-white">{projects.length}</span>{" "}
            projects
          </span>
          <span className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
            <span className="font-semibold text-white">{totalSessions}</span>{" "}
            chats
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3.5 py-1.5 text-zinc-300">
            <Users className="size-3.5" />
            <span className="font-semibold text-white">
              {ownerNames.size}
            </span>{" "}
            builders
          </span>
        </div>

        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              My projects
            </h2>
            {mine.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge py-16 text-center">
                <FlaskConical className="size-8 text-zinc-600" />
                <p className="font-medium text-white">No projects yet</p>
                <p className="max-w-sm text-sm text-zinc-500">
                  Create your first project and the agent will help you build
                  it from scratch.
                </p>
                <NewProjectDialog />
              </div>
            ) : (
              renderCards(mine)
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Community directory
              </h2>
              {communitySettings.configured && (
                <span className="truncate font-mono text-xs text-zinc-600">
                  {communitySettings.owner}/{communitySettings.repo}
                </span>
              )}
            </div>
            {!communitySettings.configured ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge py-12 text-center">
                <Users className="size-6 text-zinc-600" />
                <p className="font-medium text-white">Directory not connected</p>
                <p className="max-w-md text-sm text-zinc-500">
                  Point the studio at a shared GitHub repository and builders
                  on any machine can publish their projects here, browse and
                  import each other&apos;s work.
                </p>
                {user.isAdmin && <CommunitySettingsDialog />}
              </div>
            ) : directory.error ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                {directory.error}
              </div>
            ) : directory.projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-edge py-12 text-center text-sm text-zinc-500">
                Nothing has been published yet. Open one of your projects and
                hit Publish to share it here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {directory.projects.map((project) => (
                  <CommunityCard
                    key={project.slug}
                    slug={project.slug}
                    name={project.name}
                    description={project.description}
                    stack={project.stack}
                    owner={project.owner}
                    repo={project.repo}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
