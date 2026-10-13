// Bundles the Worker entry into a single ESM module for Sites deployment.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'deploy');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'public'), { recursive: true });

// 1. Worker bundle (server code only — no node: builtins).
const result = await build({
  entryPoints: [path.join(root, 'server', 'src', 'worker.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'import'],
  outfile: path.join(outDir, 'worker.js'),
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  metafile: true,
  logLevel: 'info',
});
const bytes = fs.statSync(path.join(outDir, 'worker.js')).size;
console.log(`worker.js: ${(bytes / 1024).toFixed(1)} KB`);

// 2. Static assets: the client build output.
const dist = path.join(root, 'client', 'dist');
fs.cpSync(dist, path.join(outDir, 'public'), { recursive: true });
const count = fs.readdirSync(path.join(outDir, 'public')).length;
console.log(`public/: ${count} top-level entries copied`);

// 3. Deployment manifest for sites_deploy.
const manifest = {
  entrypoint: 'worker.js',
  compatibilityDate: '2026-09-01',
  modules: [{ name: 'worker.js', type: 'esm', path: './worker.js' }],
  assetsDirectory: './public',
  spa: true,
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest.json written');

// Warn if any node: builtin slipped into the bundle.
const inputs = Object.keys(result.metafile.inputs);
const suspicious = inputs.filter(f => f.includes('node:') || f.includes('sqlite'));
if (suspicious.length) console.warn('WARNING: suspicious inputs:', suspicious);
