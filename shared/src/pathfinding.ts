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
 */
export function findPath(map: RoomMap, start: Point, goal: Point, blocked: (x: number, y: number) => boolean): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const goalState = map.walkState(goal.x, goal.y);
  if (goalState === 'blocked' || blocked(goal.x, goal.y)) return null;

  const W = map.width;
  const H = map.height;
  const N = W * H;
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap();
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const si = start.y * W + start.x;
  const gi = goal.y * W + goal.x;
  g[si] = 0;
  heap.push(si, heur(start.x, start.y));

  while (heap.size) {
    const ci = heap.pop();
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (ci === gi) {
      const path: Point[] = [];
      let i = ci;
      while (i !== si && i !== -1) {
        path.push({ x: i % W, y: Math.floor(i / W) });
        i = came[i];
      }
      return path.reverse();
    }
    const cx = ci % W;
    const cy = Math.floor(ci / W);
    const cz = map.standHeight(cx, cy);
    for (let d = 0; d < 8; d++) {
      const [dx, dy] = DIRS[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const isGoal = ni === gi;
      const st = map.walkState(nx, ny);
      if (st === 'blocked') continue;
      if (st === 'sit' && !isGoal) continue;
      if (!isGoal && blocked(nx, ny)) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && (map.walkState(cx + dx, cy) === 'blocked' || map.walkState(cx, cy + dy) === 'blocked')) continue;
      const nz = map.standHeight(nx, ny);
      if (nz - cz > MAX_STEP_UP || cz - nz > MAX_STEP_DOWN) continue;
      // passar por baixo da mesa (abaixado) custa mais: só quando é o caminho que sobra
      const cost = g[ci] + (diag ? Math.SQRT2 : 1) + (map.sobMesa(nx, ny) && !isGoal ? 2.5 : 0);
      if (cost < g[ni]) {
        g[ni] = cost;
        came[ni] = ci;
        heap.push(ni, cost + heur(nx, ny));
      }
    }
  }
  return null;
}
