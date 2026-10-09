import { getDb, isBrand, type Brand, type MenuItemRow } from './db';

export interface MenuItem {
  id: number;
  brand: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  name: string;
  itemCount: number;
  image: string | null;
}

export interface MenuPayload {
  brand: Brand;
  categories: MenuCategory[];
  items: MenuItem[];
}

export function toMenuItem(row: MenuItemRow): MenuItem {
  return {
    ...row,
    price: Number(row.price),
    is_available: row.is_available === 1,
  };
}

/**
 * Single source of truth for menu reads. The customer pages and the admin
 * dashboard both go through here, so they can never drift apart.
 */
export function listMenuItems(options: { brand: Brand; category?: string | null; includeUnavailable?: boolean }): MenuItem[] {
  const params: unknown[] = [options.brand];
  let sql = 'SELECT * FROM menu_items WHERE brand = ?';

  if (options.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }
  if (!options.includeUnavailable) {
    sql += ' AND is_available = 1';
  }
  sql += ' ORDER BY sort_order ASC, name ASC';

  const rows = getDb().prepare(sql).all(...(params as never[])) as unknown as MenuItemRow[];
  return rows.map(toMenuItem);
}

export function getMenuItem(id: number): MenuItem | null {
  const row = getDb().prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as unknown as MenuItemRow | undefined;
  return row ? toMenuItem(row) : null;
}

export function listCategories(brand: Brand, includeUnavailable = false): MenuCategory[] {
  const availability = includeUnavailable ? '' : ' AND m.is_available = 1';
  const rows = getDb()
    .prepare(
      `SELECT m.category AS name,
              COUNT(*) AS itemCount,
              (SELECT i.image_url FROM menu_items i
                WHERE i.brand = m.brand
                  AND i.category = m.category
                  AND i.image_url IS NOT NULL
                  AND i.image_url <> ''
                ORDER BY i.sort_order ASC, i.id ASC
                LIMIT 1) AS image
       FROM menu_items m
       WHERE m.brand = ?${availability}
       GROUP BY m.category
       ORDER BY MIN(m.sort_order) ASC, name ASC`,
    )
    .all(brand) as unknown as Array<{ name: string; itemCount: number; image: string | null }>;

  return rows.map((row) => ({
    name: row.name,
    itemCount: Number(row.itemCount),
    image: row.image,
  }));
}

export function listAllCategories(brand: Brand): string[] {
  const rows = getDb()
    .prepare('SELECT DISTINCT category FROM menu_items WHERE brand = ? ORDER BY category ASC')
    .all(brand) as unknown as Array<{ category: string }>;
  return rows.map((row) => row.category);
}

export function getMenu(brand: Brand, category?: string | null, includeUnavailable = false): MenuPayload {
  return {
    brand,
    categories: listCategories(brand, includeUnavailable),
    items: listMenuItems({ brand, category, includeUnavailable }),
  };
}

export interface MenuItemInput {
  brand: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available?: boolean;
}

export function createMenuItem(input: MenuItemInput): MenuItem {
  if (!isBrand(input.brand)) throw new Error('Unknown menu.');

  const maxRow = getDb()
    .prepare('SELECT MAX(sort_order) AS max FROM menu_items WHERE brand = ?')
    .get(input.brand) as unknown as { max: number | null };
  const nextOrder = (maxRow.max ?? -1) + 1;

  const result = getDb()
    .prepare(
      `INSERT INTO menu_items (brand, category, name, description, price, image_url, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.brand,
      input.category,
      input.name,
      input.description,
      input.price,
      input.image_url,
      input.is_available === false ? 0 : 1,
      nextOrder,
    );

  const created = getMenuItem(Number(result.lastInsertRowid));
  if (!created) throw new Error('Could not save the menu item.');
  return created;
}

/** Updates the existing record in place — never creates a duplicate row. */
export function updateMenuItem(id: number, patch: Partial<MenuItemInput>): MenuItem | null {
  const current = getMenuItem(id);
  if (!current) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.brand !== undefined) {
    if (!isBrand(patch.brand)) throw new Error('Unknown menu.');
    fields.push('brand = ?');
    values.push(patch.brand);
  }
  if (patch.category !== undefined) {
    fields.push('category = ?');
    values.push(patch.category);
  }
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push('description = ?');
    values.push(patch.description);
  }
  if (patch.price !== undefined) {
    fields.push('price = ?');
    values.push(patch.price);
  }
  if (patch.image_url !== undefined) {
    fields.push('image_url = ?');
    values.push(patch.image_url);
  }
  if (patch.is_available !== undefined) {
    fields.push('is_available = ?');
    values.push(patch.is_available ? 1 : 0);
  }

  if (fields.length === 0) return current;

  fields.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]), id);

  return getMenuItem(id);
}

export function deleteMenuItem(id: number): MenuItem | null {
  const existing = getMenuItem(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  return existing;
}
