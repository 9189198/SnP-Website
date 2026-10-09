import { randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { getDb, toUser, type Role, type UserRow } from './db';
import { hashPassword } from './password';

export const SESSION_COOKIE = 'esp_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): (UserRow & { password_hash: string }) | null {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
  return (row as Record<string, unknown> | undefined)
    ? { ...toUser(row as Record<string, unknown>), password_hash: String((row as Record<string, unknown>).password_hash) }
    : null;
}

export function findUserById(id: number): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? toUser(row as Record<string, unknown>) : null;
}

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}): UserRow {
  const email = normalizeEmail(input.email);
  const result = getDb()
    .prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(email, input.name.trim() || email.split('@')[0], hashPassword(input.password), input.role ?? 'customer');
  const created = findUserById(Number(result.lastInsertRowid));
  if (!created) throw new Error('Could not create the account.');
  return created;
}

export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  getDb()
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

export function purgeExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

export function getSessionToken(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE)?.value;
}

export function setSessionCookie(cookies: AstroCookies, token: string, expiresAt: Date) {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: import.meta.env.PROD,
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Resolves the currently signed-in user (if any) from the session cookie. */
export function getUserFromCookies(cookies: AstroCookies): UserRow | null {
  const token = getSessionToken(cookies);
  if (!token) return null;

  const row = getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(token) as Record<string, unknown> | undefined;

  if (!row) return null;

  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    destroySession(token);
    clearSessionCookie(cookies);
    return null;
  }

  return toUser(row);
}

export function isAdmin(user: UserRow | null | undefined): boolean {
  return user?.role === 'admin';
}
