// node:sqlite backend — used by local dev, tests and the seed CLI.
// Never imported by the Worker entry point.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultDbPath() {
  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return process.env.DB_PATH || path.join(dataDir, 'pizzacut.db');
}

export function createSqliteBackend(dbPath = defaultDbPath()) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;\nPRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  return {
    all: (sql, params) => db.prepare(sql).all(...params),
    get: (sql, params) => db.prepare(sql).get(...params) ?? null,
    run: (sql, params) => db.prepare(sql).run(...params),
    exec: (sql) => db.exec(sql),
    batch: (stmts) => {
      db.exec('BEGIN');
      try {
        for (const s of stmts) db.prepare(s.sql).run(...s.params);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw err;
      }
    },
  };
}
