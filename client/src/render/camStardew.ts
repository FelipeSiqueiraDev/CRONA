import { footprint, getFurni, getWallFurni, Z_PER_M, M_POR_CASA, type FloorItem, type FurniDef, type RoomMap, type WallItem } from '@crona/shared';
import type { Enquadre, PecaTatica } from './mapaTatico';

/**
 * Câmera estilo Stardew Valley (PROTÓTIPO, 22/10/2026): a sala vista de cima e um pouco de frente (3/4), na grade
 * quadrada, sem a diagonal do isométrico. A parede do fundo mostra a face; as laterais são faixas finas; a da frente
 * não aparece. Tudo desenhado por código, em pixel art (16 px por casa, ampliada sem suavizar): chão de tábuas,
 * paredes, móveis como caixas com frente e tampo, luz por cima. As peças são só marcadores por enquanto (os bonecos
 * nessa visão vêm depois). É opt-in (`?camera=stardew` ou a tecla K) e só vale nas cenas que `cenaStardew` aceita.
 */

/** Pixels de arte por casa (a ampliação é inteira quando cabe, para o pixel ficar redondo). */
const P = 16;
/** A altura da parede do fundo, em casas. */
const PAREDE = 2.5;
/** A espessura das paredes laterais e o beiral da frente, em casas. */
const LADO = 0.5;
const FRENTE = 0.35;
/** O quanto a altura real dos móveis é achatada na tela (a câmera olha de cima). */
const ACHATA = 0.62;
/** O quanto o tampo dos móveis mostra da profundidade (o resto some no ângulo). */
const TAMPO = 0.6;
/** Unidades de altura do jogo por casa (def.height vem em unidades; 1 casa = 0,75 m). */
const U_POR_CASA = Z_PER_M * M_POR_CASA;

/** Por enquanto só o bar da Sede. */
export const cenaStardew = (nome: string | undefined): boolean => !!nome && /Sede · Bar$/.test(nome);

export interface AcertoStardew {
  id: number;
  /** o retângulo na tela (px do canvas) que a peça cobre, de trás para a frente na ordem de desenho */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  chao: boolean;
}

export interface EntradaStardew {
  map: RoomMap;
  nome: string;
  darkness: number;
  ambient?: string;
  itens: FloorItem[];
  paredes: WallItem[];
  pecas: PecaTatica[];
  now: number;
  /** o quadro onde cabe a sala, em px do canvas */
  quadro: { x: number; y: number; w: number; h: number };
  zoom: { k: number; dx: number; dy: number };
  mouse: { x: number; y: number } | null;
  casaMouse: { x: number; y: number } | null;
  escolhido: number | null;
  mostrarItem?: (it: FloorItem) => boolean;
  dpr: number;
  piso?: string;
}

// ------------------------------------------------------------------ cores e acaso
const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb = (r: number, g: number, b: number) => `rgb(${Math.max(0, Math.min(255, Math.round(r)))},${Math.max(0, Math.min(255, Math.round(g)))},${Math.max(0, Math.min(255, Math.round(b)))})`;
/** Clareia (a > 0) ou escurece (a < 0). */
const shade = (c: string, a: number): string => {
  const [r, g, b] = hex(c);
  return a >= 0 ? rgb(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a) : rgb(r * (1 + a), g * (1 + a), b * (1 + a));
};
const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const CONTORNO = '#140c0a';

type Ctx = CanvasRenderingContext2D;
const ret = (c: Ctx, x: number, y: number, w: number, h: number, cor: string) => {
  c.fillStyle = cor;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
/** Retângulo com contorno de 1 px (a "linha" do pixel art). */
const caixa = (c: Ctx, x: number, y: number, w: number, h: number, cor: string, contorno = CONTORNO) => {
  ret(c, x, y, w, h, contorno);
  ret(c, x + 1, y + 1, w - 2, h - 2, cor);
};

// ------------------------------------------------------------------ chão
function pisoDaCasa(c: Ctx, x: number, y: number, cx: number, cy: number, estilo: string) {
  if (estilo === 'madeira' || !estilo) {
    // tábuas compridas (cerca de 2 casas): cada fileira tem a emenda deslocada, o tom muda por tábua, não por casa
    const COMP = 34;
    for (let i = 0; i < 4; i++) {
      const R = cy * 4 + i;
      const desloc = Math.floor(hash(R, 7) * COMP);
      let px = 0;
      while (px < P) {
        const abs = cx * P + px + desloc;
        const seg = Math.floor(abs / COMP);
        const ate = Math.min(P, (seg + 1) * COMP - desloc - cx * P);
        const tom = hash(R, seg, 3) * 0.2 - 0.1;
        ret(c, x + px, y + i * 4, ate - px, 3, shade('#7a5634', tom));
        ret(c, x + px, y + i * 4 + 3, ate - px, 1, shade('#7a5634', -0.3));
        if (ate - px > 0 && (abs + (ate - px)) % COMP === 0) ret(c, x + ate - 1, y + i * 4, 1, 3, shade('#7a5634', -0.32));
        if (hash(R, seg, 11) > 0.72) ret(c, x + px + 2, y + i * 4 + 1, Math.min(2, ate - px), 1, shade('#7a5634', tom - 0.12));
        px = ate;
      }
    }
    return;
  }
  // qualquer outro piso: laje de pedra por enquanto
  const tom = hash(cx, cy) * 0.1 - 0.05;
  ret(c, x, y, P, P, shade('#6a6660', tom));
  ret(c, x, y + P - 1, P, 1, shade('#6a6660', -0.25));
  ret(c, x + P - 1, y, 1, P, shade('#6a6660', -0.25));
}

// ------------------------------------------------------------------ móveis
interface Medida {
  /** a pegada na tela (px de arte): x, y do canto de trás-esquerda do chão, largura e profundidade */
  gx: number;
  gy: number;
  gw: number;
  gd: number;
  /** a altura do móvel (px) e a do chão dele (px), já achatadas */
  alt: number;
  z0: number;
}

const medida = (it: FloorItem, def: FurniDef, ox: number, oy: number, sx: number, sy: number): Medida => ({
  gx: ox + it.x * P,
  gy: oy + it.y * P,
  gw: sx * P,
  gd: sy * P,
  alt: Math.max(1, Math.round((def.height / U_POR_CASA) * P * ACHATA)),
  z0: Math.round((it.z / U_POR_CASA) * P * ACHATA),
});

/** Uma caixa 3/4: frente, lado direito escurecido não aparece (ortogonal); tampo clareado em cima. */
function desenharCaixa(c: Ctx, m: Medida, frente: string, tampo: string, tampoD = TAMPO) {
  const baseY = m.gy + m.gd - m.z0; // a aresta da frente, no chão do móvel
  const topoFrente = baseY - m.alt;
  const tampoH = Math.max(2, Math.round(m.gd * tampoD));
  caixa(c, m.gx, topoFrente, m.gw, m.alt, frente);
  // um filete claro no alto da frente e um escuro embaixo: dá volume sem texto
  ret(c, m.gx + 1, topoFrente + 1, m.gw - 2, 1, shade(frente, 0.18));
  ret(c, m.gx + 1, baseY - 2, m.gw - 2, 1, shade(frente, -0.25));
  caixa(c, m.gx, topoFrente - tampoH + 1, m.gw, tampoH, tampo);
  ret(c, m.gx + 1, topoFrente - tampoH + 2, m.gw - 2, 1, shade(tampo, 0.2));
  return { topoFrente, baseY, tampoH };
}

function sombraNoChao(c: Ctx, m: Medida, extra = 0) {
  c.fillStyle = 'rgba(8,4,6,0.34)';
  c.fillRect(Math.round(m.gx + 1), Math.round(m.gy + m.gd - 2 + extra), Math.round(m.gw), 3);
  c.fillRect(Math.round(m.gx + m.gw), Math.round(m.gy + m.gd - m.alt * 0.4), 2, Math.round(m.alt * 0.4));
}

function garrafas(c: Ctx, x: number, y: number, w: number, seed: number, linha = 1) {
  const cores = ['#3a8a4a', '#c9a24a', '#8a1a14', '#3a6a9a', '#e8e4dc', '#5a3a1a', '#9a5a2a'];
  for (let a = 1; a + 2 < w; a += 3) {
    const k = Math.floor(hash(seed, a, linha) * cores.length);
    const alta = 4 + Math.floor(hash(seed, a + 3, linha) * 2);
    ret(c, x + a, y - alta, 2, alta, cores[k]);
    ret(c, x + a, y - alta - 1, 1, 1, shade(cores[k], 0.4));
    ret(c, x + a, y - alta, 1, 1, shade(cores[k], 0.45));
  }
}

function desenharMovel(c: Ctx, it: FloorItem, def: FurniDef, m: Medida, now: number, seed: number) {
  const [c0, c1, c2] = def.colors;
  const k = def.kind;
  const base = m.gy + m.gd - m.z0;
  const cx = m.gx + m.gw / 2;
  switch (k) {
    case 'bar_counter': {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c0, c2, 0.5);
      // painel de madeira escura na frente, com a moldura
      ret(c, m.gx + 3, g.topoFrente + 4, m.gw - 6, g.baseY - g.topoFrente - 7, c1);
      ret(c, m.gx + 3, g.topoFrente + 4, m.gw - 6, 1, shade(c1, 0.2));
      for (let i = 1; i < m.gw / 8; i++) ret(c, m.gx + i * 8, g.topoFrente + 5, 1, g.baseY - g.topoFrente - 9, shade(c1, -0.35));
      return;
    }
    case 'bar_shelf': {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c1, shade(c0, 0.05), 0.25);
      const largura = m.gw - 4;
      const altura = g.baseY - g.topoFrente - 4;
      ret(c, m.gx + 2, g.topoFrente + 2, largura, altura, '#1a100c');
      const n = Math.max(2, Math.floor(altura / 8));
      for (let i = 0; i < n; i++) {
        const y = g.topoFrente + 2 + Math.round(((i + 1) * altura) / n);
        ret(c, m.gx + 2, y - 1, largura, 1, shade(c0, 0.1));
        garrafas(c, m.gx + 2, y - 1, largura, seed, i);
      }
      return;
    }
    case 'beer_fridge': {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c0, shade(c0, 0.28), 0.3);
      const h = g.baseY - g.topoFrente;
      // a porta: moldura, vidro aceso e a maçaneta
      ret(c, m.gx + 3, g.topoFrente + 3, m.gw - 6, h - 6, shade(c0, -0.22));
      const vidro = m.gw > 12 ? 1 : 0;
      ret(c, m.gx + 4, g.topoFrente + 4, m.gw - 8 - vidro, Math.max(4, Math.floor(h * 0.55)), shade(c1, -0.05));
      ret(c, m.gx + 4, g.topoFrente + 4, 1, Math.max(4, Math.floor(h * 0.55)), shade(c1, 0.35));
      ret(c, m.gx + m.gw - 5, g.topoFrente + Math.floor(h * 0.6), 1, 5, '#cfd0d4');
      if (def.id === 'beer_fridge') ret(c, m.gx + m.gw - 7, g.topoFrente + Math.floor(h * 0.4), 3, 4, '#5a4a20');
      return;
    }
    case 'stool_high': {
      // banco alto: o assento redondo e as pernas
      const r = Math.round(m.gw * 0.34);
      const topo = base - m.alt;
      c.fillStyle = 'rgba(8,4,6,0.34)';
      c.fillRect(Math.round(cx - r), Math.round(base - 2), r * 2, 2);
      ret(c, cx - 4, topo + 3, 1, m.alt - 3, '#1d1a18');
      ret(c, cx + 3, topo + 3, 1, m.alt - 3, '#1d1a18');
      ret(c, cx - 4, base - 4, 8, 1, '#2a2622');
      caixa(c, cx - r, topo - 2, r * 2, 5, c0);
      ret(c, cx - r + 1, topo - 1, r * 2 - 2, 1, shade(c0, 0.3));
      return;
    }
    case 'chair':
    case 'armchair':
    case 'sofa': {
      sombraNoChao(c, m);
      const assento = Math.max(3, Math.round(m.alt * (k === 'chair' ? 0.9 : 0.8)));
      const topoA = base - assento;
      const cor = c0;
      // o encosto fica no lado oposto à frente do móvel
      const norte = it.rot === 4;
      const sul = it.rot === 0;
      const leste = it.rot === 6;
      const oeste = it.rot === 2;
      const encostoAlt = Math.round(P * 0.9);
      const tampoH = Math.round(m.gd * 0.55);
      // as pernas do móvel caminham até o assento
      if (k === 'chair') {
        ret(c, m.gx + 2, base - 3, 1, 3, shade(c1 ?? cor, -0.2));
        ret(c, m.gx + m.gw - 3, base - 3, 1, 3, shade(c1 ?? cor, -0.2));
      }
      const frenteAssento = () => {
        caixa(c, m.gx + 1, topoA, m.gw - 2, assento - 1, shade(cor, -0.12));
        caixa(c, m.gx + 1, topoA - tampoH + 1, m.gw - 2, tampoH, shade(cor, 0.1));
      };
      if (norte) {
        caixa(c, m.gx + 1, topoA - tampoH - encostoAlt + 6, m.gw - 2, encostoAlt, shade(cor, -0.08));
        frenteAssento();
      } else if (sul) {
        frenteAssento();
        caixa(c, m.gx + 1, base - assento - Math.round(encostoAlt * 0.35), m.gw - 2, Math.round(encostoAlt * 0.6), shade(cor, -0.05));
      } else {
        frenteAssento();
        const lx = oeste ? m.gx + 1 : m.gx + m.gw - 4;
        caixa(c, lx, topoA - encostoAlt + 4, 3, encostoAlt + assento - 3, shade(cor, -0.1));
      }
      if (k === 'sofa') ret(c, m.gx + 3, topoA - tampoH + 3, m.gw - 6, 1, shade(cor, 0.25));
      return;
    }
    case 'table': {
      sombraNoChao(c, m);
      const topo = base - m.alt;
      // pernas
      ret(c, m.gx + 2, topo + 2, 2, m.alt - 1, shade(c1, -0.1));
      ret(c, m.gx + m.gw - 4, topo + 2, 2, m.alt - 1, shade(c1, -0.1));
      const h = Math.max(6, Math.round(m.gd * 0.75));
      caixa(c, m.gx, topo - h + 3, m.gw, h, c0);
      ret(c, m.gx + 1, topo - h + 4, m.gw - 2, 1, shade(c0, 0.3));
      ret(c, m.gx, topo + 2, m.gw, 1, CONTORNO);
      ret(c, m.gx + 1, topo + 1, m.gw - 2, 2, shade(c0, -0.2));
      // as tábuas do tampo
      for (let i = 1; i < 3; i++) ret(c, m.gx + 1, topo - h + 3 + Math.round((i * h) / 3), m.gw - 2, 1, shade(c0, -0.18));
      return;
    }
    case 'table_big':
    case 'nightstand': {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c0, c2 ?? shade(c0, 0.3), 0.4);
      const h = g.baseY - g.topoFrente;
      ret(c, m.gx + 3, g.topoFrente + 3, m.gw - 6, h - 6, c1 ?? shade(c0, -0.3));
      for (let i = 0; i < Math.max(1, Math.floor((m.gw - 4) / 12)); i++) ret(c, m.gx + 6 + i * 12, g.topoFrente + Math.floor(h / 2) - 1, 2, 2, c2 ?? '#c9a86a');
      if (k === 'table_big' || k === 'nightstand') garrafas(c, m.gx + 2, g.topoFrente - g.tampoH + 4, m.gw - 4, seed, 3);
      return;
    }
    case 'crate':
    case 'barrel': {
      sombraNoChao(c, m);
      if (k === 'barrel') {
        const topo = base - m.alt;
        const rx = Math.round(m.gw * 0.4);
        caixa(c, cx - rx, topo, rx * 2, m.alt, c0);
        ret(c, cx - rx + 1, topo + Math.round(m.alt * 0.3), rx * 2 - 2, 1, c1);
        ret(c, cx - rx + 1, topo + Math.round(m.alt * 0.7), rx * 2 - 2, 1, c1);
        caixa(c, cx - rx, topo - 2, rx * 2, 4, shade(c0, 0.28));
        return;
      }
      const g = desenharCaixa(c, m, c0, shade(c0, 0.25), 0.55);
      for (let i = 1; i < 3; i++) ret(c, m.gx + 1, g.topoFrente + Math.round(((g.baseY - g.topoFrente) * i) / 3), m.gw - 2, 1, c1);
      ret(c, m.gx + 3, g.topoFrente + 2, 1, g.baseY - g.topoFrente - 4, c1);
      ret(c, m.gx + m.gw - 4, g.topoFrente + 2, 1, g.baseY - g.topoFrente - 4, c1);
      return;
    }
    case 'plant': {
      sombraNoChao(c, m);
      const vaso = 5;
      caixa(c, cx - 3, base - vaso, 7, vaso, c1);
      const folhas = [
        [0, -9, 4],
        [-4, -6, 3],
        [4, -6, 3],
        [-2, -12, 3],
        [3, -11, 3],
        [0, -5, 3],
      ];
      for (const [dx, dy, r] of folhas) {
        c.fillStyle = shade(c0, hash(seed, dx, dy) * 0.3 - 0.1);
        c.fillRect(Math.round(cx + dx - r), Math.round(base - vaso + dy - r), r * 2, r * 2);
      }
      ret(c, cx - 1, base - vaso - 14, 2, 2, shade(c0, 0.35));
      return;
    }
    case 'jukebox':
    case 'monitor':
    case 'floor_lamp': {
      if (k === 'floor_lamp') {
        ret(c, cx, base - m.alt, 1, m.alt, '#2a2a2a');
        caixa(c, cx - 3, base - m.alt - 3, 7, 5, c1);
        return;
      }
      if (k === 'monitor') {
        sombraNoChao(c, m);
        caixa(c, cx - 4, base - 9, 8, 6, c0);
        ret(c, cx - 3, base - 8, 6, 4, c1);
        ret(c, cx - 1, base - 3, 2, 2, c0);
        return;
      }
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c0, shade(c0, 0.2), 0.3);
      const h = g.baseY - g.topoFrente;
      // o fliperama: tela acesa piscando e os botões
      const tela = Math.floor(now / 520) % 2 === 0;
      ret(c, m.gx + 3, g.topoFrente + 3, m.gw - 6, Math.floor(h * 0.4), tela ? c2 : shade(c2, -0.35));
      ret(c, m.gx + 3, g.topoFrente + 4 + Math.floor(h * 0.4), m.gw - 6, 3, shade(c0, -0.35));
      ret(c, m.gx + 4, g.topoFrente + 5 + Math.floor(h * 0.4), 2, 1, '#e84a3a');
      ret(c, m.gx + 8, g.topoFrente + 5 + Math.floor(h * 0.4), 2, 1, '#f2d03a');
      return;
    }
    case 'pool_table': {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c1, c1, 0.78);
      // o feltro: o tampo todo, deixando a moldura de madeira em volta
      const topoT = g.topoFrente - g.tampoH + 1;
      ret(c, m.gx + 3, topoT + 3, m.gw - 6, g.tampoH - 5, c0);
      ret(c, m.gx + 3, topoT + 3, m.gw - 6, 1, shade(c0, 0.25));
      for (const [bx, by] of [[0.25, 0.3], [0.32, 0.45], [0.6, 0.6], [0.7, 0.35], [0.5, 0.2]] as const)
        ret(c, m.gx + 3 + (m.gw - 7) * bx, topoT + 4 + (g.tampoH - 8) * by, 2, 2, ['#f2f2f2', '#d83a2a', '#2a2a8a', '#f2d03a', '#222'][Math.floor(hash(seed, bx * 10, by * 10) * 5)]);
      // as caçapas
      for (const px of [0, 1] as const) {
        ret(c, m.gx + 1 + px * (m.gw - 5), topoT + 1, 3, 3, '#0a0605');
        ret(c, m.gx + 1 + px * (m.gw - 5), topoT + g.tampoH - 4, 3, 3, '#0a0605');
      }
      return;
    }
    case 'mug': {
      // objetinho em cima de algo: copo, caneca, cinzeiro
      if (it.z <= 0) sombraNoChao(c, m);
      const cx2 = m.gx + m.gw / 2;
      const b = base;
      if (def.id === 'ashtray') {
        ret(c, cx2 - 2, b - 2, 5, 2, c0);
        ret(c, cx2 - 1, b - 3, 3, 1, shade(c0, 0.3));
        return;
      }
      caixa(c, cx2 - 2, b - 5, 4, 5, def.id === 'beer_glass' ? '#e8c860' : c0);
      ret(c, cx2 - 1, b - 5, 2, 1, '#f6f2e0');
      return;
    }
    case 'candles': {
      ret(c, cx - 1, base - 5, 2, 5, '#e8dcc0');
      const f = Math.floor(now / 140) % 2;
      ret(c, cx - 1, base - 8 - f, 2, 3, f ? '#ffd24a' : '#ffb02a');
      return;
    }
    case 'papers': {
      ret(c, cx - 3, base - 3, 6, 3, c0);
      ret(c, cx - 2, base - 3, 4, 1, shade(c0, 0.3));
      return;
    }
    default: {
      sombraNoChao(c, m);
      const g = desenharCaixa(c, m, c0 ?? '#7a5a3a', shade(c0 ?? '#7a5a3a', 0.25));
      void g;
    }
  }
}

/** Itens rasteiros: tapete, sujeira, poça, cabos (vão no chão, antes dos móveis). */
function desenharRasteiro(c: Ctx, it: FloorItem, def: FurniDef, m: Medida, seed: number) {
  const [c0, c1] = def.colors;
  if (def.kind === 'rug') {
    ret(c, m.gx + 1, m.gy + 1, m.gw - 2, m.gd - 2, c0);
    ret(c, m.gx + 3, m.gy + 3, m.gw - 6, m.gd - 6, shade(c0, -0.12));
    ret(c, m.gx + 2, m.gy + 2, m.gw - 4, 1, c1);
    ret(c, m.gx + 2, m.gy + m.gd - 3, m.gw - 4, 1, c1);
    ret(c, m.gx + 2, m.gy + 2, 1, m.gd - 4, c1);
    ret(c, m.gx + m.gw - 3, m.gy + 2, 1, m.gd - 4, c1);
    for (let y = 6; y < m.gd - 6; y += 4) for (let x = 6; x < m.gw - 6; x += 4) if (hash(seed, x, y) > 0.55) ret(c, m.gx + x, m.gy + y, 1, 1, c1);
    return;
  }
  const opaco = def.id === 'puddle' ? 0.55 : 0.5;
  c.fillStyle = `rgba(${hex(c0).join(',')},${opaco})`;
  for (let i = 0; i < 6; i++) c.fillRect(Math.round(m.gx + hash(seed, i) * (m.gw - 3)), Math.round(m.gy + hash(seed, i + 7) * (m.gd - 2)), 2 + Math.floor(hash(seed, i + 3) * 3), 2);
  if (def.id === 'cables_floor') {
    c.strokeStyle = '#141414';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(m.gx, m.gy + m.gd / 2);
    c.bezierCurveTo(m.gx + m.gw * 0.3, m.gy, m.gx + m.gw * 0.6, m.gy + m.gd, m.gx + m.gw, m.gy + m.gd / 2);
    c.stroke();
  }
}

// ------------------------------------------------------------------ paredes e luzes
function paredeDoFundo(c: Ctx, x: number, y: number, w: number) {
  // y = o chão da parede (a linha onde ela encontra o piso); ela sobe PAREDE casas
  const alt = Math.round(PAREDE * P);
  const topo = y - alt;
  ret(c, x, topo, w, alt, '#5a4030');
  // reboco gasto na metade de cima
  for (let i = 0; i < w; i += 2) if (hash(i, y) > 0.82) ret(c, x + i, topo + 4 + Math.floor(hash(i, 3) * (alt * 0.4)), 2, 1, '#6a4e3a');
  // lambri na metade de baixo
  const lam = Math.round(alt * 0.45);
  ret(c, x, y - lam, w, lam, '#3a2418');
  for (let i = 0; i < w; i += 4) ret(c, x + i, y - lam, 1, lam, '#2c1a10');
  ret(c, x, y - lam - 1, w, 1, '#c9a050');
  ret(c, x, y - lam, w, 1, '#8a6a30');
  // rodapé e sombra no piso
  ret(c, x, y - 2, w, 2, '#241610');
  c.fillStyle = 'rgba(8,4,6,0.28)';
  c.fillRect(x, y, w, 3);
  // o topo da parede: uma faixa clara (a espessura vista de cima)
  ret(c, x, topo - 4, w, 4, '#2a1a12');
  ret(c, x, topo - 4, w, 1, '#6a4e3a');
  return topo;
}

function itemDeParede(c: Ctx, w: WallItem, ox: number, oy: number, now: number) {
  if (w.wall !== 'r' || w.plane !== 0) return;
  const x = ox + w.pos * P;
  const chaoY = oy;
  const yv = chaoY - Math.round((w.z / U_POR_CASA) * P * ACHATA);
  switch (w.defId) {
    case 'neon_bar': {
      const on = Math.floor(now / 700) % 11 !== 0;
      caixa(c, x - 16, yv - 8, 32, 11, '#1a0a14');
      ret(c, x - 14, yv - 6, 28, 7, on ? '#ff3a7a' : '#6a2040');
      ret(c, x - 12, yv - 4, 24, 3, on ? '#ffd0e0' : '#8a4a60');
      return;
    }
    case 'clock': {
      caixa(c, x - 6, yv - 12, 12, 12, '#2a1a12');
      ret(c, x - 4, yv - 10, 8, 8, '#e8dcc0');
      ret(c, x, yv - 9, 1, 5, '#222');
      ret(c, x, yv - 6, 3, 1, '#222');
      return;
    }
    case 'dartboard': {
      caixa(c, x - 6, yv - 12, 12, 12, '#1a1010');
      ret(c, x - 4, yv - 10, 8, 8, '#c93a2a');
      ret(c, x - 2, yv - 8, 4, 4, '#e8dcc0');
      ret(c, x - 1, yv - 7, 2, 2, '#2a8a4a');
      return;
    }
    case 'tv_wall': {
      caixa(c, x - 10, yv - 12, 20, 13, '#101010');
      ret(c, x - 8, yv - 10, 16, 9, Math.floor(now / 900) % 2 ? '#2a4a6a' : '#3a5a7a');
      return;
    }
    case 'fan_wall': {
      caixa(c, x - 6, yv - 12, 12, 12, '#3a3a3a');
      ret(c, x - 1, yv - 7, 2, 2, '#aaa');
      return;
    }
    case 'painting': {
      caixa(c, x - 8, yv - 12, 16, 12, '#4a3020');
      ret(c, x - 6, yv - 10, 12, 8, '#7a5a3a');
      ret(c, x - 6, yv - 5, 12, 3, '#3a5a3a');
      return;
    }
    default: {
      const d = getWallFurni(w.defId);
      caixa(c, x - 5, yv - 8, 10, 8, d?.colors?.[0] ?? '#4a3020');
    }
  }
}

interface Luz {
  x: number;
  y: number;
  r: number;
  cor: string;
  forca: number;
  oscila?: boolean;
}

// ------------------------------------------------------------------ o quadro todo
let tela: HTMLCanvasElement | null = null;
let luzTela: HTMLCanvasElement | null = null;

/**
 * Desenha a cena no `ctx` do tabuleiro. Devolve o enquadre da grade (a casa x, y fica em e.x + x·e.casa) e os
 * retângulos de clique dos móveis, na ordem em que foram desenhados (o último é o que está por cima).
 */
export function desenharStardew(ctx: Ctx, E: EntradaStardew): { e: Enquadre; acertos: AcertoStardew[] } {
  const { map, quadro, zoom } = E;
  const estilo = E.piso ?? 'madeira';
  const mw = map.width;
  const mh = map.height;
  const lado = Math.round(LADO * P);
  const frente = Math.round(FRENTE * P);
  const topo = Math.round(PAREDE * P) + 4;
  const W = mw * P + lado * 2;
  const H = topo + mh * P + frente;
  const ox = lado;
  const oy = topo;

  tela ??= document.createElement('canvas');
  if (tela.width !== W || tela.height !== H) {
    tela.width = W;
    tela.height = H;
  }
  const c = tela.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, W, H);
  ret(c, 0, 0, W, H, '#0c0808');

  const valido = (x: number, y: number) => map.floorHeight(x, y) !== null;
  // ---- chão
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (valido(x, y)) pisoDaCasa(c, ox + x * P, oy + y * P, x, y, estilo);
  // ---- paredes: a do fundo (face) onde a casa de cima é vazia; laterais finas; a da frente só um beiral
  for (let x = 0; x < mw; x++) for (let y = 0; y < mh; y++) if (valido(x, y) && !valido(x, y - 1)) paredeDoFundo(c, ox + x * P, oy + y * P, P);
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      if (!valido(x, y)) continue;
      if (!valido(x - 1, y)) {
        ret(c, ox + x * P - lado, oy + y * P - 2, lado, P + 2, '#2a1a12');
        ret(c, ox + x * P - lado, oy + y * P - 2, 2, P + 2, '#6a4e3a');
        ret(c, ox + x * P - 1, oy + y * P, 1, P, '#140c0a');
        c.fillStyle = 'rgba(8,4,6,0.25)';
        c.fillRect(ox + x * P, oy + y * P, 3, P);
      }
      if (!valido(x + 1, y)) {
        ret(c, ox + (x + 1) * P, oy + y * P - 2, lado, P + 2, '#2a1a12');
        ret(c, ox + (x + 1) * P + lado - 2, oy + y * P - 2, 2, P + 2, '#6a4e3a');
        ret(c, ox + (x + 1) * P, oy + y * P, 1, P, '#140c0a');
        c.fillStyle = 'rgba(8,4,6,0.25)';
        c.fillRect(ox + (x + 1) * P - 3, oy + y * P, 3, P);
      }
      if (!valido(x, y + 1) && !map.isDoor(x, y)) {
        ret(c, ox + x * P - (valido(x - 1, y + 1) ? 0 : lado), oy + (y + 1) * P, P + (valido(x - 1, y + 1) ? 0 : lado) + (valido(x + 1, y + 1) ? 0 : lado), frente, '#2a1a12');
        ret(c, ox + x * P, oy + (y + 1) * P, P, 2, '#6a4e3a');
      }
      if (map.isDoor(x, y) && !valido(x, y + 1)) {
        // a porta: um tapete de entrada e a soleira
        ret(c, ox + x * P + 2, oy + (y + 1) * P - 5, P - 4, 5, '#3a2418');
        ret(c, ox + x * P + 2, oy + (y + 1) * P - 5, P - 4, 1, '#c9a050');
        ret(c, ox + x * P, oy + (y + 1) * P, P, frente, '#c9a050');
      }
    }
  // cantos: o beiral do fundo cobrindo as laterais
  ret(c, 0, topo - 4, lado, 4, '#2a1a12');
  ret(c, ox + mw * P, topo - 4, lado, 4, '#2a1a12');
  // ---- itens na parede do fundo
  const luzes: Luz[] = [];
  for (const w of E.paredes) itemDeParede(c, w, ox, oy, E.now);
  for (const w of E.paredes) {
    if (w.defId === 'neon_bar') luzes.push({ x: ox + w.pos * P, y: oy + 6, r: 4.2 * P, cor: '#ff3a7a', forca: 0.5 });
    if (w.defId === 'sconce' && w.wall === 'l') luzes.push({ x: ox + 2, y: oy + w.pos * P, r: 3.2 * P, cor: '#ffb04a', forca: 0.55, oscila: true });
    if (w.defId === 'sconce' && w.wall === 'r') luzes.push({ x: ox + w.pos * P, y: oy - 14, r: 3.2 * P, cor: '#ffb04a', forca: 0.55, oscila: true });
  }

  // ---- rasteiros (tapete, sujeira, poça)
  const itens = E.itens.filter((it) => (E.mostrarItem ? E.mostrarItem(it) : true));
  const visiveis: { it: FloorItem; def: FurniDef; sx: number; sy: number }[] = [];
  for (const it of itens) {
    const def = getFurni(it.defId);
    if (!def) continue;
    if (/lamp|fluorescent|luz/.test(def.kind) && def.kind !== 'floor_lamp') {
      // lâmpada de teto: só a luz dela (não existe de cima, a câmera olha por baixo do forro)
      luzes.push({ x: ox + (it.x + 0.5) * P, y: oy + (it.y + 0.5) * P, r: 4.4 * P, cor: '#ffc46a', forca: 0.62, oscila: true });
      continue;
    }
    if (def.hidden && it.state !== 1) continue;
    const fp = footprint(def, it.rot);
    if (def.flat || def.walkable || def.kind === 'stairs_down') {
      if (def.kind === 'stairs_down') {
        // a escada escondida: um buraco escuro no chão, a geladeira por cima
        const m = medida(it, def, ox, oy, fp.sx, fp.sy);
        ret(c, m.gx + 1, m.gy + 1, m.gw - 2, m.gd - 2, '#050303');
        for (let i = 0; i < 4; i++) ret(c, m.gx + 2, m.gy + 3 + i * 3, m.gw - 4, 1, '#1a1210');
        continue;
      }
      desenharRasteiro(c, it, def, medida(it, def, ox, oy, fp.sx, fp.sy), it.id);
      continue;
    }
    visiveis.push({ it, def, sx: fp.sx, sy: fp.sy });
  }
  // luzes de móveis acesos
  for (const v of visiveis) {
    const d = v.def;
    if (d.kind === 'floor_lamp') luzes.push({ x: ox + (v.it.x + 0.5) * P, y: oy + (v.it.y + 0.3) * P, r: 3.4 * P, cor: '#ffd08a', forca: 0.6 });
    if (d.kind === 'jukebox') luzes.push({ x: ox + (v.it.x + 0.5) * P, y: oy + (v.it.y + 0.9) * P, r: 3 * P, cor: '#6a5aff', forca: 0.4 });
    if (d.kind === 'beer_fridge') luzes.push({ x: ox + (v.it.x + 0.5) * P, y: oy + (v.it.y + 1) * P, r: 2.2 * P, cor: d.id === 'fridge_drinks' ? '#bfe6ff' : '#ffe9a0', forca: 0.28 });
  }

  // ---- móveis na ordem: de trás para a frente (pela aresta da frente), o empilhado depois do que está embaixo
  const ordem = [...visiveis].sort((a, b) => a.it.y + a.sy - (b.it.y + b.sy) || a.it.z - b.it.z || a.it.x - b.it.x || a.it.id - b.it.id);
  const caixas: { id: number; chao: boolean; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const v of ordem) {
    const { it, def } = v;
    // a geladeira da passagem escorrega para a esquerda quando aberta
    const deslocada = def.id === 'beer_fridge' && it.state === 1 ? { ...it, x: it.x - 1 } : it;
    const m = medida(deslocada, def, ox, oy, v.sx, v.sy);
    desenharMovel(c, deslocada, def, m, E.now, it.id);
    const tampoH = Math.round(m.gd * TAMPO);
    caixas.push({ id: it.id, chao: !!def.flat, x0: m.gx, y0: m.gy + m.gd - m.z0 - m.alt - tampoH, x1: m.gx + m.gw, y1: m.gy + m.gd - m.z0 });
  }

  // ------------------------------------------------------------------ para o canvas, ampliado
  const casa0 = Math.max(0.5, Math.min((quadro.w * 0.96) / W, (quadro.h * 0.96) / H));
  // sala grande no quadro: ampliação inteira (pixel redondo); pouco espaço: a fração mesma, suavizada, para não ficar torta
  const inteira = casa0 >= 2;
  const s0 = inteira ? Math.floor(casa0) : casa0;
  const sx0 = quadro.x + (quadro.w - W * s0) / 2;
  const sy0 = quadro.y + (quadro.h - H * s0) / 2;
  const s = s0 * zoom.k;
  const bx = zoom.dx + sx0 * zoom.k;
  const by = zoom.dy + sy0 * zoom.k;
  ctx.save();
  ctx.imageSmoothingEnabled = !inteira && s * zoom.k < 2;
  ctx.drawImage(tela, bx, by, W * s, H * s);

  // ---- a luz: escurece a sala e abre uma clareira quente em volta de cada lâmpada
  const lw = Math.max(1, Math.ceil(W * s));
  const lh = Math.max(1, Math.ceil(H * s));
  luzTela ??= document.createElement('canvas');
  if (luzTela.width !== lw || luzTela.height !== lh) {
    luzTela.width = lw;
    luzTela.height = lh;
  }
  const lc = luzTela.getContext('2d')!;
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, lw, lh);
  const [ar, ag, ab] = hex(E.ambient ?? '#c0782a');
  const escuro = Math.min(0.7, 0.14 + E.darkness * 0.62);
  lc.fillStyle = `rgba(${Math.round(ar * 0.1 + 6)},${Math.round(ag * 0.07 + 5)},${Math.round(ab * 0.14 + 14)},${escuro})`;
  lc.fillRect(0, 0, lw, lh);
  lc.globalCompositeOperation = 'destination-out';
  for (const L of luzes) {
    const pulso = L.oscila ? 1 + Math.sin(E.now / 310 + L.x * 0.7) * 0.04 + (hash(Math.floor(E.now / 90), Math.round(L.x)) - 0.5) * 0.05 : 1;
    const gx = L.x * s;
    const gy = L.y * s;
    const gr = L.r * s * pulso;
    const g = lc.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, `rgba(0,0,0,${L.forca * 1.25})`);
    g.addColorStop(0.55, `rgba(0,0,0,${L.forca * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  ctx.drawImage(luzTela, bx, by);
  // o brilho quente das lâmpadas por cima (soma)
  ctx.globalCompositeOperation = 'lighter';
  for (const L of luzes) {
    const gx = bx + L.x * s;
    const gy = by + L.y * s;
    const gr = L.r * s * 0.8;
    const [r, g2, b] = hex(L.cor);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, `rgba(${r},${g2},${b},${L.forca * 0.2})`);
    g.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // ---- o enquadre da grade e os acertos na tela
  const e: Enquadre = { x: bx + ox * s, y: by + oy * s, casa: P * s };
  const acertos: AcertoStardew[] = caixas.map((q) => ({ id: q.id, chao: q.chao, x0: bx + q.x0 * s, y0: by + q.y0 * s, x1: bx + q.x1 * s, y1: by + q.y1 * s }));

  // ---- a casa do mouse e o móvel escolhido
  if (E.casaMouse) {
    ctx.strokeStyle = 'rgba(255,236,170,0.8)';
    ctx.lineWidth = Math.max(1, E.dpr);
    ctx.strokeRect(e.x + E.casaMouse.x * e.casa + 0.5, e.y + E.casaMouse.y * e.casa + 0.5, e.casa - 1, e.casa - 1);
  }
  if (E.escolhido !== null) {
    const a = acertos.find((q) => q.id === E.escolhido);
    if (a) {
      ctx.setLineDash([6 * E.dpr, 4 * E.dpr]);
      ctx.lineDashOffset = -E.now / 60;
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 2 * E.dpr;
      ctx.strokeRect(a.x0 - 2, a.y0 - 2, a.x1 - a.x0 + 4, a.y1 - a.y0 + 4);
      ctx.setLineDash([]);
    }
  }

  // ---- as peças: marcadores de pé (os bonecos dessa visão vêm depois)
  const ps = [...E.pecas].sort((a, b) => a.y - b.y);
  for (const p of ps) {
    const px = e.x + (p.x + 0.5) * e.casa;
    const py = e.y + (p.y + 0.62) * e.casa;
    const r = e.casa * 0.34;
    ctx.fillStyle = 'rgba(8,4,6,0.45)';
    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.55, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const cy = py - r * 0.9;
    ctx.fillStyle = p.caido ? '#555' : '#1b1412';
    ctx.beginPath();
    ctx.arc(px, cy, r + 2 * E.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (p.retrato) ctx.drawImage(p.retrato, px - r, cy - r, r * 2, r * 2);
    else {
      ctx.fillStyle = p.cor;
      ctx.fillRect(px - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = p.escolhida ? '#ffe9a0' : p.cor;
    ctx.lineWidth = (p.escolhida ? 3 : 2) * E.dpr;
    ctx.beginPath();
    ctx.arc(px, cy, r + E.dpr, 0, Math.PI * 2);
    ctx.stroke();
    if (p.vez) {
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = E.dpr;
      ctx.beginPath();
      ctx.arc(px, cy, r + 5 * E.dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `${Math.round(10 * E.dpr)}px "Special Elite", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4e8c8';
    ctx.strokeStyle = '#140c0a';
    ctx.lineWidth = 3 * E.dpr;
    ctx.strokeText(p.nome, px, cy + r + 13 * E.dpr);
    ctx.fillText(p.nome, px, cy + r + 13 * E.dpr);
  }
  ctx.restore();
  return { e, acertos };
}
