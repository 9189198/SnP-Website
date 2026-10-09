import type { APIRoute } from 'astro';
import { createSession, createUser, findUserByEmail, setSessionCookie } from '../../../lib/auth';
import { jsonError, jsonOk } from '../../../lib/http';
import { validateEmail, validateName, validatePassword, type FieldErrors } from '../../../lib/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: unknown; name?: unknown; password?: unknown; confirm_password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Could not read the submitted data.');
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const name = typeof body.name === 'string' && body.name.trim() !== '' ? body.name : email.split('@')[0] ?? '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirm_password === 'string' ? body.confirm_password : password;

  const failed: FieldErrors = {};
  const emailError = validateEmail(email);
  const nameError = validateName(name);
  const passwordError = validatePassword(password);
  if (emailError) failed.email = emailError;
  if (nameError) failed.name = nameError;
  if (passwordError) failed.password = passwordError;
  if (password !== confirm) failed.confirm_password = 'Passwords do not match.';

  if (Object.keys(failed).length > 0) {
    return jsonError(400, 'Please fix the highlighted fields.', failed);
  }

  if (findUserByEmail(email)) {
    return jsonError(409, 'An account with that email already exists.', {
      email: 'An account with that email already exists. Try logging in instead.',
    });
  }

  try {
    const user = createUser({ email, name, password });
    const session = createSession(user.id);
    setSessionCookie(cookies, session.token, session.expiresAt);
    return jsonOk({ user });
  } catch (error) {
    console.error('[auth] signup failed', error);
    return jsonError(500, 'Could not create the account. Please try again.');
  }
};
