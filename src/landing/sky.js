// The sky both of the landing's scenes sit under: atmosphere.online's Morning and Night, the
// sun low on the left, and stars after dark. The garden (./garden-scene.js) and the water
// cycle it replaced (./cycle/scene.js) each add the colours of their own ground to these.
import { Vector3, Mesh, SphereGeometry, ShaderMaterial, BackSide } from 'three';

// Day and night: the sky's gradient and its sun, what a cloud is lit and shaded with, the
// haze, rain, the logo's gold, and the light that falls on the ground.
export const SKY = {
  day: {
    top: '#A7C4F2', mid: '#C4D7F6', low: '#E0E5F8', hor: '#F0EBF6', sunCol: '#FFE9C4', stars: 0,
    lit: '#FFFFFF', shadow: '#BCC5EE', rim: '#FFE2B5', storm: '#777BA6', fog: '#E3E7F7', fogMax: .72,
    rain: '#8C93C8', spark: '#F2B33C',
    hemiSky: '#DCE6FB', hemiGround: '#A49DBA', hemi: 1.7, light: '#FFEFD6', sun: 2.2, shade: '#9AA0CC'
  },
  night: {
    top: '#0C1030', mid: '#181F52', low: '#2B3270', hor: '#41478A', sunCol: '#8FA2E6', stars: 1,
    lit: '#B5C0EC', shadow: '#454C88', rim: '#C6D2FF', storm: '#22264A', fog: '#262C5E', fogMax: .78,
    rain: '#6D76B0', spark: '#FFC857',
    hemiSky: '#4A5AA6', hemiGround: '#1A1F44', hemi: 1.5, light: '#AFC0FF', sun: 1.4, shade: '#5A5E96'
  }
};
// The colours above that the shaders from atmosphere.online's sky use. Their numbers go to
// the screen as written, so a scene sets them with LinearSRGBColorSpace (three.js would
// otherwise convert them to linear light first).
export const SKY_RAW = ['top', 'mid', 'low', 'hor', 'sunCol', 'lit', 'shadow', 'rim', 'storm', 'fog', 'spark', 'shade'];

// Where the sun is seen, low and to the left, and where the light comes from: the same side,
// higher up, so a cloud's shadow falls near the rain under it.
export const SUN_SEEN = new Vector3(-.155, .148, -.977).normalize(), SUN_LIGHT = new Vector3(-.28, .79, -.55).normalize();

/**
 * The dome: the sky's gradient, the sun, and stars at night. `C` holds the scene's Color
 * objects for top, mid, low, hor and sunCol, which it repaints between day and night; `uTime`
 * is its clock, as a { value }; `sunSeen` is where the sun stands, if not where it's seen
 * above. Keep the dome where the camera is, and set uStars to 0 or 1.
 */
export function skyDome(C, uTime, sunSeen = SUN_SEEN){
  const sky = new Mesh(new SphereGeometry(500, 32, 16), new ShaderMaterial({
    side: BackSide, depthWrite: false, depthTest: false,
    uniforms: { uTop: { value: C.top }, uMid: { value: C.mid }, uLow: { value: C.low }, uHor: { value: C.hor }, uSunDir: { value: sunSeen }, uSunCol: { value: C.sunCol }, uStars: { value: 0 }, uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uTop, uMid, uLow, uHor, uSunDir, uSunCol; uniform float uStars, uTime;
      varying vec3 vDir;
      void main(){
        // the view only reaches a little way up the sky, so the gradient is drawn in that much
        vec3 d = normalize(vDir); float t = clamp(d.y * 2.3, 0.0, 1.0);
        vec3 c = mix(uHor, uLow, smoothstep(0.0, 0.12, t));
        c = mix(c, uMid, smoothstep(0.1, 0.4, t));
        c = mix(c, uTop, smoothstep(0.35, 0.95, t));
        float sd = max(dot(d, uSunDir), 0.0);
        c += uSunCol * (pow(sd, 6.0) * 0.14 + pow(sd, 60.0) * 0.3);
        c = mix(c, uSunCol * 0.4 + 0.6, smoothstep(0.99955, 0.9998, sd));
        if (uStars > 0.01){
          vec3 q = floor(d * 420.0);
          float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          c += vec3(step(0.9982, h) * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + h * 60.0)) * smoothstep(0.02, 0.25, d.y));
        }
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  return sky;
}
