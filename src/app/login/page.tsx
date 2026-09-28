import { redirect } from "next/navigation";
import { countUsers, getSessionUser } from "@/lib/auth";
import { readBranding } from "@/lib/branding.server";
import { brandingIcon } from "@/lib/branding-icons";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }
  const branding = await readBranding();
  const BrandIcon = brandingIcon(branding.icon);
  const needsInvite = (await countUsers()) > 0;

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-ink">
            <BrandIcon className="size-6" />
          </span>
          <h1 className="text-2xl font-bold text-white">{branding.name}</h1>
          <p className="text-sm text-zinc-400">
            Sign in to browse projects, chat with the agent and build with the
            community.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-edge bg-panel p-6">
          <LoginForm needsInvite={needsInvite} />
        </div>
      </div>
    </div>
  );
}
