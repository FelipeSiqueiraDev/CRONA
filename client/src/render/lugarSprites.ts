import type { IconeLugar } from '@crona/shared';
import { arteCarregada } from '../ui/icons';

/**
 * Os ícones do mapa-múndi (07/10), desenhados em código no estilo das referências do Felipe: uma ilhazinha isométrica
 * com uma construção em cima, formas simples e cores chapadas. Cada ícone é pintado uma vez numa tela pequena (72 × 64
 * px) e o contorno é endurecido (cada pixel inteiro ou nada), para ficar com cara de pixel art quando a tela cresce.
 */

export const SPRITE_W = 72;
export const SPRITE_H = 64;
/** o centro da ilha dentro do ícone (o ponto do lugar no mapa) */
export const SPRITE_CENTRO: [number, number] = [36, 42];

type Pt = [number, number];
const CONTORNO = '#2a1d2e';

/** O mundo isométrico em unidades: x e y andam (2, 1) e (-2, 1) pixels; z sobe em pixels. */
class Iso {
  constructor(
    private ox: number,
    private oy: number,
  ) {}
  p(x: number, y: number, z = 0): Pt {
    return [this.ox + (x - y) * 2, this.oy + (x + y) - z];
  }
}

function poli(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string, contorno = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (contorno) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = CONTORNO;
    ctx.stroke();
  }
}

interface Caixa {
  /** onde a caixa começa e o tamanho dela, em unidades do chão, e a altura em pixels */
  x: number;
  y: number;
  sx: number;
  sy: number;
  h: number;
  /** z de onde sobe (por cima de outra coisa) */
  z?: number;
  topo: string;
  esq: string;
  dir: string;
}

/** Uma caixa: a face da esquerda (a que olha para +y), a da direita (para +x) e o topo. */
function caixa(ctx: CanvasRenderingContext2D, iso: Iso, c: Caixa) {
  const z0 = c.z ?? 0;
  const z1 = z0 + c.h;
  poli(ctx, [iso.p(c.x, c.y + c.sy, z0), iso.p(c.x + c.sx, c.y + c.sy, z0), iso.p(c.x + c.sx, c.y + c.sy, z1), iso.p(c.x, c.y + c.sy, z1)], c.esq);
  poli(ctx, [iso.p(c.x + c.sx, c.y, z0), iso.p(c.x + c.sx, c.y + c.sy, z0), iso.p(c.x + c.sx, c.y + c.sy, z1), iso.p(c.x + c.sx, c.y, z1)], c.dir);
  poli(ctx, [iso.p(c.x, c.y, z1), iso.p(c.x + c.sx, c.y, z1), iso.p(c.x + c.sx, c.y + c.sy, z1), iso.p(c.x, c.y + c.sy, z1)], c.topo);
}

/** Telhado de duas águas ao longo de x: a água da frente (para +y) e a empena do lado de +x. */
function telhado(ctx: CanvasRenderingContext2D, iso: Iso, x: number, y: number, sx: number, sy: number, z: number, alto: number, frente: string, lado: string, beiral = 0.8) {
  const y0 = y - beiral;
  const y1 = y + sy + beiral;
  const ym = y + sy / 2;
  poli(ctx, [iso.p(x + sx, y0, z), iso.p(x + sx, y1, z), iso.p(x + sx, ym, z + alto)], lado);
  poli(ctx, [iso.p(x - 0.5, y1, z), iso.p(x + sx + 0.5, y1, z), iso.p(x + sx + 0.5, ym, z + alto), iso.p(x - 0.5, ym, z + alto)], frente);
}

/** Um retângulo na face da esquerda (y fixo) ou da direita (x fixo): janela, porta, letreiro. */
function naFace(ctx: CanvasRenderingContext2D, iso: Iso, face: 'esq' | 'dir', fixo: number, a0: number, a1: number, z0: number, z1: number, cor: string, contorno = true) {
  const pts: Pt[] =
    face === 'esq' ? [iso.p(a0, fixo, z0), iso.p(a1, fixo, z0), iso.p(a1, fixo, z1), iso.p(a0, fixo, z1)] : [iso.p(fixo, a0, z0), iso.p(fixo, a1, z0), iso.p(fixo, a1, z1), iso.p(fixo, a0, z1)];
  poli(ctx, pts, cor, contorno);
}

/** A ilha: o chão de grama, a terra embaixo e umas pedrinhas. */
function ilha(ctx: CanvasRenderingContext2D, iso: Iso, S: number, grama: string, claro: string) {
  const E = 7;
  const costa = '#8a6a55';
  const costaEscura = '#6e5444';
  poli(ctx, [iso.p(0, S, 0), iso.p(S, S, 0), iso.p(S, S, -E), iso.p(0, S, -E)], costa);
  poli(ctx, [iso.p(S, 0, 0), iso.p(S, S, 0), iso.p(S, S, -E), iso.p(S, 0, -E)], costaEscura);
  poli(ctx, [iso.p(0, 0, 0), iso.p(S, 0, 0), iso.p(S, S, 0), iso.p(0, S, 0)], grama);
  // a beira de grama mais clara e as pedrinhas na terra
  ctx.fillStyle = claro;
  for (let i = 0; i < 9; i++) {
    const [px, py] = iso.p(1 + ((i * 5) % (S - 2)), 1 + ((i * 7) % (S - 2)), 0);
    ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
  }
  ctx.fillStyle = '#a58a74';
  for (let i = 0; i < 6; i++) {
    const [px, py] = iso.p((i * 3) % S, S, -2 - (i % 3) * 2);
    ctx.fillRect(Math.round(px) + 1, Math.round(py), 2, 1);
  }
}

function arvore(ctx: CanvasRenderingContext2D, iso: Iso, x: number, y: number, tam = 1) {
  const [bx, by] = iso.p(x, y, 0);
  ctx.fillStyle = '#6a4a3a';
  ctx.fillRect(bx - 1, by - 5 * tam, 2, 5 * tam);
  ctx.fillStyle = '#3f9a52';
  ctx.beginPath();
  ctx.arc(bx, by - 8 * tam, 4.5 * tam, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5fbd6a';
  ctx.beginPath();
  ctx.arc(bx - 1.2 * tam, by - 9.2 * tam, 2.4 * tam, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- as construções

/** A Base da Ordem: um prédio de tijolo de dois andares, com toldo listrado e uns aparelhos no telhado. */
function predio(ctx: CanvasRenderingContext2D, iso: Iso) {
  const c: Caixa = { x: 3, y: 4, sx: 8, sy: 7, h: 22, topo: '#c9c3b8', esq: '#b4523b', dir: '#923f2f' };
  caixa(ctx, iso, c);
  // o parapeito e a casinha da escada no telhado
  caixa(ctx, iso, { x: 4, y: 5, sx: 3, sy: 3, h: 5, z: 22, topo: '#8d8a96', esq: '#6d6a78', dir: '#58556a' });
  caixa(ctx, iso, { x: 8, y: 6, sx: 2, sy: 1.5, h: 2, z: 22, topo: '#d6d6dc', esq: '#aeb0ba', dir: '#8e909c' });
  // as janelas dos dois andares, na face da esquerda e na da direita
  for (const x of [4.2, 7]) naFace(ctx, iso, 'esq', 11, x, x + 1.8, 14, 19, '#3b6e86');
  for (const y of [5.2, 8]) naFace(ctx, iso, 'dir', 11, y, y + 1.8, 14, 19, '#3b6e86');
  for (const y of [5.2, 8]) naFace(ctx, iso, 'dir', 11, y, y + 1.8, 5, 10, '#3b6e86');
  // o toldo verde e branco e a porta
  for (let i = 0; i < 6; i++) naFace(ctx, iso, 'esq', 11.01, 3.6 + i * 1, 4.6 + i * 1, 10, 12.5, i % 2 ? '#f1ebdc' : '#3f9a60', false);
  naFace(ctx, iso, 'esq', 11, 3.6, 9.6, 10, 12.5, 'rgba(0,0,0,0)');
  naFace(ctx, iso, 'esq', 11, 5.4, 7.2, 0, 8, '#4a3a45');
  naFace(ctx, iso, 'esq', 11, 7.8, 9.4, 3, 8, '#3b6e86');
  // o letreiro
  naFace(ctx, iso, 'esq', 11, 4.2, 9, 20, 22, '#e9b94a', false);
}

/** A Fazenda: o celeiro vermelho com a porta em X, o silo e uns fardos de feno. */
function fazenda(ctx: CanvasRenderingContext2D, iso: Iso) {
  caixa(ctx, iso, { x: 2, y: 4, sx: 9, sy: 7, h: 10, topo: '#c85a48', esq: '#c0392b', dir: '#9a2d22' });
  telhado(ctx, iso, 2, 4, 9, 7, 10, 7, '#8a4f3c', '#a8402f');
  // a porta grande em X
  naFace(ctx, iso, 'esq', 11, 4.3, 8.7, 0, 8, '#f1ebdc');
  naFace(ctx, iso, 'esq', 11, 4.9, 8.1, 0.8, 7.2, '#c0392b', false);
  const [a0x, a0y] = iso.p(4.9, 11, 0.8);
  const [a1x, a1y] = iso.p(8.1, 11, 7.2);
  const [b0x, b0y] = iso.p(8.1, 11, 0.8);
  const [b1x, b1y] = iso.p(4.9, 11, 7.2);
  ctx.strokeStyle = '#f1ebdc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a0x, a0y);
  ctx.lineTo(a1x, a1y);
  ctx.moveTo(b0x, b0y);
  ctx.lineTo(b1x, b1y);
  ctx.stroke();
  // a janelinha do sótão na empena
  naFace(ctx, iso, 'dir', 11, 6.6, 8.4, 11, 14, '#f1ebdc');
  // o silo
  const [sx, sy] = iso.p(13, 2.5, 0);
  ctx.fillStyle = '#b9c3cc';
  ctx.fillRect(sx - 4, sy - 22, 8, 22);
  ctx.fillStyle = '#8f9ba6';
  ctx.fillRect(sx + 1, sy - 22, 3, 22);
  ctx.fillStyle = '#d0d8de';
  ctx.beginPath();
  ctx.arc(sx, sy - 22, 4, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = CONTORNO;
  ctx.strokeRect(sx - 3.5, sy - 22.5, 8, 22);
  // os fardos de feno
  caixa(ctx, iso, { x: 0.5, y: 11, sx: 2, sy: 1.6, h: 2, topo: '#f0d36a', esq: '#d9b848', dir: '#bd9c34' });
  caixa(ctx, iso, { x: 3, y: 12.4, sx: 2, sy: 1.6, h: 2, topo: '#f0d36a', esq: '#d9b848', dir: '#bd9c34' });
  arvore(ctx, iso, 12.5, 11.5, 0.9);
}

/** O casarão (o Orfanato e afins): pedra, telhado de ardósia, uma torre e janelas acesas. */
function casarao(ctx: CanvasRenderingContext2D, iso: Iso) {
  caixa(ctx, iso, { x: 3, y: 5, sx: 9, sy: 7, h: 14, topo: '#9b9faa', esq: '#9aa0ae', dir: '#7d8392' });
  telhado(ctx, iso, 3, 5, 9, 7, 14, 7, '#4f5675', '#3f4561');
  caixa(ctx, iso, { x: 1.5, y: 3.5, sx: 3.5, sy: 3.5, h: 25, topo: '#8e93a0', esq: '#9aa0ae', dir: '#7d8392' });
  // o chapéu pontudo da torre
  const [t0x, t0y] = iso.p(1.5, 7, 25);
  const [t1x, t1y] = iso.p(5, 7, 25);
  const [t2x, t2y] = iso.p(5, 3.5, 25);
  const [tpx, tpy] = iso.p(3.25, 5.25, 36);
  poli(ctx, [[t0x, t0y], [t1x, t1y], [tpx, tpy]], '#4f5675');
  poli(ctx, [[t1x, t1y], [t2x, t2y], [tpx, tpy]], '#3f4561');
  for (const x of [4.4, 7.4, 9.6]) naFace(ctx, iso, 'esq', 12, x, x + 1.3, 6, 11, '#f3c75a');
  for (const y of [6.4, 9.2]) naFace(ctx, iso, 'dir', 12, y, y + 1.3, 6, 11, '#f3c75a');
  naFace(ctx, iso, 'esq', 12, 6.7, 8.2, 0, 5, '#5a4036');
  naFace(ctx, iso, 'esq', 7, 2.4, 3.6, 12, 18, '#f3c75a');
  arvore(ctx, iso, 13, 12.5, 1);
}

/** A casa simples. */
function casa(ctx: CanvasRenderingContext2D, iso: Iso) {
  caixa(ctx, iso, { x: 4, y: 5, sx: 7, sy: 6, h: 9, topo: '#efe3c8', esq: '#f0e4c9', dir: '#d8c9a8' });
  telhado(ctx, iso, 4, 5, 7, 6, 9, 6, '#c9654a', '#a9503a');
  naFace(ctx, iso, 'esq', 11, 5.2, 6.6, 2, 7, '#5a4036');
  naFace(ctx, iso, 'esq', 11, 8, 9.6, 3, 7, '#3b6e86');
  naFace(ctx, iso, 'dir', 11, 6.5, 8.5, 3, 7, '#3b6e86');
  arvore(ctx, iso, 12.5, 12, 0.9);
}

const DESENHOS: Record<IconeLugar, (ctx: CanvasRenderingContext2D, iso: Iso) => void> = { predio, fazenda, casarao, casa };

/** Cada pixel inteiro ou nada: o contorno antialiased da tela pequena vira pixel de verdade. */
function endurecer(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
  ctx.putImageData(d, 0, 0);
}

const cache = new Map<IconeLugar, HTMLCanvasElement>();

/**
 * A ilha pintada do Códex (09/10, `arte/mapa/lugar-<lugar>.png`, em escala 4, 72 × 64 na escala 1): uma por LUGAR, pelo
 * nome; o meio da grama de cada uma (do LEIA-ME) vai para o SPRITE_CENTRO. Lugar sem ilha própria e do tipo casa usa a
 * casinha genérica. Enquanto carrega (ou se não existe), o desenho em código.
 */
const PASTA_MAPA = '/arte/mapa/';
const CENTRO_ARTE: Record<string, number> = { 'sede-da-ordem': 43, 'fazenda-olhos-de-aguia': 40, 'orfanato-filhos-do-dragao': 41, 'tiradentes': 43, 'igarape': 43, 'santo-berco': 43, 'generico-casa': 41 };
/**
 * O meio da grama de cada ilha HD (288 × 256), em pixels da escala 1 (÷ 4): os centros que o Códex mediu em
 * mapa-hd.zip (14/10). O Igarapé e o Santo Berço só existem em HD.
 */
const CENTRO_HD: Record<string, number> = { 'sede-da-ordem': 43, 'fazenda-olhos-de-aguia': 40, 'orfanato-filhos-do-dragao': 41, 'tiradentes': 43, 'igarape': 42, 'santo-berco': 41, 'generico-casa': 41 };
const artes = new Map<string, HTMLCanvasElement | null>();
let existentes: Set<string> | null = null;
void arteCarregada.then((s) => (existentes = s));
const slug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
/** Uma imagem do mapa em escala 4, reduzida para a escala 1 (e, na ilha, com o meio da grama no SPRITE_CENTRO). */
export function arteDoMapa(nome: string, centroY?: number): HTMLCanvasElement | null {
  if (artes.has(nome)) return artes.get(nome)!;
  if (!existentes) return null;
  artes.set(nome, null);
  const url = `${PASTA_MAPA}${nome}.png`;
  if (!existentes.has(url)) return null;
  const img = new Image();
  img.onload = () => {
    const w = Math.round(img.naturalWidth / 4);
    const hh = Math.round(img.naturalHeight / 4);
    const c = document.createElement('canvas');
    const ilha = centroY !== undefined;
    c.width = ilha ? SPRITE_W : w;
    c.height = ilha ? SPRITE_H : hh;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, ilha ? SPRITE_CENTRO[1] - centroY : 0, w, hh);
    artes.set(nome, c);
  };
  img.src = url;
  return null;
}
/**
 * A ilha em alta definição (10/10, pedida ao Códex: `lugar-<lugar>-hd.png`, 288 × 256 com detalhe de verdade, e não
 * blocos de 4): a imagem inteira, desenhada no lugar da de escala 1 com todo o detalhe. `dy` = o deslocamento para o
 * meio da grama cair no SPRITE_CENTRO (o mesmo centro da ilha de escala 1, em pixels dela).
 */
const hds = new Map<string, HTMLImageElement | null>();
export function ilhaHD(nome?: string, icone?: IconeLugar): { img: HTMLImageElement; dy: number } | null {
  let s = nome ? slug(nome) : '';
  // lugar sem ilha própria: a casinha genérica (só para o ícone "casa", como na de escala 1)
  if (!(s in CENTRO_HD) && icone === 'casa') s = 'generico-casa';
  if (!s || !(s in CENTRO_HD) || !existentes) return null;
  const url = `${PASTA_MAPA}lugar-${s}-hd.png`;
  if (!hds.has(s)) {
    hds.set(s, null);
    if (existentes.has(url)) {
      const img = new Image();
      img.onload = () => hds.set(s, img);
      img.src = url;
    }
  }
  const img = hds.get(s);
  return img ? { img, dy: SPRITE_CENTRO[1] - CENTRO_HD[s] } : null;
}

function ilhaPintada(icone: IconeLugar, nome?: string): HTMLCanvasElement | null {
  const s = nome ? slug(nome) : '';
  if (s && s in CENTRO_ARTE) return arteDoMapa(`lugar-${s}`, CENTRO_ARTE[s]);
  if (icone === 'casa') return arteDoMapa('lugar-generico-casa', CENTRO_ARTE['generico-casa']);
  return null;
}

/** O ícone do lugar (a ilha com a construção), pronto para desenhar na tela pequena do mapa. */
export function spriteDoLugar(icone: IconeLugar, nome?: string): HTMLCanvasElement {
  const pintada = ilhaPintada(icone, nome);
  if (pintada) return pintada;
  let c = cache.get(icone);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext('2d')!;
  const S = 14;
  // o canto de trás da ilha: o meio do ícone é o centro do losango do chão
  const iso = new Iso(SPRITE_CENTRO[0], SPRITE_CENTRO[1] - S);
  ilha(ctx, iso, S, '#7cc96e', '#a6dc8a');
  DESENHOS[icone](ctx, iso);
  endurecer(c);
  cache.set(icone, c);
  return c;
}
