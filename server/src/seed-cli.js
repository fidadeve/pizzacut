import { configureDb, ensureSchema } from './db.js';
import { createSqliteBackend } from './sqlite.js';
import { seed } from './seed.js';

configureDb(createSqliteBackend(process.env.DB_PATH));
await ensureSchema();
const res = await seed();
console.log(res.seeded ? 'Seeded database.' : 'Database already seeded.', res);
console.log('Master categories:', res.categories, 'legacy products mapped:', res.products);
console.log('Admin login: admin@pizzacut.com / admin123');
