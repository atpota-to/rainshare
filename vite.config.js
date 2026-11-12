// rainshare.dev: the site (index.html, src/), plus the Rainshare CLI and MCP server bundled
// into one dependency-free file at /rainshare.mjs.
import { defineConfig, build } from 'vite';
import { fileURLToPath } from 'node:url';
import { SITE } from './core/ns.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
// Where Rainshare lives (SITE in core/ns.js, from RAINSHARE_SITE when it's set), baked into
// what's built: the page's scripts, the CLI, and the address index.html names.
const define = { __RAINSHARE_SITE__: JSON.stringify(SITE) };

// The CLI (cli/rainshare.mjs) and the core it imports, as one file.
export const bundleCli = outDir => build({
  configFile: false, logLevel: 'warn', publicDir: false, define,
  build: {
    ssr: here('./cli/rainshare.mjs'), outDir, emptyOutDir: false, minify: false,
    rollupOptions: { output: { entryFileNames: 'rainshare.mjs', format: 'es' } }
  }
});

export default defineConfig({
  define,
  // The landing's scene (three.js) is one chunk of about 575 kB, 150 kB gzipped, fetched only
  // when the landing is on screen. Nothing is inlined, so the smaller font files stay files
  // the browser can skip instead of riding along inside the stylesheet.
  build: { chunkSizeWarningLimit: 650, assetsInlineLimit: 0 },
  plugins: [
    { name: 'rainshare-site', transformIndexHtml: html => html.replaceAll('%RAINSHARE_SITE%', SITE) },
    { name: 'rainshare-cli', apply: 'build', closeBundle: () => bundleCli(here('./dist')) }
  ]
});
