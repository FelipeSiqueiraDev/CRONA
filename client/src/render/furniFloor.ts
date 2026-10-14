import { M_POR_CASA, Z_PER_M, type FurniDef } from '@crona/shared';
import { hash, rgba, rng, shade } from './color';
import { OUTLINE, type LBox, type LFace, type Painter } from './painter';
import { B, BATENTE_PORTA_M, crateFace, drawers, faceRange, lightIf, N, naParede, PAPER, V, VAO_PORTA_M, vents, wallBlock, WARM, type Builder, type FNode, type FVisual, type LightDef } from './furniKit';
import { SEDE_BUILDERS } from './furniSede';
import { VILA_BUILDERS } from './furniVila';
import { FAZENDA_BUILDERS } from './furniFazenda';
import { VAN_BUILDERS } from './furniVan';

export type { FNode, FVisual, LightDef, LightKind } from './furniKit';

const builders: Record<string, Builder> = {
  ...SEDE_BUILDERS,
  ...VILA_BUILDERS,
  ...FAZENDA_BUILDERS,
  ...VAN_BUILDERS,
  desk(def) {
    const [c0, c1, c2] = def.colors;
    const W = def.width;
    const top: LBox = [0.04, 0.98, 0.02, W - 0.02, 0.72, 0.8];
    const ped: LBox = [0.12, 0.94, W - 0.78, W - 0.08, 0, 0.72];
    const leg: LBox = [0.12, 0.94, 0.08, 0.2, 0, 0.72];
    const back: LBox = [0.08, 0.16, 0.2, W - 0.78, 0.26, 0.72];
    return V([
      B(back, shade(c1, -0.1)),
      B(leg, c1),
      N(ped, (p) => {
        p.box(ped, c1);
        drawers(p, ped, 'front', 3, 1, c1, c2);
      }),
      B(top, c0, { edge: 0.28 }),
    ]);
  },

  office_chair(def) {
    const [c0, c1] = def.colors;
    const base: LBox = [0.18, 0.82, 0.18, 0.82, 0, 0.07];
    const lift: LBox = [0.46, 0.54, 0.46, 0.54, 0.07, 0.36];
    const seat: LBox = [0.18, 0.82, 0.18, 0.82, 0.36, 0.5];
    const back: LBox = [0.1, 0.22, 0.2, 0.8, 0.52, 1.22];
    const post: LBox = [0.12, 0.18, 0.46, 0.54, 0.4, 0.52];
    return V([
      N(base, (p) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const u = 0.5 + Math.cos(a) * 0.3;
          const v = 0.5 + Math.sin(a) * 0.3;
          p.line([0.5, 0.5, 0.05], [u, v, 0.04], '#0d0d0f', 3);
          p.disc(u, v, 0.045, 0.02, '#1e1e22', OUTLINE);
        }
      }),
      B(lift, '#5a5d63'),
      B(post, c1),
      B(seat, c0, { edge: 0.12 }),
      N(back, (p) => {
        p.box(back, c0, { edge: 0.12 });
        p.face(back, 'front', 0.28, 0.72, 0.62, 1.12, shade(c0, 0.06));
      }),
    ]);
  },

  chair(def) {
    const [c0, c1] = def.colors;
    const legs: LBox[] = [
      [0.16, 0.24, 0.16, 0.24, 0, 0.4],
      [0.76, 0.84, 0.16, 0.24, 0, 0.4],
      [0.16, 0.24, 0.76, 0.84, 0, 0.4],
      [0.76, 0.84, 0.76, 0.84, 0, 0.4],
    ];
    const seat: LBox = [0.12, 0.88, 0.12, 0.88, 0.4, 0.5];
    const posts: LBox[] = [
      [0.12, 0.22, 0.14, 0.24, 0.5, 1.25],
      [0.12, 0.22, 0.76, 0.86, 0.5, 1.25],
    ];
    const slats: LBox[] = [
      [0.13, 0.21, 0.24, 0.76, 0.78, 0.88],
      [0.13, 0.21, 0.24, 0.76, 1.1, 1.2],
    ];
    return V([...legs.map((l) => B(l, c1)), B(seat, c0, { edge: 0.25 }), ...posts.map((b) => B(b, c1)), ...slats.map((b) => B(b, c0))]);
  },

  stool(def) {
    const [c0, c1] = def.colors;
    const legs: LBox[] = [
      [0.26, 0.32, 0.26, 0.32, 0, 0.47],
      [0.68, 0.74, 0.26, 0.32, 0, 0.47],
      [0.26, 0.32, 0.68, 0.74, 0, 0.47],
      [0.68, 0.74, 0.68, 0.74, 0, 0.47],
    ];
    const seat: LBox = [0.2, 0.8, 0.2, 0.8, 0.47, 0.55];
    return V([
      ...legs.map((l) => B(l, c1)),
      N([0.3, 0.7, 0.3, 0.7, 0.16, 0.18], (p) => {
        p.line([0.29, 0.29, 0.17], [0.71, 0.29, 0.17], shade(c1, 0.1), 2);
        p.line([0.29, 0.71, 0.17], [0.71, 0.71, 0.17], shade(c1, 0.1), 2);
      }),
      N(seat, (p) => p.cyl(0.5, 0.5, 0.3, 0.47, 0.55, c0)),
    ]);
  },

  sofa(def) {
    const [c0] = def.colors;
    const W = def.width;
    const base: LBox = [0.2, 0.95, 0, W, 0, 0.28];
    const back: LBox = [0.04, 0.2, 0, W, 0, 1.05];
    const cushions: LBox[] = [
      [0.22, 0.95, 0.2, W / 2, 0.28, 0.45],
      [0.22, 0.95, W / 2, W - 0.2, 0.28, 0.45],
    ];
    const arms: LBox[] = [
      [0.2, 0.95, 0, 0.2, 0.28, 0.72],
      [0.2, 0.95, W - 0.2, W, 0.28, 0.72],
    ];
    return V([
      N(back, (p) => {
        p.box(back, c0, { edge: 0.15 });
        if (p.m.visible('front'))
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 2; j++) {
              const a = 0.25 + i * ((W - 0.5) / 5);
              p.face(back, 'front', a - 0.02, a + 0.02, 0.55 + j * 0.25, 0.58 + j * 0.25, shade(c0, -0.35));
            }
      }),
      B(base, shade(c0, -0.25)),
      ...cushions.map((b) => B(b, c0, { edge: 0.2 })),
      ...arms.map((b) => B(b, shade(c0, -0.05), { edge: 0.2 })),
    ]);
  },

  table(def) {
    const [c0, c1] = def.colors;
    const h = def.height / Z_PER_M;
    const top: LBox = [0.03, 0.97, 0.03, 0.97, h - 0.08, h];
    const L = (u: number, v: number): LBox => [u, u + 0.08, v, v + 0.08, 0, h - 0.08];
    return V([L(0.1, 0.1), L(0.82, 0.1), L(0.1, 0.82), L(0.82, 0.82)].map((b) => B(b, c1)).concat([B(top, c0, { edge: 0.28 })]));
  },

  table_big(def) {
    const [c0, c1, c2] = def.colors;
    const W = def.width;
    const D = def.depth;
    const top: LBox = [0, D, 0, W, 0.72, 0.8];
    const body: LBox = [0.12, D - 0.12, 0.12, W - 0.12, 0, 0.72];
    return V([
      N(body, (p) => {
        p.box(body, c1);
        for (const f of ['front', 'back'] as LFace[]) drawers(p, body, f, 2, 3, c1, c2);
        for (const f of ['left', 'right'] as LFace[]) drawers(p, body, f, 2, 1, c1, c2);
      }),
      B(top, c0, { edge: 0.3 }),
    ]);
  },

  lab_bench(def, _s, seed) {
    const [c0, c1, c2] = def.colors;
    const W = def.width;
    const posts: LBox[] = [
      [0.06, 0.14, 0.04, 0.12, 0, 0.74],
      [0.86, 0.94, 0.04, 0.12, 0, 0.74],
      [0.06, 0.14, W - 0.12, W - 0.04, 0, 0.74],
      [0.86, 0.94, W - 0.12, W - 0.04, 0, 0.74],
    ];
    const shelf: LBox = [0.14, 0.86, 0.12, W - 0.12, 0.16, 0.21];
    const top: LBox = [0.02, 0.98, 0, W, 0.74, 0.8];
    const r = rng(seed + 11);
    const jarCols = ['#8a1414', '#4a7a3a', '#b08a3a', '#9ab0b8'];
    const jars: FNode[] = [0.35, 0.8, 1.25, 1.65].filter((v) => v < W - 0.2).map((v, i) => {
      const hgt = 0.14 + r() * 0.1;
      const col = jarCols[(i + seed) % jarCols.length];
      return N([0.4, 0.6, v - 0.1, v + 0.1, 0.21, 0.21 + hgt], (p) => {
        p.cyl(0.5, v, 0.085, 0.21, 0.21 + hgt, '#8e9aa0', { top: '#b9c4c8' });
        p.cyl(0.5, v, 0.07, 0.22, 0.21 + hgt * 0.7, col, { outline: false });
        p.cyl(0.5, v, 0.09, 0.21 + hgt, 0.24 + hgt, '#2a2a2a');
      });
    });
    return V([...posts.map((b) => B(b, c0)), B(shelf, c1), ...jars, B(top, c2, { edge: 0.35 })]);
  },

  file_cabinet(def, state) {
    const [c0, , c2] = def.colors;
    const body: LBox = [0.1, 0.9, 0.12, 0.88, 0, 1.35];
    const nodes: FNode[] = [
      N(body, (p) => {
        p.box(body, c0, { edge: 0.25 });
        drawers(p, body, 'front', 3, 1, c0, '#1f2226', c2);
        if (state === 1) p.face(body, 'front', 0.16, 0.84, 0.92, 1.3, '#0b0c0e', true);
        if (!p.m.visible('front')) {
          vents(p, body, 'back', 1.0, 4, shade(c0, -0.3));
        }
      }),
    ];
    if (state === 1) {
      const dr: LBox = [0.9, 1.26, 0.16, 0.84, 0.94, 1.28];
      nodes.push(
        N(dr, (p) => {
          p.box(dr, c0);
          p.withTop(1.28, (ctx) => {
            ctx.fillStyle = '#0d0e10';
            ctx.fillRect(0.93, 0.2, 0.3, 0.6);
          });
          const folders = ['#c9a86a', '#b8b08a', '#8a6a4a', '#c9c0a4', '#a8905a'];
          for (let i = 0; i < 5; i++) {
            const u = 0.95 + i * 0.055;
            p.poly(
              [
                [u, 0.22, 1.2],
                [u, 0.78, 1.2],
                [u, 0.78, 1.33 + (i % 2) * 0.02],
                [u, 0.22, 1.33 + (i % 2) * 0.02],
              ],
              folders[i],
              OUTLINE,
            );
          }
        }),
      );
    }
    return V(nodes);
  },

  locker(def, state) {
    const [c0, c1] = def.colors;
    const body: LBox = [0.12, 0.88, 0.08, 0.92, 0, 2.1];
    const nodes: FNode[] = [
      N(body, (p) => {
        p.box(body, c0, { edge: 0.22 });
        if (!p.m.visible('front')) return;
        if (state === 1) {
          p.face(body, 'front', 0.12, 0.48, 0.06, 2.02, '#0a0b0d', true);
          p.face(body, 'front', 0.14, 0.46, 1.62, 1.66, '#2a2d32', true);
          // casaco pendurado
          p.face(body, 'front', 0.2, 0.4, 0.8, 1.58, '#3a2c20', true);
          p.face(body, 'front', 0.28, 0.32, 1.5, 1.64, '#8a8a8a', true);
        } else {
          p.face(body, 'front', 0.48, 0.52, 0.04, 2.06, c1);
          vents(p, body, 'front', 1.7, 4, c1);
          p.face(body, 'front', 0.4, 0.44, 1.0, 1.2, '#1a1a1a');
        }
        p.face(body, 'front', 0.56, 0.6, 1.0, 1.2, '#1a1a1a');
        p.face(body, 'front', 0.62, 0.8, 1.9, 1.98, '#c9c0a4');
      }),
    ];
    if (state === 1) {
      const door: LBox = [0.88, 1.3, 0.08, 0.13, 0.04, 2.06];
      nodes.push(B(door, shade(c0, 0.05)));
    }
    return V(nodes);
  },

  shelf(def, _s, seed) {
    const [c0, c1] = def.colors;
    const W = def.width;
    const r = rng(seed * 7 + 3);
    const posts: LBox[] = [
      [0.1, 0.18, 0, 0.08, 0, 2.2],
      [0.82, 0.9, 0, 0.08, 0, 2.2],
      [0.1, 0.18, W - 0.08, W, 0, 2.2],
      [0.82, 0.9, W - 0.08, W, 0, 2.2],
    ];
    const levels = [0.12, 0.72, 1.32, 1.92];
    const nodes: FNode[] = posts.map((b) => B(b, c1));
    for (const z of levels) {
      const board: LBox = [0.1, 0.9, 0.08, W - 0.08, z, z + 0.05];
      nodes.push(B(board, c0, { edge: 0.3 }));
      let v = 0.14;
      const zt = z + 0.05;
      while (v < W - 0.2) {
        const kind = r();
        if (kind < 0.3) {
          // pote
          const rad = 0.07 + r() * 0.03;
          const hgt = 0.18 + r() * 0.14;
          const cv = v + rad;
          const liquid = ['#6e1010', '#3a5a2a', '#8a6a2a', '#2a3a5a', '#5a2a4a'][Math.floor(r() * 5)];
          nodes.push(
            N([0.5 - rad, 0.5 + rad, cv - rad, cv + rad, zt, zt + hgt], (p) => {
              p.cyl(0.5, cv, rad, zt, zt + hgt, '#6b7a80', { top: '#9ab0b8' });
              p.cyl(0.5, cv, rad * 0.8, zt + 0.01, zt + hgt * 0.65, liquid, { outline: false });
              p.cyl(0.5, cv, rad * 1.05, zt + hgt, zt + hgt + 0.03, '#2a2622');
            }),
          );
          v = cv + rad + 0.05;
        } else if (kind < 0.5) {
          // caixa de papelão
          const w = 0.25 + r() * 0.15;
          const hgt = 0.2 + r() * 0.16;
          const b: LBox = [0.25, 0.8, v, v + w, zt, zt + hgt];
          nodes.push(
            N(b, (p) => {
              p.box(b, '#7a5a3a');
              p.face(b, 'front', v + w / 2 - 0.03, v + w / 2 + 0.03, zt, zt + hgt, '#9a7a4a');
              p.face(b, 'front', v + 0.05, v + 0.14, zt + 0.06, zt + 0.12, PAPER);
            }),
          );
          v += w + 0.05;
        } else if (kind < 0.8) {
          // livros
          const n = 3 + Math.floor(r() * 4);
          const cols = ['#5a2320', '#2f3f5a', '#4a4a2a', '#3a2a1a', '#6a5a3a', '#2a2a2a'];
          for (let i = 0; i < n && v < W - 0.14; i++) {
            const bw = 0.05 + r() * 0.04;
            const hgt = 0.26 + r() * 0.2;
            const b: LBox = [0.25, 0.7, v, v + bw, zt, zt + hgt];
            const col = cols[Math.floor(r() * cols.length)];
            nodes.push(
              N(b, (p) => {
                p.box(b, col, { faces: { front: shade(col, 0.1) }, edge: 0.1 });
                p.face(b, 'front', v + 0.01, v + bw - 0.01, zt + hgt * 0.7, zt + hgt * 0.76, '#b89a5a');
              }),
            );
            v += bw + 0.005;
          }
          v += 0.05;
        } else if (kind < 0.9 && z < 1.5) {
          // crânio
          nodes.push(N([0.35, 0.65, v, v + 0.25, zt, zt + 0.2], (p) => skull(p, 0.5, v + 0.12, zt, 0.8)));
          v += 0.3;
        } else {
          // vela
          const cv = v + 0.06;
          nodes.push(
            N([0.44, 0.56, cv - 0.06, cv + 0.06, zt, zt + 0.22], (p) => {
              p.cyl(0.5, cv, 0.045, zt, zt + 0.16 + (seed % 3) * 0.02, '#e8dcc0');
              p.flame(0.5, cv, zt + 0.17 + (seed % 3) * 0.02, 0.8);
            }),
          );
          v += 0.16;
        }
      }
    }
    return V(nodes);
  },

  bookshelf(def, _s, seed) {
    const [c0, c1] = def.colors;
    const W = def.width;
    const r = rng(seed * 13 + 5);
    const back: LBox = [0.08, 0.14, 0, W, 0, 2.14];
    const sides: LBox[] = [
      [0.14, 0.62, 0, 0.07, 0, 2.14],
      [0.14, 0.62, W - 0.07, W, 0, 2.14],
    ];
    const top: LBox = [0.08, 0.64, 0, W, 2.14, 2.22];
    const levels = [0, 0.62, 1.22, 1.82];
    const nodes: FNode[] = [B(back, shade(c1, -0.2)), ...sides.map((b) => B(b, c0))];
    const cols = ['#5a2320', '#2f3f5a', '#4a4a2a', '#3a2a1a', '#6a5a3a', '#262626', '#5a4030', '#40263a'];
    for (const z of levels) {
      const board: LBox = [0.14, 0.62, 0.07, W - 0.07, z, z + 0.06];
      nodes.push(B(board, c0, { edge: 0.25 }));
      if (z > 1.7) continue;
      const zt = z + 0.06;
      const books: { v: number; w: number; h: number; c: string; d: number }[] = [];
      let v = 0.09;
      while (v < W - 0.12) {
        if (r() < 0.07) {
          v += 0.08 + r() * 0.12;
          continue;
        }
        const w = 0.045 + r() * 0.05;
        if (v + w > W - 0.09) break;
        books.push({ v, w, h: 0.3 + r() * 0.2, c: cols[Math.floor(r() * cols.length)], d: 0.34 + r() * 0.1 });
        v += w + 0.004;
      }
      const vMin = books.length ? books[0].v : 0.1;
      const vMax = books.length ? books[books.length - 1].v + books[books.length - 1].w : 0.2;
      nodes.push(
        N([0.16, 0.6, vMin, vMax, zt, zt + 0.52], (p) => {
          // ordena pela profundidade no mundo para sobrepor certo
          const order = books
            .map((bk) => {
              const [x, y] = p.m.xy(0.4, bk.v + bk.w / 2);
              return { bk, k: x + y };
            })
            .sort((a, b) => a.k - b.k);
          for (const { bk } of order) {
            const b: LBox = [0.16, 0.16 + bk.d, bk.v, bk.v + bk.w, zt, zt + bk.h];
            p.box(b, bk.c, { faces: { front: shade(bk.c, 0.08) }, edge: 0.08 });
            p.face(b, 'front', bk.v + 0.008, bk.v + bk.w - 0.008, zt + bk.h * 0.72, zt + bk.h * 0.78, '#b89a5a');
            p.face(b, 'front', bk.v + 0.008, bk.v + bk.w - 0.008, zt + bk.h * 0.2, zt + bk.h * 0.24, shade(bk.c, -0.3));
          }
        }),
      );
    }
    nodes.push(B(top, c0, { edge: 0.3 }));
    return V(nodes);
  },

  crate(def) {
    const [c0] = def.colors;
    const h = Math.max(0.2, def.height / Z_PER_M);
    const b: LBox = [0.04, 0.96, 0.04, 0.96, 0, h];
    return V([
      N(b, (p) => {
        p.box(b, c0, { edge: 0.2 });
        for (const f of ['front', 'back', 'left', 'right'] as LFace[]) crateFace(p, b, f, c0);
        p.withTop(h, (ctx) => {
          ctx.fillStyle = rgba('#000000', 0.25);
          for (let k = 1; k < 4; k++) ctx.fillRect(0.04, 0.04 + k * 0.23 - 0.01, 0.92, 0.02);
        });
      }),
    ]);
  },

  crate_metal(def) {
    const [c0, c1, c2] = def.colors;
    const b: LBox = [0.05, 0.95, 0.05, 0.95, 0, 0.8];
    return V([
      N(b, (p) => {
        p.box(b, c0, { edge: 0.3 });
        for (const f of ['front', 'back', 'left', 'right'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(b, f);
          p.face(b, f, a0, a0 + 0.07, 0, 0.8, c1);
          p.face(b, f, a1 - 0.07, a1, 0, 0.8, c1);
          p.face(b, f, a0, a1, 0, 0.06, c1);
          p.face(b, f, a0, a1, 0.74, 0.8, c1);
          const m = (a0 + a1) / 2;
          p.face(b, f, m - 0.2, m - 0.14, 0, 0.8, c2);
          p.face(b, f, m + 0.14, m + 0.2, 0, 0.8, c2);
          if (f === 'front') {
            p.face(b, f, m - 0.09, m + 0.09, 0.42, 0.56, '#b8a24a');
            for (let i = 0; i < 3; i++) p.face(b, f, m - 0.09 + i * 0.07, m - 0.06 + i * 0.07, 0.42, 0.56, '#1a1a1a');
          }
        }
        p.withTop(0.8, (ctx) => {
          ctx.fillStyle = shade(c2, 0.1);
          ctx.fillRect(0.28, 0.05, 0.06, 0.9);
          ctx.fillRect(0.64, 0.05, 0.06, 0.9);
        });
      }),
    ]);
  },

  chest(def) {
    const [c0, c1, c2] = def.colors;
    const W = def.width;
    const b: LBox = [0.06, 0.94, 0.04, W - 0.04, 0, 0.7];
    return V([
      N(b, (p) => {
        p.box(b, c0, { edge: 0.25 });
        for (const f of ['front', 'back', 'left', 'right'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(b, f);
          p.face(b, f, a0, a1, 0.5, 0.53, c1);
          p.face(b, f, a0, a1, 0, 0.05, c1);
          if (f === 'front' || f === 'back') {
            p.face(b, f, a0 + 0.3, a0 + 0.4, 0.38, 0.52, c2);
            p.face(b, f, a1 - 0.4, a1 - 0.3, 0.38, 0.52, c2);
            p.face(b, f, (a0 + a1) / 2 - 0.22, (a0 + a1) / 2 + 0.22, 0.18, 0.3, shade(c0, 0.25));
          } else {
            p.face(b, f, 0.35, 0.65, 0.34, 0.4, '#141414');
          }
        }
      }),
    ]);
  },

  barrel(def) {
    const [c0, c1] = def.colors;
    return V([
      N([0.14, 0.86, 0.14, 0.86, 0, 1], (p) => {
        p.cyl(0.5, 0.5, 0.36, 0, 1, c0, { top: shade(c0, 0.1) });
        const ctx = p.ctx;
        for (const z of [0.14, 0.5, 0.86]) {
          const [x, y] = p.m.p(0.5, 0.5, z);
          ctx.beginPath();
          ctx.ellipse(x, y, 0.365 * 45.25, 0.365 * 22.63, 0, 0, Math.PI);
          ctx.lineWidth = 2;
          ctx.strokeStyle = c1;
          ctx.stroke();
        }
        p.disc(0.5, 0.5, 0.08, 1, shade(c0, -0.3));
        // símbolo de perigo
        const [x, y] = p.m.p(0.5, 0.5, 0.62);
        ctx.fillStyle = '#b8a24a';
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y - 7);
        ctx.closePath();
        ctx.fill();
      }),
    ]);
  },

  tank(def, state, seed) {
    const [c0, glowC] = def.colors;
    const on = state === 0;
    const base: LBox = [0, 2, 0, 2, 0, 0.32];
    const cap: LBox = [0, 2, 0, 2, 1.92, 2.2];
    const posts: LBox[] = [
      [0, 0.1, 0, 0.1, 0.32, 1.92],
      [1.9, 2, 0, 0.1, 0.32, 1.92],
      [0, 0.1, 1.9, 2, 0.32, 1.92],
      [1.9, 2, 1.9, 2, 0.32, 1.92],
    ];
    const glass: LBox = [0.1, 1.9, 0.1, 1.9, 0.32, 1.92];
    const nodes: FNode[] = [
      N(base, (p) => {
        p.box(base, c0, { edge: 0.3 });
        for (const f of ['front', 'back', 'left', 'right'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          vents(p, base, f, 0.1, 3, '#15171a');
          const [a0, a1] = faceRange(base, f);
          p.face(base, f, a0, a1, 0.27, 0.3, on ? glowC : '#333', true);
        }
      }),
      ...posts.slice(0, 3).map((b) => B(b, shade(c0, 0.1))),
      N(glass, (p) => {
        const ctx = p.ctx;
        const w = p.m.box(glass);
        const sil = siloBox(w);
        ctx.save();
        pathPts(ctx, sil);
        ctx.clip();
        const [cx, cyTop] = isoC(w, w.z1);
        const [, cyBot] = isoC(w, w.z0);
        const g = ctx.createLinearGradient(0, cyTop - 40, 0, cyBot + 40);
        if (on) {
          g.addColorStop(0, rgba(glowC, 0.55));
          g.addColorStop(0.5, rgba(shade(glowC, -0.35), 0.62));
          g.addColorStop(1, rgba(shade(glowC, -0.6), 0.75));
        } else {
          g.addColorStop(0, 'rgba(20,40,40,0.55)');
          g.addColorStop(1, 'rgba(8,16,16,0.8)');
        }
        ctx.fillStyle = g;
        ctx.fillRect(cx - 80, cyTop - 60, 160, cyBot - cyTop + 120);
        // criatura
        const bob = Math.sin(p.t / 1400 + seed) * 3;
        creature(ctx, cx, (cyTop + cyBot) / 2 + 14 + bob, on ? 'rgba(6,30,26,0.82)' : 'rgba(4,10,10,0.9)', p.t);
        // bolhas
        if (on) {
          const r = rng(seed + 99);
          ctx.fillStyle = 'rgba(210,255,245,0.55)';
          for (let i = 0; i < 14; i++) {
            const bx = cx - 40 + r() * 80;
            const speed = 18 + r() * 22;
            const span = cyBot - cyTop + 40;
            const by = cyBot + 10 - ((p.t / 1000) * speed + r() * span) % span;
            ctx.beginPath();
            ctx.arc(bx + Math.sin(p.t / 400 + i) * 2, by, 1 + r() * 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // reflexos do vidro
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx - 50, cyTop - 50, 5, cyBot - cyTop + 90);
        ctx.fillRect(cx - 40, cyTop - 50, 2, cyBot - cyTop + 90);
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.strokeStyle = on ? rgba(shade(glowC, 0.4), 0.5) : 'rgba(120,140,140,0.3)';
        pathPts(ctx, sil);
        ctx.stroke();
      }),
      B(posts[3], shade(c0, 0.1)),
      N(cap, (p) => {
        p.box(cap, c0, { edge: 0.3 });
        for (const f of ['front', 'back', 'left', 'right'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(cap, f);
          p.face(cap, f, a0, a1, 1.94, 1.97, on ? glowC : '#333', true);
          vents(p, cap, f, 2.03, 3, '#15171a');
        }
        p.cyl(0.55, 0.6, 0.12, 2.2, 2.4, '#2e3236');
        p.cyl(1.4, 1.3, 0.09, 2.2, 2.5, '#2e3236');
      }),
    ];
    return V(nodes, lightIf(on, { u: 1, v: 1, z: 1.1, radius: 200, color: glowC, intensity: 0.95 }));
  },

  monitor(def, state, seed) {
    const [c0, sc] = def.colors;
    const on = state === 0;
    const foot: LBox = [0.34, 0.66, 0.3, 0.7, 0, 0.03];
    const neck: LBox = [0.44, 0.52, 0.47, 0.53, 0.03, 0.18];
    const scr: LBox = [0.4, 0.54, 0.08, 0.92, 0.18, 0.56];
    return V(
      [
        B(foot, c0),
        B(neck, c0),
        N(scr, (p) => {
          p.box(scr, c0, { edge: 0.15 });
          if (!p.m.visible('front')) return;
          const lit = on && p.power > 0.1;
          p.face(scr, 'front', 0.13, 0.87, 0.22, 0.52, lit ? shade(sc, -0.58) : '#0a0c0e', true);
          if (!lit) return;
          p.withFace(scr, 'front', (ctx) => {
            const t = p.t / 1000 + seed;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0.13, 0.22, 0.74, 0.3);
            ctx.clip();
            const style = seed % 3;
            ctx.strokeStyle = sc;
            ctx.fillStyle = sc;
            ctx.lineWidth = 0.02;
            if (style === 0) {
              // radar
              const cx = 0.5;
              const cy = 0.37;
              ctx.globalAlpha = 0.8;
              ctx.beginPath();
              ctx.ellipse(cx, cy, 0.12, 0.12, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.ellipse(cx, cy, 0.06, 0.06, 0, 0, Math.PI * 2);
              ctx.stroke();
              const a = t * 2;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + Math.cos(a) * 0.12, cy + Math.sin(a) * 0.12);
              ctx.stroke();
              ctx.fillRect(0.18, 0.46, 0.15, 0.02);
              ctx.fillRect(0.67, 0.28, 0.15, 0.02);
            } else if (style === 1) {
              // gráfico
              ctx.globalAlpha = 0.85;
              ctx.beginPath();
              for (let i = 0; i <= 30; i++) {
                const x = 0.15 + i * 0.023;
                const y = 0.36 + Math.sin(i * 0.7 + t * 3) * 0.05 * Math.sin(i * 0.23 + t);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
              }
              ctx.stroke();
              for (let i = 0; i < 4; i++) ctx.fillRect(0.16 + i * 0.1, 0.46, 0.07, 0.015);
            } else {
              // texto rolando
              ctx.globalAlpha = 0.75;
              for (let i = 0; i < 6; i++) {
                const y = 0.24 + ((i * 0.05 + t * 0.03) % 0.3);
                ctx.fillRect(0.16, y, 0.2 + hash(i, seed) * 0.45, 0.015);
              }
            }
            ctx.restore();
            ctx.globalAlpha = 0.07 + 0.04 * Math.sin(t * 20);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0.13, 0.22 + ((t * 0.2) % 0.3), 0.74, 0.02);
            ctx.globalAlpha = 1;
          });
        }),
      ],
      lightIf(on, { u: 0.95, v: 0.5, z: 0.38, radius: 85, color: sc, intensity: 0.7 }),
    );
  },

  // o monitor de pé com rodinhas (o de hospital e o tomado pela Energia), até chegar monitor-suporte.png e
  // monitor-energia.png: o pé de cinco rodas, o poste, a bandeja e o monitor com o batimento correndo
  monitor_pe(def, state, seed) {
    const [corpo, tela] = def.colors;
    const on = state === 0;
    const energia = def.id === 'monitor_energia';
    const scr: LBox = [0.4, 0.58, 0.22, 0.78, 1.02, 1.42];
    const nos: FNode[] = [
      B([0.2, 0.8, 0.2, 0.8, 0.04, 0.09], shade(corpo, -0.15), { edge: 0.3 }),
      ...[
        [0.22, 0.22],
        [0.22, 0.78],
        [0.78, 0.22],
        [0.78, 0.78],
      ].map(([u, v]) => B([u - 0.04, u + 0.04, v - 0.04, v + 0.04, 0, 0.05], '#2a2a2e')),
      B([0.46, 0.54, 0.46, 0.54, 0.09, 1.0], shade(corpo, -0.05)),
      B([0.36, 0.64, 0.3, 0.7, 0.98, 1.02], corpo),
      N(scr, (p) => {
        p.box(scr, corpo, { edge: 0.25 });
        if (!p.m.visible('front')) return;
        const lit = on && p.power > 0.1;
        p.face(scr, 'front', 0.1, 0.9, 0.12, 0.8, lit ? shade(tela, -0.6) : '#0a0c0e', true);
        if (!lit) return;
        p.withFace(scr, 'front', (ctx) => {
          const t = p.t / 1000 + seed;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0.1, 0.12, 0.8, 0.68);
          ctx.clip();
          ctx.strokeStyle = tela;
          ctx.lineWidth = 0.025;
          ctx.globalAlpha = 0.9;
          // o batimento correndo
          ctx.beginPath();
          for (let i = 0; i <= 32; i++) {
            const x = 0.12 + i * 0.024;
            const f = (i * 0.024 + t * 0.35) % 0.5;
            const y = 0.36 - (f > 0.22 && f < 0.26 ? 0.14 : f >= 0.26 && f < 0.28 ? -0.06 : 0);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
          // os blocos dos números (só a cor: nada escrito)
          ctx.fillStyle = tela;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(0.14, 0.52, 0.22, 0.08);
          ctx.fillRect(0.5, 0.52, 0.3, 0.08);
          ctx.fillRect(0.14, 0.66, 0.3, 0.06);
          if (energia) {
            // o raio roxo atravessando a tela
            ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 23);
            ctx.strokeStyle = '#f0d8ff';
            ctx.beginPath();
            let x = 0.1;
            ctx.moveTo(x, 0.2);
            for (let k = 0; k < 6; k++) {
              x += 0.13;
              ctx.lineTo(x, 0.15 + hash(k, Math.floor(t * 8) + seed) * 0.6);
            }
            ctx.stroke();
          }
          ctx.restore();
        });
      }),
    ];
    if (energia)
      // a coisa fundida: um segundo aparelho torto grudado no poste e os cabos que viraram veias acesas
      nos.push(
        B([0.3, 0.52, 0.58, 0.88, 0.5, 0.86], shade(corpo, 0.1), { edge: 0.3 }),
        N([0.4, 0.66, 0.3, 0.8, 0.1, 1.0], (p) => {
          for (let k = 0; k < 3; k++) p.line([0.5, 0.5, 0.15 + k * 0.28], [0.64, 0.32 + k * 0.16, 0.26 + k * 0.28], tela, 2);
        }),
      );
    return V(nos, lightIf(on, { u: 0.95, v: 0.5, z: 1.2, radius: energia ? 110 : 70, color: tela, intensity: energia ? 0.75 : 0.45, ...(energia ? { flicker: 0.3 } : {}) }));
  },

  // um aparelho num carrinho (o gravador de rolo, o eletroencefalógrafo), até chegar a arte do Códex
  aparelho(def, _state, seed) {
    const [corpo, luz] = def.colors;
    const H = def.height / Z_PER_M;
    const tampo = Math.min(0.75, H * 0.55);
    const dev: LBox = [0.25, 0.75, 0.15, 0.85, tampo, H];
    return V(
      [
        B([0.2, 0.8, 0.12, 0.88, tampo - 0.05, tampo], shade(corpo, -0.2), { edge: 0.2 }),
        ...[
          [0.24, 0.16],
          [0.24, 0.84],
          [0.76, 0.16],
          [0.76, 0.84],
        ].map(([u, v]) => B([u - 0.03, u + 0.03, v - 0.03, v + 0.03, 0, tampo - 0.05], '#2a2a2e')),
        N(dev, (p) => {
          p.box(dev, corpo, { edge: 0.25 });
          if (!p.m.visible('front')) return;
          p.face(dev, 'front', 0.12, 0.88, 0.2, 0.55, shade(corpo, -0.35), true);
          p.withFace(dev, 'front', (ctx) => {
            ctx.fillStyle = luz;
            ctx.globalAlpha = 0.75 + 0.25 * Math.sin(p.t / 300 + seed);
            ctx.fillRect(0.74, 0.68, 0.08, 0.08);
            ctx.globalAlpha = 1;
          });
        }),
      ],
      [{ u: 0.9, v: 0.5, z: tampo + 0.2, radius: 30, color: luz, intensity: 0.25 }],
    );
  },

  // a câmera de fita no tripé, com a luzinha de gravando (até chegar camera-tripe.png)
  camera_tripe(def) {
    const [corpo, luz] = def.colors;
    const cam: LBox = [0.35, 0.7, 0.4, 0.6, 1.3, 1.52];
    return V(
      [
        N([0.15, 0.85, 0.15, 0.85, 0, 1.3], (p) => {
          for (const [u, v] of [
            [0.2, 0.3],
            [0.2, 0.7],
            [0.8, 0.5],
          ])
            p.line([u, v, 0], [0.5, 0.5, 1.28], '#2a2a2e', 3);
        }),
        N(cam, (p) => {
          p.box(cam, corpo, { edge: 0.25 });
          p.box([0.7, 0.8, 0.44, 0.56, 1.36, 1.48], '#111114', { edge: 0.3 });
          p.box([0.4, 0.46, 0.55, 0.6, 1.53, 1.56], luz);
        }),
      ],
      [{ u: 0.45, v: 0.58, z: 1.55, radius: 14, color: luz, intensity: 0.5, flicker: 0.5 }],
    );
  },

  keyboard(def) {
    const [c0] = def.colors;
    const kb: LBox = [0.5, 0.78, 0.14, 0.82, 0, 0.035];
    const mouse: LBox = [0.56, 0.68, 0.88, 0.96, 0, 0.04];
    return V([
      N(kb, (p) => {
        p.box(kb, c0, { edge: 0.1 });
        p.withTop(0.036, (ctx) => {
          ctx.fillStyle = '#3a3a40';
          for (let i = 0; i < 4; i++) for (let j = 0; j < 11; j++) ctx.fillRect(0.53 + i * 0.062, 0.17 + j * 0.058, 0.045, 0.045);
        });
      }),
      B(mouse, c0),
    ]);
  },

  papers(def, _s, seed) {
    const [c0] = def.colors;
    const r = rng(seed + 5);
    const sheets = Array.from({ length: 4 }, () => ({ u: 0.2 + r() * 0.5, v: 0.2 + r() * 0.5, a: (r() - 0.5) * 1.4, red: r() < 0.3 }));
    return V([
      N([0.05, 0.95, 0.05, 0.95, 0, 0.01], (p) => {
        p.withTop(0.004, (ctx) => {
          for (const s of sheets) {
            ctx.save();
            ctx.translate(s.u, s.v);
            ctx.rotate(s.a);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(-0.2, -0.15, 0.42, 0.32);
            ctx.fillStyle = shade(c0, (s.u - 0.5) * 0.2);
            ctx.fillRect(-0.21, -0.16, 0.42, 0.32);
            ctx.fillStyle = 'rgba(60,40,30,0.55)';
            for (let i = 0; i < 5; i++) ctx.fillRect(-0.17, -0.11 + i * 0.05, 0.25 + ((i * 7) % 3) * 0.04, 0.012);
            if (s.red) {
              ctx.strokeStyle = 'rgba(140,16,16,0.8)';
              ctx.lineWidth = 0.02;
              ctx.beginPath();
              ctx.arc(0.1, 0.05, 0.06, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        });
      }),
    ]);
  },

  mug(def) {
    const [c0] = def.colors;
    return V([
      N([0.38, 0.62, 0.38, 0.62, 0, 0.18], (p) => {
        const ctx = p.ctx;
        const [x, y] = p.m.p(0.5, 0.5, 0.09);
        ctx.strokeStyle = shade(c0, -0.25);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 5.5, y, 2.6, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        p.cyl(0.5, 0.5, 0.1, 0, 0.18, c0);
        p.disc(0.5, 0.5, 0.075, 0.17, '#2a160c');
      }),
    ]);
  },

  desk_lamp(def, state) {
    const [c0, lc] = def.colors;
    const on = state === 0;
    return V(
      [
        N([0.25, 0.82, 0.34, 0.66, 0, 0.56], (p) => {
          p.cyl(0.38, 0.5, 0.13, 0, 0.04, c0);
          p.line([0.38, 0.5, 0.04], [0.44, 0.5, 0.4], '#141414', 2.4);
          p.line([0.44, 0.5, 0.4], [0.64, 0.5, 0.48], '#141414', 2.4);
          const head: LBox = [0.56, 0.8, 0.4, 0.6, 0.38, 0.5];
          if (on) {
            const ctx = p.ctx;
            const [hx, hy] = p.m.p(0.7, 0.5, 0.38);
            const [fx, fy] = p.m.p(0.8, 0.5, 0);
            const g = ctx.createLinearGradient(hx, hy, fx, fy);
            g.addColorStop(0, 'rgba(255,210,130,0.35)');
            g.addColorStop(1, 'rgba(255,190,100,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(hx - 5, hy);
            ctx.lineTo(hx + 5, hy);
            ctx.lineTo(fx + 20, fy);
            ctx.lineTo(fx - 20, fy);
            ctx.closePath();
            ctx.fill();
          }
          p.box(head, c0, { edge: 0.3 });
          if (on) p.disc(0.68, 0.5, 0.06, 0.38, lc);
        }),
      ],
      lightIf(on, { u: 0.75, v: 0.5, z: 0.3, radius: 150, color: WARM, intensity: 0.95, flicker: 0.02 }),
    );
  },

  candles(def, state, seed) {
    const [wax] = def.colors;
    const on = state === 0;
    const cs = [
      { u: 0.36, v: 0.4, h: 0.3, r: 0.06 },
      { u: 0.56, v: 0.56, h: 0.2, r: 0.055 },
      { u: 0.4, v: 0.66, h: 0.25, r: 0.05 },
    ];
    return V(
      [
        N([0.22, 0.78, 0.26, 0.8, 0, 0.35], (p) => {
          p.disc(0.47, 0.54, 0.28, 0.01, '#3a2e22', OUTLINE);
          const order = cs
            .map((c) => {
              const [x, y] = p.m.xy(c.u, c.v);
              return { c, k: x + y };
            })
            .sort((a, b) => a.k - b.k);
          for (const { c } of order) {
            p.cyl(c.u, c.v, c.r, 0.01, c.h, wax, { top: '#f4ead2' });
            const [x, y] = p.m.p(c.u, c.v, c.h);
            p.ctx.fillStyle = '#f1e6cc';
            p.ctx.fillRect(x - 3, y, 2, 4 + ((seed + c.u * 10) % 3));
            p.line([c.u, c.v, c.h], [c.u, c.v, c.h + 0.03], '#1a1a1a', 1);
            if (on) p.flame(c.u, c.v, c.h + 0.03, 0.9);
          }
        }),
      ],
      lightIf(on, { u: 0.47, v: 0.54, z: 0.4, radius: 125, color: WARM, intensity: 0.9, flicker: 0.12, kind: 'fire' }),
    );
  },

  candelabra(def, state) {
    const [metal, wax] = def.colors;
    const on = state === 0;
    return V(
      [
        N([0.25, 0.75, 0.2, 0.8, 0, 1.6], (p) => {
          p.cyl(0.5, 0.5, 0.18, 0, 0.06, metal);
          p.cyl(0.5, 0.5, 0.035, 0.06, 1.2, metal);
          p.cyl(0.5, 0.5, 0.07, 0.55, 0.62, metal);
          const arms = [0.25, 0.5, 0.75];
          for (const v of arms) {
            p.line([0.5, 0.5, 1.12], [0.5, v, 1.26], metal, 2.5);
            p.cyl(0.5, v, 0.06, 1.26, 1.3, metal);
          }
          for (const v of arms) {
            const h = v === 0.5 ? 1.6 : 1.52;
            p.cyl(0.5, v, 0.035, 1.3, h, wax, { top: '#f4ead2' });
            if (on) p.flame(0.5, v, h + 0.02, 0.9);
          }
        }),
      ],
      lightIf(on, { u: 0.5, v: 0.5, z: 1.5, radius: 150, color: WARM, intensity: 0.9, flicker: 0.12, kind: 'fire' }),
    );
  },

  floor_lamp(def, state) {
    const [c0, sh] = def.colors;
    const on = state === 0;
    return V(
      [
        N([0.25, 0.75, 0.25, 0.75, 0, 1.9], (p) => {
          p.cyl(0.5, 0.5, 0.2, 0, 0.05, c0);
          p.cyl(0.5, 0.5, 0.025, 0.05, 1.5, c0);
          p.cyl(0.5, 0.5, 0.24, 1.48, 1.86, on ? shade(sh, 0.15) : shade(sh, -0.45), { top: shade(sh, -0.2) });
          if (on) {
            const ctx = p.ctx;
            const [x, y] = p.m.p(0.5, 0.5, 1.67);
            const g = ctx.createRadialGradient(x, y, 2, x, y, 22);
            g.addColorStop(0, 'rgba(255,230,170,0.5)');
            g.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 22, y - 22, 44, 44);
          }
        }),
      ],
      lightIf(on, { u: 0.5, v: 0.5, z: 1.5, radius: 200, color: '#ffc98a', intensity: 0.95 }),
    );
  },

  plant(def, _s, seed) {
    const [leaf, pot] = def.colors;
    const r = rng(seed + 21);
    const leaves = Array.from({ length: 13 }, () => ({ a: r() * Math.PI * 2, d: 4 + r() * 12, s: 5 + r() * 6, up: r() * 26, c: r() }));
    return V([
      N([0.18, 0.82, 0.18, 0.82, 0, 1.2], (p) => {
        p.cyl(0.5, 0.5, 0.2, 0, 0.38, pot, { top: '#2a1a10' });
        const ctx = p.ctx;
        const [x, y] = p.m.p(0.5, 0.5, 0.38);
        ctx.strokeStyle = shade(leaf, -0.3);
        ctx.lineWidth = 1.5;
        const sorted = [...leaves].sort((a, b) => Math.sin(a.a) - Math.sin(b.a));
        for (const l of sorted) {
          const lx = x + Math.cos(l.a) * l.d;
          const ly = y - 8 - l.up + Math.sin(l.a) * l.d * 0.4;
          ctx.beginPath();
          ctx.moveTo(x, y - 2);
          ctx.quadraticCurveTo(x + Math.cos(l.a) * l.d * 0.3, ly + 6, lx, ly);
          ctx.stroke();
          ctx.fillStyle = shade(leaf, (l.c - 0.5) * 0.5 + (Math.sin(l.a) > 0 ? 0.08 : -0.15));
          ctx.beginPath();
          ctx.ellipse(lx, ly, l.s, l.s * 0.45, l.a + 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = shade(leaf, -0.3);
          ctx.lineWidth = 1.5;
        }
      }),
    ]);
  },

  trolley(def, _s, seed) {
    const [c0, c1] = def.colors;
    const posts: LBox[] = [
      [0.06, 0.12, 0.06, 0.12, 0.05, 0.9],
      [0.88, 0.94, 0.06, 0.12, 0.05, 0.9],
      [0.06, 0.12, 0.88, 0.94, 0.05, 0.9],
      [0.88, 0.94, 0.88, 0.94, 0.05, 0.9],
    ];
    const low: LBox = [0.12, 0.88, 0.12, 0.88, 0.14, 0.18];
    const high: LBox = [0.12, 0.88, 0.12, 0.88, 0.84, 0.88];
    const r = rng(seed + 3);
    const bottles: FNode[] = [
      [0.35, 0.3],
      [0.62, 0.42],
      [0.4, 0.66],
      [0.66, 0.72],
    ].map(([u, v], i) => {
      const h = 0.16 + r() * 0.14;
      const col = i % 2 ? c1 : '#a8b4b8';
      return N([u - 0.08, u + 0.08, v - 0.08, v + 0.08, 0.88, 0.88 + h + 0.05], (p) => {
        p.cyl(u, v, 0.07, 0.88, 0.88 + h, col, { top: shade(col, 0.2) });
        p.cyl(u, v, 0.03, 0.88 + h, 0.88 + h + 0.05, '#2a2622');
      });
    });
    const jars: FNode[] = [
      [0.35, 0.4],
      [0.62, 0.62],
    ].map(([u, v]) =>
      N([u - 0.1, u + 0.1, v - 0.1, v + 0.1, 0.18, 0.42], (p) => {
        p.cyl(u, v, 0.1, 0.18, 0.4, '#6b7a80', { top: '#9ab0b8' });
        p.cyl(u, v, 0.08, 0.19, 0.3, c1, { outline: false });
      }),
    );
    return V([
      N([0.06, 0.94, 0.06, 0.94, 0, 0.05], (p) => {
        for (const [u, v] of [
          [0.09, 0.09],
          [0.91, 0.09],
          [0.09, 0.91],
          [0.91, 0.91],
        ])
          p.disc(u, v, 0.05, 0.03, '#141414', OUTLINE);
      }),
      ...posts.slice(0, 3).map((b) => B(b, c0)),
      B(low, c0, { edge: 0.3 }),
      ...jars,
      B(high, c0, { edge: 0.35 }),
      ...bottles,
      B(posts[3], c0),
    ]);
  },

  microscope(def) {
    const [c0, c1] = def.colors;
    const base: LBox = [0.3, 0.75, 0.3, 0.7, 0, 0.06];
    const arm: LBox = [0.3, 0.42, 0.42, 0.58, 0.06, 0.45];
    const stage: LBox = [0.45, 0.72, 0.35, 0.65, 0.18, 0.22];
    return V([
      B(base, c0),
      B(arm, c0),
      B(stage, c1),
      N([0.46, 0.58, 0.44, 0.56, 0.26, 0.58], (p) => {
        p.cyl(0.52, 0.5, 0.05, 0.26, 0.5, c1);
        p.cyl(0.52, 0.5, 0.03, 0.22, 0.27, '#8a9aa0');
        p.cyl(0.52, 0.5, 0.035, 0.5, 0.58, '#3a3a3a');
      }),
    ]);
  },

  flasks(def) {
    const [a, b, c] = def.colors;
    const items = [
      { u: 0.35, v: 0.35, col: a, kind: 0 },
      { u: 0.62, v: 0.45, col: b, kind: 1 },
      { u: 0.4, v: 0.68, col: c, kind: 2 },
      { u: 0.66, v: 0.72, col: a, kind: 2 },
    ];
    return V(
      [
        N([0.2, 0.85, 0.2, 0.85, 0, 0.42], (p) => {
          const ctx = p.ctx;
          const order = items
            .map((it) => {
              const [x, y] = p.m.xy(it.u, it.v);
              return { it, k: x + y };
            })
            .sort((q, w) => q.k - w.k);
          for (const { it } of order) {
            const [x, y] = p.m.p(it.u, it.v, 0);
            ctx.lineWidth = 1;
            ctx.strokeStyle = OUTLINE;
            if (it.kind === 0) {
              // erlenmeyer
              ctx.beginPath();
              ctx.moveTo(x - 7, y);
              ctx.lineTo(x + 7, y);
              ctx.lineTo(x + 2, y - 10);
              ctx.lineTo(x + 2, y - 15);
              ctx.lineTo(x - 2, y - 15);
              ctx.lineTo(x - 2, y - 10);
              ctx.closePath();
              ctx.fillStyle = 'rgba(190,210,215,0.45)';
              ctx.fill();
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x - 6, y - 1);
              ctx.lineTo(x + 6, y - 1);
              ctx.lineTo(x + 3, y - 6);
              ctx.lineTo(x - 3, y - 6);
              ctx.closePath();
              ctx.fillStyle = it.col;
              ctx.fill();
            } else if (it.kind === 1) {
              // balão redondo
              ctx.beginPath();
              ctx.arc(x, y - 5, 6, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(190,210,215,0.45)';
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = it.col;
              ctx.beginPath();
              ctx.arc(x, y - 5, 5, 0.1, Math.PI - 0.1);
              ctx.fill();
              ctx.fillStyle = 'rgba(190,210,215,0.6)';
              ctx.fillRect(x - 1.5, y - 16, 3, 6);
              ctx.strokeRect(x - 1.5, y - 16, 3, 6);
            } else {
              // tubo de ensaio
              ctx.fillStyle = 'rgba(190,210,215,0.45)';
              ctx.fillRect(x - 2, y - 14, 4, 13);
              ctx.strokeRect(x - 2, y - 14, 4, 13);
              ctx.fillStyle = it.col;
              ctx.fillRect(x - 1.5, y - 7, 3, 6);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(x - 3, y - 9, 1, 3);
          }
        }),
      ],
      [{ u: 0.62, v: 0.45, z: 0.15, radius: 40, color: b, intensity: 0.45 }],
    );
  },

  skull() {
    return V([N([0.3, 0.7, 0.3, 0.7, 0, 0.3], (p) => skull(p, 0.5, 0.5, 0, 1))]);
  },

  // o corpo deitado no chão, coberto (o lençol ou o saco): o pano no chão, a cabeça, o tronco, as pernas e os pés
  // levantando o pano na ponta; 1,9 m no meio das 3 casas (até chegar corpo-lencol.png e corpo-saco.png)
  corpo(def) {
    const [pano, marca] = def.colors;
    const u0 = (def.depth - 2.5) / 2;
    const u1 = u0 + 2.5;
    return V([
      N([u0, u1, 0.2, 0.8, 0, 0.3], (p) => {
        p.box([u0 + 0.04, u1 - 0.04, 0.22, 0.78, 0, 0.06], shade(pano, -0.2), { edge: 0.3 });
        p.box([u0 + 0.08, u0 + 0.4, 0.36, 0.64, 0.04, 0.26], pano, { edge: 0.45 });
        p.box([u0 + 0.42, u0 + 1.4, 0.28, 0.72, 0.04, 0.24], pano, { edge: 0.35 });
        p.box([u0 + 1.4, u1 - 0.24, 0.31, 0.69, 0.04, 0.16], shade(pano, -0.05), { edge: 0.35 });
        p.box([u1 - 0.24, u1 - 0.06, 0.34, 0.66, 0.04, 0.22], pano, { edge: 0.4 });
        // a mancha no lençol (no saco, o zíper)
        p.box([u0 + 0.7, u0 + 1.1, 0.4, 0.6, 0.24, 0.245], marca);
      }),
    ]);
  },

  // o que alguém largou no chão: uma bolsa de lona com a boca amarrada e um volume ao lado (até chegar a arte)
  pilha(def) {
    const [c0, c1] = def.colors;
    const saco: LBox = [0.3, 0.62, 0.32, 0.64, 0, 0.14];
    const volume: LBox = [0.6, 0.8, 0.5, 0.72, 0, 0.06];
    return V([
      N(saco, (p) => {
        p.box(saco, c0, { edge: 0.3 });
        p.box([0.4, 0.52, 0.42, 0.54, 0.14, 0.18], c1, { edge: 0.2 });
      }),
      N(volume, (p) => p.box(volume, c1, { edge: 0.25 })),
    ]);
  },

  books(def, _s, seed) {
    const r = rng(seed + 8);
    const cols = [def.colors[0], def.colors[1], def.colors[2], '#3a2a1a'];
    const books: LBox[] = [];
    let z = 0;
    for (let i = 0; i < 4; i++) {
      const h = 0.07 + r() * 0.04;
      const du = (r() - 0.5) * 0.1;
      const dv = (r() - 0.5) * 0.1;
      books.push([0.22 + du, 0.78 + du - r() * 0.08, 0.26 + dv, 0.74 + dv - r() * 0.06, z, z + h]);
      z += h;
    }
    return V(
      books.map((b, i) =>
        N(b, (p) => {
          const col = cols[i % cols.length];
          p.box(b, col, { edge: 0.15 });
          for (const f of ['front', 'right', 'back'] as LFace[]) {
            if (!p.m.visible(f)) continue;
            const [a0, a1] = faceRange(b, f);
            p.face(b, f, a0 + 0.02, a1 - 0.02, b[4] + 0.015, b[5] - 0.015, '#e2d6b8');
          }
        }),
      ),
    );
  },

  sigil(def, _s, seed) {
    const [c0] = def.colors;
    return V([
      N([0, 3, 0, 3, 0, 0], (p) => {
        p.withTop(0.004, (ctx) => drawSigil(ctx, 1.5, 1.5, 1.35, c0, seed, true));
      }),
    ]);
  },

  sigil_map(def, _s, seed) {
    const [paper, red] = def.colors;
    return V([
      N([0.05, 0.95, 0.05, 1.95, 0, 0.01], (p) => {
        p.withTop(0.006, (ctx) => {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(0.1, 0.1, 0.88, 1.88);
          ctx.fillStyle = paper;
          ctx.fillRect(0.06, 0.06, 0.88, 1.88);
          ctx.strokeStyle = 'rgba(90,60,30,0.35)';
          ctx.lineWidth = 0.012;
          const r = rng(seed + 1);
          for (let i = 0; i < 9; i++) {
            ctx.beginPath();
            const v = 0.15 + i * 0.2 + (r() - 0.5) * 0.05;
            ctx.moveTo(0.08, v);
            ctx.lineTo(0.92, v + (r() - 0.5) * 0.2);
            ctx.stroke();
          }
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const u = 0.12 + i * 0.18;
            ctx.moveTo(u, 0.08);
            ctx.lineTo(u + (r() - 0.5) * 0.15, 1.92);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(120,90,50,0.18)';
          ctx.beginPath();
          ctx.ellipse(0.7, 1.6, 0.18, 0.25, 0.3, 0, Math.PI * 2);
          ctx.fill();
          drawSigil(ctx, 0.5, 1.0, 0.38, red, seed, false);
          ctx.strokeStyle = red;
          ctx.lineWidth = 0.018;
          for (const [u, v] of [
            [0.25, 0.4],
            [0.75, 0.55],
            [0.3, 1.65],
          ]) {
            ctx.beginPath();
            ctx.arc(u, v, 0.06, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }),
    ]);
  },

  blood(def, _s, seed) {
    const [c0] = def.colors;
    return V([N([0, 2, 0, 2, 0, 0], (p) => p.withTop(0.003, (ctx) => drawBlood(ctx, 1, 1, 0.75, c0, seed, 1)))]);
  },

  blood_small(def, _s, seed) {
    const [c0] = def.colors;
    return V([N([0, 1, 0, 1, 0, 0], (p) => p.withTop(0.003, (ctx) => drawBlood(ctx, 0.5, 0.5, 0.25, c0, seed, 0.5)))]);
  },

  rug(def, _s, seed) {
    const [c0, c1] = def.colors;
    const W = def.width;
    const D = def.depth;
    const b: LBox = [0.05, D - 0.05, 0.05, W - 0.05, 0, 0.03];
    return V([
      N(b, (p) => {
        p.box(b, c0, { edge: 0.05 });
        p.withTop(0.031, (ctx) => {
          ctx.strokeStyle = c1;
          ctx.lineWidth = 0.05;
          ctx.strokeRect(0.2, 0.2, D - 0.4, W - 0.4);
          ctx.lineWidth = 0.02;
          ctx.strokeRect(0.3, 0.3, D - 0.6, W - 0.6);
          ctx.fillStyle = rgba(c1, 0.5);
          const cu = D / 2;
          const cv = W / 2;
          ctx.beginPath();
          ctx.moveTo(cu - 0.4, cv);
          ctx.lineTo(cu, cv - 0.35);
          ctx.lineTo(cu + 0.4, cv);
          ctx.lineTo(cu, cv + 0.35);
          ctx.closePath();
          ctx.fill();
          const r = rng(seed);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.ellipse(0.3 + r() * (D - 0.6), 0.3 + r() * (W - 0.6), 0.1 + r() * 0.2, 0.08 + r() * 0.1, r() * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }),
    ]);
  },

  vent(def) {
    const [c0] = def.colors;
    return V([
      N([0.12, 0.88, 0.12, 0.88, 0, 0.01], (p) => {
        p.withTop(0.004, (ctx) => {
          ctx.fillStyle = '#0a0a0b';
          ctx.fillRect(0.12, 0.12, 0.76, 0.76);
          ctx.fillStyle = c0;
          ctx.fillRect(0.12, 0.12, 0.76, 0.06);
          ctx.fillRect(0.12, 0.82, 0.76, 0.06);
          ctx.fillRect(0.12, 0.12, 0.06, 0.76);
          ctx.fillRect(0.82, 0.12, 0.06, 0.76);
          ctx.fillStyle = shade(c0, 0.2);
          for (let i = 0; i < 7; i++) ctx.fillRect(0.2, 0.22 + i * 0.085, 0.6, 0.035);
          ctx.fillStyle = '#6a6e74';
          for (const [u, v] of [
            [0.15, 0.15],
            [0.85, 0.15],
            [0.15, 0.85],
            [0.85, 0.85],
          ]) {
            ctx.beginPath();
            ctx.arc(u, v, 0.02, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }),
    ]);
  },

  iwall(def) {
    const [c0] = def.colors;
    // parede inteira (2,4 m) ou meia parede, pela altura do mobi
    const b: LBox = [0, 0.22, 0, 1, 0, def.height / Z_PER_M];
    return V([N(b, (p) => wallBlock(p, b, c0))]);
  },

  iwall_door(def) {
    const [c0, wood] = def.colors;
    const jl: LBox = [0, 0.22, 0, 0.14, 0, 2.4];
    const jr: LBox = [0, 0.22, 0.86, 1, 0, 2.4];
    const lintel: LBox = [0, 0.22, 0.14, 0.86, 2.1, 2.4];
    return V([
      N(jl, (p) => (wallBlock(p, jl, c0), p.face(jl, 'right', 0, 0.22, 0, 2.1, wood))),
      N(jr, (p) => (wallBlock(p, jr, c0), p.face(jr, 'left', 0, 0.22, 0, 2.1, wood))),
      N(lintel, (p) => (wallBlock(p, lintel, c0), p.face(lintel, 'front', 0.14, 0.86, 2.1, 2.17, wood))),
    ]);
  },

  iwall_window(def) {
    const [c0, wood] = def.colors;
    const low: LBox = [0, 0.22, 0, 1, 0, 0.95];
    const high: LBox = [0, 0.22, 0, 1, 1.9, 2.4];
    const sl: LBox = [0, 0.22, 0, 0.15, 0.95, 1.9];
    const sr: LBox = [0, 0.22, 0.85, 1, 0.95, 1.9];
    const glass: LBox = [0.09, 0.13, 0.15, 0.85, 0.95, 1.9];
    return V([
      N(low, (p) => (wallBlock(p, low, c0), p.face(low, 'front', 0.1, 0.9, 0.88, 0.95, wood))),
      N(sl, (p) => wallBlock(p, sl, c0)),
      N(glass, (p) => {
        p.poly(
          [
            [0.11, 0.15, 0.95],
            [0.11, 0.85, 0.95],
            [0.11, 0.85, 1.9],
            [0.11, 0.15, 1.9],
          ],
          'rgba(120,150,170,0.22)',
          'rgba(20,16,14,0.9)',
        );
        for (const v of [0.38, 0.62]) p.line([0.11, v, 0.95], [0.11, v, 1.9], '#161412', 1.5);
        p.line([0.11, 0.15, 1.42], [0.11, 0.85, 1.42], '#161412', 1.5);
      }),
      N(sr, (p) => wallBlock(p, sr, c0)),
      N(high, (p) => wallBlock(p, high, c0)),
    ]);
  },

  portal(def, state) {
    const [wood] = def.colors;
    // vão de porta de verdade (VAO_PORTA_M, centrado na casa) por 2,1 m, do tamanho da arte da porta
    const A0 = (1 - VAO_PORTA_M / M_POR_CASA) / 2;
    const A1 = 1 - A0;
    const bt = BATENTE_PORTA_M / M_POR_CASA;
    const H = 2.1;
    const jl: LBox = [0, 0.16, A0 - bt, A0, 0, H];
    const jr: LBox = [0, 0.16, A1, A1 + bt, 0, H];
    const lintel: LBox = [0, 0.16, A0 - bt, A1 + bt, H, H + 0.12];
    const vao: LBox = [0, 0.02, A0, A1, 0, H];
    const folha: LBox = [0.05, 0.1, A0, A1, 0.01, H];
    const soleira: LBox = [0, 0.16, A0 - bt, A1 + bt, 0, 0.03];
    const fechada = state === 1 || state === 2;
    const trancada = state === 2;
    const corFolha = shade(wood, 0.32);
    // na beira da frente do cômodo a parede não aparece: a porta vira soleira, batente baixo e o contorno do vão
    const baixa = (p: Painter) => p.m.rot === 0 || p.m.rot === 6;
    const cadeado = (p: Painter, u: number) => {
      // a tranca de ferro atravessando a porta e o cadeado no meio
      p.poly([[u, A0 - 0.06, 1.0], [u, A1 + 0.06, 1.0], [u, A1 + 0.06, 1.08], [u, A0 - 0.06, 1.08]], '#2b2c30', OUTLINE);
      const m = (A0 + A1) / 2;
      p.poly([[u + 0.01, m - 0.07, 0.86], [u + 0.01, m + 0.07, 0.86], [u + 0.01, m + 0.07, 1.0], [u + 0.01, m - 0.07, 1.0]], '#8a6e36', OUTLINE);
      p.line([u + 0.01, m - 0.04, 1.0], [u + 0.01, m - 0.04, 1.06], '#c9b27a', 1.5);
      p.line([u + 0.01, m + 0.04, 1.0], [u + 0.01, m + 0.04, 1.06], '#c9b27a', 1.5);
    };
    return V([
      // o chão escurece na frente do vão aberto
      N([0.05, 0.95, 0.05, 0.95, 0, 0], (p) => {
        if (fechada || baixa(p)) return;
        p.withTop(0.004, (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 1, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.6)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, A0, 0.9, A1 - A0);
        });
      }),
      naParede(N(vao, (p) => {
        if (baixa(p)) return;
        p.face(vao, 'front', A0, A1, 0, H, '#050404', true);
        // a escuridão do outro lado: um pouco menos escura embaixo, onde bate a luz da sala
        p.withFace(vao, 'front', (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, 'rgba(60,52,46,0.35)');
          g.addColorStop(0.5, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(A0, 0, A1 - A0, H);
        });
      })),
      naParede(N(folha, (p) => {
        if (!fechada) return;
        if (baixa(p)) {
          // a folha fechada, só o contorno, para não tapar a sala
          p.poly([[0.08, A0, 0.03], [0.08, A1, 0.03], [0.08, A1, H], [0.08, A0, H]], 'rgba(150,110,80,0.26)', 'rgba(225,185,140,0.55)');
          if (trancada) cadeado(p, 0.1);
          return;
        }
        p.box(folha, corFolha, { edge: 0.15 });
        p.withFace(folha, 'front', (ctx) => {
          // duas almofadas na madeira e a fresta de luz embaixo
          ctx.fillStyle = shade(corFolha, -0.12);
          ctx.fillRect(A0 + 0.14, 1.2, A1 - A0 - 0.28, 0.75);
          ctx.fillRect(A0 + 0.14, 0.15, A1 - A0 - 0.28, 0.85);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(A0 + 0.14, 1.93, A1 - A0 - 0.28, 0.02);
          ctx.fillRect(A0 + 0.14, 0.98, A1 - A0 - 0.28, 0.02);
        });
        // maçaneta
        p.line([0.12, A1 - 0.16, 1.0], [0.12, A1 - 0.28, 1.0], '#c9a85a', 2.5);
        if (trancada) cadeado(p, 0.12);
      })),
      naParede(N(soleira, (p) => {
        if (baixa(p)) p.box(soleira, shade(wood, 0.1), { edge: 0.25 });
      })),
      naParede(N(jl, (p) => {
        if (!baixa(p)) return p.box(jl, wood, { edge: 0.2 });
        p.box([jl[0], jl[1], jl[2], jl[3], 0, 0.32], wood, { edge: 0.2 });
        p.line([0.08, A0 - 0.05, 0.32], [0.08, A0 - 0.05, H], 'rgba(210,170,130,0.32)', 2);
      })),
      naParede(N(jr, (p) => {
        if (!baixa(p)) return p.box(jr, wood, { edge: 0.2 });
        p.box([jr[0], jr[1], jr[2], jr[3], 0, 0.32], wood, { edge: 0.2 });
        p.line([0.08, A1 + 0.05, 0.32], [0.08, A1 + 0.05, H], 'rgba(210,170,130,0.32)', 2);
      })),
      naParede(N(lintel, (p) => {
        if (!baixa(p)) return p.box(lintel, wood, { edge: 0.25 });
        p.line([0.08, A0 - 0.05, H + 0.06], [0.08, A1 + 0.05, H + 0.06], 'rgba(210,170,130,0.32)', 2);
      })),
    ]);
  },

  ceiling_lamp(def, state) {
    const [lc] = def.colors;
    const on = state === 0;
    return V(
      [
        N([0.4, 0.6, 0.4, 0.6, 2.15, 2.75], (p) => {
          p.line([0.5, 0.5, 2.75], [0.5, 0.5, 2.22], '#141212', 1.2);
          const ctx = p.ctx;
          const [x, y] = p.m.p(0.5, 0.5, 2.21);
          // cúpula
          ctx.fillStyle = '#2a2622';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 3, y - 3);
          ctx.lineTo(x + 3, y - 3);
          ctx.lineTo(x + 9, y + 5);
          ctx.lineTo(x - 9, y + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          const lit = on && p.power > 0.1;
          ctx.fillStyle = lit ? '#fff3c4' : '#4a4640';
          ctx.beginPath();
          ctx.arc(x, y + 6, 3, 0, Math.PI * 2);
          ctx.fill();
          if (lit) {
            const g = ctx.createRadialGradient(x, y + 6, 1, x, y + 6, 16);
            g.addColorStop(0, rgba(lc, 0.6));
            g.addColorStop(1, rgba(lc, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x - 16, y - 10, 32, 32);
          }
        }),
      ],
      lightIf(on, { u: 0.5, v: 0.5, z: 1.95, radius: 210, color: '#ffd98a', intensity: 0.95 }),
    );
  },

  pillar(def, _s, seed) {
    const [c0] = def.colors;
    const base: LBox = [0.1, 0.9, 0.1, 0.9, 0, 0.14];
    const shaft: LBox = [0.2, 0.8, 0.2, 0.8, 0.14, 2.61];
    const cap: LBox = [0.1, 0.9, 0.1, 0.9, 2.61, 2.75];
    const r = rng(seed + 4);
    const cracks = Array.from({ length: 3 }, () => ({ f: (['front', 'right', 'left', 'back'] as LFace[])[Math.floor(r() * 4)], a: 0.3 + r() * 0.4, z: 0.4 + r() * 1.9 }));
    return V([
      B(base, shade(c0, -0.1)),
      N(shaft, (p) => {
        p.box(shaft, c0, { edge: 0.15 });
        for (const c of cracks) {
          if (!p.m.visible(c.f)) continue;
          p.withFace(shaft, c.f, (ctx) => {
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 0.02;
            ctx.beginPath();
            ctx.moveTo(c.a, c.z);
            ctx.lineTo(c.a + 0.05, c.z - 0.15);
            ctx.lineTo(c.a - 0.03, c.z - 0.3);
            ctx.lineTo(c.a + 0.04, c.z - 0.5);
            ctx.stroke();
          });
        }
        for (const f of ['front', 'right', 'left', 'back'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(shaft, f);
          p.face(shaft, f, a0, a1, 0.25, 0.7, 'rgba(0,0,0,0.18)', true);
        }
      }),
      B(cap, shade(c0, -0.05), { edge: 0.25 }),
    ]);
  },
};

// ---------- helpers de desenho livre ----------
function isoC(w: { x0: number; x1: number; y0: number; y1: number }, z: number): [number, number] {
  const x = (w.x0 + w.x1) / 2;
  const y = (w.y0 + w.y1) / 2;
  return [(x - y) * 32, (x + y) * 16 - z * 32];
}

function siloBox(w: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): [number, number][] {
  const I = (x: number, y: number, z: number): [number, number] => [(x - y) * 32, (x + y) * 16 - z * 32];
  return [I(w.x0, w.y0, w.z1), I(w.x1, w.y0, w.z1), I(w.x1, w.y0, w.z0), I(w.x1, w.y1, w.z0), I(w.x0, w.y1, w.z0), I(w.x0, w.y1, w.z1)];
}

function pathPts(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function creature(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // cabeça alongada
  ctx.beginPath();
  ctx.ellipse(x, y - 34, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // tronco
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 24);
  ctx.quadraticCurveTo(x, y - 28, x + 9, y - 24);
  ctx.lineTo(x + 6, y + 2);
  ctx.quadraticCurveTo(x, y + 6, x - 6, y + 2);
  ctx.closePath();
  ctx.fill();
  // braços longos
  const sw = Math.sin(t / 900) * 3;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 20);
  ctx.quadraticCurveTo(x - 20, y - 6 + sw, x - 18, y + 16 + sw);
  ctx.moveTo(x + 8, y - 20);
  ctx.quadraticCurveTo(x + 20, y - 6 - sw, x + 17, y + 17 - sw);
  ctx.stroke();
  // tentáculos/pernas
  ctx.lineWidth = 2.4;
  for (let i = -2; i <= 2; i++) {
    const s = Math.sin(t / 700 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x + i * 2.5, y);
    ctx.quadraticCurveTo(x + i * 6 + s, y + 16, x + i * 7 - s, y + 30);
    ctx.stroke();
  }
  // olhos brilhando
  ctx.fillStyle = 'rgba(220,255,240,0.8)';
  ctx.fillRect(x - 4, y - 36, 2, 1.5);
  ctx.fillRect(x + 2, y - 36, 2, 1.5);
}

/** Sigilo circular com raios, desenhado em coordenadas de plano (unidades de tile). */
export function drawSigil(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string, seed: number, drips: boolean) {
  const r = rng(seed + 77);
  const lw = R * 0.03;
  const stroke = (alpha: number, w: number) => {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = w;
  };
  const ring = (rad: number, a: number, w: number) => {
    for (let k = 0; k < 2; k++) {
      stroke(a * (k ? 0.5 : 1), w * (k ? 0.6 : 1));
      ctx.beginPath();
      ctx.ellipse(cx + (r() - 0.5) * 0.02, cy + (r() - 0.5) * 0.02, rad, rad, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  ring(R, 0.85, lw * 1.4);
  ring(R * 0.92, 0.6, lw * 0.7);
  ring(R * 0.45, 0.8, lw);
  // raios
  const n = 12;
  ctx.fillStyle = rgba(color, 0.85);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.13;
    const long = i % 2 === 0;
    const r0 = R * 0.47;
    const r1 = long ? R * 1.18 : R * 0.9;
    const wA = long ? 0.07 : 0.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - wA) * r0, cy + Math.sin(a - wA) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a + wA) * r0, cy + Math.sin(a + wA) * r0);
    ctx.closePath();
    ctx.fill();
  }
  // símbolo central
  stroke(0.9, lw);
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.2, R * 0.11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(color, 0.9);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.3, cy);
  ctx.lineTo(cx + R * 0.3, cy);
  ctx.moveTo(cx, cy - R * 0.3);
  ctx.lineTo(cx, cy + R * 0.3);
  ctx.stroke();
  // pequenas runas no anel
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const x = cx + Math.cos(a) * R * 0.69;
    const y = cy + Math.sin(a) * R * 0.69;
    stroke(0.75, lw * 0.7);
    ctx.beginPath();
    ctx.moveTo(x - R * 0.04, y - R * 0.05);
    ctx.lineTo(x + R * 0.04, y);
    ctx.lineTo(x - R * 0.03, y + R * 0.05);
    ctx.stroke();
  }
  if (drips) drawBlood(ctx, cx, cy, R * 1.1, color, seed + 3, 0.35, true);
}

/** Mancha de sangue orgânica (coordenadas de plano). */
export function drawBlood(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string, seed: number, amount: number, splatterOnly = false) {
  const r = rng(seed + 31);
  if (!splatterOnly) {
    const blobs = 5 + Math.floor(amount * 6);
    for (let i = 0; i < blobs; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * R * 0.45;
      const rr = R * (0.18 + r() * 0.3) * (i === 0 ? 1.4 : 1);
      ctx.fillStyle = rgba(shade(color, -0.1 - r() * 0.25), 0.85);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rgba(shade(color, 0.25), 0.25);
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.08, cy - R * 0.1, R * 0.15, R * 0.08, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // respingos e escorridos
  const drops = 10 + Math.floor(amount * 18);
  for (let i = 0; i < drops; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.5 + r() * 0.75);
    const rr = R * (0.015 + r() * 0.05);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    ctx.fillStyle = rgba(shade(color, -r() * 0.3), 0.8);
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (r() < 0.35) {
      ctx.strokeStyle = rgba(color, 0.7);
      ctx.lineWidth = rr * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * rr * 5, y + Math.sin(a) * rr * 5);
      ctx.stroke();
    }
  }
}

/** Crânio pixelado olhando para a frente do mobi. */
function skull(p: Painter, u: number, v: number, z: number, scale: number) {
  const ctx = p.ctx;
  const [x, y] = p.m.p(u, v, z);
  const front = p.m.visible('front');
  const mirror = p.m.wface('front') === '+y' || p.m.wface('back') === '+y' ? -1 : 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale * mirror, scale);
  const bone = '#d8cfb8';
  const dark = '#2a1a14';
  const R = (a: number, b: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(a, b, w, h);
  };
  R(-8, -16, 16, 12, OUTLINE);
  R(-7, -17, 14, 14, OUTLINE);
  R(-7, -15, 14, 10, bone);
  R(-6, -16, 12, 12, bone);
  R(3, -15, 3, 10, '#b8ad94');
  if (front) {
    R(-5, -4, 10, 4, OUTLINE);
    R(-4, -4, 8, 3, bone);
    R(-4, -11, 3, 3, dark);
    R(1, -11, 3, 3, dark);
    R(-1, -7, 2, 2, dark);
    for (let i = -3; i < 4; i += 2) R(i, -3, 1, 2, dark);
  } else {
    R(-6, -6, 12, 2, '#b8ad94');
  }
  ctx.restore();
}

const cache = new Map<string, FVisual>();

export function furniVisual(def: FurniDef, state: number, seed: number): FVisual {
  const key = `${def.id}|${state}|${seed}`;
  let v = cache.get(key);
  if (!v) {
    const b = builders[def.kind];
    v = b ? b(def, state, seed) : V([B([0.05, 0.95, 0.05, 0.95, 0, Math.max(0.1, def.height / Z_PER_M)], def.colors[0] ?? '#888')]);
    cache.set(key, v);
    if (cache.size > 2000) cache.clear();
  }
  return v;
}
