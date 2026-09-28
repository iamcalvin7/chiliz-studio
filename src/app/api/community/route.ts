import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchDirectory } from "@/lib/community";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  const { projects, error } = await fetchDirectory(force);
  if (error === "not-configured") {
    return NextResponse.json({ configured: false, projects: [] });
  }
  return NextResponse.json({ configured: true, projects, error });
}
