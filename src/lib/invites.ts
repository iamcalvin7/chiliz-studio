import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const INVITES_FILE = path.join(process.cwd(), "data", "invites.json");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Invite {
  code: string;
  createdBy: string;
  createdAt: number;
  usedBy: string | null;
  usedAt: number | null;
  revoked: boolean;
}

function generateCode(): string {
  const bytes = randomBytes(12);
  let raw = "";
  for (let i = 0; i < 12; i++) {
    raw += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `CHILIZ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function readInvites(): Promise<Invite[]> {
  try {
    const raw = await fs.readFile(INVITES_FILE, "utf8");
    const data = JSON.parse(raw) as { invites?: Invite[] };
    return Array.isArray(data.invites) ? data.invites : [];
  } catch {
    return [];
  }
}

async function writeInvites(invites: Invite[]): Promise<void> {
  await fs.mkdir(path.dirname(INVITES_FILE), { recursive: true });
  await fs.writeFile(
    INVITES_FILE,
    JSON.stringify({ invites }, null, 2),
  );
}

export async function listInvites(): Promise<Invite[]> {
  return (await readInvites()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createInvite(createdBy: string): Promise<Invite> {
  const invites = await readInvites();
  const invite: Invite = {
    code: generateCode(),
    createdBy,
    createdAt: Date.now(),
    usedBy: null,
    usedAt: null,
    revoked: false,
  };
  invites.push(invite);
  await writeInvites(invites);
  return invite;
}

export async function findUsableInvite(code: string): Promise<Invite | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const invites = await readInvites();
  return (
    invites.find(
      (invite) =>
        invite.code === normalized && !invite.revoked && !invite.usedBy,
    ) ?? null
  );
}

export async function redeemInvite(
  code: string,
  userId: string,
): Promise<boolean> {
  const invites = await readInvites();
  const normalized = normalizeCode(code);
  const invite = invites.find((entry) => entry.code === normalized);
  if (!invite || invite.revoked || invite.usedBy) return false;
  invite.usedBy = userId;
  invite.usedAt = Date.now();
  await writeInvites(invites);
  return true;
}

export async function revokeInvite(code: string): Promise<boolean> {
  const invites = await readInvites();
  const normalized = normalizeCode(code);
  const invite = invites.find((entry) => entry.code === normalized);
  if (!invite || invite.usedBy) return false;
  invite.revoked = true;
  await writeInvites(invites);
  return true;
}
