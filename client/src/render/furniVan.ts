import { shade } from './color';
import { B, N, V, type Builder } from './furniKit';
import type { LBox } from './painter';

/**
 * A van da Viagem, desenhada em código (a arte do Códex entra depois, por cima): o banco de couro preto
 * com o apoio de cabeça, o console entre os bancos da frente e o painel com o volante. Todos olham para
 * a frente do veículo (+x, giro 2). Coordenadas locais como em furniFloor: u = fundo → frente, v = largura.
 */

const banco: Builder = (def) => {
  const [c0, c1] = def.colors;
  const base: LBox = [0.16, 0.96, 0.08, 0.92, 0.12, 0.3];
  const almofada: LBox = [0.2, 0.96, 0.12, 0.88, 0.3, 0.46];
  const encosto: LBox = [0.06, 0.26, 0.08, 0.92, 0.3, 1.02];
  const apoio: LBox = [0.1, 0.24, 0.3, 0.7, 1.02, 1.28];
  const trilho: LBox = [0.2, 0.9, 0.3, 0.7, 0, 0.12];
  return V([
    B(trilho, '#101012'),
    B(base, shade(c0, -0.2)),
    B(almofada, c0, { edge: 0.25 }),
    N(encosto, (p) => {
      p.box(encosto, c0, { edge: 0.2 });
      // as costuras do encosto
      if (p.m.visible('front'))
        for (const z of [0.55, 0.78]) p.face(encosto, 'front', 0.12, 0.88, z, z + 0.02, shade(c1, -0.1));
    }),
    B(apoio, shade(c0, 0.04), { edge: 0.2 }),
  ]);
};

const console_: Builder = (def) => {
  const [c0, c1] = def.colors;
  const corpo: LBox = [0.12, 0.92, 0.1, 0.9, 0, 0.45];
  return V([
    B(corpo, c0, { edge: 0.2 }),
    N([0.2, 0.84, 0.18, 0.82, 0.45, 0.47], (p) => {
      // dois porta-copos
      for (const v of [0.34, 0.66]) p.cyl(0.5, v, 0.11, 0.44, 0.47, shade(c1, -0.4));
    }),
  ]);
};

const painel: Builder = (def) => {
  const [c0, c1] = def.colors;
  const W = def.width;
  const corpo: LBox = [0.1, 0.96, 0, W, 0, 0.5];
  const quadro: LBox = [0.18, 0.5, W - 1.05, W - 0.15, 0.5, 0.66];
  return V([
    B(corpo, c0, { edge: 0.25 }),
    // o quadro de instrumentos, na frente do motorista (v grande)
    B(quadro, shade(c1, -0.2), { edge: 0.2 }),
    N([0.1, 0.96, 0, W, 0.5, 0.52], (p) => {
      // o volante: um aro inclinado, de lado, e o cubo
      const u0 = 0.4;
      const v0 = W - 0.6;
      const pts: [number, number, number][] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push([u0 + Math.cos(a) * 0.12, v0 + Math.sin(a) * 0.3, 0.78 + Math.cos(a) * 0.1]);
      }
      p.poly(pts, null, '#08080a', 2.4);
      p.line([u0, v0 - 0.3, 0.78], [u0, v0 + 0.3, 0.78], '#08080a', 1.6);
      p.line([u0 - 0.1, v0, 0.78], [u0 + 0.12, v0, 0.78], '#08080a', 1.6);
      // a coluna
      p.line([u0 + 0.1, v0, 0.74], [0.72, v0, 0.52], '#1d1d22', 3);
    }),
    // os mostradores acesos
    N([0.18, 0.5, W - 1.05, W - 0.15, 0.66, 0.67], (p) => {
      for (const [i, cor] of [[0, '#5ad0ff'], [1, '#ffb45a'], [2, '#7aff9a']] as [number, string][]) p.cyl(0.34, W - 0.9 + i * 0.3, 0.06, 0.66, 0.68, cor);
    }),
  ]);
};

export const VAN_BUILDERS: Record<string, Builder> = { van_seat: banco, van_console: console_, van_dash: painel };
