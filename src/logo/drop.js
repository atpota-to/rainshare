// The logo, in 3D: a drop of water, and the gold spark beside it.
//
// The drop is a solid of revolution (the old flat drop's outline, turned round its own axis)
// and the spark is a cut gem with eight flat faces. Both are lit the way the rest of the site
// is: the sun up and to the left, the landing's sky reflected in the water, and light gathering
// on the far side of the drop the way it does in a real one. The spark lights the drop's
// shoulder too.
//
// It's drawn a pixel at a time, in plain JavaScript, with no WebGL and no three.js: the logo
// is on every page, and at the size of a logo that costs about a millisecond a frame. The
// same drawing makes the header's moving logo (./live.js) and the icons (`npm run logo`), in
// Node as well as in a browser.
//
//   drawLogo(px, size, { t, look, frame, nudge })   fill `px` (RGBA, size × size) with the logo at time t
//
// Time loops every LOOP seconds, and t = 0 is the pose the still pictures are taken in. In a
// loop the drop bobs over its shadow, a glint crosses it and sets the spark turning, and the
// light in the water never quite sits still.

export const LOOP = 8;

const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

/* ---------- the shapes ---------- */
// Everything is measured in drop radii from the middle of the drop's round end, y up, z toward
// whoever's looking. The drop's outline is the one the flat logo had: a half circle below, and
// above it a curve drawn up to a point.
const TIP = 15.2 / 8.6;
const CURVE = [[0, TIP], [4.6 / 8.6, TIP - 5.9 / 8.6], [1, 4.6 / 8.6], [1, 0]];
const bez = (k, t) => { const u = 1 - t; return u * u * u * CURVE[0][k] + 3 * u * u * t * CURVE[1][k] + 3 * u * t * t * CURVE[2][k] + t * t * t * CURVE[3][k]; };
const bezSlope = (k, t) => { const u = 1 - t; return 3 * (u * u * (CURVE[1][k] - CURVE[0][k]) + 2 * u * t * (CURVE[2][k] - CURVE[1][k]) + t * t * (CURVE[3][k] - CURVE[2][k])); };
// How wide the drop is at each height above its middle, and how fast that changes.
const STEPS = 512, WIDE = new Float32Array(STEPS + 1), SLOPE = new Float32Array(STEPS + 1);
for (let i = 0; i <= STEPS; i++) {
  const y = TIP * i / STEPS;
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (bez(1, m) > y) lo = m; else hi = m; }
  const t = (lo + hi) / 2;
  WIDE[i] = bez(0, t); SLOPE[i] = bezSlope(0, t) / Math.min(bezSlope(1, t), -1e-6);
}

// The spark: a four-pointed star, a little larger than the flat one was so its faces can be
// seen, standing off the drop's shoulder. Its points reach SPARK from its middle and its waist
// is NOTCH from it; PEAK is how far its middle stands proud of its edges.
const SPARK_AT = [8.6 / 8.6, 11.6 / 8.6], SPARK = .4, NOTCH = .33 * SPARK, PEAK = .5 * SPARK;
// Each face's slope: along its point, and across it.
const ALONG = PEAK / SPARK, ACROSS = PEAK * (SPARK - NOTCH) / (NOTCH * SPARK), FACE = Math.hypot(NOTCH, SPARK - NOTCH);

/* ---------- the light ---------- */
const SUN = unit(-.5, .62, .6), SUN_HALF = unit(SUN[0], SUN[1], SUN[2] + 1);
const FAR = unit(.5, -.52, .69);          // where the sun's light comes out of the drop again
const FILL = unit(.7, .1, .7);            // the cooler light from the other side

// The colours, by day and by night: the landing's Morning and Night (see ../landing/scene.js).
const look = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? rgb(v) : v]));
export const LOOKS = {
  day: look({
    tip: '#A9CCFF', body: '#4B84F7', deep: '#2857E6', shade: '#2440BC',      // the water, from its point down, and its shaded side
    gather: '#8FD8FF', gatherAmt: .78,                                         // the light that gathers on its far side
    zenith: '#8FB6F6', horizon: '#EAF1FF', sea: '#2F52C4', mirror: .4,         // what it reflects
    sun: '#FFFFFF', rim: '#FFE2B5', fill: '#C9D8FF',
    spark: '#F5B83D', sparkLit: '#FFEDB0', sparkShade: '#E8982C', sparkHot: '#FFF8E2', halo: '#FFCB5C', haloAmt: .2,
    ground: '#1C2C5C', groundAmt: .24                                          // its shadow on the page
  }),
  night: look({
    tip: '#C9D9FF', body: '#7396FF', deep: '#4666EA', shade: '#3046B4',
    gather: '#BFE3FF', gatherAmt: .7,
    zenith: '#39448E', horizon: '#8E9AE0', sea: '#27357A', mirror: .42,
    sun: '#F2F5FF', rim: '#C6D2FF', fill: '#8FA2E6',
    spark: '#FFC857', sparkLit: '#FFF0BA', sparkShade: '#E79A32', sparkHot: '#FFFBEA', halo: '#FFC857', haloAmt: .34,
    ground: '#6E95FF', groundAmt: .2                                           // at night, its glow on the page instead
  })
};

/* ---------- where it sits ---------- */
// How the logo sits in its square: the drop's middle (x and y, from the top left, as parts of
// the square), how big a drop radius is, and whether its shadow is drawn under it.
export const FRAMES = {
  mark: { x: .46, y: .572, scale: .262, ground: true },      // the header: room to bob, and a shadow to bob over
  icon: { x: .47, y: .628, scale: .338, ground: false },     // an icon: as big as the square allows
  tile: { x: .47, y: .575, scale: .235, ground: true },      // on a tile of sky, with room round it
  avatar: { x: .47, y: .59, scale: .245, ground: true }      // a profile picture: on sky, inside the circle it's cut to
};

/* ---------- how it moves ---------- */
const BOB = .07;      // how far the drop rides up and down, in drop radii
const bell = (x, mid, half) => { const u = (x - mid) / half; return u > -1 && u < 1 ? (1 - u * u) * (1 - u * u) : 0; };
/**
 * The pose at time t (seconds). `nudge` is how long ago someone last touched it: it wobbles,
 * and the spark turns, and both settle.
 */
export function poseAt(t = 0, nudge = Infinity){
  const s = ((t % LOOP) + LOOP) % LOOP, turn = TAU * s / LOOP;
  const P = {
    bob: BOB * Math.sin(turn * 2),                     // up and down, twice a loop
    stretch: .016 * Math.sin(turn * 2 + 1.9),          // and a little longer or rounder as it goes
    lean: 0,
    drift: turn,                                       // the light in the water
    // a glint crosses from the lower left to the upper right, and reaches the spark
    glint: smooth(.5, 1.75, s) * 4.4 - 1.9, glintAmt: bell(s, 1.12, .66),
    // which sets the spark off: it swells, flares, and turns half round on its own axis
    swell: bell(s, 2.0, .62) + .45 * bell(s, 5.6, .5), spin: Math.PI * smooth(1.5, 2.6, s)
  };
  if (nudge >= 0 && nudge < 2.2) {
    const fade = Math.exp(-2.6 * nudge);
    P.stretch += .075 * fade * Math.sin(13 * nudge);
    P.lean += .06 * fade * Math.sin(9.5 * nudge);
    P.swell += bell(nudge, .34, .34) * .9;
    P.spin += Math.PI * smooth(.05, .8, nudge);
  }
  return P;
}

/**
 * Draw the logo into `px`, an RGBA array of size × size pixels, straight (not premultiplied)
 * alpha, clear wherever the logo isn't.
 */
export function drawLogo(px, size, { t = 0, look: K = LOOKS.day, frame: F = FRAMES.mark, nudge = Infinity } = {}){
  const P = poseAt(t, nudge);
  px.fill(0);
  const s = F.scale * size, inv = 1 / s, cx = F.x * size, cy = F.y * size;
  // The drop, a little longer or rounder: what it gains in height it loses in girth.
  const tall = 1 + P.stretch, girth = 1 / Math.sqrt(tall), mid = P.bob;
  // The spark rides with the drop, half as far.
  const sx = SPARK_AT[0], sy = SPARK_AT[1] + P.bob * .5, big = 1 + .2 * P.swell;
  const spin = ((P.spin + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2, cosS = Math.cos(spin), sinS = Math.sin(spin), thin = Math.max(Math.abs(cosS), .07);
  // Its shadow, smaller and fainter the higher the drop rides.
  const lift = P.bob / BOB, gy = -1.31, grx = .66 * (1 - .12 * lift), gry = .115 * (1 - .12 * lift), gAmt = F.ground ? K.groundAmt * (1 - .22 * lift) : 0;
  const glow = .5 + .5 * Math.sin(P.drift), glow2 = P.drift * 3, glow3 = P.drift * 2;
  // The glow round the spark and the rays it throws reach further when it flares, and never past the square's edge.
  const room = Math.min(size - cx - sx * s, cy - sy * s) * inv * .97;
  const haloR = Math.min(room, SPARK * (2.3 + 1.5 * P.swell)), haloAmt = K.haloAmt * (.6 + 1.1 * P.swell), ray = Math.min(room, SPARK * (1.25 + 1.5 * P.swell)), rayAmt = Math.min(1, P.swell) * .8;
  const sparkLight = .16 + .3 * P.swell;

  let o = 0;
  for (let Y = 0; Y < size; Y++) {
    const y = (cy - Y - .5) * inv;
    // this row of the drop: how wide it is here, and how that's changing
    const qy = (y - mid) / tall;
    let wide = 0, slope = 0;
    if (qy > 0 && qy < TIP) { const f = qy / TIP * STEPS, i = f | 0, u = f - i; wide = WIDE[i] + (WIDE[i + 1] - WIDE[i]) * u; slope = SLOPE[i] + (SLOPE[i + 1] - SLOPE[i]) * u; }
    const inDrop = qy > -1.05 && qy < TIP + .05, inSpark = Math.abs(y - sy) < Math.max(haloR, ray, SPARK * big + inv), inGround = gAmt > 0 && Math.abs(y - gy) < gry * 1.02;
    if (!inDrop && !inSpark && !inGround) { o += size * 4; continue; }
    for (let X = 0; X < size; X++, o += 4) {
      const x = (X + .5 - cx) * inv;
      let r = 0, g = 0, b = 0, a = 0;      // what's drawn so far, back to front

      /* the shadow on the page */
      if (inGround) {
        const d = Math.hypot(x / grx, (y - gy) / gry);
        if (d < 1) { a = gAmt * (1 - d * d) * (1 - d * d); r = K.ground[0] * a; g = K.ground[1] * a; b = K.ground[2] * a; }
      }

      /* the drop */
      if (inDrop) {
        const qx = (x - P.lean * qy * tall) / girth;
        let edge;
        if (qy <= 0) edge = 1 - Math.hypot(qx, qy);
        else if (qy < TIP) edge = (wide - Math.abs(qx)) / Math.sqrt(1 + slope * slope);
        else edge = -Math.hypot(qx, qy - TIP);
        const cover = clamp(edge * s * girth + .5, 0, 1);
        if (cover > 0) {
          const rad = qy <= 0 ? Math.sqrt(Math.max(1 - qy * qy, 0)) : wide, cl = clamp(qx, -rad, rad), z = Math.sqrt(Math.max(rad * rad - cl * cl, 0));
          // which way the surface faces here
          let nx = cl, ny = qy <= 0 ? qy : -rad * slope, nz = z;
          nx = nx / girth; ny = (ny - P.lean * cl / girth) / tall; nz = nz / girth;
          const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl;
          const h = clamp((qy + 1) / (TIP + 1), 0, 1), sunny = nx * SUN[0] + ny * SUN[1] + nz * SUN[2], lit = clamp(sunny * .5 + .5, 0, 1);
          // the water: deep at the round end, pale at the point
          let k = smooth(0, .62, h), cr = K.deep[0] + (K.body[0] - K.deep[0]) * k, cg = K.deep[1] + (K.body[1] - K.deep[1]) * k, cb = K.deep[2] + (K.body[2] - K.deep[2]) * k;
          k = smooth(.5, 1, h); cr += (K.tip[0] - cr) * k; cg += (K.tip[1] - cg) * k; cb += (K.tip[2] - cb) * k;
          // soft light and shade, as on the plants
          k = .9 + .16 * lit; cr *= k; cg *= k; cb *= k;
          k = (1 - lit) * (1 - lit) * .3; cr += (K.shade[0] - cr) * k; cg += (K.shade[1] - cg) * k; cb += (K.shade[2] - cb) * k;
          // light gathers on the side away from the sun, and ripples there
          // (a soft glow inside, and a brighter crescent just in from the edge)
          const graze = 1 - nz, far = nx * FAR[0] + ny * FAR[1] + nz * FAR[2], away = (nx * .69 - ny * .72) / (Math.sqrt(nx * nx + ny * ny) + 1e-6);
          const ripple = Math.sin(5.4 * qx + 3.2 * qy - glow2) * Math.sin(-2.4 * qx + 4.6 * qy + glow3);
          k = (smooth(.3, 1, far) * .34 + smooth(.25, .72, graze) * (1 - .5 * smooth(.8, 1, graze)) * smooth(.15, .95, away) * .8) * K.gatherAmt * (.9 + .1 * glow + .16 * ripple);
          k = clamp(k, 0, 1); cr += (K.gather[0] - cr) * k; cg += (K.gather[1] - cg) * k; cb += (K.gather[2] - cb) * k;
          // the sky in it: more of it the more the surface turns away
          const fres = graze * graze * graze, up = 2 * nz * ny;
          const e = up > 0 ? smooth(0, .9, up) : -smooth(0, .8, -up), E = e > 0 ? K.zenith : K.sea, ea = Math.abs(e);
          k = (.05 + .95 * fres) * K.mirror;
          cr += (K.horizon[0] + (E[0] - K.horizon[0]) * ea - cr) * k; cg += (K.horizon[1] + (E[1] - K.horizon[1]) * ea - cg) * k; cb += (K.horizon[2] + (E[2] - K.horizon[2]) * ea - cb) * k;
          // a warm edge where the sun catches it, and a cool one from the other side
          k = fres * clamp(sunny + .25, 0, 1) * .4; cr += (K.rim[0] - cr) * k; cg += (K.rim[1] - cg) * k; cb += (K.rim[2] - cb) * k;
          k = clamp(nx * FILL[0] + ny * FILL[1] + nz * FILL[2], 0, 1); k = k * k * k * .16; cr += (K.fill[0] - cr) * k; cg += (K.fill[1] - cg) * k; cb += (K.fill[2] - cb) * k;
          // the spark's own light on the drop's shoulder
          {
            const lx = sx - x, ly = sy - y, lz = .45, ll = 1 / Math.hypot(lx, ly, lz), d = clamp((nx * lx + ny * ly + nz * lz) * ll, 0, 1);
            k = d * d * sparkLight / (1 + 1.6 * (lx * lx + ly * ly)); cr += (K.halo[0] - cr) * k; cg += (K.halo[1] - cg) * k; cb += (K.halo[2] - cb) * k;
          }
          // the sun itself, as a bright spot and the soft bloom round it
          let sp = clamp(nx * SUN_HALF[0] + ny * SUN_HALF[1] + nz * SUN_HALF[2], 0, 1); sp *= sp; sp *= sp; const bloom = sp * sp; sp = bloom * bloom; sp *= sp; sp *= sp;
          k = clamp(smooth(.25, .7, sp) * .96 + bloom * .16, 0, 1); cr += (K.sun[0] - cr) * k; cg += (K.sun[1] - cg) * k; cb += (K.sun[2] - cb) * k;
          // the glint crossing it
          if (P.glintAmt > 0) {
            const w = (qx * .64 + qy * .77 - P.glint) / .26;
            if (w > -2.2 && w < 2.2) { k = Math.exp(-w * w) * P.glintAmt * (.34 + .5 * fres); cr += (1 - cr) * k; cg += (1 - cg) * k; cb += (1 - cb) * k; }
          }
          r = cr * cover + r * (1 - cover); g = cg * cover + g * (1 - cover); b = cb * cover + b * (1 - cover); a = cover + a * (1 - cover);
        }
      }

      /* the spark, the glow round it, and the rays it throws when it flares */
      if (inSpark) {
        const dx = x - sx, dy = y - sy, d2 = dx * dx + dy * dy;
        if (d2 < haloR * haloR) {
          let k = 1 - d2 / (haloR * haloR); k = haloAmt * k * k * k;
          r = K.halo[0] * k + r * (1 - k); g = K.halo[1] * k + g * (1 - k); b = K.halo[2] * k + b * (1 - k); a = k + a * (1 - k);
        }
        if (rayAmt > .01) {
          const ax = Math.abs(dx), ay = Math.abs(dy), along = Math.max(ax, ay), across = Math.min(ax, ay);
          if (along < ray && across < .12) {
            // each ray narrows to nothing at its end, and is never thinner than a pixel can show
            const reach = 1 - along / ray, w = Math.max(.05 * reach, .55 * inv), k = rayAmt * reach * reach * Math.exp(-across * across / (w * w));
            r = K.sparkHot[0] * k + r * (1 - k); g = K.sparkHot[1] * k + g * (1 - k); b = K.sparkHot[2] * k + b * (1 - k); a = k + a * (1 - k);
          }
        }
        const u = dx / (thin * big), v = dy / big, au = Math.abs(u), av = Math.abs(v), hi = au > av ? au : av, lo = au > av ? av : au;
        const gauge = (NOTCH * hi + (SPARK - NOTCH) * lo) / (NOTCH * SPARK);
        const cover = clamp((1 - gauge) * NOTCH * SPARK / FACE * s * big * (au > av ? thin : 1) + .5, 0, 1);
        if (cover > 0) {
          // the face this is on, turned with the spark
          let nx = (u < 0 ? -1 : 1) * (au > av ? ALONG : ACROSS), ny = (v < 0 ? -1 : 1) * (au > av ? ACROSS : ALONG), nz = 1;
          const nl = 1 / Math.hypot(nx, ny, nz); nx *= nl; ny *= nl; nz *= nl;
          const tx = nx * cosS + nz * sinS, tz = Math.abs(nz * cosS - nx * sinS);
          const lit = clamp((tx * SUN[0] + ny * SUN[1] + tz * SUN[2]) * .62 + .46, 0, 1), core = clamp(1 - gauge, 0, 1);
          let cr, cg, cb, k;
          if (lit < .5) { k = lit * 2; cr = K.sparkShade[0] + (K.spark[0] - K.sparkShade[0]) * k; cg = K.sparkShade[1] + (K.spark[1] - K.sparkShade[1]) * k; cb = K.sparkShade[2] + (K.spark[2] - K.sparkShade[2]) * k; }
          else { k = lit * 2 - 1; cr = K.spark[0] + (K.sparkLit[0] - K.spark[0]) * k; cg = K.spark[1] + (K.sparkLit[1] - K.spark[1]) * k; cb = K.spark[2] + (K.sparkLit[2] - K.spark[2]) * k; }
          // hot in the middle, hotter when it flares
          k = clamp(core * core * (.35 + .9 * P.swell) + P.swell * .25, 0, 1); cr += (K.sparkHot[0] - cr) * k; cg += (K.sparkHot[1] - cg) * k; cb += (K.sparkHot[2] - cb) * k;
          r = cr * cover + r * (1 - cover); g = cg * cover + g * (1 - cover); b = cb * cover + b * (1 - cover); a = cover + a * (1 - cover);
        }
      }

      if (a > 0) { const k = 255 / a; px[o] = r * k; px[o + 1] = g * k; px[o + 2] = b * k; px[o + 3] = a * 255; }
    }
  }
  return px;
}
