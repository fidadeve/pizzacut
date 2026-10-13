// Cloudflare D1 backend — only imported by the Worker entry point.
export function createD1Backend(d1) {
  const prep = (sql, params) => (params.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql));
  return {
    all: async (sql, params) => (await prep(sql, params).all()).results,
    get: async (sql, params) => (await prep(sql, params).first()) ?? null,
    run: async (sql, params) => await prep(sql, params).run(),
    exec: async (sql) => await d1.exec(sql),
    batch: async (stmts) => await d1.batch(stmts.map(s => prep(s.sql, s.params))),
  };
}
