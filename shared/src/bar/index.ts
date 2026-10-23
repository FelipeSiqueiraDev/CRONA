/**
 * Os jogos do bar (08/10): o fliperama, o alvo de dardos, a sinuca, o 21 e o Felipe's Fight da mansão (23/10). O mestre escolhe o agente,
 * escolhe o móvel e usa; o jogo abre no celular de quem joga com aquele agente. Dois (ou mais, nos
 * dardos) no mesmo móvel jogam juntos: o servidor só passa as jogadas de um celular para o outro
 * (server/src/hotel.ts, "mesas do bar"), e cada celular faz as contas com o código daqui.
 *
 * Para todos os celulares chegarem no MESMO resultado (a sinuca é caótica: um fio de diferença muda
 * a mesa inteira), as contas daqui usam só soma, subtração, multiplicação, divisão e raiz quadrada
 * (que dão o mesmo número em qualquer navegador), e o sorteio é o da semente.
 */
export * as dardos from './dardos';
export * as sinuca from './sinuca';
export * as vinteum from './vinteum';
export * as luta from './luta';

export type TipoJogoBar = 'fliperama' | 'dardos' | 'sinuca' | 'vinteum' | 'luta';

/** O jogo de cada móvel do bar (ou null). */
export function jogoDoBar(defId: string): TipoJogoBar | null {
  return defId === 'arcade' ? 'fliperama' : defId === 'dartboard' ? 'dardos' : defId === 'pool_table' ? 'sinuca' : defId === 'mesa_21' ? 'vinteum' : defId === 'arcade_luta' ? 'luta' : null;
}

export const NOME_JOGO_BAR: Record<TipoJogoBar, string> = { fliperama: 'fliperama', dardos: 'dardos', sinuca: 'sinuca', vinteum: '21', luta: "Felipe's Fight" };

/** Quantos jogam juntos no mesmo móvel. */
export const MAX_JOGADORES: Record<TipoJogoBar, number> = { fliperama: 2, dardos: 4, sinuca: 2, vinteum: 6, luta: 2 };

export { sorteio, novaSemente } from './sorteio';
