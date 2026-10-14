import { Z_PER_M, type RoomMap } from '@crona/shared';
import { rng } from './color';
import { iso } from './iso';

interface Puff {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  phase: number;
  low: boolean;
}

let sprite: HTMLCanvasElement | null = null;
function puffSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(168,178,168,1)');
  g.addColorStop(0.45, 'rgba(150,160,152,0.55)');
  g.addColorStop(1, 'rgba(140,150,145,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  sprite = c;
  return c;
}

/** O raio (em casas) do banco de neblina da peça "neblina_densa" na escala 1. */
const RAIO_NEBLINA = 4;
/** até onde a neblina sobe (unidades de altura: 1,9 m, um pouco abaixo da sebe de 2,4 m: o topo dela aparece) */
const ALTO_NEBLINA = 1.9 * Z_PER_M;

/** Um tufo de neblina dentro de uma casa: o lugar na casa (u, v), a altura (0..1 da coluna), o tamanho. */
interface Tufo {
  u: number;
  v: number;
  z: number;
  r: number;
  a: number;
  phase: number;
}

/**
 * Uma casa de neblina densa (a peça "neblina_densa", 14/10: o miolo do Labirinto de Santo Berço). A neblina é
 * desenhada casa a casa, ordenada junto com os móveis: a sebe da frente tapa a neblina de trás, e ela enche os
 * corredores sem passar por cima das paredes nem vazar para fora.
 */
export interface CasaNeblina {
  x: number;
  y: number;
  h: number;
  /** 0 no meio do banco, 1 na beira: na beira a neblina é mais rala */
  beira: number;
  tufos: Tufo[];
}

/**
 * Névoa: nuvens suaves que derivam sobre o piso, recortadas pelo volume do
 * quarto. É desenhada antes da luz, então brilha perto das fontes de luz.
 * A neblina densa (CasaNeblina) é outra coisa: desenhada casa a casa junto com os móveis, com a cena com névoa ou não.
 */
export class Fog {
  private puffs: Puff[] = [];
  /** as casas de neblina densa da cena */
  casas: CasaNeblina[] = [];
  private clip: Path2D | null = null;
  private bounds = { x0: 0, x1: 1, y0: 0, y1: 1 };
  private last = 0;

  /** as casas de neblina das peças "neblina_densa" da cena (de novo quando o mestre põe, move ou tira uma) */
  montarBancos(map: RoomMap) {
    this.casas = [];
    const vistas = new Set<string>();
    for (const it of map.allItems()) {
      if (it.defId !== 'neblina_densa') continue;
      const raio = RAIO_NEBLINA * (it.escala ?? 1);
      const r = rng(it.id * 7 + 3);
      for (let y = Math.floor(it.y - raio); y <= Math.ceil(it.y + raio); y++)
        for (let x = Math.floor(it.x - raio); x <= Math.ceil(it.x + raio); x++) {
          const d = Math.hypot(x - it.x, y - it.y) / raio;
          // só no chão livre (as casas da sebe ficam de fora: a neblina corre entre as paredes)
          if (d > 1 || vistas.has(`${x},${y}`) || map.walkState(x, y) === 'blocked') continue;
          const h = map.floorHeight(x, y);
          if (h === null) continue;
          vistas.add(`${x},${y}`);
          const tufos: Tufo[] = [];
          // mais tufos quanto mais perto do meio: no miolo a neblina é BEM densa (o Felipe, 14/10)
          const n = 3 + Math.round((1 - d) * 5);
          for (let k = 0; k < n; k++) tufos.push({ u: 0.1 + r() * 0.8, v: 0.1 + r() * 0.8, z: k / n + r() * 0.2, r: 26 + r() * 20 + (1 - d) * 10, a: 0.75 + r() * 0.25, phase: r() * 10 });
          this.casas.push({ x, y, h, beira: d, tufos });
        }
    }
  }

  /** A caixa da coluna de neblina da casa (para ordenar com os móveis). */
  caixaDaCasa(c: CasaNeblina) {
    return { x0: c.x, x1: c.x + 1, y0: c.y, y1: c.y + 1, z0: c.h, z1: c.h + ALTO_NEBLINA };
  }

  /** Os tufos de uma casa: sobem e descem devagar e balançam, mais ralos na beira do banco. */
  drawCasa(ctx: CanvasRenderingContext2D, c: CasaNeblina, now: number) {
    const s = puffSprite();
    const rala = c.beira > 0.75 ? 1 - (c.beira - 0.75) / 0.25 : 1;
    for (const t of c.tufos) {
      const ondula = Math.sin(now / 2400 + t.phase);
      const [px, py] = iso(c.x + t.u + 0.12 * ondula, c.y + t.v - 0.08 * ondula, c.h + t.z * ALTO_NEBLINA);
      ctx.globalAlpha = Math.min(1, t.a * (0.85 + 0.15 * Math.sin(now / 1900 + t.phase * 2)) * (0.25 + 0.75 * rala) * (0.75 + 0.5 * (1 - c.beira)));
      const w = t.r * 2.6;
      const hh = t.r * 1.5;
      ctx.drawImage(s, px - w / 2, py - hh / 2, w, hh);
    }
    ctx.globalAlpha = 1;
  }

  setMap(map: RoomMap) {
    this.montarBancos(map);
    const tiles: [number, number, number][] = [];
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const h = map.floorHeight(x, y);
        if (h !== null && !map.isDoor(x, y)) tiles.push([x, y, h]);
      }
    const clip = new Path2D();
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y, h] of tiles) {
      const top = h + 2.6;
      const pts = [iso(x, y, top), iso(x + 1, y, top), iso(x + 1, y, h), iso(x + 1, y + 1, h), iso(x, y + 1, h), iso(x, y + 1, top)];
      clip.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) clip.lineTo(p[0], p[1]);
      clip.closePath();
      for (const [px, py] of pts) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
    this.clip = clip;
    this.bounds = { x0, x1, y0, y1 };
    const r = rng(tiles.length * 31 + map.width);
    this.puffs = [];
    const n = Math.min(90, 18 + tiles.length / 3);
    for (let i = 0; i < n; i++) {
      const [tx, ty, th] = tiles[Math.floor(r() * tiles.length)] ?? [0, 0, 0];
      const [px, py] = iso(tx + r(), ty + r(), th);
      const low = r() < 0.6;
      this.puffs.push({
        x: px,
        y: py - (low ? r() * 10 : 20 + r() * 50),
        r: low ? 50 + r() * 60 : 40 + r() * 50,
        vx: (r() < 0.5 ? -1 : 1) * (4 + r() * 9),
        vy: (r() - 0.5) * 2,
        a: 0.5 + r() * 0.5,
        phase: r() * 10,
        low,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, density: number, now: number) {
    if (!this.clip) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (density <= 0.01) return;
    const b = this.bounds;
    const s = puffSprite();
    ctx.save();
    ctx.clip(this.clip);
    for (const p of this.puffs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < b.x0 - p.r) p.x = b.x1 + p.r;
      if (p.x > b.x1 + p.r) p.x = b.x0 - p.r;
      if (p.y < b.y0) p.vy = Math.abs(p.vy);
      if (p.y > b.y1) p.vy = -Math.abs(p.vy);
      const breathe = 0.75 + 0.25 * Math.sin(now / 2300 + p.phase);
      ctx.globalAlpha = Math.min(0.5, density * (p.low ? 0.32 : 0.18) * p.a * breathe);
      const w = p.r * 2.2;
      const h = p.low ? p.r * 0.7 : p.r * 1.3;
      ctx.drawImage(s, p.x - w / 2, p.y - h / 2, w, h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
