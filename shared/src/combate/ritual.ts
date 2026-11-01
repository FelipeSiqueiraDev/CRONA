/**
 * Ritual no combate (LR p. 117–121, 311; COMBATE.md, seção 15.1): a forma e o
 * custo, o teste de resistência de cada alvo, o elemento contra o da criatura,
 * a concentração e o Custo do Paranormal. Funções puras: a tela usa para
 * mostrar a conta, e o servidor para escrever o registro.
 */
import type { Elemento, Ritual, TipoDano } from '../regras/tipos';

export type FormaRitual = 'basica' | 'discente' | 'verdadeira';
export const NOME_FORMA: Record<FormaRitual, string> = { basica: 'básica', discente: 'discente', verdadeira: 'verdadeira' };

/**
 * PE da forma: o custo do círculo, mais o da forma avançada, mais o que os
 * poderes mudam (`ajuste`; negativo = reduz). O mínimo de 1 PE vale para o
 * custo final, já com a forma (LR p. 78, 121).
 */
export function custoDaForma(base: number, r: Pick<Ritual, 'discente' | 'verdadeiro'>, forma: FormaRitual, ajuste = 0): number {
  const extra = forma === 'discente' ? (r.discente?.custoExtra ?? 0) : forma === 'verdadeira' ? (r.verdadeiro?.custoExtra ?? 0) : 0;
  return Math.max(1, base + extra + ajuste);
}

/**
 * A forma pode ser usada? A discente e a verdadeira pedem o círculo e, às
 * vezes, a afinidade com o elemento do ritual (LR p. 121). Devolve o motivo
 * quando não pode.
 */
export function formaLiberada(r: Pick<Ritual, 'discente' | 'verdadeiro' | 'elemento'>, forma: FormaRitual, circuloMax: number, afinidade: Elemento | null): string | null {
  if (forma === 'basica') return null;
  const f = forma === 'discente' ? r.discente : r.verdadeiro;
  if (!f) return `O ritual não tem a forma ${NOME_FORMA[forma]}.`;
  if (f.circulo && circuloMax < f.circulo) return `Pede conjurar rituais de ${f.circulo}º círculo.`;
  if (f.afinidade && afinidade !== r.elemento) return 'Pede afinidade com o elemento do ritual.';
  return null;
}

// ------------------------------------------------------------------ resistência

export type TesteResistencia = 'fortitude' | 'reflexos' | 'vontade';
/** O que passar no teste faz (LR p. 121); "texto" = a descrição do ritual diz. */
export type EfeitoResistencia = 'anula' | 'parcial' | 'metade' | 'desacredita' | 'texto';

export const NOME_TESTE: Record<TesteResistencia, string> = { fortitude: 'Fortitude', reflexos: 'Reflexos', vontade: 'Vontade' };
export const NOME_EFEITO: Record<EfeitoResistencia, string> = { anula: 'anula', parcial: 'parcial', metade: 'reduz à metade', desacredita: 'desacredita', texto: 'veja o ritual' };

/** O teste do cabeçalho do ritual ("Vontade parcial", "Fortitude reduz à metade"); o primeiro, se houver dois. */
export function lerResistencia(texto?: string): { teste: TesteResistencia; efeito: EfeitoResistencia } | null {
  if (!texto) return null;
  const t = texto.toLowerCase();
  const m = /(fortitude|reflexos|vontade)/.exec(t);
  if (!m) return null;
  const resto = t.slice(m.index);
  const efeito: EfeitoResistencia = /metade/.test(resto) ? 'metade' : /anula/.test(resto) ? 'anula' : /desacredita/.test(resto) ? 'desacredita' : /parcial/.test(resto) ? 'parcial' : 'texto';
  return { teste: m[1] as TesteResistencia, efeito };
}

/** Passa com total ≥ DT; 20 natural passa sempre (LR p. 76). */
/** Teste contra DT: igual ou maior passa (LR p. 41; a resistência a ritual é um teste comum, p. 79 e 123). */
export const passouResistencia = (d20: number, total: number, dt: number) => d20 >= 20 || total >= dt;

// ------------------------------------------------------------------ elemento contra a criatura

/** Sangue vence Conhecimento, que vence Energia, que vence Morte, que vence Sangue; Medo é neutro (LR p. 118). */
export const VENCE: Partial<Record<Elemento, Elemento>> = { sangue: 'conhecimento', conhecimento: 'energia', energia: 'morte', morte: 'sangue' };

/**
 * O elemento do ritual contra o da criatura: vence = −2d20 no teste dela e
 * vulnerável ao dano do ritual; o mesmo elemento = +2d20 (LR p. 118).
 */
export function elementoContra(ritual: Elemento, criatura?: Elemento | null): { dados: number; vulneravel: boolean; texto: string } | null {
  if (!criatura || ritual === 'medo' || criatura === 'medo') return null;
  if (VENCE[ritual] === criatura) return { dados: -2, vulneravel: true, texto: 'o elemento do ritual vence o dela: −2d20 e vulnerável' };
  if (ritual === criatura) return { dados: 2, vulneravel: false, texto: 'mesmo elemento: +2d20' };
  return null;
}

// ------------------------------------------------------------------ concentração e Custo do Paranormal

/** Condições ruins e terríveis para conjurar (LR p. 120, 311): o teste de Vontade de concentração. */
const RUINS = ['caido', 'surdo'];
const TERRIVEIS = ['agarrado'];

/** DT da concentração pela condição de quem conjura: ruim 15 + custo, terrível 20 + custo; nenhuma = null. */
export function dtConcentracao(condicoes: string[], custo: number): { dt: number; motivo: string } | null {
  const terrivel = condicoes.find((c) => TERRIVEIS.includes(c));
  if (terrivel) return { dt: 20 + custo, motivo: `condição terrível (${terrivel})` };
  const ruim = condicoes.find((c) => RUINS.includes(c));
  if (ruim) return { dt: 15 + custo, motivo: `condição ruim (${ruim})` };
  return null;
}

export type CustoParanormal = { medo: false; dt: number } | { medo: true; mental: number; sanPermanente: number };

/**
 * Custo do Paranormal (LR p. 121): fora de Medo, Ocultismo DT 15 + custo;
 * falhou, dano mental igual ao custo; por 5 ou mais, perde também 1 SAN para
 * sempre. Rituais de Medo: dano mental igual ao custo e SAN para sempre (1 na
 * básica, 2 na discente, 3 na verdadeira).
 */
export function custoParanormal(custo: number, medo: boolean, forma: FormaRitual): CustoParanormal {
  if (medo) return { medo: true, mental: custo, sanPermanente: forma === 'verdadeira' ? 3 : forma === 'discente' ? 2 : 1 };
  return { medo: false, dt: 15 + custo };
}

/** O resultado do teste de Ocultismo do Custo do Paranormal. */
export function resultadoCusto(custo: number, d20: number, total: number): { passou: boolean; mental: number; sanPermanente: number } {
  const dt = 15 + custo;
  if (passouResistencia(d20, total, dt)) return { passou: true, mental: 0, sanPermanente: 0 };
  return { passou: false, mental: custo, sanPermanente: dt - total >= 5 ? 1 : 0 };
}

/** O dano que o ritual causa ao ser conjurado, numa forma: os dados, o tipo (sem tipo = o do elemento) e o dano a mais de outro tipo. */
export interface DanoDoRitual {
  dano: string;
  tipo?: TipoDano;
  extra?: { dano: string; tipo: TipoDano };
  /** resistência "parcial" em que quem passa sofre a metade (o livro diz no texto do ritual) */
  parcialMetade?: true;
  /**
   * Quem passa no teste sofre outra coisa (01/11, auditoria de 28/10: a tela dava o mesmo dano a todos): outros dados,
   * outro tipo e uma condição (Conhecendo o Medo, Lâmina do Medo, Inexistir).
   */
  passou?: { dano: string; tipo?: TipoDano; condicao?: string };
  /** quem falha: os PV ou a SAN vão a 0 (Lâmina do Medo, Conhecendo o Medo), a condição e o que fica escrito no registro */
  falhou?: { zera?: 'pv' | 'san'; condicao?: string; nota?: string };
  /** a resistência quando o texto do ritual diz "veja texto" (Poeira da Podridão: Fortitude reduz à metade) */
  resistencia?: string;
}

/**
 * Os dados do dano dos rituais que ferem quando são conjurados, forma a forma (LR p. 124–141; 29/10, a conferência: o
 * ritual de dano chegava ao passo do efeito sem nada e dava para confirmar sem dano). Ficam de fora os que só ferem
 * depois (no turno do alvo, ao sair da área, quando o algoz chega) e a forma que troca o dano por outro efeito; o
 * mestre ainda digita à mão. Descarnar é metade corte, metade Sangue: os dados divididos em dois. `parcialMetade`: no
 * "parcial", quem passa sofre a metade (Eletrocussão, Invadir Mente, Miasma, Ferver Sangue); nos outros, o mestre marca.
 */
export const DANO_DOS_RITUAIS: Record<string, Partial<Record<FormaRitual, DanoDoRitual>>> = {
  decadencia: { basica: { dano: '2d8+2' }, discente: { dano: '3d8+3' }, verdadeira: { dano: '8d8+8' } },
  // a Eletrocussão básica deixa vulnerável por uma rodada quem falha; quem passa sofre metade e evita (LR p. 131)
  eletrocussao: { basica: { dano: '3d6', tipo: 'eletricidade', parcialMetade: true, falhou: { condicao: 'vulneravel', nota: 'vulnerável por uma rodada' } }, discente: { dano: '6d6', parcialMetade: true }, verdadeira: { dano: '8d6', parcialMetade: true } },
  // o Descarnar: quem passa sofre metade e não fica com a hemorragia (LR p. 129)
  descarnar: {
    basica: { dano: '3d8', tipo: 'corte', extra: { dano: '3d8', tipo: 'sangue' }, parcialMetade: true, falhou: { nota: 'hemorragia: Fortitude no começo de cada turno; falhou, 2d8 de Sangue; dois turnos seguidos passando, estanca' } },
    discente: { dano: '5d8', tipo: 'corte', extra: { dano: '5d8', tipo: 'sangue' }, parcialMetade: true, falhou: { nota: 'hemorragia: Fortitude no começo de cada turno; falhou, 4d8 de Sangue; dois turnos seguidos passando, estanca' } },
  },
  hemofagia: { basica: { dano: '6d6' }, discente: { dano: '6d6' }, verdadeira: { dano: '4d6' } },
  // o Inexistir: quem passa sofre só os dados resistidos e fica debilitado por uma rodada (LR p. 133)
  inexistir: {
    basica: { dano: '10d12+10', passou: { dano: '2d12', condicao: 'debilitado' } },
    discente: { dano: '15d12+15', passou: { dano: '3d12', condicao: 'debilitado' } },
    verdadeira: { dano: '20d12+20', passou: { dano: '4d12', condicao: 'debilitado' } },
  },
  'invadir-mente': { basica: { dano: '6d6', tipo: 'energia', parcialMetade: true }, discente: { dano: '10d6', tipo: 'energia', parcialMetade: true }, verdadeira: { dano: '10d6', tipo: 'energia', parcialMetade: true } },
  'miasma-entropico': { basica: { dano: '4d8', tipo: 'quimico', parcialMetade: true }, discente: { dano: '6d8', parcialMetade: true }, verdadeira: { dano: '4d8', tipo: 'quimico', parcialMetade: true } },
  paradoxo: { basica: { dano: '6d6' }, discente: { dano: '4d6' }, verdadeira: { dano: '13d6' } },
  perturbacao: { discente: { dano: '3d8' } },
  // a Poeira da Podridão: Fortitude reduz à metade; quem falha não recupera PV por uma rodada (LR p. 138)
  'poeira-da-podridao': {
    basica: { dano: '4d8', resistencia: 'Fortitude reduz à metade', falhou: { nota: 'não recupera PV de nenhuma forma por uma rodada' } },
    verdadeira: { dano: '4d8+16', resistencia: 'Fortitude reduz à metade', falhou: { nota: 'não recupera PV de nenhuma forma por uma rodada' } },
  },
  'ferver-sangue': { basica: { dano: '4d8', parcialMetade: true }, verdadeira: { dano: '4d8', parcialMetade: true } },
  'chamas-do-caos': { discente: { dano: '4d6' }, verdadeira: { dano: '8d6' } },
  'consumir-manancial': { verdadeira: { dano: '3d6' } },
  // quem falha vai a 0 (SAN no Conhecendo o Medo, PV na Lâmina); quem passa sofre o dano e fica apavorado (LR p. 127, 135)
  'conhecendo-o-medo': { basica: { dano: '', falhou: { zera: 'san' }, passou: { dano: '10d6', tipo: 'mental', condicao: 'apavorado' } } },
  'lamina-do-medo': { basica: { dano: '', falhou: { zera: 'pv' }, passou: { dano: '10d8', tipo: 'medo', condicao: 'apavorado' } } },
  'presenca-do-medo': { basica: { dano: '5d8', tipo: 'mental', extra: { dano: '5d8', tipo: 'medo' } } },
};

/**
 * O Convocar o Algoz tem dois testes, cada um quando o algoz chega (LR p. 128): em alcance curto da vítima, Vontade
 * (falhou, abalada); adjacente, Fortitude (falhou, colapso e 0 PV; passou, 6d6 de Morte, que não a deixa abaixo de 1 PV).
 */
export const TESTES_DO_ALGOZ = {
  vontade: { resistencia: 'Vontade parcial', rotulo: 'Em alcance curto: Vontade', livro: { dano: '', falhou: { condicao: 'abalado' } } as DanoDoRitual },
  fortitude: { resistencia: 'Fortitude parcial', rotulo: 'Adjacente: Fortitude', livro: { dano: '', falhou: { zera: 'pv' }, passou: { dano: '6d6', tipo: 'morte' } } as DanoDoRitual },
};

/** O dano do ritual nesta forma, pelo livro (ou nada: o mestre digita). */
export const danoDoRitual = (id: string, forma: FormaRitual): DanoDoRitual | null => DANO_DOS_RITUAIS[id]?.[forma] ?? null;

/**
 * As névoas e áreas que mudam os rituais conjurados dentro delas (01/11; LR p. 126, 130, 140): a Cinerária (DT +5; a
 * discente, −2 PE; a verdadeira, dano máximo), a Rejeitar Névoa (+2 PE por círculo e a execução um passo acima; a
 * discente e a verdadeira, DT −5; a verdadeira, dano mínimo) e a Dissonância Acústica (ninguém conjura).
 */
export type AmbienteRitual = '' | 'cineraria' | 'cineraria-discente' | 'cineraria-verdadeira' | 'rejeitar' | 'rejeitar-discente' | 'rejeitar-verdadeira' | 'dissonancia';
export const NOME_AMBIENTE: Record<AmbienteRitual, string> = {
  '': 'Nenhuma',
  cineraria: 'Cinerária',
  'cineraria-discente': 'Cinerária (discente)',
  'cineraria-verdadeira': 'Cinerária (verdadeira)',
  rejeitar: 'Rejeitar Névoa',
  'rejeitar-discente': 'Rejeitar Névoa (discente)',
  'rejeitar-verdadeira': 'Rejeitar Névoa (verdadeira)',
  dissonancia: 'Dissonância Acústica',
};
const PASSO_EXECUCAO: Record<string, string> = { livre: 'movimento', reacao: 'movimento', movimento: 'padrao', padrao: 'completa', completa: 'completa' };

export function noAmbiente(a: AmbienteRitual, r: { pe: number; dt: number; qual: string; circulo: number }): { pe: number; dt: number; qual: string; dano: 'maximo' | 'minimo' | null; bloqueio: string | null; linhas: string[] } {
  const o = { pe: r.pe, dt: r.dt, qual: r.qual, dano: null as 'maximo' | 'minimo' | null, bloqueio: null as string | null, linhas: [] as string[] };
  if (a === 'dissonancia') o.bloqueio = 'Na Dissonância Acústica ninguém conjura rituais (LR p. 130).';
  if (a.startsWith('cineraria')) {
    o.dt += 5;
    o.linhas.push('Cinerária: DT +5');
    if (a !== 'cineraria') (o.pe = Math.max(1, o.pe - 2)), o.linhas.push('−2 PE');
    if (a === 'cineraria-verdadeira') (o.dano = 'maximo'), o.linhas.push('dano máximo');
  }
  if (a.startsWith('rejeitar')) {
    o.pe += 2 * r.circulo;
    o.qual = PASSO_EXECUCAO[r.qual] ?? r.qual;
    o.linhas.push(`Rejeitar Névoa: +${2 * r.circulo} PE, execução um passo acima`);
    if (a !== 'rejeitar') (o.dt -= 5), o.linhas.push('DT −5');
    if (a === 'rejeitar-verdadeira') (o.dano = 'minimo'), o.linhas.push('dano mínimo');
  }
  return o;
}

/** A soma que os dados dão no máximo ou no mínimo (a Cinerária e a Rejeitar Névoa verdadeiras). */
export function somaExtrema(p: { grupos: { n: number; faces: number }[] }, qual: 'maximo' | 'minimo'): number {
  return p.grupos.reduce((t, g) => t + (qual === 'maximo' ? g.n * g.faces : g.n), 0);
}
