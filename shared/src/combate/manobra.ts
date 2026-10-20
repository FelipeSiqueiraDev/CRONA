/**
 * Manobras de combate (LR p. 85–86, 90, 179; COMBATE.md, seção 9): o teste
 * oposto de manobra, o que cada manobra faz quando vence, o empurrão em casas
 * e a quebra de objetos. Funções puras: a tela usa para mostrar a conta, e o
 * servidor para escrever o registro.
 */
import { METROS_POR_CASA } from './ataque';

export type ManobraId = 'agarrar' | 'derrubar' | 'desarmar' | 'empurrar' | 'quebrar' | 'atropelar' | 'soltarse' | 'esmagar';

export interface DefManobra {
  id: ManobraId;
  nome: string;
  /** verbo para o registro ("tenta derrubar") */
  verbo: string;
  /** o que acontece quando quem faz vence */
  efeito: string;
  pagina: number;
  /** só com ataque desarmado */
  desarmado?: boolean;
  /** só para quem está agarrado (soltar-se) ou agarrando (esmagar) */
  quem?: 'agarrado' | 'agarrando';
}

/** As manobras do livro e as duas do agarrar (LR p. 85–86). */
export const MANOBRAS: DefManobra[] = [
  { id: 'agarrar', nome: 'Agarrar', verbo: 'agarrar', efeito: 'o alvo fica agarrado', pagina: 85, desarmado: true },
  { id: 'derrubar', nome: 'Derrubar', verbo: 'derrubar', efeito: 'o alvo fica caído; vencendo por 5, também o empurra 1 quadrado', pagina: 85 },
  { id: 'desarmar', nome: 'Desarmar', verbo: 'desarmar', efeito: 'o item cai na casa do alvo; vencendo por 5, vai 1 quadrado adiante', pagina: 85 },
  { id: 'empurrar', nome: 'Empurrar', verbo: 'empurrar', efeito: '1,5 m, mais 1,5 m a cada 5 de diferença', pagina: 85 },
  { id: 'quebrar', nome: 'Quebrar', verbo: 'quebrar o item de', efeito: 'acerta o item que o alvo segura: dano no objeto', pagina: 85 },
  { id: 'atropelar', nome: 'Atropelar', verbo: 'atropelar', efeito: 'o alvo cai e você passa; perdendo, o avanço para', pagina: 86 },
  { id: 'soltarse', nome: 'Soltar-se', verbo: 'se soltar de', efeito: 'sai do agarrado', pagina: 85, quem: 'agarrado' },
  { id: 'esmagar', nome: 'Esmagar', verbo: 'esmagar', efeito: 'dano de impacto do ataque desarmado', pagina: 85, quem: 'agarrando' },
];

const DEF = new Map(MANOBRAS.map((m) => [m.id, m]));
export const manobra = (id: ManobraId): DefManobra | undefined => DEF.get(id);

// ------------------------------------------------------------------ tamanho

export const TAMANHOS = ['minusculo', 'pequeno', 'medio', 'grande', 'enorme', 'colossal'] as const;
export type Tamanho = (typeof TAMANHOS)[number];
export const NOME_TAMANHO: Record<Tamanho, string> = { minusculo: 'Minúsculo', pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande', enorme: 'Enorme', colossal: 'Colossal' };
/** Modificador de tamanho nos testes de manobra (Tab. 7.1, LR p. 179). */
export const MOD_TAMANHO: Record<Tamanho, number> = { minusculo: -5, pequeno: -2, medio: 0, grande: 2, enorme: 5, colossal: 10 };

export const lerTamanho = (v: unknown): Tamanho | null => (typeof v === 'string' && (TAMANHOS as readonly string[]).includes(v) ? (v as Tamanho) : null);

// ------------------------------------------------------------------ teste oposto

export interface Oposto {
  totalA: number;
  totalB: number;
  /** "empate" não acontece mais: na mesa, o empate favorece quem ataca (20/10; o livro manda rolar de novo, LR p. 75) */
  vencedor: 'a' | 'b' | 'empate';
  /** quanto o vencedor passou do outro */
  diferenca: number;
}

/**
 * Teste oposto: o maior total vence; no empate, vence quem ataca (regra da mesa,
 * 20/10; o livro manda rolar de novo, LR p. 75). Se só um lado tirou 20 natural,
 * ele vence (REGRAS.md, seção 12).
 */
export function resolverOposto(a: { d20: number; bonus: number }, b: { d20: number; bonus: number }): Oposto {
  const totalA = a.d20 + a.bonus;
  const totalB = b.d20 + b.bonus;
  const vinteA = a.d20 >= 20;
  const vinteB = b.d20 >= 20;
  let vencedor: Oposto['vencedor'];
  if (vinteA !== vinteB) vencedor = vinteA ? 'a' : 'b';
  // o empate favorece quem ataca (20/10, o Felipe: "empate sempre favorece o ataque"; o livro manda rolar de novo, LR p. 75)
  else vencedor = totalA >= totalB ? 'a' : 'b';
  return { totalA, totalB, vencedor, diferenca: Math.abs(totalA - totalB) };
}

/** Empurrar: 1,5 m, mais 1,5 m a cada 5 de diferença (LR p. 85). Em casas do CRONA (0,75 m). */
export function casasEmpurrao(diferenca: number): number {
  const metros = 1.5 * (1 + Math.floor(Math.max(0, diferenca) / 5));
  return Math.round(metros / METROS_POR_CASA);
}

/** Derrubar e desarmar vencendo por 5 ou mais: também empurra 1 quadrado (2 casas; LR p. 85). */
export const empurraUmQuadrado = (diferenca: number) => diferenca >= 5;

// ------------------------------------------------------------------ objetos

export interface Objeto {
  id: string;
  nome: string;
  tamanho?: Tamanho;
  /** Defesa do objeto solto (+5 se estiver em movimento) */
  defesa?: number;
  rd: number;
  pv: number;
}

/** Tab. 4.5 e as armas como objeto (LR p. 90). */
export const OBJETOS: Objeto[] = [
  { id: 'papel', nome: 'Folha de papel', tamanho: 'minusculo', defesa: 15, rd: 0, pv: 1 },
  { id: 'corda', nome: 'Corda', tamanho: 'minusculo', defesa: 15, rd: 0, pv: 2 },
  { id: 'corrente', nome: 'Corrente', tamanho: 'minusculo', defesa: 15, rd: 10, pv: 2 },
  { id: 'cadeira', nome: 'Cadeira', tamanho: 'pequeno', defesa: 12, rd: 5, pv: 5 },
  { id: 'caixote', nome: 'Caixote', tamanho: 'medio', defesa: 10, rd: 5, pv: 10 },
  { id: 'porta-madeira', nome: 'Porta de madeira', tamanho: 'grande', defesa: 8, rd: 5, pv: 20 },
  { id: 'porta-metal', nome: 'Porta de metal', tamanho: 'grande', defesa: 8, rd: 8, pv: 50 },
  { id: 'portao-grades', nome: 'Portão de grades', tamanho: 'grande', defesa: 8, rd: 10, pv: 50 },
  { id: 'carro', nome: 'Carro', tamanho: 'enorme', defesa: 5, rd: 10, pv: 100 },
  { id: 'arma-madeira-leve', nome: 'Arma de madeira, leve', rd: 5, pv: 2 },
  { id: 'arma-madeira-uma', nome: 'Arma de madeira, uma mão', rd: 5, pv: 5 },
  { id: 'arma-madeira-duas', nome: 'Arma de madeira, duas mãos', rd: 5, pv: 10 },
  { id: 'arma-metal-leve', nome: 'Arma de metal, leve', rd: 10, pv: 5 },
  { id: 'arma-metal-uma', nome: 'Arma de metal, uma mão', rd: 10, pv: 10 },
  { id: 'arma-metal-duas', nome: 'Arma de metal, duas mãos', rd: 10, pv: 20 },
];

const OBJ = new Map(OBJETOS.map((o) => [o.id, o]));
export const objeto = (id: string): Objeto | undefined => OBJ.get(id);

/** Dano num objeto: o total menos a RD dele; a 0 PV, quebra (LR p. 90). */
export function danoNoObjeto(total: number, o: Objeto): { final: number; quebrou: boolean; conta: string } {
  const final = Math.max(0, total - o.rd);
  return { final, quebrou: final >= o.pv, conta: `${total}${o.rd ? ` − RD ${o.rd} = ${final}` : ''} contra ${o.pv} PV` };
}
