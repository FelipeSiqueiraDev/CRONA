import { MARCA_PONTO_MS, MARCA_TRACO_MS, type CorGiz, type FormaTraco, type MarcaMesa } from '@crona/shared';

/**
 * O ponto de atenção e o desenho rápido do mestre (docs/FERRAMENTAS-DA-MESA.md), no tabuleiro do
 * mestre e da mesa. As marcas são em casas, no chão; quem desenha passa a projeção (isométrico ou
 * mapa tático), e elas ficam por cima de tudo, até sumirem sozinhas.
 */

type Ponto = Extract<MarcaMesa, { tipo: 'ponto' }>;
type Traco = Extract<MarcaMesa, { tipo: 'traco' }>;

/** A casa (com fração) no lugar do desenho (px do contexto), e quantos px do contexto tem 1 px da tela. */
export interface Projecao {
  proj: (x: number, y: number) => [number, number];
  px: number;
  /** px do canvas por px da tela (a sombra não segue a transformação) */
  dpr: number;
  /** a altura em px do contexto (o feixe de luz do ponto, no isométrico); sem ela, o ponto fica no chão */
  alto?: number;
}

export const COR_GIZ: Record<CorGiz, string> = {
  giz: '#f3ede2',
  sangue: '#e2483d',
  ouro: '#f4c45a',
};
/** o ponto no azul de HUD do ícone do Apontar (arte/icones/mesa-apontar.png) */
const COR_PONTO = '#8fd0ff';
const BRILHO_PONTO = 'rgba(90, 168, 255, 0.95)';
/** o ícone do Apontar, que flutua em cima do ponto (sem ele, o losango) */
const ICONE_PONTO = new Image();
ICONE_PONTO.decoding = 'async';
ICONE_PONTO.src = '/arte/icones/mesa-apontar.png';

/** O traço que o mestre está fazendo agora (só na tela dele). */
export interface Rascunho {
  forma: FormaTraco;
  cor: CorGiz;
  pts: [number, number][];
}

export class MarcasMesa {
  private pontos: { m: Ponto; t0: number }[] = [];
  private tracos: { m: Traco; t0: number }[] = [];
  rascunho: Rascunho | null = null;

  /** Chegou uma marca do servidor. */
  add(m: MarcaMesa, now = performance.now()) {
    if (m.tipo === 'apagar') {
      this.tracos = [];
      return;
    }
    if (m.tipo === 'ponto') {
      this.pontos.push({ m, t0: now });
      if (this.pontos.length > 6) this.pontos.shift();
    } else {
      this.tracos.push({ m, t0: now });
      if (this.tracos.length > 40) this.tracos.shift();
    }
  }

  limpar() {
    this.pontos = [];
    this.tracos = [];
    this.rascunho = null;
  }

  /** Tem alguma coisa para desenhar? */
  vivas(now: number): boolean {
    this.pontos = this.pontos.filter((p) => now - p.t0 < MARCA_PONTO_MS);
    this.tracos = this.tracos.filter((t) => now - t.t0 < MARCA_TRACO_MS);
    return !!(this.pontos.length || this.tracos.length || this.rascunho);
  }

  /** O ponto mais novo ainda na tela (a câmera da mesa vai até ele). */
  get ultimoPonto(): Ponto | null {
    return this.pontos[this.pontos.length - 1]?.m ?? null;
  }

  desenhar(ctx: CanvasRenderingContext2D, p: Projecao, now: number) {
    if (!this.vivas(now)) return;
    for (const t of this.tracos) {
      const idade = now - t.t0;
      const a = 1 - suave(Math.max(0, (idade - (MARCA_TRACO_MS - 1500)) / 1500));
      desenharTraco(ctx, p, t.m, a, Math.min(1, idade / 380));
    }
    if (this.rascunho && this.rascunho.pts.length >= 2) desenharTraco(ctx, p, { tipo: 'traco', ...this.rascunho }, 0.85, 1);
    for (const pt of this.pontos) desenharPonto(ctx, p, pt.m, now - pt.t0);
  }
}

const suave = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Os pontos do traço na tela: à mão livre, a seta (dois pontos) ou o círculo no chão (a borda, em volta do meio). */
function pontosDoTraco(p: Projecao, m: Traco): [number, number][] {
  if (m.forma === 'circulo') {
    const [[cx, cy], [bx, by]] = m.pts;
    const r = Math.hypot(bx - cx, by - cy);
    const n = Math.max(24, Math.min(96, Math.round(r * 12)));
    const out: [number, number][] = [];
    for (let i = 0; i <= n; i++) out.push(p.proj(cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r));
    return out;
  }
  return m.pts.map(([x, y]) => p.proj(x, y));
}

function caminho(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length < 3) {
    for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
    return;
  }
  // a mão livre suavizada: curvas pelos meios
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const u = pts[pts.length - 1];
  ctx.lineTo(u[0], u[1]);
}

function comprimento(pts: [number, number][]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Um traço de giz: a sombra embaixo, o traço com um brilho e, na seta, a ponta. `feito` = quanto já foi riscado (aparece riscando). */
function desenharTraco(ctx: CanvasRenderingContext2D, p: Projecao, m: Traco, alfa: number, feito: number) {
  if (alfa <= 0.01) return;
  const pts = pontosDoTraco(p, m);
  if (pts.length < 2) return;
  const cor = COR_GIZ[m.cor];
  const px = p.px;
  const L = comprimento(pts);
  // a ponta da seta: na direção do último trecho, na tela
  const seta = m.forma === 'seta';
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const ang = Math.atan2(by - ay, bx - ax);
  const ponta = Math.min(16 * px, L * 0.4);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (feito < 1) {
    ctx.setLineDash([L * feito, L + 1]);
    ctx.lineDashOffset = 0;
  }
  const riscar = (w: number, estilo: string, blur = 0) => {
    ctx.lineWidth = w;
    ctx.strokeStyle = estilo;
    ctx.shadowBlur = blur * p.dpr;
    ctx.shadowColor = blur ? cor : 'transparent';
    caminho(ctx, seta ? [pts[0], [bx - Math.cos(ang) * ponta * 0.5, by - Math.sin(ang) * ponta * 0.5]] : pts);
    ctx.stroke();
  };
  riscar(6.4 * px, 'rgba(0, 0, 0, 0.55)');
  riscar(3.4 * px, cor, 8);
  // o pó do giz: um traço fino mais claro no meio
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alfa * 0.55;
  riscar(1.2 * px, 'rgba(255, 255, 255, 0.85)');
  ctx.globalAlpha = alfa;
  if (seta && feito >= 1) {
    const tri = () => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(ang - 0.45) * ponta, by - Math.sin(ang - 0.45) * ponta);
      ctx.lineTo(bx - Math.cos(ang + 0.45) * ponta, by - Math.sin(ang + 0.45) * ponta);
      ctx.closePath();
    };
    ctx.setLineDash([]);
    tri();
    ctx.lineWidth = 3 * px;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.stroke();
    ctx.fillStyle = cor;
    ctx.shadowBlur = 8 * p.dpr;
    ctx.shadowColor = cor;
    tri();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * O ponto de atenção: anéis azuis abrindo no chão, um feixe de luz subindo (no isométrico) e o ícone do
 * Apontar flutuando em cima, girando devagar como uma moeda. Entra rápido e some no fim.
 */
function desenharPonto(ctx: CanvasRenderingContext2D, p: Projecao, m: Ponto, idade: number) {
  const px = p.px;
  const fim = 1 - suave((idade - (MARCA_PONTO_MS - 800)) / 800);
  const entra = suave(idade / 220);
  const a = Math.min(fim, entra);
  if (a <= 0.01) return;
  const [cx, cy] = p.proj(m.x, m.y);
  ctx.save();
  // os anéis no chão (círculos de casas: no isométrico viram elipses)
  const anel = (r: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const [x, y] = p.proj(m.x + Math.cos((i / 40) * Math.PI * 2) * r, m.y + Math.sin((i / 40) * Math.PI * 2) * r);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  };
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const t = ((idade - k * 380) % 1300) / 1300;
    if (idade < k * 380 || t < 0) continue;
    const e = 1 - (1 - t) ** 3;
    ctx.globalAlpha = a * (1 - t) * 0.95;
    anel(0.3 + e * 2.4);
    ctx.lineWidth = (5 * (1 - t) + 1.2) * px;
    ctx.strokeStyle = COR_PONTO;
    ctx.shadowBlur = 10 * p.dpr;
    ctx.shadowColor = BRILHO_PONTO;
    ctx.stroke();
  }
  // o chão aceso embaixo
  ctx.shadowBlur = 0;
  ctx.globalAlpha = a * (0.4 + 0.15 * Math.sin(idade / 200));
  anel(0.55);
  ctx.fillStyle = 'rgba(143, 208, 255, 0.45)';
  ctx.fill();
  // o feixe de luz (isométrico)
  if (p.alto) {
    const h = p.alto;
    const w = 12 * px;
    const g = ctx.createLinearGradient(cx, cy, cx, cy - h);
    g.addColorStop(0, 'rgba(160, 215, 255, 0.5)');
    g.addColorStop(1, 'rgba(160, 215, 255, 0)');
    ctx.globalAlpha = a * (0.75 + 0.25 * Math.sin(idade / 160));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy);
    ctx.lineTo(cx - w * 0.3, cy - h);
    ctx.lineTo(cx + w * 0.3, cy - h);
    ctx.lineTo(cx + w, cy);
    ctx.closePath();
    ctx.fill();
  }
  // em cima, balançando: o ícone do Apontar (gira como moeda: a largura vai e volta, nunca some)
  const sobe = (p.alto ? p.alto * 0.62 : 26 * px) + Math.sin(idade / 190) * 4 * px;
  const s = 10 * px * (0.6 + 0.4 * entra);
  const lx = cx;
  const ly = cy - sobe;
  ctx.globalAlpha = a;
  if (ICONE_PONTO.complete && ICONE_PONTO.naturalWidth) {
    const lado = 56 * px * (0.6 + 0.4 * entra);
    const giro = 0.35 + 0.65 * Math.abs(Math.cos(idade / 520));
    ctx.translate(lx, ly);
    ctx.scale(giro, 1);
    ctx.shadowBlur = 14 * p.dpr;
    ctx.shadowColor = BRILHO_PONTO;
    ctx.drawImage(ICONE_PONTO, -lado / 2, -lado / 2, lado, lado);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(lx, ly - s * 1.5);
  ctx.lineTo(lx + s, ly);
  ctx.lineTo(lx, ly + s * 1.5);
  ctx.lineTo(lx - s, ly);
  ctx.closePath();
  ctx.fillStyle = COR_PONTO;
  ctx.shadowBlur = 12 * p.dpr;
  ctx.shadowColor = BRILHO_PONTO;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.4 * px;
  ctx.strokeStyle = 'rgba(60, 36, 8, 0.85)';
  ctx.stroke();
  ctx.restore();
}
