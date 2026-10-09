import type { APIRoute } from 'astro';
import { isBrand } from '../../../lib/db';
import { jsonError, jsonOk, readItemPayload } from '../../../lib/http';
import { deleteMenuItem, getMenuItem, listMenuItems, updateMenuItem } from '../../../lib/menu';
import { removeUploadedImage, saveUploadedImage, UploadError } from '../../../lib/uploads';

export const prerender = false;

function readId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/menu/:id */
export const GET: APIRoute = async ({ params }) => {
  const id = readId(params.id);
  if (!id) return jsonError(400, 'Invalid menu item id.');
  const item = getMenuItem(id);
  if (!item) return jsonError(404, 'Menu item not found.');
  return jsonOk({ item });
};

/** PATCH /api/menu/:id — updates the existing record in place. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = readId(params.id);
  if (!id) return jsonError(400, 'Invalid menu item id.');
  if (!getMenuItem(id)) return jsonError(404, 'Menu item not found.');

  const { payload, errors, status } = await readItemPayload(request, { partial: true });
  if (!payload) return jsonError(status, 'Please fix the highlighted fields.', errors);

  const previous = getMenuItem(id)!;
  const patch: Parameters<typeof updateMenuItem>[1] = {};

  if (payload.provided.brand) {
    if (!isBrand(payload.brand)) return jsonError(400, 'Unknown menu.', { brand: 'Choose a valid menu.' });
    patch.brand = payload.brand;
  }
  if (payload.provided.category) patch.category = payload.category;
  if (payload.provided.name) patch.name = payload.name;
  if (payload.provided.description) patch.description = payload.description;
  if (payload.provided.price) patch.price = payload.price;
  if (payload.provided.is_available) patch.is_available = payload.isAvailable;

  try {
    if (payload.file) {
      patch.image_url = await saveUploadedImage(payload.file);
    } else if (payload.clearImage) {
      patch.image_url = null;
    } else if (payload.imageUrl) {
      patch.image_url = payload.imageUrl;
    }

    const item = updateMenuItem(id, patch);
    if (!item) return jsonError(404, 'Menu item not found.');

    // Drop the old upload once the new picture is safely stored.
    if (patch.image_url !== undefined && patch.image_url !== previous.image_url) {
      removeUploadedImage(previous.image_url);
    }

    return jsonOk({ item });
  } catch (error) {
    if (error instanceof UploadError) return jsonError(400, error.message, { image: error.message });
    console.error('[menu] update failed', error);
    return jsonError(500, 'Could not update the menu item.');
  }
};

export const PUT = PATCH;

/** DELETE /api/menu/:id — removes the record and its uploaded picture. */
export const DELETE: APIRoute = async ({ params }) => {
  const id = readId(params.id);
  if (!id) return jsonError(400, 'Invalid menu item id.');

  const removed = deleteMenuItem(id);
  if (!removed) return jsonError(404, 'Menu item not found.');

  removeUploadedImage(removed.image_url);

  const brand = isBrand(removed.brand) ? removed.brand : 'cafe';
  return jsonOk({ deleted: removed.id, items: listMenuItems({ brand }) });
};
