import { MAX_STEP_DOWN, MAX_STEP_UP } from './constants';
import type { Point, RoomMap } from './room';

/** Direções: 0=N(-y) 1=NE 2=E(+x) 3=SE 4=S(+y) 5=SW 6=W(-x) 7=NW */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

export function directionTo(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return 2;
  const d = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return (((2 + d) % 8) + 8) % 8;
}

class MinHeap {
  private f: number[] = [];
  private v: number[] = [];
  get size() {
    return this.v.length;
  }
  push(value: number, prio: number) {
    const f = this.f;
    const v = this.v;
    let i = v.length;
    f.push(prio);
    v.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[p] <= f[i]) break;
      [f[p], f[i]] = [f[i], f[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const f = this.f;
    const v = this.v;
    const top = v[0];
    const lf = f.pop()!;
    const lv = v.pop()!;
    if (v.length) {
      f[0] = lf;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < v.length && f[l] < f[m]) m = l;
        if (r < v.length && f[r] < f[m]) m = r;
        if (m === i) break;
        [f[m], f[i]] = [f[i], f[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* em 8 direções. Retorna o caminho sem o ponto inicial, ou null.
 * `blocked(x,y)` indica ocupação dinâmica (outros avatares).
 *
 * Entre caminhos do mesmo tamanho, fica o que vira menos vezes (12/10): antes o desempate era ao
 * acaso, e a peça ia em zigue-zague (reto, diagonal, diagonal, reto), virando o corpo a cada casa.
 * Por isso o estado é a casa e a direção em que se chegou nela; `dirInicial` é a direção em que a
 * peça já vinha andando (o caminho é refeito a cada passo, e ela segue a mesma linha).
 */
export function findPath(map: RoomMap, start: Point, goal: Point, blocked: (x: number, y: number) => boolean, dirInicial?: number): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const goalState = map.walkState(goal.x, goal.y);
  if (goalState === 'blocked' || blocked(goal.x, goal.y)) return null;

  const W = map.width;
  const H = map.height;
  // estado: casa * 9 + direção da chegada (8 = nenhuma, o começo)
  const N = W * H * 9;
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap();
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  /** virar custa um tiquinho: só desempata caminhos do mesmo tamanho */
  const VIRAR = 0.001;
  const sd = dirInicial !== undefined && dirInicial >= 0 && dirInicial < 8 ? dirInicial : 8;
  const si = (start.y * W + start.x) * 9 + sd;
  const gc = goal.y * W + goal.x;
  g[si] = 0;
  heap.push(si, heur(start.x, start.y));
  // a casa de cada passo (e a de cima dela é o começo): o terreno não muda com a direção
  const zDe = new Float64Array(W * H).fill(NaN);
  const altura = (x: number, y: number) => {
    const i = y * W + x;
    if (Number.isNaN(zDe[i])) zDe[i] = map.standHeight(x, y);
    return zDe[i];
  };

  while (heap.size) {
    const si2 = heap.pop();
    if (closed[si2]) continue;
    closed[si2] = 1;
    const ci = Math.floor(si2 / 9);
    const cd = si2 % 9;
    if (ci === gc) {
      const path: Point[] = [];
      let i = si2;
      while (i !== si && i !== -1) {
        const c = Math.floor(i / 9);
        path.push({ x: c % W, y: Math.floor(c / W) });
        i = came[i];
      }
      return path.reverse();
    }
    const cx = ci % W;
    const cy = Math.floor(ci / W);
    const cz = altura(cx, cy);
    for (let d = 0; d < 8; d++) {
      const [dx, dy] = DIRS[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = (ny * W + nx) * 9 + d;
      if (closed[ni]) continue;
      const isGoal = ny * W + nx === gc;
      const st = map.walkState(nx, ny);
      if (st === 'blocked') continue;
      if (st === 'sit' && !isGoal) continue;
      if (!isGoal && blocked(nx, ny)) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && (map.walkState(cx + dx, cy) === 'blocked' || map.walkState(cx, cy + dy) === 'blocked')) continue;
      const nz = altura(nx, ny);
      if (nz - cz > MAX_STEP_UP || cz - nz > MAX_STEP_DOWN) continue;
      // passar por baixo da mesa (abaixado) custa mais: só quando é o caminho que sobra
      const cost = g[si2] + (diag ? Math.SQRT2 : 1) + (map.sobMesa(nx, ny) && !isGoal ? 2.5 : 0) + (cd !== 8 && cd !== d ? VIRAR : 0);
      if (cost < g[ni]) {
        g[ni] = cost;
        came[ni] = si2;
        heap.push(ni, cost + heur(nx, ny));
      }
    }
  }
  return null;
}
