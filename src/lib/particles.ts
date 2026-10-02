/**
 * Lazy-loaded particle burst for unlocks. Never loaded with reduced motion.
 */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  hue: string;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: P[] = [];
let raf = 0;

function ensureCanvas(host: HTMLElement) {
  if (canvas && canvas.isConnected) return;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  host.append(canvas);
  ctx = canvas.getContext('2d');
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  particles = particles.filter((p) => p.life < p.max);
  for (const p of particles) {
    p.life++;
    p.vy += 0.06;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.hue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  if (particles.length) raf = requestAnimationFrame(frame);
  else ctx.clearRect(0, 0, innerWidth, innerHeight);
}

export function burst(host: HTMLElement, x: number, y: number, color: string, big = false) {
  ensureCanvas(host);
  resize();
  const n = big ? 90 : 36;
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (big ? 2.5 : 1.6) + Math.random() * (big ? 5 : 3);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (big ? 2 : 1),
      life: 0,
      max: 45 + Math.random() * (big ? 60 : 30),
      r: 1.5 + Math.random() * (big ? 3 : 2),
      hue: Math.random() < 0.25 ? '#ffe9b8' : color,
    });
  }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
