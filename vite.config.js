// rainshare.dev: the site (index.html, src/), plus the Rainshare CLI and MCP server bundled
// into one dependency-free file at /rainshare.mjs.
import { defineConfig, build } from 'vite';
import { fileURLToPath } from 'node:url';

const here = p => fileURLToPath(new URL(p, import.meta.url));

// The CLI (cli/rainshare.mjs) and the core it imports, as one file.
export const bundleCli = outDir => build({
  configFile: false, logLevel: 'warn', publicDir: false,
  build: {
    ssr: here('./cli/rainshare.mjs'), outDir, emptyOutDir: false, minify: false,
    rollupOptions: { output: { entryFileNames: 'rainshare.mjs', format: 'es' } }
  }
});

export default defineConfig({
  // The landing's scene (three.js) is one chunk of about 570 kB, 145 kB gzipped, fetched only
  // when the landing is on screen.
  build: { chunkSizeWarningLimit: 650 },
  plugins: [{ name: 'rainshare-cli', apply: 'build', closeBundle: () => bundleCli(here('./dist')) }]
});
