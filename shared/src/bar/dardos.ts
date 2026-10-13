/**
 * Os dardos do bar: o alvo de verdade (os 20 setores, o duplo, o triplo e o centro) e o 301 (cada
 * um começa com 301 e desconta o que acerta; três dardos por vez; quem passar do zero "estoura" e
 * perde a vez; quem zerar vence). Sozinho, conta as rodadas até zerar.
 *
 * Quem arremessa calcula onde o dardo caiu e quanto valeu, e manda aos outros o lance pronto: os
 * outros celulares só aplicam (não refazem a conta do ângulo).
 */

/** Os setores do alvo, de cima, no sentido do relógio. */
export const SETORES = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Os anéis, em frações do raio do duplo (o alvo de verdade: 170 mm até a borda do duplo). */
export const ANEL = { mosca: 0.0374, centro: 0.0935, triploDentro: 0.582, triploFora: 0.629, duploDentro: 0.953, duploFora: 1 };

export interface Lance {
  /** onde caiu, em raios do alvo (0,0 = centro; x para a direita, y para baixo) */
  x: number;
  y: number;
  valor: number;
  /** 0 = fora, 1 = simples, 2 = duplo, 3 = triplo (o centro: 25 é 1, a mosca 50 é 2) */
  mult: number;
  rotulo: string;
}

/** Quanto vale um dardo em (x, y). */
export function pontuar(x: number, y: number): Lance {
  const r = Math.sqrt(x * x + y * y);
  const base = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  if (r <= ANEL.mosca) return { ...base, valor: 50, mult: 2, rotulo: 'MOSCA' };
  if (r <= ANEL.centro) return { ...base, valor: 25, mult: 1, rotulo: 'CENTRO' };
  if (r > ANEL.duploFora) return { ...base, valor: 0, mult: 0, rotulo: 'FORA' };
  // o ângulo a partir de cima, no sentido do relógio; cada setor tem 18 graus, o 20 no meio do alto
  const graus = ((Math.atan2(x, -y) * 180) / Math.PI + 360 + 9) % 360;
  const setor = SETORES[Math.floor(graus / 18) % 20];
  const mult = r >= ANEL.duploDentro ? 2 : r >= ANEL.triploDentro && r <= ANEL.triploFora ? 3 : 1;
  return { ...base, valor: setor * mult, mult, rotulo: mult === 3 ? `T${setor}` : mult === 2 ? `D${setor}` : String(setor) };
}

export interface Vez {
  jogador: number;
  lances: Lance[];
  estourou: boolean;
}

export interface Partida {
  inicial: number;
  /** quanto falta para cada um (só desconta no fim da vez) */
  restam: number[];
  vez: number;
  /** os dardos da vez de agora */
  lances: Lance[];
  rodada: number;
  vencedor: number | null;
  /** as vezes que já acabaram, a última no fim */
  historico: Vez[];
}

export function nova(jogadores: number, inicial = 301): Partida {
  return { inicial, restam: Array(Math.max(1, jogadores)).fill(inicial), vez: 0, lances: [], rodada: 1, vencedor: null, historico: [] };
}

/** Quanto a vez de agora já somou. */
export const somaDaVez = (p: Partida) => p.lances.reduce((s, l) => s + l.valor, 0);

/** Um dardo: soma, estoura, zera ou passa a vez no terceiro. */
export function lancar(p: Partida, l: Lance): Partida {
  if (p.vencedor !== null) return p;
  const q: Partida = { ...p, restam: [...p.restam], lances: [...p.lances, l], historico: [...p.historico] };
  const falta = q.restam[q.vez] - somaDaVez(q);
  const fecha = (estourou: boolean) => {
    if (!estourou) q.restam[q.vez] = falta;
    q.historico.push({ jogador: q.vez, lances: q.lances, estourou });
    q.lances = [];
    if (falta === 0 && !estourou) {
      q.vencedor = q.vez;
      return;
    }
    q.vez = (q.vez + 1) % q.restam.length;
    if (q.vez === 0) q.rodada++;
  };
  if (falta < 0) fecha(true);
  else if (falta === 0 || q.lances.length >= 3) fecha(false);
  return q;
}
