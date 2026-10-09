import type { APIRoute } from 'astro';
import { isBrand } from '../../../lib/db';
import { jsonError, jsonOk, readItemPayload } from '../../../lib/http';
import { createMenuItem, getMenu, listAllCategories, listCategories, listMenuItems } from '../../../lib/menu';
import { saveUploadedImage, UploadError } from '../../../lib/uploads';

export const prerender = false;

/** GET /api/menu?brand=cafe&category=Main%20Course */
export const GET: APIRoute = async ({ url, locals }) => {
  const brandParam = (url.searchParams.get('brand') || 'cafe').toLowerCase();
  if (!isBrand(brandParam)) {
    return jsonError(400, 'Unknown menu. Use "cafe" or "indulge".');
  }

  const categoryParam = url.searchParams.get('category');
  const category = categoryParam && categoryParam.trim() !== '' && categoryParam !== 'all' ? categoryParam.trim() : null;
  const includeUnavailable = locals.user?.role === 'admin' && url.searchParams.get('includeUnavailable') === '1';

  if (url.searchParams.get('view') === 'categories') {
    return jsonOk({
      brand: brandParam,
      categories: listCategories(brandParam, includeUnavailable),
      allCategories: listAllCategories(brandParam),
      items: [],
    });
  }

  const menu = getMenu(brandParam, category, includeUnavailable);
  return jsonOk({ ...menu, allCategories: listAllCategories(brandParam) });
};

/** POST /api/menu — creates a new item (admin only, enforced by middleware). */
export const POST: APIRoute = async ({ request }) => {
  const { payload, errors, status } = await readItemPayload(request);
  if (!payload) return jsonError(status, 'Please fix the highlighted fields.', errors);

  try {
    let imageUrl: string | null = null;
    if (payload.file) {
      imageUrl = await saveUploadedImage(payload.file);
    } else if (payload.imageUrl) {
      imageUrl = payload.imageUrl;
    }

    const item = createMenuItem({
      brand: payload.brand,
      category: payload.category,
      name: payload.name,
      description: payload.description,
      price: payload.price,
      image_url: imageUrl,
      is_available: payload.isAvailable,
    });

    return jsonOk({ item, items: listMenuItems({ brand: item.brand as 'cafe' | 'indulge' }) });
  } catch (error) {
    if (error instanceof UploadError) return jsonError(400, error.message, { image: error.message });
    console.error('[menu] create failed', error);
    return jsonError(500, 'Could not save the menu item.');
  }
};
