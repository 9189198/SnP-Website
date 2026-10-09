import { defineMiddleware } from 'astro:middleware';
import { getUserFromCookies, isAdmin } from './lib/auth';

const ADMIN_PAGES = ['/admin'];
const ADMIN_API_PREFIXES = ['/api/admin'];
const MENU_API = '/api/menu';

function jsonError(status: number, message: string, errors?: Record<string, string>) {
  return new Response(JSON.stringify({ ok: false, error: message, errors: errors ?? {} }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals } = context;
  locals.user = getUserFromCookies(cookies);

  const path = url.pathname;
  const isAdminPage = ADMIN_PAGES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const isAdminApi = ADMIN_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const isMenuApi = path === MENU_API || path.startsWith(`${MENU_API}/`);

  if (isAdminPage || isAdminApi || (isMenuApi && context.request.method !== 'GET')) {
    if (!locals.user) {
      if (isAdminPage) {
        const next_ = encodeURIComponent(path + url.search);
        return context.redirect(`/login?next=${next_}`, 302);
      }
      return jsonError(401, 'You must be signed in.');
    }
    if (!isAdmin(locals.user)) {
      if (isAdminPage) return context.redirect('/', 302);
      return jsonError(403, 'Administrator access required.');
    }
  }

  return next();
});
