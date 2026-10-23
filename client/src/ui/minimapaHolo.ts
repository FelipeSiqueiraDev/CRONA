/**
 * O minimapa holográfico (23/10, o Felipe: "um minimapa meio isométrico, no estilo da foto, sem muita poluição"):
 * a maquete de luz azul num chão de grade escuro. Os prédios são prismas de vidro com as arestas acesas; o prédio
 * aberto mostra os andares empilhados, o andar escolhido aceso e os outros só em contorno. O lugar do grupo fica em ouro.
 *
 * Aqui só o desenho (a projeção, o chão, o prisma, o cômodo, o rótulo e o ponto de luz); o que é cada coisa e o clique
 * ficam no minimapa.ts.
 */

/** A projeção isométrica 2:1 do tabuleiro: x para baixo à direita, y para baixo à esquerda, z para cima (em casas). */
export interface Iso {
  S: number;
  ox: number;
  oy: number;
}

export const proj = (iso: Iso, x: number, y: number, z = 0): [number, number] => [iso.ox + (x - y) * iso.S, iso.oy + (x + y) * iso.S * 0.5 - z * iso.S];

/** As cores do holograma: o ciano de vidro, o ouro do grupo e o cinza do que ninguém visitou. */
export const HOLO = {
  fundo0: '#040a14',
  fundo1: '#071526',
  grade: 'rgba(90,200,255,0.10)',
  gradeForte: 'rgba(90,200,255,0.22)',
  ciano: '#5ad8ff',
  cianoClaro: '#bff2ff',
  ouro: '#ffd27a',
  apagado: '#5a7a96',
};

export type Tom = 'normal' | 'foco' | 'aqui' | 'apagado' | 'fantasma';

interface Pintura {
  linha: string;
  brilho: number;
  topo: number;
  face: number;
  largura: number;
  tracejado?: boolean;
}

const PINTURA: Record<Tom, Pintura> = {
  normal: { linha: HOLO.ciano, brilho: 6, topo: 0.16, face: 0.08, largura: 1 },
  foco: { linha: HOLO.cianoClaro, brilho: 10, topo: 0.28, face: 0.14, largura: 1.4 },
  aqui: { linha: HOLO.ouro, brilho: 10, topo: 0.26, face: 0.12, largura: 1.4 },
  apagado: { linha: HOLO.apagado, brilho: 0, topo: 0.06, face: 0.03, largura: 1, tracejado: true },
  fantasma: { linha: HOLO.ciano, brilho: 0, topo: 0.03, face: 0, largura: 0.8 },
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** O fundo do painel: o azul-noite com a luz no meio. */
export function fundo(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  g.addColorStop(0, HOLO.fundo1);
  g.addColorStop(1, HOLO.fundo0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** O chão de grade (w × h casas, em z), com a borda acesa; `passo` = de quantas em quantas casas vai a linha. */
export function chao(ctx: CanvasRenderingContext2D, iso: Iso, x0: number, y0: number, w: number, h: number, z = 0, passo = 4, alfa = 1) {
  ctx.save();
  ctx.globalAlpha = alfa;
  const p = (x: number, y: number) => proj(iso, x, y, z);
  const quad = [p(x0, y0), p(x0 + w, y0), p(x0 + w, y0 + h), p(x0, y0 + h)];
  ctx.beginPath();
  quad.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(40,140,200,0.06)';
  ctx.fill();
  ctx.strokeStyle = HOLO.grade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0 + passo; x < x0 + w; x += passo) (ctx.moveTo(...p(x, y0)), ctx.lineTo(...p(x, y0 + h)));
  for (let y = y0 + passo; y < y0 + h; y += passo) (ctx.moveTo(...p(x0, y)), ctx.lineTo(...p(x0 + w, y)));
  ctx.stroke();
  ctx.shadowColor = HOLO.ciano;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = HOLO.gradeForte;
  ctx.beginPath();
  quad.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function poligono(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.closePath();
}

/**
 * O prisma de vidro (o prédio): as faces da frente translúcidas, as arestas acesas (as de trás mais fracas, como no
 * holograma), as linhas dos andares nas faces e os pontinhos das janelas. Devolve o contorno (para o clique).
 */
export function prisma(ctx: CanvasRenderingContext2D, iso: Iso, b: { x: number; y: number; w: number; d: number; z0?: number; h: number }, tom: Tom, andares = 1): Path2D {
  const pt = PINTURA[tom];
  const z0 = b.z0 ?? 0;
  const z1 = z0 + b.h;
  const P = (x: number, y: number, z: number) => proj(iso, x, y, z);
  const { x, y, w, d } = b;
  const topo: [number, number][] = [P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1)];
  const direita: [number, number][] = [P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y, z1)];
  const frente: [number, number][] = [P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)];
  ctx.save();
  if (pt.tracejado) ctx.setLineDash([3, 3]);
  // as arestas de trás (vistas através do vidro)
  ctx.strokeStyle = rgba(pt.linha, 0.25);
  ctx.lineWidth = pt.largura * 0.8;
  ctx.beginPath();
  ctx.moveTo(...P(x, y, z0));
  ctx.lineTo(...P(x + w, y, z0));
  ctx.moveTo(...P(x, y, z0));
  ctx.lineTo(...P(x, y + d, z0));
  ctx.moveTo(...P(x, y, z0));
  ctx.lineTo(...P(x, y, z1));
  ctx.stroke();
  // as faces
  ctx.fillStyle = rgba(pt.linha, pt.face);
  poligono(ctx, direita);
  ctx.fill();
  ctx.fillStyle = rgba(pt.linha, pt.face * 1.35);
  poligono(ctx, frente);
  ctx.fill();
  ctx.fillStyle = rgba(pt.linha, pt.topo);
  poligono(ctx, topo);
  ctx.fill();
  // os andares (linhas nas faces) e as janelas (pontinhos)
  if (andares > 1 && tom !== 'fantasma') {
    ctx.strokeStyle = rgba(pt.linha, 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 1; i < andares; i++) {
      const z = z0 + (b.h * i) / andares;
      ctx.moveTo(...P(x, y + d, z));
      ctx.lineTo(...P(x + w, y + d, z));
      ctx.lineTo(...P(x + w, y, z));
    }
    ctx.stroke();
  }
  if (tom !== 'fantasma' && tom !== 'apagado' && iso.S >= 2.2) {
    ctx.fillStyle = rgba(pt.linha, 0.55);
    const passo = Math.max(1.5, 3 / Math.max(1, iso.S / 3));
    for (let i = 0; i < andares; i++) {
      const z = z0 + (b.h * (i + 0.5)) / andares;
      for (let u = passo * 0.6; u < w - 0.3; u += passo) {
        const [sx, sy] = P(x + u, y + d, z);
        ctx.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2);
      }
      for (let u = passo * 0.6; u < d - 0.3; u += passo) {
        const [sx, sy] = P(x + w, y + u, z);
        ctx.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2);
      }
    }
  }
  // as arestas da frente, acesas
  ctx.shadowColor = pt.linha;
  ctx.shadowBlur = pt.brilho;
  ctx.strokeStyle = rgba(pt.linha, tom === 'fantasma' ? 0.35 : 0.95);
  ctx.lineWidth = pt.largura;
  poligono(ctx, topo);
  ctx.stroke();
  ctx.beginPath();
  for (const [xx, yy] of [[x + w, y], [x + w, y + d], [x, y + d]] as [number, number][]) (ctx.moveTo(...P(xx, yy, z0)), ctx.lineTo(...P(xx, yy, z1)));
  ctx.moveTo(...P(x + w, y, z0));
  ctx.lineTo(...P(x + w, y + d, z0));
  ctx.lineTo(...P(x, y + d, z0));
  ctx.stroke();
  ctx.restore();
  const contorno = new Path2D();
  [P(x, y, z1), P(x + w, y, z1), P(x + w, y, z0), P(x + w, y + d, z0), P(x, y + d, z0), P(x, y + d, z1)].forEach(([a, c], i) => (i ? contorno.lineTo(a, c) : contorno.moveTo(a, c)));
  contorno.closePath();
  return contorno;
}

/**
 * O cômodo: o chão (as casas dele, em z) e as paredes baixas de vidro só na borda, com a aresta de cima acesa.
 * `casas` = as casas de chão já na posição da planta. Devolve o chão (para o clique).
 */
export function comodo(ctx: CanvasRenderingContext2D, iso: Iso, casas: [number, number][], z: number, alto: number, tom: Tom): Path2D {
  const pt = PINTURA[tom];
  const tem = new Set(casas.map(([x, y]) => `${x},${y}`));
  const P = (x: number, y: number, zz: number) => proj(iso, x, y, zz);
  const chaoP = new Path2D();
  for (const [x, y] of casas) {
    const q = [P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z)];
    q.forEach(([a, b], i) => (i ? chaoP.lineTo(a, b) : chaoP.moveTo(a, b)));
    chaoP.closePath();
  }
  // as bordas: o lado da casa sem vizinha do mesmo cômodo
  const bordas: [number, number, number, number, boolean][] = [];
  for (const [x, y] of casas) {
    if (!tem.has(`${x},${y - 1}`)) bordas.push([x, y, x + 1, y, false]);
    if (!tem.has(`${x - 1},${y}`)) bordas.push([x, y, x, y + 1, false]);
    if (!tem.has(`${x + 1},${y}`)) bordas.push([x + 1, y, x + 1, y + 1, true]);
    if (!tem.has(`${x},${y + 1}`)) bordas.push([x, y + 1, x + 1, y + 1, true]);
  }
  ctx.save();
  if (pt.tracejado) ctx.setLineDash([2, 3]);
  ctx.fillStyle = rgba(pt.linha, pt.topo);
  ctx.fill(chaoP);
  if (alto > 0 && tom !== 'fantasma') {
    // as paredes: as de trás primeiro, mais fracas, e as da frente por cima
    for (const frente of [false, true]) {
      ctx.fillStyle = rgba(pt.linha, frente ? pt.face * 1.2 : pt.face * 0.6);
      ctx.beginPath();
      for (const [ax, ay, bx, by, f] of bordas) {
        if (f !== frente) continue;
        ctx.moveTo(...P(ax, ay, z));
        ctx.lineTo(...P(bx, by, z));
        ctx.lineTo(...P(bx, by, z + alto));
        ctx.lineTo(...P(ax, ay, z + alto));
        ctx.closePath();
      }
      ctx.fill();
    }
  }
  ctx.shadowColor = pt.linha;
  ctx.shadowBlur = pt.brilho * 0.7;
  ctx.strokeStyle = rgba(pt.linha, tom === 'fantasma' ? 0.3 : 0.9);
  ctx.lineWidth = pt.largura;
  ctx.beginPath();
  const zt = z + (tom === 'fantasma' ? 0 : alto);
  for (const [ax, ay, bx, by] of bordas) (ctx.moveTo(...P(ax, ay, zt)), ctx.lineTo(...P(bx, by, zt)));
  ctx.stroke();
  ctx.restore();
  return chaoP;
}

/** O rótulo flutuante (o nome em cima do prédio ou do cômodo): o vidro escuro com a borda acesa e uma hastezinha. */
export function rotulo(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, tom: Tom, fonte: string, tam: number, haste = 8) {
  const pt = PINTURA[tom === 'fantasma' ? 'normal' : tom];
  ctx.save();
  ctx.font = `700 ${tam}px ${fonte}`;
  const w = Math.ceil(ctx.measureText(txt).width) + 10;
  const h = Math.round(tam + 7);
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - haste - h);
  ctx.strokeStyle = rgba(pt.linha, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, y);
  ctx.lineTo(Math.round(x) + 0.5, by + h);
  ctx.stroke();
  ctx.fillStyle = 'rgba(4,12,24,0.88)';
  ctx.shadowColor = pt.linha;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.roundRect(bx + 0.5, by + 0.5, w, h, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(pt.linha, 0.9);
  ctx.stroke();
  ctx.fillStyle = tom === 'aqui' ? HOLO.ouro : HOLO.cianoClaro;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, bx + w / 2 + 0.5, by + h / 2 + 1);
  ctx.restore();
  return { x: bx, y: by, w: w + 1, h: h + 1 };
}

/** A peça: o ponto de luz na cor do agente, com o feixe fininho que sobe dele. */
export function ponto(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, r: number) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y - r * 5, x, y);
  g.addColorStop(0, rgba(cor.length === 7 ? cor : '#ffffff', 0));
  g.addColorStop(1, rgba(cor.length === 7 ? cor : '#ffffff', 0.7));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 5);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.shadowColor = cor;
  ctx.shadowBlur = 8;
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A escada no chão do cômodo: três degraus de luz subindo (ou descendo) na casa dela, com a seta. Devolve a caixa do
 * desenho (para o clique).
 */
export function escada(ctx: CanvasRenderingContext2D, iso: Iso, x: number, y: number, sobe: boolean, foco: boolean) {
  const cor = foco ? HOLO.cianoClaro : HOLO.ciano;
  const P = (a: number, b: number, z: number) => proj(iso, a, b, z);
  ctx.save();
  ctx.shadowColor = cor;
  ctx.shadowBlur = foco ? 10 : 6;
  ctx.strokeStyle = rgba(cor, 0.95);
  ctx.fillStyle = rgba(cor, foco ? 0.35 : 0.2);
  ctx.lineWidth = 1;
  const n = 4;
  const T = 1.7;
  const ex = x + 0.5 - T / 2;
  const ey = y + 0.5 - T / 2;
  for (let i = 0; i < n; i++) {
    // cada degrau: uma faixa, mais alta quanto mais para o fundo (sobe) ou para a frente (desce)
    const k = sobe ? n - 1 - i : i;
    const z = ((k + 1) / n) * 1.8;
    const y0 = ey + (i / n) * T;
    const y1 = ey + ((i + 1) / n) * T;
    const pts = [P(ex, y0, z), P(ex + T, y0, z), P(ex + T, y1, z), P(ex, y1, z)];
    ctx.beginPath();
    pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // a setinha em cima
  const [cx, cy] = P(x + 0.5, y + 0.5, 3);
  const s = Math.max(4, iso.S * 0.9);
  ctx.beginPath();
  if (sobe) (ctx.moveTo(cx, cy - s), ctx.lineTo(cx + s * 0.8, cy), ctx.lineTo(cx - s * 0.8, cy));
  else (ctx.moveTo(cx, cy + s * 0.4), ctx.lineTo(cx + s * 0.8, cy - s * 0.6), ctx.lineTo(cx - s * 0.8, cy - s * 0.6));
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
  const cantos = [P(ex, ey, 0), P(ex + T, ey, 0), P(ex + T, ey + T, 0), P(ex, ey + T, 0), [cx, cy - s] as [number, number]];
  const x0 = Math.min(...cantos.map((c) => c[0])) - 3;
  const y0 = Math.min(...cantos.map((c) => c[1])) - 3;
  return { x: x0, y: y0, w: Math.max(...cantos.map((c) => c[0])) + 3 - x0, h: Math.max(...cantos.map((c) => c[1])) + 3 - y0 };
}

/**
 * A porta: a moldura de luz em pé na borda do cômodo (mais alta que a parede de vidro, para achar de longe), no lado
 * `lado` da casa (n = y de cima, s = de baixo, o = x da esquerda, l = da direita).
 */
export function porta(ctx: CanvasRenderingContext2D, iso: Iso, x: number, y: number, lado: 'n' | 's' | 'o' | 'l', alto: number, tom: Tom) {
  const cor = tom === 'aqui' ? HOLO.ouro : tom === 'apagado' ? HOLO.apagado : HOLO.cianoClaro;
  const [a, b] =
    lado === 'n' ? [[x - 0.1, y], [x + 1.1, y]] : lado === 's' ? [[x - 0.1, y + 1], [x + 1.1, y + 1]] : lado === 'o' ? [[x, y - 0.1], [x, y + 1.1]] : [[x + 1, y - 0.1], [x + 1, y + 1.1]];
  const P = (q: number[], z: number) => proj(iso, q[0], q[1], z);
  const quad = [P(a, 0), P(b, 0), P(b, alto), P(a, alto)];
  ctx.save();
  ctx.fillStyle = rgba(cor, tom === 'apagado' ? 0.12 : 0.32);
  poligono(ctx, quad);
  ctx.fill();
  ctx.shadowColor = cor;
  ctx.shadowBlur = tom === 'apagado' ? 0 : 8;
  ctx.strokeStyle = rgba(cor, tom === 'apagado' ? 0.5 : 1);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(...P(a, 0));
  ctx.lineTo(...P(a, alto));
  ctx.lineTo(...P(b, alto));
  ctx.lineTo(...P(b, 0));
  ctx.stroke();
  ctx.restore();
}

/** O marcador do grupo: o anel de ouro no chão em volta do lugar. */
export function anel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.shadowColor = HOLO.ouro;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = rgba(HOLO.ouro, 0.85);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Escala e origem para caber o que foi medido (em S = 1) no painel. */
export function encaixarIso(pts: [number, number][], W: number, H: number, pad: number, teto = Infinity): Iso {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const S = Math.max(0.5, Math.min(teto, (W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0)));
  return { S, ox: Math.round(W / 2 - ((x0 + x1) / 2) * S), oy: Math.round(H / 2 - ((y0 + y1) / 2) * S) };
}
