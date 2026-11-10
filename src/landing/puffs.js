// How the landing draws a cloud: the same way atmosphere.online's sky does. A cloud is a few
// hundred soft, lit sphere impostors ("puffs") with noisy, eroded edges, sun on one side and
// a warm rim on the other, fading into haze with distance. This file is that sky's puff
// material and two of its cloud shapes, brought over from atmosphere.online (src/puff3d.js
// and the generators in src/sky.js), with the parts Rainshare doesn't need left behind
// (picking, lightning, tints, the far ring's own haze curve).
import { ShaderMaterial, DataTexture, RGBAFormat, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, CustomBlending, OneFactor, OneMinusSrcAlphaFactor } from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rngAt = (seed, i) => { const r = mulberry((seed * 7919 + i * 104729 + 17) | 0); r(); return r; };

/** Tileable value noise as a texture: for the puffs' edges, and the ripples on the sea. */
export function makeNoise(size, rand = Math.random){
  const oct = [[4, .42], [8, .28], [16, .16], [32, .09], [64, .05]];
  const grids = oct.map(([p]) => { const g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = rand(); return g; });
  const sum = oct.reduce((s, o) => s + o[1], 0), tmp = new Float32Array(size * size);
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    let v = 0;
    for (let k = 0; k < oct.length; k++){
      const p = oct[k][0], g = grids[k], fx = x / size * p, fy = y / size * p, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const x0 = ix % p, x1 = (ix + 1) % p, y0 = iy % p, y1 = (iy + 1) % p;
      const a = g[y0 * p + x0], b = g[y0 * p + x1], c = g[y1 * p + x0], d = g[y1 * p + x1];
      v += oct[k][1] * ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty);
    }
    v /= sum; tmp[y * size + x] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++){ const v = Math.round((tmp[i] - lo) / (hi - lo) * 255); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

// One material for a batch of puffs. Each puff is an instance: aPos (where), aRad (how big),
// aData (overall light, storm shade, alpha, seed), aEro (how ragged its edge is) and aShape
// (an axis in world space and the stretch along it; w = 1 for a round puff). `uTime` and
// `uSunView` are { value } objects the caller keeps up to date; the colours are Color objects
// it can change (the scene does, between day and night).
// A stretched puff is a spheroid, and seen from anywhere it's an ellipse: the vertex shader
// projects the axis onto the screen, finds the ellipse's two axes, and lays the quad along
// them. The fragment shader then works in the quad's own (round) space, so the noise
// stretches with the puff, and a long streak gets it combed into fibres (a shaft of rain);
// a squashed one (w < 1) is a pancake (a cloud's level base).
// The colours go to the screen as they're given, the way the sky they came from draws them,
// so hand them in unconverted (see `raw` in scene.js).
export function puffMaterial(o){
  return new ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
    uniforms: { uTime: o.uTime, uNoise: { value: o.noise }, uSunView: o.uSunView, uLit: { value: o.lit }, uShadow: { value: o.shadow }, uRim: { value: o.rim }, uStorm: { value: o.storm }, uFog: { value: o.fog }, uFogNear: o.fogNear, uFogFar: o.fogFar, uFogMax: o.fogMax, uBillow: { value: o.billow } },
    vertexShader: `
      attribute vec3 aPos; attribute float aRad; attribute vec4 aData; attribute float aEro; attribute vec4 aShape;
      uniform float uTime, uFogNear, uFogFar, uFogMax, uBillow;
      varying vec2 vUv; varying vec4 vData; varying float vEro; varying float vFog; varying vec2 vE1; varying float vFiber; varying float vFlat;
      void main(){
        vec4 mv = viewMatrix * vec4(aPos, 1.0);
        float r = aRad * (1.0 + 0.045 * uBillow * sin(uTime * 0.8 + aData.w * 40.0));
        // the spheroid's outline on screen, in units of r: I + k a a^T, a being its axis as seen from here
        vec2 a = (mat3(viewMatrix) * aShape.xyz).xy;
        float k = aShape.w * aShape.w - 1.0;
        float cxx = 1.0 + k * a.x * a.x, cyy = 1.0 + k * a.y * a.y, cxy = k * a.x * a.y;
        float m = 0.5 * (cxx + cyy), dl = sqrt(0.25 * (cxx - cyy) * (cxx - cyy) + cxy * cxy);
        float l1 = m + dl, l2 = max(m - dl, 0.0004);
        vec2 e1 = abs(cxy) > 1e-5 ? normalize(vec2(l1 - cyy, cxy)) : (cxx >= cyy ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
        mv.xy += (position.x * sqrt(l1) * e1 + position.y * sqrt(l2) * vec2(-e1.y, e1.x)) * r * 1.25;
        gl_Position = projectionMatrix * mv;
        vUv = position.xy; vData = aData; vEro = aEro; vE1 = e1;
        vFiber = smoothstep(1.7, 3.6, sqrt(l1 / l2));
        vFlat = smoothstep(0.95, 0.45, aShape.w);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z) * uFogMax;
      }`,
    fragmentShader: `
      uniform sampler2D uNoise; uniform float uTime; uniform vec3 uSunView, uLit, uShadow, uRim, uStorm, uFog;
      varying vec2 vUv; varying vec4 vData; varying float vEro; varying float vFog; varying vec2 vE1; varying float vFiber; varying float vFlat;
      void main(){
        vec2 p = vUv * 1.25; float r2 = dot(p, p);
        if (r2 > 1.5625) discard;
        // x runs along the puff's long axis: a streak's noise changes slowly along it and fast across it
        vec2 nuv = vUv * vec2(0.32, 0.32 + vFiber * 0.9) + vData.w * vec2(13.17, 7.71) + uTime * vec2(0.006, 0.0025);
        float nn = texture2D(uNoise, nuv).r * 0.6 + texture2D(uNoise, nuv * 2.6 + 0.43).r * 0.4;
        float ero = vEro;
        // pancakes get softer edges, so a sheet of them melts into one
        float a = smoothstep(0.0, 0.42 + ero * 0.35 + vFlat * 0.3, (1.0 - r2) + (nn - 0.5) * ero * 1.5 - ero * 0.06);
        float alpha = a * vData.z;
        if (alpha < 0.004) discard;
        // p turned back to screen directions, for the light
        vec2 ps = p.x * vE1 + p.y * vec2(-vE1.y, vE1.x);
        float z = sqrt(max(1.0 - min(r2, 1.0), 0.0));
        vec3 N = normalize(vec3(ps * 0.5, z + 0.6));
        // mostly the cloud's own light, a little of the puff's roundness (less for pancakes, so a sheet reads as smooth)
        float L = clamp(mix(dot(N, uSunView) * 0.5 + 0.5, vData.x, 0.75 + vFlat * 0.2) + (nn - 0.5) * (0.2 - vFlat * 0.1), 0.0, 1.0);
        vec3 col = mix(uShadow, uLit, smoothstep(0.0, 0.78, L));
        col = mix(col, uStorm, vData.y);
        float rimF = pow(clamp(1.0 - z, 0.0, 1.0), 1.6) * (1.0 - vFlat * 0.75);
        float svl = length(uSunView.xy);
        float toward = svl > 0.001 ? clamp(dot(normalize(ps + 1e-4), uSunView.xy / svl), 0.0, 1.0) : 0.0;
        col += uRim * rimF * toward * (1.0 - vData.y * 0.7) * (0.3 + 0.5 * clamp(-uSunView.z, 0.0, 1.0));
        col = mix(col, uFog, vFog);
        gl_FragColor = vec4(col * alpha, alpha);
      }`
  });
}

// Puffs come out in the cloud's own space: about 12 units wide at size 1, base at y = 0. A
// puff can be stretched by st along an axis (ax, ay, az; up if left out): over 1 draws a
// streak along it, under 1 a pancake lying across it, 1 (the default) a round puff.
// Puff i depends only on the cloud's seed and i, so asking for more of them adds puffs
// instead of reshuffling the ones already there, and changing shape lets the same puffs
// glide into the new one. That's how a cloud here grows, and how it turns to rain.
export const GEN = {
  /** Flat-bottomed heaps that build on warm afternoons. Fair weather. */
  cumulus(seed, P){
    const R = mulberry(seed), n = Math.round(160 * P.count), out = [];
    const k = 3 + Math.floor(R() * 3), domes = [];
    for (let j = 0; j < k; j++){
      const f = j / (k - 1) - .5, big = 1 - Math.abs(f) * .9, rad = 1.9 + big * 1.9 + R() * .8;
      domes.push({ cx: f * 8.5 + (R() - .5) * 1.2, cz: (R() - .5) * 2.6, rad, H: rad * (.95 + R() * .5) * P.height, w: rad });
    }
    const wsum = domes.reduce((s, d) => s + d.w, 0);
    for (let i = 0; i < n; i++){
      const r = rngAt(seed, i);
      if (r() < .22){
        // the base: wide, flattened puffs, so the bottom reads as one level line
        const x = (r() - .5) * 12.4, pr = (1.15 + r() * .7) * (.75 + P.fluff * .5);
        out.push({ x, y: pr * .3, z: (r() - .5) * 4.8 * (1 - Math.abs(x) / 9), r: pr, sh: .04, st: .42 });
        continue;
      }
      let pick = r() * wsum, d = domes[0];
      for (const q of domes){ pick -= q.w; if (pick <= 0){ d = q; break; } }
      const u = r() * TAU, v = Math.pow(r(), .7), s = Math.sqrt(1 - v * v), rad = Math.pow(r(), .3);
      // most fill the dome; some are small, crisp florets right on its skin, the cauliflower look
      const floret = r() < .2, pr = floret ? (.5 + r() * .3) * (.8 + P.fluff * .4) : (.8 + r() * 1.1) * (1 - rad * .25) * (.7 + P.fluff * .6);
      const reach = floret ? 1.08 : rad;
      const x = d.cx + Math.cos(u) * s * d.rad * 1.2 * reach, z = d.cz + Math.sin(u) * s * d.rad * .95 * reach;
      out.push({ x, y: Math.max(v * d.H * reach + .4, pr * .6), z, r: pr, sh: 0 });
    }
    return out;
  },
  /** A towering thunderhead with an anvil top. Makes it rain. */
  nimbus(seed, P){
    const R = mulberry(seed), n = Math.round(300 * P.count), out = [];
    const H = 9.5 * P.height, shear = 2 + R() * 3;
    for (let i = 0; i < n; i++){
      const r = rngAt(seed, i), q = r();
      let x, y, z, pr, st = 1, ax = 0, ay = 1;
      if (q < .22){ x = (r() - .5) * 13; z = (r() - .5) * 6.4; y = .4 + r() * 1.1; pr = 1.3 + r() * .9; st = .45; }
      else if (q < .62){
        const t = r(), rad = (3.4 - t * .9) * Math.sqrt(r()), u = r() * TAU;
        x = Math.cos(u) * rad + t * shear * .3; z = Math.sin(u) * rad * .85; y = 1.2 + t * H; pr = 1.1 + r() * 1.2;
      } else {
        // the anvil: a flat top that spreads downwind and frays into streaks at its far edge
        const ex = -4 + r() * 15;
        x = ex + shear * .3; z = (r() - .5) * 2 * (3 + .25 * (ex + 4)); y = H + .5 + r() * 1.4 - Math.max(0, ex - 7) * .15;
        pr = (1 + r() * 1.1) * (1 - Math.max(0, ex) / 22);
        if (ex > 6){ ax = 1; ay = 0; st = 1.6 + (ex - 6) * .3; } else st = .42;
      }
      out.push({ x, y, z, r: pr * (.7 + P.fluff * .6), sh: 0, ax, ay, az: 0, st });
    }
    const top = H + 2;
    for (const p of out){ const h = clamp(p.y / top, 0, 1); p.sh = .62 * Math.pow(1 - h, 1.6) + .05; }
    return out;
  }
};
