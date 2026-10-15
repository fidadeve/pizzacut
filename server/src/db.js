import { SCHEMA_SQL } from './schema.js';

// Runtime-agnostic async database access. The concrete backend
// (node:sqlite for local dev/tests, D1 on Cloudflare) is injected by the
// platform entry point via configureDb().
let backend = null;

export function configureDb(impl) { backend = impl; }

function be() {
  if (!backend) throw new Error('Database backend not configured.');
  return backend;
}

// D1 rejects undefined/boolean bind params; node:sqlite rejects them too.
const norm = (p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p);
const normAll = (params) => params.map(norm);

export async function all(sql, ...params) { return be().all(sql, normAll(params)); }
export async function get(sql, ...params) { return be().get(sql, normAll(params)); }
export async function run(sql, ...params) { return be().run(sql, normAll(params)); }
export async function exec(sql) { return be().exec(sql); }
export async function batch(statements) {
  return be().batch(statements.map(s => ({ sql: s.sql, params: normAll(s.params ?? []) })));
}

// D1's exec() splits input on newlines, which truncates multi-line DDL.
// Run each statement separately, collapsed onto a single line instead.
import { ORDER_MIGRATIONS } from './schema.js';
import { CATEGORY_MIGRATIONS } from './schema.js';

export async function ensureSchema() {
  // Column migrations must run BEFORE the schema statements — the DDL includes
  // an index on orders.assigned_rider_id which legacy databases don't have yet.
  // On a fresh DB the ALTERs fail harmlessly (no such table) and are tolerated.
  for (const sql of ORDER_MIGRATIONS) {
    try { await run(`${sql};`); } catch (err) {
      if (!/duplicate column|already exists|no such table/i.test(String(err?.message))) throw err;
    }
  }
  // Category-related migrations run AFTER the DDL (they need the categories
  // rows to already exist) and are likewise tolerated on D1/node:sqlite.
  for (const sql of CATEGORY_MIGRATIONS) {
    try { await run(`${sql};`); } catch (err) {
      if (!/duplicate column|already exists|no such table/i.test(String(err?.message))) throw err;
    }
  }
  const statements = SCHEMA_SQL
    .split(';')
    .map(sql => sql.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (const sql of statements) await run(`${sql};`);
}
