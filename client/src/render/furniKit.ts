import type { FurniDef } from '@crona/shared';
import { rgba, shade } from './color';
import type { LBox, LFace, Painter } from './painter';

/** Peças comuns para desenhar mobis de chão (usadas por furniFloor e furniSede). */

/** fire = vela/tocha (resiste ao apagão), electric = cai no apagão e pisca, natural = janela/lua, emergency = só no apagão fica forte */
export type LightKind = 'fire' | 'electric' | 'natural' | 'emergency' | 'cristal';

export interface LightDef {
  u: number;
  v: number;
  z: number;
  radius: number;
  color: string;
  intensity: number;
  flicker?: number;
  kind?: LightKind;
}
export interface FNode {
  b: LBox;
  draw(p: Painter): void;
  /** quanto o desenho passa da caixa, em px de tela (a copa da árvore): vale no raio-x e no corte da tela */
  pad?: number;
  /** a caixa para a ordem de desenho, quando não é a do desenho (ver `naParede`) */
  ordem?: LBox;
}
export interface FVisual {
  nodes: FNode[];
  lights: LightDef[];
}

export type Builder = (def: FurniDef, state: number, seed: number) => FVisual;

export const N = (b: LBox, draw: (p: Painter) => void): FNode => ({ b, draw });
export const B = (b: LBox, color: string, o?: Parameters<Painter['box']>[2]): FNode => N(b, (p) => p.box(b, color, o));
export const V = (nodes: FNode[], lights: LightDef[] = []): FVisual => ({ nodes, lights });

/**
 * A peça como parte da parede na ordem de desenho: a mesma caixa, só que atrás do plano da parede.
 * A moldura da porta passa para as casas vizinhas (a porta tem 0,9 m e a casa, 0,75 m); sem isso,
 * ela saía por cima do que fica na sala encostado nela (a estante do lado, quem para ali).
 */
export const naParede = (n: FNode): FNode => ({ ...n, ordem: [n.b[0] - 0.3, n.b[1] - 0.3, n.b[2], n.b[3], n.b[4], n.b[5]] });

/**
 * A porta no tamanho da arte dela (desde 05/10, 0,75 m com o batente, a largura da casa): o vão tem
 * 0,65 m e o batente, 5 cm de cada lado. Na ordem de desenho, a moldura é parede (`naParede`), e o
 * que fica encostado nela vem na frente.
 */
export const VAO_PORTA_M = 0.65;
export const BATENTE_PORTA_M = 0.05;

export const WARM = '#ffb45a';
export const PAPER = '#d8cdb0';

/** Faixa horizontal da face (a0..a1). */
export function faceRange(b: LBox, f: LFace): [number, number] {
  return f === 'front' || f === 'back' ? [b[2], b[3]] : [b[0], b[1]];
}

export function drawers(p: Painter, b: LBox, f: LFace, rows: number, cols: number, color: string, handle: string, label?: string) {
  if (!p.m.visible(f)) return;
  const [a0, a1] = faceRange(b, f);
  const z0 = b[4] + 0.05;
  const z1 = b[5] - 0.04;
  const cw = (a1 - a0 - 0.06) / cols;
  const rh = (z1 - z0) / rows;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x0 = a0 + 0.04 + c * cw;
      const x1 = x0 + cw - 0.03;
      const y0 = z0 + r * rh;
      const y1 = y0 + rh - 0.04;
      p.face(b, f, x0, x1, y0, y1, shade(color, -0.25));
      p.face(b, f, x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.01, shade(color, 0.04));
      const mid = (x0 + x1) / 2;
      if (label) p.face(b, f, mid - 0.1, mid + 0.1, y1 - 0.12, y1 - 0.05, label);
      const hz = label ? y1 - 0.19 : (y0 + y1) / 2;
      p.face(b, f, mid - 0.08, mid + 0.08, hz - 0.02, hz + 0.015, handle);
    }
}

export function vents(p: Painter, b: LBox, f: LFace, z0: number, n: number, color: string) {
  if (!p.m.visible(f)) return;
  const [a0, a1] = faceRange(b, f);
  const m = (a0 + a1) / 2;
  const w = Math.min(0.3, (a1 - a0) * 0.3);
  for (let i = 0; i < n; i++) p.face(b, f, m - w, m + w, z0 + i * 0.06, z0 + i * 0.06 + 0.025, color);
}

export function crateFace(p: Painter, b: LBox, f: LFace, wood: string) {
  if (!p.m.visible(f)) return;
  const [a0, a1] = faceRange(b, f);
  const z0 = b[4];
  const z1 = b[5];
  const dark = shade(wood, -0.35);
  const frame = shade(wood, -0.12);
  const h = z1 - z0;
  for (let k = 1; k < 3; k++) p.face(b, f, a0, a1, z0 + (k * h) / 3 - 0.01, z0 + (k * h) / 3 + 0.01, dark);
  p.withFace(b, f, (ctx) => {
    ctx.strokeStyle = shade(frame, p.m.shadeOf(f));
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(a0 + 0.1, z0 + 0.08);
    ctx.lineTo(a1 - 0.1, z1 - 0.08);
    ctx.stroke();
  });
  p.face(b, f, a0, a0 + 0.1, z0, z1, frame);
  p.face(b, f, a1 - 0.1, a1, z0, z1, frame);
  p.face(b, f, a0, a1, z0, z0 + 0.08, frame);
  p.face(b, f, a0, a1, z1 - 0.08, z1, frame);
  for (const [a, z] of [
    [a0 + 0.05, z0 + 0.04],
    [a1 - 0.05, z0 + 0.04],
    [a0 + 0.05, z1 - 0.04],
    [a1 - 0.05, z1 - 0.04],
  ])
    p.face(b, f, a - 0.015, a + 0.015, z - 0.015, z + 0.015, '#1a1410');
}

/** Bloco de parede interna com tijolos, no mesmo estilo das paredes do quarto. */
export function wallBlock(p: Painter, b: LBox, color: string) {
  p.box(b, color, { edge: 0.12, top: '#5a524b' });
  for (const f of ['front', 'back', 'left', 'right'] as LFace[]) {
    if (!p.m.visible(f)) continue;
    const [a0, a1] = faceRange(b, f);
    p.withFace(b, f, (ctx) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 0.025;
      let k = 0;
      for (let z = b[4] + 0.3; z < b[5] - 0.05; z += 0.3, k++) {
        ctx.beginPath();
        ctx.moveTo(a0, z);
        ctx.lineTo(a1, z);
        ctx.stroke();
        for (let a = a0 + ((k % 2) * 0.25 + 0.25); a < a1; a += 0.5) {
          ctx.beginPath();
          ctx.moveTo(a, z);
          ctx.lineTo(a, Math.min(b[5], z + 0.3));
          ctx.stroke();
        }
      }
    });
    // sujeira na base
    p.face(b, f, a0, a1, b[4], b[4] + 0.14, 'rgba(10,8,7,0.7)', true);
  }
}

export function lightIf(on: boolean, l: LightDef): LightDef[] {
  return on ? [l] : [];
}
