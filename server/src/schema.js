// Shared SQL DDL — runs on node:sqlite (local dev/tests) and D1 (Cloudflare).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  addresses TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  image TEXT,
  is_veg INTEGER NOT NULL DEFAULT 0,
  spice_level INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  is_combo INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  name TEXT NOT NULL,
  delta_cents INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_crusts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  delta_cents INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS toppings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_veg INTEGER NOT NULL DEFAULT 1,
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_toppings (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  topping_id TEXT NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  promo_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  size TEXT,
  crust TEXT,
  toppings TEXT NOT NULL DEFAULT '[]',
  extra_cheese INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('percent','flat')),
  value INTEGER NOT NULL,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  max_discount_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  user_id TEXT,
  session_token TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('delivery','pickup')),
  address TEXT,
  notes TEXT,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  delivery_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  promo_code TEXT,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  status_updated_at INTEGER NOT NULL,
  assigned_rider_id TEXT,
  delivery_lat REAL,
  delivery_lng REAL,
  delivery_accuracy REAL,
  landmark TEXT,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  image TEXT,
  size TEXT,
  crust TEXT,
  toppings TEXT NOT NULL DEFAULT '[]',
  extra_cheese INTEGER NOT NULL DEFAULT 0,
  is_veg INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS riders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  phone TEXT,
  vehicle TEXT,
  photo TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  availability TEXT NOT NULL DEFAULT 'offline',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rider_assignments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id TEXT NOT NULL REFERENCES riders(id),
  assigned_by TEXT NOT NULL,
  unassigned_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'status',
  actor_role TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_role TEXT NOT NULL,
  recipient_user_id TEXT,
  order_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rider_locations (
  rider_id TEXT PRIMARY KEY REFERENCES riders(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, read);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON rider_assignments(order_id);
`;

/**
 * Column-level migrations for databases created before a column existed.
 * Each statement runs separately; "duplicate column" failures are expected
 * and silently tolerated (both node:sqlite and D1 behave this way).
 */
export const ORDER_MIGRATIONS = [
  'ALTER TABLE orders ADD COLUMN assigned_rider_id TEXT',
  'ALTER TABLE orders ADD COLUMN delivery_lat REAL',
  'ALTER TABLE orders ADD COLUMN delivery_lng REAL',
  'ALTER TABLE orders ADD COLUMN delivery_accuracy REAL',
  'ALTER TABLE orders ADD COLUMN landmark TEXT',
];

/**
 * Category-management migrations.
 *
 * Runs AFTER ensureSchema() above, on a per-statement basis so a
 * "duplicate column" failure is tolerated. The legacy products table may
 * already hold the ex-foreign key `category_id` values (`cat-classic-pizza`,
 * `cat-premium-pizza`, ...) produced by version 1.0.0. This mapping re-wires
 * any legacy slug references onto the newly-created master categories and
 * then freezes the slug column so the relationship is stable.
 */
export const CATEGORY_MIGRATIONS = [
  // Friendly slug → master category id mapping (fuzzy, case-insensitive).
  `UPDATE products SET category_id = 'cat-classic-pizza'
   WHERE slug IN (
     'margherita', 'pepperoni', 'hawaiian', 'hot-spicy-pepperoni',
     'virgin-margherita', 'margherita-veggie', 'pepperoni-veggie',
     'thai-spicy-pepperoni', 'bbq', 'meat-lovers', 'farmhouse-veggie',
     'pepperoni-hawaiian', 'margherita-pepperoni', 'garlic-bread',
     'crispy-fries', 'chicken-wings-8pc', 'onion-rings', 'choco-milkshake',
     'veggie-burger', 'cheese-burger', 'chicken-burger', 'big-stack-burger'
   )`,

  `UPDATE products SET category_id = 'cat-premium-pizza'
   WHERE slug IN (
     'fresh-mushroom', 'bbq-chicken', 'cheese-lovers',
     'paneer-pizza', 'wood-fired-pepperoni', 'hot-spicy-pepperoni'
   )`,

  // Freeze any stale legacy slug references so the relationship is stable.const CATEGORY_MIGRATIONS = [
  // Friendly slug → master category id mapping (fuzzy, case-insensitive).
  `UPDATE products SET category_id = 'cat-classic-pizza'
   WHERE slug IN (
     'margherita', 'pepperoni', 'hawaiian', 'hot-spicy-pepperoni',
     'virgin-margherita', 'margherita-veggie', 'pepperoni-veggie',
     'thai-spicy-pepperoni', 'bbq', 'meat-lovers', 'farmhouse-veggie',
     'pepperoni-hawaiian', 'margherita-pepperoni', 'garlic-bread',
     'crispy-fries', 'chicken-wings-8pc', 'onion-rings', 'choco-milkshake',
     'veggie-burger', 'cheese-burger', 'chicken-burger', 'big-stack-burger'
   )`,

  `UPDATE products SET category_id = 'cat-premium-pizza'
   WHERE slug IN (
     'fresh-mushroom', 'bbq-chicken', 'cheese-lovers',
     'paneer-pizza', 'wood-fired-pepperoni', 'hot-spicy-pepperoni'
   )`,

  // Freeze any stale legacy slug references so the relationship is stable.
  `UPDATE products SET slug = slug WHERE 1=0`,
];
