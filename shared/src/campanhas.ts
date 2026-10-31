import type { PapelConta } from './session';

/**
 * As campanhas das contas (29/10, o Felipe: "uma lista de campanhas separadas em campanhas que eu participo e campanhas
 * que eu mestro... uma opção de criar campanha ou entrar em uma campanha com o código de convite").
 *
 * Campanha aqui é a história inteira de um grupo (a "Segredos do Outro Lado"), não o lugar (a Sede, a Fazenda: esses são
 * os `CampaignData` do servidor). Cada conta tem um papel em cada campanha: quem cria é o mestre dela; quem entra pelo
 * código é jogador. Por enquanto só existe um tabuleiro, o da campanha principal; as outras ficam guardadas, prontas para
 * quando o tabuleiro tiver vários mundos.
 */

/** Os sistemas de jogo de uma campanha. A lista cresce: D&D, o sistema cyberpunk do Felipe e o que vier. */
export const SISTEMAS = [
  { id: 'ordem-paranormal', nome: 'Ordem Paranormal', pronto: true },
  { id: 'dnd-5e', nome: 'Dungeons & Dragons 5e', pronto: false },
  { id: 'cyberpunk', nome: 'Cyberpunk (sistema da casa)', pronto: false },
  { id: 'outro', nome: 'Outro sistema', pronto: false },
] as const;

export type SistemaId = (typeof SISTEMAS)[number]['id'];

export function sistema(id: string) {
  return SISTEMAS.find((s) => s.id === id) ?? SISTEMAS[SISTEMAS.length - 1];
}

export function ehSistema(id: unknown): id is SistemaId {
  return typeof id === 'string' && SISTEMAS.some((s) => s.id === id);
}

export interface MembroCampanha {
  contaId: number;
  papel: PapelConta;
  desde: number;
}

/** Guardada no servidor (`Database.campanhasJogo`). */
export interface Campanha {
  id: number;
  nome: string;
  sistema: SistemaId;
  membros: MembroCampanha[];
  /** o código de convite que o mestre passa aos jogadores; sem ele, ninguém novo entra */
  convite?: string;
  criadaEm: number;
  /** a campanha do tabuleiro de hoje (a única com mundo, por enquanto) */
  principal?: boolean;
}

/** O que a tela "Minhas campanhas" mostra de cada uma. */
export interface ResumoCampanha {
  id: number;
  nome: string;
  sistema: SistemaId;
  /** o papel de quem pediu a lista */
  papel: PapelConta;
  /** os nomes dos mestres */
  mestres: string[];
  jogadores: number;
  principal: boolean;
  /** só para o mestre */
  convite?: string;
}

/** Letras e números que não se confundem (sem 0/O, 1/I/L). */
const LETRAS_CONVITE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "K7Q-M2P": 6 letras em dois blocos. `sorte` devolve um número em [0, 1). */
export function novoConvite(sorte: () => number): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += LETRAS_CONVITE[Math.floor(sorte() * LETRAS_CONVITE.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

/** O código como a pessoa digitou ("k7q m2p", "K7QM2P") no formato guardado; null se não for um código. */
export function lerConvite(texto: string): string | null {
  const s = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 6 || [...s].some((c) => !LETRAS_CONVITE.includes(c))) return null;
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export const MAX_NOME_CAMPANHA = 60;
