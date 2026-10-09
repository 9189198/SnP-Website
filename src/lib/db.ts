import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from './password';

export type Brand = 'cafe' | 'indulge';
export type Role = 'customer' | 'admin';

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface MenuItemRow {
  id: number;
  brand: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const BRANDS: Brand[] = ['cafe', 'indulge'];

export function isBrand(value: unknown): value is Brand {
  return typeof value === 'string' && (BRANDS as string[]).includes(value);
}

/** Absolute path of the folder holding the SQLite file and uploaded images. */
export function dataDir(): string {
  return process.env.ESP_DATA_DIR
    ? path.resolve(process.env.ESP_DATA_DIR)
    : path.join(process.cwd(), 'data');
}

export function uploadsDir(): string {
  return path.join(dataDir(), 'uploads');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  brand        TEXT NOT NULL,
  category     TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price        REAL NOT NULL DEFAULT 0,
  image_url    TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_items_brand ON menu_items(brand);
CREATE INDEX IF NOT EXISTS idx_menu_items_brand_category ON menu_items(brand, category);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

/** Menu rows that ship with the project so the customer menus are never empty. */
const SEED_MENU: Array<{
  brand: Brand;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
}> = [
  // ---- Cafe ----
  { brand: 'cafe', category: 'Breakfast', name: 'Sunrise Breakfast Plate', description: 'Two eggs any style, garlic rice, fried spam or longganisa and a cup of brewed coffee.', price: 165, image: '/images/breakfast.jpg' },
  { brand: 'cafe', category: 'Breakfast', name: 'Tapsilog & Egg', description: 'Tapa, fried egg and sinangag served with a cup of brewed coffee.', price: 135, image: '/images/breakfast.jpg' },
  { brand: 'cafe', category: 'Breakfast', name: 'Pancake & Waffle Stack', description: 'Fluffy stack with butter, syrup and fresh seasonal fruit.', price: 185, image: '/images/waffle.jpg' },
  { brand: 'cafe', category: 'Rice Meal', name: 'Chicken BBQ Rice Meal', description: 'Grilled chicken thigh, java rice, atchara and house-made sauce.', price: 155, image: '/images/ricemeal.jpg' },
  { brand: 'cafe', category: 'Rice Meal', name: 'Bagnet Beef Rice Meal', description: 'Sautéed beef bagnet with liver spread, garlic rice and atchara.', price: 175, image: '/images/ricemeal.jpg' },
  { brand: 'cafe', category: 'Appetizers', name: 'Crispy Calamares', description: 'Breadcrumb-fried squid rings with garlic dip and sweet chilli.', price: 195, image: '/images/appetizer.jpg' },
  { brand: 'cafe', category: 'Appetizers', name: 'Cheese Lumpia', description: 'Four golden lumpia filled with cheese and vegetables, sweet chilli dip.', price: 165, image: '/images/appetizer.jpg' },
  { brand: 'cafe', category: 'Main Course', name: 'Pepper Beef Steak', description: 'Grilled beef medallion in a cracked pepper sauce, served with garlic rice.', price: 285, image: '/images/maincourse.jpg' },
  { brand: 'cafe', category: 'Main Course', name: 'Baked Salmon Fillet', description: 'Oven-baked salmon with lemon butter, seasonal vegetables and rice.', price: 395, image: '/images/maincourse.jpg' },
  { brand: 'cafe', category: 'Sandwich', name: 'Grilled Cheese & Ham', description: 'Sourdough pressed with aged cheddar, ham and butter.', price: 145, image: '/images/sandwich.jpg' },
  { brand: 'cafe', category: 'Sandwich', name: 'Chicken Pesto Ciabatta', description: 'Herb chicken, basil pesto, mozzarella and tomato in a toasted ciabatta.', price: 185, image: '/images/sandwich.jpg' },
  { brand: 'cafe', category: 'Pasta', name: 'Carbonara', description: 'Creamy bacon and egg pasta finished with parmesan and cracked pepper.', price: 225, image: '/images/pasta.jpg' },
  { brand: 'cafe', category: 'Pasta', name: 'Pesto Fusilli', description: 'Basil pesto, grilled chicken, sun-dried tomato and parmesan.', price: 235, image: '/images/pasta.jpg' },
  { brand: 'cafe', category: 'Pasta', name: 'Bolognese Spaghetti', description: 'Slow-cooked beef and tomato ragù over spaghetti.', price: 245, image: '/images/pasta.jpg' },
  { brand: 'cafe', category: 'Drinks', name: 'Espresso', description: 'Single-origin espresso, served hot or over ice.', price: 60, image: '/images/drinks.jpg' },
  { brand: 'cafe', category: 'Drinks', name: 'Caramel Macchiato', description: 'Espresso, steamed milk and caramel drizzle.', price: 145, image: '/images/milkshake.jpg' },
  { brand: 'cafe', category: 'Drinks', name: 'Fresh Iced Lemon Tea', description: 'House-brewed tea with fresh lemon, lightly sweetened.', price: 95, image: '/images/drinks.jpg' },
  { brand: 'cafe', category: 'Drinks', name: 'Cold Buko Juice', description: 'Freshly opened young coconut juice, chilled.', price: 85, image: '/images/drinks.jpg' },

  // ---- Indulge ----
  { brand: 'indulge', category: 'Ice Cream', name: 'Artisan Scoop (per cup)', description: 'Two scoops of in-house churned ice cream in a cup or cone.', price: 120, image: '/images/icecream.jpg' },
  { brand: 'indulge', category: 'Ice Cream', name: 'Ice Cream Sundae', description: 'Three scoops, whipped cream, chocolate sauce and wafer sticks.', price: 165, image: '/images/icecream.jpg' },
  { brand: 'indulge', category: 'Milkshake', name: 'Strawberry Milkshake', description: 'Thick shake blended with real strawberries and vanilla ice cream.', price: 155, image: '/images/milkshake.jpg' },
  { brand: 'indulge', category: 'Milkshake', name: 'Chocolate Fudge Milkshake', description: 'Chocolate fudge, cocoa and vanilla ice cream blended thick.', price: 165, image: '/images/milkshake.jpg' },
  { brand: 'indulge', category: 'Cake', name: 'Chocolate Moist Cake', description: 'Whole cake, eight slices, rich chocolate sponge with chocolate buttercream.', price: 720, image: '/images/cake.jpg' },
  { brand: 'indulge', category: 'Cake', name: 'Carrot Walnut Cake', description: 'Spiced carrot cake with cream cheese frosting, eight slices.', price: 780, image: '/images/cake.jpg' },
  { brand: 'indulge', category: 'Pastry', name: 'Butter Croissant', description: 'Flaky laminated croissant baked fresh every morning.', price: 85, image: '/images/pastries.jpg' },
  { brand: 'indulge', category: 'Pastry', name: 'Assorted Pastry Box', description: 'Six assorted pastries, perfect for sharing or gifting.', price: 420, image: '/images/pastries.jpg' },
  { brand: 'indulge', category: 'Waffle', name: 'Classic Waffle', description: 'Belgian-style waffle with butter, fresh fruit and cream.', price: 195, image: '/images/waffle.jpg' },
  { brand: 'indulge', category: 'Waffle', name: 'Nutella Waffle', description: 'Waffle topped with Nutella, banana slices and powdered sugar.', price: 235, image: '/images/waffle.jpg' },
  { brand: 'indulge', category: 'Crepe', name: 'Sweet Crepe', description: 'Thin crepe with fresh fruit, whipped cream and caramel sauce.', price: 185, image: '/images/crepe.jpg' },
  { brand: 'indulge', category: 'Crepe', name: 'Chicken Crepe', description: 'Savoury crepe with garlic chicken, cheese and herb mayo.', price: 175, image: '/images/crepe.jpg' },
];

function connect(): DatabaseSync {
  mkdirSync(dataDir(), { recursive: true });
  mkdirSync(uploadsDir(), { recursive: true });

  const db = new DatabaseSync(path.join(dataDir(), 'esp.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

function seed(db: DatabaseSync) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM menu_items').get() as { n: number };
  if (n === 0) {
    const insert = db.prepare(
      `INSERT INTO menu_items (brand, category, name, description, price, image_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let order = 0;
    for (const item of SEED_MENU) {
      insert.run(item.brand, item.category, item.name, item.description, item.price, item.image, order++);
    }
    console.log(`[db] seeded ${SEED_MENU.length} menu items`);
  }

  const admins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get() as { n: number };
  if (admins.n === 0) {
    const email = (process.env.ESP_ADMIN_EMAIL || 'admin@stoneandpebble.com').trim().toLowerCase();
    const isProd = process.env.NODE_ENV === 'production';
    const password = process.env.ESP_ADMIN_PASSWORD || (isProd ? crypto.randomUUID() : 'Admin@12345');
    db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')`).run(
      email,
      'ESP Administrator',
      hashPassword(password),
    );
    if (!process.env.ESP_ADMIN_PASSWORD) {
      console.log(`[db] created admin account -> ${email}`);
      console.log(`[db] admin password -> ${password}`);
      if (isProd) console.log('[db] set ESP_ADMIN_PASSWORD before going live.');
    }
  }
}

// Cache the connection on globalThis so dev-server module reloads reuse it.
const globalRef = globalThis as typeof globalThis & { __espDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalRef.__espDb) {
    globalRef.__espDb = connect();
    seed(globalRef.__espDb);
  }
  return globalRef.__espDb;
}

export function toUser(row: Record<string, unknown>): UserRow {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name ?? ''),
    role: row.role === 'admin' ? 'admin' : 'customer',
    created_at: String(row.created_at),
  };
}
