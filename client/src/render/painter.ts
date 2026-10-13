import { Z_PER_M } from '@crona/shared';
import { shade } from './color';
import { iso } from './iso';
import type { WBox } from './caixa';

/** Caixa local: [u0, u1, v0, v1, z0, z1]. u = frente, v = lateral. */
export type LBox = [number, number, number, number, number, number];
export type P3 = [number, number, number];
// a caixa no mundo fica num arquivo à parte (a ordem de desenho e o teste dela usam sem o canvas)
export type { WBox };
export type LFace = 'front' | 'back' | 'right' | 'left';
type WFace = '+x' | '-x' | '+y' | '-y';

const FACE_MAP: Record<number, Record<LFace, WFace>> = {
  2: { front: '+x', back: '-x', right: '+y', left: '-y' },
  6: { front: '-x', back: '+x', right: '-y', left: '+y' },
  4: { front: '+y', back: '-y', right: '-x', left: '+x' },
  0: { front: '-y', back: '+y', right: '+x', left: '-x' },
};
const SHADE: Record<WFace | 'top', number> = { top: 0.12, '+y': 0, '+x': -0.3, '-x': -0.45, '-y': -0.45 };
export const OUTLINE = 'rgba(10,7,7,0.88)';

export interface BoxOpts {
  top?: string;
  /** cor por face local */
  faces?: Partial<Record<LFace, string>>;
  outline?: boolean;
  /** brilho nas quinas de cima */
  edge?: number;
}

/**
 * Converte coordenadas locais do mobi para o mundo, respeitando a rotação.
 * u e v em casas; z local em metros (vira unidades de altura com Z_PER_M).
 */
export class Mapper {
  rot = 2;
  W = 1;
  D = 1;
  ox = 0;
  oy = 0;
  oz = 0;

  set(rot: number, W: number, D: number, ox: number, oy: number, oz: number) {
    this.rot = rot;
    this.W = W;
    this.D = D;
    this.ox = ox;
    this.oy = oy;
    this.oz = oz;
    return this;
  }

  xy(u: number, v: number): [number, number] {
    switch (this.rot) {
      case 2:
        return [this.ox + u, this.oy + v];
      case 6:
        return [this.ox + this.D - u, this.oy + this.W - v];
      case 4:
        return [this.ox + this.W - v, this.oy + u];
      default:
        return [this.ox + v, this.oy + this.D - u];
    }
  }

  p(u: number, v: number, z: number): [number, number] {
    const [x, y] = this.xy(u, v);
    return iso(x, y, this.oz + z * Z_PER_M);
  }

  box(b: LBox): WBox {
    const [xa, ya] = this.xy(b[0], b[2]);
    const [xb, yb] = this.xy(b[1], b[3]);
    return {
      x0: Math.min(xa, xb),
      x1: Math.max(xa, xb),
      y0: Math.min(ya, yb),
      y1: Math.max(ya, yb),
      z0: this.oz + b[4] * Z_PER_M,
      z1: this.oz + b[5] * Z_PER_M,
    };
  }

  wface(f: LFace): WFace {
    return (FACE_MAP[this.rot] ?? FACE_MAP[2])[f];
  }

  visible(f: LFace) {
    const w = this.wface(f);
    return w === '+x' || w === '+y';
  }

  /** Face local que aparece em cada face visível do mundo. */
  localFor(w: WFace): LFace {
    const m = FACE_MAP[this.rot] ?? FACE_MAP[2];
    return (Object.keys(m) as LFace[]).find((k) => m[k] === w)!;
  }

  shadeOf(f: LFace | 'top') {
    return f === 'top' ? SHADE.top : SHADE[this.wface(f)];
  }
}

function polyPath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function boxSilhouette(w: WBox): [number, number][] {
  return [
    iso(w.x0, w.y0, w.z1),
    iso(w.x1, w.y0, w.z1),
    iso(w.x1, w.y0, w.z0),
    iso(w.x1, w.y1, w.z0),
    iso(w.x0, w.y1, w.z0),
    iso(w.x0, w.y1, w.z1),
  ];
}

export function pointInPoly(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Desenha primitivas em coordenadas locais de um mobi. */
export class Painter {
  ctx!: CanvasRenderingContext2D;
  m = new Mapper();
  /** tempo em ms */
  t = 0;
  state = 0;
  seed = 0;
  /** energia elétrica da cena: 1 normal, 0 apagão (mobis elétricos desenham apagados) */
  power = 1;

  // ---------- caixas ----------
  box(b: LBox, color: string, o: BoxOpts = {}) {
    const ctx = this.ctx;
    const w = this.m.box(b);
    if (w.x1 - w.x0 < 1e-4 && w.y1 - w.y0 < 1e-4) return;
    const faceColor = (wf: WFace) => {
      const lf = this.m.localFor(wf);
      return shade(o.faces?.[lf] ?? color, SHADE[wf]);
    };
    const top: [number, number][] = [iso(w.x0, w.y0, w.z1), iso(w.x1, w.y0, w.z1), iso(w.x1, w.y1, w.z1), iso(w.x0, w.y1, w.z1)];
    const fy: [number, number][] = [iso(w.x0, w.y1, w.z0), iso(w.x1, w.y1, w.z0), iso(w.x1, w.y1, w.z1), iso(w.x0, w.y1, w.z1)];
    const fx: [number, number][] = [iso(w.x1, w.y0, w.z0), iso(w.x1, w.y1, w.z0), iso(w.x1, w.y1, w.z1), iso(w.x1, w.y0, w.z1)];
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    if (w.z1 - w.z0 > 1e-4) {
      const cy = faceColor('+y');
      ctx.fillStyle = cy;
      ctx.strokeStyle = cy;
      polyPath(ctx, fy);
      ctx.fill();
      ctx.stroke();
      const cx = faceColor('+x');
      ctx.fillStyle = cx;
      ctx.strokeStyle = cx;
      polyPath(ctx, fx);
      ctx.fill();
      ctx.stroke();
    }
    const ct = shade(o.top ?? color, SHADE.top);
    ctx.fillStyle = ct;
    ctx.strokeStyle = ct;
    polyPath(ctx, top);
    ctx.fill();
    ctx.stroke();
    const edge = o.edge ?? 0.18;
    if (edge > 0 && w.z1 - w.z0 > 0.02) {
      ctx.strokeStyle = `rgba(255,236,210,${edge})`;
      ctx.beginPath();
      const a = iso(w.x0, w.y1, w.z1);
      const c = iso(w.x1, w.y1, w.z1);
      const d = iso(w.x1, w.y0, w.z1);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.stroke();
    }
    if (o.outline !== false) {
      ctx.strokeStyle = OUTLINE;
      polyPath(ctx, boxSilhouette(w));
      ctx.stroke();
    }
  }

  /** Retângulo desenhado numa face vertical de `b`. a = eixo horizontal da face (v na frente/trás, u nas laterais). */
  face(b: LBox, f: LFace, a0: number, a1: number, z0: number, z1: number, color: string, raw = false) {
    if (!this.m.visible(f)) return;
    const pts = this.facePts(b, f, a0, a1, z0, z1).map(([u, v, z]) => this.m.p(u, v, z));
    this.ctx.fillStyle = raw ? color : shade(color, this.m.shadeOf(f));
    polyPath(this.ctx, pts);
    this.ctx.fill();
  }

  facePts(b: LBox, f: LFace, a0: number, a1: number, z0: number, z1: number): P3[] {
    switch (f) {
      case 'front':
        return [[b[1], a0, z0], [b[1], a1, z0], [b[1], a1, z1], [b[1], a0, z1]];
      case 'back':
        return [[b[0], a0, z0], [b[0], a1, z0], [b[0], a1, z1], [b[0], a0, z1]];
      case 'right':
        return [[a0, b[3], z0], [a1, b[3], z0], [a1, b[3], z1], [a0, b[3], z1]];
      default:
        return [[a0, b[2], z0], [a1, b[2], z0], [a1, b[2], z1], [a0, b[2], z1]];
    }
  }

  /** Transforma o canvas para desenhar na face (eixo a horizontal, z para cima, 1 unidade = 1 tile / 1 altura). */
  withFace(b: LBox, f: LFace, fn: (ctx: CanvasRenderingContext2D) => void) {
    if (!this.m.visible(f)) return;
    const pts = this.facePts(b, f, 0, 1, 0, 1).map(([u, v, z]) => this.m.p(u, v, z));
    const [ox, oy] = pts[0];
    const ax = pts[1][0] - ox;
    const ay = pts[1][1] - oy;
    const zx = pts[3][0] - ox;
    const zy = pts[3][1] - oy;
    const ctx = this.ctx;
    ctx.save();
    ctx.transform(ax, ay, zx, zy, ox, oy);
    fn(ctx);
    ctx.restore();
  }

  /** Transforma o canvas para desenhar no plano horizontal local na altura z (coordenadas u, v). */
  withTop(z: number, fn: (ctx: CanvasRenderingContext2D) => void) {
    const [ox, oy] = this.m.p(0, 0, z);
    const [ux, uy] = this.m.p(1, 0, z);
    const [vx, vy] = this.m.p(0, 1, z);
    const ctx = this.ctx;
    ctx.save();
    ctx.transform(ux - ox, uy - oy, vx - ox, vy - oy, ox, oy);
    fn(ctx);
    ctx.restore();
  }

  poly(pts: P3[], fill: string | null, stroke?: string, lw = 1) {
    const ctx = this.ctx;
    polyPath(ctx, pts.map(([u, v, z]) => this.m.p(u, v, z)));
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  line(a: P3, b: P3, color: string, lw = 1) {
    const ctx = this.ctx;
    const p = this.m.p(a[0], a[1], a[2]);
    const q = this.m.p(b[0], b[1], b[2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }

  /** Cilindro vertical centrado em (u, v) com raio r (em tiles). */
  cyl(u: number, v: number, r: number, z0: number, z1: number, color: string, o: { top?: string; outline?: boolean } = {}) {
    const ctx = this.ctx;
    const [bx, by] = this.m.p(u, v, z0);
    const [, ty] = this.m.p(u, v, z1);
    const rx = r * 45.25;
    const ry = r * 22.63;
    const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
    g.addColorStop(0, shade(color, 0.08));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.45));
    ctx.beginPath();
    ctx.moveTo(bx - rx, ty);
    ctx.lineTo(bx - rx, by);
    ctx.ellipse(bx, by, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(bx + rx, ty);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    if (o.outline !== false) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(bx, ty, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(o.top ?? color, 0.14);
    ctx.fill();
    if (o.outline !== false) {
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }

  /** Disco horizontal (tampa, prato). */
  disc(u: number, v: number, r: number, z: number, color: string, stroke?: string) {
    const ctx = this.ctx;
    const [x, y] = this.m.p(u, v, z);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 45.25, r * 22.63, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  /** Chama de vela animada. */
  flame(u: number, v: number, z: number, size = 1) {
    const [x, y] = this.m.p(u, v, z);
    drawFlame(this.ctx, x, y, size, this.t / 1000 + this.seed * 7.3 + u * 13 + v * 5);
  }
}

/** Chama em coordenadas de tela; k = fase da animação (segundos + semente). */
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, k: number) {
  const fl = 0.85 + 0.15 * Math.sin(k * 11) * Math.sin(k * 6.3);
  const sway = Math.sin(k * 4.1) * 0.8 * size;
  const h = 7 * size * fl;
  const w = 2.6 * size;
  const glow = ctx.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, 9 * size);
  glow.addColorStop(0, 'rgba(255,190,90,0.55)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.5, 9 * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + sway, y - h);
  ctx.quadraticCurveTo(x + w, y - h * 0.35, x, y);
  ctx.quadraticCurveTo(x - w, y - h * 0.35, x + sway, y - h);
  ctx.fillStyle = '#ff9a2e';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + sway * 0.6, y - h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.25, x, y - 0.5);
  ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.25, x + sway * 0.6, y - h * 0.7);
  ctx.fillStyle = '#fff2b0';
  ctx.fill();
}
