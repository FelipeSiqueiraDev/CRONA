/**
 * Os LUGARES (07/10): cada lugar do mundo da campanha (a Base da Ordem, a Fazenda Olhos de Águia, o Orfanato...)
 * é um conjunto de salas ligadas. O mapa-múndi mostra um ícone por lugar; a viagem vai de lugar para lugar e chega na
 * ENTRADA dele, nunca numa sala qualquer. (Quando as contas e as campanhas existirem, os lugares passam a morar dentro
 * da campanha; hoje cada conjunto de salas já é um lugar.)
 */

export const ICONES_LUGAR = ['predio', 'fazenda', 'casarao', 'casa'] as const;
export type IconeLugar = (typeof ICONES_LUGAR)[number];
export const isIconeLugar = (s: unknown): s is IconeLugar => ICONES_LUGAR.some((i) => i === s);

export interface LugarInfo {
  /** a chave do lugar (o menor id de sala dele) */
  id: number;
  nome: string;
  icone: IconeLugar;
  /** onde fica no mapa-múndi, de 0 a 1 */
  x: number;
  y: number;
  /** a sala onde se chega */
  entrada: number;
  /** quantas salas tem */
  salas: number;
  /** a cena que o mestre está vendo é deste lugar */
  aqui: boolean;
}

/** O ícone de um lugar pelo nome dele (enquanto o mestre não escolhe). */
export function iconePeloNome(nome: string): IconeLugar {
  if (/fazenda|s[ií]tio|celeiro/i.test(nome)) return 'fazenda';
  if (/orfanato|casar[aã]o|mans[aã]o|castelo/i.test(nome)) return 'casarao';
  if (/sede|ordem|base|pr[eé]dio|ordo/i.test(nome)) return 'predio';
  return 'casa';
}

/** Onde cada lugar nasce no mapa do Brasil, na ordem em que aparecem (o mestre arrasta depois). */
export const POSICOES_INICIAIS: [number, number][] = [
  [0.43, 0.24],
  [0.65, 0.29],
  [0.54, 0.8],
  [0.36, 0.5],
  [0.7, 0.5],
  [0.47, 0.62],
];

/** O ponto inicial pelo nome: a Sede em São Paulo, a fazenda no interior (Goiás), o orfanato na Bahia. */
export function posicaoInicial(nome: string, i: number): [number, number] {
  if (/sede|ordem|ordo/i.test(nome)) return [0.596, 0.69];
  if (/fazenda/i.test(nome)) return [0.53, 0.44];
  if (/orfanato/i.test(nome)) return [0.7, 0.49];
  // Igarapé (15/10): a cidadezinha do rio no interior de Minas, a oeste de Belo Horizonte
  if (/igarap[eé]/i.test(nome)) return [0.635, 0.6];
  // Tiradentes (15/10): a cidadezinha histórica no sul de Minas, entre a Sede e Igarapé
  if (/tiradentes/i.test(nome)) return [0.585, 0.625];
  // Santo Berço (15/10): a vila isolada, longe de tudo, no meio do país (o mestre arrasta se quiser)
  if (/santo ber[cç]o/i.test(nome)) return [0.47, 0.37];
  // Santa Amália (17/10): a cidade comum de Minas, perto de Tiradentes (a mata para Santo Berço fica além dela)
  if (/santa am[aá]lia/i.test(nome)) return [0.6, 0.6];
  return POSICOES_INICIAIS[i % POSICOES_INICIAIS.length];
}
