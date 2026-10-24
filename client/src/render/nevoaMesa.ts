import { CODEX_NO_TABULEIRO } from './arteCodex';
import { casaVista, type NevoaCena, type RoomMap } from '@crona/shared';
import { existeArte } from '../ui/icons';
import { iso } from './iso';
import { matrizNaAltura, type CameraVoo } from './mapaTatico';

/**
 * A névoa revelada aos poucos (docs/FERRAMENTAS-DA-MESA.md), no tabuleiro.
 *
 * - **Na mesa:** o que está escondido some (o tabuleiro não desenha as peças e os móveis de lá) e
 *   o chão e as paredes dessas casas ficam debaixo de uma fumaça escura, de borda macia, que se mexe.
 * - **Na tela do mestre:** tudo continua à vista; o escondido fica mais escuro e riscado, com a
 *   borda tracejada, para ele saber o que a mesa não vê.
 */

interface Fumo {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  fase: number;
}

let sprite: HTMLCanvasElement | null = null;
function fumoSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(78, 82, 100, 1)');
  grad.addColorStop(0.5, 'rgba(52, 55, 70, 0.5)');
  grad.addColorStop(1, 'rgba(36, 38, 48, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  sprite = c;
  return c;
}

/** A textura pintada da névoa (arte/texturas/nevoa-mesa.png, que repete); sem ela, as nuvens desenhadas. */
let textura: HTMLImageElement | null = null;
void existeArte('/arte/texturas/nevoa-mesa.png').then((ok) => {
  if (!ok || !CODEX_NO_TABULEIRO) return;
  const img = new Image();
  img.onload = () => (textura = img);
  img.src = '/arte/texturas/nevoa-mesa.png';
});

/** A fumaça por cima do escuro (só onde ele já está): a textura pintada correndo devagar, ou as nuvens. */
function pintarFumaca(g: CanvasRenderingContext2D, fumos: Fumo[], now: number, nuvem: (f: Fumo) => void) {
  g.globalCompositeOperation = 'source-atop';
  if (textura) {
    const p = g.createPattern(textura, 'repeat');
    if (p) {
      const t = now / 1000;
      p.setTransform(new DOMMatrix().translate(t * 6, t * 2.5));
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 0.6;
      g.fillStyle = p;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
    }
  } else
    for (const f of fumos) {
      g.globalAlpha = 0.32 + 0.18 * Math.sin(now / 2600 + f.fase);
      nuvem(f);
    }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

let hachura: HTMLCanvasElement | null = null;
function hachuraSprite() {
  if (hachura) return hachura;
  const c = document.createElement('canvas');
  c.width = c.height = 10;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(160, 190, 240, 0.42)';
  g.lineWidth = 1.4;
  g.beginPath();
  for (const k of [-10, 0, 10]) {
    g.moveTo(k, 10);
    g.lineTo(k + 10, 0);
  }
  g.stroke();
  hachura = c;
  return c;
}

/** As casas escondidas, montadas uma vez por névoa: o chão, as paredes do fundo e a borda com o que está à vista. */
interface Forma {
  chave: string;
  /** casas escondidas do chão, em casas */
  casas: [number, number, number][];
  /** a borda entre escondido e à vista: [x0, y0, x1, y1, altura] em casas */
  borda: [number, number, number, number, number][];
  /** as paredes do fundo das casas escondidas */
  paredes: { wall: 'l' | 'r'; plane: number; at: number; base: number }[];
}

/** o tamanho da tela de fora da névoa da mesa, em relação ao tabuleiro (a névoa é borrada: pequena fica igual) */
const REDUZ = 1 / 3;

export class NevoaMesa {
  private forma: Forma | null = null;
  private fumos: Fumo[] = [];
  private fora: HTMLCanvasElement | null = null;
  /** a névoa já desfocada, na tela pequena (a que vai ampliada para o tabuleiro) */
  private foraBorrada: HTMLCanvasElement | null = null;
  /** os contornos do escondido no isométrico, refeitos só quando a névoa (ou a sala) muda */
  private caminhos: { forma: Forma; top: number; chao: Path2D; paredes: Path2D } | null = null;
  private antes = 0;

  /** A casa está escondida da mesa? */
  static escondida(n: NevoaCena | undefined, x: number, y: number): boolean {
    return !!n && !casaVista(n, Math.floor(x), Math.floor(y));
  }

  private montar(map: RoomMap, n: NevoaCena, chaveMapa: string): Forma {
    const chave = `${chaveMapa}|${n.vista}`;
    if (this.forma?.chave === chave) return this.forma;
    const casas: [number, number, number][] = [];
    const borda: Forma['borda'] = [];
    const chao = (x: number, y: number) => map.floorHeight(x, y) !== null;
    const esc = (x: number, y: number) => chao(x, y) && !casaVista(n, x, y);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        if (!esc(x, y)) continue;
        const h = map.floorHeight(x, y) ?? 0;
        casas.push([x, y, h]);
        // a borda: o lado que dá para uma casa à vista
        if (chao(x - 1, y) && !esc(x - 1, y)) borda.push([x, y, x, y + 1, h]);
        if (chao(x + 1, y) && !esc(x + 1, y)) borda.push([x + 1, y, x + 1, y + 1, h]);
        if (chao(x, y - 1) && !esc(x, y - 1)) borda.push([x, y, x + 1, y, h]);
        if (chao(x, y + 1) && !esc(x, y + 1)) borda.push([x, y + 1, x + 1, y + 1, h]);
      }
    const paredes = map.walls.segs.filter((s) => (s.wall === 'l' ? esc(s.plane, s.at) : esc(s.at, s.plane)));
    // a fumaça: nuvens espalhadas pelas casas escondidas
    if (!this.forma || this.fumos.length === 0 || Math.abs(this.fumos.length - Math.min(70, 10 + casas.length / 4)) > 8) {
      this.fumos = [];
      const n2 = Math.min(70, 10 + Math.round(casas.length / 4));
      for (let i = 0; i < n2 && casas.length; i++) {
        const c = casas[Math.floor(Math.random() * casas.length)];
        this.fumos.push({ x: c[0] + Math.random(), y: c[1] + Math.random(), r: 1.4 + Math.random() * 2.2, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, fase: Math.random() * 10 });
      }
    }
    this.forma = { chave, casas, borda, paredes };
    return this.forma;
  }

  /** As nuvens andam devagar; a que sai da sala volta do outro lado. */
  private andar(map: RoomMap, now: number) {
    const dt = this.antes ? Math.min(0.1, (now - this.antes) / 1000) : 0;
    this.antes = now;
    for (const f of this.fumos) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -2) f.x = map.width + 2;
      if (f.x > map.width + 2) f.x = -2;
      if (f.y < -2) f.y = map.height + 2;
      if (f.y > map.height + 2) f.y = -2;
    }
  }

  /**
   * A tela de fora da névoa da mesa, a um terço do tamanho do tabuleiro (23/10, o pente-fino de desempenho): a névoa é
   * toda borrada, então desenhar e desfocar pequeno e ampliar no fim fica igual e custa nove vezes menos que desfocar o
   * canvas inteiro a cada quadro.
   */
  private telaFora(ctx: CanvasRenderingContext2D) {
    const c = (this.fora ??= document.createElement('canvas'));
    const w = Math.max(1, Math.ceil(ctx.canvas.width * REDUZ));
    const h = Math.max(1, Math.ceil(ctx.canvas.height * REDUZ));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    return g;
  }

  /** Desfoca a tela pequena (o raio também reduzido) e amplia por cima do tabuleiro inteiro. */
  private ampliarBorrado(ctx: CanvasRenderingContext2D, raio: number) {
    const src = this.fora!;
    const b = (this.foraBorrada ??= document.createElement('canvas'));
    if (b.width !== src.width || b.height !== src.height) {
      b.width = src.width;
      b.height = src.height;
    }
    const g = b.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, b.width, b.height);
    g.filter = `blur(${Math.max(0.8, raio * REDUZ).toFixed(2)}px)`;
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  /**
   * No isométrico. `mundo` = a transformação do mundo para o canvas (a do tabuleiro); `px` = px do
   * canvas por unidade do mundo (zoom × dpr).
   */
  desenharIso(ctx: CanvasRenderingContext2D, map: RoomMap, n: NevoaCena, chaveMapa: string, mesa: boolean, mundo: DOMMatrix, px: number, now: number) {
    const f = this.montar(map, n, chaveMapa);
    if (!f.casas.length) return;
    const top = map.walls.top;
    if (this.caminhos?.forma !== f || this.caminhos.top !== top) {
      const chao = new Path2D();
      for (const [x, y, h] of f.casas) {
        const p = [iso(x, y, h), iso(x + 1, y, h), iso(x + 1, y + 1, h), iso(x, y + 1, h)];
        chao.moveTo(p[0][0], p[0][1]);
        for (const q of p.slice(1)) chao.lineTo(q[0], q[1]);
        chao.closePath();
      }
      const paredes = new Path2D();
      for (const s of f.paredes) {
        const q = s.wall === 'l' ? [iso(s.plane, s.at, s.base), iso(s.plane, s.at + 1, s.base), iso(s.plane, s.at + 1, top), iso(s.plane, s.at, top)] : [iso(s.at, s.plane, s.base), iso(s.at + 1, s.plane, s.base), iso(s.at + 1, s.plane, top), iso(s.at, s.plane, top)];
        paredes.moveTo(q[0][0], q[0][1]);
        for (const p of q.slice(1)) paredes.lineTo(p[0], p[1]);
        paredes.closePath();
      }
      this.caminhos = { forma: f, top, chao, paredes };
    }
    const { chao, paredes } = this.caminhos;
    if (mesa) {
      this.andar(map, now);
      const g = this.telaFora(ctx);
      g.setTransform(new DOMMatrix().scale(REDUZ).multiply(mundo));
      g.fillStyle = '#060509';
      g.fill(chao);
      g.fill(paredes);
      // a borda engorda um pouco: com o desfoque, o escondido continua coberto até a beirada
      g.lineWidth = 10 / (px || 1);
      g.lineJoin = 'round';
      g.strokeStyle = '#060509';
      g.stroke(chao);
      // a fumaça, só onde tem névoa
      const s = fumoSprite();
      pintarFumaca(g, this.fumos, now, (fu) => {
        const [cx, cy] = iso(fu.x, fu.y, 0.6);
        const r = fu.r * 36;
        g.drawImage(s, cx - r * 1.2, cy - r * 0.6, r * 2.4, r * 1.2);
      });
      this.ampliarBorrado(ctx, Math.max(2, 7 * (px || 1)));
      return;
    }
    // o mestre: escurecido e riscado, com a borda tracejada
    ctx.save();
    ctx.setTransform(mundo);
    ctx.fillStyle = 'rgba(6, 8, 16, 0.58)';
    ctx.fill(chao);
    ctx.fillStyle = 'rgba(6, 8, 16, 0.45)';
    ctx.fill(paredes);
    const pad = ctx.createPattern(hachuraSprite(), 'repeat');
    if (pad) {
      pad.setTransform(new DOMMatrix().scale(1 / (px || 1)));
      ctx.fillStyle = pad;
      ctx.fill(chao);
    }
    ctx.lineWidth = 2.4 / (px || 1);
    ctx.setLineDash([7 / (px || 1), 5 / (px || 1)]);
    ctx.lineDashOffset = -now / 60 / (px || 1);
    ctx.strokeStyle = 'rgba(180, 210, 250, 0.9)';
    ctx.shadowColor = 'rgba(80, 140, 230, 0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (const [x0, y0, x1, y1, h] of f.borda) {
      const a = iso(x0, y0, h);
      const b = iso(x1, y1, h);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** No mapa tático (e no caminho até ele): o mesmo, no chão da câmera v. */
  desenharTatico(ctx: CanvasRenderingContext2D, map: RoomMap, n: NevoaCena, chaveMapa: string, mesa: boolean, v: CameraVoo, now: number) {
    const f = this.montar(map, n, chaveMapa);
    if (!f.casas.length) return;
    const M = matrizNaAltura(v, 0);
    const casa = Math.hypot(M.a, M.b) || 1;
    const chao = new Path2D();
    for (const [x, y] of f.casas) chao.rect(x - 0.01, y - 0.01, 1.02, 1.02);
    if (mesa) {
      this.andar(map, now);
      const g = this.telaFora(ctx);
      g.setTransform(new DOMMatrix().scale(REDUZ).multiply(M));
      g.fillStyle = '#060509';
      g.fill(chao);
      g.lineWidth = 0.18;
      g.strokeStyle = '#060509';
      g.stroke(chao);
      const s = fumoSprite();
      pintarFumaca(g, this.fumos, now, (fu) => g.drawImage(s, fu.x - fu.r, fu.y - fu.r, fu.r * 2, fu.r * 2));
      this.ampliarBorrado(ctx, Math.max(2, casa * 0.12));
      return;
    }
    ctx.save();
    ctx.setTransform(M);
    ctx.fillStyle = 'rgba(6, 8, 16, 0.58)';
    ctx.fill(chao);
    const pad = ctx.createPattern(hachuraSprite(), 'repeat');
    if (pad) {
      pad.setTransform(new DOMMatrix().scale(1 / casa));
      ctx.fillStyle = pad;
      ctx.fill(chao);
    }
    ctx.lineWidth = 2.4 / casa;
    ctx.setLineDash([7 / casa, 5 / casa]);
    ctx.lineDashOffset = -now / 60 / casa;
    ctx.strokeStyle = 'rgba(180, 210, 250, 0.9)';
    ctx.shadowColor = 'rgba(80, 140, 230, 0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of f.borda) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
  }
}
