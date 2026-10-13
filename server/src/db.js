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
export async function ensureSchema() {
  const statements = SCHEMA_SQL
    .split(';')
    .map(sql => sql.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (const sql of statements) await run(`${sql};`);
}
