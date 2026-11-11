// The four little plants that stand for how far along a project is: a seed (an idea, nothing
// built), a seedling (just started), a young plant (it works, still taking shape) and an
// established one (people rely on it). Each is built from a few smooth shapes on a mound of
// soil, so they read as one family at any size. `buildPlant(stage)` returns a THREE.Group
// about 2 units wide, standing on y = 0.
import * as THREE from 'three';

export const PLANT_STAGES = ['seed', 'seedling', 'young', 'established'];

const INK = { soil: '#6f4e3c', soilTop: '#86634e', seed: '#dcb680', seedTip: '#f0d6a8', stem: '#74ad63', leaf: '#7cc873', leafDeep: '#5bad66', leafNew: '#aede83', petal: '#bcd4ff', heart: '#ffd98a' };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...o });
// A leaf lets some light through, so its shaded side glows a little rather than going dark.
const leafy = color => mat(color, { side: THREE.DoubleSide, roughness: .6, emissive: color, emissiveIntensity: .2 });
const M = {
  soil: mat(INK.soil, { roughness: .96 }), seed: mat(INK.seed, { roughness: .46 }), stem: mat(INK.stem, { roughness: .7, emissive: INK.stem, emissiveIntensity: .12 }),
  leaf: leafy(INK.leaf), leafDeep: leafy(INK.leafDeep), leafNew: leafy(INK.leafNew),
  petal: mat(INK.petal, { roughness: .5, emissive: INK.petal, emissiveIntensity: .28 }), heart: mat(INK.heart, { roughness: .5, emissive: INK.heart, emissiveIntensity: .2 })
};

// A small, repeatable source of variety, so every build of a stage is the same plant.
function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const TOP = .3, R = .86; // how high the mound stands (where things are planted), and how wide it is
/** The mound every plant stands in: a low dome of soil, a little uneven, lighter on top. */
function mound(){
  const g = new THREE.SphereGeometry(1, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position, r = rng(7);
  const colors = new Float32Array(p.count * 3), top = new THREE.Color(INK.soilTop), side = new THREE.Color(INK.soil), c = new THREE.Color();
  const bump = (x, z) => .035 * Math.sin(x * 5.1 + 1.3) * Math.cos(z * 4.3 - .7) + .02 * Math.sin((x + z) * 9.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), lift = 1 + bump(x, z) * (1 - y * .5);
    p.setXYZ(i, x * lift * R, y * TOP * lift, z * lift * R);
    c.copy(side).lerp(top, Math.pow(y, 1.6)).offsetHSL(0, 0, (r() - .5) * .025); colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = M.soil.clone(); m.vertexColors = true; m.color.set('#ffffff');
  const mesh = new THREE.Mesh(g, m);
  // a few crumbs, so it reads as earth rather than a button
  const crumbs = new THREE.Group(), cg = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = .45 + r() * .45, s = .028 + r() * .03, k = new THREE.Mesh(cg, M.soil); k.position.set(Math.cos(a) * d * R, TOP * Math.sqrt(Math.max(0, 1 - d * d)) + s * .3, Math.sin(a) * d * R); k.scale.set(s, s * .7, s); crumbs.add(k); }
  const out = new THREE.Group(); out.add(mesh, crumbs); return out;
}

/** A stem: a tube along the points given, thick at the base and fine at the tip. */
function stem(points, r0, r1){
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segs = 26, radial = 10;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), p = g.attributes.position, center = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPoint(i / segs, center); const rad = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(center).multiplyScalar(rad).add(center); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return { mesh: new THREE.Mesh(g, M.stem), curve };
}

/**
 * A leaf, lying along +z from its stalk: `len` long and `wide` across, round or pointed,
 * folded a little along its midrib and curling down toward the tip.
 */
function leafGeometry({ len = 1, wide = .5, point = .72, fold = .13, droop = .3 } = {}){
  const nu = 14, nv = 8, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, w = Math.pow(Math.sin(Math.PI * Math.pow(u, point)), .85) * wide * .5;
    for (let j = 0; j <= nv; j++) { const v = j / nv * 2 - 1; pos.push(v * w, Math.abs(v) * w * fold * 2 - droop * u * u * len + .06 * len * Math.sin(u * Math.PI), u * len); }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Put a leaf on a plant: where it joins, which way round the stem it faces, and how far it lifts. */
function leafAt(geometry, material, at, turn, lift, scale = 1){
  const m = new THREE.Mesh(geometry, material), hold = new THREE.Group();
  m.rotation.x = -lift; m.scale.setScalar(scale);
  hold.add(m); hold.position.set(...at); hold.rotation.y = turn; return hold;
}
/** A small flower: five petals round a warm heart. */
function flower(at, size, turn){
  const g = new THREE.Group(), pg = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.Mesh(pg, M.petal); p.scale.set(.6, .16, .36); p.position.set(Math.cos(a) * .62, 0, Math.sin(a) * .62); p.rotation.set(0, -a, .25); g.add(p); }
  const h = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 10), M.heart); h.scale.y = .6; h.position.y = .06; g.add(h);
  g.scale.setScalar(size); g.position.set(...at); g.rotation.set(.35, turn, .15); return g;
}

const BUILD = {
  // An idea: a seed lying in the soil, not yet anything.
  seed(g){
    const sg = new THREE.SphereGeometry(1, 40, 28), sp = sg.attributes.position, tint = new Float32Array(sp.count * 3), a = new THREE.Color(INK.seed), b = new THREE.Color(INK.seedTip), c = new THREE.Color();
    for (let i = 0; i < sp.count; i++) {                       // an almond: drawn to a point at one end, paler there
      const z = sp.getZ(i), t = (z + 1) / 2, k = 1 - .5 * Math.pow(t, 2.2);
      sp.setXYZ(i, sp.getX(i) * k, sp.getY(i) * k, z + .22 * Math.pow(t, 3));
      c.copy(a).lerp(b, Math.pow(t, 2.5)); tint.set([c.r, c.g, c.b], i * 3);
    }
    sg.setAttribute('color', new THREE.BufferAttribute(tint, 3)); sg.computeVertexNormals();
    const sm = M.seed.clone(); sm.vertexColors = true; sm.color.set('#ffffff');
    const s = new THREE.Mesh(sg, sm);
    s.scale.set(.2, .14, .26); s.position.set(-.02, TOP + .05, .08); s.rotation.set(-.32, .9, .35); g.add(s);
    const dimple = new THREE.Mesh(new THREE.TorusGeometry(.26, .045, 10, 36), M.soil); dimple.rotation.x = Math.PI / 2; dimple.scale.set(1, 1.2, .5); dimple.position.set(-.02, TOP - .014, .08); g.add(dimple);
  },
  // Just started: a short stem and its first two leaves.
  seedling(g){
    const { mesh, curve } = stem([[0, TOP - .05, 0], [.02, TOP + .2, .01], [-.03, TOP + .42, 0], [-.02, TOP + .56, .01]], .05, .032); g.add(mesh);
    const tip = curve.getPoint(1).toArray(), first = leafGeometry({ len: .5, wide: .4, point: .9, fold: .08, droop: .34 });
    g.add(leafAt(first, M.leaf, tip, .75, .34), leafAt(first, M.leaf, tip, .75 + Math.PI, .34));
    g.add(leafAt(leafGeometry({ len: .22, wide: .14, fold: .3, droop: .1 }), M.leafNew, tip, 2.3, 1.2));
  },
  // It works and it's still taking shape: a stem with leaves up it.
  young(g){
    const { mesh, curve } = stem([[0, TOP - .05, 0], [.05, TOP + .35, .02], [-.05, TOP + .8, -.02], [.02, TOP + 1.15, 0], [0, TOP + 1.38, .01]], .07, .03); g.add(mesh);
    const big = leafGeometry({ len: .8, wide: .5 }), mid = leafGeometry({ len: .62, wide: .4 }), small = leafGeometry({ len: .4, wide: .26, droop: .2, fold: .2 });
    [[.2, big, .5, .3, M.leafDeep], [.33, big, .5 + 2.4, .34, M.leaf], [.47, mid, .5 + 4.8, .4, M.leafDeep], [.6, mid, .5 + 7.2, .46, M.leaf], [.74, mid, .5 + 9.6, .52, M.leaf], [.86, small, .5 + 12, .66, M.leaf], [.95, small, .5 + 14.4, .8, M.leafNew]]
      .forEach(([t, geo, turn, lift, m]) => g.add(leafAt(geo, m, curve.getPoint(t).toArray(), turn, lift)));
    g.add(leafAt(leafGeometry({ len: .22, wide: .1, fold: .3, droop: .05 }), M.leafNew, curve.getPoint(1).toArray(), 1, 1.4));
  },
  // People rely on it: several stems, full of leaf, and in flower.
  established(g){
    const r = rng(41), big = leafGeometry({ len: .8, wide: .5 }), mid = leafGeometry({ len: .62, wide: .4 }), small = leafGeometry({ len: .4, wide: .26, droop: .2, fold: .2 });
    const stems = [
      [[0, TOP - .05, 0], [.04, TOP + .5, .03], [-.04, TOP + 1.05, -.02], [.03, TOP + 1.5, .02], [0, TOP + 1.78, 0]],
      [[.1, TOP - .05, .06], [.3, TOP + .4, .16], [.52, TOP + .82, .22], [.62, TOP + 1.18, .2]],
      [[-.1, TOP - .05, .02], [-.32, TOP + .38, .1], [-.55, TOP + .78, .06], [-.68, TOP + 1.1, 0]],
      [[0, TOP - .05, -.1], [-.08, TOP + .4, -.3], [.02, TOP + .85, -.48], [.1, TOP + 1.22, -.55]]
    ];
    stems.forEach((pts, k) => {
      const { mesh, curve } = stem(pts, k ? .055 : .075, .028); g.add(mesh);
      const n = k ? 6 : 8, start = r() * 6;
      for (let i = 0; i < n; i++) {
        const t = .22 + .7 * i / (n - 1), geo = t < .5 ? big : t < .8 ? mid : small;
        g.add(leafAt(geo, [M.leafDeep, M.leaf, M.leaf][i % 3], curve.getPoint(t).toArray(), start + i * 2.4, .28 + t * .4, k ? .85 : 1));
      }
      const tip = curve.getPoint(1);
      g.add(flower([tip.x, tip.y + .04, tip.z], k ? .2 : .24, r() * 6));
    });
    // low leaves round the base, so it sits full on the mound
    for (let i = 0; i < 6; i++) g.add(leafAt(mid, i % 2 ? M.leafDeep : M.leaf, [0, TOP - .01, 0], i / 6 * Math.PI * 2 + .4, .22 + r() * .16, .95));
  }
};

/** One plant, standing on y = 0: a mound of soil and whatever has come up out of it. */
export function buildPlant(stage){
  const g = new THREE.Group(); g.name = stage;
  g.add(mound());
  (BUILD[stage] || BUILD.young)(g);
  return g;
}
