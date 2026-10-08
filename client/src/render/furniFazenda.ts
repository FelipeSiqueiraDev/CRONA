import { Z_PER_M, type FurniDef } from "@crona/shared";
import { hash, mix, rgba, rng, shade } from "./color";
import { B, drawers, lightIf, N, V, WARM, type Builder } from "./furniKit";
import {
  OUTLINE,
  type LBox,
  type LFace,
  type P3,
  type Painter,
} from "./painter";

/**
 * Mobis da fazenda e da casa, desenhados em código (a arte entra depois, por cima):
 * os prédios vistos de fora (casarão, celeiro, casa de mantimentos), a porteira, a
 * cerca, as árvores, a fonte, as plantações e os móveis de casa de fazenda.
 *
 * Coordenadas locais como em furniFloor: u = fundo → frente (0..depth), v = largura
 * (0..width), z em metros.
 */

/** Altura do mobi em metros. */
const alt = (def: FurniDef) => def.height / Z_PER_M;

/**
 * Polígono plano (u, v, z) desenhado só se estiver virado para quem olha. Os pontos
 * vão no sentido anti-horário visto de fora (a normal pela regra da mão direita aponta
 * para fora): na tela, a área com sinal fica positiva quando a face está à vista.
 */
function lado(
  p: Painter,
  pts: P3[],
  fill: string,
  stroke: string | null = OUTLINE,
): boolean {
  const s = pts.map(([u, v, z]) => p.m.p(u, v, z));
  let a = 0;
  for (let i = 0; i < s.length; i++) {
    const [x0, y0] = s[i];
    const [x1, y1] = s[(i + 1) % s.length];
    a += x0 * y1 - x1 * y0;
  }
  if (a <= 0) return false;
  p.poly(pts, fill, stroke ?? undefined);
  return true;
}

/** Sombreado de uma água do telhado: metade topo, metade a face para onde ela desce. */
const tomTelhado = (p: Painter, f: LFace) =>
  (p.m.shadeOf("top") + p.m.shadeOf(f)) / 2;

/**
 * Telhado de duas águas com a cumeeira correndo em v (paralela à frente). As águas
 * passam da parede (beiral) na frente e atrás; os oitões ficam no plano das paredes
 * dos lados. `entre` desenha o que fica entre a água de trás e a da frente (chaminé).
 */
function telhado(
  p: Painter,
  o: {
    u0: number;
    u1: number;
    v0: number;
    v1: number;
    ze: number;
    zr: number;
    beiral: number;
    telha: string;
    oitao: string;
    entre?: () => void;
  },
) {
  const { u0, u1, v0, v1, ze, zr, beiral, telha, oitao } = o;
  const ur = (u0 + u1) / 2;
  const k = (zr - ze) / (ur - u0);
  const zb = ze - beiral * k;
  const tras: P3[] = [
    [u0 - beiral, v1, zb],
    [u0 - beiral, v0, zb],
    [ur, v0, zr],
    [ur, v1, zr],
  ];
  const frente: P3[] = [
    [u1 + beiral, v0, zb],
    [u1 + beiral, v1, zb],
    [ur, v1, zr],
    [ur, v0, zr],
  ];
  const fiadas = (agua: "tras" | "frente") => {
    // as fiadas de telha: linhas paralelas ao beiral
    const ue = agua === "tras" ? u0 - beiral : u1 + beiral;
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const uu = ue + (ur - ue) * t;
      const zz = zb + (zr - zb) * t;
      p.line([uu, v0, zz], [uu, v1, zz], "rgba(0,0,0,0.22)", 1);
    }
  };
  if (lado(p, tras, shade(telha, tomTelhado(p, "back")))) fiadas("tras");
  o.entre?.();
  if (lado(p, frente, shade(telha, tomTelhado(p, "front")))) fiadas("frente");
  // oitões: triângulos de parede nos lados
  lado(
    p,
    [
      [u0, v1, ze],
      [ur, v1, zr],
      [u1, v1, ze],
    ],
    shade(oitao, p.m.shadeOf("right")),
  );
  lado(
    p,
    [
      [u1, v0, ze],
      [ur, v0, zr],
      [u0, v0, ze],
    ],
    shade(oitao, p.m.shadeOf("left")),
  );
  // a cumeeira, mais escura
  p.line([ur, v0, zr], [ur, v1, zr], shade(telha, -0.45), 2);
}

/** Janela com moldura e cruz, na face f do bloco b: a = meio da janela ao longo da face. */
function janela(
  p: Painter,
  b: LBox,
  f: LFace,
  a: number,
  z0: number,
  w: number,
  h: number,
  vidro: string,
  moldura: string,
  veneziana?: string,
) {
  if (!p.m.visible(f)) return;
  const a0 = a - w / 2;
  const a1 = a + w / 2;
  if (veneziana) {
    p.face(b, f, a0 - w * 0.42, a0 - 0.02, z0, z0 + h, veneziana);
    p.face(b, f, a1 + 0.02, a1 + w * 0.42, z0, z0 + h, veneziana);
  }
  p.face(b, f, a0 - 0.05, a1 + 0.05, z0 - 0.08, z0 + h + 0.06, moldura);
  p.face(b, f, a0, a1, z0, z0 + h, vidro);
  // reflexo e a cruz da esquadria
  p.face(
    b,
    f,
    a0 + w * 0.1,
    a0 + w * 0.3,
    z0 + h * 0.45,
    z0 + h * 0.9,
    "rgba(200,220,230,0.18)",
    true,
  );
  p.face(b, f, a - 0.025, a + 0.025, z0, z0 + h, moldura);
  p.face(b, f, a0, a1, z0 + h * 0.5 - 0.03, z0 + h * 0.5 + 0.03, moldura);
}

/** Porta (uma ou duas folhas) na face f: a = meio, w = largura, h = altura. */
function porta(
  p: Painter,
  b: LBox,
  f: LFace,
  a: number,
  w: number,
  h: number,
  cor: string,
  folhas: 1 | 2,
  batente: string,
  z0 = b[4],
) {
  if (!p.m.visible(f)) return;
  p.face(b, f, a - w / 2 - 0.07, a + w / 2 + 0.07, z0, z0 + h + 0.08, batente);
  p.face(b, f, a - w / 2, a + w / 2, z0, z0 + h, cor);
  const n = folhas;
  for (let i = 0; i < n; i++) {
    const f0 = a - w / 2 + (w / n) * i;
    const f1 = f0 + w / n;
    // almofadas
    p.face(
      b,
      f,
      f0 + 0.08,
      f1 - 0.08,
      z0 + h * 0.55,
      z0 + h - 0.15,
      shade(cor, -0.12),
    );
    p.face(
      b,
      f,
      f0 + 0.08,
      f1 - 0.08,
      z0 + 0.15,
      z0 + h * 0.45,
      shade(cor, -0.12),
    );
  }
  if (n === 2)
    p.face(b, f, a - 0.012, a + 0.012, z0, z0 + h, "rgba(0,0,0,0.6)", true);
  // maçaneta
  const m = n === 2 ? a + 0.08 : a + w / 2 - 0.12;
  p.face(
    b,
    f,
    m - 0.025,
    m + 0.025,
    z0 + h * 0.47,
    z0 + h * 0.52,
    "#c9a86a",
    true,
  );
}

/** Tábuas verticais numa face (galpão, celeiro). */
function tabuas(
  p: Painter,
  b: LBox,
  f: LFace,
  passo: number,
  z0: number,
  z1: number,
) {
  if (!p.m.visible(f)) return;
  const [a0, a1] = f === "front" || f === "back" ? [b[2], b[3]] : [b[0], b[1]];
  for (let a = a0 + passo; a < a1 - 0.01; a += passo)
    p.face(b, f, a - 0.01, a + 0.01, z0, z1, "rgba(0,0,0,0.28)", true);
}

/** Faces visíveis entre frente/fundo e os lados, para espalhar janelas. */
const FACES: LFace[] = ["front", "back", "right", "left"];

export const FAZENDA_BUILDERS: Record<string, Builder> = {
  // ---------------------------------------------------------------- prédios
  casarao(def) {
    const [parede, telha, madeira, vidro] = def.colors;
    const W = def.width;
    const D = def.depth;
    // corpo de dois andares (3 m cada) e a varanda na frente, com o telhado dela
    const uF = D - 1.9;
    const corpo: LBox = [0.4, uF, 0.3, W - 0.3, 0, 6.0];
    const deck: LBox = [uF, D - 0.15, 0.2, W - 0.2, 0, 0.42];
    const veneziana = "#3e5a3a";
    return V([
      N([0, D, 0, W, 0, 8.6], (p) => {
        const frenteVisivel = p.m.visible("front");
        const varanda = () => {
          p.box(deck, shade(madeira, 0.25), { edge: 0.2 });
          // degraus no meio da frente
          const meio = W / 2;
          p.box(
            [D - 0.15, D + 0.02, meio - 0.8, meio + 0.8, 0, 0.2],
            shade(madeira, 0.15),
          );
          // pilares e guarda-corpo
          const pilares = [
            0.35,
            W / 4,
            W / 2 - 1.0,
            W / 2 + 1.0,
            (3 * W) / 4,
            W - 0.35,
          ];
          for (const v of pilares)
            p.box(
              [D - 0.42, D - 0.28, v - 0.07, v + 0.07, 0.42, 3.05],
              "#e8e0d0",
              { edge: 0.25 },
            );
          for (const [va, vb] of [
            [0.35, W / 2 - 1.0],
            [W / 2 + 1.0, W - 0.35],
          ])
            p.box([D - 0.38, D - 0.32, va, vb, 1.25, 1.33], "#e8e0d0");
          // o telhado da varanda, de uma água, encostado na parede
          lado(
            p,
            [
              [D - 0.1, 0.1, 2.95],
              [D - 0.1, W - 0.1, 2.95],
              [uF, W - 0.1, 3.5],
              [uF, 0.1, 3.5],
            ],
            shade(telha, tomTelhado(p, "front")),
          );
          lado(
            p,
            [
              [uF, W - 0.1, 3.5],
              [D - 0.1, W - 0.1, 2.95],
              [D - 0.1, W - 0.1, 2.85],
              [uF, W - 0.1, 3.4],
            ],
            shade(telha, -0.35),
          );
        };
        if (!frenteVisivel) varanda();
        p.box(corpo, parede, { edge: 0.12 });
        // rodapé de pedra e a faixa entre os andares
        for (const f of FACES) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] =
            f === "front" || f === "back"
              ? [corpo[2], corpo[3]]
              : [corpo[0], corpo[1]];
          p.face(corpo, f, a0, a1, 0, 0.5, "#8a8378");
          p.face(corpo, f, a0, a1, 3.0, 3.15, shade(parede, -0.18));
        }
        // janelas: frente e fundos em duas fileiras; lados com duas por andar
        const nF = 5;
        for (const f of ["front", "back"] as LFace[])
          for (let i = 0; i < nF; i++) {
            const a = corpo[2] + ((i + 0.5) * (corpo[3] - corpo[2])) / nF;
            if (f === "front" && i === 2) {
              porta(
                p,
                corpo,
                f,
                a,
                1.5,
                2.4,
                shade(madeira, 0.1),
                2,
                "#e8e0d0",
                0.42,
              );
              janela(
                p,
                corpo,
                f,
                a,
                3.9,
                0.9,
                1.4,
                vidro,
                "#e8e0d0",
                veneziana,
              );
              continue;
            }
            janela(p, corpo, f, a, 1.1, 0.9, 1.4, vidro, "#e8e0d0", veneziana);
            janela(p, corpo, f, a, 3.9, 0.9, 1.4, vidro, "#e8e0d0", veneziana);
          }
        for (const f of ["right", "left"] as LFace[])
          for (const t of [0.3, 0.7]) {
            const a = corpo[0] + (corpo[1] - corpo[0]) * t;
            janela(p, corpo, f, a, 1.1, 0.8, 1.4, vidro, "#e8e0d0", veneziana);
            janela(p, corpo, f, a, 3.9, 0.8, 1.4, vidro, "#e8e0d0", veneziana);
          }
        if (frenteVisivel) varanda();
        const chamine: LBox = [1.6, 2.3, W * 0.72, W * 0.72 + 0.7, 6.0, 8.9];
        telhado(p, {
          u0: corpo[0],
          u1: corpo[1],
          v0: corpo[2],
          v1: corpo[3],
          ze: 6.0,
          zr: 8.4,
          beiral: 0.35,
          telha,
          oitao: parede,
          entre: () => {
            p.box(chamine, "#7a6a5a", { edge: 0.2 });
            p.box(
              [
                chamine[0] - 0.05,
                chamine[1] + 0.05,
                chamine[2] - 0.05,
                chamine[3] + 0.05,
                8.75,
                8.95,
              ],
              "#5a4e44",
            );
          },
        });
      }),
    ]);
  },

  celeiro(def) {
    const [parede, telha, branco, corPorta] = def.colors;
    const W = def.width;
    const D = def.depth;
    const corpo: LBox = [0.3, D - 0.3, 0.3, W - 0.3, 0, 4.4];
    return V([
      N([0, D, 0, W, 0, 7.4], (p) => {
        p.box(corpo, parede, { edge: 0.1 });
        for (const f of FACES) {
          tabuas(p, corpo, f, 0.3, 0.05, 4.35);
          if (!p.m.visible(f)) continue;
          const [a0, a1] =
            f === "front" || f === "back"
              ? [corpo[2], corpo[3]]
              : [corpo[0], corpo[1]];
          // cantos brancos
          p.face(corpo, f, a0, a0 + 0.12, 0, 4.4, branco);
          p.face(corpo, f, a1 - 0.12, a1, 0, 4.4, branco);
        }
        // a porta grande de correr (duas folhas com o X branco) e a do palheiro em cima
        const f: LFace = "front";
        if (p.m.visible(f)) {
          const meio = W / 2;
          const w = 3.4;
          const h = 3.2;
          p.face(
            corpo,
            f,
            meio - w / 2 - 0.1,
            meio + w / 2 + 0.1,
            0,
            h + 0.12,
            branco,
          );
          for (const s of [-1, 1]) {
            const a0 = s < 0 ? meio - w / 2 : meio;
            const a1 = s < 0 ? meio : meio + w / 2;
            p.face(corpo, f, a0 + 0.04, a1 - 0.04, 0, h, corPorta);
            p.withFace(corpo, f, (ctx) => {
              ctx.strokeStyle = branco;
              ctx.lineWidth = 0.09;
              ctx.strokeRect(a0 + 0.1, 0.08, a1 - a0 - 0.2, h - 0.16);
              ctx.beginPath();
              ctx.moveTo(a0 + 0.12, 0.1);
              ctx.lineTo(a1 - 0.12, h - 0.1);
              ctx.moveTo(a1 - 0.12, 0.1);
              ctx.lineTo(a0 + 0.12, h - 0.1);
              ctx.stroke();
            });
          }
          p.face(corpo, f, meio - 0.7, meio + 0.7, 3.5, 4.3, branco);
          p.face(
            corpo,
            f,
            meio - 0.6,
            meio + 0.6,
            3.58,
            4.22,
            shade(corPorta, -0.2),
          );
        }
        janela(p, corpo, "right", D * 0.35, 1.6, 0.8, 0.8, "#1d1a18", branco);
        janela(p, corpo, "right", D * 0.7, 1.6, 0.8, 0.8, "#1d1a18", branco);
        janela(p, corpo, "left", D * 0.35, 1.6, 0.8, 0.8, "#1d1a18", branco);
        janela(p, corpo, "left", D * 0.7, 1.6, 0.8, 0.8, "#1d1a18", branco);
        telhado(p, {
          u0: corpo[0],
          u1: corpo[1],
          v0: corpo[2],
          v1: corpo[3],
          ze: 4.4,
          zr: 7.2,
          beiral: 0.3,
          telha,
          oitao: parede,
        });
      }),
    ]);
  },

  galpao(def) {
    const [parede, telha, madeira, corPorta] = def.colors;
    const W = def.width;
    const D = def.depth;
    const corpo: LBox = [0.3, D - 0.4, 0.3, W - 0.3, 0, 3.0];
    return V([
      N([0, D, 0, W, 0, 4.8], (p) => {
        p.box(corpo, parede, { edge: 0.1 });
        for (const f of FACES) {
          tabuas(p, corpo, f, 0.22, 0.05, 2.95);
          if (!p.m.visible(f)) continue;
          const [a0, a1] =
            f === "front" || f === "back"
              ? [corpo[2], corpo[3]]
              : [corpo[0], corpo[1]];
          p.face(corpo, f, a0, a0 + 0.12, 0, 3.0, madeira);
          p.face(corpo, f, a1 - 0.12, a1, 0, 3.0, madeira);
        }
        porta(p, corpo, "front", W / 2, 1.3, 2.2, corPorta, 2, madeira);
        janela(p, corpo, "front", W * 0.2, 1.1, 0.8, 0.8, "#1d1a18", madeira);
        janela(p, corpo, "front", W * 0.8, 1.1, 0.8, 0.8, "#1d1a18", madeira);
        janela(p, corpo, "right", D * 0.5, 1.1, 0.8, 0.8, "#1d1a18", madeira);
        janela(p, corpo, "left", D * 0.5, 1.1, 0.8, 0.8, "#1d1a18", madeira);
        // o toldo em cima da porta
        lado(
          p,
          [
            [D - 0.4, W / 2 - 1.2, 2.55],
            [D - 0.4 + 0.6, W / 2 - 1.2, 2.3],
            [D - 0.4 + 0.6, W / 2 + 1.2, 2.3],
            [D - 0.4, W / 2 + 1.2, 2.55],
          ],
          shade(telha, tomTelhado(p, "front")),
        );
        telhado(p, {
          u0: corpo[0],
          u1: corpo[1],
          v0: corpo[2],
          v1: corpo[3],
          ze: 3.0,
          zr: 4.6,
          beiral: 0.3,
          telha,
          oitao: parede,
        });
      }),
    ]);
  },

  // ---------------------------------------------------------------- passagens
  entrada(def) {
    const [cor] = def.colors;
    // a entrada larga (a porta dupla) é um capacho só, da largura dela
    const W = def.width;
    return V([
      N([0.1, 0.9, 0.1, W - 0.1, 0, 0.02], (p) => {
        // capacho gasto com a borda escura
        p.withTop(0.012, (ctx) => {
          ctx.fillStyle = rgba(shade(cor, -0.35), 0.85);
          ctx.fillRect(0.14, 0.1, 0.72, W - 0.2);
          ctx.fillStyle = rgba(cor, 0.9);
          ctx.fillRect(0.2, 0.16, 0.6, W - 0.32);
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = 0.02;
          for (let u = 0.24; u < 0.8; u += 0.08) {
            ctx.beginPath();
            ctx.moveTo(u, 0.18);
            ctx.lineTo(u, W - 0.18);
            ctx.stroke();
          }
        });
      }),
    ]);
  },

  porteira(def, state) {
    const [madeira, escura] = def.colors;
    const W = def.width;
    // a altura de pisar é zero (quem passa não sobe nela); desenhada, a porteira tem 1,3 m
    const h = 1.3;
    const aberta = state === 1;
    const poste = (v: number): LBox => [
      0.38,
      0.62,
      v - 0.12,
      v + 0.12,
      0,
      h + 0.25,
    ];
    const nodes = [
      B(poste(0.12), escura, { edge: 0.2 }),
      B(poste(W - 0.12), escura, { edge: 0.2 }),
    ];
    // a folha: travessas e a mão-francesa; aberta, gira 90° para dentro (pela dobradiça de v = 0)
    const folha = (p: Painter) => {
      const trav = [0.2, 0.5, 0.8, 1.1].map((z) => (z * h) / 1.3);
      if (!aberta) {
        for (const z of trav)
          p.box([0.46, 0.54, 0.25, W - 0.25, z, z + 0.1], madeira, {
            edge: 0.15,
          });
        p.box([0.46, 0.54, 0.25, 0.37, trav[0], trav[3] + 0.1], madeira);
        p.box(
          [0.46, 0.54, W - 0.37, W - 0.25, trav[0], trav[3] + 0.1],
          madeira,
        );
        p.line(
          [0.5, 0.3, trav[0] + 0.05],
          [0.5, W - 0.3, trav[3] + 0.05],
          shade(madeira, -0.1),
          3,
        );
      } else {
        const L = W - 0.5;
        for (const z of trav)
          p.box([0.5, 0.5 + L, 0.16, 0.24, z, z + 0.1], madeira, {
            edge: 0.15,
          });
        p.box(
          [0.5 + L - 0.12, 0.5 + L, 0.16, 0.24, trav[0], trav[3] + 0.1],
          madeira,
        );
        p.line(
          [0.55, 0.2, trav[0] + 0.05],
          [0.5 + L - 0.05, 0.2, trav[3] + 0.05],
          shade(madeira, -0.1),
          3,
        );
      }
    };
    nodes.push(
      N(
        aberta
          ? [0.5, W - 0.5 + 0.5, 0.14, 0.26, 0, h]
          : [0.44, 0.56, 0.24, W - 0.24, 0, h],
        folha,
      ),
    );
    return V(nodes);
  },

  // ---------------------------------------------------------------- cercas e plantas
  cerca(def) {
    const [madeira, escura] = def.colors;
    const h = alt(def);
    const trilhos = def.height > 2.2 ? [0.3, 0.62, 0.94] : [0.38, 0.8];
    return V([
      N([0.42, 0.58, 0, 1, 0, h], (p) => {
        p.box([0.44, 0.56, 0, 0.12, 0, h], escura, { edge: 0.15 });
        for (const t of trilhos)
          p.box([0.47, 0.53, 0.04, 0.96, t * h, t * h + 0.09], madeira, {
            edge: 0.15,
          });
        p.box([0.44, 0.56, 0.88, 1, 0, h], escura, { edge: 0.15 });
      }),
    ]);
  },

  arvore(def, _s, seed) {
    const [folha, tronco] = def.colors;
    const r = rng(seed * 7 + 3);
    const H = alt(def) * (0.8 + r() * 0.35);
    const R = 1.5 + r() * 0.7;
    // copa cheia: um anel de bolas embaixo, outro no meio e o topo (tronco curto aparecendo)
    const copa = Array.from({ length: 13 }, (_, i) => {
      const camada = i < 6 ? 0 : i < 11 ? 1 : 2;
      const a = (i / (camada === 0 ? 6 : 5)) * Math.PI * 2 + r() + camada;
      const d =
        camada === 2 ? r() * 0.2 : (camada === 0 ? 0.55 : 0.35) + r() * 0.25;
      const dz =
        camada === 0
          ? -0.55 + r() * 0.3
          : camada === 1
            ? 0.1 + r() * 0.3
            : 0.75 + r() * 0.25;
      return {
        du: Math.cos(a) * d * R,
        dv: Math.sin(a) * d * R,
        dz,
        rr: R * (camada === 2 ? 0.42 : 0.4 + r() * 0.18),
      };
    });
    const tom = shade(folha, (r() - 0.5) * 0.24);
    return V([
      {
        b: [0, 1, 0, 1, 0, H + R * 0.6],
        pad: R * 32,
        draw: (p: Painter) => {
          p.cyl(0.5, 0.5, 0.14, 0, H * 0.45, tronco);
          // copa: bolas de folhas, as de trás primeiro, com luz em cima
          const zc = H * 0.58;
          const ordem = copa
            .map((c) => {
              const [x, y] = p.m.xy(0.5 + c.du, 0.5 + c.dv);
              return { c, k: x + y + c.dz * 0.3 };
            })
            .sort((a, b) => a.k - b.k);
          const ctx = p.ctx;
          for (const { c } of ordem) {
            const [x, y] = p.m.p(0.5 + c.du, 0.5 + c.dv, zc + c.dz);
            const rx = c.rr * 40;
            const g = ctx.createRadialGradient(
              x - rx * 0.3,
              y - rx * 0.45,
              rx * 0.1,
              x,
              y,
              rx,
            );
            g.addColorStop(0, shade(tom, 0.22));
            g.addColorStop(0.6, tom);
            g.addColorStop(1, shade(tom, -0.35));
            ctx.beginPath();
            ctx.arc(x, y, rx, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(10,20,8,0.55)";
            ctx.stroke();
          }
          // folhinhas soltas na borda
          for (let i = 0; i < 24; i++) {
            const c = copa[i % copa.length];
            const [x, y] = p.m.p(0.5 + c.du, 0.5 + c.dv, zc + c.dz);
            const a = hash(seed, i, 1) * Math.PI * 2;
            const d = c.rr * 40 * (0.6 + hash(seed, i, 2) * 0.4);
            ctx.fillStyle =
              hash(seed, i, 3) < 0.5 ? shade(tom, 0.3) : shade(tom, -0.25);
            ctx.fillRect(
              Math.round(x + Math.cos(a) * d),
              Math.round(y + Math.sin(a) * d * 0.8),
              2,
              2,
            );
          }
        },
      },
    ]);
  },

  arbusto(def, _s, seed) {
    const [folha, escura] = def.colors;
    const r = rng(seed * 5 + 1);
    const bolas = Array.from({ length: 5 }, () => ({
      u: 0.25 + r() * 0.5,
      v: 0.25 + r() * 0.5,
      z: 0.25 + r() * 0.3,
      rr: 0.3 + r() * 0.12,
    }));
    return V([
      N([0.05, 0.95, 0.05, 0.95, 0, alt(def)], (p) => {
        const ctx = p.ctx;
        const ordem = bolas
          .map((b) => ({ b, k: p.m.xy(b.u, b.v).reduce((s, x) => s + x, 0) }))
          .sort((a, b) => a.k - b.k);
        for (const { b } of ordem) {
          const [x, y] = p.m.p(b.u, b.v, b.z);
          const rx = b.rr * 40;
          ctx.beginPath();
          ctx.ellipse(x, y, rx, rx * 0.85, 0, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(
            x - rx * 0.3,
            y - rx * 0.4,
            1,
            x,
            y,
            rx,
          );
          g.addColorStop(0, shade(folha, 0.2));
          g.addColorStop(1, escura);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = "rgba(10,20,8,0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }),
    ]);
  },

  fonte(def) {
    const [pedra, agua] = def.colors;
    const W = def.width;
    const c = W / 2;
    return V([
      N([0, W, 0, W, 0, alt(def)], (p) => {
        p.cyl(c, c, c * 0.92, 0, 0.55, pedra, { top: shade(pedra, 0.1) });
        p.disc(c, c, c * 0.8, 0.5, agua);
        // brilho mexendo na água
        const t = p.t / 1000;
        for (let i = 0; i < 6; i++) {
          const a = i + t * 0.6;
          const [x, y] = p.m.p(
            c + Math.cos(a) * c * 0.55,
            c + Math.sin(a * 1.3) * c * 0.5,
            0.5,
          );
          p.ctx.fillStyle = "rgba(220,240,250,0.45)";
          p.ctx.fillRect(Math.round(x), Math.round(y), 4, 1);
        }
        p.cyl(c, c, 0.18, 0.5, 1.15, pedra);
        p.cyl(c, c, 0.5, 1.15, 1.28, pedra, { top: agua });
        p.cyl(c, c, 0.08, 1.28, 1.6, pedra);
        // os fios de água caindo da tigela
        for (const a of [0.3, 1.9, 3.5, 5.1]) {
          const u = c + Math.cos(a) * 0.5;
          const v = c + Math.sin(a) * 0.5;
          p.line(
            [u, v, 1.2],
            [c + Math.cos(a) * 0.62, c + Math.sin(a) * 0.62, 0.52],
            "rgba(170,210,230,0.6)",
            1.5,
          );
        }
      }),
    ]);
  },

  plantacao(def, _s, seed) {
    const [verde, ponta] = def.colors;
    const h = alt(def);
    const alto = h > 1;
    const r = rng(seed * 3 + 11);
    const pes = Array.from({ length: alto ? 6 : 8 }, (_, i) => ({
      u: 0.2 + (i % 2) * 0.55 + r() * 0.1,
      v: 0.12 + Math.floor(i / 2) * (alto ? 0.3 : 0.22) + r() * 0.08,
      hh: h * (0.8 + r() * 0.25),
    }));
    return V([
      N([0.05, 0.95, 0.05, 0.95, 0, h], (p) => {
        // a terra amontoada da leira
        p.withTop(0.01, (ctx) => {
          ctx.fillStyle = "rgba(70,46,26,0.55)";
          ctx.fillRect(0.1, 0.05, 0.8, 0.9);
        });
        const ordem = pes
          .map((q) => ({ q, k: p.m.xy(q.u, q.v).reduce((s, x) => s + x, 0) }))
          .sort((a, b) => a.k - b.k);
        for (const { q } of ordem) {
          if (alto) {
            // pé de milho: talo, folhas compridas e o pendão
            p.line([q.u, q.v, 0], [q.u, q.v, q.hh], shade(verde, -0.15), 2);
            for (let k = 0; k < 4; k++) {
              const z = q.hh * (0.25 + k * 0.17);
              const s = k % 2 ? 1 : -1;
              p.line(
                [q.u, q.v, z],
                [q.u + s * 0.18, q.v + 0.1, z + 0.18],
                shade(verde, k * 0.06),
                2,
              );
            }
            p.line([q.u, q.v, q.hh], [q.u, q.v, q.hh + 0.12], ponta, 2);
            if (hash(seed, q.u * 10) < 0.5)
              p.line(
                [q.u, q.v, q.hh * 0.55],
                [q.u + 0.06, q.v, q.hh * 0.62],
                "#d8c070",
                3,
              );
          } else {
            // pé de horta: tufo baixo
            const [x, y] = p.m.p(q.u, q.v, q.hh * 0.5);
            p.ctx.beginPath();
            p.ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
            p.ctx.fillStyle = shade(verde, (hash(seed, q.v * 10) - 0.5) * 0.3);
            p.ctx.fill();
            p.ctx.strokeStyle = "rgba(10,20,8,0.5)";
            p.ctx.lineWidth = 1;
            p.ctx.stroke();
          }
        }
      }),
    ]);
  },

  feno(def) {
    const [palha, escura] = def.colors;
    const h = alt(def);
    const b: LBox = [0.08, 0.92, 0.04, 0.96, 0, h];
    return V([
      N(b, (p) => {
        p.box(b, palha, { edge: 0.25 });
        // fios de palha e as duas amarras
        for (const f of FACES) {
          if (!p.m.visible(f)) continue;
          const [a0, a1] =
            f === "front" || f === "back" ? [b[2], b[3]] : [b[0], b[1]];
          for (let z = 0.06; z < h; z += 0.07)
            p.face(
              b,
              f,
              a0 + 0.02,
              a1 - 0.02,
              z,
              z + 0.012,
              rgba(escura, 0.35),
              true,
            );
          for (const t of [0.3, 0.7]) {
            const a = a0 + (a1 - a0) * t;
            p.face(b, f, a - 0.012, a + 0.012, 0, h, "#5a4a2a", true);
          }
        }
      }),
    ]);
  },

  /**
   * O alçapão do celeiro, escondido embaixo do feno (estado 0 = não aparece). Revelado: a
   * boca no chão com o batente de tábuas, a escada de mão descendo para o escuro, a tampa
   * aberta de pé no fundo e a luz das velas do calabouço lá embaixo.
   */
  alcapao(def, state) {
    if (state !== 1) return V([]);
    const [madeira, escuro] = def.colors;
    return V(
      [
        N([0, 1, 0, 1, 0, 0.78], (p) => {
          const ctx = p.ctx;
          const batente: P3[] = [
            [0.06, 0.06, 0.003],
            [0.94, 0.06, 0.003],
            [0.94, 0.94, 0.003],
            [0.06, 0.94, 0.003],
          ];
          const boca: P3[] = [
            [0.14, 0.14, 0.005],
            [0.86, 0.14, 0.005],
            [0.86, 0.86, 0.005],
            [0.14, 0.86, 0.005],
          ];
          p.poly(batente, shade(madeira, -0.12), OUTLINE);
          for (const v of [0.3, 0.52, 0.74])
            p.line([0.06, v, 0.004], [0.94, v, 0.004], "rgba(0,0,0,0.3)", 1);
          p.poly(boca, escuro, OUTLINE);
          ctx.save();
          const s = boca.map(([u, v, z]) => p.m.p(u, v, z));
          ctx.beginPath();
          ctx.moveTo(s[0][0], s[0][1]);
          for (const q of s.slice(1)) ctx.lineTo(q[0], q[1]);
          ctx.closePath();
          ctx.clip();
          // o brilho das velas lá embaixo
          const [cx, cy] = p.m.p(0.5, 0.5, -1.4);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
          g.addColorStop(0, "rgba(255,120,50,0.42)");
          g.addColorStop(1, "rgba(255,120,50,0)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - 40, cy - 40, 80, 80);
          // a escada de mão encostada no fundo da boca: os dois paus e os degraus
          for (const v of [0.34, 0.66])
            p.line([0.2, v, 0], [0.34, v, -1.8], shade(madeira, -0.15), 3);
          for (let k = 0; k < 7; k++) {
            const t = (k + 0.5) / 7;
            const u = 0.2 + t * 0.14;
            const z = -t * 1.8;
            p.line([u, 0.34, z], [u, 0.66, z], shade(madeira, -0.2 - k * 0.1), 2);
          }
          ctx.restore();
          // a tampa aberta, de pé no fundo, presa nas dobradiças
          const tampa: LBox = [0.02, 0.08, 0.14, 0.86, 0, 0.72];
          p.box(tampa, madeira, { edge: 0.2 });
          p.face(tampa, "front", 0.14, 0.86, 0.34, 0.38, "rgba(0,0,0,0.3)", true);
          p.face(tampa, "front", 0.46, 0.54, 0.1, 0.62, "rgba(0,0,0,0.22)", true);
        }),
      ],
      [{ u: 0.5, v: 0.5, z: 0.05, radius: 70, color: "#ff7a3a", intensity: 0.4, flicker: 0.08, kind: "fire" }],
    );
  },

  /**
   * A escada de mão do calabouço: presa na parede do fundo (u = 0), sobe reto até o alto
   * da parede, onde fica o alçapão do celeiro; a luz de lá de cima cai pelo buraco.
   */
  escada_vertical(def) {
    const [madeira, luz] = def.colors;
    const topo = 2.95;
    const u0 = 0.08;
    const u1 = 0.16;
    return V(
      [
        N([0, 0.3, 0.15, 0.85, 0, topo], (p) => {
          // a luz do celeiro no chão, embaixo do buraco
          p.withTop(0.003, (ctx) => {
            const g = ctx.createRadialGradient(0.45, 0.5, 0, 0.45, 0.5, 0.5);
            g.addColorStop(0, rgba(luz, 0.28));
            g.addColorStop(1, rgba(luz, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 1, 1);
          });
          // os dois paus e os degraus (de 30 em 30 cm)
          for (const v of [0.24, 0.76])
            p.box([u0, u1, v - 0.035, v + 0.035, 0, topo], madeira, { edge: 0.2 });
          for (let z = 0.3; z < topo - 0.1; z += 0.3)
            p.box([u0 + 0.01, u1 - 0.01, 0.26, 0.74, z - 0.02, z + 0.02], shade(madeira, 0.08), {
              edge: 0.25,
            });
          // o pé da escada gasto de barro
          p.box([u0 - 0.01, u1 + 0.01, 0.2, 0.8, 0, 0.04], shade(madeira, -0.3));
        }),
      ],
      [{ u: 0.4, v: 0.5, z: 2.5, radius: 85, color: luz, intensity: 0.32, flicker: 0.04 }],
    );
  },

  sacas(def, _s, seed) {
    const [saco, escuro] = def.colors;
    const r = rng(seed + 17);
    const pilha = [
      { u: 0.3, v: 0.32, z: 0 },
      { u: 0.68, v: 0.35, z: 0 },
      { u: 0.35, v: 0.7, z: 0 },
      { u: 0.68, v: 0.7, z: 0 },
      { u: 0.5, v: 0.5, z: 0.3 },
    ];
    return V([
      N([0.08, 0.92, 0.08, 0.92, 0, alt(def)], (p) => {
        const ordem = pilha
          .map((s) => ({
            s,
            k: p.m.xy(s.u, s.v).reduce((a, x) => a + x, 0) + s.z * 3,
          }))
          .sort((a, b) => a.k - b.k);
        for (const { s } of ordem) {
          const [x, y] = p.m.p(s.u, s.v, s.z + 0.16);
          const ctx = p.ctx;
          ctx.beginPath();
          ctx.ellipse(x, y, 13, 9, (r() - 0.5) * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = shade(saco, (r() - 0.5) * 0.12);
          ctx.fill();
          ctx.strokeStyle = shade(escuro, -0.3);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = rgba(escuro, 0.5);
          ctx.fillRect(Math.round(x - 4), Math.round(y - 8), 8, 2);
        }
      }),
    ]);
  },

  carroca(def) {
    const [madeira, escura] = def.colors;
    const W = def.width;
    const D = def.depth;
    const cama: LBox = [0.3, D - 0.6, 0.25, W - 0.25, 0.6, 0.72];
    const roda = (v: number) => (p: Painter) => {
      const ctx = p.ctx;
      const [x, y] = p.m.p(D * 0.45, v, 0.45);
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 20, 0.5, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = escura;
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 18);
        ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 18);
        ctx.stroke();
      }
    };
    return V([
      N([D * 0.45 - 0.3, D * 0.45 + 0.3, 0.1, 0.2, 0, 0.9], roda(0.15)),
      N(cama, (p) => {
        p.box(cama, madeira, { edge: 0.2 });
        // as tábuas dos lados
        p.box([0.3, D - 0.6, 0.25, 0.33, 0.72, 1.15], madeira);
        p.box([0.3, D - 0.6, W - 0.33, W - 0.25, 0.72, 1.15], madeira);
        p.box([0.3, 0.38, 0.33, W - 0.33, 0.72, 1.15], shade(madeira, -0.08));
        p.box(
          [D - 0.68, D - 0.6, 0.33, W - 0.33, 0.72, 1.0],
          shade(madeira, -0.08),
        );
        // o varal para o cavalo
        p.box([D - 0.6, D, 0.6, 0.68, 0.5, 0.58], escura);
        p.box([D - 0.6, D, W - 0.68, W - 0.6, 0.5, 0.58], escura);
      }),
      N(
        [D * 0.45 - 0.3, D * 0.45 + 0.3, W - 0.2, W - 0.1, 0, 0.9],
        roda(W - 0.15),
      ),
    ]);
  },

  placa(def) {
    const [madeira, escura] = def.colors;
    const h = alt(def);
    return V([
      N([0.3, 0.7, 0.1, 0.9, 0, h], (p) => {
        p.box([0.45, 0.55, 0.45, 0.55, 0, h], escura, { edge: 0.2 });
        // duas tábuas em seta, para lados diferentes
        const seta = (z: number, s: 1 | -1) => {
          const v0 = s > 0 ? 0.5 : 0.08;
          const v1 = s > 0 ? 0.92 : 0.5;
          const pts: P3[] =
            s > 0
              ? [
                  [0.56, v0, z],
                  [0.56, v1 - 0.1, z],
                  [0.56, v1, z + 0.12],
                  [0.56, v1 - 0.1, z + 0.24],
                  [0.56, v0, z + 0.24],
                ]
              : [
                  [0.56, v1, z],
                  [0.56, v1, z + 0.24],
                  [0.56, v0 + 0.1, z + 0.24],
                  [0.56, v0, z + 0.12],
                  [0.56, v0 + 0.1, z],
                ];
          p.poly(pts, shade(madeira, p.m.shadeOf("front")), OUTLINE);
          p.line(
            [0.56, v0 + 0.08, z + 0.12],
            [0.56, v1 - 0.14, z + 0.12],
            "rgba(30,20,12,0.6)",
            1,
          );
        };
        seta(h - 0.35, 1);
        seta(h - 0.7, -1);
      }),
    ]);
  },

  // ---------------------------------------------------------------- casa
  /** O vão da escada no andar de cima: degraus descendo para o fundo (u = 0) e o corrimão em dois lados. */
  escada_desce(def) {
    const [madeira, escuro] = def.colors;
    const D = def.depth;
    return V([
      N([0, D, 0, 1, 0, 0.95], (p) => {
        const ctx = p.ctx;
        const borda: P3[] = [
          [0.04, 0.06, 0.004],
          [D - 0.02, 0.06, 0.004],
          [D - 0.02, 0.94, 0.004],
          [0.04, 0.94, 0.004],
        ];
        p.poly(borda, escuro, OUTLINE);
        ctx.save();
        const s = borda.map(([u, v, z]) => p.m.p(u, v, z));
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        for (const q of s.slice(1)) ctx.lineTo(q[0], q[1]);
        ctx.closePath();
        ctx.clip();
        // degraus: cada um mais fundo e mais escuro
        for (let k = 0; k < 7; k++) {
          const u = D - 0.12 - k * 0.27;
          const z = -0.18 * (k + 1);
          p.poly(
            [
              [u, 0.06, z],
              [u - 0.27, 0.06, z],
              [u - 0.27, 0.94, z],
              [u, 0.94, z],
            ],
            shade(madeira, -0.1 - k * 0.11),
          );
          p.line([u, 0.06, z], [u, 0.94, z], "rgba(255,230,190,0.18)", 1);
        }
        ctx.restore();
        // corrimão: no fundo e no lado de v = 0
        for (const [u, v] of [
          [0.06, 0.06],
          [0.06, 0.94],
          [D * 0.5, 0.06],
          [D - 0.08, 0.06],
        ] as [number, number][])
          p.box([u - 0.04, u + 0.04, v - 0.04, v + 0.04, 0, 0.9], madeira, {
            edge: 0.2,
          });
        p.box([0.02, 0.1, 0.02, 0.98, 0.86, 0.94], shade(madeira, 0.1), {
          edge: 0.25,
        });
        p.box([0.02, D - 0.04, 0.02, 0.1, 0.86, 0.94], shade(madeira, 0.1), {
          edge: 0.25,
        });
      }),
    ]);
  },

  armario(def) {
    const [madeira, ferragem] = def.colors;
    const W = def.width;
    const h = alt(def);
    const b: LBox = [0.12, 0.92, 0.04, W - 0.04, 0, h];
    const tampo: LBox = [0.1, 0.94, 0.02, W - 0.02, h, h + 0.04];
    return V([
      N(b, (p) => {
        p.box(b, madeira, { edge: 0.14 });
        if (h < 1.2) {
          drawers(
            p,
            b,
            "front",
            3,
            Math.max(1, Math.round(W)),
            madeira,
            ferragem,
          );
          return;
        }
        // duas portas por casa de largura, com puxador
        const n = Math.max(2, Math.round(W));
        if (!p.m.visible("front")) return;
        for (let i = 0; i < n; i++) {
          const a0 = b[2] + ((b[3] - b[2]) * i) / n;
          const a1 = b[2] + ((b[3] - b[2]) * (i + 1)) / n;
          p.face(
            b,
            "front",
            a0 + 0.03,
            a1 - 0.03,
            0.12,
            h - 0.06,
            shade(madeira, 0.05),
          );
          p.face(
            b,
            "front",
            a0 + 0.07,
            a1 - 0.07,
            0.2,
            h - 0.14,
            shade(madeira, -0.06),
          );
          const m = i % 2 ? a0 + 0.08 : a1 - 0.08;
          p.face(
            b,
            "front",
            m - 0.015,
            m + 0.015,
            h * 0.45,
            h * 0.58,
            ferragem,
            true,
          );
        }
        p.face(b, "front", b[2], b[3], 0, 0.1, shade(madeira, -0.3));
      }),
      B(tampo, shade(madeira, 0.1), { edge: 0.25 }),
    ]);
  },

  fogao(def, state) {
    const [esmalte, ferro] = def.colors;
    const W = def.width;
    const aceso = state === 1;
    const corpo: LBox = [0.15, 0.95, 0.05, W - 0.05, 0, 0.8];
    const chapa: LBox = [0.12, 0.98, 0.02, W - 0.02, 0.8, 0.86];
    return V(
      [
        N(corpo, (p) => {
          p.box(corpo, esmalte, { edge: 0.12 });
          if (p.m.visible("front")) {
            // a fornalha (com fogo quando aceso) e o forno
            p.face(corpo, "front", 0.2, 0.75, 0.25, 0.65, ferro);
            p.face(
              corpo,
              "front",
              0.27,
              0.68,
              0.3,
              0.58,
              aceso ? "#e2741e" : "#1a1614",
              true,
            );
            if (aceso)
              p.face(corpo, "front", 0.32, 0.63, 0.3, 0.42, "#ffd27a", true);
            p.face(corpo, "front", 0.95, W - 0.25, 0.2, 0.65, ferro);
            p.face(corpo, "front", 1.0, W - 0.3, 0.6, 0.62, "#c9a86a", true);
          }
        }),
        N(chapa, (p) => {
          p.box(chapa, ferro, { edge: 0.2 });
          for (const v of [0.5, 1.1])
            p.disc(0.55, v, 0.17, 0.861, shade(ferro, 0.12), "rgba(0,0,0,0.6)");
        }),
        N([0.2, 0.45, W - 0.45, W - 0.2, 0.86, 2.6], (p) =>
          p.cyl(0.32, W - 0.32, 0.1, 0.86, 2.6, "#2e2a28"),
        ),
      ],
      lightIf(aceso, {
        u: 0.9,
        v: 0.5,
        z: 0.45,
        radius: 130,
        color: WARM,
        intensity: 0.75,
        flicker: 0.15,
        kind: "fire",
      }),
    );
  },

  pia_cozinha(def) {
    const [armario, inox] = def.colors;
    const W = def.width;
    const corpo: LBox = [0.12, 0.95, 0.03, W - 0.03, 0, 0.84];
    const tampo: LBox = [0.06, 1, 0, W, 0.84, 0.9];
    return V([
      N(corpo, (p) => {
        p.box(corpo, armario, { edge: 0.12 });
        drawers(
          p,
          corpo,
          "front",
          1,
          Math.max(2, Math.round(W * 1.5)),
          armario,
          "#5a4a3a",
        );
      }),
      N(tampo, (p) => {
        p.box(tampo, "#8a8a84", { edge: 0.25 });
        // a cuba e a torneira
        p.withTop(0.901, (ctx) => {
          ctx.fillStyle = shade(inox, -0.25);
          ctx.fillRect(0.3, W * 0.5, 0.5, W * 0.38);
          ctx.fillStyle = shade(inox, -0.45);
          ctx.fillRect(0.36, W * 0.53, 0.38, W * 0.32);
        });
        p.line([0.18, W * 0.69, 0.9], [0.18, W * 0.69, 1.12], inox, 2.5);
        p.line([0.18, W * 0.69, 1.12], [0.4, W * 0.69, 1.08], inox, 2.5);
      }),
    ]);
  },

  mesa(def) {
    const [tampo, perna] = def.colors;
    const W = def.width;
    const D = def.depth;
    const h = alt(def);
    const top: LBox = [0.06, D - 0.06, 0.06, W - 0.06, h - 0.06, h];
    const L = (u: number, v: number): LBox => [
      u,
      u + 0.1,
      v,
      v + 0.1,
      0,
      h - 0.06,
    ];
    const pernas = [
      L(0.18, 0.18),
      L(D - 0.28, 0.18),
      L(0.18, W - 0.28),
      L(D - 0.28, W - 0.28),
    ];
    return V([
      ...pernas.map((b) => B(b, perna)),
      N(top, (p) => {
        p.box(top, tampo, { edge: 0.28 });
        // os veios da madeira
        p.withTop(h + 0.001, (ctx) => {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 0.015;
          for (let u = 0.2; u < D - 0.1; u += 0.22) {
            ctx.beginPath();
            ctx.moveTo(u, 0.1);
            ctx.lineTo(u, W - 0.1);
            ctx.stroke();
          }
        });
      }),
    ]);
  },

  banheira(def) {
    const [louca, metal] = def.colors;
    const D = def.depth;
    const corpo: LBox = [0.1, D - 0.1, 0.08, 0.92, 0.14, 0.6];
    const pes = [0.25, D - 0.3].flatMap((u): LBox[] => [
      [u, u + 0.08, 0.14, 0.22, 0, 0.14],
      [u, u + 0.08, 0.78, 0.86, 0, 0.14],
    ]);
    return V([
      ...pes.map((b) => B(b, metal)),
      N(corpo, (p) => {
        p.box(corpo, louca, { edge: 0.3 });
        p.withTop(0.601, (ctx) => {
          ctx.fillStyle = mix(louca, "#9ab0b8", 0.35);
          ctx.beginPath();
          ctx.ellipse(D / 2, 0.5, D / 2 - 0.22, 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        p.line([0.16, 0.5, 0.6], [0.16, 0.5, 0.78], metal, 2.5);
        p.line([0.16, 0.5, 0.78], [0.3, 0.5, 0.74], metal, 2.5);
      }),
    ]);
  },
};
