import { BRANDS } from './db';
import { parsePrice, type FieldErrors } from './validation';

export function jsonOk(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify({ ok: true, ...(data as object) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export function jsonError(status: number, error: string, errors: FieldErrors = {}) {
  return new Response(JSON.stringify({ ok: false, error, errors }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ItemPayload {
  brand: string;
  category: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  /** Which fields the client actually submitted (partial updates). */
  provided: {
    brand: boolean;
    category: boolean;
    name: boolean;
    description: boolean;
    price: boolean;
    is_available: boolean;
  };
  file: File | null;
  /** Explicit image URL, used when editing without picking a new file. */
  imageUrl: string | null;
  /** True when the admin asked to remove the current picture. */
  clearImage: boolean;
}

type Raw = Record<string, unknown>;

function toBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === '1' || value === 'on' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === '' || value === 0) return false;
  return null;
}

/**
 * Reads a menu item from either a JSON body or a multipart form (used for
 * image uploads) and validates every field.
 */
export async function readItemPayload(
  request: Request,
  options: { partial?: boolean } = {},
): Promise<{ payload: ItemPayload | null; errors: FieldErrors; status: number }> {
  const errors: FieldErrors = {};
  const partial = options.partial ?? false;
  let raw: Raw = {};
  let file: File | null = null;

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    raw = {};
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        // An untouched <input type="file"> still submits an empty File entry.
        if (key === 'image' && value.size > 0) file = value;
        continue;
      }
      raw[key] = value;
    }
  } else {
    try {
      raw = (await request.json()) as Raw;
    } catch {
      return { payload: null, errors: { form: 'Could not read the submitted data.' }, status: 400 };
    }
  }

  const brand = typeof raw.brand === 'string' ? raw.brand.trim().toLowerCase() : '';
  const category = typeof raw.category === 'string' ? raw.category.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const imageUrl = typeof raw.image_url === 'string' ? raw.image_url.trim() : null;
  const clearImage = toBoolean(raw.clear_image) === true;
  const isAvailableRaw = raw.is_available;

  // In partial mode a field that was not submitted at all must be left untouched.
  const has = (field: string) => Object.prototype.hasOwnProperty.call(raw, field);
  const provided = {
    brand: has('brand'),
    category: has('category'),
    name: has('name'),
    description: has('description'),
    price: has('price'),
    is_available: has('is_available'),
  };

  if (!partial || provided.brand) {
    if (!brand) errors.brand = 'Choose a menu.';
    else if (!(BRANDS as string[]).includes(brand)) errors.brand = 'Choose a valid menu.';
  }

  if (!partial || provided.category) {
    if (!category) errors.category = 'Enter the item type / category.';
    else if (category.length > 80) errors.category = 'Category name is too long.';
  }

  if (!partial || provided.name) {
    if (!name) errors.name = 'Enter the item name.';
    else if (name.length > 120) errors.name = 'Item name is too long.';
  }

  if (description.length > 1000) errors.description = 'Description is too long.';

  let price: number | null = null;
  if (!partial || provided.price) {
    price = parsePrice(raw.price);
    if (price === null) errors.price = 'Enter a valid price.';
    else if (price < 0) errors.price = 'Price cannot be negative.';
    else if (price > 1_000_000) errors.price = 'Price is too large.';
  }

  let isAvailable = true;
  if (provided.is_available) {
    const parsed = toBoolean(isAvailableRaw);
    if (parsed === null) errors.is_available = 'Invalid availability value.';
    else isAvailable = parsed;
  }

  if (Object.keys(errors).length > 0) {
    return { payload: null, errors, status: 400 };
  }

  return {
    payload: {
      brand,
      category,
      name,
      description,
      price: price ?? 0,
      isAvailable,
      provided,
      file,
      imageUrl,
      clearImage,
    },
    errors,
    status: 200,
  };
}
