import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites";
import { findUserById } from "@/lib/auth";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "not signed in" }, { status: 401 }) };
  }
  if (!user.isAdmin) {
    return { error: NextResponse.json({ error: "admin only" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const invites = await listInvites();
  const owners = await Promise.all(
    invites.map(async (invite) => {
      const user = invite.usedBy ? await findUserById(invite.usedBy) : null;
      return { ...invite, usedByEmail: user?.email ?? null };
    }),
  );
  return NextResponse.json({ invites: owners });
}

export async function POST() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const invite = await createInvite(guard.user.id);
  return NextResponse.json({ invite });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    const body = (await request.json()) as { code?: string };
    if (!body.code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
    const ok = await revokeInvite(body.code);
    if (!ok) {
      return NextResponse.json(
        { error: "invite not found or already used" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "failed to revoke invite" },
      { status: 500 },
    );
  }
}
