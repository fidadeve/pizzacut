import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BASE = 'http://127.0.0.1:4599';

export async function startServer() {
  const dbPath = `/tmp/pizzacut-test-${Date.now()}.db`;
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true });
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '4599', NODE_ENV: 'test', DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/api/settings`); return { child, getLog: () => log, dbPath }; }
    catch { await new Promise(r => setTimeout(r, 250)); }
  }
  throw new Error('Server did not start:\n' + log);
}

export function client(cookie) {
  const jar = cookie ?? { value: '' };
  const call = async (method, url, body, extra = {}) => {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(jar.value ? { Cookie: jar.value } : {}),
        ...extra.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'headers')),
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const pair = c.split(';')[0];
      const name = pair.split('=')[0];
      const existing = jar.value ? jar.value.split('; ').filter(Boolean) : [];
      const kept = existing.filter(p => p.split('=')[0] !== name);
      kept.push(pair);
      jar.value = kept.join('; ');
    }
    let json = null;
    try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json, cookie: jar };
  };
  return {
    jar,
    get: (url, extra) => call('GET', url, undefined, extra),
    post: (url, body, extra) => call('POST', url, body ?? {}, extra),
    patch: (url, body, extra) => call('PATCH', url, body ?? {}, extra),
    put: (url, body, extra) => call('PUT', url, body ?? {}, extra),
    del: (url, body, extra) => call('DELETE', url, body ?? {}, extra),
  };
}
