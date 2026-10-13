/**
 * Marcações do combate no tabuleiro (docs/TELA-COMBATE.md, "Tabuleiro"): a base
 * na cor do lado, o anel de alcance da arma, a linha até o alvo com a
 * distância, o escudo da cobertura, a mira, a caveira de quem está morrendo, o
 * círculo de quem sustenta ritual, a medida e a área. A tela COMBATE diz o que
 * mostrar; o RoomView desenha a cada quadro, com as peças onde estiverem.
 */
import { combate as cb } from '@crona/shared';
import { contornoArea, type Area, type Casa } from '../room/combateGeo';
import { UI_FONT } from './bubbles';
import { iso } from './iso';
import type { Light } from './lighting';

export interface MarcasCombate {
  /** cor da base de cada peça (id da peça no tabuleiro) */
  bases: Map<number, string>;
  /** peças deitadas (caído, inconsciente) */
  deitadas: Set<number>;
  /** caveira em cima (morrendo, 0 PV) */
  caveiras: Set<number>;
  /** círculo de símbolos no chão (sustentando ritual) */
  rituais: Set<number>;
  /** anel de alcance em volta de quem age; o dobro vem mais fraco */
  alcance: { id: number; casas: number; rotulo: string; dobro: boolean } | null;
  /** linha até o alvo, com a etiqueta ("7,5 m · curto"); `fora` pinta de vermelho */
  linha: { de: number; ate: number; rotulo: string; fora?: boolean } | null;
  /** escudo onde a linha bate no que cobre */
  cobertura: { casa: Casa; rotulo: string; total: boolean } | null;
  mira: number | null;
  /** medida: dois pontos (b nulo = segue o mouse) */
  medida: { a: Casa; b: Casa | null } | null;
  area: (Area & { rotulo: string }) | null;
  /** peças dentro da área (anel vermelho) */
  naArea: Set<number>;
  /** de quem é a vez (brilha no mapa tático) */
  vez: Set<number>;
  /** o movimento: as casas aonde quem age chega andando (acesas; a do mouse, mais forte) */
  passos?: Casa[] | null;
}

export function marcasVazias(): MarcasCombate {
  return { bases: new Map(), deitadas: new Set(), caveiras: new Set(), rituais: new Set(), alcance: null, linha: null, cobertura: null, mira: null, medida: null, area: null, naArea: new Set(), vez: new Set() };
}

/** Posição da peça em casas (com o passo em andamento) e a altura do chão dela. */
export type PosPeca = (id: number) => { x: number; y: number; z: number } | null;

export const COR_LADO = { agente: '#3fc6ff', inimigo: '#ff3b35', neutro: '#b9b3a8' } as const;
/**
 * As peças pintadas do kit para o chão do combate (arte/combate/): a base de cada lado e o círculo do
 * ritual, já em elipse 2:1. Sem a imagem (ainda carregando, ou sem arte), fica o desenho de código.
 */
function imagem(url: string) {
  const im = new Image();
  im.decoding = 'async';
  im.src = url;
  return im;
}
const KIT = {
  agente: imagem('/arte/combate/base-agente.png'),
  inimigo: imagem('/arte/combate/base-inimigo.png'),
  ritual: imagem('/arte/combate/circulo-ritual.png'),
};
const pronta = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;

/** A base pintada do lado (agente ou inimigo), ou null para o anel de código. */
export function baseDoKit(cor: string | undefined): HTMLImageElement | null {
  const im = cor === COR_LADO.agente ? KIT.agente : cor === COR_LADO.inimigo ? KIT.inimigo : null;
  return im && pronta(im) ? im : null;
}

const AMBAR = 'rgba(246,196,74,0.95)';
const CIANO = 'rgba(80,200,255,0.9)';
const VERMELHO = 'rgba(255,64,56,0.95)';

function circuloChao(ctx: CanvasRenderingContext2D, cx: number, cy: number, z: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const [x, y] = iso(cx + r * Math.cos(a), cy + r * Math.sin(a), z);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function poligonoChao(ctx: CanvasRenderingContext2D, pts: [number, number][], z: number) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const [x, y] = iso(px, py, z);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
}

/** Círculo de ritual: dois anéis, a estrela e marcas entre os anéis. */
function circuloRitual(ctx: CanvasRenderingContext2D, cx: number, cy: number, z: number, now: number) {
  const pulso = 0.75 + 0.25 * Math.sin(now / 420);
  ctx.save();
  ctx.strokeStyle = `rgba(235,44,40,${0.85 * pulso})`;
  ctx.shadowColor = 'rgba(255,40,30,0.9)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.3;
  circuloChao(ctx, cx, cy, z, 1.7);
  ctx.stroke();
  circuloChao(ctx, cx, cy, z, 1.25);
  ctx.stroke();
  const giro = now / 9000;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = giro + (i * 2 * (Math.PI * 2)) / 5 - Math.PI / 2;
    const [x, y] = iso(cx + 1.2 * Math.cos(a), cy + 1.2 * Math.sin(a), z);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const a = -giro * 1.5 + (i / 16) * Math.PI * 2;
    const [x0, y0] = iso(cx + 1.33 * Math.cos(a), cy + 1.33 * Math.sin(a), z);
    const [x1, y1] = iso(cx + 1.6 * Math.cos(a + 0.12), cy + 1.6 * Math.sin(a + 0.12), z);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Antes das peças: o que fica no chão, embaixo delas (círculos de ritual e a área). */
export function desenharChao(ctx: CanvasRenderingContext2D, m: MarcasCombate, pos: PosPeca, altura: (c: Casa) => number, now: number, lights: Light[]) {
  for (const id of m.rituais) {
    const p = pos(id);
    if (!p) continue;
    if (pronta(KIT.ritual)) {
      // o círculo pintado, do tamanho do de código (raio de 1,7 casa), pulsando
      const [x, y] = iso(p.x + 0.5, p.y + 0.5, p.z + 0.02);
      const w = 1.7 * 2 * 32 * Math.SQRT2;
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 420);
      ctx.drawImage(KIT.ritual, x - w / 2, y - w / 4, w, w / 2);
      ctx.restore();
    } else circuloRitual(ctx, p.x + 0.5, p.y + 0.5, p.z + 0.02, now);
    const [lx, ly] = iso(p.x + 0.5, p.y + 0.5, p.z);
    lights.push({ x: lx, y: ly, radius: 70, color: '#ff3a2a', intensity: 0.55, kind: 'emergency' });
  }
  if (m.area) {
    const pts = contornoArea(m.area);
    const z = altura(m.area.forma === 'cone' || m.area.forma === 'linha' ? m.area.origem : m.area.alvo);
    ctx.save();
    poligonoChao(ctx, pts, z + 0.02);
    ctx.fillStyle = 'rgba(220,36,30,0.16)';
    ctx.fill();
    ctx.restore();
  }
  // o movimento: cada casa aonde dá para ir, um losango ciano pulsando de leve
  if (m.passos?.length) {
    ctx.save();
    const pulso = 0.16 + 0.05 * Math.sin(now / 380);
    ctx.fillStyle = `rgba(80,200,255,${pulso})`;
    ctx.strokeStyle = 'rgba(120,220,255,0.35)';
    ctx.lineWidth = 0.8;
    for (const c of m.passos) {
      const z = altura(c) + 0.02;
      const i = 0.06;
      poligonoChao(ctx, [[c.x + i, c.y + i], [c.x + 1 - i, c.y + i], [c.x + 1 - i, c.y + 1 - i], [c.x + i, c.y + 1 - i]], z);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Anel de destaque no pé da peça. */
function anelPe(ctx: CanvasRenderingContext2D, p: { x: number; y: number; z: number }, cor: string, r = 0.62) {
  ctx.strokeStyle = cor;
  circuloChao(ctx, p.x + 0.5, p.y + 0.5, p.z + 0.02, r);
  ctx.stroke();
}

/** Seta no fim da linha. */
function ponta(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, cor: string) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

/** Depois da luz: anel de alcance, linha, mira, medida e o contorno da área (no mundo). */
export function desenharCima(ctx: CanvasRenderingContext2D, m: MarcasCombate, pos: PosPeca, altura: (c: Casa) => number, hover: Casa | null, now: number) {
  ctx.save();
  // a casa do mouse, se for uma aonde dá para ir
  if (hover && m.passos?.some((c) => c.x === hover.x && c.y === hover.y)) {
    ctx.fillStyle = 'rgba(120,230,255,0.55)';
    poligonoChao(ctx, [[hover.x, hover.y], [hover.x + 1, hover.y], [hover.x + 1, hover.y + 1], [hover.x, hover.y + 1]], altura(hover) + 0.03);
    ctx.fill();
  }
  if (m.alcance) {
    const p = pos(m.alcance.id);
    if (p) {
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -now / 60;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = CIANO;
      circuloChao(ctx, p.x + 0.5, p.y + 0.5, p.z + 0.02, m.alcance.casas);
      ctx.stroke();
      if (m.alcance.dobro) {
        ctx.strokeStyle = 'rgba(80,200,255,0.32)';
        circuloChao(ctx, p.x + 0.5, p.y + 0.5, p.z + 0.02, m.alcance.casas * 2);
        ctx.stroke();
      }
    }
  }
  if (m.area) {
    const z = m.area.forma === 'cone' || m.area.forma === 'linha' ? altura(m.area.origem) : altura(m.area.alvo);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,80,70,0.9)';
    poligonoChao(ctx, contornoArea(m.area), z + 0.03);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  for (const id of m.naArea) {
    const p = pos(id);
    if (p) anelPe(ctx, p, 'rgba(255,70,60,0.9)', 0.55);
  }
  if (m.mira !== null) {
    const p = pos(m.mira);
    if (p) {
      const pulso = 1 + Math.sin(now / 220) * 0.06;
      ctx.lineWidth = 2;
      anelPe(ctx, p, VERMELHO, 0.62 * pulso);
      ctx.lineWidth = 1;
      anelPe(ctx, p, 'rgba(255,64,56,0.5)', 0.85 * pulso);
      // quatro marcas de mira
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const [x0, y0] = iso(p.x + 0.5 + 0.72 * Math.cos(a), p.y + 0.5 + 0.72 * Math.sin(a), p.z + 0.02);
        const [x1, y1] = iso(p.x + 0.5 + 1.02 * Math.cos(a), p.y + 0.5 + 1.02 * Math.sin(a), p.z + 0.02);
        ctx.lineWidth = 2;
        ctx.strokeStyle = VERMELHO;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
  }
  if (m.linha) {
    const a = pos(m.linha.de);
    const b = pos(m.linha.ate);
    if (a && b) {
      const [x0, y0] = iso(a.x + 0.5, a.y + 0.5, a.z + 1.9);
      const [x1, y1] = iso(b.x + 0.5, b.y + 0.5, b.z + 1.9);
      const cor = m.linha.fora ? VERMELHO : AMBAR;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now / 40;
      ctx.lineWidth = 2;
      ctx.strokeStyle = cor;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ponta(ctx, x0, y0, x1, y1, cor);
      ctx.shadowBlur = 0;
    }
  }
  if (m.medida) {
    const b = m.medida.b ?? hover;
    if (b) {
      const za = altura(m.medida.a);
      const zb = altura(b);
      const [x0, y0] = iso(m.medida.a.x + 0.5, m.medida.a.y + 0.5, za + 0.05);
      const [x1, y1] = iso(b.x + 0.5, b.y + 0.5, zb + 0.05);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(245,240,230,0.95)';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(245,240,230,0.95)';
      for (const [x, y] of [
        [x0, y0],
        [x1, y1],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Etiqueta escura com borda colorida (em pixels de tela). */
function etiqueta(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string, cor: string, icone?: (x: number, y: number) => void) {
  ctx.font = `600 12px ${UI_FONT}`;
  const iw = icone ? 16 : 0;
  const w = Math.ceil(ctx.measureText(texto).width) + 16 + iw;
  const h = 20;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - h / 2);
  ctx.fillStyle = 'rgba(10,12,14,0.9)';
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx + 0.5, by + 0.5, w - 1, h - 1, 3);
  ctx.fill();
  ctx.stroke();
  if (icone) icone(bx + 11, by + h / 2);
  ctx.fillStyle = cor;
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, bx + 8 + iw, by + h / 2 + 0.5);
}

function escudo(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 5, y - 4);
  ctx.lineTo(x + 4.5, y + 1);
  ctx.quadraticCurveTo(x + 3, y + 5, x, y + 7);
  ctx.quadraticCurveTo(x - 3, y + 5, x - 4.5, y + 1);
  ctx.lineTo(x - 5, y - 4);
  ctx.closePath();
  ctx.fill();
}

function caveira(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(12,8,10,0.9)';
  ctx.strokeStyle = 'rgba(255,70,60,0.95)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 11, y - 11, 22, 22, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2ece2';
  ctx.beginPath();
  ctx.arc(x, y - 1.5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 3.5, y + 2, 7, 5);
  ctx.fillStyle = 'rgba(12,8,10,1)';
  ctx.beginPath();
  ctx.arc(x - 2.4, y - 1.8, 1.7, 0, Math.PI * 2);
  ctx.arc(x + 2.4, y - 1.8, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 0.5, y + 3, 1, 3.5);
}

/** Por último, em pixels de tela: as etiquetas, o escudo da cobertura e as caveiras. */
export function desenharRotulos(
  ctx: CanvasRenderingContext2D,
  m: MarcasCombate,
  pos: PosPeca,
  altura: (c: Casa) => number,
  hover: Casa | null,
  tela: (wx: number, wy: number) => [number, number],
  cabeca: (id: number) => [number, number] | null,
) {
  if (m.alcance) {
    const p = pos(m.alcance.id);
    if (p) {
      // no pé de quem ataca: o anel pode ser maior que o quadro
      const [sx, sy] = tela(...iso(p.x + 0.5, p.y + 0.5, p.z));
      etiqueta(ctx, sx, sy + 26, m.alcance.rotulo, 'rgba(120,214,255,0.95)');
    }
  }
  if (m.linha) {
    const a = pos(m.linha.de);
    const b = pos(m.linha.ate);
    if (a && b) {
      const [x0, y0] = tela(...iso(a.x + 0.5, a.y + 0.5, a.z + 1.9));
      const [x1, y1] = tela(...iso(b.x + 0.5, b.y + 0.5, b.z + 1.9));
      etiqueta(ctx, (x0 + x1) / 2, (y0 + y1) / 2 - 16, m.linha.rotulo, m.linha.fora ? VERMELHO : AMBAR);
    }
  }
  if (m.cobertura) {
    const c = m.cobertura.casa;
    const [sx, sy] = tela(...iso(c.x + 0.5, c.y + 0.5, altura(c) + 1.6));
    const cor = m.cobertura.total ? VERMELHO : '#f2ece2';
    etiqueta(ctx, sx, sy, m.cobertura.rotulo, cor, (x, y) => escudo(ctx, x, y, cor));
  }
  if (m.medida) {
    const b = m.medida.b ?? hover;
    if (b) {
      const d = cb.metrosDe(cb.distanciaCasas(m.medida.a, b));
      const f = cb.faixaDaDistancia(d);
      const [x0, y0] = tela(...iso(m.medida.a.x + 0.5, m.medida.a.y + 0.5, altura(m.medida.a)));
      const [x1, y1] = tela(...iso(b.x + 0.5, b.y + 0.5, altura(b)));
      etiqueta(ctx, (x0 + x1) / 2, (y0 + y1) / 2 - 14, `${cb.textoMetros(d)} · ${f ? cb.NOME_FAIXA[f] : 'além do extremo'}`, '#f2ece2');
    }
  }
  if (m.area) {
    const c = m.area.alvo;
    const [sx, sy] = tela(...iso(c.x + 0.5, c.y + 0.5, altura(c)));
    etiqueta(ctx, sx, sy + 18, m.area.rotulo, 'rgba(255,110,100,0.95)');
  }
  for (const id of m.caveiras) {
    const h = cabeca(id);
    if (!h) continue;
    const [sx, sy] = tela(h[0], h[1]);
    caveira(ctx, sx, sy - 16);
  }
}
