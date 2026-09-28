import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  countUsers,
  createSession,
  createUser,
} from "@/lib/auth";
import { findUsableInvite, redeemInvite } from "@/lib/invites";
import { seedProjectsForUser } from "@/lib/projects";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      code?: string;
    };
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }
    const before = await countUsers();
    let pendingInviteCode: string | null = null;
    if (before > 0) {
      const invite = await findUsableInvite(body.code ?? "");
      if (!invite) {
        return NextResponse.json(
          { error: "a valid invite code is required" },
          { status: 403 },
        );
      }
      pendingInviteCode = invite.code;
    }
    const { user, error } = await createUser({
      email: body.email,
      name: body.name ?? "",
      password: body.password,
    });
    if (!user) {
      return NextResponse.json({ error }, { status: 400 });
    }
    if (pendingInviteCode) {
      await redeemInvite(pendingInviteCode, user.id).catch(() => {});
    }
    if (before === 0) {
      await seedProjectsForUser(user.id);
    }
    const token = await createSession(user.id);
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "failed to sign up" }, { status: 500 });
  }
}
