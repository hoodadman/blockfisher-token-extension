import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// The Blockfisher scanner the extension talks to. For local testing, run the scanner
// with `npm start` and build with BLOCKFISHER_API=http://localhost:5181.
const api = new URL(process.env.BLOCKFISHER_API || 'https://blockfisher-token-scanner-v2.onrender.com');
const apiBase = api.origin;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const shared = {
  absWorkingDir: root,
  bundle: true,
  target: 'chrome120',
  minify: false,
  loader: { '.css': 'text' },
  define: { __API_BASE__: JSON.stringify(apiBase) },
  logLevel: 'warning',
};

await esbuild.build({ ...shared, entryPoints: ['src/background.ts'], outfile: join(dist, 'background.js'), format: 'esm' });
await esbuild.build({ ...shared, entryPoints: ['src/content.ts'], outfile: join(dist, 'content.js'), format: 'iife' });
await esbuild.build({ ...shared, entryPoints: ['src/reader.ts'], outfile: join(dist, 'reader.js'), format: 'iife' });
await esbuild.build({ ...shared, entryPoints: ['src/popup.ts'], outfile: join(dist, 'popup.js'), format: 'esm' });
await esbuild.build({ ...shared, entryPoints: ['src/options.ts'], outfile: join(dist, 'options.js'), format: 'esm' });

const read = (file) => readFileSync(join(root, 'src', file), 'utf8');
for (const file of ['popup.html', 'options.html']) cpSync(join(root, 'src', file), join(dist, file));
writeFileSync(join(dist, 'popup.css'), read('ui/card.css') + read('ui/switches.css') + read('popup.css'));
writeFileSync(join(dist, 'options.css'), read('options.css') + read('ui/switches.css'));

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
manifest.host_permissions = manifest.host_permissions.map((item) => item.replace('__API_ORIGIN__', apiBase));
writeFileSync(join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(join(root, 'icons'), join(dist, 'icons'), { recursive: true });

console.log(`Built dist/ against ${apiBase}`);
