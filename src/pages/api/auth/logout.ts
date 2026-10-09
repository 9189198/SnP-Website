import type { APIRoute } from 'astro';
import { clearSessionCookie, destroySession, getSessionToken } from '../../../lib/auth';
import { jsonOk } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  destroySession(getSessionToken(cookies));
  clearSessionCookie(cookies);
  return jsonOk({ loggedOut: true });
};
