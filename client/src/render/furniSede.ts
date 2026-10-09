import { Z_PER_M } from '@crona/shared';
import { rgba, rng, shade } from './color';
import { B, drawers, faceRange, lightIf, N, V, wallBlock, WARM, type Builder, type FNode } from './furniKit';
import { OUTLINE, type LBox, type LFace, type Painter } from './painter';

/*
 * Mobis da Sede da Ordem (bar, dormitório, enfermaria, arsenal...). Medidas
 * em metros na altura (z) e em casas no chão (u = frente, v = lateral), como
 * em furniFloor. São a primeira versão, para montar o mapa; a arte final
 * entra depois, mobi a mobi.
 */

const FACES: LFace[] = ['front', 'back', 'left', 'right'];

/** Garrafa: corpo, ombro e gargalo. */
function bottle(p: Painter, u: number, v: number, z: number, h: number, r: number, color: string) {
  p.cyl(u, v, r, z, z + h * 0.7, color, { top: shade(color, 0.2) });
  p.cyl(u, v, r * 0.45, z + h * 0.7, z + h, shade(color, -0.2), { outline: false });
  p.cyl(u, v, r * 0.5, z + h, z + h + 0.02, '#1a1612', { outline: false });
}

const BOTTLES = ['#6a3a10', '#2f5a24', '#b8c4c0', '#8a1a14', '#3a2410', '#c9a24a', '#1f3a2a'];

export const SEDE_BUILDERS: Record<string, Builder> = {
  // ---------------------------------------------------------------- escadas
  /** Degraus que sobem em direção à parede (para a porta do quarto). */
  stairs_up(def) {
    const [wood, dark] = def.colors;
    const steps = 5;
    const nodes: FNode[] = [
      // vão escuro no alto da escada
      B([0, 0.04, 0.1, 0.9, 0, 2.15], '#050404', { edge: 0 }),
    ];
    for (let i = steps - 1; i >= 0; i--) {
      const u0 = (i / steps) * 0.96;
      const top = ((steps - i) / steps) * 0.9;
      const b: LBox = [u0, u0 + 0.96 / steps + 0.02, 0.1, 0.9, 0, top];
      nodes.push(
        N(b, (p) => {
          p.box(b, shade(wood, -0.08 * i), { edge: 0.25, faces: { front: shade(wood, -0.25) } });
          p.face(b, 'front', 0.1, 0.9, top - 0.03, top, shade(wood, 0.25), true);
        }),
      );
    }
    // corrimãos
    for (const v of [0.07, 0.93]) {
      const rail: LBox = [0, 1, v - 0.02, v + 0.02, 0, 1.8];
      nodes.push(
        N(rail, (p) => {
          p.line([0.98, v, 0], [0.98, v, 0.95], dark, 2);
          p.line([0.98, v, 0.95], [0.02, v, 1.8], dark, 2.5);
          p.line([0.02, v, 1.8], [0.02, v, 0.9], dark, 2);
        }),
      );
    }
    return V(nodes);
  },

  /**
   * Escada escondida (estado 0 = não aparece). Revelada, é um vão na parede
   * com os primeiros degraus descendo para o escuro e uma luz vermelha lá embaixo.
   */
  stairs_down(def, state) {
    if (state !== 1) return V([]);
    const [stone] = def.colors;
    const hole: LBox = [0, 0.05, 0.08, 0.92, 0, 2.15];
    return V(
      [
        N([0.02, 0.9, 0.05, 0.95, 0, 0.01], (p) =>
          p.withTop(0.004, (ctx) => {
            const g = ctx.createLinearGradient(0, 0, 0.9, 0);
            g.addColorStop(0, 'rgba(0,0,0,0.8)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0.02, 0.1, 0.88, 0.8);
          }),
        ),
        N(hole, (p) => {
          if (!p.m.visible('front')) return;
          // batente de concreto
          p.face(hole, 'front', 0.08, 0.92, 0, 2.15, shade(stone, -0.1));
          p.withFace(hole, 'front', (ctx) => {
            ctx.fillStyle = '#040303';
            ctx.fillRect(0.15, 0, 0.7, 2.05);
            // degraus descendo: faixas cada vez mais estreitas e escuras
            for (let k = 0; k < 6; k++) {
              const z = 0.32 - k * 0.055;
              const inset = 0.02 + k * 0.035;
              ctx.fillStyle = `rgba(${150 - k * 18},${118 - k * 16},${96 - k * 14},${0.75 - k * 0.1})`;
              ctx.fillRect(0.15 + inset, z, 0.7 - inset * 2, 0.022);
            }
            // brilho vermelho lá no fundo
            const g = ctx.createRadialGradient(0.5, 0.05, 0, 0.5, 0.05, 0.5);
            g.addColorStop(0, 'rgba(200,30,20,0.45)');
            g.addColorStop(1, 'rgba(200,30,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0.15, 0, 0.7, 0.6);
          });
        }),
      ],
      [{ u: 0.3, v: 0.5, z: 0.2, radius: 90, color: '#ff4a30', intensity: 0.55, flicker: 0.05 }],
    );
  },

  // ---------------------------------------------------------------- bar
  bar_counter(def, _s, seed) {
    const [wood, top, brass] = def.colors;
    const W = def.width;
    const body: LBox = [0.12, 0.98, 0, W, 0, 1.02];
    const board: LBox = [0.02, 1.02, 0, W, 1.02, 1.1];
    const r = rng(seed + 31);
    const nodes: FNode[] = [
      N(body, (p) => {
        p.box(body, wood, { edge: 0.12 });
        for (const f of FACES) {
          if (!p.m.visible(f) || f === 'back') continue;
          const [a0, a1] = faceRange(body, f);
          // ripas verticais e rodapé escuro
          for (let a = a0 + 0.12; a < a1 - 0.05; a += 0.16) p.face(body, f, a, a + 0.018, 0.08, 0.98, shade(wood, -0.35));
          p.face(body, f, a0, a1, 0, 0.08, '#140c0a');
        }
        // apoio de pé de latão
        p.line([1.04, 0.05, 0.16], [1.04, W - 0.05, 0.16], brass, 2);
      }),
      B(board, top, { edge: 0.35, faces: { front: shade(brass, -0.25) } }),
    ];
    // quase nada em cima: um copo sujo ou uma garrafa aqui e ali
    for (let v = 0.35; v < W - 0.2; v += 0.55 + r() * 0.35) {
      if (r() < 0.55) continue;
      const u = 0.35 + r() * 0.35;
      const vv = v;
      if (r() < 0.35) {
        const col = BOTTLES[Math.floor(r() * BOTTLES.length)];
        nodes.push(N([u - 0.06, u + 0.06, vv - 0.06, vv + 0.06, 1.1, 1.42], (p) => bottle(p, u, vv, 1.1, 0.3, 0.045, col)));
      } else {
        nodes.push(
          N([u - 0.06, u + 0.06, vv - 0.06, vv + 0.06, 1.1, 1.22], (p) => {
            p.cyl(u, vv, 0.045, 1.1, 1.22, 'rgba(210,225,230,0.55)', { top: 'rgba(230,200,120,0.7)' });
          }),
        );
      }
    }
    return V(nodes);
  },

  /** Prateleira do bar: quase vazia, umas garrafas em pé, uma deitada, poeira. */
  bar_shelf(def, _s, seed) {
    const [wood, dark] = def.colors;
    const W = def.width;
    const r = rng(seed * 11 + 7);
    const back: LBox = [0.04, 0.1, 0, W, 0, 2.1];
    const cab: LBox = [0.1, 0.62, 0.02, W - 0.02, 0, 0.85];
    const nodes: FNode[] = [
      N(back, (p) => {
        p.box(back, shade(dark, -0.1), { edge: 0 });
        // espelho encardido atrás das garrafas
        p.face(back, 'front', 0.1, W - 0.1, 0.95, 1.95, 'rgba(90,100,95,0.28)', true);
        p.withFace(back, 'front', (ctx) => {
          ctx.fillStyle = 'rgba(40,30,15,0.35)';
          for (let i = 0; i < 5; i++) ctx.fillRect(0.15 + r() * (W - 0.4), 1.0 + r() * 0.8, 0.12 + r() * 0.2, 0.05 + r() * 0.08);
        });
      }),
      N(cab, (p) => {
        p.box(cab, wood, { edge: 0.12 });
        drawers(p, cab, 'front', 1, Math.round(W * 2), shade(wood, -0.1), '#6a5a3a');
      }),
    ];
    for (const z of [0.85, 1.35, 1.8]) {
      const shelf: LBox = [0.1, 0.5, 0.02, W - 0.02, z, z + 0.04];
      nodes.push(
        N(shelf, (p) => {
          p.box(shelf, wood, { edge: 0.15 });
          p.withTop(z + 0.041, (ctx) => {
            ctx.fillStyle = 'rgba(150,140,120,0.18)';
            ctx.fillRect(0.12, 0.05, 0.36, W - 0.1);
          });
        }),
      );
      // poucas bebidas: uma ou duas em pé por prateleira, às vezes nenhuma
      const list: { v: number; h: number; c: string; rr: number }[] = [];
      const n = Math.floor(r() * 3);
      for (let i = 0; i < n; i++) list.push({ v: 0.2 + r() * (W - 0.4), h: 0.22 + r() * 0.12, c: BOTTLES[Math.floor(r() * BOTTLES.length)], rr: 0.035 + r() * 0.012 });
      const lying = r() < 0.35 ? 0.3 + r() * (W - 0.8) : -1;
      if (!list.length && lying < 0) continue;
      nodes.push(
        N([0.2, 0.42, 0.1, W - 0.1, z + 0.04, z + 0.42], (p) => {
          for (const b of list.sort((x, y) => x.v - y.v)) bottle(p, 0.3, b.v, z + 0.04, b.h, b.rr, b.c);
          if (lying >= 0) {
            const bb: LBox = [0.26, 0.34, lying, lying + 0.3, z + 0.04, z + 0.1];
            p.box(bb, '#3a5a2a', { edge: 0.3 });
          }
        }),
      );
    }
    nodes.push(B([0.04, 0.55, 0, W, 2.06, 2.1], wood, { edge: 0.3 }));
    return V(nodes);
  },

  /** Geladeira de porta de vidro, acesa por dentro (apaga no apagão). */
  beer_fridge(def, _s, seed) {
    const [body, glow] = def.colors;
    // desenhada para 2 m; mais baixa (frigobar), encolhe por igual
    const k = Math.min(1, def.height / Z_PER_M / 2.0);
    const b: LBox = [0.1, 0.92, 0.06, 0.94, 0, 2.0 * k];
    const r = rng(seed + 5);
    const rows = [0.25, 0.62, 0.99, 1.36].map((z) => Array.from({ length: 5 }, (_, i) => ({ a: 0.2 + i * 0.13 + r() * 0.02, h: 0.16 + r() * 0.08, c: BOTTLES[Math.floor(r() * 4)], z })));
    return V(
      [
        N(b, (p) => {
          p.box(b, body, { edge: 0.2 });
          if (!p.m.visible('front')) return;
          const lit = p.power > 0.1;
          // placa acesa no alto
          p.face(b, 'front', 0.1, 0.9, 1.74 * k, 1.94 * k, lit ? glow : shade(glow, -0.7), true);
          p.withFace(b, 'front', (ctx) => {
            ctx.scale(1, k);
            ctx.fillStyle = lit ? 'rgba(120,20,10,0.8)' : 'rgba(40,10,10,0.8)';
            ctx.fillRect(0.2, 1.8, 0.6, 0.02);
            ctx.fillRect(0.3, 1.86, 0.4, 0.02);
            // vidro: fundo aceso, prateleiras e garrafas
            const g = ctx.createLinearGradient(0, 1.65, 0, 0.1);
            g.addColorStop(0, lit ? rgba(glow, 0.95) : 'rgba(30,26,20,0.95)');
            g.addColorStop(1, lit ? rgba(shade(glow, -0.35), 0.95) : 'rgba(14,12,10,0.95)');
            ctx.fillStyle = g;
            ctx.fillRect(0.12, 0.1, 0.76, 1.58);
            for (const row of rows) {
              ctx.fillStyle = 'rgba(60,40,20,0.6)';
              ctx.fillRect(0.12, row[0].z - 0.02, 0.76, 0.02);
              for (const bt of row) {
                ctx.fillStyle = lit ? bt.c : shade(bt.c, -0.6);
                ctx.fillRect(bt.a, row[0].z, 0.07, bt.h * 0.72);
                ctx.fillRect(bt.a + 0.02, row[0].z + bt.h * 0.72, 0.03, bt.h * 0.28);
              }
            }
            // reflexo e puxador
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fillRect(0.2, 0.12, 0.04, 1.5);
            ctx.fillRect(0.3, 0.12, 0.015, 1.5);
            ctx.fillStyle = '#c9c4bc';
            ctx.fillRect(0.8, 0.7, 0.03, 0.45);
          });
          p.face(b, 'front', 0.1, 0.9, 0, 0.1 * k, '#1a1210');
        }),
      ],
      [{ u: 1.05, v: 0.5, z: 1.1 * k, radius: 125 * (0.5 + k / 2), color: glow, intensity: 0.75, kind: 'electric' }],
    );
  },

  pool_table(def) {
    const [felt, wood] = def.colors;
    const W = def.width;
    const D = def.depth;
    const legs: LBox[] = [
      [0.2, 0.42, 0.18, 0.4, 0, 0.55],
      [D - 0.42, D - 0.2, 0.18, 0.4, 0, 0.55],
      [0.2, 0.42, W - 0.4, W - 0.18, 0, 0.55],
      [D - 0.42, D - 0.2, W - 0.4, W - 0.18, 0, 0.55],
    ];
    const apron: LBox = [0.1, D - 0.1, 0.1, W - 0.1, 0.55, 0.74];
    const rails: LBox = [0, D, 0, W, 0.74, 0.85];
    return V(
      [
        ...legs.map((l) => B(l, shade(wood, -0.15))),
        B(apron, wood, { edge: 0.2 }),
        N(rails, (p) => {
          p.box(rails, wood, { edge: 0.35 });
          p.withTop(0.851, (ctx) => {
            const g = ctx.createRadialGradient(D / 2, W / 2, 0.1, D / 2, W / 2, D * 0.6);
            g.addColorStop(0, shade(felt, 0.1));
            g.addColorStop(1, shade(felt, -0.3));
            ctx.fillStyle = g;
            ctx.fillRect(0.14, 0.14, D - 0.28, W - 0.28);
            ctx.fillStyle = '#060504';
            for (const [u, v] of [
              [0.16, 0.16],
              [D / 2, 0.12],
              [D - 0.16, 0.16],
              [0.16, W - 0.16],
              [D / 2, W - 0.12],
              [D - 0.16, W - 0.16],
            ]) {
              ctx.beginPath();
              ctx.arc(u, v, 0.09, 0, Math.PI * 2);
              ctx.fill();
            }
            // bolas e o taco
            const balls: [number, number, string][] = [
              [D * 0.72, W * 0.5, '#f2efe6'],
              [D * 0.3, W * 0.42, '#c8352b'],
              [D * 0.34, W * 0.58, '#e0b43a'],
              [D * 0.26, W * 0.55, '#2a4ab0'],
              [D * 0.3, W * 0.66, '#1a1a1a'],
            ];
            for (const [u, v, c] of balls) {
              ctx.fillStyle = c;
              ctx.beginPath();
              ctx.arc(u, v, 0.055, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.strokeStyle = '#c9a26a';
            ctx.lineWidth = 0.035;
            ctx.beginPath();
            ctx.moveTo(D * 0.8, W * 0.52);
            ctx.lineTo(D - 0.2, W * 0.9);
            ctx.stroke();
          });
        }),
        // luminária comprida pendurada sobre a mesa
        N([D / 2 - 0.6, D / 2 + 0.6, W / 2 - 0.2, W / 2 + 0.2, 1.95, 2.75], (p) => {
          p.line([D / 2 - 0.4, W / 2, 2.75], [D / 2 - 0.4, W / 2, 2.05], '#141212', 1);
          p.line([D / 2 + 0.4, W / 2, 2.75], [D / 2 + 0.4, W / 2, 2.05], '#141212', 1);
          const shadeB: LBox = [D / 2 - 0.6, D / 2 + 0.6, W / 2 - 0.16, W / 2 + 0.16, 1.95, 2.05];
          p.box(shadeB, '#1f3a26', { edge: 0.3 });
        }),
      ],
      [{ u: D / 2, v: W / 2, z: 1.7, radius: 200, color: '#ffe6a8', intensity: 0.85, kind: 'electric' }],
    );
  },

  jukebox(def, state) {
    const [body, neon, neon2] = def.colors;
    const on = state === 0;
    const b: LBox = [0.25, 0.9, 0.12, 0.88, 0, 1.25];
    const cap: LBox = [0.25, 0.9, 0.12, 0.88, 1.25, 1.55];
    return V(
      [
        N(b, (p) => {
          p.box(b, body, { edge: 0.2 });
          if (!p.m.visible('front')) return;
          const lit = on && p.power > 0.1;
          const c1 = lit ? neon : shade(neon, -0.65);
          const c2 = lit ? neon2 : shade(neon2, -0.65);
          p.face(b, 'front', 0.14, 0.2, 0.1, 1.2, c1, true);
          p.face(b, 'front', 0.8, 0.86, 0.1, 1.2, c1, true);
          p.face(b, 'front', 0.26, 0.74, 0.62, 1.12, lit ? '#2a1a14' : '#140c0a', true);
          p.withFace(b, 'front', (ctx) => {
            // disco e grade do alto-falante
            ctx.fillStyle = lit ? '#0c0808' : '#060404';
            ctx.beginPath();
            ctx.ellipse(0.5, 0.87, 0.16, 0.16, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = c2;
            ctx.beginPath();
            ctx.ellipse(0.5, 0.87, 0.04, 0.04, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 0.015;
            for (let z = 0.15; z < 0.5; z += 0.06) {
              ctx.beginPath();
              ctx.moveTo(0.28, z);
              ctx.lineTo(0.72, z);
              ctx.stroke();
            }
          });
        }),
        N(cap, (p) => {
          p.box(cap, shade(body, 0.1), { edge: 0.3 });
          if (p.m.visible('front')) p.face(cap, 'front', 0.14, 0.86, 1.3, 1.5, on && p.power > 0.1 ? neon2 : shade(neon2, -0.65), true);
        }),
      ],
      lightIf(on, { u: 1, v: 0.5, z: 0.9, radius: 115, color: neon, intensity: 0.7, kind: 'electric' }),
    );
  },

  stool_high(def) {
    const [seat, metal] = def.colors;
    return V([
      N([0.2, 0.8, 0.2, 0.8, 0, 0.78], (p) => {
        p.disc(0.5, 0.5, 0.2, 0.01, shade(metal, 0.1), OUTLINE);
        p.cyl(0.5, 0.5, 0.035, 0.01, 0.7, metal);
        const ctx = p.ctx;
        const [x, y] = p.m.p(0.5, 0.5, 0.28);
        ctx.strokeStyle = shade(metal, 0.25);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y, 0.16 * 45.25, 0.16 * 22.63, 0, 0, Math.PI * 2);
        ctx.stroke();
        p.cyl(0.5, 0.5, 0.24, 0.68, 0.76, seat, { top: shade(seat, 0.12) });
      }),
    ]);
  },

  // ---------------------------------------------------------------- dormitório
  /** Cama de solteiro: cabeceira no fundo (u = 0), cobertor até os pés. */
  bed(def) {
    const [blanket, frame, sheet] = def.colors;
    const D = def.depth;
    // de solteiro (1 casa) ou de casal (2 casas, dois travesseiros)
    const W = def.width;
    const legs: LBox[] = [
      [0.04, 0.12, 0.05, 0.13, 0, 0.2],
      [D - 0.12, D - 0.04, 0.05, 0.13, 0, 0.2],
      [0.04, 0.12, W - 0.13, W - 0.05, 0, 0.2],
      [D - 0.12, D - 0.04, W - 0.13, W - 0.05, 0, 0.2],
    ];
    const base: LBox = [0.04, D - 0.04, 0.04, W - 0.04, 0.2, 0.32];
    const mattress: LBox = [0.1, D - 0.07, 0.07, W - 0.07, 0.32, 0.48];
    const pillows: LBox[] = W > 1 ? [[0.16, 0.62, 0.14, W / 2 - 0.06, 0.48, 0.58], [0.16, 0.62, W / 2 + 0.06, W - 0.14, 0.48, 0.58]] : [[0.16, 0.62, 0.14, 0.86, 0.48, 0.58]];
    const cover: LBox = [0.8, D - 0.05, 0.05, W - 0.05, 0.32, 0.53];
    const head: LBox = [0.01, 0.08, 0.02, W - 0.02, 0, 0.95];
    return V([
      B(head, frame, { edge: 0.25 }),
      ...legs.map((l) => B(l, frame)),
      B(base, frame, { edge: 0.15 }),
      B(mattress, sheet, { edge: 0.2 }),
      ...pillows.map((b) => B(b, shade(sheet, 0.1), { edge: 0.3 })),
      N(cover, (p) => {
        p.box(cover, blanket, { edge: 0.2 });
        p.withTop(0.531, (ctx) => {
          // dobra na ponta do cobertor
          ctx.fillStyle = shade(blanket, 0.18);
          ctx.fillRect(0.8, 0.05, 0.16, W - 0.1);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 0.02;
          for (let u = 1.2; u < D - 0.2; u += 0.45) {
            ctx.beginPath();
            ctx.moveTo(u, 0.1);
            ctx.lineTo(u + 0.08, W - 0.1);
            ctx.stroke();
          }
        });
      }),
    ]);
  },

  /** Beliche: duas camas de solteiro empilhadas, quatro postes, a escadinha no pé e a cabeceira no fundo. */
  beliche(def) {
    const [blanket, frame, sheet] = def.colors;
    const D = def.depth;
    const W = def.width;
    const H = def.height;
    const post = (u0: number, u1: number, v0: number, v1: number): LBox => [u0, u1, v0, v1, 0, H];
    const posts: LBox[] = [
      post(0.02, 0.1, 0.03, 0.12),
      post(D - 0.1, D - 0.02, 0.03, 0.12),
      post(0.02, 0.1, W - 0.12, W - 0.03),
      post(D - 0.1, D - 0.02, W - 0.12, W - 0.03),
    ];
    // cada cama: estrado, colchão, travesseiro e cobertor; a de baixo perto do chão, a de cima um degrau (0,3 m) mais alta
    // do que a conta de uma cama de beliche comum; os postes passam só um pouco da cama de cima, não vão até o teto
    const cama = (z: number, cor: string): FNode[] => {
      const base: LBox = [0.04, D - 0.04, 0.04, W - 0.04, z, z + 0.1];
      const colchao: LBox = [0.1, D - 0.07, 0.07, W - 0.07, z + 0.1, z + 0.26];
      const trav: LBox = [0.16, 0.62, 0.14, W - 0.14, z + 0.26, z + 0.36];
      const manta: LBox = [0.8, D - 0.05, 0.05, W - 0.05, z + 0.1, z + 0.31];
      return [
        B(base, frame, { edge: 0.15 }),
        B(colchao, sheet, { edge: 0.2 }),
        B(trav, shade(sheet, 0.1), { edge: 0.3 }),
        B(manta, cor, { edge: 0.2 }),
      ];
    };
    // a grade de proteção da cama de cima e a escadinha no pé, do lado de fora
    const grade: LBox = [0.1, D - 0.1, W - 0.1, W - 0.06, 1.4, 1.58];
    const degraus: LBox[] = [0.3, 0.64, 0.98, 1.32].map((z): LBox => [D - 0.06, D + 0.02, 0.2, W - 0.2, z, z + 0.05]);
    return V([
      B([0.01, 0.08, 0.02, W - 0.02, 0, H], frame, { edge: 0.25 }),
      ...posts.map((b) => B(b, frame)),
      ...cama(0.28, blanket),
      ...cama(1.28, shade(blanket, -0.12)),
      B(grade, frame, { edge: 0.2 }),
      ...degraus.map((b) => B(b, shade(frame, 0.12), { edge: 0.2 })),
    ]);
  },

  nightstand(def) {
    const [wood, brass] = def.colors;
    const b: LBox = [0.14, 0.86, 0.14, 0.86, 0, 0.56];
    const top: LBox = [0.1, 0.9, 0.1, 0.9, 0.56, 0.6];
    return V([
      N(b, (p) => {
        p.box(b, wood, { edge: 0.15 });
        drawers(p, b, 'front', 2, 1, wood, brass);
      }),
      B(top, shade(wood, 0.08), { edge: 0.3 }),
    ]);
  },

  bench(def) {
    const [wood, dark] = def.colors;
    const W = def.width;
    const seat: LBox = [0.25, 0.85, 0.04, W - 0.04, 0.38, 0.46];
    const legs: LBox[] = [
      [0.3, 0.8, 0.16, 0.24, 0, 0.38],
      [0.3, 0.8, W - 0.24, W - 0.16, 0, 0.38],
    ];
    return V([...legs.map((l) => B(l, dark)), B([0.5, 0.58, 0.24, W - 0.24, 0.14, 0.2], dark), B(seat, wood, { edge: 0.3 })]);
  },

  // ---------------------------------------------------------------- salas
  table_round(def) {
    const [top, base] = def.colors;
    const W = def.width;
    const c = W / 2;
    return V([
      N([c - 0.35, c + 0.35, c - 0.35, c + 0.35, 0, 0.7], (p) => {
        p.disc(c, c, 0.34, 0.01, shade(base, -0.1), OUTLINE);
        p.cyl(c, c, 0.1, 0.01, 0.7, base);
      }),
      N([0.04, W - 0.04, 0.04, W - 0.04, 0.7, 0.76], (p) => {
        p.cyl(c, c, c - 0.05, 0.7, 0.76, top, { top: shade(top, 0.1) });
        const ctx = p.ctx;
        const [x, y] = p.m.p(c, c, 0.76);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (c - 0.2) * 45.25, (c - 0.2) * 22.63, 0, 0, Math.PI * 2);
        ctx.stroke();
      }),
    ]);
  },

  table_chess(def) {
    const [dark, light] = def.colors;
    return V([
      N([0.3, 0.7, 0.3, 0.7, 0, 0.66], (p) => {
        p.disc(0.5, 0.5, 0.22, 0.01, dark, OUTLINE);
        p.cyl(0.5, 0.5, 0.06, 0.01, 0.66, dark);
      }),
      N([0.1, 0.9, 0.1, 0.9, 0.66, 0.72], (p) => {
        const top: LBox = [0.1, 0.9, 0.1, 0.9, 0.66, 0.72];
        p.box(top, dark, { edge: 0.3 });
        p.withTop(0.721, (ctx) => {
          const s = 0.7 / 8;
          for (let i = 0; i < 8; i++)
            for (let j = 0; j < 8; j++) {
              ctx.fillStyle = (i + j) % 2 ? light : shade(dark, 0.15);
              ctx.fillRect(0.15 + i * s, 0.15 + j * s, s, s);
            }
        });
        for (const [u, v, c] of [
          [0.3, 0.35, light],
          [0.62, 0.55, '#141414'],
          [0.45, 0.7, light],
        ] as [number, number, string][])
          p.cyl(u, v, 0.025, 0.72, 0.8, c, { outline: false });
      }),
    ]);
  },

  armchair(def) {
    const [c0] = def.colors;
    const base: LBox = [0.2, 0.95, 0.02, 0.98, 0, 0.26];
    const back: LBox = [0.04, 0.24, 0.02, 0.98, 0, 0.95];
    const seat: LBox = [0.24, 0.95, 0.16, 0.84, 0.26, 0.45];
    const arms: LBox[] = [
      [0.24, 0.95, 0.02, 0.18, 0.26, 0.66],
      [0.24, 0.95, 0.82, 0.98, 0.26, 0.66],
    ];
    return V([B(back, c0, { edge: 0.15 }), B(base, shade(c0, -0.25)), B(seat, shade(c0, 0.06), { edge: 0.2 }), ...arms.map((a) => B(a, c0, { edge: 0.2 }))]);
  },

  altar(def) {
    const [stone, cloth] = def.colors;
    const W = def.width;
    const b: LBox = [0.1, 0.9, 0.05, W - 0.05, 0, 1.0];
    return V([
      N(b, (p) => {
        p.box(b, stone, { edge: 0.2 });
        for (const f of FACES) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(b, f);
          p.face(b, f, a0, a1, 0.12, 0.16, shade(stone, -0.3));
          p.face(b, f, a0, a1, 0.84, 0.88, shade(stone, -0.3));
        }
        // pano vermelho por cima e caindo na frente
        p.withTop(1.001, (ctx) => {
          ctx.fillStyle = cloth;
          ctx.fillRect(0.1, W / 2 - 0.3, 0.8, 0.6);
        });
        p.face(b, 'front', W / 2 - 0.3, W / 2 + 0.3, 0.5, 1.0, cloth, false);
      }),
    ]);
  },

  // ---------------------------------------------------------------- banheiro e enfermaria
  toilet(def) {
    const [c0] = def.colors;
    const tank: LBox = [0.08, 0.3, 0.24, 0.76, 0.3, 0.85];
    return V([
      B(tank, c0, { edge: 0.25 }),
      N([0.3, 0.9, 0.25, 0.75, 0, 0.45], (p) => {
        p.cyl(0.6, 0.5, 0.14, 0, 0.36, shade(c0, -0.05));
        p.cyl(0.6, 0.5, 0.22, 0.36, 0.44, c0, { top: shade(c0, 0.05) });
        p.disc(0.6, 0.5, 0.13, 0.441, '#9aa4a8');
      }),
    ]);
  },

  sink(def) {
    const [c0, metal] = def.colors;
    const basin: LBox = [0.15, 0.8, 0.14, 0.86, 0.72, 0.9];
    return V([
      N([0.35, 0.55, 0.4, 0.6, 0, 0.72], (p) => p.cyl(0.45, 0.5, 0.08, 0, 0.72, shade(c0, -0.08))),
      N(basin, (p) => {
        p.box(basin, c0, { edge: 0.3 });
        p.withTop(0.901, (ctx) => {
          ctx.fillStyle = '#9aa4a8';
          ctx.fillRect(0.3, 0.26, 0.42, 0.48);
        });
        p.cyl(0.22, 0.5, 0.025, 0.9, 1.05, metal);
        p.line([0.22, 0.5, 1.05], [0.36, 0.5, 1.02], metal, 2);
      }),
    ]);
  },

  /** Leito com a cabeceira levantada, lençol verde e grades de metal. */
  hospital_bed(def) {
    const [sheet, metal] = def.colors;
    const D = def.depth;
    const frame: LBox = [0.05, D - 0.05, 0.05, 0.95, 0.3, 0.42];
    const mattress: LBox = [0.9, D - 0.08, 0.08, 0.92, 0.42, 0.56];
    const cover: LBox = [1.3, D - 0.08, 0.06, 0.94, 0.42, 0.6];
    const nodes: FNode[] = [
      B([0.02, 0.08, 0.05, 0.95, 0.3, 1.0], metal, { edge: 0.3 }),
      ...[
        [0.1, 0.1],
        [D - 0.1, 0.1],
        [0.1, 0.9],
        [D - 0.1, 0.9],
      ].map(([u, v]) =>
        N([u - 0.05, u + 0.05, v - 0.05, v + 0.05, 0, 0.3], (p) => {
          p.cyl(u, v, 0.02, 0.06, 0.3, metal);
          p.disc(u, v, 0.05, 0.03, '#1a1a1a', OUTLINE);
        }),
      ),
      B(frame, metal, { edge: 0.2 }),
      N([0.1, 0.92, 0.08, 0.92, 0.42, 0.95], (p) => {
        // encosto inclinado com o travesseiro
        p.poly(
          [
            [0.9, 0.08, 0.5],
            [0.9, 0.92, 0.5],
            [0.14, 0.92, 0.92],
            [0.14, 0.08, 0.92],
          ],
          '#e8ecee',
          OUTLINE,
        );
        p.poly(
          [
            [0.62, 0.2, 0.68],
            [0.62, 0.8, 0.68],
            [0.24, 0.8, 0.9],
            [0.24, 0.2, 0.9],
          ],
          '#ffffff',
          'rgba(0,0,0,0.3)',
        );
      }),
      B(mattress, '#e8ecee', { edge: 0.2 }),
      B(cover, sheet, { edge: 0.25 }),
      B([D - 0.08, D - 0.02, 0.05, 0.95, 0.3, 0.78], metal, { edge: 0.3 }),
    ];
    for (const v of [0.03, 0.97]) nodes.push(N([0.9, 2.1, v - 0.02, v + 0.02, 0.42, 0.8], (p) => p.line([0.9, v, 0.78], [2.1, v, 0.78], metal, 2)));
    return V(nodes);
  },

  iv_stand(def) {
    const [metal, bag] = def.colors;
    return V([
      N([0.25, 0.75, 0.25, 0.75, 0, 1.9], (p) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          p.line([0.5, 0.5, 0.05], [0.5 + Math.cos(a) * 0.22, 0.5 + Math.sin(a) * 0.22, 0.03], '#2a2d31', 2.5);
        }
        p.cyl(0.5, 0.5, 0.018, 0.05, 1.85, metal);
        p.line([0.5, 0.36, 1.84], [0.5, 0.64, 1.84], metal, 2);
        const bagB: LBox = [0.46, 0.54, 0.32, 0.44, 1.45, 1.78];
        p.box(bagB, rgba(bag, 0.75), { edge: 0.4 });
        p.line([0.5, 0.38, 1.45], [0.62, 0.3, 0.8], 'rgba(220,235,240,0.7)', 1);
      }),
    ]);
  },

  medical_cabinet(def) {
    const [white, red] = def.colors;
    const W = def.width;
    const low: LBox = [0.12, 0.9, 0.02, W - 0.02, 0, 0.85];
    const high: LBox = [0.12, 0.62, 0.02, W - 0.02, 0.85, 1.9];
    return V([
      N(low, (p) => {
        p.box(low, white, { edge: 0.2 });
        drawers(p, low, 'front', 1, Math.round(W * 2), white, '#8a9098');
      }),
      N(high, (p) => {
        p.box(high, white, { edge: 0.25 });
        if (!p.m.visible('front')) return;
        p.withFace(high, 'front', (ctx) => {
          ctx.fillStyle = 'rgba(160,190,200,0.35)';
          ctx.fillRect(0.08, 0.95, W - 0.16, 0.8);
          const cols = ['#c9a24a', '#8a1a14', '#3a6a9a', '#e8e4dc', '#4a8a4a'];
          for (const z of [1.02, 1.3, 1.56]) {
            ctx.fillStyle = 'rgba(80,90,95,0.7)';
            ctx.fillRect(0.08, z - 0.02, W - 0.16, 0.015);
            for (let a = 0.14, i = 0; a < W - 0.2; a += 0.13, i++) {
              ctx.fillStyle = cols[(i + Math.round(z * 10)) % cols.length];
              ctx.fillRect(a, z, 0.08, 0.14 + (i % 3) * 0.03);
            }
          }
          // cruz vermelha no alto
          ctx.fillStyle = red;
          ctx.fillRect(W / 2 - 0.12, 1.8, 0.24, 0.05);
          ctx.fillRect(W / 2 - 0.025, 1.76, 0.05, 0.13);
        });
      }),
    ]);
  },

  divider(def) {
    const [cloth, metal] = def.colors;
    const b: LBox = [0.46, 0.54, 0.02, 0.98, 0.12, 1.6];
    return V([
      N(b, (p) => {
        for (const v of [0.05, 0.95]) {
          p.line([0.5, v, 0], [0.5, v, 1.62], metal, 2);
          p.line([0.3, v, 0.02], [0.7, v, 0.02], metal, 2);
        }
        p.box(b, rgba(cloth, 0.92), { edge: 0.1 });
        for (const f of ['left', 'right'] as LFace[]) {
          if (!p.m.visible(f)) continue;
          p.withFace(b, f, (ctx) => {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.02;
            for (let a = 0.1; a < 1; a += 0.12) {
              ctx.beginPath();
              ctx.moveTo(a, 0.15);
              ctx.lineTo(a + 0.02, 1.58);
              ctx.stroke();
            }
          });
        }
      }),
    ]);
  },

  // ---------------------------------------------------------------- arsenal
  weapon_rack(def) {
    const [c0, c1] = def.colors;
    const W = def.width;
    const back: LBox = [0.04, 0.1, 0, W, 0, 2.0];
    const sides: LBox[] = [
      [0.1, 0.62, 0, 0.06, 0, 2.0],
      [0.1, 0.62, W - 0.06, W, 0, 2.0],
    ];
    const drawer: LBox = [0.1, 0.62, 0.06, W - 0.06, 0, 0.45];
    const nodes: FNode[] = [B(back, shade(c1, -0.1)), ...sides.map((s) => B(s, c0))];
    nodes.push(
      N(drawer, (p) => {
        p.box(drawer, c0, { edge: 0.2 });
        drawers(p, drawer, 'front', 1, 2, c0, '#8a8f96');
      }),
    );
    // fuzis em pé, apoiados na trava
    const guns: FNode[] = [];
    for (let v = 0.3; v < W - 0.15; v += 0.34) {
      const b: LBox = [0.22, 0.36, v - 0.05, v + 0.05, 0.47, 1.75];
      guns.push(
        N(b, (p) => {
          p.box([0.24, 0.34, v - 0.04, v + 0.04, 0.47, 0.82], '#4a3222', { edge: 0.1 });
          p.box([0.26, 0.32, v - 0.025, v + 0.025, 0.82, 1.3], '#1c1d20', { edge: 0.2 });
          p.box([0.27, 0.31, v - 0.012, v + 0.012, 1.3, 1.75], '#2e3035', { edge: 0.2 });
        }),
      );
    }
    nodes.push(...guns, B([0.1, 0.62, 0.06, W - 0.06, 1.2, 1.24], c0), B([0.04, 0.64, 0, W, 1.96, 2.0], c0, { edge: 0.3 }));
    return V(nodes);
  },

  /** Bancada de computadores: dois monitores na borda de trás, teclado e mouse (tela apaga no apagão). */
  console(def, state, seed) {
    const [body, edge, glow] = def.colors;
    const on = state === 0;
    const W = def.width;
    const top: LBox = [0.02, 0.98, 0, W, 0.72, 0.78];
    const cab: LBox = [0.1, 0.9, 0.04, W - 0.04, 0, 0.72];
    const nodes: FNode[] = [
      N(cab, (p) => {
        p.box(cab, body, { edge: 0.15 });
        if (p.m.visible('front')) p.face(cab, 'front', 0.04, W - 0.04, 0.6, 0.64, edge, true);
      }),
      B(top, shade(body, 0.12), { edge: 0.4, faces: { front: edge } }),
    ];
    const r = rng(seed + 3);
    for (const v of [W * 0.28, W * 0.72]) {
      const scr: LBox = [0.12, 0.2, v - 0.34, v + 0.34, 0.8, 1.22];
      nodes.push(
        N(scr, (p) => {
          p.box([0.18, 0.24, v - 0.04, v + 0.04, 0.78, 0.84], '#141216');
          p.box(scr, '#141216', { edge: 0.2 });
          if (!p.m.visible('front')) return;
          const lit = on && p.power > 0.1;
          p.face(scr, 'front', v - 0.3, v + 0.3, 0.83, 1.19, lit ? shade(glow, -0.55) : '#08090b', true);
          if (!lit) return;
          p.withFace(scr, 'front', (ctx) => {
            ctx.fillStyle = rgba(glow, 0.7);
            for (let i = 0; i < 5; i++) ctx.fillRect(v - 0.26, 0.88 + i * 0.06, 0.1 + r() * 0.4, 0.018);
          });
        }),
      );
    }
    nodes.push(
      N([0.45, 0.75, 0.3, W - 0.3, 0.78, 0.81], (p) => {
        p.box([0.5, 0.7, W / 2 - 0.35, W / 2 + 0.35, 0.78, 0.8], '#1a1a1e', { edge: 0.2 });
        p.box([0.55, 0.65, W / 2 + 0.5, W / 2 + 0.6, 0.78, 0.8], '#1a1a1e');
      }),
    );
    return V(nodes, lightIf(on, { u: 0.6, v: W / 2, z: 1.0, radius: 110, color: glow, intensity: 0.55, kind: 'electric' }));
  },

  /** Luminária fluorescente do teto: calha com o tubo aceso, luz fria (apaga no apagão). */
  fluorescent(def, state, seed) {
    const [tube] = def.colors;
    const on = state === 0;
    return V(
      [
        N([0.3, 0.7, 0.05, 0.95, 2.4, 2.75], (p) => {
          p.line([0.5, 0.2, 2.75], [0.5, 0.2, 2.5], '#141212', 1);
          p.line([0.5, 0.8, 2.75], [0.5, 0.8, 2.5], '#141212', 1);
          const housing: LBox = [0.38, 0.62, 0.08, 0.92, 2.44, 2.5];
          p.box(housing, '#3a3d42', { edge: 0.3 });
          const lit = on && p.power > 0.1;
          const tb: LBox = [0.44, 0.56, 0.12, 0.88, 2.4, 2.44];
          p.box(tb, lit ? tube : '#5a6068', { edge: 0.5, outline: false });
          if (lit) {
            const ctx = p.ctx;
            const [x, y] = p.m.p(0.5, 0.5, 2.4);
            const g = ctx.createRadialGradient(x, y, 1, x, y, 26);
            g.addColorStop(0, rgba(tube, 0.45));
            g.addColorStop(1, rgba(tube, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x - 26, y - 26, 52, 52);
          }
        }),
      ],
      lightIf(on, { u: 0.5, v: 0.5, z: 2.2, radius: 230, color: '#cfe6ff', intensity: 0.9, flicker: (seed % 5) === 0 ? 0.08 : 0.01 }),
    );
  },

  // ---------------------------------------------------------------- prisão
  /** Grade de cela: barras de ferro do chão até 2,2 m, na borda da casa. */
  bars(def) {
    const [iron, dark] = def.colors;
    return V([
      N([0, 0.12, 0, 1, 0, 2.2], (p) => {
        p.box([0, 0.12, 0, 1, 0, 0.08], dark, { edge: 0.2 });
        for (let v = 0.08; v < 1; v += 0.14) p.cyl(0.06, v, 0.022, 0.08, 2.12, iron, { outline: false });
        p.box([0, 0.12, 0, 1, 1.02, 1.08], iron, { edge: 0.3 });
        p.box([0, 0.12, 0, 1, 2.12, 2.2], dark, { edge: 0.3 });
      }),
    ]);
  },

  /** Porta de cela: fechada fica no vão (ninguém passa); aberta, vira de lado. */
  cell_door(def, state) {
    const [iron, dark, lockC] = def.colors;
    const open = state === 1;
    const nodes: FNode[] = [
      // batentes
      B([0, 0.12, 0, 0.08, 0, 2.2], dark, { edge: 0.2 }),
      B([0, 0.12, 0.92, 1, 0, 2.2], dark, { edge: 0.2 }),
      B([0, 0.12, 0.08, 0.92, 2.12, 2.2], dark, { edge: 0.3 }),
    ];
    if (!open)
      nodes.push(
        N([0, 0.12, 0.08, 0.92, 0, 2.12], (p) => {
          p.box([0.02, 0.1, 0.08, 0.92, 0.04, 0.1], iron);
          for (let v = 0.16; v < 0.9; v += 0.14) p.cyl(0.06, v, 0.02, 0.1, 2.08, iron, { outline: false });
          p.box([0.02, 0.1, 0.08, 0.92, 1.0, 1.06], iron, { edge: 0.3 });
          // fechadura
          p.box([0.0, 0.14, 0.7, 0.86, 0.95, 1.18], lockC, { edge: 0.35 });
        }),
      );
    else
      nodes.push(
        N([0.12, 0.9, 0.84, 0.92, 0, 2.12], (p) => {
          // porta aberta: gira 90° e encosta no batente
          p.box([0.12, 0.9, 0.86, 0.9, 0.04, 0.1], iron);
          for (let u = 0.2; u < 0.9; u += 0.14) p.cyl(u, 0.88, 0.02, 0.1, 2.08, iron, { outline: false });
          p.box([0.12, 0.9, 0.86, 0.9, 1.0, 1.06], iron, { edge: 0.3 });
          p.box([0.72, 0.88, 0.84, 0.94, 0.95, 1.18], lockC, { edge: 0.35 });
        }),
      );
    return V(nodes);
  },

  /** Parede de cela (no lugar da grade): concreto inteiro até 2,2 m, na borda da casa. */
  cell_front(def) {
    const [c0] = def.colors;
    const b: LBox = [0, 0.15, 0, 1, 0, 2.2];
    return V([N(b, (p) => wallBlock(p, b, c0))]);
  },

  /** Porta de aço da cela: fechada, a chapa com o visor gradeado e a portinhola da comida; aberta, gira 90° e encosta no batente. */
  cell_door_steel(def, state) {
    const [steel, dark, lockC] = def.colors;
    const open = state === 1;
    const nodes: FNode[] = [
      // batentes de aço
      B([0, 0.15, 0, 0.08, 0, 2.2], dark, { edge: 0.2 }),
      B([0, 0.15, 0.92, 1, 0, 2.2], dark, { edge: 0.2 }),
      B([0, 0.15, 0.08, 0.92, 2.08, 2.2], dark, { edge: 0.3 }),
    ];
    const chapa = (p: Painter, f: LBox, face: LFace, v0: number, v1: number) => {
      p.box(f, steel, { edge: 0.18 });
      p.withFace(f, face, (ctx) => {
        const w = v1 - v0;
        const a = (k: number) => v0 + w * k;
        // as duas chapas rebaixadas
        ctx.fillStyle = shade(steel, -0.1);
        ctx.fillRect(a(0.14), 0.14, w * 0.72, 0.62);
        ctx.fillRect(a(0.14), 1.18, w * 0.72, 0.18);
        ctx.fillRect(a(0.14), 1.76, w * 0.72, 0.22);
        // o visor: a janelinha escura com três barras
        ctx.fillStyle = '#08090b';
        ctx.fillRect(a(0.32), 1.42, w * 0.36, 0.28);
        ctx.fillStyle = shade(steel, 0.18);
        for (const k of [0.41, 0.5, 0.59]) ctx.fillRect(a(k) - 0.012, 1.42, 0.024, 0.28);
        // a portinhola da comida
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(a(0.26), 0.9, w * 0.48, 0.1);
        ctx.fillStyle = shade(steel, 0.12);
        ctx.fillRect(a(0.26), 0.99, w * 0.48, 0.02);
        // rebites e ferrugem na base
        ctx.fillStyle = 'rgba(15,12,10,0.6)';
        for (const z of [0.08, 1.06, 2.0]) for (const k of [0.08, 0.92]) ctx.fillRect(a(k) - 0.012, z, 0.024, 0.024);
        ctx.fillStyle = 'rgba(110,62,32,0.28)';
        ctx.fillRect(v0, 0.02, w, 0.1);
      });
    };
    if (!open)
      nodes.push(
        N([0.03, 0.12, 0.08, 0.92, 0, 2.08], (p) => {
          chapa(p, [0.03, 0.12, 0.08, 0.92, 0.02, 2.08], 'front', 0.08, 0.92);
          // fechadura
          p.box([0.0, 0.15, 0.72, 0.86, 0.95, 1.16], lockC, { edge: 0.35 });
        }),
      );
    else
      nodes.push(
        N([0.15, 0.95, 0.84, 0.93, 0, 2.08], (p) => {
          // aberta: gira 90° e encosta no batente
          chapa(p, [0.15, 0.95, 0.85, 0.92, 0.02, 2.08], p.m.visible('right') ? 'right' : 'left', 0.15, 0.95);
          p.box([0.78, 0.9, 0.83, 0.94, 0.95, 1.16], lockC, { edge: 0.35 });
        }),
      );
    return V(nodes);
  },

  /**
   * A parede interna do orfanato queimado (09/10): como as paredes dos cômodos, o lambri de madeira embaixo e o reboco
   * em cima, só que rachada e preta de fuligem (mais forte embaixo, onde o fogo subiu, e no alto, onde a fumaça parou).
   */
  parede_reboco(def, _s, seed) {
    const [reboco, madeira, fuligem] = def.colors;
    const H = def.height / Z_PER_M;
    const b: LBox = [0, 0.22, 0, 1, 0, H];
    const r = rng(seed + 101);
    const rachas = Array.from({ length: 2 }, () => ({ a: 0.15 + r() * 0.7, z: 0.9 + r() * 0.35, ok: r() < 0.6 }));
    return V([
      N(b, (p) => {
        p.box(b, reboco, { edge: 0.12, top: shade(fuligem, 0.15) });
        for (const f of FACES) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] = faceRange(b, f);
          const w = a1 - a0;
          p.withFace(b, f, (ctx) => {
            // o lambri de madeira embaixo, com as juntas
            ctx.fillStyle = madeira;
            ctx.fillRect(a0, 0, w, H * 0.42);
            ctx.fillStyle = shade(madeira, 0.18);
            ctx.fillRect(a0, H * 0.4, w, H * 0.025);
            ctx.fillStyle = shade(madeira, -0.25);
            for (let a = a0 + 0.25; a < a1 - 0.05; a += 0.5) ctx.fillRect(a - 0.01, 0.04, 0.02, H * 0.34);
            // a fuligem: forte embaixo, some no meio, volta no alto
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, rgba(fuligem, 0.85));
            g.addColorStop(0.35, rgba(fuligem, 0.3));
            g.addColorStop(0.7, rgba(fuligem, 0.12));
            g.addColorStop(1, rgba(fuligem, 0.6));
            ctx.fillStyle = g;
            ctx.fillRect(a0, 0, w, H);
            // as rachaduras no reboco
            if (w < 0.5) return;
            ctx.strokeStyle = 'rgba(20,14,10,0.65)';
            ctx.lineWidth = 0.018;
            for (const c of rachas) {
              if (!c.ok) continue;
              const x = a0 + w * c.a;
              ctx.beginPath();
              ctx.moveTo(x, c.z);
              ctx.lineTo(x + 0.07, c.z + 0.12);
              ctx.lineTo(x - 0.02, c.z + 0.24);
              ctx.stroke();
            }
          });
        }
      }),
    ]);
  },

  /**
   * A porta de madeira de um quartinho do orfanato (09/10): o batente, a folha de tábuas chamuscada embaixo (o fogo
   * subiu pelo chão), a maçaneta, as marcas de unha e a mão de sangue. Mesma mecânica da porta de aço da cela.
   */
  porta_quarto(def, state, seed) {
    const [madeira, carvao, sangue] = def.colors;
    const open = state === 1;
    const r = rng(seed + 97);
    const marcas = Array.from({ length: 4 }, () => ({ k: 0.3 + r() * 0.4, z: 0.7 + r() * 0.6, len: 0.25 + r() * 0.3 }));
    const nodes: FNode[] = [
      B([0, 0.15, 0, 0.08, 0, 2.2], shade(madeira, -0.2), { edge: 0.2 }),
      B([0, 0.15, 0.92, 1, 0, 2.2], shade(madeira, -0.2), { edge: 0.2 }),
      B([0, 0.15, 0.08, 0.92, 2.08, 2.2], shade(madeira, -0.2), { edge: 0.3 }),
    ];
    const folha = (p: Painter, f: LBox, face: LFace, v0: number, v1: number) => {
      p.box(f, madeira, { edge: 0.18 });
      p.withFace(f, face, (ctx) => {
        const w = v1 - v0;
        const a = (k: number) => v0 + w * k;
        // as tábuas
        ctx.fillStyle = shade(madeira, -0.18);
        for (const k of [0.25, 0.5, 0.75]) ctx.fillRect(a(k) - 0.008, 0.02, 0.016, 2.04);
        // o queimado subindo do chão
        const g = ctx.createLinearGradient(0, 0, 0, 1.1);
        g.addColorStop(0, rgba(carvao, 0.95));
        g.addColorStop(1, rgba(carvao, 0));
        ctx.fillStyle = g;
        ctx.fillRect(v0, 0.02, w, 1.1);
        // as marcas de unha e a mão de sangue
        ctx.strokeStyle = 'rgba(20,12,8,0.7)';
        ctx.lineWidth = 0.012;
        for (const m of marcas) {
          ctx.beginPath();
          ctx.moveTo(a(m.k), m.z + m.len);
          ctx.lineTo(a(m.k + 0.04), m.z);
          ctx.stroke();
        }
        ctx.fillStyle = rgba(sangue, 0.85);
        ctx.beginPath();
        ctx.ellipse(a(0.62), 1.32, w * 0.07, 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const k of [0.56, 0.6, 0.64, 0.68]) ctx.fillRect(a(k), 1.38, 0.022, 0.1);
        ctx.fillRect(a(0.6), 1.05, 0.012, 0.22);
      });
    };
    if (!open)
      nodes.push(
        N([0.03, 0.12, 0.08, 0.92, 0, 2.08], (p) => {
          folha(p, [0.03, 0.12, 0.08, 0.92, 0.02, 2.08], 'front', 0.08, 0.92);
          p.box([0.0, 0.15, 0.76, 0.84, 1.0, 1.06], '#8a7a4a', { edge: 0.35 });
        }),
      );
    else
      nodes.push(
        N([0.15, 0.95, 0.84, 0.93, 0, 2.08], (p) => {
          // aberta: gira 90° e encosta no batente
          folha(p, [0.15, 0.95, 0.85, 0.92, 0.02, 2.08], p.m.visible('right') ? 'right' : 'left', 0.15, 0.95);
          p.box([0.8, 0.88, 0.83, 0.94, 1.0, 1.06], '#8a7a4a', { edge: 0.35 });
        }),
      );
    return V(nodes);
  },

  /** Sujeira no chão: mancha, bitucas, tampinhas e um papel amassado. */
  dirt(def, _s, seed) {
    const [stain, bits] = def.colors;
    const r = rng(seed + 13);
    const spots = Array.from({ length: 3 }, () => ({ u: 0.2 + r() * 0.6, v: 0.2 + r() * 0.6, rx: 0.12 + r() * 0.2, ry: 0.08 + r() * 0.14, a: r() * 3 }));
    const trash = Array.from({ length: 6 }, () => ({ u: 0.1 + r() * 0.8, v: 0.1 + r() * 0.8, k: r() }));
    return V([
      N([0.02, 0.98, 0.02, 0.98, 0, 0.01], (p) =>
        p.withTop(0.004, (ctx) => {
          for (const s2 of spots) {
            ctx.fillStyle = rgba(stain, 0.35);
            ctx.beginPath();
            ctx.ellipse(s2.u, s2.v, s2.rx, s2.ry, s2.a, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const t of trash) {
            ctx.fillStyle = t.k < 0.4 ? bits : t.k < 0.7 ? '#c9c0a4' : '#6a2a1a';
            ctx.fillRect(t.u, t.v, t.k < 0.4 ? 0.06 : 0.04, t.k < 0.4 ? 0.02 : 0.04);
          }
        }),
      ),
    ]);
  },

  /** A viga do telhado que caiu no incêndio: comprida, carbonizada, rachada, com brasas ainda nas rachaduras. */
  viga(def, _s, seed) {
    const [carvao, brasa] = def.colors;
    const D = def.depth;
    const r = rng(seed + 31);
    const torta = (r() - 0.5) * 0.3;
    const b: LBox = [0.12, D - 0.12, 0.32 + torta, 0.68 + torta, 0, 0.3];
    return V([
      B(b, carvao, { edge: 0.06 }),
      N(b, (p) => {
        for (let i = 0; i < 4; i++) {
          const u = 0.4 + r() * (D - 0.8);
          p.line([u, 0.36 + torta, 0.31], [u + 0.25 + r() * 0.3, 0.64 + torta, 0.31], i % 2 ? brasa : shade(carvao, 0.25), 2);
        }
      }),
    ]);
  },

  /** A passagem aberta (09/10): divisão de cena sem porta, no mesmo ambiente (o corredor do orfanato e o salão). Nada desenhado. */
  passagem() {
    return V([]);
  },

  // ---------------------------------------------------------------- o covil dos transtornados (09/10, o Orfanato)
  /** A fogueira no meio do chão: a roda de pedras, a lenha (e o que mais foi parar lá) em brasa e o fogo. */
  fogueira(def, state, seed) {
    const [pedra, lenha] = def.colors;
    const on = state === 0;
    const r = rng(seed + 41);
    return V(
      [
        N([0.1, 1.9, 0.1, 1.9, 0, 0.6], (p) => {
          p.disc(1, 1, 0.82, 0.005, '#16110d', OUTLINE);
          // a lenha cruzada no meio
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI + r() * 0.4;
            const dx = Math.cos(a) * 0.5;
            const dy = Math.sin(a) * 0.5;
            p.line([1 - dx, 1 - dy, 0.06], [1 + dx, 1 + dy, 0.14], i % 2 ? lenha : shade(lenha, -0.3), 5);
          }
          if (on) for (let i = 0; i < 5; i++) p.disc(0.8 + r() * 0.4, 0.8 + r() * 0.4, 0.06, 0.12, '#ff7a2a');
          // a roda de pedras, de trás para a frente
          const pedras = Array.from({ length: 11 }, (_, i) => (i / 11) * Math.PI * 2)
            .map((a) => ({ u: 1 + Math.cos(a) * 0.72, v: 1 + Math.sin(a) * 0.72 }))
            .sort((a, b) => a.u + a.v - (b.u + b.v));
          for (const s of pedras) p.cyl(s.u, s.v, 0.11 + r() * 0.04, 0, 0.1 + r() * 0.06, shade(pedra, (r() - 0.5) * 0.3), { top: shade(pedra, 0.15) });
          if (on) {
            p.flame(1, 1, 0.14, 2.4);
            p.flame(0.9, 1.08, 0.12, 1.6);
            p.flame(1.1, 0.92, 0.12, 1.5);
          }
        }),
      ],
      lightIf(on, { u: 1, v: 1, z: 0.6, radius: 230, color: WARM, intensity: 1, flicker: 0.22, kind: 'fire' }),
    );
  },

  /** O colchão largado no chão, onde um deles dorme: afundado, encardido, com as manchas e o trapo por cima. */
  colchao(def, _s, seed) {
    const [pano, mancha] = def.colors;
    const D = def.depth;
    const r = rng(seed + 53);
    const b: LBox = [0.06, D - 0.06, 0.1, 0.9, 0, 0.14];
    return V([
      B(b, pano, { edge: 0.05 }),
      N(b, (p) => {
        for (let i = 0; i < 3; i++) p.disc(0.4 + r() * (D - 0.8), 0.3 + r() * 0.4, 0.12 + r() * 0.14, 0.145, rgba(mancha, 0.55 + r() * 0.3));
        // o trapo jogado por cima
        p.line([0.3, 0.2, 0.16], [0.9, 0.75, 0.16], shade(pano, -0.35), 6);
      }),
    ]);
  },

  /** O varal de ganchos de carne: duas estacas, a travessa e o que está pendurado nela, pingando. */
  gancho(def, _s, seed) {
    const [ferro, carne] = def.colors;
    const D = def.depth;
    const r = rng(seed + 67);
    const H = 1.9;
    const nodes: FNode[] = [
      B([0.12, 0.24, 0.44, 0.56, 0, H], ferro, { edge: 0.05 }),
      B([D - 0.24, D - 0.12, 0.44, 0.56, 0, H], ferro, { edge: 0.05 }),
      B([0.12, D - 0.12, 0.46, 0.54, H - 0.06, H], shade(ferro, 0.1)),
    ];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const u = 0.45 + (i * (D - 0.9)) / (n - 1);
      const comp = 0.5 + r() * 0.35;
      const z1 = H - 0.22;
      const z0 = z1 - comp;
      nodes.push(
        N([u - 0.2, u + 0.2, 0.3, 0.7, z0 - 0.05, H], (p) => {
          p.line([u, 0.5, H - 0.06], [u, 0.5, z1], '#2a2420', 1.5);
          p.cyl(u, 0.5, 0.11 + r() * 0.05, z0, z1, shade(carne, (r() - 0.5) * 0.2), { top: shade(carne, 0.2) });
          p.line([u + 0.04, 0.5, z0], [u + 0.04, 0.5, z0 - 0.04 - r() * 0.1], '#6e0c0c', 1.5);
        }),
      );
    }
    return V(nodes);
  },

  /**
   * Os escombros do teto que desabou no incêndio: um monte em camadas de reboco e cinza, as telhas quebradas por cima,
   * os pedaços soltos e as tábuas carbonizadas espetadas para fora.
   */
  escombros(def, _s, seed) {
    const [cinza, carvao, telha] = def.colors;
    const r = rng(seed + 83);
    const W = def.width;
    const D = def.depth;
    const jit = () => (r() - 0.5) * 0.12;
    // o monte: camadas cada vez menores, de baixo para cima (a altura de cada ponto sai daqui)
    const camadas: [LBox, string][] = (
      [[0.08, 0.1], [0.28, 0.22], [0.5, 0.34]] as [number, number][]
    ).map(([m, z], k) => [[m + jit(), D - m + jit(), m + jit(), W - m + jit(), k === 0 ? 0 : [0, 0.1, 0.22][k], z], shade(cinza, -0.12 + k * 0.06)]);
    const altura = (u: number, v: number) => {
      const borda = Math.min(u, D - u, v, W - v);
      return borda > 0.5 ? 0.34 : borda > 0.28 ? 0.22 : 0.1;
    };
    // as telhas quebradas e os pedaços soltos por cima do monte
    const pedacos = Array.from({ length: 16 }, (_, i) => {
      const u = 0.2 + r() * (D - 0.4);
      const v = 0.2 + r() * (W - 0.4);
      const z = altura(u, v);
      const sz = 0.07 + r() * 0.12;
      const eTelha = i % 3 === 0;
      const h = eTelha ? 0.03 : 0.05 + r() * 0.1;
      const b: LBox = [u, Math.min(D - 0.05, u + sz * (eTelha ? 1.6 : 1)), v, Math.min(W - 0.05, v + sz), z, z + h];
      return { b, cor: eTelha ? shade(telha, (r() - 0.5) * 0.2) : shade(cinza, (r() - 0.5) * 0.3) };
    });
    const tabuas = Array.from({ length: 3 }, (_, i) => {
      const u0 = 0.3 + r() * (D - 0.6);
      const v0 = 0.3 + r() * (W - 0.6);
      const u1 = Math.max(0.05, Math.min(D - 0.05, u0 + (r() - 0.5) * 1.2));
      const v1 = Math.max(0.05, Math.min(W - 0.05, v0 + (r() - 0.5) * 1.2));
      return { a: [u0, v0, 0.12] as [number, number, number], b: [u1, v1, 0.4 + r() * 0.35] as [number, number, number], cor: i % 2 ? carvao : shade(carvao, 0.2) };
    });
    // tudo num nó só, na ordem certa: o monte de baixo para cima, depois os pedaços de trás para a frente
    return V([
      N([0, D, 0, W, 0, 0.8], (p) => {
        for (const [b, cor] of camadas) p.box(b, cor, { edge: 0.06 });
        const fundo = (b: LBox) => {
          const [x, y] = p.m.xy((b[0] + b[1]) / 2, (b[2] + b[3]) / 2);
          return x + y;
        };
        for (const { b, cor } of pedacos.sort((a, c) => fundo(a.b) - fundo(c.b))) p.box(b, cor, { edge: 0.12 });
        for (const t of tabuas) p.line(t.a, t.b, t.cor, 5);
      }),
    ]);
  },

  // ---------------------------------------------------------------- depósito
  rubble(def, _s, seed) {
    const [stone, wood] = def.colors;
    const r = rng(seed + 77);
    const chunks: FNode[] = [];
    for (let i = 0; i < 9; i++) {
      const u = 0.2 + r() * 1.5;
      const v = 0.2 + r() * 1.5;
      const s = 0.15 + r() * 0.25;
      const hgt = 0.1 + r() * 0.3;
      const b: LBox = [u, Math.min(1.95, u + s), v, Math.min(1.95, v + s * (0.6 + r() * 0.8)), 0, hgt];
      chunks.push(B(b, shade(stone, (r() - 0.5) * 0.3), { edge: 0.15 }));
    }
    chunks.push(
      N([0.2, 1.8, 0.2, 1.8, 0, 0.4], (p) => {
        p.line([0.3, 0.4, 0.35], [1.7, 1.2, 0.08], wood, 4);
        p.line([0.5, 1.6, 0.25], [1.4, 0.3, 0.05], shade(wood, -0.15), 3);
      }),
    );
    return V(chunks);
  },
};
