import { get, run } from './db.js';
import { hashPassword } from './auth.js';
import { updateSettings } from './settings.js';
import { uid, now } from './util.js';

const CATS = [
  { slug: 'classic-pizza', name: 'Classic Pizza', image: '/images/pizza-margherita.webp' },
  { slug: 'premium-pizza', name: 'Premium Pizza', image: '/images/pizza-four-cheese.webp' },
  { slug: 'special-deals', name: 'Special Deals', image: '/images/banner-feast.webp' },
  { slug: 'sides', name: 'Sides', image: '/images/side-fries.webp' },
  { slug: 'burgers', name: 'Burgers', image: '/images/burger-triple.webp' },
  { slug: 'drinks', name: 'Drinks', image: '/images/drink-cola.webp' },
  { slug: 'desserts', name: 'Desserts', image: '/images/dessert-choc-cake.webp' },
];

const TOPPINGS = [
  { id: 'top-mozz', name: 'Extra Mozzarella', price: 200, veg: 1 },
  { id: 'top-pepperoni', name: 'Pepperoni', price: 250, veg: 0 },
  { id: 'top-chicken', name: 'Grilled Chicken', price: 250, veg: 0 },
  { id: 'top-paneer', name: 'Paneer Cubes', price: 200, veg: 1 },
  { id: 'top-mushroom', name: 'Mushrooms', price: 150, veg: 1 },
  { id: 'top-onion', name: 'Red Onion', price: 100, veg: 1 },
  { id: 'top-peppers', name: 'Bell Peppers', price: 100, veg: 1 },
  { id: 'top-olives', name: 'Black Olives', price: 120, veg: 1 },
  { id: 'top-corn', name: 'Sweet Corn', price: 100, veg: 1 },
  { id: 'top-jalapeno', name: 'Jalapeños', price: 120, veg: 1 },
  { id: 'top-basil', name: 'Fresh Basil', price: 80, veg: 1 },
  { id: 'top-bbq', name: 'BBQ Drizzle', price: 100, veg: 1 },
];

const SIZES = [
  { size: 'small', name: 'Small · 7"', delta: 0, def: 0 },
  { size: 'medium', name: 'Medium · 10"', delta: 300, def: 1 },
  { size: 'large', name: 'Large · 13"', delta: 550, def: 0 },
];

const PIZZA_CATS = new Set(['classic-pizza', 'premium-pizza']);

const CRUSTS = [
  { name: 'Hand Tossed', delta: 0, def: 1 },
  { name: 'Thin & Crispy', delta: 0, def: 0 },
  { name: 'Wheat Thin Crust', delta: 100, def: 0 },
  { name: 'Cheese Burst', delta: 200, def: 0 },
  { name: 'Stuffed Crust', delta: 250, def: 0 },
];

const ALL_TOPPING_IDS = TOPPINGS.map(t => t.id);

const PRODUCTS = [
  // Classic pizzas
  { slug: 'margherita-classic', cat: 'classic-pizza', name: 'Margherita Classic', desc: 'San Marzano tomato sauce, fresh mozzarella, hand-picked basil and a drizzle of olive oil.', price: 799, image: '/images/pizza-margherita.webp', veg: 1, spice: 0, badge: 'Bestseller', toppings: ['top-mozz', 'top-basil', 'top-mushroom', 'top-onion', 'top-peppers', 'top-olives', 'top-corn'] },
  { slug: 'farmhouse-veggie', cat: 'classic-pizza', name: 'Farmhouse Veggie', desc: 'Crunchy onion, capsicum, black olives, sweet corn and mushrooms on a cheesy base.', price: 999, image: '/images/pizza-veggie.webp', veg: 1, spice: 0, toppings: ALL_TOPPING_IDS.filter(id => !['top-pepperoni', 'top-chicken'].includes(id)) },
  { slug: 'pepperoni-passion', cat: 'classic-pizza', name: 'Pepperoni Passion', desc: 'Loaded with double pepperoni over 100% mozzarella and our signature sauce.', price: 1199, image: '/images/pizza-pepperoni.webp', veg: 0, spice: 1, badge: 'Bestseller', discount: 10, toppings: ALL_TOPPING_IDS },
  { slug: 'hot-spicy-pepperoni', cat: 'classic-pizza', name: 'Hot & Spicy Pepperoni', desc: 'Pepperoni, jalapeños and chilli flakes for a serious heat hit.', price: 1099, image: '/images/pizza-spicy-jalapeno.webp', veg: 0, spice: 3, toppings: ALL_TOPPING_IDS },
  { slug: 'hawaiian-ham', cat: 'classic-pizza', name: 'Hawaiian Ham & Pineapple', desc: 'Sweet pineapple and smoky ham over bubbling mozzarella.', price: 1099, image: '/images/pizza-hawaiian.webp', veg: 0, spice: 0, toppings: ALL_TOPPING_IDS },
  // Premium pizzas
  { slug: 'four-cheese-deluxe', cat: 'premium-pizza', name: 'Four Cheese Deluxe', desc: 'Mozzarella, cheddar, parmesan and creamy blue cheese on a white base.', price: 1399, image: '/images/pizza-four-cheese.webp', veg: 1, spice: 0, badge: 'Bestseller', toppings: ['top-mozz', 'top-mushroom', 'top-basil', 'top-jalapeno'] },
  { slug: 'wild-mushroom-truffle', cat: 'premium-pizza', name: 'Wild Mushroom Truffle', desc: 'Field mushrooms, truffle cream, mozzarella and fresh herbs.', price: 1449, image: '/images/pizza-mushroom.webp', veg: 1, spice: 0, toppings: ['top-mozz', 'top-mushroom', 'top-basil', 'top-onion'] },
  { slug: 'paneer-tikka-tandoori', cat: 'premium-pizza', name: 'Paneer Tikka Tandoori', desc: 'Tandoori-marinated paneer, onion and capsicum with a spicy tikka sauce.', price: 1349, image: '/images/pizza-paneer.webp', veg: 1, spice: 2, badge: 'Chef\u2019s Pick', toppings: ['top-mozz', 'top-paneer', 'top-onion', 'top-peppers', 'top-jalapeno', 'top-corn'] },
  { slug: 'bbq-chicken-ranch', cat: 'premium-pizza', name: 'BBQ Chicken Ranch', desc: 'Smoky BBQ chicken, red onion and mozzarella with a tangy ranch drizzle.', price: 1399, image: '/images/pizza-bbq-chicken.webp', veg: 0, spice: 1, toppings: ALL_TOPPING_IDS },
  { slug: 'wood-fired-pepperoni', cat: 'premium-pizza', name: 'Wood-Fired Pepperoni', desc: 'Our signature pepperoni, blistered in a 400\u00b0C wood-fired oven.', price: 1499, image: '/images/pizza-oven.webp', veg: 0, spice: 1, badge: 'Chef\u2019s Pick', toppings: ALL_TOPPING_IDS },
  // Deals (combos, no customization)
  { slug: 'combo-pizza-feast', cat: 'special-deals', name: 'Pizza Feast Combo', desc: '2 classic pizzas + garlic bread + 2 soft drinks. Feeds 2–3.', price: 2499, image: '/images/banner-feast.webp', veg: 0, spice: 0, combo: 1, badge: 'Save $8' },
  { slug: 'combo-family-night', cat: 'special-deals', name: 'Family Night Combo', desc: '3 medium pizzas + wings + fries + 4 drinks. The whole family sorted.', price: 3999, image: '/images/banner-spread.webp', veg: 0, spice: 0, combo: 1, badge: 'Best Value' },
  { slug: 'combo-burger-fries', cat: 'special-deals', name: 'Burger & Fries Combo', desc: 'Any burger + crispy fries + cola at a combo price.', price: 1299, image: '/images/burger-fries.webp', veg: 0, spice: 0, combo: 1 },
  { slug: 'combo-wings-box', cat: 'special-deals', name: 'Wings & Fries Box', desc: '8 pc crispy wings + fries + dip. Addictive, fair warning.', price: 1099, image: '/images/side-wings.webp', veg: 0, spice: 1, combo: 1, discount: 15 },
  // Sides
  { slug: 'garlic-bread', cat: 'sides', name: 'Garlic Bread Sticks', desc: 'Oven-baked bread sticks with garlic butter and herbs, plus dip.', price: 449, image: '/images/side-garlic-bread.webp', veg: 1, spice: 0, badge: 'Bestseller' },
  { slug: 'crispy-fries', cat: 'sides', name: 'Crispy Peri Fries', desc: 'Golden fries tossed in our house peri seasoning.', price: 399, image: '/images/side-fries.webp', veg: 1, spice: 1 },
  { slug: 'onion-rings', cat: 'sides', name: 'Crunchy Onion Rings', desc: 'Thick-cut onion rings in a crisp golden batter.', price: 449, image: '/images/side-onion-rings.webp', veg: 1, spice: 0 },
  { slug: 'chicken-wings-8pc', cat: 'sides', name: 'Crispy Chicken Wings · 8pc', desc: 'Juicy fried wings with a choice of dip.', price: 799, image: '/images/side-wings.webp', veg: 0, spice: 1, discount: 15 },
  // Burgers
  { slug: 'classic-cheese-burger', cat: 'burgers', name: 'Classic Cheese Burger', desc: 'Grilled patty, cheddar, lettuce, tomato and house sauce in a toasted bun.', price: 699, image: '/images/burger-classic.webp', veg: 0, spice: 0, badge: 'Bestseller' },
  { slug: 'garden-veg-burger', cat: 'burgers', name: 'Garden Veg Burger', desc: 'Crispy veg patty with fresh salad and tangy mayo.', price: 749, image: '/images/burger-gourmet.webp', veg: 1, spice: 0 },
  { slug: 'crunchy-chicken-burger', cat: 'burgers', name: 'Crunchy Chicken Burger', desc: 'Buttermilk-fried chicken fillet with slaw and spicy sauce.', price: 899, image: '/images/burger-fries.webp', veg: 0, spice: 2 },
  { slug: 'big-stack-burger', cat: 'burgers', name: 'Big Stack Beef Burger', desc: 'Triple beef patty, double cheese, caramelised onion. Bring napkins.', price: 1099, image: '/images/burger-triple.webp', veg: 0, spice: 1, badge: 'Chef\u2019s Pick' },
  // Drinks
  { slug: 'cola', cat: 'drinks', name: 'Chilled Cola · 330ml', desc: 'Ice-cold classic cola can.', price: 249, image: '/images/drink-cola.webp', veg: 1, spice: 0 },
  { slug: 'fresh-lemonade', cat: 'drinks', name: 'Fresh Lemonade', desc: 'Hand-squeezed lemons, mint and sparkling water.', price: 299, image: '/images/drink-lemonade.webp', veg: 1, spice: 0, badge: 'Bestseller' },
  { slug: 'iced-tea', cat: 'drinks', name: 'Peach Iced Tea', desc: 'Brewed tea chilled with peach and lime.', price: 279, image: '/images/drink-iced-tea.webp', veg: 1, spice: 0 },
  { slug: 'choco-milkshake', cat: 'drinks', name: 'Choco Thick Shake', desc: 'Rich chocolate shake topped with cream.', price: 399, image: '/images/drink-milkshake.webp', veg: 1, spice: 0, discount: 10 },
  // Desserts
  { slug: 'chocolate-lava-cake', cat: 'desserts', name: 'Chocolate Lava Cake', desc: 'Warm molten chocolate centre with a dusting of cocoa.', price: 449, image: '/images/dessert-choc-cake.webp', veg: 1, spice: 0, badge: 'Bestseller' },
  { slug: 'tiramisu-cup', cat: 'desserts', name: 'Tiramisu Cup', desc: 'Espresso-soaked layers with mascarpone cream.', price: 499, image: '/images/dessert-tiramisu.webp', veg: 1, spice: 0 },
  { slug: 'choco-donut', cat: 'desserts', name: 'Choco Brownie Donut', desc: 'Glazed donut loaded with brownie chunks.', price: 249, image: '/images/dessert-donuts.webp', veg: 1, spice: 0 },
  { slug: 'ice-cream-sundae', cat: 'desserts', name: 'Ice Cream Sundae', desc: 'Chocolate and mango scoops with sauce and nuts.', price: 349, image: '/images/dessert-ice-cream.webp', veg: 1, spice: 0 },
];

const PROMOS = [
  { code: 'SAVE20', desc: '20% off orders over $25', type: 'percent', value: 20, min: 2500, max: 800 },
  { code: 'FIRST10', desc: '10% off your first order', type: 'percent', value: 10, min: 800, max: 300 },
  { code: 'WELCOME15', desc: '15% off orders over $15', type: 'percent', value: 15, min: 1500, max: 600 },
  { code: 'FLAT5', desc: '$5 off orders over $30', type: 'flat', value: 500, min: 3000, max: null },
];

export async function seed() {
  if (await get('SELECT id FROM products LIMIT 1')) return { seeded: false };

  const catIds = {};
  for (const [i, c] of CATS.entries()) {
    const id = `cat-${c.slug}`;
    await run('INSERT INTO categories (id, slug, name, image, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)',
      id, c.slug, c.name, c.image, i);
    catIds[c.slug] = id;
  }

  for (const t of TOPPINGS) {
    await run('INSERT INTO toppings (id, name, price_cents, is_veg, available) VALUES (?, ?, ?, ?, 1)',
      t.id, t.name, t.price, t.veg);
  }

  for (const [i, p] of PRODUCTS.entries()) {
    const id = `prd-${p.slug}`;
    await run(`INSERT INTO products (id, slug, name, description, category_id, price_cents, image, is_veg, spice_level, badge, discount_pct, available, is_combo, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      id, p.slug, p.name, p.desc, catIds[p.cat], p.price, p.image, p.veg, p.spice,
      p.badge ?? null, p.discount ?? 0, p.combo ?? 0, i, now());
    if (PIZZA_CATS.has(p.cat)) {
      for (const s of SIZES) {
        await run('INSERT INTO product_sizes (id, product_id, size, name, delta_cents, is_default) VALUES (?, ?, ?, ?, ?, ?)',
          uid(), id, s.size, s.name, s.delta, s.def);
      }
      for (const cr of CRUSTS) {
        await run('INSERT INTO product_crusts (id, product_id, name, delta_cents, is_default) VALUES (?, ?, ?, ?, ?)',
          uid(), id, cr.name, cr.delta, cr.def);
      }
      const tops = p.toppings ?? ALL_TOPPING_IDS;
      for (const tid of tops) {
        await run('INSERT INTO product_toppings (product_id, topping_id) VALUES (?, ?)', id, tid);
      }
    }
  }

  for (const pr of PROMOS) {
    await run(`INSERT INTO promos (id, code, description, type, value, min_order_cents, max_discount_cents, active, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
      uid(), pr.code, pr.desc, pr.type, pr.value, pr.min, pr.max);
  }

  if (!await get('SELECT id FROM users WHERE role = ?', 'admin')) {
    await run('INSERT INTO users (id, email, password_hash, name, phone, role, addresses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      uid(), 'admin@pizzacut.com', await hashPassword('admin123'), 'PizzaCut Staff', '+1 (555) 010-7788', 'admin', '[]', now());
  }

  await updateSettings({});
  return { seeded: true, products: PRODUCTS.length, categories: CATS.length, promos: PROMOS.length };
}
