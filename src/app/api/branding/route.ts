import { NextResponse } from "next/server";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { readBranding, saveBranding } from "@/lib/branding.server";

export async function GET() {
  return NextResponse.json({ branding: await readBranding() });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.reset === true) {
      const reset = await saveBranding({ ...DEFAULT_BRANDING });
      if ("error" in reset) {
        return NextResponse.json({ error: reset.error }, { status: 500 });
      }
      return NextResponse.json({ branding: reset.branding });
    }
    const saved = await saveBranding(body);
    if ("error" in saved) {
      return NextResponse.json({ error: saved.error }, { status: 400 });
    }
    return NextResponse.json({ branding: saved.branding });
  } catch {
    return NextResponse.json(
      { error: "failed to save branding" },
      { status: 500 },
    );
  }
}
