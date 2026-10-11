import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const engine = resolve(root, '../trust-score-saved/src');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'icons'), { recursive: true });

let collectedCss = '';
const cssPlugin = {
  name: 'collect-css',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, (args) => {
      collectedCss += `${readFileSync(args.path, 'utf8')}\n`;
      return { contents: '', loader: 'js' };
    });
  },
};

const shared = {
  absWorkingDir: root,
  bundle: true,
  target: 'chrome120',
  jsx: 'automatic',
  nodePaths: [join(root, 'node_modules')],
  alias: { '@engine': engine },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
};

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/content.tsx')],
  outfile: join(dist, 'content.js'),
  format: 'iife',
  plugins: [cssPlugin],
});

writeFileSync(join(dist, 'content.css'), collectedCss);

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/background.ts')],
  outfile: join(dist, 'background.js'),
  format: 'esm',
});

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/options.tsx')],
  outfile: join(dist, 'options.js'),
  format: 'esm',
});

writeFileSync(
  join(dist, 'options.html'),
  `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>Token trust score — options</title>
    <link rel="stylesheet" href="options.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="options.js"></script>
  </body>
</html>
`,
);
writeFileSync(join(dist, 'options.css'), readFileSync(join(root, 'src/options.css'), 'utf8'));
cpSync(join(root, 'manifest.json'), join(dist, 'manifest.json'));
cpSync(join(root, 'icons'), join(dist, 'icons'), { recursive: true });

console.log('Built trust-score-extension/dist');
