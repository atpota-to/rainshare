// The four little plants that stand for how far along a project is: a seed (an idea, nothing
// built), a seedling (just started), a young plant (it works, still taking shape) and an
// established one (people rely on it). Each is built from a few smooth shapes on a mound of
// soil, so they read as one family at any size.
//
// They're grown, not drawn once. `buildPlant(stage, kind)` returns a THREE.Group about 2 units
// wide, standing on y = 0, and `kind` (any whole number) says what sort of plant it is: the
// outline, markings and green of its leaves, how they're set round the stem, how tall it stands
// and which way it leans, what its flowers are like, what its seed looked like (a seedling may
// still wear the coat), the colour on the marker where an idea is sown, and the pebbles
// in its soil (see `traitsOf`). A kind keeps all of that from seed to flower, so a project's
// plant is still recognisably its own as it grows. The same kind always grows the same plant,
// and kind 0 is the plant as it was first drawn.
import * as THREE from 'three';

export const PLANT_STAGES = ['seed', 'seedling', 'young', 'established'];

// A small, repeatable source of variety, so every build of a kind is the same plant.
function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TAU = Math.PI * 2, lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const INK = {
  soil: '#6f4e3c', soilTop: '#86634e', stem: '#74ad63', leaf: '#7cc873', leafDeep: '#5bad66', leafNew: '#aede83',
  blush: '#e2a083', bark: '#a4505f', pale: '#eef4cf', rim: '#d98a78', pebble: '#b5aea4'
};

// Leaves, by outline. `wide` is across a leaf 1 long, `point` how far out it's widest (lower is
// nearer the stalk), `fold` how much it folds along its midrib, `droop` how far its tip curls down.
const LEAVES = {
  oval:    { wide: .62, point: .72, fold: .13, droop: .3 },                       // drawn to a point (the first)
  heart:   { wide: .82, point: .5, fold: .1, droop: .26, len: .9, heart: 1 },      // two lobes either side of the stalk
  lance:   { wide: .32, point: .66, fold: .22, droop: .36, len: 1.15 },            // long and narrow
  round:   { wide: .88, point: .95, fold: .07, droop: .2, len: .82 },              // nearly a circle
  lobed:   { wide: .76, point: .8, fold: .12, droop: .28, lobes: .34 },            // scalloped, a little like oak
  ruffled: { wide: .68, point: .78, fold: .1, droop: .26, len: .95, ruffle: .6 }   // a wavy edge
};
// How leaves are set round a stem: one at a time turning round it, in threes, in pairs, or one to each side in turn.
const SETS = ['spiral', 'alternate', 'opposite', 'whorl'];
const BLOOMS = [
  { name: 'sky blue', petal: '#bcd4ff', heart: '#ffd98a' },   // the first
  { name: 'peach', petal: '#ffc4a8', heart: '#fff0b8' },
  { name: 'white', petal: '#fff6ec', heart: '#ffc65a' },
  { name: 'rose', petal: '#f7a8c0', heart: '#fff0a8' },
  { name: 'buttercup', petal: '#ffe07e', heart: '#f0a050' },
  { name: 'pink', petal: '#ffc8dc', heart: '#ffe08f' },
  { name: 'sea glass', petal: '#a9e4ec', heart: '#fff4c8' },
  { name: 'lilac', petal: '#d8c6ff', heart: '#ffeaa8' }
];
// Seeds, by shape: the colours they're painted, and how big they lie in the soil.
const SEEDS = {
  almond:  { base: '#dcb680', tip: '#f0d6a8', size: [.2, .14, .26] },                  // the first
  bean:    { base: '#efe1c3', tip: '#f7eedb', mark: '#4f3d36', size: [.19, .15, .25] }, // cream, with a dark eye
  striped: { base: '#ece8dc', tip: '#f8f4ea', mark: '#4d4c55', size: [.17, .12, .28] }, // like a sunflower's
  pea:     { base: '#c6d48a', tip: '#dde6a6', size: [.15, .15, .15] },
  grain:   { base: '#f3d98e', tip: '#fbedc4', size: [.11, .1, .3] }
};
const LEAF_ORDER = Object.keys(LEAVES), SEED_ORDER = Object.keys(SEEDS);

/**
 * What a kind of plant is like. The outline of its leaves, how they're set, its flowers and its
 * seed go round in turn, so the first dozen kinds are all different in those at least; the
 * rest (its greens, height, lean, how leafy, what's marked on its leaves) is left to chance.
 */
export function traitsOf(kind = 0){
  const k = Math.max(0, Math.floor(Math.abs(Number(kind) || 0))), first = k === 0;
  const r = rng(Math.imul(k, 0x9E3779B1) ^ 0x5EED5);
  const any = (lo, hi, was) => first ? was : lerp(lo, hi, r()), chance = p => !first && r() < p;
  const T = {
    kind: k,
    leaf: LEAF_ORDER[k % LEAF_ORDER.length],
    set: SETS[k % SETS.length],
    bloom: BLOOMS[(k * 5) % BLOOMS.length],
    seed: SEED_ORDER[k % SEED_ORDER.length],
    hue: any(-.045, .04, 0), sat: any(-.14, .06, 0), light: any(-.05, .05, 0),
    tall: any(.9, 1.1, 1), leafSize: any(.88, 1.14, 1), lush: any(.8, 1.25, 1),
    lift: any(-.08, .14, 0), droop: any(.7, 1.3, 1),
    lean: any(0, .13, 0), leanTo: any(0, TAU, 0), bend: any(.02, .07, .045), turn: any(0, TAU, 0),
    bloomSize: any(.86, 1.16, 1), seedTurn: any(0, TAU, .9), seedAt: [any(-.06, .06, 0), any(-.06, .06, 0)],
    soil: any(-.025, .025, 0), soilPhase: [any(0, TAU, 0), any(0, TAU, 0), any(0, TAU, 0)]
  };
  T.blush = chance(.35) ? lerp(.3, .6, r()) : 0;          // new leaves come up bronze
  T.bark = chance(.3) ? lerp(.78, .9, r()) : 0;            // stems run plum red
  const p = first ? 0 : r();
  T.pattern = p < .42 ? 'plain' : p < .72 ? 'veined' : p < .86 ? 'variegated' : 'rimmed';
  T.petals = first ? 5 : [4, 5, 5, 6, 6, 7, 8][Math.floor(r() * 7)];
  T.petalForm = first ? 'round' : T.petals >= 8 ? 'long' : ['round', 'pointed', 'long'][Math.floor(r() * 3)];
  T.cluster = chance(.3);                                  // flowers in little heads of three
  T.stems = first ? 4 : 3 + Math.floor(r() * 3);           // how many an established one has
  T.bud = chance(.5);                                      // a young one in bud
  T.shoot = chance(.4);                                    // a young one putting out a side shoot
  T.husk = chance(.35);                                    // a seedling still wearing its seed coat
  T.pebbles = first ? 0 : Math.floor(r() * 3);
  return T;
}

/** Everything a kind is painted with. Each plant has its own, so taking one down can let go of all of it. */
function inks(T){
  const shift = hex => new THREE.Color(hex).offsetHSL(T.hue, T.sat, T.light);
  const leaf = shift(INK.leaf), deep = shift(INK.leafDeep), fresh = shift(INK.leafNew).lerp(new THREE.Color(INK.blush), T.blush);
  const stem = shift(INK.stem).lerp(new THREE.Color(INK.bark), T.bark), petal = new THREE.Color(T.bloom.petal), heart = new THREE.Color(T.bloom.heart);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...o });
  // A leaf lets some light through, so its shaded side glows a little rather than going dark.
  // Its markings are painted on each leaf as a tint over the leaf's own colour.
  const leafy = color => mat(color, { side: THREE.DoubleSide, roughness: .6, emissive: color, emissiveIntensity: .2, vertexColors: true });
  const tint = hex => { const c = new THREE.Color(hex); return new THREE.Color(Math.min(3, c.r / leaf.r), Math.min(3, c.g / leaf.g), Math.min(3, c.b / leaf.b)); };
  return {
    soilSide: new THREE.Color(INK.soil).offsetHSL(0, 0, T.soil), soilTop: new THREE.Color(INK.soilTop).offsetHSL(0, 0, T.soil),
    soil: mat(new THREE.Color(INK.soil).offsetHSL(0, 0, T.soil), { roughness: .96 }),
    pebble: mat(new THREE.Color(INK.pebble).offsetHSL(T.hue * 2, 0, T.light * .5), { roughness: .62 }),
    seed: mat('#ffffff', { roughness: .46, vertexColors: true }),
    stem: mat(stem, { roughness: .7, emissive: stem, emissiveIntensity: .12 }),
    leaf: leafy(leaf), leafDeep: leafy(deep), leafNew: leafy(fresh),
    marks: { pale: tint(INK.pale), rim: tint(INK.rim) },
    petal: mat(petal, { roughness: .5, emissive: petal, emissiveIntensity: .28 }), heart: mat(heart, { roughness: .5, emissive: heart, emissiveIntensity: .2 })
  };
}

const TOP = .3, R = .86; // how high the mound stands (where things are planted), and how wide it is
/** The mound every plant stands in: a low dome of soil, a little uneven, lighter on top. */
function mound(T, P){
  const g = new THREE.SphereGeometry(1, 56, 22, 0, TAU, 0, Math.PI / 2), p = g.attributes.position, r = rng(7 + T.kind * 101);
  const colors = new Float32Array(p.count * 3), c = new THREE.Color(), [a, b, d] = T.soilPhase;
  const bump = (x, z) => .035 * Math.sin(x * 5.1 + 1.3 + a) * Math.cos(z * 4.3 - .7 + b) + .02 * Math.sin((x + z) * 9.7 + d);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), lift = 1 + bump(x, z) * (1 - y * .5);
    p.setXYZ(i, x * lift * R, y * TOP * lift, z * lift * R);
    c.copy(P.soilSide).lerp(P.soilTop, Math.pow(y, 1.6)).offsetHSL(0, 0, (r() - .5) * .025); colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = P.soil.clone(); m.vertexColors = true; m.color.set('#ffffff');
  const out = new THREE.Group(), on = d => TOP * Math.sqrt(Math.max(0, 1 - d * d));
  out.add(new THREE.Mesh(g, m));
  // a few crumbs, so it reads as earth rather than a button, and for some kinds a pebble or two
  const cg = new THREE.IcosahedronGeometry(1, 2), crumbs = T.kind ? 7 + Math.floor(r() * 5) : 9;
  for (let i = 0; i < crumbs; i++) { const a = r() * TAU, d = .45 + r() * .45, s = .028 + r() * .03, k = new THREE.Mesh(cg, P.soil); k.position.set(Math.cos(a) * d * R, on(d) + s * .3, Math.sin(a) * d * R); k.scale.set(s, s * .7, s); out.add(k); }
  for (let i = 0; i < T.pebbles; i++) {
    const a = r() * TAU, d = .5 + r() * .32, s = .05 + r() * .03, k = new THREE.Mesh(cg, P.pebble);
    k.scale.set(s * 1.35, s * .8, s); k.rotation.set((r() - .5) * .5, r() * TAU, (r() - .5) * .5); k.position.set(Math.cos(a) * d * R, on(d) + s * .35, Math.sin(a) * d * R); out.add(k);
  }
  return out;
}

/** A seed, 2 long along z (pointed end at +z), painted with its colours: lay it where it goes and size it with SEEDS[shape].size. */
function seedGeometry(shape){
  const S = SEEDS[shape] || SEEDS.almond, g = new THREE.SphereGeometry(1, 40, 28), p = g.attributes.position, tint = new Float32Array(p.count * 3);
  const base = new THREE.Color(S.base), tip = new THREE.Color(S.tip), mark = new THREE.Color(S.mark || S.base), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i), t = (z0 + 1) / 2;
    let x = x0, y = y0, z = z0, pale = Math.pow(t, 2.5), dark = 0;
    if (shape === 'almond' || shape === 'striped') {          // drawn to a point at one end, paler there
      const k = 1 - .5 * Math.pow(t, 2.2); x *= k; y *= k; z += .22 * Math.pow(t, 3);
      if (shape === 'striped') dark = .92 * smooth(.2, .7, Math.cos(Math.atan2(y0, x0) * 7)) * (1 - smooth(.55, .95, t));
    } else if (shape === 'bean') {                              // pinched in along one side, with a dark eye on top
      x *= 1 - .3 * Math.max(0, -x0) * (1 - z0 * z0);
      dark = smooth(.8, .93, y0) * (1 - smooth(.2, .4, Math.abs(z0))); pale *= .4;
    } else if (shape === 'grain') {                             // long, tapering to both ends, with a groove down it
      const k = 1 - .42 * z0 * z0; x *= k; y *= k; y -= .2 * Math.exp(-Math.pow(x0 / .24, 2)) * Math.max(0, y0);
    } else if (shape === 'pea') pale *= .5;
    p.setXYZ(i, x, y, z);
    c.copy(base).lerp(tip, pale).lerp(mark, dark); tint.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(tint, 3)); g.computeVertexNormals(); return g;
}

/** A stem: a tube along the points given, thick at the base and fine at the tip. */
function stem(points, r0, r1, material){
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segs = 26, radial = 10;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), p = g.attributes.position, center = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPoint(i / segs, center); const rad = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(center).multiplyScalar(rad).add(center); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return { mesh: new THREE.Mesh(g, material), curve };
}
/**
 * Where a stem goes: up `h` from `base` and out `reach` toward `dir`, leaning the way this kind
 * leans (more toward the top, as if after the light) and bending a little to one side as it goes.
 */
function rise(base, h, reach, dir, T, r, n = 5){
  const bend = (r() - .5) * 2 * T.bend, across = dir + Math.PI / 2, lean = T.lean * h, pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), out = reach * Math.pow(t, .85), wob = bend * Math.sin(TAU * t * .9), sway = lean * t * t;
    pts.push([
      base[0] + Math.cos(dir) * out + Math.cos(across) * wob + Math.cos(T.leanTo) * sway,
      base[1] + h * t,
      base[2] + Math.sin(dir) * out + Math.sin(across) * wob + Math.sin(T.leanTo) * sway
    ]);
  }
  return pts;
}

/**
 * A leaf, lying along +z from its stalk: `len` long and `wide` across, cut to its outline, folded
 * a little along its midrib and curling down toward the tip. Its markings ride along as a tint
 * (`marks` from inks()): a pale midrib, a pale edge or a warm one.
 */
function leafGeometry({ len = 1, wide = .5, point = .72, fold = .13, droop = .3, heart = 0, lobes = 0, ruffle = 0 } = {}, pattern = 'plain', marks = null){
  const nu = 24, nv = 10, pos = [], col = [], idx = [], one = { r: 1, g: 1, b: 1 };
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    let w = (heart ? Math.pow(Math.sin(Math.PI * Math.pow(u, .5)), .6) : Math.pow(Math.sin(Math.PI * Math.pow(u, point)), .85)) * wide * .5;
    if (lobes) w *= 1 - lobes * smooth(.06, .25, u) * (1 - smooth(.82, 1, u)) * (.5 - .5 * Math.cos(u * TAU * 3.5));
    const back = heart * len * .3 * Math.sin(Math.PI * Math.min(u / .55, 1));   // the lobes reach back past the stalk
    for (let j = 0; j <= nv; j++) {
      const v = j / nv * 2 - 1, a = Math.abs(v);
      const wave = ruffle ? ruffle * .45 * w * a * a * Math.sin(u * 15 + (v > 0 ? 0 : 1.9)) : 0;
      pos.push(v * w, a * w * fold * 2 - droop * u * u * len + .06 * len * Math.sin(u * Math.PI) + wave, u * len - back * a);
      let shade = lerp(.86, 1.06, Math.pow(u, .7)), m = one, t = 0;   // a little darker where it joins the stalk
      if (pattern === 'veined') shade += .3 * Math.exp(-Math.pow(v / .16, 2)) * smooth(0, .12, u) * (1 - smooth(.8, 1, u));
      else if (pattern === 'variegated') { m = marks.pale; t = smooth(.5, .92, a) * smooth(0, .15, u); }
      else if (pattern === 'rimmed') { m = marks.rim; t = Math.max(smooth(.62, 1, a), smooth(.8, 1, u)) * .85; }
      col.push(shade * lerp(1, m.r, t), shade * lerp(1, m.g, t), shade * lerp(1, m.b, t));
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** One of this kind's leaves, `size` long: `young` ones are smaller and folded closer, `tiny` is the newest at a tip. */
function leafOf(T, P, size, { young = false, tiny = false } = {}){
  const L = LEAVES[T.leaf], len = size * (L.len || 1) * T.leafSize, o = { ...L, len, wide: len * L.wide, droop: L.droop * T.droop };
  if (young) { o.fold = Math.max(o.fold, .2); o.droop *= .66; }
  if (tiny) { o.fold = .3; o.droop = .1; o.wide = len * Math.min(L.wide, .64); o.lobes = 0; o.ruffle = 0; o.heart = 0; }
  return leafGeometry(o, tiny ? 'plain' : T.pattern, P.marks);
}
const leafSet = (T, P) => ({ big: leafOf(T, P, .8), mid: leafOf(T, P, .62), small: leafOf(T, P, .4, { young: true }), tiny: leafOf(T, P, .22, { tiny: true }) });
/** Put a leaf on a plant: where it joins, which way round the stem it faces, and how far it lifts. */
function leafAt(geometry, material, at, turn, lift, scale = 1){
  const m = new THREE.Mesh(geometry, material), hold = new THREE.Group();
  m.rotation.x = -lift; m.scale.setScalar(scale);
  hold.add(m); hold.position.set(...at); hold.rotation.y = turn; return hold;
}
/**
 * Leaves up a stem, from `t0` to `t1` of the way along it: about `n` of them, big ones low and
 * small ones high, set round it the way this kind sets them. Leaves in pairs or threes come a
 * little smaller and a little more often, so a stem of them is as full as one of single leaves.
 */
function leavesUp(g, curve, n, T, P, r, L, { t0 = .22, t1 = .92, lift = t => .28 + t * .4, scale = 1, start = T.turn + .5, least = 3 } = {}){
  const per = { spiral: 1, alternate: 1, opposite: 2, whorl: 3 }[T.set], size = scale * (per === 1 ? 1 : per === 2 ? .84 : .72);
  const nodes = Math.max(per === 1 ? 2 : least, Math.round(n / per * (per === 1 ? 1 : 1.5)));
  for (let j = 0; j < nodes; j++) {
    const t = t0 + (t1 - t0) * j / (nodes - 1), at = curve.getPoint(t).toArray(), geo = t < .5 ? L.big : t < .8 ? L.mid : L.small;
    const step = T.set === 'spiral' ? j * 2.4 : T.set === 'alternate' ? j * Math.PI : T.set === 'opposite' ? j * Math.PI / 2 : j * Math.PI / 3;
    for (let m = 0; m < per; m++)
      g.add(leafAt(geo, [P.leafDeep, P.leaf, P.leaf][(j + m) % 3], at, start + step + m * TAU / per + (r() - .5) * .3, lift(t) + T.lift + (r() - .5) * .1, size));
  }
}

const PETALS = { round: [.6, .36, .62, 0], pointed: [.68, .3, .64, .62], long: [.82, .2, .7, .3] }; // long, wide, how far out, how much it tapers
function petalGeometry(form){
  const g = new THREE.SphereGeometry(1, 16, 10), taper = PETALS[form][3];
  if (taper) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - taper * Math.pow(Math.max(0, p.getX(i)), 2); p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); }
  return g;
}
/** A plant marker's tag: a slab `w` wide and `h` tall with rounded corners, `d` thick, centred on its middle. */
function tagGeometry(w, h, d){
  const x = w / 2, y = h / 2, c = Math.min(x, y) * .55, sh = new THREE.Shape();
  sh.moveTo(-x + c, -y); sh.lineTo(x - c, -y); sh.quadraticCurveTo(x, -y, x, -y + c); sh.lineTo(x, y - c); sh.quadraticCurveTo(x, y, x - c, y);
  sh.lineTo(-x + c, y); sh.quadraticCurveTo(-x, y, -x, y - c); sh.lineTo(-x, -y + c); sh.quadraticCurveTo(-x, -y, -x + c, -y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return g;
}
/** A small flower: this kind's petals round a warm heart. */
function flower(at, size, turn, T, P, r){
  const g = new THREE.Group(), [len, wid, out] = PETALS[T.petalForm], n = T.petals, w = wid * Math.min(1, Math.sqrt(5 / n));
  for (let i = 0; i < n; i++) {
    const a = (i + (r() - .5) * .15) / n * TAU, p = new THREE.Mesh(P.petalGeo, P.petal);
    p.scale.set(len, n > 6 ? .13 : .16, w); p.position.set(Math.cos(a) * out, 0, Math.sin(a) * out); p.rotation.set(0, -a, .25 + (r() - .5) * .14); g.add(p);
  }
  const h = new THREE.Mesh(P.heartGeo, P.heart); h.scale.set(1, .6, 1).multiplyScalar(n > 6 ? 1.15 : 1); h.position.y = .06; g.add(h);
  g.scale.setScalar(size); g.position.set(...at); g.rotation.set(.35, turn, .15); return g;
}
/** Flowers at the tip of a stem: one, or for some kinds a little head of three on short stalks. */
function bloom(g, tip, size, T, P, r){
  if (!T.cluster) { g.add(flower([tip.x, tip.y + .04, tip.z], size, r() * TAU, T, P, r)); return; }
  for (let i = 0; i < 3; i++) {
    const a = T.turn + i / 3 * TAU + r() * .5, d = size * .62, at = [tip.x + Math.cos(a) * d, tip.y + .05 + r() * .05, tip.z + Math.sin(a) * d];
    g.add(stem([[tip.x, tip.y - .02, tip.z], [lerp(tip.x, at[0], .5), at[1] - .02, lerp(tip.z, at[2], .5)], [at[0], at[1] - .01, at[2]]], .012, .009, P.stem).mesh);
    g.add(flower(at, size * .64, r() * TAU, T, P, r));
  }
}
/** A flower still closed: a bud of the petals' colour in a cup of three small sepals. */
function bud(tip, T, P, L, r){
  const g = new THREE.Group(), b = new THREE.Mesh(P.heartGeo, P.petal);
  b.scale.set(.2, .34, .2); b.position.y = .075; g.add(b);
  for (let i = 0; i < 3; i++) g.add(leafAt(L.tiny, P.leaf, [0, .01, 0], i / 3 * TAU + r(), 1.05, .5));
  g.position.copy(tip); g.rotation.set((r() - .5) * .3, 0, (r() - .5) * .3); return g;
}

const BUILD = {
  // An idea: sown, and not yet anything. The seed is under the soil, so what shows is the
  // marker a gardener leaves where one was planted: a short stake with a tag in the colour
  // this kind will flower in. (The seed used to lie on top, in a ring of soil. On a round
  // mound, a nub in a ring read as something else entirely.)
  seed(g, T, P){
    const [dx, dz] = T.seedAt, x = -.16 + dx * 2, z = -.04 + dz * 2, wood = P.pebble.clone();
    wood.color.set('#D2AE7C'); wood.roughness = .8;
    // The tag is wood too, so it shows on a light page and a dark one alike, with a face of the flower's colour on each side.
    // (It stands shorter than any seedling: each stage is taller than the one before it.)
    const m = new THREE.Group(), stake = new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, .52, 10), wood);
    const tag = new THREE.Mesh(tagGeometry(.46, .3, .05), wood), face = new THREE.Mesh(tagGeometry(.35, .19, .075), P.petal);
    stake.position.y = .19; tag.position.set(0, .43, .02); face.position.copy(tag.position);
    m.add(stake, tag, face);
    m.position.set(x, TOP * Math.sqrt(Math.max(0, 1 - (Math.hypot(x, z) / R) ** 2)) - .05, z);
    m.rotation.set(-.08, Math.sin(T.seedTurn) * .3, .1 + Math.cos(T.seedTurn) * .07);
    g.add(m);
  },
  // Just started: a short stem, its two seed leaves, and the first of its own.
  seedling(g, T, P, r){
    const { mesh, curve } = stem(rise([0, TOP - .05, 0], .61 * T.tall, 0, T.turn, T, r, 4), .05, .032, P.stem); g.add(mesh);
    const tip = curve.getPoint(1).toArray(), long = T.leaf === 'lance' || T.leaf === 'lobed';
    const cl = long ? .56 : .5, coty = leafGeometry(long ? { len: cl, wide: .26, point: .8, fold: .12, droop: .34 } : { len: cl, wide: .4, point: .9, fold: .08, droop: .34 });
    const a = T.turn + .75, s = lerp(.92, 1.08, r()), one = leafAt(coty, P.leaf, tip, a, .34 + T.lift * .5, s);
    g.add(one, leafAt(coty, P.leaf, tip, a + Math.PI + (r() - .5) * .3, .34 + T.lift * .5 + (r() - .5) * .1, s));
    // the first true leaf, already the shape this kind's leaves will be (a pair of them, crosswise, for kinds that grow in pairs or threes)
    const first = leafOf(T, P, .26, { young: true });
    if (T.set === 'opposite' || T.set === 'whorl') g.add(leafAt(first, P.leafNew, tip, a + Math.PI / 2, 1.05, .9), leafAt(first, P.leafNew, tip, a - Math.PI / 2, 1.1, .85));
    else g.add(leafAt(first, P.leafNew, tip, T.turn + 2.3, 1.1));
    if (T.husk) {   // the seed coat, still caught on the tip of one seed leaf
      const h = new THREE.Mesh(seedGeometry(T.seed), P.seed);
      h.scale.set(...SEEDS[T.seed].size).multiplyScalar(.5); h.position.set(0, -.34 * .64 * cl + .06 * cl * Math.sin(.8 * Math.PI) + .02, cl * .82); h.rotation.x = .25;
      one.children[0].add(h);
    }
  },
  // It works and it's still taking shape: a stem with leaves up it, and for some kinds a bud or a side shoot.
  young(g, T, P, r){
    const L = leafSet(T, P), { mesh, curve } = stem(rise([0, TOP - .05, 0], 1.43 * T.tall, 0, T.turn, T, r), .07, .03, P.stem); g.add(mesh);
    leavesUp(g, curve, Math.round(7 * T.lush), T, P, r, L, { t0: .2, t1: .95, lift: t => .26 + t * .56 });
    const tip = curve.getPoint(1);
    g.add(T.bud ? bud(tip, T, P, L, r) : leafAt(L.tiny, P.leafNew, tip.toArray(), T.turn + 1, 1.4));
    if (T.shoot) {
      const dir = T.turn + 2.2, s = stem(rise(curve.getPoint(.42).toArray(), .34 * T.tall, .26, dir, T, r, 4), .032, .018, P.stem); g.add(s.mesh);
      leavesUp(g, s.curve, 3, T, P, r, L, { t0: .45, t1: .9, scale: .62, lift: t => .4 + t * .4, least: 2 });
      g.add(leafAt(L.tiny, P.leafNew, s.curve.getPoint(1).toArray(), dir, 1.3, .8));
    }
  },
  // People rely on it: several stems, full of leaf, and in flower.
  established(g, T, P, r){
    const L = leafSet(T, P), K = T.stems;
    const main = stem(rise([0, TOP - .05, 0], 1.83 * T.tall, 0, T.turn, T, r), .075, .028, P.stem); g.add(main.mesh);
    leavesUp(g, main.curve, Math.round(8 * T.lush), T, P, r, L, { start: r() * TAU });
    bloom(g, main.curve.getPoint(1), .24 * T.bloomSize, T, P, r);
    for (let j = 0; j < K - 1; j++) {
      const dir = T.turn + .5 + j / (K - 1) * TAU + (r() - .5) * .5, reach = lerp(.48, .68, r()) * (K > 4 ? .92 : 1), h = lerp(1.12, 1.3, r()) * T.tall;
      const s = stem(rise([Math.cos(dir) * .1, TOP - .05, Math.sin(dir) * .1], h, reach, dir, T, r, 4), .055, .028, P.stem); g.add(s.mesh);
      leavesUp(g, s.curve, Math.round(6 * T.lush), T, P, r, L, { scale: .85, start: r() * TAU });
      bloom(g, s.curve.getPoint(1), .2 * T.bloomSize, T, P, r);
    }
    // low leaves round the base, so it sits full on the mound
    const low = T.kind ? 5 + Math.floor(r() * 3) : 6;
    for (let i = 0; i < low; i++) g.add(leafAt(L.mid, i % 2 ? P.leafDeep : P.leaf, [0, TOP - .01, 0], i / low * TAU + .4 + T.turn, .22 + r() * .16 + T.lift * .5, .95));
  }
};

// Every plant is drawn in the same frame (./live.js), so how big it stands says how far along it
// is. A kind that leans far or spreads wide is drawn in a little to stay inside it.
const REACH = 1.3, HEIGHT = 2.2;
function fit(up){
  up.updateMatrixWorld(true);
  const v = new THREE.Vector3(); let reach = 0, top = 0;
  up.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); reach = Math.max(reach, Math.hypot(v.x, v.z)); top = Math.max(top, v.y); }
  });
  const s = Math.min(1, REACH / reach, (HEIGHT - TOP) / (top - TOP));
  if (s < 1) { up.scale.setScalar(s); up.position.y = TOP * (1 - s); }   // drawn in round where it's planted
}

/** One plant of a kind, standing on y = 0: a mound of soil and whatever has come up out of it. */
export function buildPlant(stage, kind = 0){
  const st = BUILD[stage] ? stage : 'young', T = traitsOf(kind), P = inks(T), g = new THREE.Group(), up = new THREE.Group();
  P.petalGeo = petalGeometry(T.petalForm); P.heartGeo = new THREE.SphereGeometry(.3, 16, 10);
  g.name = `${st}-${T.kind}`;
  g.add(mound(T, P));
  BUILD[st](up, T, P, rng(T.kind * 7919 + PLANT_STAGES.indexOf(st) * 131 + 1));
  if (st !== 'seed') fit(up);
  g.add(up);
  return g;
}

/** Let go of everything a plant was built with (each plant has its own; nothing is shared between them). */
export function disposePlant(g){
  g.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
}
