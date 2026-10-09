import type { APIRoute } from 'astro';
import { createSession, findUserByEmail, setSessionCookie } from '../../../lib/auth';
import { jsonError, jsonOk } from '../../../lib/http';
import { verifyPassword } from '../../../lib/password';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Could not read the submitted data.');
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return jsonError(400, 'Enter your email address and password.', {
      ...(email ? {} : { email: 'Email address is required.' }),
      ...(password ? {} : { password: 'Password is required.' }),
    });
  }

  const user = findUserByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return jsonError(401, 'Incorrect email or password.', {
      password: 'Incorrect email or password.',
    });
  }

  const session = createSession(user.id);
  setSessionCookie(cookies, session.token, session.expiresAt);
  const { password_hash: _ignored, ...safeUser } = user;
  return jsonOk({ user: safeUser });
};
