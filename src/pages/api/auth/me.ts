import type { APIRoute } from 'astro';
import { jsonOk } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  return jsonOk({ user: locals.user });
};
