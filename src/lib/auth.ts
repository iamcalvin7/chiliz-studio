import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");

export const SESSION_COOKIE = "chiliz_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: number;
}

interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

async function readUsers(): Promise<User[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const data = JSON.parse(raw) as { users?: User[] };
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify({ users }, null, 2));
}

async function readSessions(): Promise<SessionRecord[]> {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf8");
    const data = JSON.parse(raw) as { sessions?: SessionRecord[] };
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch {
    return [];
  }
}

async function writeSessions(sessions: SessionRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
  await fs.writeFile(SESSIONS_FILE, JSON.stringify({ sessions }, null, 2));
}

export async function countUsers(): Promise<number> {
  return (await readUsers()).length;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((user) => user.email === normalized) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((user) => user.id === id) ?? null;
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
}

export async function createUser(
  input: SignupInput,
): Promise<{ user: User | null; error: string | null }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { user: null, error: "enter a valid email address" };
  }
  if (input.password.length < 8) {
    return { user: null, error: "password must be at least 8 characters" };
  }
  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    return { user: null, error: "an account with this email already exists" };
  }
  const user: User = {
    id: `u_${randomBytes(8).toString("hex")}`,
    email,
    name: name || email.split("@")[0],
    passwordHash: hashPassword(input.password),
    isAdmin: users.length === 0,
    createdAt: Date.now(),
  };
  users.push(user);
  await writeUsers(users);
  return { user, error: null };
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const sessions = await readSessions();
  const now = Date.now();
  sessions.push({
    token,
    userId,
    expiresAt: now + SESSION_TTL_MS,
  });
  await writeSessions(sessions.filter((session) => session.expiresAt > now));
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const sessions = (await readSessions()).filter(
    (session) => session.token !== token,
  );
  await writeSessions(sessions);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sessions = await readSessions();
  const session = sessions.find(
    (entry) => entry.token === token && entry.expiresAt > Date.now(),
  );
  if (!session) return null;
  return findUserById(session.userId);
}

export async function getOwnerNames(): Promise<Map<string, string>> {
  const users = await readUsers();
  return new Map(users.map((user) => [user.id, user.name]));
}
