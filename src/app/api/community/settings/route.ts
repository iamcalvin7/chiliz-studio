import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getCommunitySettingsView,
  saveCommunitySettings,
} from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  return NextResponse.json({ settings: await getCommunitySettingsView() });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "only the admin can change community settings" },
      { status: 403 },
    );
  }
  try {
    const body = (await request.json()) as {
      owner?: string;
      repo?: string;
      branch?: string;
      token?: string;
    };
    const result = await saveCommunitySettings(body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      settings: await getCommunitySettingsView(),
    });
  } catch {
    return NextResponse.json(
      { error: "failed to save settings" },
      { status: 500 },
    );
  }
}
