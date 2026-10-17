import type { Painter } from './painter';

/**
 * A coisa trancada que alguém tentou abrir (17/10, o Felipe: "simular a porta tentando ser aberta e travando porque tá
 * trancada"): a porta, o armário ou a escotilha mexe um tiquinho duas vezes (os dois empurrões, no tempo da maçaneta e
 * do trinco do `sfx.trancado`) e chacoalha no fim, sem sair do lugar. O id do móvel → quando começou (ms).
 */
const forcando = new Map<number, number>();
const DURA_S = 0.62;
/** os empurrões: [começo (s), duração (s), força (px)] */
const EMPURROES: [number, number, number][] = [
  [0.08, 0.1, 1.6],
  [0.3, 0.1, 1.3],
];

export function forcarMovel(id: number) {
  forcando.set(id, performance.now());
}

/** Quanto o móvel se mexe agora, em px de tela ao longo do eixo dele (0 parado). */
function deslocamento(id: number): number {
  const t0 = forcando.get(id);
  if (t0 === undefined) return 0;
  const t = (performance.now() - t0) / 1000;
  if (t > DURA_S) {
    forcando.delete(id);
    return 0;
  }
  for (const [ini, dura, forca] of EMPURROES) if (t >= ini && t < ini + dura) return forca * Math.sin((Math.PI * (t - ini)) / dura);
  // o trinco chacoalhando depois do segundo empurrão
  if (t >= 0.42 && t < 0.56) return 0.6 * Math.sin((2 * Math.PI * (t - 0.42)) / 0.045);
  return 0;
}

/** Desenha o pedaço do móvel no lugar dele, ou deslocado enquanto alguém força a tranca. */
export function desenharForcando(p: Painter, draw: (p: Painter) => void) {
  const d = forcando.size ? deslocamento(p.seed) : 0;
  if (!d) return draw(p);
  // o eixo do móvel na tela (a largura dele): a folha empurra e volta nessa direção
  const [ax, ay] = p.m.p(0, 0, 0);
  const [bx, by] = p.m.p(1, 0, 0);
  const n = Math.hypot(bx - ax, by - ay) || 1;
  const ctx = p.ctx;
  ctx.save();
  ctx.translate(Math.round(((bx - ax) / n) * d), Math.round(((by - ay) / n) * d));
  draw(p);
  ctx.restore();
}
