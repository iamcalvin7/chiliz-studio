import { cookies } from "next/headers";
import { OC_BASE } from "@/lib/opencode";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { getProjectByPath } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser();
  if (!token || !user) {
    return new Response("not signed in", { status: 401 });
  }
  const url = new URL(request.url);
  const directory = url.searchParams.get("directory") ?? "";
  if (!directory || !(await getProjectByPath(directory))) {
    return new Response("project not registered", { status: 404 });
  }
  const sessionID = url.searchParams.get("sessionID");

  let upstream: Response;
  try {
    upstream = await fetch(
      `${OC_BASE}/event?directory=${encodeURIComponent(directory)}`,
      {
        headers: { accept: "text/event-stream" },
        cache: "no-store",
        signal: request.signal,
      },
    );
  } catch {
    return new Response("opencode server unreachable", { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("opencode server unreachable", { status: 503 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            const dataLine = frame
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload) continue;
            try {
              const event = JSON.parse(payload) as {
                properties?: { sessionID?: string };
              };
              const eventSession = event.properties?.sessionID;
              if (sessionID && eventSession && eventSession !== sessionID) {
                continue;
              }
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } catch {
              continue;
            }
          }
        }
      } catch {
        // stream cancelled or upstream closed
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      void reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
