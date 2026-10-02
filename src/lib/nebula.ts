/**
 * Ethereal nebula sky, drawn with one WebGL fragment shader.
 * - Renders at reduced resolution and ~30 fps; pauses when the tab is hidden.
 * - With prefers-reduced-motion it renders a single still frame.
 * - Falls back silently to the CSS gradient sky when WebGL is unavailable.
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scroll;
uniform vec3 u_base;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_c;
uniform float u_star;
uniform float u_shade;
uniform float u_cap;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
float stars(vec2 uv, float scale, float density) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 fp = fract(g) - 0.5;
  float h = hash(id);
  vec2 off = (vec2(hash(id + 1.7), hash(id + 3.1)) - 0.5) * 0.7;
  float d = length(fp - off);
  float s = step(1.0 - density, h) * smoothstep(0.11, 0.0, d);
  float tw = 0.55 + 0.45 * sin(u_time * (0.6 + h * 2.4) + h * 40.0);
  return s * tw;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.y;
  uv.y -= u_scroll;
  float t = u_time * 0.012;
  vec2 q = vec2(fbm(uv * 1.4 + t), fbm(uv * 1.4 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 1.4 + 3.5 * q + vec2(1.7, 9.2) + t * 1.3),
                fbm(uv * 1.4 + 3.5 * q + vec2(8.3, 2.8) - t));
  float f = fbm(uv * 1.4 + 3.5 * r);

  vec3 col = u_base;
  col = mix(col, u_a, smoothstep(0.32, 0.9, f) * 0.85);
  col = mix(col, u_b, smoothstep(0.35, 1.0, length(q)) * 0.7);
  col = mix(col, u_c, smoothstep(0.5, 0.95, r.x) * 0.55);
  col *= (1.0 - u_shade) + u_shade * 1.9 * f * f;
  // Keep the sky dim enough for text on top of it.
  col = min(col, vec3(u_cap));

  float s = stars(uv, 60.0, 0.035) + 0.7 * stars(uv + 3.3, 110.0, 0.04);
  col += vec3(1.0, 0.96, 0.88) * s * u_star;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Palette = { base: number[]; a: number[]; b: number[]; c: number[]; star: number; shade: number; cap: number };

const DARK: Palette = {
  base: [0.02, 0.03, 0.07],
  a: [0.62, 0.24, 0.08],
  b: [0.05, 0.32, 0.38],
  c: [0.3, 0.12, 0.42],
  star: 1.0,
  shade: 0.6,
  cap: 0.42,
};

const LIGHT: Palette = {
  base: [0.957, 0.937, 0.902],
  a: [0.98, 0.84, 0.72],
  b: [0.78, 0.89, 0.93],
  c: [0.88, 0.83, 0.96],
  star: 0.0,
  shade: 0.08,
  cap: 1.0,
};

function currentPalette(): Palette {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'light') return LIGHT;
  if (theme === 'dark') return DARK;
  return matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK;
}

export function startNebula(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return () => {};

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return () => {};
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u('u_res');
  const uTime = u('u_time');
  const uScroll = u('u_scroll');
  const uBase = u('u_base');
  const uA = u('u_a');
  const uB = u('u_b');
  const uC = u('u_c');
  const uStar = u('u_star');
  const uShade = u('u_shade');
  const uCap = u('u_cap');

  // Software WebGL (no GPU) is far too slow to animate: draw one still frame instead.
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  let still = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let palette = currentPalette();
  let raf = 0;
  let last = 0;
  const t0 = performance.now() - Math.random() * 60_000;

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const draw = (now: number) => {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    const frozen = still || reduce.matches;
    gl.uniform1f(uTime, frozen ? 30 : (now - t0) / 1000);
    gl.uniform1f(uScroll, frozen ? 0 : (scrollY / Math.max(1, innerHeight)) * 0.12);
    gl.uniform3fv(uBase, palette.base);
    gl.uniform3fv(uA, palette.a);
    gl.uniform3fv(uB, palette.b);
    gl.uniform3fv(uC, palette.c);
    gl.uniform1f(uStar, palette.star);
    gl.uniform1f(uShade, palette.shade);
    gl.uniform1f(uCap, palette.cap);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // If frames keep taking too long (a weak GPU), stop animating.
  let slow = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return;
    last = now;
    const t = performance.now();
    draw(now);
    slow = performance.now() - t > 12 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 20) {
      still = true;
      cancelAnimationFrame(raf);
    }
  };

  const start = () => {
    cancelAnimationFrame(raf);
    if (still || reduce.matches || document.hidden) draw(performance.now());
    else raf = requestAnimationFrame(loop);
  };

  const onTheme = () => {
    palette = currentPalette();
    draw(performance.now());
  };
  const onResize = () => draw(performance.now());

  const observer = new MutationObserver(onTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const scheme = matchMedia('(prefers-color-scheme: light)');
  scheme.addEventListener('change', onTheme);
  reduce.addEventListener('change', start);
  document.addEventListener('visibilitychange', start);
  addEventListener('resize', onResize);

  draw(performance.now());
  canvas.classList.add('ready');
  start();

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    scheme.removeEventListener('change', onTheme);
    reduce.removeEventListener('change', start);
    document.removeEventListener('visibilitychange', start);
    removeEventListener('resize', onResize);
  };
}
