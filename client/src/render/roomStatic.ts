import { DIRS, M_POR_CASA, terrenoEm, Z_PER_M, type FloorStyle, type RoomMap, type WallSeg } from '@crona/shared';
import { hash, shade } from './color';
import { BATENTE_PORTA_M, VAO_PORTA_M } from './furniKit';
import { iso } from './iso';
import { texturaParede, texturaPiso, texturaPx, type TexturaPx } from './texturas';

export interface StaticLayer {
  canvas: HTMLCanvasElement;
  /** canto superior esquerdo em coordenadas de mundo */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Como cada piso é desenhado: cor, rejunte e desenho (pedra, tábua, ladrilho...). */
interface FloorLook {
  base: string;
  grout: string;
  kind: 'stone' | 'plank' | 'tile' | 'checker' | 'carpet' | 'plate' | 'dirt' | 'grass' | 'rows' | 'gravel';
  alt?: string;
}

const FLOORS: Record<FloorStyle, FloorLook> = {
  pedra: { base: '#4f4841', grout: 'rgba(18,14,12,0.6)', kind: 'stone' },
  concreto: { base: '#585650', grout: 'rgba(20,20,18,0.28)', kind: 'stone' },
  bloco: { base: '#5c5c58', grout: 'rgba(20,20,18,0.3)', kind: 'stone' },
  cela: { base: '#4a4c48', grout: 'rgba(20,20,18,0.3)', kind: 'stone' },
  madeira: { base: '#3b2718', grout: 'rgba(10,6,4,0.7)', kind: 'plank' },
  taco: { base: '#8a4a22', grout: 'rgba(40,16,6,0.6)', kind: 'plank' },
  ladrilho: { base: '#c2beb2', grout: 'rgba(80,80,74,0.6)', kind: 'tile' },
  cozinha_fazenda: { base: '#c9c0ad', grout: 'rgba(80,72,60,0.6)', kind: 'tile' },
  xadrez: { base: '#cfcabd', alt: '#2a2622', grout: 'rgba(0,0,0,0.35)', kind: 'checker' },
  azulejo: { base: '#93aebb', grout: 'rgba(40,60,70,0.5)', kind: 'tile' },
  carpete: { base: '#3b2160', alt: '#7a5ab0', grout: 'rgba(0,0,0,0)', kind: 'carpet' },
  musgo: { base: '#213b33', grout: 'rgba(0,10,6,0.6)', kind: 'stone' },
  metal: { base: '#30343a', grout: 'rgba(0,0,0,0.55)', kind: 'plate' },
  terra: { base: '#3a2e22', grout: 'rgba(0,0,0,0)', kind: 'dirt' },
  grama: { base: '#4d6a2e', alt: '#6c8c3a', grout: 'rgba(0,0,0,0)', kind: 'grass' },
  estrada: { base: '#86663f', grout: 'rgba(0,0,0,0)', kind: 'dirt' },
  lavoura: { base: '#553823', alt: '#6c4a2c', grout: 'rgba(0,0,0,0)', kind: 'rows' },
  cascalho: { base: '#9a9384', grout: 'rgba(40,36,30,0.35)', kind: 'gravel' },
  selo: { base: '#3e3a36', grout: 'rgba(10,8,6,0.6)', kind: 'stone' },
  pier: { base: '#6a5238', grout: 'rgba(20,12,6,0.6)', kind: 'plank' },
  calabouco: { base: '#35363a', grout: 'rgba(8,8,10,0.6)', kind: 'stone' },
};
/** a água (casa vazia da planta com terreno 'a'): mais baixa que a margem */
const AGUA = '#2f5f72';

export function floorLook(style: FloorStyle | undefined): FloorLook {
  return FLOORS[style ?? 'pedra'] ?? FLOORS.pedra;
}
const EDGE_VOID_X = '#1d1916';
const EDGE_VOID_Y = '#27221e';
const EDGE_STEP_X = '#342e29';
const EDGE_STEP_Y = '#403933';
const WALL_L = '#302a26';
const WALL_R = '#3b342f';
const WALL_TOP = '#5a524b';
const WALL_CAP = '#221d1a';
const T = 0.3;
const FLOOR_THICK = 0.35;
/** altura do vão da porta: 2,1 m (Z_PER_M) */
const DOOR_H = 2.1 * Z_PER_M;
/**
 * o buraco na parede, centrado na casa da porta: o vão mais meio batente de cada lado, para a moldura
 * da porta cobrir a borda dele (o quanto ele passa da casa para cada lado)
 */
const VAO_SOBRA = ((VAO_PORTA_M + BATENTE_PORTA_M) / M_POR_CASA - 1) / 2;
/** o degrau de cima da escada que sobe para a porta (o vão começa nele) */
const ESCADA_TOPO = 1.0 * Z_PER_M;
const MAX_PIXELS = 14_000_000;

type Pt = [number, number];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function minFloor(map: RoomMap) {
  let m = Infinity;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const h = map.floorHeight(x, y);
      if (h !== null && h < m) m = h;
    }
  return Number.isFinite(m) ? m : 0;
}

export function roomBounds(map: RoomMap, aberto = false) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (p: Pt) => {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  };
  const top = map.walls.top;
  const minH = minFloor(map);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const h = map.floorHeight(x, y);
      if (h === null) continue;
      add(iso(x, y, h));
      add(iso(x + 1, y + 1, minH - FLOOR_THICK));
      add(iso(x + 1, y, h));
      add(iso(x, y + 1, h));
    }
  for (const s of aberto ? [] : map.walls.segs) {
    if (s.wall === 'l') {
      add(iso(s.plane - T, s.at, top));
      add(iso(s.plane - T, s.at + 1, top));
    } else {
      add(iso(s.at, s.plane - T, top));
      add(iso(s.at + 1, s.plane - T, top));
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

/**
 * O vão da porta do cômodo: na parede da porta, de a0 até a1 (passa da casa da porta
 * para os lados) e de z0 até z1. Com a escada que sobe na frente da porta, o vão começa
 * no degrau de cima e vai até o topo da parede (a escada continua para cima).
 */
function vaoDaPorta(map: RoomMap): { seg: WallSeg; a0: number; a1: number; z0: number; z1: number; escada: boolean } | null {
  const seg = map.walls.segs.find((s) => s.door);
  if (!seg) return null;
  const [dx, dy] = DIRS[map.door.dir] ?? [0, 0];
  const escada = map.itemsAt(map.door.x + dx, map.door.y + dy).some((it) => it.defId === 'stairs_up');
  const z0 = seg.base + (escada ? ESCADA_TOPO : 0);
  return { seg, a0: seg.at - VAO_SOBRA, a1: seg.at + 1 + VAO_SOBRA, z0, z1: escada ? map.walls.top : z0 + DOOR_H, escada };
}

/** O pedaço do vão da porta que cai neste trecho de parede (o vão passa por três trechos). */
function buracoNoTrecho(map: RoomMap, s: WallSeg): Pt[] | null {
  const v = vaoDaPorta(map);
  if (!v || v.seg.wall !== s.wall || v.seg.plane !== s.plane) return null;
  const a0 = Math.max(s.at, v.a0);
  const a1 = Math.min(s.at + 1, v.a1);
  return a1 > a0 ? wallQuad(s, a0, a1, v.z0, v.z1) : null;
}

/**
 * Recorte para quem está atrás da parede da porta: tudo, menos as faces de
 * parede vizinhas, mais o vão da porta (regra evenodd).
 */
export function doorClipPath(map: RoomMap): { seg: WallSeg; path: Path2D } | null {
  const seg = map.walls.segs.find((s) => s.door);
  if (!seg) return null;
  const path = new Path2D();
  path.rect(-1e5, -1e5, 2e5, 2e5);
  const add = (q: Pt[]) => {
    path.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length; i++) path.lineTo(q[i][0], q[i][1]);
    path.closePath();
  };
  for (const s of map.walls.segs)
    if (s.wall === seg.wall && s.plane === seg.plane && Math.abs(s.at - seg.at) <= 2) add(wallQuad(s, s.at, s.at + 1, s.base - FLOOR_THICK, map.walls.top));
  const v = vaoDaPorta(map)!;
  add(wallQuad(seg, v.a0, v.a1, seg.base - FLOOR_THICK, v.z1));
  return { seg, path };
}

/** Pontos de um retângulo no plano de uma parede (a = ao longo, z = altura). */
function wallQuad(s: WallSeg, a0: number, a1: number, z0: number, z1: number): Pt[] {
  if (s.wall === 'l') return [iso(s.plane, a0, z0), iso(s.plane, a1, z0), iso(s.plane, a1, z1), iso(s.plane, a0, z1)];
  return [iso(a0, s.plane, z0), iso(a1, s.plane, z0), iso(a1, s.plane, z1), iso(a0, s.plane, z1)];
}

function wallLine(s: WallSeg, a0: number, z0: number, a1: number, z1: number): [Pt, Pt] {
  if (s.wall === 'l') return [iso(s.plane, a0, z0), iso(s.plane, a1, z1)];
  return [iso(a0, s.plane, z0), iso(a1, s.plane, z1)];
}

/** Pinta com a textura o que estiver recortado: uma face de parede ou uma casa do chão. */
type Pintor<T> = (alvo: T) => void;

function drawWallSeg(ctx: CanvasRenderingContext2D, map: RoomMap, s: WallSeg, pintarParede?: Pintor<WallSeg>) {
  const top = map.walls.top;
  const b = s.base;
  const a0 = s.at;
  const a1 = s.at + 1;
  const face = wallQuad(s, a0, a1, b, top);
  const hole = buracoNoTrecho(map, s);
  const base = s.wall === 'l' ? WALL_L : WALL_R;

  ctx.save();
  ctx.beginPath();
  for (const q of hole ? [face, hole] : [face]) {
    ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
    ctx.closePath();
  }
  ctx.fillStyle = base;
  ctx.fill('evenodd');
  ctx.clip('evenodd');

  if (pintarParede) {
    // a textura desenhada (do chão ao topo); a parede da esquerda fica um pouco mais escura
    pintarParede(s);
    if ((pintarParede as { pixel?: boolean }).pixel) {
      // a pixel art já vem com a luz de cada parede e o rodapé
      ctx.restore();
      acabamento(ctx, map, s, hole);
      return;
    }
    if (s.wall === 'l') {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      poly(ctx, face);
      ctx.fill();
    }
    const [, yb] = iso(s.wall === 'l' ? s.plane : a0, s.wall === 'l' ? a0 : s.plane, b);
    const [, yt] = iso(s.wall === 'l' ? s.plane : a0, s.wall === 'l' ? a0 : s.plane, b + 1.8);
    const g = ctx.createLinearGradient(0, yb + 16, 0, yt);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    poly(ctx, face);
    ctx.fill();
    ctx.restore();
    acabamento(ctx, map, s, hole);
    return;
  }

  // tijolos
  const course = 0.3;
  let k = 0;
  for (let z = b; z < top - 1e-3; z += course, k++) {
    const z1 = Math.min(top, z + course);
    const off = (k % 2) * 0.25;
    for (let a = a0 - 0.5 + off; a < a1; a += 0.5) {
      const s0 = Math.max(a0, a);
      const s1 = Math.min(a1, a + 0.5);
      if (s1 <= s0) continue;
      const v = (hash(s.plane * 7 + (s.wall === 'l' ? 1 : 2), Math.round(a * 4), k) - 0.5) * 0.14;
      poly(ctx, wallQuad(s, s0 + 0.012, s1 - 0.012, z + 0.03, z1 - 0.012), shade(base, v));
    }
  }
  // grade de argamassa
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  k = 0;
  for (let z = b; z < top; z += course, k++) {
    const [p, q] = wallLine(s, a0, z, a1, z);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
  // sujeira na base
  const [, yb] = iso(s.wall === 'l' ? s.plane : a0, s.wall === 'l' ? a0 : s.plane, b);
  const [, yt] = iso(s.wall === 'l' ? s.plane : a0, s.wall === 'l' ? a0 : s.plane, b + 1.8);
  const g = ctx.createLinearGradient(0, yb + 16, 0, yt);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  poly(ctx, face);
  ctx.fill();
  // rodapé
  poly(ctx, wallQuad(s, a0, a1, b, b + 0.14), 'rgba(12,10,9,0.8)');
  // manchas de umidade
  const rnd = hash(s.plane, s.at, s.wall === 'l' ? 3 : 4);
  if (rnd < 0.35) {
    const [cx, cy] = iso(s.wall === 'l' ? s.plane : a0 + 0.5, s.wall === 'l' ? a0 + 0.5 : s.plane, b + 0.4 + rnd * 4);
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
    rg.addColorStop(0, 'rgba(10,14,8,0.35)');
    rg.addColorStop(1, 'rgba(10,14,8,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(cx - 24, cy - 24, 48, 48);
  }
  ctx.restore();
  acabamento(ctx, map, s, hole);
}

/** A moldura da porta, o topo com espessura e as tampas nas pontas da parede. */
function acabamento(ctx: CanvasRenderingContext2D, map: RoomMap, s: WallSeg, hole: Pt[] | null) {
  const top = map.walls.top;
  const b = s.base;
  const a0 = s.at;
  const a1 = s.at + 1;
  void hole;
  // topo com espessura
  const topStrip: Pt[] =
    s.wall === 'l'
      ? [iso(s.plane - T, a0, top), iso(s.plane, a0, top), iso(s.plane, a1, top), iso(s.plane - T, a1, top)]
      : [iso(a0, s.plane - T, top), iso(a1, s.plane - T, top), iso(a1, s.plane, top), iso(a0, s.plane, top)];
  ctx.lineWidth = 1;
  poly(ctx, topStrip, WALL_TOP, WALL_TOP);
  // linha da quina interna
  const [e0, e1] = wallLine(s, a0, top, a1, top);
  ctx.strokeStyle = 'rgba(255,240,220,0.12)';
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.stroke();

  // tampas nas pontas
  if (s.wall === 'l') {
    if (!map.walls.find('l', s.plane, s.at + 1))
      poly(ctx, [iso(s.plane - T, a1, b - FLOOR_THICK), iso(s.plane, a1, b - FLOOR_THICK), iso(s.plane, a1, top), iso(s.plane - T, a1, top)], WALL_CAP, 'rgba(0,0,0,0.6)');
  } else if (!map.walls.find('r', s.plane, s.at + 1)) {
    poly(ctx, [iso(a1, s.plane - T, b - FLOOR_THICK), iso(a1, s.plane, b - FLOOR_THICK), iso(a1, s.plane, top), iso(a1, s.plane - T, top)], shade(WALL_CAP, -0.2), 'rgba(0,0,0,0.6)');
  }
}

/** Quadrilátero no chão: (u0, v0) até (u1, v1) na altura h. */
function quad(u0: number, v0: number, u1: number, v1: number, h: number): Pt[] {
  return [iso(u0, v0, h), iso(u1, v0, h), iso(u1, v1, h), iso(u0, v1, h)];
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** Pisos que não são pedra: tábuas, ladrilhos, xadrez, carpete, chapa, terra. */
function drawPattern(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, look: FloorLook) {
  const base = look.base;
  switch (look.kind) {
    case 'plank': {
      // três tábuas por casa, correndo em x, emendas desencontradas
      for (let k = 0; k < 3; k++) {
        const v0 = y + k / 3;
        const v1 = v0 + 1 / 3;
        const joint = x + 0.15 + hash(x, y * 3 + k, 11) * 0.7;
        for (const [a, b] of [
          [x, joint],
          [joint, x + 1],
        ]) {
          const col = shade(base, (hash(Math.floor(a * 7), y * 3 + k, 12) - 0.5) * 0.28);
          poly(ctx, quad(a, v0, b, v1, h), col);
          line(ctx, iso(a + 0.05, v0 + 0.12, h), iso(b - 0.05, v0 + 0.13, h), 'rgba(0,0,0,0.12)');
          line(ctx, iso(a + 0.1, v0 + 0.22, h), iso(b - 0.1, v0 + 0.21, h), 'rgba(255,230,200,0.05)');
        }
        line(ctx, iso(x, v1, h), iso(x + 1, v1, h), look.grout);
        line(ctx, iso(joint, v0, h), iso(joint, v1, h), look.grout);
      }
      break;
    }
    case 'tile':
    case 'checker': {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const u0 = x + i / 2;
          const v0 = y + j / 2;
          const dark = look.kind === 'checker' && (x * 2 + i + y * 2 + j) % 2 === 1;
          const col = shade(dark ? look.alt! : base, (hash(x * 2 + i, y * 2 + j, 5) - 0.5) * 0.08);
          const pts = quad(u0, v0, u0 + 0.5, v0 + 0.5, h);
          poly(ctx, pts, col);
          line(ctx, pts[3], pts[0], 'rgba(255,255,255,0.14)');
          line(ctx, pts[0], pts[1], 'rgba(255,255,255,0.14)');
          ctx.strokeStyle = look.grout;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[1][0], pts[1][1]);
          ctx.lineTo(pts[2][0], pts[2][1]);
          ctx.lineTo(pts[3][0], pts[3][1]);
          ctx.stroke();
          // mancha de uso de vez em quando
          if (hash(x, y, i, j, 3) < 0.08) {
            const [cx, cy] = iso(u0 + 0.25, v0 + 0.25, h);
            ctx.fillStyle = 'rgba(60,50,40,0.18)';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 7, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      break;
    }
    case 'carpet': {
      poly(ctx, quad(x, y, x + 1, y + 1, h), shade(base, (hash(x, y, 4) - 0.5) * 0.05));
      // fibras e um losango bem apagado
      for (let k = 0; k < 14; k++) {
        const [px, py] = iso(x + hash(x, y, k, 1), y + hash(y, x, k, 2), h);
        ctx.fillStyle = hash(k, x, y) < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
      if ((x + y) % 2 === 0) {
        ctx.strokeStyle = `${look.alt ?? '#ffffff'}22`;
        ctx.lineWidth = 1;
        const p = [iso(x + 0.5, y + 0.2, h), iso(x + 0.8, y + 0.5, h), iso(x + 0.5, y + 0.8, h), iso(x + 0.2, y + 0.5, h)];
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case 'plate': {
      const pts = quad(x, y, x + 1, y + 1, h);
      poly(ctx, pts, shade(base, (hash(x, y, 6) - 0.5) * 0.12));
      // piso antiderrapante: tracinhos alternados
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const u = x + 0.15 + i * 0.23;
          const v = y + 0.15 + j * 0.23;
          const d = (i + j) % 2 ? 0.06 : -0.06;
          line(ctx, iso(u - 0.05, v - d, h), iso(u + 0.05, v + d, h), 'rgba(170,180,190,0.16)', 1.3);
        }
      for (const [u, v] of [
        [x + 0.07, y + 0.07],
        [x + 0.93, y + 0.07],
        [x + 0.07, y + 0.93],
        [x + 0.93, y + 0.93],
      ]) {
        const [px, py] = iso(u, v, h);
        ctx.fillStyle = 'rgba(200,205,210,0.35)';
        ctx.fillRect(Math.round(px) - 1, Math.round(py), 2, 1);
      }
      ctx.strokeStyle = look.grout;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.lineTo(pts[3][0], pts[3][1]);
      ctx.stroke();
      break;
    }
    case 'grass': {
      poly(ctx, quad(x, y, x + 1, y + 1, h), shade(base, (hash(x, y, 31) - 0.5) * 0.12));
      // manchas mais claras e tufos de capim
      if (hash(x, y, 32) < 0.45) {
        const [cx, cy] = iso(x + 0.2 + hash(x, y, 33) * 0.6, y + 0.2 + hash(y, x, 34) * 0.6, h);
        ctx.fillStyle = 'rgba(140,170,80,0.16)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10 + hash(x, y, 35) * 10, 5 + hash(y, x, 36) * 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 9; k++) {
        const [px, py] = iso(x + hash(x, y, k, 37), y + hash(y, x, k, 38), h);
        const r = hash(k, x, y, 39);
        ctx.fillStyle = r < 0.45 ? shade(look.alt ?? base, 0.1) : r < 0.85 ? shade(base, -0.28) : 'rgba(210,200,120,0.7)';
        ctx.fillRect(Math.round(px), Math.round(py) - 2, 1, 3);
        if (r < 0.3) ctx.fillRect(Math.round(px) + 1, Math.round(py) - 1, 1, 2);
      }
      if (hash(x, y, 40) < 0.04) {
        const [px, py] = iso(x + 0.5, y + 0.5, h);
        ctx.fillStyle = hash(x, y, 41) < 0.5 ? '#e8d870' : '#e8e0f0';
        ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      break;
    }
    case 'rows': {
      poly(ctx, quad(x, y, x + 1, y + 1, h), shade(base, (hash(x, y, 42) - 0.5) * 0.08));
      // os sulcos da terra arada, correndo em x
      for (let k = 0; k < 3; k++) {
        const v = y + (k + 0.5) / 3;
        line(ctx, iso(x, v - 0.06, h), iso(x + 1, v - 0.06, h), shade(look.alt ?? base, 0.12), 2);
        line(ctx, iso(x, v + 0.06, h), iso(x + 1, v + 0.06, h), 'rgba(0,0,0,0.3)');
      }
      break;
    }
    case 'gravel': {
      poly(ctx, quad(x, y, x + 1, y + 1, h), shade(base, (hash(x, y, 43) - 0.5) * 0.08));
      for (let k = 0; k < 16; k++) {
        const [px, py] = iso(x + hash(x, y, k, 44), y + hash(y, x, k, 45), h);
        ctx.fillStyle = hash(k, y, x, 46) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,250,235,0.2)';
        ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
      }
      break;
    }
    case 'dirt': {
      poly(ctx, quad(x, y, x + 1, y + 1, h), shade(base, (hash(x, y, 8) - 0.5) * 0.15));
      for (let k = 0; k < 4; k++) {
        const [cx, cy] = iso(x + hash(x, y, k, 9), y + hash(y, x, k, 10), h);
        ctx.fillStyle = hash(k, y, x) < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(120,100,70,0.14)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 4 + hash(k, x) * 8, 2 + hash(k, y) * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 6; k++) {
        const [px, py] = iso(x + hash(x, k, y, 1), y + hash(k, y, x, 2), h);
        ctx.fillStyle = 'rgba(150,130,100,0.35)';
        ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
      }
      break;
    }
    default:
      break;
  }
}

function drawTile(ctx: CanvasRenderingContext2D, map: RoomMap, x: number, y: number, h: number, door: boolean, minH: number, look: FloorLook = FLOORS.pedra, pintarPiso?: Pintor<[number, number, number]>) {
  // bordas (espessura) para frente; na beira da sala descem até a base
  const nx = map.floorHeight(x + 1, y);
  const bx = nx === null ? minH - FLOOR_THICK : nx;
  if (bx < h) {
    const pts: Pt[] = [iso(x + 1, y, h), iso(x + 1, y + 1, h), iso(x + 1, y + 1, bx), iso(x + 1, y, bx)];
    poly(ctx, pts, nx === null ? EDGE_VOID_X : EDGE_STEP_X, 'rgba(0,0,0,0.5)');
  }
  const ny = map.floorHeight(x, y + 1);
  const by = ny === null ? minH - FLOOR_THICK : ny;
  if (by < h) {
    const pts: Pt[] = [iso(x, y + 1, h), iso(x + 1, y + 1, h), iso(x + 1, y + 1, by), iso(x, y + 1, by)];
    poly(ctx, pts, ny === null ? EDGE_VOID_Y : EDGE_STEP_Y, 'rgba(0,0,0,0.5)');
    if (ny !== null) {
      // degrau: linha clara na quina
      const a = iso(x, y + 1, h);
      const c = iso(x + 1, y + 1, h);
      ctx.strokeStyle = 'rgba(255,230,200,0.12)';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
  }

  if (!door && (pintarPiso || look.kind !== 'stone')) {
    if (pintarPiso) pintarPiso([x, y, h]);
    else drawPattern(ctx, x, y, h, look);
    // sombra de degrau: piso mais alto atrás
    const backX = map.floorHeight(x - 1, y);
    const backY = map.floorHeight(x, y - 1);
    if (backX !== null && backX > h) poly(ctx, quad(x, y, x + 0.5, y + 1, h), 'rgba(0,0,0,0.28)');
    if (backY !== null && backY > h) poly(ctx, quad(x, y, x + 1, y + 0.5, h), 'rgba(0,0,0,0.28)');
    return;
  }
  const base = door ? '#221d19' : look.base;
  const GROUT = look.grout;
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const u0 = x + i / 2;
      const v0 = y + j / 2;
      const r = hash(x * 2 + i, y * 2 + j, 5);
      const col = shade(base, (r - 0.5) * 0.18 - (door ? 0 : hash(x, y, 9) * 0.05));
      const pts: Pt[] = [iso(u0, v0, h), iso(u0 + 0.5, v0, h), iso(u0 + 0.5, v0 + 0.5, h), iso(u0, v0 + 0.5, h)];
      poly(ctx, pts, col);
      // relevo: luz no canto de cima, sombra embaixo
      ctx.strokeStyle = 'rgba(255,235,210,0.06)';
      ctx.beginPath();
      ctx.moveTo(pts[3][0], pts[3][1]);
      ctx.lineTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
      ctx.strokeStyle = GROUT;
      ctx.beginPath();
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.lineTo(pts[3][0], pts[3][1]);
      ctx.stroke();
      // pontilhado
      for (let k = 0; k < 5; k++) {
        const s = 0.1 + hash(x, y, i, j, k) * 0.8;
        const t = 0.1 + hash(y, x, j, i, k + 7) * 0.8;
        const [px, py] = iso(u0 + s * 0.5, v0 + t * 0.5, h);
        ctx.fillStyle = hash(k, x, y, i + j) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,220,0.06)';
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
      // sombra de degrau: piso mais alto atrás
      const backX = map.floorHeight(x - 1, y);
      const backY = map.floorHeight(x, y - 1);
      if (i === 0 && backX !== null && backX > h) poly(ctx, [iso(u0, v0, h), iso(u0 + 0.5, v0, h), iso(u0 + 0.5, v0 + 0.5, h), iso(u0, v0 + 0.5, h)], 'rgba(0,0,0,0.28)');
      if (j === 0 && backY !== null && backY > h) poly(ctx, [iso(u0, v0, h), iso(u0 + 0.5, v0, h), iso(u0 + 0.5, v0 + 0.5, h), iso(u0, v0 + 0.5, h)], 'rgba(0,0,0,0.28)');
      // rachaduras
      if (r < 0.06 && !door) {
        const [ax, ay] = iso(u0 + 0.1, v0 + 0.25, h);
        const [bx2, by2] = iso(u0 + 0.3, v0 + 0.2, h);
        const [cx, cy] = iso(u0 + 0.42, v0 + 0.4, h);
        ctx.strokeStyle = 'rgba(10,8,6,0.55)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx2, by2);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    }
}

/** A água numa casa vazia da planta: plana, mais baixa que a margem, com reflexos. */
function drawAgua(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  poly(ctx, quad(x - 0.01, y - 0.01, x + 1.01, y + 1.01, h), shade(AGUA, (hash(x, y, 47) - 0.5) * 0.06));
  for (let k = 0; k < 2; k++) {
    const u = x + 0.2 + hash(x, y, k, 48) * 0.6;
    const v = y + 0.2 + hash(y, x, k, 49) * 0.6;
    line(ctx, iso(u - 0.14, v, h), iso(u + 0.14, v, h), 'rgba(200,232,240,0.22)');
  }
}

/** Linha clara na borda de trás de um piso mais alto que o vizinho (leitura do degrau). */
function drawLedges(ctx: CanvasRenderingContext2D, map: RoomMap, x: number, y: number, h: number) {
  const bx = map.floorHeight(x - 1, y);
  const by = map.floorHeight(x, y - 1);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,235,210,0.22)';
  if (bx !== null && bx < h) {
    const a = iso(x, y, h);
    const b = iso(x, y + 1, h);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  if (by !== null && by < h) {
    const a = iso(x, y, h);
    const b = iso(x + 1, y, h);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

/** O padrão que leva cada pixel da textura para a tela: a origem e os passos de um pixel em x e em y. */
function padrao(ctx: CanvasRenderingContext2D, img: HTMLImageElement, o: Pt, px: Pt, py: Pt) {
  const p = ctx.createPattern(img, 'repeat');
  p?.setTransform(new DOMMatrix([px[0] - o[0], px[1] - o[1], py[0] - o[0], py[1] - o[1], o[0], o[1]]));
  return p;
}

/**
 * O chão com a textura vista de cima: uma volta dela cobre casas x casas (um fio a mais, sem frestas entre as
 * casas), com o pixel `origem` (o cruzamento dos rejuntes) na quina das casas: o rejunte segue a grade.
 */
function pintorPiso(ctx: CanvasRenderingContext2D, t: { img: HTMLImageElement; casas: number; origem: [number, number] }): Pintor<[number, number, number]> {
  const { img, casas } = t;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const u0 = (-t.origem[0] * casas) / W;
  const v0 = (-t.origem[1] * casas) / H;
  return ([x, y, h]) => {
    const p = padrao(ctx, img, iso(u0, v0, h), iso(u0 + casas / W, v0, h), iso(u0, v0 + casas / H, h));
    if (!p) return;
    const e = 0.012;
    poly(ctx, quad(x - e, y - e, x + 1 + e, y + 1 + e, h));
    ctx.fillStyle = p;
    ctx.fill();
  };
}

/** O resto inteiro (para o índice da variação, também nas casas negativas). */
function resto(a: number, n: number) {
  return ((Math.round(a) % n) + n) % n;
}

/** O chão em pixel art: a imagem da casa (uma das n x n variações), colada no pixel inteiro, sem suavizar. */
function pintorPisoPx(ctx: CanvasRenderingContext2D, t: TexturaPx): Pintor<[number, number, number]> {
  return ([x, y, h]) => {
    const img = t.piso.imgs[resto(x, t.n)][resto(y, t.n)];
    const [sx, sy] = iso(x, y, h);
    const suave = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(sx - t.piso.ax), Math.round(sy - t.piso.ay));
    ctx.imageSmoothingEnabled = suave;
  };
}

/** A parede em pixel art: o trecho (uma casa) colado pelo pé do começo dele; o recorte da parede corta o topo. */
function pintorParedePx(ctx: CanvasRenderingContext2D, t: TexturaPx): Pintor<WallSeg> {
  const f = ((s: WallSeg) => {
    const p = t.parede[s.wall];
    const img = p.imgs[resto(s.at, t.n)];
    const [sx, sy] = s.wall === 'l' ? iso(s.plane, s.at, s.base) : iso(s.at, s.plane, s.base);
    const suave = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(sx - p.ax), Math.round(sy - p.ay));
    ctx.imageSmoothingEnabled = suave;
  }) as Pintor<WallSeg> & { pixel?: boolean };
  f.pixel = true;
  return f;
}

/** A parede com a textura vista de frente: do chão ao topo, e a largura de uma volta pela proporção da imagem. */
function pintorParede(ctx: CanvasRenderingContext2D, map: RoomMap, img: HTMLImageElement): Pintor<WallSeg> {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const top = map.walls.top;
  return (s) => {
    const alto = top - s.base;
    const volta = ((W / H) * (alto / Z_PER_M)) / M_POR_CASA;
    const em = (a: number, z: number): Pt => (s.wall === 'l' ? iso(s.plane, a, z) : iso(a, s.plane, z));
    const p = padrao(ctx, img, em(0, top), em(volta / W, top), em(0, top - alto / H));
    if (!p) return;
    const q = wallQuad(s, s.at, s.at + 1, s.base, top);
    const xs = q.map((v) => v[0]);
    const ys = q.map((v) => v[1]);
    ctx.fillStyle = p;
    ctx.fillRect(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) - Math.min(...xs) + 2, Math.max(...ys) - Math.min(...ys) + 2);
  };
}

export function buildStatic(map: RoomMap, wantScale: number, style?: FloorStyle, terreno?: string, aberto = false): StaticLayer {
  const look = floorLook(style);
  const bd = roomBounds(map, aberto);
  const pad = 8;
  const x = Math.floor(bd.minX - pad);
  const y = Math.floor(bd.minY - pad);
  const w = Math.ceil(bd.maxX - bd.minX + pad * 2);
  const h = Math.ceil(bd.maxY - bd.minY + pad * 2);
  const scale = Math.min(wantScale, Math.sqrt(MAX_PIXELS / (w * h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  ctx.lineJoin = 'round';
  // texturas desenhadas do estilo do cômodo (chão e parede), quando já chegaram
  const tPiso = texturaPiso(style);
  const tParede = texturaParede(style);
  const tPx = texturaPx(style);
  const pintarPiso = tPx ? pintorPisoPx(ctx, tPx) : tPiso ? pintorPiso(ctx, tPiso) : undefined;
  const pintarParede = tPx ? pintorParedePx(ctx, tPx) : tParede ? pintorParede(ctx, map, tParede.img) : undefined;
  // ao ar livre, o chão de cada casa pode ser outro (terreno): o desenho e a textura de cada estilo
  const linhas = terreno ? terreno.replace(/\r/g, '').split('\n') : undefined;
  const pintores = new Map<FloorStyle, Pintor<[number, number, number]> | undefined>();
  const pisoDe = (tx: number, ty: number): [FloorLook, Pintor<[number, number, number]> | undefined] => {
    const t = terrenoEm(linhas, tx, ty);
    if (!t || t === 'agua' || t === style) return [look, pintarPiso];
    if (!pintores.has(t)) {
      const tt = texturaPiso(t);
      pintores.set(t, tt ? pintorPiso(ctx, tt) : undefined);
    }
    return [floorLook(t), pintores.get(t)];
  };

  const minH = minFloor(map);
  const door = map.door;
  const doorH = map.floorHeight(door.x, door.y);
  const vao = aberto ? null : vaoDaPorta(map);
  if (vao && doorH !== null) {
    const hole = wallQuad(vao.seg, vao.a0, vao.a1, vao.z0, vao.z1);
    poly(ctx, hole, '#050405');
    drawTile(ctx, map, door.x, door.y, doorH, true, minH);
    const [gx, gy] = iso(door.x + 0.5, door.y + 0.5, doorH + 1.2);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 60);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g;
    poly(ctx, hole);
    ctx.fill();
  }

  const segs = aberto ? [] : [...map.walls.segs].sort((a, b) => (a.wall === b.wall ? 0 : a.wall === 'r' ? -1 : 1));
  for (const s of segs) drawWallSeg(ctx, map, s, pintarParede);
  if (vao) {
    // a borda do vão, depois das paredes, embaixo da moldura da porta
    const fr = wallQuad(vao.seg, vao.a0, vao.a1, vao.z0, vao.z1 + (vao.escada ? 0 : 0.1));
    ctx.beginPath();
    if (vao.escada) {
      ctx.moveTo(fr[0][0], fr[0][1]);
      ctx.lineTo(fr[1][0], fr[1][1]);
    }
    ctx.moveTo(fr[0][0], fr[0][1]);
    ctx.lineTo(fr[3][0], fr[3][1]);
    if (!vao.escada) ctx.lineTo(fr[2][0], fr[2][1]);
    else ctx.moveTo(fr[2][0], fr[2][1]);
    ctx.lineTo(fr[1][0], fr[1][1]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b1512';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200,160,110,0.25)';
    ctx.stroke();
  }
  // cantos
  for (const s of aberto ? [] : map.walls.segs) {
    if (s.wall !== 'l') continue;
    const r = map.walls.find('r', s.at, s.plane);
    if (!r) continue;
    const top = map.walls.top;
    poly(ctx, [iso(s.plane - T, s.at - T, top), iso(s.plane, s.at - T, top), iso(s.plane, s.at, top), iso(s.plane - T, s.at, top)], WALL_TOP, WALL_TOP);
  }

  // a água primeiro: as margens (a borda das casas da frente) vêm por cima
  if (linhas)
    for (let ty = 0; ty < map.height; ty++)
      for (let tx = 0; tx < map.width; tx++) if (map.floorHeight(tx, ty) === null && terrenoEm(linhas, tx, ty) === 'agua') drawAgua(ctx, tx, ty, minH - FLOOR_THICK);

  const tiles: [number, number, number][] = [];
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const th = map.floorHeight(tx, ty);
      if (th !== null && (aberto || !map.isDoor(tx, ty))) tiles.push([tx, ty, th]);
    }
  tiles.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
  for (const [tx, ty, th] of tiles) {
    const [lk, pintor] = linhas ? pisoDe(tx, ty) : [look, pintarPiso];
    drawTile(ctx, map, tx, ty, th, false, minH, lk, pintor);
    drawLedges(ctx, map, tx, ty, th);
  }

  return { canvas, x, y, w, h };
}
