import type { APIRoute } from 'astro';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { contentTypeFor, resolveMediaPath } from '../../lib/uploads';

export const prerender = false;

/** Serves admin-uploaded menu pictures from the data folder. */
export const GET: APIRoute = async ({ params }) => {
  // URLs look like /media/uploads/<file>; the rest parameter keeps the sub folder.
  const raw = params.path || '';
  const fileName = raw.replace(/^uploads\//, '');

  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const target = resolveMediaPath(fileName);
  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const stats = statSync(target);
  return new Response(new Uint8Array(readFileSync(target)), {
    headers: {
      'Content-Type': contentTypeFor(fileName),
      'Content-Length': String(stats.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
