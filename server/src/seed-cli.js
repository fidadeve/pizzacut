// Seed CLI — kept separate from seed.js so the Worker bundle never pulls in node:sqlite.
import { configureDb } from './db.js';
import { createSqliteBackend } from './sqlite.js';
import { seed } from './seed.js';

configureDb(createSqliteBackend(process.env.DB_PATH));
const res = await seed();
console.log(res.seeded ? 'Seeded database.' : 'Database already seeded.', res);
console.log('Admin login: admin@pizzacut.com / admin123');
