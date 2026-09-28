export const OC_BASE = process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4097";

const DEFAULT_MODEL = { providerID: "builder-ai", modelID: "builder-auto" };

export interface OcSession {
  id: string;
  title: string;
  directory: string;
  updatedAt: number;
  createdAt: number;
}

export interface UiPart {
  kind: "text" | "tool" | "reasoning";
  pid?: string;
  text?: string;
  label?: string;
  status?: string;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  parts: UiPart[];
  createdAt: number;
}

async function ocFetch(
  pathname: string,
  params: Record<string, string> = {},
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(pathname, OC_BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function isServerUp(): Promise<boolean> {
  try {
    const res = await ocFetch("/global/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function listSessions(directory?: string): Promise<OcSession[]> {
  const res = await ocFetch(
    "/session",
    directory ? { directory } : {},
  );
  if (!res.ok) throw new Error("opencode server unreachable");
  const data: unknown = await res.json();
  const sessions = Array.isArray(data) ? data : [];
  return sessions
    .map((raw) => {
      const s = raw as Record<string, unknown>;
      const time = (s.time ?? {}) as Record<string, unknown>;
      return {
        id: text(s.id),
        title: text(s.title) || "New session",
        directory: text(s.directory),
        createdAt: num(time.created),
        updatedAt: num(time.updated),
      };
    })
    .filter((s) => s.id && (!directory || s.directory === directory))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSession(
  directory: string,
  title?: string,
): Promise<OcSession> {
  const res = await ocFetch(
    "/session",
    { directory },
    { method: "POST", body: JSON.stringify({ title: title ?? "New session" }) },
  );
  if (!res.ok) throw new Error("failed to create session");
  const data = (await res.json()) as Record<string, unknown>;
  const time = (data.time ?? {}) as Record<string, unknown>;
  return {
    id: text(data.id),
    title: text(data.title) || "New session",
    directory,
    createdAt: num(time.created),
    updatedAt: num(time.updated),
  };
}

export async function renameSession(
  sessionID: string,
  directory: string,
  title: string,
): Promise<OcSession> {
  const res = await ocFetch(
    `/session/${sessionID}`,
    { directory },
    { method: "PATCH", body: JSON.stringify({ title }) },
  );
  if (!res.ok) throw new Error("failed to rename session");
  const data = (await res.json()) as Record<string, unknown>;
  const time = (data.time ?? {}) as Record<string, unknown>;
  return {
    id: text(data.id),
    title: text(data.title) || "New session",
    directory: text(data.directory) || directory,
    createdAt: num(time.created),
    updatedAt: num(time.updated),
  };
}

export async function sendPrompt(
  sessionID: string,
  directory: string,
  prompt: string,
): Promise<void> {
  const res = await ocFetch(
    `/session/${sessionID}/prompt_async`,
    { directory },
    {
      method: "POST",
      body: JSON.stringify({
        parts: [{ type: "text", text: prompt }],
        model: DEFAULT_MODEL,
      }),
    },
  );
  if (!res.ok) throw new Error("failed to send prompt");
}

export async function abortSession(
  sessionID: string,
  directory: string,
): Promise<void> {
  await ocFetch(
    `/session/${sessionID}/abort`,
    { directory },
    { method: "POST" },
  );
}

export function toolLabel(tool: string, input: Record<string, unknown>): string {
  const candidates = [
    "command",
    "filePath",
    "path",
    "pattern",
    "query",
    "url",
    "description",
  ];
  for (const key of candidates) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return `${tool}: ${value.trim().slice(0, 90)}`;
    }
  }
  return tool;
}

export function convertRawPart(
  part: Record<string, unknown>,
): UiPart | null {
  const type = text(part.type);
  const pid = text(part.id);
  if (type === "text" && text(part.text)) {
    return { kind: "text", pid, text: text(part.text) };
  }
  if (type === "reasoning" && text(part.text)) {
    return { kind: "reasoning", pid, text: text(part.text) };
  }
  if (type === "tool") {
    const state = (part.state ?? {}) as Record<string, unknown>;
    const input = (state.input ?? {}) as Record<string, unknown>;
    return {
      kind: "tool",
      pid,
      label: toolLabel(text(part.tool), input),
      status: text(state.status) || "pending",
    };
  }
  return null;
}

export async function listMessages(
  sessionID: string,
  directory: string,
): Promise<{ messages: UiMessage[]; busy: boolean }> {
  const res = await ocFetch(`/session/${sessionID}/message`, {
    directory,
    limit: "200",
  });
  if (!res.ok) throw new Error("opencode server unreachable");
  const data: unknown = await res.json();
  const entries = Array.isArray(data) ? data : [];

  const messages: UiMessage[] = entries.map((entry) => {
    const wrapper = entry as Record<string, unknown>;
    const info = (wrapper.info ?? wrapper) as Record<string, unknown>;
    const rawParts = Array.isArray(wrapper.parts) ? wrapper.parts : [];
    const role = info.role === "user" ? "user" : "assistant";
    const time = (info.time ?? {}) as Record<string, unknown>;
    const parts: UiPart[] = [];

    for (const raw of rawParts) {
      const converted = convertRawPart(raw as Record<string, unknown>);
      if (converted) parts.push(converted);
    }

    return {
      id: text(info.id),
      role,
      parts,
      createdAt: num(time.created),
    };
  });

  const last = messages[messages.length - 1];
  const runningTool = last?.parts.some(
    (part) => part.kind === "tool" && part.status === "running",
  );
  const hasVisible = last?.parts.some(
    (part) => part.kind === "text" || part.kind === "tool",
  );
  const busy = Boolean(
    last &&
      (last.role === "user" || runningTool || !hasVisible),
  );

  return { messages, busy };
}
