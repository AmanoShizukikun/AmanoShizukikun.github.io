// GLSL for the home sequence.

const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

// The film curve of the final pass (an ACES fit on the scene exposed EXPOSE×), and its inverse.
// On paper the curve only washes images out, so an image that should reach the screen as it is is drawn as
// unfilm(c): the linear value that the final pass turns back into c, displayed as the image's own sRGB.
const FILM = /* glsl */ `
const float EXPOSE = 1.15;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 unfilm(vec3 c){
  vec3 s = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  vec3 y = clamp(pow(s, vec3(2.2)), 0.0, 1.0);                       // what aces() has to put out
  vec3 a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y;                     // a·x² + b·x − 0.14·y = 0
  return (sqrt(b * b + 0.56 * a * y) - b) / (2.0 * a) / EXPOSE;
}
`;

// ---------- terrain: a survey chart that stands up into relief ----------
export const terrainVert = /* glsl */ `
uniform float uRelief;
varying float vH;
varying vec3 vWorld;
${NOISE}
float height(vec2 xz){
  float h = pow(fbm(xz * 0.0105 + vec2(3.7, 1.9)), 1.7) * 78.0;
  float corridor = smoothstep(10.0, 86.0, abs(xz.x + sin(xz.y * 0.021) * 12.0));
  h *= mix(1.0, mix(0.1, 1.0, corridor), smoothstep(95.0, 20.0, xz.y));
  h *= mix(0.12, 1.0, smoothstep(22.0, 74.0, distance(xz, vec2(0.0, -120.0))));
  return h;
}
void main(){
  vec3 p = position;
  float h = height(p.xz);
  vH = h;
  p.y = h * uRelief;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

export const terrainFrag = /* glsl */ `
uniform vec3 uSignal, uLine, uFogCol;
uniform float uRelief, uFogK, uFade, uLight;       // uLight: 0 = the dark grade, 1 = the chart on paper
varying float vH;
varying vec3 vWorld;
float lineAt(float v, float width){
  float fw = fwidth(v);
  float l = 1.0 - smoothstep(0.0, fw * width, abs(fract(v - 0.5) - 0.5));
  return l * (1.0 - smoothstep(0.3, 0.7, fw));
}
void main(){
  float minor = lineAt(vH / 3.0, 1.1);
  float major = lineAt(vH / 15.0, 2.0);
  vec2 g = vWorld.xz / 50.0;
  vec2 gf = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float grid = 1.0 - min(min(gf.x, gf.y), 1.0);
  float rise = smoothstep(0.0, 70.0, vH) * uRelief;
  vec3 col = mix(vec3(0.011, 0.012, 0.014), vec3(0.04, 0.042, 0.046), rise);
  col += uLine * minor * 0.2 * (1.0 - major);
  col = mix(col, uSignal, major * 0.92);
  col += vec3(0.5) * grid * 0.05;
  // on paper: the ground is the sheet itself (high ground a shade darker), contours and grid are drawn in ink,
  // and the index contours are ruled in amber
  vec3 sheet = uFogCol * mix(1.0, 0.8, rise);
  sheet = mix(sheet, vec3(0.03, 0.031, 0.034), minor * 0.62 * (1.0 - major));
  sheet = mix(sheet, uSignal, major * 0.95);
  sheet = mix(sheet, vec3(0.03, 0.031, 0.034), grid * 0.14);
  col = mix(col, sheet, uLight);
  float d = distance(vWorld, cameraPosition);
  float fog = 1.0 - exp(-pow(d * uFogK, 1.7));
  col = mix(col, uFogCol, fog);
  gl_FragColor = vec4(mix(uFogCol, col, uFade), 1.0);
}`;

// ---------- particles: five morph targets ----------
export const pointsVert = /* glsl */ `
attribute vec3 aB;
attribute vec3 aC;
attribute vec3 aD;
attribute vec3 aE;
attribute vec3 aCol;
attribute vec4 aSeed;
// uStage is the place on the storyboard (0 snow · 1 tree · 2 figure · 3 helix · 4 corona, fractions = mid-morph).
// During a flight between two pages the cloud goes straight from uStage to uStageB as uBlend runs 0 → 1,
// without passing through the formations in between.
uniform float uStage, uStageB, uBlend, uTime, uPx, uFigDim, uSnow, uSpin, uLift, uSweep, uLight;
uniform vec3 uCenter, uCorona;
uniform vec3 uScrew;                                   // the helix around uCenter: x twist (radians per unit height), y·z its extent
varying vec3 vCol;
varying float vAdd;
varying float vAlpha;
float st(float x, float s){ return smoothstep(s * 0.45, s * 0.45 + 0.55, clamp(x, 0.0, 1.0)); }
vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }

// everything one particle is at a given stage: p position · c colour · k = (additive, alpha, size) · mid = morph turbulence
void place(float stage, out vec3 p, out vec3 c, out vec3 k, out float mid){
  float s1 = st(stage, aSeed.x), s2 = st(stage - 1.0, aSeed.x), s3 = st(stage - 2.0, aSeed.x), s4 = st(stage - 3.0, aSeed.x);

  vec3 a = position;                                   // A: drifting snow
  a.y = mod(a.y - uTime * (1.2 + aSeed.y * 2.2), 130.0);
  a.x += sin(uTime * 0.3 + aSeed.z * 40.0) * 3.0;
  vec3 b = aB;                                         // B: tree, breathing
  b.x += sin(uTime * 0.5 + aB.y * 0.08) * 0.5 * aSeed.y;
  // D: archive helix, screws along with the panels. A share of it keeps moving even when nothing scrolls, all the
  // same way round as a scroll turns it:
  //  · flow  — about one in twenty of the particles on the helix itself travels slowly along it: up the strand and
  //            round with its twist, so the helix keeps its shape and seems to turn on its own; they come round again
  //            from the bottom, fading out and in at the ends. Kept faint: barely stronger than the still helix
  //  · orbit — about one in seven of the dust around it (44–154 out) circles the axis at a walking pace, so the
  //            outer rings turn slower; it fades as it passes close to the camera instead of sweeping across the lens
  vec3 h = aD - uCenter;
  float rad = length(h.xz);
  float pick = fract(aSeed.y * 17.0 + aSeed.w * 5.0);
  float strand = 1.0 - smoothstep(26.0, 34.0, rad);
  float flow = step(0.95, pick) * strand;
  float orbit = step(0.85, pick) * (1.0 - strand);
  float span = uScrew.z - uScrew.y;
  float fy = mod(h.y - uScrew.y + uTime * (1.4 + 1.8 * aSeed.z), span) + uScrew.y;
  float dy = (fy - h.y) * flow;
  float twist = uScrew.x * dy - uTime * (2.5 + 3.5 * aSeed.z) / max(rad, 1.0) * orbit;
  vec3 d = rotY(h, uSpin + twist) + uCenter;
  d.y += uLift + dy;
  float stress = 0.15 * flow + 0.6 * orbit;           // how much stronger a moving particle is drawn
  float ends = mix(1.0, smoothstep(0.0, 10.0, min(fy - uScrew.y, uScrew.z - fy)), flow)
             * mix(1.0, smoothstep(12.0, 36.0, distance(d, cameraPosition)), orbit);
  vec3 e = aE;                                         // E: eclipse corona, streamers shimmer outward
  vec2 er = aE.xy - uCorona.xy;
  float eLen = length(er);
  e.xy += (er / max(eLen, 0.001)) * sin(uTime * 0.7 + aSeed.x * 24.0) * 0.012 * max(eLen - uCorona.z, 0.0) * 4.0;

  p = mix(a, b, s1);
  p = mix(p, aC, s2);
  p = mix(p, d, s3);
  p = mix(p, e, s4);
  // flow turbulence that peaks half-way through each morph
  mid = max(max(s1 * (1.0 - s1), s2 * (1.0 - s2)), max(s3 * (1.0 - s3), s4 * (1.0 - s4))) * 4.0;

  vec3 gold = vec3(1.0, 0.56, 0.02);
  vec3 cA = vec3(0.62, 0.70, 0.86);
  vec3 cB = mix(vec3(1.0, 0.9, 0.72), gold, aSeed.z * aSeed.z);
  vec3 cC = pow(aCol, vec3(2.2));
  vec3 cD = vec3(0.52, 0.54, 0.58);                    // quiet grey-white: the helix is a backdrop for the panels
  vec3 cE = mix(vec3(1.0, 0.94, 0.84), gold, step(0.78, aSeed.z));
  c = mix(cA, cB, s1); c = mix(c, cC, s2); c = mix(c, cD, s3); c = mix(c, cE, s4);

  float add = mix(0.7, 0.9, s1); add = mix(add, 0.12, s2); add = mix(add, 0.9, s3); add = mix(add, 0.85, s4);
  float al = mix(0.42, 0.75, s1); al = mix(al, 0.95, s2); al = mix(al, 0.13, s3); al = mix(al, 0.88, s4);
  // on paper the cloud is not light but ink: it covers instead of adding up. Dust for the snow, an ink tree
  // with amber leaves, the figure in her own colours, a pencil helix, and a corona drawn in ink and amber.
  if (uLight > 0.0) {
    vec3 ink = vec3(0.022, 0.023, 0.026), amber = vec3(0.62, 0.25, 0.0);
    vec3 lA = vec3(0.2, 0.21, 0.23);
    vec3 lB = mix(ink, amber, step(0.62, aSeed.z));
    vec3 lD = vec3(0.07, 0.072, 0.078);
    vec3 lE = mix(ink, amber, step(0.78, aSeed.z));
    vec3 lc = mix(lA, lB, s1); lc = mix(lc, cC, s2); lc = mix(lc, lD, s3); lc = mix(lc, lE, s4);
    float lal = mix(0.55, 0.92, s1); lal = mix(lal, 0.95, s2); lal = mix(lal, 0.34, s3); lal = mix(lal, 0.9, s4);
    c = mix(c, lc, uLight);
    add *= 1.0 - uLight;
    al = mix(al, lal, uLight);
  }
  al *= mix(step(0.6, aSeed.y) * uSnow, 1.0, s1);      // snow: part of the cloud, absent over the flat chart
  // the corona is drawn clockwise from 12 o'clock as uSweep goes 0 → 1
  float turn = fract(0.25 - atan(er.y, er.x) / 6.2832);
  al *= mix(1.0, 1.0 - smoothstep(uSweep - 0.03, uSweep, turn), s4);
  al *= 1.0 - uFigDim * s2 * (1.0 - s3);
  // the moving ones a touch stronger, so the turn reads against the still helix; faded where "ends" says
  float onHelix = s3 * (1.0 - s4);
  al *= mix(1.0, ends * (1.0 + stress), onHelix);
  float size = mix(0.5, 0.36, s1); size = mix(size, 0.31, s2); size = mix(size, 0.22 * (1.0 + 0.3 * orbit), s3); size = mix(size, 0.42, s4);
  k = vec3(add, al, size);
}

void main(){
  vec3 p, c, k; float mid;
  place(uStage, p, c, k, mid);
  if (uBlend > 0.0) {
    vec3 p2, c2, k2; float mid2;
    place(uStageB, p2, c2, k2, mid2);
    float f = st(uBlend, aSeed.w);                     // every particle leaves at its own moment
    float far = step(0.02, abs(uStage - uStageB));     // same formation on both sides: no swirl on the way
    p = mix(p, p2, f); c = mix(c, c2, f); k = mix(k, k2, f);
    mid = max(mix(mid, mid2, f), f * (1.0 - f) * 4.0 * far);
  }
  vec3 q = p * 0.035 + aSeed.xyz * 6.283;
  p += vec3(sin(q.y + uTime * 0.4), cos(q.z * 1.3 + uTime * 0.3), sin(q.x * 1.1 - uTime * 0.35)) * mid * (9.0 + 14.0 * aSeed.w);

  // particles in flight glow warm; on paper they turn amber instead
  vCol = mix(c + vec3(1.0, 0.8, 0.5) * mid * 0.35, mix(c, vec3(0.62, 0.25, 0.0), clamp(mid * 0.5, 0.0, 1.0)), uLight);
  vAdd = k.x;
  vAlpha = k.y;
  // ink needs more body than light does: a dot that does not glow is only as large as it is drawn
  float size = k.z * (0.55 + aSeed.w * 0.9) * (1.0 + 0.7 * uLight);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPx / max(-mv.z, 0.1), 1.0, 22.0);
}`;

export const pointsFrag = /* glsl */ `
varying vec3 vCol;
varying float vAdd;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  gl_FragColor = vec4(vCol * a, a * (1.0 - vAdd));
}`;

// ---------- the eye inside the gate ----------
export const eyeVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const eyeFrag = /* glsl */ `
uniform sampler2D map;
uniform float uOpen, uHole, uTurn;
uniform vec3 uSignal;
varying vec2 vUv;
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;                 // 0 at the pupil, 1 at the rim
  float ang = atan(c.y, c.x);
  float open = uOpen * 1.08;
  if (r > open) discard;                      // iris wipe: the disc grows out from the pupil
  float hole = uHole;
  if (r < hole) discard;                      // the pupil opens into the next space
  vec2 uv = 0.5 + c * mix(0.72, 1.0, uOpen) + vec2(0.0, -0.02);  // slow push-in on the artwork while it opens
  vec3 col = texture2D(map, uv).rgb;
  // drafting overlay: construction rings + radial ticks
  float rings = 0.0;
  rings += 1.0 - smoothstep(0.0, 0.004, abs(r - 0.34));
  rings += 1.0 - smoothstep(0.0, 0.003, abs(r - 0.62));
  rings += 1.0 - smoothstep(0.0, 0.006, abs(r - 0.93));
  float ticks = step(0.9, fract((ang + uTurn) * 57.2958 / 5.0)) * step(0.86, r) * step(r, 0.9);
  col = mix(col, vec3(0.9, 0.88, 0.82), clamp(rings + ticks, 0.0, 1.0) * 0.5);
  // lit edges: leading edge of the wipe and rim of the opening pupil
  float edge = (1.0 - smoothstep(0.0, 0.03, open - r)) * step(uOpen, 0.999);
  edge += (1.0 - smoothstep(0.0, 0.05, r - hole)) * step(0.001, uHole);
  col = mix(col, uSignal * 3.0, clamp(edge, 0.0, 1.0));
  col *= 1.0 - smoothstep(0.75, 1.0, r) * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- sharp illustration plane (shown under the poster grade) ----------
export const figureFrag = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity, uPoster, uLight;
uniform vec3 uPaper;                                                  // the poster's field colour (linear)
varying vec2 vUv;
${FILM}
vec4 tap(vec2 uv){ return texture2D(map, uv, -0.8); }                 // sharper than the default mip
float luma(vec4 t){ return dot(pow(t.rgb / max(t.a, 0.001), vec3(1.0 / 2.2)), vec3(0.299, 0.587, 0.114)); }
void main(){
  vec4 tx = tap(vUv);                                                 // premultiplied cut-out
  vec3 col = tx.rgb / max(tx.a, 0.001);
  col = mix(col, unfilm(col), uLight);                                // on paper: the artwork's own colours
  // ink print: read tone from the artwork itself (no film curve in between), keep the line art
  // from thinning out by leaning towards the darkest neighbour, then set shadows deep and lights open
  vec2 dx = dFdx(vUv) * 0.7, dy = dFdy(vUv) * 0.7;
  float l = luma(tx);
  float lmin = min(min(luma(tap(vUv + dx + dy)), luma(tap(vUv - dx - dy))), min(luma(tap(vUv + dx - dy)), luma(tap(vUv - dx + dy))));
  l = mix(l, min(l, lmin), 0.3);
  // a two-colour print on the poster's own field: lights (hair, skin, apron) are left as the paper — the signal
  // yellow — shading falls through amber, and only line art and the dress go to ink. No white in the figure.
  // Only what is white in the artwork is left bare; hair and skin keep a faint amber tone, so the figure has a body.
  float g = pow(smoothstep(0.14, 1.0, l), 1.2);
  vec3 paper = pow(uPaper, vec3(1.0 / 2.2));
  vec3 print = mix(vec3(0.045, 0.045, 0.05), paper * vec3(1.0, mix(0.8, 1.0, g), 1.0), g);
  col = mix(col, pow(print, vec3(2.2)), uPoster);
  gl_FragColor = vec4(col * tx.a, tx.a) * uOpacity;
}`;

// ---------- archive panels ----------
export const panelFrag = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity, uFocus, uLight;
uniform vec2 uCover;
varying vec2 vUv;
${FILM}
void main(){
  vec3 col = texture2D(map, (vUv - 0.5) * uCover + 0.5).rgb;
  float g = dot(col, vec3(0.3, 0.59, 0.11));
  // a panel that is not in front recedes: into the dark, or — on paper — into a pale print of itself
  vec3 away = mix(vec3(g) * 0.2, mix(vec3(0.72, 0.71, 0.66), vec3(g), 0.3), uLight);
  // the one in front is shown as captured; on paper that means past the film curve, not through it
  col = mix(away, mix(col, unfilm(col), uLight), uFocus);
  gl_FragColor = vec4(col, uOpacity);
}`;

// ---------- final grade ----------
export const postVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform float uPoster, uFlash, uTime, uGrain, uVig, uGlitch, uLight;
uniform vec2 uRes;
varying vec2 vUv;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
${FILM}
void main(){
  // glitch: horizontal slices tear sideways with a red/blue split. uGlitch comes from scroll speed only,
  // so a still page is a still image.
  float slice = floor(vUv.y * 46.0), tick = floor(uTime * 11.0);
  float jump = step(0.82, hash21(vec2(slice, tick))) * uGlitch;
  vec2 guv = vUv + vec2((hash21(vec2(slice + 3.0, tick)) - 0.5) * 0.07 * jump, 0.0);

  vec2 c = guv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * r2 * 0.014 * (1.0 - uPoster) + vec2(0.0045 * jump + 0.0025 * uGlitch, 0.0);
  vec3 raw = vec3(texture2D(tScene, guv + off).r, texture2D(tScene, guv).g, texture2D(tScene, guv - off).b);
  vec3 col = pow(aces(raw * EXPOSE), vec3(1.0 / 2.2));
  // poster: the scene is already drawn in its final flat colours, so skip the film curve and the vignette
  col = mix(col, pow(clamp(raw, 0.0, 1.0), vec3(1.0 / 2.2)), uPoster);
  // (a sheet of paper has no dark corners: the vignette all but goes on the light grade)
  col *= 1.0 - smoothstep(0.12, 0.62, r2) * uVig * (1.0 - uPoster) * (1.0 - 0.85 * uLight);
  col += (hash21(vUv * uRes + fract(uTime) * 71.0) - 0.5) * uGrain;
  col = mix(col, vec3(1.0, 0.98, 0.93), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;
