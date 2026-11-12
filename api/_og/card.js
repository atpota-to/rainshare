// A link preview's picture, 1200 by 630: the site's sky, the wordmark with its "ai" lit, and
// what the page is about (./describe.js). Drawn by Satori (through @vercel/og), which takes a
// tree of plain objects shaped like React's and lays it out with flexbox only: every box with
// more than one child says display:flex, and text is cut to length with lineClamp.
export const WIDTH = 1200, HEIGHT = 630;
const C = { ink: '#12203A', muted: '#56627A', accent: '#2F63F0', accentSoft: 'rgba(47,99,240,.12)', accentText: '#2450C8', card: '#FFFFFF', edge: 'rgba(18,32,58,.08)', ok: '#0B7A6B', okSoft: 'rgba(14,143,126,.16)', quiet: 'rgba(18,32,58,.07)' };
const FACES = ['#C9D6F5', '#F5C9E0', '#C9F0DD', '#F5E3C9', '#D9C9F5', '#C9E9F5'];

// (A box's one child is handed over as itself, not as a list of one: Satori takes a list as "more than one child".)
const h = (type, style, ...children) => { const kids = children.flat().filter(c => c !== null && c !== undefined && c !== false && c !== ''); return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } }; };
const row = (style, ...kids) => h('div', { display: 'flex', flexDirection: 'row', alignItems: 'center', ...style }, ...kids);
const col = (style, ...kids) => h('div', { display: 'flex', flexDirection: 'column', ...style }, ...kids);
const text = (style, s) => h('div', { display: 'block', ...style }, String(s));
const img = (src, size, style = {}) => ({ type: 'img', props: { src, width: size, height: size, style } });

// The logo's drop and spark (index.html's), and the name with its "ai" lit.
const drop = size => ({ type: 'svg', props: { viewBox: '0 0 32 32', width: size, height: size, children: [
  { type: 'path', props: { d: 'M16 3.5c4.6 5.9 8.6 10.6 8.6 15.2a8.6 8.6 0 0 1-17.2 0c0-4.6 4-9.3 8.6-15.2z', fill: C.accent } },
  { type: 'path', props: { d: 'M24.5 4l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z', fill: '#F2A63B' } }
] } });
const lit = (s, style) => {
  const parts = String(s).split(/(?<=\b[Rr])(ai)(?=n)/);
  return row({ ...style, alignItems: 'baseline' }, parts.map((p, i) => h('span', i % 2 ? { color: C.accent } : {}, p.replace(/ /g, ' '))));
};
const wordmark = () => row({ gap: 14 }, drop(52), lit('Rainshare', { fontSize: 42, fontWeight: 900, color: C.ink, letterSpacing: '-0.01em' }));
const pill = (label, { bg = C.accentSoft, color = C.accentText } = {}) => text({ padding: '10px 22px', borderRadius: 999, backgroundColor: bg, color, fontSize: 26, fontWeight: 700 }, label);
const pitch = () => col({ alignItems: 'flex-end', gap: 2 },
  lit('Got rain to spare?', { fontSize: 28, fontWeight: 700, color: C.ink }),
  text({ fontSize: 24, fontWeight: 500, color: C.muted }, 'Send your own agent to help.'));

// Someone's picture, or their initial on a soft colour when there isn't one.
function face(p, src, size){
  const ring = { width: size, height: size, borderRadius: size, border: `${Math.max(3, Math.round(size / 26))}px solid #fff`, boxShadow: '0 10px 30px -12px rgba(18,32,58,.45)', overflow: 'hidden', flexShrink: 0 };
  // (The picture is rounded itself: Satori doesn't clip a child to its parent's corners.)
  if (src) return h('div', { display: 'flex', ...ring, border: 'none', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, img(src, size - 2 * Math.max(3, Math.round(size / 26)), { objectFit: 'cover', borderRadius: size }));
  const initial = [...String(p?.name || '?').replace(/^@/, '')].find(c => /[\p{L}\p{N}]/u.test(c))?.toUpperCase() || '?';
  const tone = FACES[[...String(p?.did || p?.name || '')].reduce((a, c) => a + c.codePointAt(0), 0) % FACES.length];
  return h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tone, color: C.ink, fontSize: Math.round(size * .44), fontWeight: 900, ...ring }, initial);
}
// The plant, on a white tile (its picture is a JPEG on white: see scripts/og-plants.mjs).
const tile = (src, size = 296) => h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 56, backgroundColor: C.card, border: `1px solid ${C.edge}`, boxShadow: '0 30px 60px -34px rgba(18,32,58,.55)', overflow: 'hidden', flexShrink: 0 },
  src ? img(src, size, { borderRadius: 56 }) : null);
const frame = (...kids) => col({ width: WIDTH, height: HEIGHT, padding: '52px 64px 50px', justifyContent: 'space-between', backgroundColor: '#EEF3FF', backgroundImage: 'linear-gradient(180deg, #D3E2FF 0%, #EAF0FF 46%, #F5F8FF 100%)', fontFamily: 'Zen Maru Gothic', color: C.ink }, ...kids);
const sized = (s, steps) => { const n = [...String(s)].length; return (steps.find(([max]) => n <= max) || steps[steps.length - 1])[1]; };

function seed(c, { plant, avatar }){
  const p = c.person || {}, state = c.state === 'done' ? pill('Done', { bg: C.okSoft, color: C.ok }) : c.state === 'closed' ? pill('Closed', { bg: C.quiet, color: C.muted }) : null;
  return frame(
    row({ justifyContent: 'space-between' }, wordmark(), row({ gap: 12 }, pill(c.what), state)),
    row({ gap: 48, justifyContent: 'space-between' },
      col({ flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 16 },
        text({ fontSize: sized(c.heading, [[28, 80], [52, 66], [84, 54], [999, 46]]), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.14, lineClamp: 3 }, c.heading),
        text({ fontSize: 28, fontWeight: 500, color: C.muted, lineClamp: 1 }, c.note)),
      tile(plant)),
    row({ justifyContent: 'space-between', gap: 32 },
      row({ gap: 18, flexShrink: 1, minWidth: 0 }, face(p, avatar, 76),
        col({ gap: 2, flexShrink: 1, minWidth: 0 },
          text({ fontSize: 30, fontWeight: 700, lineClamp: 1, maxWidth: 560 }, p.name || 'Someone'),
          text({ fontSize: 24, fontWeight: 500, color: C.muted, lineClamp: 1, maxWidth: 560 }, c.state === 'open' ? (p.handle ? `@${p.handle} is asking for a hand` : 'is asking for a hand') : (p.handle ? `@${p.handle}` : 'on Rainshare')))),
      pitch()));
}
function person(c, { avatar }){
  const p = c.person || {};
  return frame(
    row({ justifyContent: 'space-between' }, wordmark(), p.plan ? pill(`AI plan: ${p.plan}`) : null),
    row({ gap: 52 }, face(p, avatar, 216),
      col({ flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 10 },
        text({ fontSize: sized(p.name, [[16, 84], [26, 68], [999, 54]]), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.12, lineClamp: 2 }, p.name || 'Someone'),
        p.handle ? text({ fontSize: 32, fontWeight: 700, color: C.accentText, lineClamp: 1 }, '@' + p.handle) : null,
        p.bio ? text({ fontSize: 28, fontWeight: 500, color: C.muted, lineHeight: 1.36, lineClamp: 3, marginTop: 6 }, p.bio) : null)),
    row({ justifyContent: 'space-between', gap: 32 }, text({ fontSize: 26, fontWeight: 500, color: C.muted }, 'Ideas, projects and a garden of what they’ve helped with'), pitch()));
}
function page(c, { plant }){
  return frame(
    row({ justifyContent: 'space-between' }, wordmark(), pill('Early alpha')),
    row({ gap: 48, justifyContent: 'space-between' },
      col({ flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 18 },
        text({ fontSize: sized(c.heading, [[18, 88], [30, 72], [999, 58]]), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, lineClamp: 2 }, c.heading),
        text({ fontSize: 30, fontWeight: 500, color: C.muted, lineHeight: 1.36, lineClamp: 3 }, c.line)),
      tile(plant)),
    row({ justifyContent: 'flex-end' }, pitch()));
}

/** The card for a page (`card` from ./describe.js), with the pictures it needs already read in as data: addresses. */
export const cardFor = (card, pictures = {}) => ({ seed, person, page })[card?.type]?.(card, pictures) || null;
