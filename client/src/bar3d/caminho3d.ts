/**
 * O caminho dos agentes no protótipo 3D: o A* do jogo (`findPath`, de @crona/shared) sobre o mesmo mapa de casas (`RoomMap`:
 * móveis ocupando a pegada, cadeira que só vale de destino, mesa vazada, degraus), em 8 direções como no tabuleiro, e as
 * curvas arredondadas só nos cantos (o caminho continua passando pelas mesmas casas, só não vira em ângulo seco).
 */
import { findPath, type Point, type RoomMap } from '@crona/shared';
import { CASA, casaDe, centroDa } from './dados';

/** quantas casas por segundo o agente anda (~1,2 m/s, passo de gente) */
export const CASAS_POR_SEGUNDO = 1.6;
/** o raio do arredondamento dos cantos, em metros (menos que meia casa: a curva não sai das casas do caminho) */
const RAIO_CANTO = 0.3;

/** Uma trilha pronta para andar: os pontos do chão (x, z em metros), a distância acumulada e o total. */
export interface Trilha {
  pts: { x: number; z: number }[];
  acum: number[];
  total: number;
  /** as casas do jogo por onde ela passa (para o destino e o pontilhado) */
  casas: Point[];
}

const chave = (x: number, y: number) => `${x},${y}`;

/** O caminho de casa em casa (sem a de saída), evitando as casas em `ocupadas`; null se não dá para chegar. */
export function acharCaminho(mapa: RoomMap, de: Point, para: Point, ocupadas: Set<string>, dirInicial?: number): Point[] | null {
  return findPath(mapa, de, para, (x, y) => ocupadas.has(chave(x, y)), dirInicial);
}

/** Casas livres para ficar ao lado de uma pegada (o contorno dela, a 1 casa), das mais perto de `de` para as mais longe. */
export function casasAoRedor(mapa: RoomMap, pegada: Point[], de: Point, ocupadas: Set<string>): Point[] {
  const dentro = new Set(pegada.map((c) => chave(c.x, c.y)));
  const achadas = new Map<string, Point>();
  for (const c of pegada)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: c.x + dx, y: c.y + dy };
        const k = chave(p.x, p.y);
        if (dentro.has(k) || ocupadas.has(k) || achadas.has(k)) continue;
        if (mapa.walkState(p.x, p.y) !== 'walk') continue;
        achadas.set(k, p);
      }
  return [...achadas.values()].sort((a, b) => Math.hypot(a.x - de.x, a.y - de.y) - Math.hypot(b.x - de.x, b.y - de.y));
}

/** Do melhor dos destinos possíveis: o caminho mais curto até algum deles. */
export function melhorCaminho(mapa: RoomMap, de: Point, destinos: Point[], ocupadas: Set<string>, dirInicial?: number): { cam: Point[]; destino: Point } | null {
  let melhor: { cam: Point[]; destino: Point } | null = null;
  // só os primeiros candidatos (os mais perto em linha reta) para não buscar demais
  for (const d of destinos.slice(0, 8)) {
    const cam = acharCaminho(mapa, de, d, ocupadas, dirInicial);
    if (cam && (!melhor || cam.length < melhor.cam.length)) melhor = { cam, destino: d };
  }
  return melhor;
}

/** Uma curva (Bézier quadrática) amostrada entre A e B passando perto de P. */
function curva(a: { x: number; z: number }, p: { x: number; z: number }, b: { x: number; z: number }, n = 6) {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * p.x + t * t * b.x, z: u * u * a.z + 2 * u * t * p.z + t * t * b.z });
  }
  return out;
}

/** Faz a trilha de andar: o ponto onde o agente está, o centro de cada casa do caminho e os cantos arredondados. */
export function trilhaDoCaminho(inicio: { x: number; z: number }, cam: Point[]): Trilha {
  const base: { x: number; z: number }[] = [{ x: inicio.x, z: inicio.z }];
  for (const c of cam) {
    const m = centroDa(c.x, c.y);
    const ult = base[base.length - 1];
    // o primeiro passo curtíssimo (já está quase no centro da casa) não vira um solavanco
    if (Math.hypot(m.x - ult.x, m.z - ult.z) < 0.02) continue;
    base.push({ x: m.x, z: m.z });
  }
  const pts: { x: number; z: number }[] = [base[0]];
  for (let i = 1; i < base.length; i++) {
    const p = base[i];
    const ant = base[i - 1];
    const prox = base[i + 1];
    if (!prox) {
      pts.push(p);
      continue;
    }
    const v1 = { x: p.x - ant.x, z: p.z - ant.z };
    const v2 = { x: prox.x - p.x, z: prox.z - p.z };
    const l1 = Math.hypot(v1.x, v1.z);
    const l2 = Math.hypot(v2.x, v2.z);
    const cruz = v1.x * v2.z - v1.z * v2.x;
    if (!l1 || !l2 || Math.abs(cruz) < 1e-4) {
      pts.push(p);
      continue;
    }
    const r = Math.min(RAIO_CANTO, l1 / 2, l2 / 2);
    const a = { x: p.x - (v1.x / l1) * r, z: p.z - (v1.z / l1) * r };
    const b = { x: p.x + (v2.x / l2) * r, z: p.z + (v2.z / l2) * r };
    for (const q of curva(a, p, b)) pts.push(q);
  }
  const acum: number[] = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, acum, total: acum[acum.length - 1], casas: cam };
}

/** O ponto da trilha na distância `d` (em metros) e a direção em que ela vai ali. */
export function pontoDaTrilha(t: Trilha, d: number): { x: number; z: number; dx: number; dz: number } {
  const n = t.pts.length;
  if (n === 1) return { x: t.pts[0].x, z: t.pts[0].z, dx: 0, dz: 0 };
  const dd = Math.max(0, Math.min(t.total, d));
  let i = 1;
  while (i < n - 1 && t.acum[i] < dd) i++;
  const a = t.pts[i - 1];
  const b = t.pts[i];
  const seg = t.acum[i] - t.acum[i - 1] || 1;
  const k = (dd - t.acum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg };
}

/** O agente (x, z em metros) anda para este lado sem bater em nada? Testa os quatro cantos de um corpo de 0,2 m de raio. */
export function livreEm(mapa: RoomMap, x: number, z: number, raio = 0.2): boolean {
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const c = casaDe(x + sx * raio, z + sz * raio);
    if (mapa.floorHeight(c.x, c.y) === null) return false;
    // a casa da cadeira só vale de destino; sentar é uma ação
    if (mapa.walkState(c.x, c.y) !== 'walk') return false;
  }
  return true;
}

export { CASA, casaDe, centroDa };
