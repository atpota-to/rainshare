// /api/page: the site's one page (index.html), with the tags in its head rewritten for the
// address that was asked for, so a link shared anywhere shows what it leads to. The app is
// drawn in the browser and crawlers don't run scripts, which is why this is done here. The
// body isn't touched, so the app starts exactly as it does from the plain file. vercel.json
// sends an ask's page, a person's page, /board, /agents, /feedback and the example circle through here; the
// words come from ./_og/describe.js, the same ones the picture is drawn from (api/og.js).
import { readFile } from 'node:fs/promises';
import { describe, canonical, HOME } from './_og/describe.js';
import { WIDTH, HEIGHT } from './_og/card.js';

const attr = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** `html` with its title and the tags about it set for `page`. `origin` is where this request came in, for the picture's address. */
export function withTags(html, page, origin){
  const image = page.image.startsWith('/api/') ? origin + page.image : null;   // the home picture's tag is left as the build wrote it
  const set = { 'description': page.description, 'og:title': page.heading, 'og:description': page.social, 'og:url': canonical(page), 'og:image:alt': page.alt,
    ...(image ? { 'og:image': image, 'og:image:width': WIDTH, 'og:image:height': HEIGHT } : {}) };
  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${attr(page.title)}</title>`);
  for (const [key, value] of Object.entries(set)) {
    // A tag is found by its name, whatever it says now, and only what it says is replaced.
    const tag = new RegExp(`(<meta\\s+(?:property|name)="${key.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`);
    out = out.replace(tag, (_, a, b) => a + attr(value) + b);
  }
  return out;
}

// The page as it was built. A deployed function has it packed alongside (includeFiles in
// vercel.json); failing that it's fetched from the deployment itself, as the browser would.
let shell = null;
async function indexHtml(req, origin){
  if (shell) return shell;
  for (const at of [new URL('../dist/index.html', import.meta.url), new URL('file://' + process.cwd() + '/dist/index.html')]) {
    try { return shell = await readFile(at, 'utf8'); } catch (_) { /* try the next place */ }
  }
  const r = await fetch(origin + '/index.html', { headers: req.headers.cookie ? { cookie: req.headers.cookie } : {}, signal: AbortSignal.timeout(4000), redirect: 'manual' });
  const text = r.ok ? await r.text() : '';
  if (!/<div id="circle">/.test(text)) throw new Error('index.html not found (' + r.status + ')');
  return shell = text;
}

export default async function handler(req, res){
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const origin = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http://' : 'https://') + host : null;
  let html;
  try { html = await indexHtml(req, origin); }
  catch (e) {
    // Without the page there's nothing to rewrite: send the browser to the plain file, which every other address gets anyway.
    console.warn('page', e?.message || e);
    res.statusCode = 302; res.setHeader('location', '/index.html'); res.setHeader('cache-control', 'no-store'); res.end(); return;
  }
  let page = HOME;
  try { page = await describe(req.query || {}); } catch (e) { console.warn('page', e?.message || e); }
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  res.end(page === HOME || !origin ? html : withTags(html, page, origin));
}
