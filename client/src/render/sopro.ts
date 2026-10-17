/**
 * A vela soprada (17/10, o Felipe: "vela tem que soprar, então suave"). Quando um móvel de fogo (vela, candelabro,
 * arandela, lareira) apaga, ele continua desenhado aceso por um instante, e nesse instante a chama encolhe para o
 * pavio (painter.ts, furniWall.ts), a luz dele some aos poucos (lighting.ts) e, no fim, sobe um fio de fumaça
 * (particles.ts). Cada um pergunta aqui, pelo id do móvel (a semente da luz), o quanto ele já apagou; o estado de
 * desenhar sai de `soproMovel.ts`. A lâmpada elétrica apaga na hora, como na vida real.
 */
export const SOPRO_MS = 650;

interface Lembranca {
  /** o estado que o servidor mandou por último */
  state: number;
  /** o estado aceso de antes e quando apagou (-Infinity = não está apagando) */
  de: number;
  t0: number;
}

const estados = new Map<number, Lembranca>();

/**
 * O estado em que o móvel vai desenhado agora: logo depois de o fogo apagar, ainda o aceso (`temFogo` diz se um estado
 * tem fogo). Quem desenha usa pelo `soproMovel.ts`.
 */
export function estadoSoprado(id: number, state: number, temFogo: (s: number) => boolean): number {
  const now = performance.now();
  const r = estados.get(id);
  if (!r) {
    estados.set(id, { state, de: state, t0: -Infinity });
    return state;
  }
  if (r.state !== state) {
    if (temFogo(r.state) && !temFogo(state)) {
      r.de = r.state;
      r.t0 = now;
    } else r.t0 = -Infinity;
    r.state = state;
  }
  return now - r.t0 < SOPRO_MS ? r.de : state;
}

/** O quanto o fogo deste móvel já apagou: 0 = aceso (ou nada a ver), até 1 = apagou. */
export function apagandoDe(id: number | undefined): number {
  if (id === undefined) return 0;
  const r = estados.get(id);
  if (!r || r.t0 === -Infinity) return 0;
  const k = (performance.now() - r.t0) / SOPRO_MS;
  return k > 0 && k < 1 ? k : 0;
}

/** Quanto a chama ainda tem do tamanho, soprada (encolhe rápido no fim, como quem apaga com o sopro). */
export const tamanhoDaChama = (k: number) => (k <= 0 ? 1 : Math.max(0, 1 - k * k));

/** Trocou de cena: esquece os estados (voltando a uma cena, o que mudou lá não é soprado). */
export function esquecerSopros() {
  estados.clear();
}
