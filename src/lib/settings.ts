import { promises as fs } from "node:fs";
import path from "node:path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export interface CommunitySettings {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  rawBase?: string;
  apiBase?: string;
}

export interface Settings {
  community?: CommunitySettings;
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

export async function getCommunitySettings(): Promise<CommunitySettings | null> {
  const settings = await getSettings();
  const community = settings.community;
  if (!community?.owner || !community?.repo) return null;
  return {
    owner: community.owner,
    repo: community.repo,
    branch: community.branch || "main",
    token: community.token || undefined,
    rawBase: community.rawBase || undefined,
    apiBase: community.apiBase || undefined,
  };
}

export interface CommunitySettingsView {
  configured: boolean;
  owner: string;
  repo: string;
  branch: string;
  tokenSet: boolean;
}

export async function getCommunitySettingsView(): Promise<CommunitySettingsView> {
  const community = await getCommunitySettings();
  if (!community) {
    return { configured: false, owner: "", repo: "", branch: "main", tokenSet: false };
  }
  return {
    configured: true,
    owner: community.owner,
    repo: community.repo,
    branch: community.branch,
    tokenSet: Boolean(community.token),
  };
}

const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

export async function saveCommunitySettings(
  input: Partial<CommunitySettings>,
): Promise<{ ok: true } | { error: string }> {
  const owner = (input.owner ?? "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  const repo = (input.repo ?? "").trim().replace(/\.git$/i, "");
  if (!OWNER_REPO.test(`${owner}/${repo}`)) {
    return { error: "owner and repo are required (like calvin/chiliz-community)" };
  }
  const branch = (input.branch ?? "main").trim() || "main";
  const token = typeof input.token === "string" ? input.token.trim() : undefined;
  const next = await getCommunitySettings();
  const updated: CommunitySettings = {
    owner,
    repo,
    branch,
    token: token === undefined ? next?.token : token || undefined,
    rawBase: next?.rawBase,
    apiBase: next?.apiBase,
  };
  const settings = await getSettings();
  settings.community = updated;
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return { ok: true };
}
