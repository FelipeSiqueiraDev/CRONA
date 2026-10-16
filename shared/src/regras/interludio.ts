/**
 * Interlúdio (LR p. 92–93): a cena de descanso. Cada personagem faz até duas ações; dormir e
 * relaxar, uma vez cada. A recuperação vem do limite de PE vezes a condição do descanso, e o prato
 * da ação alimentar-se melhora uma das outras. Os bônus de exercitar-se e de ler (+1d6 num teste
 * até o fim da missão) ficam guardados na ficha.
 */

export type LugarDescanso = 'precario' | 'normal' | 'confortavel' | 'luxuoso';
export const LUGARES_DESCANSO: { id: LugarDescanso; nome: string; vezes: number; exemplo: string }[] = [
  { id: 'precario', nome: 'Precária', vezes: 0.5, exemplo: 'dentro do carro, numa barraca' },
  { id: 'normal', nome: 'Normal', vezes: 1, exemplo: 'um quarto simples, com cama e banheiro' },
  { id: 'confortavel', nome: 'Confortável', vezes: 2, exemplo: 'hotel ou pousada três estrelas' },
  { id: 'luxuoso', nome: 'Luxuosa', vezes: 3, exemplo: 'hotel de luxo, spa, refeições de alto padrão' },
];

export type AcaoInterludio = 'dormir' | 'relaxar' | 'alimentar' | 'exercitar' | 'ler' | 'manutencao' | 'revisar';
export const ACOES_INTERLUDIO: { id: AcaoInterludio; nome: string; resumo: string; umaVez?: boolean }[] = [
  { id: 'dormir', nome: 'Dormir', resumo: 'Recupera PV e PE: o limite de PE vezes a condição do descanso.', umaVez: true },
  { id: 'relaxar', nome: 'Relaxar', resumo: 'Recupera SAN como o dormir; +1 SAN por personagem que relaxar junto.', umaVez: true },
  { id: 'alimentar', nome: 'Alimentar-se', resumo: 'Um prato que melhora outra ação deste interlúdio.' },
  { id: 'exercitar', nome: 'Exercitar-se', resumo: '+1d6 guardado num teste de Agilidade, Força ou Vigor (até o Vigor).' },
  { id: 'ler', nome: 'Ler', resumo: '+1d6 guardado num teste de Intelecto ou Presença (até o Intelecto).' },
  { id: 'manutencao', nome: 'Manutenção', resumo: 'Conserta um item quebrado: os PV dele voltam ao máximo.' },
  { id: 'revisar', nome: 'Revisar caso', resumo: 'Revê uma cena de investigação já feita, com um teste de perícia.' },
];

export type Prato = 'favorito' | 'nutritivo' | 'energetico' | 'rapido';
export const PRATOS: { id: Prato; nome: string; resumo: string }[] = [
  { id: 'favorito', nome: 'Prato favorito', resumo: '+2 SAN se relaxar.' },
  { id: 'nutritivo', nome: 'Prato nutritivo', resumo: 'Dormindo, a recuperação de PV sobe uma vez.' },
  { id: 'energetico', nome: 'Prato energético', resumo: 'Dormindo, a recuperação de PE sobe uma vez.' },
  { id: 'rapido', nome: 'Prato rápido', resumo: '+5 no teste de revisar caso.' },
];

/** O que um personagem escolheu no interlúdio. */
export interface EscolhaInterludio {
  acoes: AcaoInterludio[];
  prato?: Prato;
}

/** Um personagem no interlúdio: o limite de PE, os atributos que limitam os bônus, os pontos de agora e os guardados. */
export interface NoInterludio {
  id: number;
  limitePe: number;
  vigor: number;
  intelecto: number;
  atual: { pv: number; pe: number; san: number };
  max: { pv: number; pe: number; san: number };
  bonus: { exercicio: number; leitura: number };
  escolha: EscolhaInterludio;
  /** onde este personagem descansa, se não for o lugar do grupo (o quarto dele no hotel, na pousada) */
  lugar?: LugarDescanso;
}

export interface ResultadoInterludio {
  id: number;
  /** quanto recupera (já cortado no máximo) */
  pv: number;
  pe: number;
  san: number;
  /** quanto a regra dá, antes de cortar no máximo (para mostrar ao mestre) */
  total: { pv: number; pe: number; san: number };
  /** os bônus guardados depois do interlúdio */
  bonus: { exercicio: number; leitura: number };
  /** o que aconteceu, para o registro */
  notas: string[];
  /** escolha que o livro não deixa */
  erros: string[];
}

/** A condição do descanso subindo uma vez (o prato): precária vira normal, as outras somam um. */
const subir = (v: number) => (v < 1 ? 1 : v + 1);

/** Confere a escolha: até duas ações, dormir e relaxar uma vez cada, e o prato só com alimentar-se. */
export function errosDaEscolha(e: EscolhaInterludio): string[] {
  const erros: string[] = [];
  if (e.acoes.length > 2) erros.push('Cada personagem faz até duas ações no interlúdio (LR p. 92).');
  for (const a of ['dormir', 'relaxar'] as const) if (e.acoes.filter((x) => x === a).length > 1) erros.push(`${a === 'dormir' ? 'Dormir' : 'Relaxar'}: só uma vez por interlúdio.`);
  if (e.acoes.includes('alimentar') && !e.prato) erros.push('Alimentar-se: escolha o prato.');
  return erros;
}

/** O interlúdio de todos de uma vez (o relaxar depende de quantos relaxam juntos). */
export function resolverInterludio(lugar: LugarDescanso, grupo: NoInterludio[]): ResultadoInterludio[] {
  const relaxam = grupo.filter((p) => p.escolha.acoes.includes('relaxar')).length;
  return grupo.map((p) => {
    // cada um no lugar dele: o quarto que pegou (o bom, o médio, o ruim) ou, sem quarto, o lugar do grupo
    const vezes = LUGARES_DESCANSO.find((l) => l.id === (p.lugar ?? lugar))?.vezes ?? 1;
    const e = p.escolha;
    const erros = errosDaEscolha(e);
    const notas: string[] = [];
    const comeu = e.acoes.includes('alimentar') ? e.prato : undefined;
    let pv = 0;
    let pe = 0;
    let san = 0;
    if (e.acoes.includes('dormir')) {
      pv = Math.floor(p.limitePe * (comeu === 'nutritivo' ? subir(vezes) : vezes));
      pe = Math.floor(p.limitePe * (comeu === 'energetico' ? subir(vezes) : vezes));
    }
    if (e.acoes.includes('relaxar')) san = Math.floor(p.limitePe * vezes) + relaxam + (comeu === 'favorito' ? 2 : 0);
    const total = { pv, pe, san };
    // nunca passa do máximo (LR p. 93)
    pv = Math.max(0, Math.min(pv, p.max.pv - p.atual.pv));
    pe = Math.max(0, Math.min(pe, p.max.pe - p.atual.pe));
    san = Math.max(0, Math.min(san, p.max.san - p.atual.san));
    const bonus = { ...p.bonus };
    for (const a of e.acoes) {
      if (a === 'exercitar') {
        if (bonus.exercicio < p.vigor) bonus.exercicio++;
        else notas.push(`exercício: já tem ${p.vigor} (o máximo é o Vigor)`);
      }
      if (a === 'ler') {
        if (bonus.leitura < p.intelecto) bonus.leitura++;
        else notas.push(`leitura: já tem ${p.intelecto} (o máximo é o Intelecto)`);
      }
      if (a === 'manutencao') notas.push('consertou um item');
      if (a === 'revisar') notas.push(`revisou o caso${comeu === 'rapido' ? ' (+5 no teste, prato rápido)' : ''}`);
    }
    return { id: p.id, pv, pe, san, total, bonus, notas, erros };
  });
}
