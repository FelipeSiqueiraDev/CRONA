import { CODEX_NO_TABULEIRO } from './arteCodex';
import { combate as cb, footprint, getFurni, M_POR_CASA, PILHA_CHAO, regras, terrenoEm, Z_PER_M, type FloorItem, type FloorStyle, type FurniDef, type RoomMap } from '@crona/shared';
import { imagemDoMapa } from './mapaImagem';
import { desenharItemNoChao } from './itemNoChao';
import { contornoArea, type Casa } from '../room/combateGeo';
import type { MarcasCombate } from './combateMarcas';
import { imagemDeCima, imagemDoChao, tamanhoReal, chaveDaArte } from './furniArte';
import { VAO_PORTA_M } from './furniKit';
import { texturaPiso } from './texturas';

/**
 * Mapa tático: a sala vista de cima, como um mapa de batalha, e o caminho da câmera do
 * isométrico até lá. Um desenho só, guiado pela câmera (CameraVoo): em cima (t = 1) é o
 * mapa tático; no meio do caminho, a mesma sala como maquete (os móveis erguidos na altura
 * deles, as paredes do fundo de pé), que vai achatando enquanto a câmera sobe.
 *
 * - O piso de verdade da sala (as texturas já são vistas de cima), os tapetes com a arte
 *   deles e a grade do livro: o quadrado de 1,5 m = 2×2 casas do CRONA (0,75 m cada).
 * - Os móveis com forma (cadeira redonda, mesa com tábuas, planta de folhas), mais escuros
 *   quanto mais cobrem: até 0,8 m não cobrem, de 0,8 m dão cobertura, de 1,8 m tapam como
 *   parede (as mesmas medidas do combateGeo).
 * - As peças como fichas redondas com o retrato, o anel na cor do lado, o PV em arco e o nome.
 * - Com arte (scripts/3d/cima.py): o móvel visto de cima no tampo, a parede do piso da sala e o
 *   aro das fichas (client/public/arte/tatico/); sem ela, o desenho por código.
 */

export interface PecaTatica {
  id: number;
  /** a casa (pode ser quebrada: a peça andando entre casas) */
  x: number;
  y: number;
  nome: string;
  /** a cor do agente (o anel); a ameaça é sempre vermelha */
  cor: string;
  lado: 'agente' | 'ameaca' | 'outro';
  retrato?: HTMLCanvasElement | null;
  /** PV de 0 a 1 (o arco em volta) */
  pv?: number;
  /** é a vez dela (brilha) */
  vez?: boolean;
  /** a peça comandada agora (anel de seleção) */
  escolhida?: boolean;
  caido?: boolean;
  /** o alvo do ataque (a mira em volta) */
  mira?: boolean;
  /** dentro da área (anel vermelho) */
  naArea?: boolean;
}

/** Onde a sala cai no quadro do tático: a origem (casa 0,0) e o tamanho da casa, em px. */
export interface Enquadre {
  x: number;
  y: number;
  casa: number;
}

/** A câmera do tabuleiro isométrico, em px do canvas: canvas = iso(x, y, z) · zoom + cam. */
export interface CameraIso {
  zoom: number;
  camX: number;
  camY: number;
}

/**
 * Uma câmera: leva a casa (x, y) na altura z (em unidades do tabuleiro) para o canvas. Gira o
 * chão em volta do meio da sala (giro), achata a profundidade (achata = seno da elevação) e
 * sobe a altura (alto: px por unidade). Em cima: giro 0, achata 1, alto 0.
 */
export interface CameraVoo {
  giro: number;
  achata: number;
  alto: number;
  escala: number;
  ox: number;
  oy: number;
  cx: number;
  cy: number;
  /** 0 = o isométrico, 1 = em cima */
  t: number;
}

const COBRE = 0.8 * Z_PER_M;
const TAPA = 1.8 * Z_PER_M;
/** grossura da parede, em casas */
const PAREDE = 0.34;
/** altura das paredes do fundo na maquete */
const ALTO_PAREDE = 2.6 * Z_PER_M;

// ---------------------------------------------------------------------------
// a sala e a câmera

/** O retângulo do piso da sala, em casas. */
export function limitesDaSala(map: RoomMap) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (map.floorHeight(x, y) !== null) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: map.width, y1: map.height };
}

/** A sala inteira cabendo no retângulo w×h (a partir de x, y), com margem e a grossura da parede. */
export function enquadrar(map: RoomMap, w: number, h: number, margem = 20, x = 0, y = 0): Enquadre {
  const b = limitesDaSala(map);
  const bw = b.x1 - b.x0 + PAREDE * 2;
  const bh = b.y1 - b.y0 + PAREDE * 2;
  const casa = Math.max(6, Math.min((w - margem * 2) / bw, (h - margem * 2) / bh));
  return { x: x + (w - (b.x1 - b.x0) * casa) / 2 - b.x0 * casa, y: y + (h - (b.y1 - b.y0) * casa) / 2 - b.y0 * casa, casa };
}

/** A câmera de cima que mostra o enquadre e (o mapa tático parado). */
export function cameraDeCima(map: RoomMap, e: Enquadre): CameraVoo {
  const b = limitesDaSala(map);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return { giro: 0, achata: 1, alto: 0, escala: e.casa, ox: e.x + cx * e.casa, oy: e.y + cy * e.casa, cx, cy, t: 1 };
}

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const passo = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export interface Quadro {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** O ângulo da câmera em s (0 = isométrico, 1 = em cima) e o retângulo da sala vista com escala 1, em volta do meio. */
function poseDaCamera(map: RoomMap, cx: number, cy: number, s: number) {
  const elev = ((30 + 60 * s) * Math.PI) / 180;
  const giro = (Math.PI / 4) * (1 - s);
  const achata = Math.sin(elev);
  // a altura anda junto com a escala (no isométrico, 32 px por unidade = escala / raiz de 2)
  const altoPorEscala = Math.cos(elev) / Math.cos(Math.PI / 6) / Math.SQRT2;
  const b = limitesDaSala(map);
  const cs = Math.cos(giro);
  const sn = Math.sin(giro);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const x of [b.x0 - PAREDE, b.x1 + PAREDE])
    for (const y of [b.y0 - PAREDE, b.y1 + PAREDE])
      for (const z of [0, ALTO_PAREDE]) {
        const dx = x - cx;
        const dy = y - cy;
        const u = dx * cs - dy * sn;
        const v = achata * (dx * sn + dy * cs) - z * altoPorEscala;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        v0 = Math.min(v0, v);
        v1 = Math.max(v1, v);
      }
  return { giro, achata, altoPorEscala, u0, u1, v0, v1 };
}

/**
 * A câmera em t (0 = o isométrico do tabuleiro, 1 = o mapa tático), com a subida suave. Nas
 * pontas ela bate com o tabuleiro e com o tático. No meio do caminho, girando e com as paredes
 * de pé, a sala ocupa mais lugar: a câmera se afasta o que precisa para caber no quadro, numa
 * curva só (afasta até o ponto mais apertado e volta), sem ir e vir.
 */
export function cameraVoo(map: RoomMap, iso: CameraIso, e: Enquadre, t: number, quadro: Quadro): CameraVoo {
  const fim = cameraDeCima(map, e);
  const { cx, cy } = fim;
  const L0 = 32 * Math.SQRT2 * iso.zoom;
  const natural = (s: number) => L0 * Math.pow(fim.escala / L0, s);
  const margem = 14;
  const cabe = (p: ReturnType<typeof poseDaCamera>) => Math.min((quadro.w - margem * 2) / (p.u1 - p.u0), (quadro.h - margem * 2) / (p.v1 - p.v0));
  // o ponto mais apertado do caminho: quanto a câmera precisa se afastar ali
  let fundo = 0;
  let sFundo = 0.5;
  for (let i = 1; i < 32; i++) {
    const si = i / 32;
    const f = Math.log(Math.min(1, cabe(poseDaCamera(map, cx, cy, si)) / natural(si)));
    if (f < fundo) (fundo = f, (sFundo = si));
  }
  const s = suave(Math.max(0, Math.min(1, t)));
  const p = poseDaCamera(map, cx, cy, s);
  const peso = s <= sFundo ? passo(0, sFundo, s) : 1 - passo(sFundo, 1, s);
  const escala = natural(s) * Math.exp(fundo * peso);
  // o meio da sala vai do lugar dele no isométrico até o do tático; no caminho, a sala inteira vai para o meio do quadro
  const ix = (cx - cy) * 32 * iso.zoom + iso.camX;
  const iy = (cx + cy) * 16 * iso.zoom + iso.camY;
  const ox = ix + (fim.ox - ix) * s;
  const oy = iy + (fim.oy - iy) * s;
  const mx = quadro.x + quadro.w / 2 - ((p.u0 + p.u1) / 2) * escala;
  const my = quadro.y + quadro.h / 2 - ((p.v0 + p.v1) / 2) * escala;
  return {
    giro: p.giro,
    achata: p.achata,
    alto: escala * p.altoPorEscala,
    escala,
    ox: ox + (mx - ox) * peso,
    oy: oy + (my - oy) * peso,
    cx,
    cy,
    t,
  };
}

/** A casa (x, y) na altura z, no canvas, pela câmera v. */
export function projetar(v: CameraVoo, x: number, y: number, z = 0): [number, number] {
  const dx = x - v.cx;
  const dy = y - v.cy;
  const c = Math.cos(v.giro);
  const s = Math.sin(v.giro);
  return [v.ox + v.escala * (dx * c - dy * s), v.oy + v.escala * v.achata * (dx * s + dy * c) - z * v.alto];
}

/** A matriz do plano na altura z (casa -> canvas). */
export function matrizNaAltura(v: CameraVoo, z = 0): DOMMatrix {
  const [ox, oy] = projetar(v, 0, 0, z);
  const [ax, ay] = projetar(v, 1, 0, z);
  const [bx, by] = projetar(v, 0, 1, z);
  return new DOMMatrix([ax - ox, ay - oy, bx - ox, by - oy, ox, oy]);
}

/** A casa embaixo do ponto (px do canvas) na câmera de cima, ou null fora do piso. */
export function casaNoPonto(map: RoomMap, e: Enquadre, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - e.x) / e.casa);
  const y = Math.floor((py - e.y) / e.casa);
  return map.floorHeight(x, y) === null ? null : { x, y };
}

// ---------------------------------------------------------------------------
// o desenho

export interface OpcoesMesa {
  /** marcas do combate no chão (movimento, alcance, áreas), desenhadas em casas, embaixo dos móveis */
  noChao?: (ctx: CanvasRenderingContext2D) => void;
  /** marcas por cima de tudo (a reta até o alvo, com o texto), em px do canvas */
  porCima?: (ctx: CanvasRenderingContext2D, v: CameraVoo) => void;
  /** a tinta do escuro da sala por cima da maquete (0 a 1) */
  escuro?: number;
  /** pinta o fundo (fora da sala) antes */
  fundo?: boolean;
  /** o escuro de cada casa das celas fechadas ("x,y" -> 0 a 1): o que tem dentro some no escuro */
  celas?: Map<string, number> | null;
  /** o raio da ficha das peças, em casas (o padrão, 0,5: a ficha tem a largura de uma casa, 0,75 m) */
  ficha?: number;
  /** o móvel aparece? (na mesa, o que está na névoa não aparece) */
  mostrarItem?: (it: FloorItem) => boolean;
  /** mapa improvisado: a imagem no chão inteiro da sala, no lugar do piso */
  imagemChao?: CanvasImageSource | null;
  /** ao ar livre: o chão de cada casa (grama, estrada, lavoura, píer...), uma letra por casa; a água é casa vazia */
  terreno?: string;
}

/** A cor do chão enquanto a textura do estilo não chegou, e a água. */
const COR_TERRENO: Partial<Record<FloorStyle, string>> = { grama: '#4d6a2e', estrada: '#86663f', lavoura: '#553823', cascalho: '#9a9384', terra: '#3a2e22', pier: '#6a5238', calabouco: '#35363a' };
const COR_AGUA = '#2f5f72';

/** O mapa tático parado, no enquadre e. */
export function desenharTatico(ctx: CanvasRenderingContext2D, map: RoomMap, piso: FloorStyle | undefined, pecas: PecaTatica[], e: Enquadre, opcoes: OpcoesMesa = {}) {
  desenharMesa(ctx, map, piso, pecas, cameraDeCima(map, e), { fundo: true, ...opcoes });
}

/** A sala pela câmera v: em cima, o mapa tático; no meio do caminho, a maquete. */
export function desenharMesa(ctx: CanvasRenderingContext2D, map: RoomMap, piso: FloorStyle | undefined, pecas: PecaTatica[], v: CameraVoo, opcoes: OpcoesMesa = {}) {
  const chao = (x: number, y: number) => map.floorHeight(x, y) !== null;
  const itens = map
    .allItems()
    .map((it) => ({ it, def: getFurni(it.defId) }))
    .filter((m): m is { it: FloorItem; def: FurniDef } => !!m.def && !(m.def.hidden && m.it.state !== 1) && (!opcoes.mostrarItem || opcoes.mostrarItem(m.it)));
  ctx.save();
  if (opcoes.fundo) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0c0b';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  // ---------- o chão: o piso, a grade, os tapetes e as marcas do combate
  ctx.setTransform(matrizNaAltura(v, 0));
  const pisoPath = new Path2D();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (chao(x, y)) pisoPath.rect(x, y, 1.002, 1.002);
  const padraoDe = (estilo: FloorStyle | undefined): CanvasPattern | null => {
    const t = texturaPiso(estilo);
    const pat = t?.img.complete && t.img.naturalWidth ? ctx.createPattern(t.img, 'repeat') : null;
    if (pat) pat.setTransform(new DOMMatrix().scale(t!.casas / t!.img.naturalWidth));
    return pat;
  };
  const linhasTerreno = opcoes.terreno ? opcoes.terreno.replace(/\r/g, '').split('\n') : undefined;
  if (linhasTerreno) {
    // ao ar livre: cada casa com o chão dela (a textura de cima de cada estilo) e a água nas casas vazias
    const porEstilo = new Map<FloorStyle | undefined, Path2D>();
    const agua = new Path2D();
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const t = terrenoEm(linhasTerreno, x, y);
        if (!chao(x, y)) {
          if (t === 'agua') agua.rect(x, y, 1.002, 1.002);
          continue;
        }
        const estilo = t && t !== 'agua' ? t : piso;
        if (!porEstilo.has(estilo)) porEstilo.set(estilo, new Path2D());
        porEstilo.get(estilo)!.rect(x, y, 1.002, 1.002);
      }
    ctx.fillStyle = COR_AGUA;
    ctx.fill(agua);
    for (const [estilo, path] of porEstilo) {
      ctx.fillStyle = padraoDe(estilo) ?? (estilo ? COR_TERRENO[estilo] : undefined) ?? '#4a4038';
      ctx.fill(path);
    }
  } else {
    ctx.fillStyle = padraoDe(piso) ?? '#4a4038';
    ctx.fill(pisoPath);
  }
  if (opcoes.imagemChao) ctx.drawImage(opcoes.imagemChao, 0, 0, map.width, map.height);
  else {
    ctx.fillStyle = 'rgba(14, 11, 8, 0.32)';
    ctx.fill(pisoPath);
  }
  for (const { it, def } of itens) if (def.flat) desenharTapete(ctx, it, def);
  ctx.save();
  ctx.clip(pisoPath);
  const px = 1 / v.escala;
  ctx.lineWidth = px;
  ctx.strokeStyle = 'rgba(240, 225, 195, 0.06)';
  ctx.beginPath();
  for (let x = 0; x <= map.width; x++) (ctx.moveTo(x, 0), ctx.lineTo(x, map.height));
  for (let y = 0; y <= map.height; y++) (ctx.moveTo(0, y), ctx.lineTo(map.width, y));
  ctx.stroke();
  ctx.lineWidth = Math.max(px, 0.035);
  ctx.strokeStyle = 'rgba(240, 225, 195, 0.2)';
  ctx.beginPath();
  for (let x = 0; x <= map.width; x += 2) (ctx.moveTo(x, 0), ctx.lineTo(x, map.height));
  for (let y = 0; y <= map.height; y += 2) (ctx.moveTo(0, y), ctx.lineTo(map.width, y));
  ctx.stroke();
  ctx.restore();
  opcoes.noChao?.(ctx);

  // ---------- os blocos, do mais fundo para o mais perto
  type Bloco = { prof: number; z: number; desenhar: () => void };
  const blocos: Bloco[] = [];
  const sn = Math.sin(v.giro);
  const cs = Math.cos(v.giro);
  const prof = (x: number, y: number) => (x - v.cx) * sn + (y - v.cy) * cs;
  for (const { it, def } of itens) {
    if (def.flat || def.kind === 'portal' || /lamp|lampada|fluorescent|luz/.test(def.kind)) continue;
    const fp = footprint(def, it.rot);
    // o que alguém largou no chão: o ícone pintado do item, e não a vista de cima literal (07/10)
    if (it.defId === PILHA_CHAO && it.loot?.length) {
      blocos.push({ prof: prof(it.x + 0.5, it.y + 0.5), z: it.z ?? 0, desenhar: () => desenharItemLargado(ctx, v, it, () => desenharMovel(ctx, v, it, def)) });
      continue;
    }
    blocos.push({ prof: prof(it.x + fp.sx / 2, it.y + fp.sy / 2), z: it.z ?? 0, desenhar: () => desenharMovel(ctx, v, it, def) });
  }
  for (const p of paredes(map)) blocos.push({ prof: prof((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2) - (p.fundo ? 100 : 0), z: 0, desenhar: () => desenharParede(ctx, v, p, piso) });
  // a ficha no tamanho de uma pessoa vista de cima, na proporção dos móveis: uma casa (0,75 m) de largura
  // (o quadrado do livro, 1,5 m, é o espaço que a peça ocupa nas regras, e não o tamanho dela)
  const raio = opcoes.ficha ?? 0.5;
  for (const p of pecas) blocos.push({ prof: prof(p.x + 0.5, p.y + 0.5) + 0.02, z: 0.2, desenhar: () => desenharPeca(ctx, v, p, raio) });
  blocos.sort((a, b) => a.prof - b.prof || a.z - b.z);
  for (const b of blocos) b.desenhar();
  // as portas, no vão das paredes
  for (const { it, def } of itens) if (def.kind === 'portal') desenharPortaNaParede(ctx, v, map, it);
  // as celas fechadas: o que tem dentro (e quem estiver lá) no escuro
  if (opcoes.celas?.size) {
    ctx.setTransform(matrizNaAltura(v, 0));
    for (const [k, e] of opcoes.celas) {
      if (e < 0.01) continue;
      const [x, y] = k.split(',').map(Number);
      ctx.fillStyle = `rgba(4, 4, 7, ${(0.8 * e).toFixed(3)})`;
      ctx.fillRect(x - 0.002, y - 0.002, 1.004, 1.004);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opcoes.escuro && opcoes.escuro > 0) {
    ctx.fillStyle = `rgba(6, 5, 4, ${opcoes.escuro})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  // os nomes, de pé na tela, quando a câmera chega em cima
  const aNome = passo(0.82, 1, v.t);
  if (aNome > 0.01) {
    ctx.globalAlpha = aNome;
    for (const p of pecas) plaquinha(ctx, v, p, raio);
    ctx.globalAlpha = 1;
  }
  opcoes.porCima?.(ctx, v);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// as peças do desenho

/**
 * O que alguém largou no chão, visto de cima: o ícone pintado de cada item (até 3), de pé na tela, com uma sombra
 * achatada embaixo. Não precisa ser a vista de cima literal: o ícone destaca o item e mostra que alguém o deixou
 * ali. Enquanto a imagem não chega, `semArte` desenha o volume de sempre.
 */
function desenharItemLargado(ctx: CanvasRenderingContext2D, v: CameraVoo, it: FloorItem, semArte: () => void) {
  const imgs = (CODEX_NO_TABULEIRO ? it.loot ?? [] : [])
    .slice(0, 3)
    .map((l) => imagemDoMapa(`/arte/itens/pintados/${l.item?.id ?? regras.slug(l.name)}.png`))
    .filter((x): x is HTMLImageElement => !!x);
  if (!imgs.length) return semArte();
  const desloca = [
    [0, 0],
    [-0.24, 0.2],
    [0.22, -0.2],
  ];
  const lado = v.escala * (imgs.length > 1 ? 0.95 : 1.15);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  imgs.forEach((img, i) => {
    const [sx, sy] = projetar(v, it.x + 0.5 + desloca[i][0], it.y + 0.5 + desloca[i][1], it.z ?? 0);
    // o mesmo desenho do isométrico (de pé, sombra, brilho e balanço); a semente vem do item
    desenharItemNoChao(ctx, img, sx, sy + lado * 0.18, lado, (it.id * 0.6180339 + i * 0.31) % 1);
  });
  ctx.restore();
}

/** Tapete, rosa dos ventos, mancha: a arte vista de cima deitada na pegada (em casas); sem arte, uma marca na cor dele. */
function desenharTapete(ctx: CanvasRenderingContext2D, it: FloorItem, def: FurniDef) {
  const fp = footprint(def, it.rot);
  const e = it.escala ?? 1;
  const r = { x: it.x + (fp.sx * (1 - e)) / 2, y: it.y + (fp.sy * (1 - e)) / 2, w: fp.sx * e, h: fp.sy * e };
  const img = imagemDoChao(def.id);
  if (img) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    // a imagem do tapete é em pé (a largura na lateral): deita do jeito que cabe melhor
    const deitar = img.width > img.height !== r.w > r.h;
    if (deitar) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -r.h / 2, -r.w / 2, r.h, r.w);
    } else ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = hexa(def.colors?.[0] ?? '#6a4a3a', 0.35);
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** A forma do móvel visto de cima, em casas: redonda (planta, mesa redonda), arredondada (assento) ou retângulo. */
function formaDoMovel(it: FloorItem, def: FurniDef) {
  const tipo = `${def.id} ${def.kind}`;
  const assento = !!def.sit || /chair|stool|banqueta|cadeira/.test(tipo);
  const planta = /plant|arvore|arbusto/.test(tipo);
  const redondo = /round|redond/.test(tipo);
  const mesa = /table|mesa|desk|bench|counter|balcao/.test(tipo) && !assento;
  const fp = footprint(def, it.rot);
  // no tamanho de verdade (a vela é um pontinho no balcão, não o balcão inteiro); sem a medida, a casa inteira
  const tr = tamanhoReal(def.id);
  let r: { x: number; y: number; w: number; h: number };
  if (tr) {
    const deLado = it.rot === 2 || it.rot === 6;
    const w = Math.min(fp.sx, Math.max(0.1, (deLado ? tr.real[1] : tr.real[0]) / M_POR_CASA));
    const h = Math.min(fp.sy, Math.max(0.1, (deLado ? tr.real[0] : tr.real[1]) / M_POR_CASA));
    r = { x: it.x + (fp.sx - w) / 2, y: it.y + (fp.sy - h) / 2, w, h };
    if (tr.encosta) {
      // encostado no fundo, o lado oposto à frente (giro 4: a frente para +y, o fundo no y da casa)
      if (it.rot === 4) r.y = it.y;
      else if (it.rot === 0) r.y = it.y + fp.sy - h;
      else if (it.rot === 2) r.x = it.x;
      else if (it.rot === 6) r.x = it.x + fp.sx - w;
    }
  } else {
    const f = assento ? 0.16 : 0.07;
    r = { x: it.x + f, y: it.y + f, w: fp.sx - f * 2, h: fp.sy - f * 2 };
  }
  const miudo = r.w < 0.35 && r.h < 0.35;
  const path = new Path2D();
  // o contorno em pontos (para o corpo erguido), menos no retângulo, que vira caixa
  const pts: [number, number][] = [];
  const meio = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const elipse = (rx: number, ry: number) => {
    for (let i = 0; i < 24; i++) pts.push([meio.x + Math.cos((i / 24) * Math.PI * 2) * rx, meio.y + Math.sin((i / 24) * Math.PI * 2) * ry]);
  };
  if (planta) {
    const rr = Math.min(r.w, r.h) * 0.5;
    path.arc(meio.x, meio.y, rr, 0, Math.PI * 2);
    elipse(rr, rr);
  } else if (redondo || miudo) {
    path.ellipse(meio.x, meio.y, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    elipse(r.w / 2, r.h / 2);
  } else if (assento) {
    const rr = Math.min(r.w, r.h) * 0.3;
    path.roundRect(r.x, r.y, r.w, r.h, rr);
    for (const [qx, qy, a0] of [
      [r.x + r.w - rr, r.y + rr, -Math.PI / 2],
      [r.x + r.w - rr, r.y + r.h - rr, 0],
      [r.x + rr, r.y + r.h - rr, Math.PI / 2],
      [r.x + rr, r.y + rr, Math.PI],
    ])
      for (let i = 0; i <= 4; i++) pts.push([qx + Math.cos(a0 + (i / 4) * (Math.PI / 2)) * rr, qy + Math.sin(a0 + (i / 4) * (Math.PI / 2)) * rr]);
  } else path.roundRect(r.x, r.y, r.w, r.h, 0.06);
  return { path, pts, r, planta, mesa };
}

/**
 * O móvel: a sombra no chão pela altura, o corpo erguido (só aparece no caminho da câmera; em
 * cima ele some) e o tampo com a forma e os detalhes, na altura do móvel.
 */
function desenharMovel(ctx: CanvasRenderingContext2D, v: CameraVoo, it: FloorItem, def: FurniDef) {
  const alto = def.height ?? 0;
  const base = it.z ?? 0;
  const tapa = alto >= TAPA;
  const cobre = alto >= COBRE;
  const corBase = def.colors?.[0] ?? '#6a5a4a';
  const cor = misturar(clarear(corBase, 0.18), tapa ? '#15110d' : cobre ? '#2a231c' : '#6a5a48', tapa ? 0.5 : cobre ? 0.3 : 0.2);
  const { path, pts, r, planta, mesa } = formaDoMovel(it, def);
  // o modelo que a peça sorteou (a variação b ou c tem a vista de cima dela)
  const arte = imagemDeCima(chaveDaArte(def.id, it.id, undefined, it.vazio, it.modelo), it.state) ?? imagemDeCima(def.id, it.state);
  // a sombra no chão, para baixo e à direita, do tamanho da altura (com arte, a silhueta dela)
  if (base <= 0.01) {
    const s = Math.min(0.42, 0.06 + (alto / Z_PER_M) * 0.13);
    ctx.setTransform(matrizNaAltura(v, 0).translate(s * 0.6, s));
    if (arte) {
      ctx.globalAlpha = 0.5;
      desenharDeCima(ctx, { img: silhueta(arte.img), caixa: arte.caixa }, it, def);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fill(path);
    }
  }
  // o corpo: as faces de lado (retângulo) ou o contorno erguido (forma redonda)
  const topo = base + Math.max(0.02, alto);
  if (pts.length) corpoConvexo(ctx, v, pts, base, topo, misturar(cor, '#000000', 0.3));
  else caixa(ctx, v, r.x, r.y, r.x + r.w, r.y + r.h, base, topo, null, misturar(cor, '#000000', 0.25), misturar(cor, '#000000', 0.45));
  // o tampo: a arte vista de cima; sem ela, a forma com os detalhes
  ctx.setTransform(matrizNaAltura(v, topo));
  if (arte) {
    desenharDeCima(ctx, arte, it, def);
    return;
  }
  ctx.fillStyle = cor;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  if (planta) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rr = Math.min(r.w, r.h) * 0.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + it.id;
      ctx.fillStyle = i % 2 ? '#3f7a34' : '#2f5a2a';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * rr * 0.45, cy + Math.sin(a) * rr * 0.45, rr * 0.42, rr * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mesa) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    const deitada = r.w >= r.h;
    const n = Math.max(2, Math.round((deitada ? r.h : r.w) / 0.32));
    for (let i = 1; i < n; i++) {
      if (deitada) (ctx.moveTo(r.x, r.y + (r.h * i) / n), ctx.lineTo(r.x + r.w, r.y + (r.h * i) / n));
      else (ctx.moveTo(r.x + (r.w * i) / n, r.y), ctx.lineTo(r.x + (r.w * i) / n, r.y + r.h));
    }
    ctx.stroke();
  } else if (tapa) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let t = -r.h; t < r.w; t += 0.26) (ctx.moveTo(r.x + t, r.y + r.h), ctx.lineTo(r.x + t + r.h, r.y));
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, 'rgba(255, 240, 215, 0.16)');
  g.addColorStop(0.5, 'rgba(255, 240, 215, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.restore();
  ctx.strokeStyle = '#0f0c0a';
  ctx.lineWidth = Math.max(1 / v.escala, 0.05);
  ctx.stroke(path);
}

/**
 * A arte vista de cima deitada na pegada do móvel (a frente da imagem para baixo é o giro 4),
 * girada pelo giro dele. O recorte do móvel na imagem vai para o tamanho de verdade dele (no
 * meio da pegada, ou encostado no fundo); sem a medida, a imagem cobre a pegada inteira.
 */
function desenharDeCima(ctx: CanvasRenderingContext2D, arte: { img: CanvasImageSource; caixa: [number, number, number, number] | null }, it: FloorItem, def: FurniDef) {
  const fp = footprint(def, it.rot);
  const tr = tamanhoReal(def.id);
  ctx.save();
  ctx.translate(it.x + fp.sx / 2, it.y + fp.sy / 2);
  ctx.rotate(it.rot === 0 ? Math.PI : it.rot === 2 ? -Math.PI / 2 : it.rot === 6 ? Math.PI / 2 : 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (tr && arte.caixa) {
    // na imagem: a largura (ao longo da frente) em x, o fundo em y, e o fundo do móvel em cima
    const tw = Math.min(def.width, tr.real[0] / M_POR_CASA);
    const th = Math.min(def.depth, tr.real[1] / M_POR_CASA);
    const [x0, y0, x1, y1] = arte.caixa;
    ctx.drawImage(arte.img, x0, y0, x1 - x0, y1 - y0, -tw / 2, tr.encosta ? -def.depth / 2 : -th / 2, tw, th);
  } else ctx.drawImage(arte.img, -def.width / 2, -def.depth / 2, def.width, def.depth);
  ctx.restore();
}

const silhuetas = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** A imagem toda preta (a sombra dela). */
function silhueta(img: HTMLCanvasElement): HTMLCanvasElement {
  let s = silhuetas.get(img);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = img.width;
  s.height = img.height;
  const g = s.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#000';
  g.fillRect(0, 0, s.width, s.height);
  silhuetas.set(img, s);
  return s;
}

const artesTaticas = new Map<string, HTMLImageElement | null>();
/** Uma imagem de client/public/arte/tatico/ (a parede do piso, o aro das fichas); null enquanto carrega ou se não existe. */
function arteTatica(nome: string): HTMLImageElement | null {
  if (!CODEX_NO_TABULEIRO) return null;
  const img = artesTaticas.get(nome);
  if (img === undefined) {
    const el = new Image();
    el.decoding = 'async';
    el.onerror = () => artesTaticas.set(nome, null);
    el.src = `/arte/tatico/${nome}`;
    artesTaticas.set(nome, el);
    return null;
  }
  return img && img.complete && img.naturalWidth ? img : null;
}

const aneisDaCor = new Map<string, HTMLCanvasElement>();
/** O aro de latão da ficha de agente tingido na cor dele (o brilho e o desgaste do metal ficam). */
function anelDaCor(img: HTMLImageElement, cor: string): HTMLCanvasElement {
  let c = aneisDaCor.get(cor);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'color';
  g.globalAlpha = 0.8;
  g.fillStyle = cor;
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  aneisDaCor.set(cor, c);
  return c;
}

interface Parede {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** do fundo (de pé na maquete) ou da frente (só a faixa, como no tabuleiro) */
  fundo: boolean;
}

/**
 * As paredes da sala em trechos inteiros (sem emenda): por fora da borda do piso, com a
 * grossura. Na quina de fora o trecho passa da ponta para fechar com o outro lado; na de
 * dentro, para na ponta (senão entraria no piso).
 */
function paredes(map: RoomMap): Parede[] {
  const chao = (x: number, y: number) => map.floorHeight(x, y) !== null;
  const t = PAREDE;
  const out: Parede[] = [];
  // em cima e embaixo de cada fileira
  for (let y = 0; y < map.height; y++)
    for (const lado of [-1, 1]) {
      let ini = -1;
      for (let x = 0; x <= map.width; x++) {
        const tem = x < map.width && chao(x, y) && !chao(x, y + lado);
        if (tem && ini < 0) ini = x;
        if (!tem && ini >= 0) {
          const a = chao(ini - 1, y) ? ini : ini - t;
          const b = chao(x, y) ? x : x + t;
          out.push(lado < 0 ? { x0: a, y0: y - t, x1: b, y1: y, fundo: true } : { x0: a, y0: y + 1, x1: b, y1: y + 1 + t, fundo: false });
          ini = -1;
        }
      }
    }
  // à esquerda e à direita de cada coluna
  for (let x = 0; x < map.width; x++)
    for (const lado of [-1, 1]) {
      let ini = -1;
      for (let y = 0; y <= map.height; y++) {
        const tem = y < map.height && chao(x, y) && !chao(x + lado, y);
        if (tem && ini < 0) ini = y;
        if (!tem && ini >= 0) {
          const a = chao(x, ini - 1) ? ini : ini - t;
          const b = chao(x, y) ? y : y + t;
          out.push(lado < 0 ? { x0: x - t, y0: a, x1: x, y1: b, fundo: true } : { x0: x + 1, y0: a, x1: x + 1 + t, y1: b, fundo: false });
          ini = -1;
        }
      }
    }
  return out;
}

/**
 * Um trecho de parede: a do fundo de pé, com a face de dentro clara; a da frente baixinha (como
 * no tabuleiro). O topo leva a arte da parede do piso da sala, com a beira de baixo dela (o
 * lambri) virada para dentro da sala.
 */
function desenharParede(ctx: CanvasRenderingContext2D, v: CameraVoo, p: Parede, piso: FloorStyle | undefined) {
  const alto = p.fundo ? ALTO_PAREDE : 0.12 * Z_PER_M;
  const tex = piso ? arteTatica(`parede-${piso}.png`) : null;
  caixa(ctx, v, p.x0, p.y0, p.x1, p.y1, 0, alto, tex ? null : '#2f2a25', p.fundo ? '#4a4038' : '#1f1b17', p.fundo ? '#3b332c' : '#1a1714');
  if (!tex) return;
  const pad = ctx.createPattern(tex, 'repeat');
  if (!pad) return;
  const s = PAREDE / tex.naturalHeight;
  const deitada = p.x1 - p.x0 >= p.y1 - p.y0;
  pad.setTransform(
    new DOMMatrix(
      deitada ? (p.fundo ? [s, 0, 0, s, p.x0, p.y0] : [-s, 0, 0, -s, p.x1, p.y1]) : p.fundo ? [0, -s, s, 0, p.x0, p.y1] : [0, s, -s, 0, p.x1, p.y0],
    ),
  );
  ctx.setTransform(matrizNaAltura(v, alto));
  ctx.fillStyle = pad;
  ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  ctx.strokeStyle = '#0c0a08';
  ctx.lineWidth = Math.max(1 / v.escala, 0.03);
  ctx.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
}

/**
 * Um bloco retangular de z0 a z1: as faces de lado viradas para a câmera (a de +y, vista
 * quando o cosseno do giro é positivo, e a de +x, quando o seno é) e o tampo.
 */
function caixa(ctx: CanvasRenderingContext2D, v: CameraVoo, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, tampo: string | null, faceY: string, faceX: string) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const P = (x: number, y: number, z: number) => projetar(v, x, y, z);
  const poli = (pts: [number, number][], cor: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.stroke();
  };
  ctx.strokeStyle = '#0c0a08';
  ctx.lineWidth = Math.max(0.6, Math.min(1.4, v.escala * 0.03));
  ctx.lineJoin = 'round';
  if ((z1 - z0) * v.alto > 0.5) {
    if (Math.cos(v.giro) > 0.01) poli([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], faceY);
    if (Math.sin(v.giro) > 0.01) poli([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], faceX);
  }
  if (tampo) poli([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], tampo);
}

/** O corpo de um sólido de forma convexa (pts, em casas) de z0 a z1: o contorno das duas pontas, com a luz da esquerda. */
function corpoConvexo(ctx: CanvasRenderingContext2D, v: CameraVoo, pts: [number, number][], z0: number, z1: number, cor: string) {
  if ((z1 - z0) * v.alto <= 0.5) return;
  const proj = [...pts.map(([x, y]) => projetar(v, x, y, z0)), ...pts.map(([x, y]) => projetar(v, x, y, z1))];
  const casca = cascaConvexa(proj);
  let xa = Infinity;
  let xb = -Infinity;
  for (const [x] of casca) (xa = Math.min(xa, x), (xb = Math.max(xb, x)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(xa, 0, xb, 0);
  g.addColorStop(0, clarear(cor, 0.12));
  g.addColorStop(1, misturar(cor, '#000000', 0.3));
  ctx.beginPath();
  casca.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#0c0a08';
  ctx.lineWidth = Math.max(0.6, Math.min(1.4, v.escala * 0.03));
  ctx.stroke();
}

/** A casca convexa de pontos (cadeia monótona). */
function cascaConvexa(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const giro = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: [number, number][] = [];
  for (const q of p) {
    while (baixo.length >= 2 && giro(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop();
    baixo.push(q);
  }
  const cima: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (cima.length >= 2 && giro(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop();
    cima.push(q);
  }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)];
}

/** A porta: o vão na faixa da parede, aberto (com o arco da folha) ou fechado (a folha; vermelha se trancada). */
function desenharPortaNaParede(ctx: CanvasRenderingContext2D, v: CameraVoo, map: RoomMap, porta: FloorItem) {
  const chao = (x: number, y: number) => map.floorHeight(x, y) !== null;
  const { x, y } = porta;
  const t = PAREDE;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    if (chao(x + dx, y + dy)) continue;
    const fundo = dx < 0 || dy < 0;
    const alto = fundo ? ALTO_PAREDE : 0.12 * Z_PER_M;
    // o vão da porta, no meio da casa (do tamanho da arte da porta)
    const lv = VAO_PORTA_M / M_POR_CASA;
    const m0 = (1 - lv) / 2;
    const vao = dy !== 0 ? { x: x + m0, y: dy < 0 ? y - t : y + 1, w: lv, h: t } : { x: dx < 0 ? x - t : x + 1, y: y + m0, w: t, h: lv };
    // o vão até em cima (na maquete, a parede do fundo some no buraco da porta)
    ctx.setTransform(matrizNaAltura(v, alto));
    ctx.fillStyle = '#16120e';
    ctx.fillRect(vao.x, vao.y, vao.w, vao.h);
    ctx.setTransform(matrizNaAltura(v, 0));
    const fechada = porta.state === 1 || porta.state === 2;
    if (fechada) {
      ctx.fillStyle = porta.state === 2 ? '#a3221a' : '#7a5636';
      if (dy !== 0) ctx.fillRect(vao.x, vao.y + t * 0.35, vao.w, t * 0.3);
      else ctx.fillRect(vao.x + t * 0.35, vao.y, t * 0.3, vao.h);
      continue;
    }
    ctx.strokeStyle = 'rgba(214, 196, 160, 0.45)';
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.08, 0.08]);
    ctx.beginPath();
    if (dy !== 0) {
      const yy = dy < 0 ? y : y + 1;
      ctx.arc(vao.x, yy, vao.w, dy < 0 ? 0 : -Math.PI / 2, dy < 0 ? Math.PI / 2 : 0);
    } else {
      const xx = dx < 0 ? x : x + 1;
      ctx.arc(xx, vao.y, vao.h, dx < 0 ? 0 : Math.PI / 2, dx < 0 ? Math.PI / 2 : Math.PI);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** A ficha redonda deitada no chão (um pouco acima): sombra, o retrato, o anel do lado, o PV em arco e o brilho da vez. */
function desenharPeca(ctx: CanvasRenderingContext2D, v: CameraVoo, p: PecaTatica, r: number) {
  const cx = p.x + 0.5;
  const cy = p.y + 0.5;
  const cor = p.lado === 'ameaca' ? '#d23a2e' : p.cor;
  const lift = 0.15 * Z_PER_M;
  ctx.save();
  ctx.setTransform(matrizNaAltura(v, 0));
  if (p.vez) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.8);
    g.addColorStop(0, hexa(cor, 0.6));
    g.addColorStop(1, hexa(cor, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.1, cy + r * 0.18, r, 0, Math.PI * 2);
  ctx.fill();
  // a borda da ficha (a grossura dela, no caminho da câmera)
  const borda: [number, number][] = [];
  for (let i = 0; i < 28; i++) borda.push([cx + Math.cos((i / 28) * Math.PI * 2) * r * 0.97, cy + Math.sin((i / 28) * Math.PI * 2) * r * 0.97]);
  corpoConvexo(ctx, v, borda, 0, lift, misturar(cor, '#000000', 0.45));
  ctx.setTransform(matrizNaAltura(v, lift));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = p.lado === 'ameaca' ? '#3a0f0c' : '#1c1916';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (p.retrato) {
    const s = r * 2.15;
    ctx.drawImage(p.retrato, cx - s / 2, cy - s * 0.4, s, s);
  } else {
    ctx.fillStyle = hexa(cor, 0.95);
    ctx.font = `700 ${r * 0.95}px "Special Elite", "Courier Prime", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.nome.slice(0, 1).toUpperCase(), cx, cy + r * 0.06);
  }
  if (p.caido) {
    ctx.fillStyle = 'rgba(20, 10, 8, 0.6)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
  // o aro: a arte (latão na cor do agente; ferro com espinhos na ameaça) ou o anel na cor do lado
  const ameaca = p.lado === 'ameaca';
  const aro = arteTatica(ameaca ? 'ficha-ameaca.png' : 'ficha-agente.png');
  if (aro) {
    // o furo do meio fica a 0,78 da borda do aro; o da ameaça tem os espinhos para fora
    const S = r * (ameaca ? 2.415 : 2.1);
    ctx.drawImage(ameaca ? aro : anelDaCor(aro, cor), cx - S / 2, cy - S / 2, S, S);
  } else {
    ctx.strokeStyle = cor;
    ctx.lineWidth = r * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.mira || p.naArea) {
    ctx.strokeStyle = 'rgba(255, 64, 56, 0.95)';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.36, 0, Math.PI * 2);
    ctx.stroke();
    if (p.mira)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
        ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
        ctx.stroke();
      }
  }
  if (p.escolhida) {
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.95)';
    ctx.lineWidth = r * 0.06;
    ctx.setLineDash([r * 0.18, r * 0.12]);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.pv !== undefined) {
    const val = Math.max(0, Math.min(1, p.pv));
    // na ameaça, por fora dos espinhos
    const rp = r * (p.lado === 'ameaca' ? 1.24 : 1.11);
    ctx.lineWidth = r * 0.11;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, rp, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = val > 0.5 ? '#4fc06a' : val > 0.25 ? '#e0a23a' : '#e04a3a';
    ctx.beginPath();
    ctx.arc(cx, cy, rp, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * val);
    ctx.stroke();
  }
  if (p.caido) {
    ctx.strokeStyle = '#e04a3a';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** O nome da peça numa plaquinha embaixo dela, de pé na tela. */
function plaquinha(ctx: CanvasRenderingContext2D, v: CameraVoo, p: PecaTatica, r: number) {
  const nome = p.nome.split(' ')[0];
  if (!nome) return;
  const [cx, cy] = projetar(v, p.x + 0.5, p.y + 0.5, 0);
  const fs = Math.max(9, Math.round(v.escala * 0.36));
  ctx.font = `400 ${fs}px "Special Elite", "Courier Prime", monospace`;
  const tw = ctx.measureText(nome).width + fs * 0.9;
  const ty = cy + v.escala * r * 1.22 * v.achata;
  ctx.fillStyle = 'rgba(14, 12, 10, 0.82)';
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, ty, tw, fs * 1.45, fs * 0.3);
  ctx.fill();
  ctx.fillStyle = p.lado === 'ameaca' ? '#ff8f80' : '#efe6d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nome, cx, ty + fs * 0.75);
}

// ---------------------------------------------------------------------------
// as marcas do combate no mapa tático

/** As casas aonde a peça chega andando até `casas` passos (8 direções), sem atravessar parede nem o que bloqueia. */
export function casasAlcancaveis(map: RoomMap, de: { x: number; y: number }, casas: number, livre: (x: number, y: number) => boolean): Map<string, number> {
  const dist = new Map<string, number>([[`${de.x},${de.y}`, 0]]);
  let borda = [de];
  for (let n = 1; n <= casas && borda.length; n++) {
    const prox: { x: number; y: number }[] = [];
    for (const p of borda)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = p.x + dx;
          const y = p.y + dy;
          const k = `${x},${y}`;
          if (dist.has(k) || map.floorHeight(x, y) === null || !livre(x, y)) continue;
          // na diagonal, não corta o canto de parede
          if (dx && dy && (map.floorHeight(p.x + dx, p.y) === null || map.floorHeight(p.x, p.y + dy) === null)) continue;
          dist.set(k, n);
          prox.push({ x, y });
        }
    borda = prox;
  }
  return dist;
}

/** Pinta as casas alcançáveis (o movimento do turno), no plano do chão (em casas). */
export function desenharMovimento(ctx: CanvasRenderingContext2D, casas: Map<string, number>, cor = '#5aa8ff') {
  ctx.save();
  ctx.fillStyle = hexa(cor, 0.16);
  for (const k of casas.keys()) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.94);
  }
  ctx.restore();
}

/** A reta de uma peça até a outra, com a distância e a faixa escritas no meio (em px do canvas, pela câmera). */
export function desenharLinha(ctx: CanvasRenderingContext2D, v: CameraVoo, a: { x: number; y: number }, b: { x: number; y: number }, texto: string, cor = '#ffd27a') {
  const [ax, ay] = projetar(v, a.x + 0.5, a.y + 0.5);
  const [bx, by] = projetar(v, b.x + 0.5, b.y + 0.5);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = hexa(cor, 0.9);
  ctx.lineWidth = Math.max(1.5, v.escala * 0.08);
  ctx.setLineDash([v.escala * 0.25, v.escala * 0.15]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  const fs = Math.max(10, Math.round(v.escala * 0.42));
  ctx.font = `400 ${fs}px "Special Elite", "Courier Prime", monospace`;
  const tw = ctx.measureText(texto).width + fs;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 - fs * 1.2;
  ctx.fillStyle = 'rgba(14, 12, 10, 0.88)';
  ctx.beginPath();
  ctx.roundRect(mx - tw / 2, my - fs * 0.8, tw, fs * 1.6, fs * 0.3);
  ctx.fill();
  ctx.strokeStyle = hexa(cor, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, mx, my + fs * 0.05);
  ctx.restore();
}

/** Onde está a peça (em casas, com o passo em andamento). */
export type PosTatica = (id: number) => { x: number; y: number } | null;

/**
 * As marcas do combate no chão do mapa tático, em casas (embaixo dos móveis): o anel de alcance
 * de quem age (e o do dobro, mais fraco), a área e a casa embaixo do mouse.
 */
export function marcasNoChao(ctx: CanvasRenderingContext2D, m: MarcasCombate | null, pos: PosTatica, mouse: Casa | null, now: number) {
  ctx.save();
  // o movimento: as casas aonde dá para ir (a do mouse, mais forte)
  if (m?.passos?.length) {
    ctx.fillStyle = `rgba(80, 200, 255, ${0.16 + 0.05 * Math.sin(now / 380)})`;
    for (const c of m.passos) ctx.fillRect(c.x + 0.06, c.y + 0.06, 0.88, 0.88);
    if (mouse && m.passos.some((c) => c.x === mouse.x && c.y === mouse.y)) {
      ctx.fillStyle = 'rgba(120, 230, 255, 0.5)';
      ctx.fillRect(mouse.x + 0.04, mouse.y + 0.04, 0.92, 0.92);
    }
  }
  if (m?.alcance) {
    const p = pos(m.alcance.id);
    if (p) {
      const cx = p.x + 0.5;
      const cy = p.y + 0.5;
      ctx.fillStyle = 'rgba(80, 200, 255, 0.07)';
      ctx.beginPath();
      ctx.arc(cx, cy, m.alcance.casas, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([0.3, 0.22]);
      ctx.lineDashOffset = -now / 900;
      ctx.lineWidth = 0.07;
      ctx.strokeStyle = 'rgba(80, 200, 255, 0.9)';
      ctx.stroke();
      if (m.alcance.dobro) {
        ctx.strokeStyle = 'rgba(80, 200, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, m.alcance.casas * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  if (m?.area) {
    const pts = contornoArea(m.area);
    if (pts.length > 2) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 70, 60, 0.16)';
      ctx.fill();
      ctx.setLineDash([0.22, 0.16]);
      ctx.lineWidth = 0.06;
      ctx.strokeStyle = 'rgba(255, 80, 70, 0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (mouse) {
    ctx.fillStyle = 'rgba(255, 240, 220, 0.1)';
    ctx.fillRect(mouse.x, mouse.y, 1, 1);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = 'rgba(255, 244, 230, 0.75)';
    ctx.strokeRect(mouse.x + 0.03, mouse.y + 0.03, 0.94, 0.94);
  }
  ctx.restore();
}

/** As marcas do combate por cima do mapa tático (em px): a reta até o alvo, a medida, a cobertura e as etiquetas. */
export function marcasPorCima(ctx: CanvasRenderingContext2D, v: CameraVoo, m: MarcasCombate | null, pos: PosTatica, mouse: Casa | null) {
  if (!m) return;
  if (m.linha) {
    const a = pos(m.linha.de);
    const b = pos(m.linha.ate);
    if (a && b) desenharLinha(ctx, v, a, b, m.linha.rotulo, m.linha.fora ? '#ff4038' : '#f6c44a');
  }
  if (m.medida) {
    const b = m.medida.b ?? mouse;
    if (b) {
      const d = cb.metrosDe(cb.distanciaCasas(m.medida.a, b));
      const f = cb.faixaDaDistancia(d);
      desenharLinha(ctx, v, m.medida.a, b, `${cb.textoMetros(d)} · ${f ? cb.NOME_FAIXA[f] : 'além do extremo'}`, '#f2ece2');
    }
  }
  const etiqueta = (x: number, y: number, texto: string, cor: string) => {
    const fs = Math.max(10, Math.round(v.escala * 0.36));
    ctx.font = `400 ${fs}px "Special Elite", "Courier Prime", monospace`;
    const tw = ctx.measureText(texto).width + fs;
    ctx.fillStyle = 'rgba(14, 12, 10, 0.88)';
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, y - fs * 0.8, tw, fs * 1.6, fs * 0.3);
    ctx.fill();
    ctx.fillStyle = cor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y + fs * 0.05);
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (m.alcance) {
    const p = pos(m.alcance.id);
    if (p) {
      const [x, y] = projetar(v, p.x + 0.5, p.y + 0.5 + m.alcance.casas);
      etiqueta(x, y + v.escala * 0.3, m.alcance.rotulo, 'rgba(120, 214, 255, 0.95)');
    }
  }
  if (m.cobertura) {
    const c = m.cobertura.casa;
    const [x, y] = projetar(v, c.x + 0.5, c.y + 0.5);
    const cor = m.cobertura.total ? '#ff4038' : '#f2ece2';
    // o escudo onde a reta bate no que cobre
    const r = Math.max(6, v.escala * 0.32);
    ctx.fillStyle = 'rgba(14, 12, 10, 0.9)';
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(1.2, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.85, y - r * 0.6);
    ctx.lineTo(x + r * 0.7, y + r * 0.4);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.7, y + r * 0.4);
    ctx.lineTo(x - r * 0.85, y - r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    etiqueta(x, y - r * 2, m.cobertura.rotulo, cor);
  }
  if (m.area) {
    const c = m.area.alvo;
    const [x, y] = projetar(v, c.x + 0.5, c.y + 0.5);
    etiqueta(x, y + v.escala * 0.9, m.area.rotulo, 'rgba(255, 110, 100, 0.95)');
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// cores

function hexa(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function clarear(hex: string, t: number): string {
  return misturar(hex, '#ffffff', t);
}

function misturar(a: string, b: string, t: number): string {
  const ca = parseInt(a.replace('#', '').slice(0, 6), 16) || 0;
  const cb = parseInt(b.replace('#', '').slice(0, 6), 16) || 0;
  const canal = (sh: number) => Math.round(((ca >> sh) & 255) * (1 - t) + ((cb >> sh) & 255) * t);
  return '#' + ((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, '0');
}
