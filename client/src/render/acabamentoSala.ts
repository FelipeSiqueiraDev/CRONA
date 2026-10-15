import type { RoomMap, WallSeg } from '@crona/shared';
import { hash } from './color';
import { iso, unIso } from './iso';

/**
 * O acabamento da sala, em pixel (15/10, o Felipe mostrou duas cenas de referência e pediu "aquilo que deixa elas
 * muito bonitas"): a sala de jogo estava limpa e lisa demais. O que as referências têm e a nossa não tinha:
 *  - o chão gasto: sujeira em manchas, rachaduras, lascas, pedrinhas e papéis, nunca um padrão limpo repetido;
 *  - a sombra de encontro (oclusão): escurece onde a parede encontra o chão e onde a parede encontra o teto;
 *  - a parede com história: umidade escorrendo de cima, mofo embaixo, sujeira de pó, nunca uma cor chapada;
 *  - a borda do piso com corpo: a laje em fiadas de pedra, com o fio de luz em cima e o escuro embaixo, como um diorama;
 *  - a sombra fria: todo o escurecimento puxa para o azul-violeta (a luz quente fica por cima, o contraste de cores).
 * Tudo é desenhado pixel a pixel (1 pixel do mundo = 1 pixel da arte) e determinístico: a mesma sala sai sempre igual.
 */

type Tile = [number, number, number];

export interface VaoDePorta {
  seg: WallSeg;
  a0: number;
  a1: number;
  z0: number;
  z1: number;
}

/** O escuro frio (azul-violeta) que sombreia tudo. */
const FRIO = '10,8,22';

/** Ruído de valor suave, de 0 a 1 (uma semente por "camada"). */
function ruido(u: number, v: number, semente: number) {
  const x = Math.floor(u);
  const y = Math.floor(v);
  const fx = u - x;
  const fy = v - y;
  const a = hash(x, y, semente);
  const b = hash(x + 1, y, semente);
  const c = hash(x, y + 1, semente);
  const d = hash(x + 1, y + 1, semente);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Pinta um pixel com a opacidade em degraus de 5% (arte em pixel: faixas, não gradiente). */
function pinta(ctx: CanvasRenderingContext2D, x: number, y: number, rgb: string, alfa: number) {
  const a = Math.round(alfa * 20) / 20;
  if (a < 0.05) return;
  ctx.fillStyle = `rgba(${rgb},${a})`;
  ctx.fillRect(x, y, 1, 1);
}

const limita = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** O chão gasto: encontro com a parede, sujeira, lascas, rachaduras e pedrinhas. Só dentro de cômodo fechado. */
export function acabarPiso(ctx: CanvasRenderingContext2D, map: RoomMap, tiles: Tile[]) {
  for (const [x, y, h] of tiles) {
    const costasX = map.floorHeight(x - 1, y) === null;
    const costasY = map.floorHeight(x, y - 1) === null;
    const sx0 = Math.floor((x - (y + 1)) * 32);
    const sx1 = Math.ceil((x + 1 - y) * 32);
    const sy0 = Math.floor((x + y) * 16 - h * 32);
    const sy1 = Math.ceil((x + y + 2) * 16 - h * 32);
    for (let py = sy0; py < sy1; py++)
      for (let px = sx0; px < sx1; px++) {
        const [u, v] = unIso(px + 0.5, py + 0.5, h);
        if (u < x || u >= x + 1 || v < y || v >= y + 1) continue;
        // a sombra de encontro: perto da parede de trás (a quina do chão com a parede)
        const dw = Math.min(costasX ? u - x : 9, costasY ? v - y : 9);
        const ao = dw < 0.6 ? 0.36 * (1 - dw / 0.6) ** 2 : 0;
        // a sujeira em manchas (duas escalas), mais forte junto das paredes
        const n = ruido(u * 1.3, v * 1.3, 11) * 0.65 + ruido(u * 4.1, v * 4.1, 12) * 0.35;
        const suja = limita((n - 0.52) / 0.28) * (0.18 + (dw < 1.2 ? 0.1 * (1 - dw / 1.2) : 0));
        let a = 1 - (1 - ao) * (1 - suja);
        let rgb = FRIO;
        // as lascas: pontinhos escuros e claros espalhados
        const r = hash(px, py, 3);
        if (r < 0.01) a = Math.max(a, 0.3);
        else if (r > 0.992) {
          a = 0.1;
          rgb = '255,240,215';
        }
        pinta(ctx, px, py, rgb, a);
      }

    // a rachadura: um caminho torto de 1 pixel, com o fio de luz embaixo
    if (hash(x, y, 21) < 0.07) {
      let u = x + 0.2 + 0.6 * hash(x, y, 22);
      let v = y + 0.2 + 0.6 * hash(x, y, 23);
      let ang = hash(x, y, 24) * Math.PI * 2;
      for (let i = 0; i < 11; i++) {
        const [cx, cy] = iso(u, v, h);
        const px = Math.floor(cx);
        const py = Math.floor(cy);
        pinta(ctx, px, py, '5,4,10', 0.55);
        pinta(ctx, px, py + 1, '255,235,200', 0.08);
        ang += (hash(x, y, 25 + i) - 0.5) * 1.4;
        u += Math.cos(ang) * 0.07;
        v += Math.sin(ang) * 0.07;
        if (u < x + 0.05 || u > x + 0.95 || v < y + 0.05 || v > y + 0.95) break;
      }
    }

    // as pedrinhas e os papéis soltos: três pixels com sombra
    if (hash(x, y, 31) < 0.1) {
      const u = x + 0.15 + 0.7 * hash(x, y, 32);
      const v = y + 0.15 + 0.7 * hash(x, y, 33);
      const [cx, cy] = iso(u, v, h);
      const px = Math.floor(cx);
      const py = Math.floor(cy);
      const papel = hash(x, y, 34) < 0.35;
      pinta(ctx, px + 1, py + 1, FRIO, 0.4);
      pinta(ctx, px + 2, py + 1, FRIO, 0.3);
      pinta(ctx, px, py, papel ? '176,166,138' : '92,86,80', 1);
      pinta(ctx, px + 1, py, papel ? '196,186,156' : '124,116,106', 1);
      if (papel) pinta(ctx, px + 2, py, '176,166,138', 1);
    }
  }
}

/** A borda do piso com corpo: a laje em fiadas de pedra, o fio de luz em cima e o escuro embaixo. */
export function acabarBordas(ctx: CanvasRenderingContext2D, map: RoomMap, tiles: Tile[], minH: number, espessura: number) {
  const baixo = minH - espessura;
  for (const [x, y, h] of tiles) {
    const faces: ('x' | 'y')[] = [];
    if (map.floorHeight(x + 1, y) === null) faces.push('x');
    if (map.floorHeight(x, y + 1) === null) faces.push('y');
    for (const f of faces) {
      const R = Math.round((h - baixo) * 32);
      for (let c = 0; c < 32; c++) {
        const t = (c + 0.5) / 32;
        // a face de x fica em x+1 (v anda com a coluna); a de y fica em y+1 (u anda com a coluna)
        const [sx, sy] = f === 'x' ? iso(x + 1, y + t, h) : iso(x + t, y + 1, h);
        const px = Math.floor(sx);
        const topo = Math.floor(sy);
        for (let r = 0; r < R; r++) {
          const py = topo + r;
          if (r === 0) {
            pinta(ctx, px, py, '255,238,210', f === 'y' ? 0.32 : 0.2);
            continue;
          }
          if (r === 1) pinta(ctx, px, py, '255,238,210', 0.1);
          // as fiadas: blocos de 16 x 8 px, cada fiada deslocada meio bloco, cada bloco com o seu tom (mais claro ou
          // mais escuro), a junta de 1 px escura e um fio de luz no alto de cada bloco
          const fiada = r >> 3;
          const bloco = Math.floor((c + (fiada & 1) * 8) / 16);
          const tom = hash(bloco, fiada, x * 3 + (f === 'x' ? 1 : 2), y);
          const junta = r % 8 === 7 || (c + (fiada & 1) * 8) % 16 === 15;
          if (junta) pinta(ctx, px, py, '4,3,12', 0.5);
          else {
            if (tom > 0.55) pinta(ctx, px, py, '255,238,210', (tom - 0.55) * 0.3);
            else pinta(ctx, px, py, '4,3,12', (0.55 - tom) * 0.3);
            if (r % 8 === 0) pinta(ctx, px, py, '255,238,210', 0.1);
          }
          // o escuro frio embaixo
          const rr = r / R;
          pinta(ctx, px, py, FRIO, 0.45 * rr * rr);
          // e o desgaste da pedra
          const q = hash(c, r, x, y);
          if (q < 0.06) pinta(ctx, px, py, '0,0,0', 0.2);
          else if (q > 0.975) pinta(ctx, px, py, '255,238,210', 0.07);
        }
      }
    }
  }
}

/**
 * A parede com história: sombra no encontro com o chão e com o teto, umidade escorrendo de cima, mofo embaixo e pó.
 * Pula o vão da porta (que é aberto).
 */
export function acabarParedes(ctx: CanvasRenderingContext2D, map: RoomMap, vao: VaoDePorta | null) {
  const top = map.walls.top;
  for (const s of map.walls.segs) {
    const lado = s.wall === 'l' ? 1 : 2;
    const Z = Math.round((top - s.base) * 32);
    for (let c = 0; c < 32; c++) {
      const a = s.at + (c + 0.5) / 32;
      const [sx] = s.wall === 'l' ? iso(s.plane, a, s.base) : iso(a, s.plane, s.base);
      const px = Math.floor(sx);
      // a umidade: faixas verticais de comprimento variado, que escorrem do teto
      const faixa = ruido(a * 7, 3, s.plane * 3 + lado);
      const comp = 0.4 + 1.2 * ruido(a * 3, 9, s.plane + lado);
      for (let r = 0; r < Z; r++) {
        const z = s.base + (r + 0.5) / 32;
        if (vao && s.wall === vao.seg.wall && s.plane === vao.seg.plane && a >= vao.a0 && a <= vao.a1 && z >= vao.z0 && z <= vao.z1) continue;
        const [, sy] = s.wall === 'l' ? iso(s.plane, a, z) : iso(a, s.plane, z);
        const py = Math.floor(sy);
        const zr = z - s.base;
        const noTeto = top - z;
        // o encontro com o chão e com o teto
        const ao = zr < 0.7 ? 0.3 * (1 - zr / 0.7) ** 1.6 : 0;
        const aoTeto = noTeto < 0.25 ? 0.1 * (1 - noTeto / 0.25) : 0;
        let a2 = 1 - (1 - ao) * (1 - aoTeto);
        let rgb = FRIO;
        // a umidade escorrendo do teto
        if (faixa > 0.66 && noTeto < comp) a2 = Math.max(a2, 0.12 * (0.4 + 0.6 * (1 - noTeto / comp)));
        // o mofo embaixo, em manchas
        else if (zr < 1.2 && ruido(a * 2.2, zr * 2.2, s.plane + lado * 5) > 0.7) {
          a2 = Math.max(a2, 0.12);
          rgb = '8,16,12';
        }
        // o pó: pontinhos
        if (hash(c, r, s.plane, s.at + lado) < 0.006) a2 = Math.max(a2, 0.2);
        pinta(ctx, px, py, rgb, a2);
      }
    }
  }
}
