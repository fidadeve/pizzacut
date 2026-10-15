// Master categories. Stored once per franchise; used by the admin panel, the
// customer menu and the product creation/editing forms.
export const CATEGORY_CONFIG = [
  { slug: 'classic-pizza', name: 'Classic Pizza', image: '/images/pizza-margherita.webp' },
  { slug: 'premium-pizza', name: 'Premium Pizza', image: '/images/pizza-four-cheese.webp' },
  { slug: 'special-deals', name: 'Special Deals', image: '/images/banner-feast.webp' },
  { slug: 'sides', name: 'Sides', image: '/images/side-fries.webp' },
  { slug: 'burgers', name: 'Burgers', image: '/images/burger-triple.webp' },
  { slug: 'drinks', name: 'Drinks', image: '/images/drink-cola.webp' },
  { slug: 'desserts', name: 'Desserts', image: '/images/dessert-choc-cake.webp' },
];

export const CATEGORY_IDS = new Map(
  CATEGORY_CONFIG.map((c, i) => [c.slug, `cat-${c.slug}`]),
);

export const CATEGORY_BY_NAME = new Map(
  CATEGORY_CONFIG.map(c => [c.name, c.slug]),
);

export const MASTER_SLUG_TO_ID = new Map(
  CATEGORY_CONFIG.map(c => [c.slug, `cat-${c.slug}`]),
);

export function categoryIdForLegacySlug(slug) {
  // Products from version 1.0.0 never stored a category id in the database.
  // Map their old slug onto a master category by fuzzy matching.
  const match = slug.toLowerCase().replace(/[-_]/g, ' ').trim();
  return MASTER_SLUG_TO_ID.get(match) ?? MASTER_SLUG_TO_ID.get('classic-pizza');
}

/** Stable identifier / name pair used by ProductForm for the category select. */
export function categoryIdForName(name) {
  const slug = CATEGORY_BY_NAME.get(name);
  return slug ? `cat-${slug}` : '';
}
