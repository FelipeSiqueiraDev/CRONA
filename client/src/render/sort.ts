import type { WBox } from './caixa';

export interface Drawable {
  box: WBox;
  /** retângulo na tela (coordenadas de mundo) para achar sobreposições */
  sx0: number;
  sx1: number;
  sy0: number;
  sy1: number;
  /** silhueta convexa na tela (opcional, deixa a ordenação exata) */
  poly?: [number, number][];
  draw(): void;
  depth?: number;
  /** está embaixo de uma mesa (a cadeira encaixada, a peça escondida): vem antes da caixa que o cobre */
  sob?: boolean;
}

/** O meio da caixa p fica dentro da caixa q, vista de cima. */
function dentro(p: WBox, q: WBox) {
  const cx = (p.x0 + p.x1) / 2;
  const cy = (p.y0 + p.y1) / 2;
  return cx > q.x0 + EPS && cx < q.x1 - EPS && cy > q.y0 + EPS && cy < q.y1 - EPS;
}

const EPS = 1e-3;

/** -1: a atrás de b. Caixas que não se interceptam sempre têm um eixo separador. */
export function cmp(a: WBox, b: WBox): number {
  if (a.x1 <= b.x0 + EPS) return -1;
  if (b.x1 <= a.x0 + EPS) return 1;
  if (a.y1 <= b.y0 + EPS) return -1;
  if (b.y1 <= a.y0 + EPS) return 1;
  if (a.z1 <= b.z0 + EPS) return -1;
  if (b.z1 <= a.z0 + EPS) return 1;
  const da = a.x0 + a.x1 + a.y0 + a.y1;
  const db = b.x0 + b.x1 + b.y0 + b.y1;
  if (Math.abs(da - db) > EPS) return da < db ? -1 : 1;
  return a.z0 <= b.z0 ? -1 : 1;
}

/** Teste de eixo separador entre dois polígonos convexos. */
function polysOverlap(p: [number, number][], q: [number, number][]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y1 - y2;
      const ny = x2 - x1;
      if (!nx && !ny) continue;
      let minP = Infinity;
      let maxP = -Infinity;
      for (const [x, y] of p) {
        const d = x * nx + y * ny;
        if (d < minP) minP = d;
        if (d > maxP) maxP = d;
      }
      let minQ = Infinity;
      let maxQ = -Infinity;
      for (const [x, y] of q) {
        const d = x * nx + y * ny;
        if (d < minQ) minQ = d;
        if (d > maxQ) maxQ = d;
      }
      const tol = Math.hypot(nx, ny) * 0.5;
      if (maxP <= minQ + tol || maxQ <= minP + tol) return false;
    }
  }
  return true;
}

/**
 * Ordenação topológica (pintor) só entre objetos que realmente se sobrepõem na tela. Os pares vêm por uma varredura
 * no eixo x da tela (23/10, o pente-fino de desempenho: antes, cada objeto contra todos os outros a cada quadro, e o
 * jardim da mansão tem mais de cem árvores): ordenados pela borda esquerda, cada um só encontra os que começam antes
 * de ele acabar.
 */
export function sortDrawables(list: Drawable[]): Drawable[] {
  const n = list.length;
  for (const d of list) d.depth = (d.box.x0 + d.box.x1 + d.box.y0 + d.box.y1) / 2 + d.box.z0 * 0.001;
  const out: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Int32Array(n);
  const porX = Array.from({ length: n }, (_, k) => k).sort((p, q) => list[p].sx0 - list[q].sx0);
  for (let u = 0; u < n; u++) {
    for (let v = u + 1; v < n; v++) {
      // o par na ordem original (o desempate do cmp fica o mesmo de antes)
      const pu = porX[u];
      const pv = porX[v];
      if (list[pv].sx0 >= list[pu].sx1) break;
      const i = pu < pv ? pu : pv;
      const j = pu < pv ? pv : pu;
      const a = list[i];
      const b = list[j];
      if (a.sx1 <= b.sx0 || b.sx1 <= a.sx0 || a.sy1 <= b.sy0 || b.sy1 <= a.sy0) continue;
      if (a.poly && b.poly && !polysOverlap(a.poly, b.poly)) continue;
      // embaixo da mesa: a mesa cobre quem está embaixo, e o que está acima do tampo vem depois dele
      // também (senão a caneca na mesa, a mesa e a cadeira encaixada fecham um círculo)
      const cobre = (s: Drawable, o: Drawable) => dentro(s.box, o.box) || o.box.z0 >= s.box.z1 - EPS;
      const sob = a.sob && !b.sob && cobre(a, b) ? -1 : b.sob && !a.sob && cobre(b, a) ? 1 : 0;
      if (sob ? sob < 0 : cmp(a.box, b.box) < 0) {
        out[i].push(j);
        indeg[j]++;
      } else {
        out[j].push(i);
        indeg[i]++;
      }
    }
  }
  const done = new Uint8Array(n);
  // os prontos numa fila de prioridade pela profundidade (o mais ao fundo primeiro)
  const ready: number[] = [];
  const menor = (x: number, y: number) => list[ready[x]].depth! < list[ready[y]].depth!;
  const push = (v: number) => {
    ready.push(v);
    let k = ready.length - 1;
    while (k > 0) {
      const pai = (k - 1) >> 1;
      if (!menor(k, pai)) break;
      [ready[k], ready[pai]] = [ready[pai], ready[k]];
      k = pai;
    }
  };
  const popMin = () => {
    const v = ready[0];
    const fim = ready.pop()!;
    if (ready.length) {
      ready[0] = fim;
      let k = 0;
      for (;;) {
        const e = 2 * k + 1;
        const d = e + 1;
        let m = k;
        if (e < ready.length && menor(e, m)) m = e;
        if (d < ready.length && menor(d, m)) m = d;
        if (m === k) break;
        [ready[k], ready[m]] = [ready[m], ready[k]];
        k = m;
      }
    }
    return v;
  };
  for (let i = 0; i < n; i++) if (!indeg[i]) push(i);
  const result: Drawable[] = [];
  while (result.length < n) {
    let i: number;
    if (ready.length) i = popMin();
    else {
      // ciclo: libera quem tem menos dependências pendentes (e está mais ao fundo)
      i = -1;
      for (let k = 0; k < n; k++) {
        if (done[k]) continue;
        if (i < 0 || indeg[k] < indeg[i] || (indeg[k] === indeg[i] && list[k].depth! < list[i].depth!)) i = k;
      }
    }
    if (done[i]) continue;
    done[i] = 1;
    result.push(list[i]);
    for (const j of out[i]) if (--indeg[j] === 0 && !done[j]) push(j);
  }
  return result;
}
