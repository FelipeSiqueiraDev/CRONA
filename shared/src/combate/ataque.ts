/**
 * O ataque passo a passo (LR p. 54–60, 82, 85, 88–90, 312–313; COMBATE.md,
 * seções 6 a 8): distância e alcance, situações, o teste, a Defesa, a chance
 * de falha, o crítico, o dano e o que vem depois. Funções puras: a tela usa
 * para mostrar a conta, e o servidor para escrever o registro.
 */
import { M_POR_CASA } from '../constants';
import { rolagem } from '../regras/rolagem';
import type { TipoDano } from '../regras/tipos';
import type { ResultadoAtaque } from './tipos';

/** 1 casa do tabuleiro = 0,75 m: 2 casas fazem 1 quadrado de 1,5 m (REGRAS.md, decisão 6; COMBATE.md 7.2). */
export const METROS_POR_CASA = M_POR_CASA;

export type Faixa = 'curto' | 'medio' | 'longo' | 'extremo';
export const METROS_FAIXA: Record<Faixa, number> = { curto: 9, medio: 18, longo: 36, extremo: 90 };
export const NOME_FAIXA: Record<Faixa, string> = { curto: 'curto', medio: 'médio', longo: 'longo', extremo: 'extremo' };

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Faixa de alcance da arma ("curto", "médio"...). Sem alcance = corpo a corpo. */
export function faixaArma(alcance?: string | null): Faixa | null {
  if (!alcance) return null;
  const k = semAcento(alcance);
  return k in METROS_FAIXA ? (k as Faixa) : null;
}

/** Faixa em que uma distância cai; além do extremo, `null`. */
export function faixaDaDistancia(metros: number): Faixa | null {
  for (const f of ['curto', 'medio', 'longo', 'extremo'] as Faixa[]) if (metros <= METROS_FAIXA[f] + 1e-6) return f;
  return null;
}

/** Distância em casas, em linha reta entre os centros (DC-10). */
export function distanciaCasas(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const metrosDe = (casas: number) => casas * METROS_POR_CASA;

/** Adjacente: até 2 casas em qualquer direção, diagonal incluída (COMBATE.md 7.2). */
export function adjacente(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 2;
}

/** "7,5 m" */
export function textoMetros(m: number): string {
  const r = Math.round(m * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace('.', ',')} m`;
}

export const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// ------------------------------------------------------------------ situações

export type SituacaoId =
  | 'passagem'
  | 'combateDefensivo'
  | 'arremessoSemAlcance'
  | 'cobertura'
  | 'camuflagem'
  | 'camuflagemTotal'
  | 'alcanceDobro'
  | 'emCorpoACorpo'
  | 'flanqueando'
  | 'elevado'
  | 'investida'
  | 'alvoDesprevenido'
  | 'alvoCaido'
  | 'alvoVulneravel'
  | 'alvoIndefeso'
  | 'atacanteCaido'
  | 'atacanteOfuscado'
  | 'atacanteAgarrado'
  | 'atacanteCego'
  | 'naoLetal';

export interface Situacao {
  id: SituacaoId;
  nome: string;
  /** o que muda, para a chave da tela */
  efeito: string;
  /** vale só no corpo a corpo ou só à distância */
  so?: 'corpo' | 'distancia';
  /** d20 a mais ou a menos no ataque */
  dados?: number;
  /** no total do ataque */
  bonus?: number;
  /** na Defesa do alvo */
  defesa?: number;
  /** chance de falha, em % */
  falha?: number;
  pagina: number;
}

/** As situações da Tab. 4.4 e as outras que pesam no ataque (LR p. 85, 87–90; COMBATE.md 7.1). */
export const SITUACOES: Situacao[] = [
  { id: 'cobertura', nome: 'Cobertura', efeito: '+5 na Defesa', defesa: 5, pagina: 89 },
  { id: 'camuflagem', nome: 'Camuflagem', efeito: 'camuflagem 20%', falha: 20, pagina: 89 },
  { id: 'camuflagemTotal', nome: 'Camuflagem total', efeito: 'camuflagem total 50%', falha: 50, pagina: 89 },
  { id: 'alcanceDobro', nome: 'Além do alcance', efeito: '−5 (até o dobro)', bonus: -5, so: 'distancia', pagina: 85 },
  { id: 'emCorpoACorpo', nome: 'Alvo em corpo a corpo', efeito: '−5', bonus: -5, so: 'distancia', pagina: 89 },
  { id: 'flanqueando', nome: 'Flanqueando', efeito: '+1d20', dados: 1, so: 'corpo', pagina: 89 },
  { id: 'elevado', nome: 'Posição elevada', efeito: '+1d20', dados: 1, pagina: 89 },
  { id: 'investida', nome: 'Investida', efeito: '+1d20; −5 na sua Defesa', dados: 1, so: 'corpo', pagina: 87 },
  { id: 'alvoDesprevenido', nome: 'Alvo desprevenido', efeito: '−5 na Defesa', defesa: -5, pagina: 89 },
  { id: 'alvoCaido', nome: 'Alvo caído', efeito: '−5 na Defesa no corpo a corpo; +5 à distância', pagina: 89 },
  { id: 'alvoVulneravel', nome: 'Alvo vulnerável', efeito: '−5 na Defesa', defesa: -5, pagina: 311 },
  { id: 'alvoIndefeso', nome: 'Alvo indefeso', efeito: '−10 na Defesa', defesa: -10, pagina: 311 },
  { id: 'atacanteCaido', nome: 'Atacante caído', efeito: '−2d20', dados: -2, so: 'corpo', pagina: 310 },
  { id: 'atacanteOfuscado', nome: 'Atacante ofuscado', efeito: '−1d20', dados: -1, pagina: 311 },
  { id: 'atacanteAgarrado', nome: 'Atacante agarrado', efeito: '−1d20', dados: -1, pagina: 310 },
  { id: 'atacanteCego', nome: 'Atacante cego', efeito: '50% de falha', falha: 50, pagina: 310 },
  { id: 'naoLetal', nome: 'Dano não letal', efeito: '−5', bonus: -5, so: 'corpo', pagina: 88 },
  // regra da mesa (20/10, o Felipe: a Catarina passou correndo e bateu no Existido): o livro não deixa ação padrão no meio
  // do movimento (LR p. 86, só o atropelar); a mesa libera, com −1d20
  { id: 'passagem', nome: 'De passagem', efeito: '−1d20 (regra da mesa)', dados: -1, so: 'corpo', pagina: 86 },
  // o poder Combate Defensivo (LR p. 25): −1d20 nos ataques e +5 na Defesa até o próximo turno
  { id: 'combateDefensivo', nome: 'Combate defensivo', efeito: '−1d20; +5 na sua Defesa até o seu próximo turno', dados: -1, pagina: 25 },
  // arma sem alcance arremessada em alcance curto (LR p. 55)
  { id: 'arremessoSemAlcance', nome: 'Arremessada (sem alcance)', efeito: '−5', bonus: -5, so: 'distancia', pagina: 55 },
];

/** O que uma situação muda na Defesa de quem ataca até o próximo turno dele (a investida abre a guarda; o combate defensivo fecha). */
export const DEFESA_ATE_O_TURNO: Partial<Record<SituacaoId, number>> = { investida: -5, combateDefensivo: 5 };

const SIT = new Map(SITUACOES.map((s) => [s.id, s]));
export const situacao = (id: SituacaoId) => SIT.get(id)!;

/** Condições do catálogo que viram situação sozinhas: do alvo e de quem ataca. */
export const SITUACAO_DA_CONDICAO: { alvo: Record<string, SituacaoId>; atacante: Record<string, SituacaoId> } = {
  alvo: {
    desprevenido: 'alvoDesprevenido',
    surpreendido: 'alvoDesprevenido',
    atordoado: 'alvoDesprevenido',
    agarrado: 'alvoDesprevenido',
    cego: 'alvoDesprevenido',
    caido: 'alvoCaido',
    vulneravel: 'alvoVulneravel',
    enredado: 'alvoVulneravel',
    fatigado: 'alvoVulneravel',
    exausto: 'alvoVulneravel',
    indefeso: 'alvoIndefeso',
    inconsciente: 'alvoIndefeso',
    paralisado: 'alvoIndefeso',
  },
  atacante: { caido: 'atacanteCaido', ofuscado: 'atacanteOfuscado', agarrado: 'atacanteAgarrado', cego: 'atacanteCego', enredado: 'atacanteAgarrado' },
};

export interface Teste {
  /** d20 do atributo e os ganhos */
  dados: number;
  /** d20 perdidos (0 ou negativo); a conta de "menos de 1 dado" usa os dois (LR p. 11) */
  penalidade: number;
  bonus: number;
  /** Defesa final do alvo e as partes (base + modificadores) */
  defesa: number;
  partesDefesa: { nome: string; valor: number }[];
  /** chance de falha somada (até 75%, LR p. 313) */
  falha: number;
  /** as situações que pesaram, na ordem da tabela */
  ativas: Situacao[];
}

/**
 * Soma o que as situações mudam no ataque e na Defesa. Efeitos iguais não
 * somam: desprevenido, vulnerável e indefeso valem o pior (LR p. 311, 313).
 */
export function montarTeste(o: { dados: number; penalidade?: number; bonus: number; defesaBase: number; distancia: boolean; situacoes: SituacaoId[]; ajuste?: { dados: number; bonus: number } }): Teste {
  const ativas = SITUACOES.filter((s) => o.situacoes.includes(s.id) && (!s.so || (s.so === 'distancia') === o.distancia));
  let dados = o.dados;
  let penalidade = Math.min(0, o.penalidade ?? 0);
  let bonus = o.bonus;
  let falha = 0;
  const partesDefesa: { nome: string; valor: number }[] = [];
  let pior: Situacao | null = null;
  for (const s of ativas) {
    // dados ganhos e perdidos ficam separados (LR p. 11)
    if ((s.dados ?? 0) > 0) dados += s.dados!;
    else penalidade += s.dados ?? 0;
    bonus += s.bonus ?? 0;
    falha += s.falha ?? 0;
    if (s.id === 'alvoCaido') partesDefesa.push({ nome: s.nome, valor: o.distancia ? 5 : -5 });
    else if (s.id === 'alvoDesprevenido' || s.id === 'alvoVulneravel' || s.id === 'alvoIndefeso') {
      if (!pior || (s.defesa ?? 0) < (pior.defesa ?? 0)) pior = s;
    } else if (s.defesa) partesDefesa.push({ nome: s.nome, valor: s.defesa });
  }
  if (pior) partesDefesa.push({ nome: pior.nome, valor: pior.defesa ?? 0 });
  // o ajuste livre do mestre (dados a mais ou a menos e bônus): a criatividade da mesa que nenhuma situação cobre
  const aj = o.ajuste;
  if (aj?.dados && aj.dados > 0) dados += aj.dados;
  else if (aj?.dados) penalidade += aj.dados;
  if (aj?.bonus) bonus += aj.bonus;
  const defesa = o.defesaBase + partesDefesa.reduce((t, p) => t + p.valor, 0);
  return { dados, penalidade, bonus, defesa, partesDefesa, falha: Math.min(75, falha), ativas };
}

/**
 * "Role 3d20, fique com o maior, +5". Se a penalidade deixaria menos de 1
 * dado, rola como se ela fosse bônus e fica o menor (LR p. 11).
 */
export function textoRolagem(dados: number, bonus: number, penalidade = 0): string {
  const b = bonus ? `, ${sinal(bonus)}` : '';
  const r = rolagem(dados, penalidade);
  if (r.fica === 'menor') return `Role ${r.dados}d20, fique com o menor${b}`;
  if (r.dados === 1) return `Role 1d20${b}`;
  return `Role ${r.dados}d20, fique com o maior${b}`;
}

/** "20 (15 + 5)" */
export function textoDefesa(t: Teste, base: number): string {
  if (!t.partesDefesa.length) return String(t.defesa);
  return `${t.defesa} (${base}${t.partesDefesa.map((p) => ` ${p.valor >= 0 ? '+' : '−'} ${Math.abs(p.valor)}`).join('')})`;
}

/**
 * O dado da chance de falha e até que número falha: no d10, 20% = 1 ou 2 e
 * 50% = 1 a 5 (LR p. 89). Somadas, as chances param em 75% (LR p. 313), que
 * não cabe no d10: 75% = 1 a 3 no d4.
 */
export function dadoDaFalha(chance: number): { faces: number; ate: number } {
  for (const faces of [10, 4, 20, 100]) {
    const ate = (chance * faces) / 100;
    if (Number.isInteger(ate)) return { faces, ate };
  }
  return { faces: 100, ate: Math.round(chance) };
}

export interface Resolucao {
  total: number;
  acertou: boolean;
  critico: boolean;
  /** a chance de falha tirou o acerto */
  falhou: boolean;
  resultado: ResultadoAtaque;
}

/**
 * Acerta com total ≥ Defesa; 20 natural sempre acerta. Crítico: acertou e o d20
 * que ficou está na margem de ameaça (LR p. 82, 85; COMBATE.md 6). A chance de
 * falha vem depois do acerto (7.3).
 */
export function resolver(o: { d20: number; bonus: number; defesa: number; margem: number; falha: number; d10?: number | null }): Resolucao {
  const total = o.d20 + o.bonus;
  const acertou = o.d20 >= 20 || total >= o.defesa;
  // `d10` = o dado da falha (d10, ou d4 nos 75%)
  const falhou = acertou && o.falha > 0 && o.d10 != null && o.d10 >= 1 && o.d10 <= dadoDaFalha(o.falha).ate;
  const critico = acertou && !falhou && o.d20 >= o.margem;
  return { total, acertou, critico, falhou, resultado: !acertou || falhou ? 'erro' : critico ? 'critico' : 'acerto' };
}

// ------------------------------------------------------------------ dano

export interface PartesDano {
  grupos: { n: number; faces: number }[];
  fixo: number;
}

/** "3d8+5", "1d3+2", "2d6", "1d8+1d6+2", "1d4−1" */
export function lerDano(formula: string): PartesDano {
  const grupos: { n: number; faces: number }[] = [];
  let fixo = 0;
  const limpo = formula.replace(/\s+/g, '').replace(/[−–]/g, '-');
  for (const m of limpo.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi)) {
    if (m[3]) grupos.push({ n: (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1), faces: Number(m[3]) });
    else if (m[5]) fixo += (m[4] === '-' ? -1 : 1) * Number(m[5]);
  }
  return { grupos, fixo };
}

/** O aviso de uma soma de dados impossível (o mestre digitou errado): fora do que os dados dão. Nulo se está certa ou ainda vazia. */
export function avisoSomaDeDados(p: PartesDano, soma: number | null): string | null {
  if (soma === null || !p.grupos.length || p.grupos.some((g) => g.n <= 0)) return null;
  const min = p.grupos.reduce((t, g) => t + g.n, 0);
  const max = p.grupos.reduce((t, g) => t + g.n * g.faces, 0);
  if (soma >= min && soma <= max) return null;
  return `${soma} não cabe nos dados (${p.grupos.map((g) => `${g.n}d${g.faces}`).join(' + ')} só dá de ${min} a ${max}). Confira o que saiu na mesa.`;
}

export function textoFormula(p: PartesDano): string {
  const g = p.grupos.map((x, i) => `${i && x.n > 0 ? '+' : ''}${x.n}d${x.faces}`).join('');
  return `${g}${p.fixo ? sinal(p.fixo) : ''}` || '0';
}

/** No crítico, só os dados da arma (o primeiro grupo) multiplicam; o fixo e os extras, não (LR p. 82; DC-13). */
export function danoCritico(formula: string, multiplicador: number): PartesDano {
  const p = lerDano(formula);
  if (!p.grupos.length || multiplicador <= 1) return p;
  const [primeiro, ...resto] = p.grupos;
  return { grupos: [{ n: primeiro.n * multiplicador, faces: primeiro.faces }, ...resto], fixo: p.fixo };
}

/** "Role 9d8 (crítico ×3) e some +5" */
export function textoDano(formula: string, multiplicador = 1): string {
  const p = danoCritico(formula, multiplicador);
  const dados = p.grupos.map((x, i) => `${i ? ' + ' : ''}${x.n}d${x.faces}`).join('');
  const crit = multiplicador > 1 ? ` (crítico ×${multiplicador})` : '';
  return `Role ${dados || 'o dano'}${crit}${p.fixo ? ` e some ${sinal(p.fixo)}` : ''}`;
}

export const NOME_TIPO_DANO: Record<TipoDano, string> = {
  balistico: 'balístico',
  corte: 'corte',
  eletricidade: 'eletricidade',
  fogo: 'fogo',
  frio: 'frio',
  impacto: 'impacto',
  mental: 'mental',
  perfuracao: 'perfuração',
  quimico: 'químico',
  sangue: 'Sangue',
  morte: 'Morte',
  conhecimento: 'Conhecimento',
  energia: 'Energia',
  medo: 'Medo',
  paranormal: 'paranormal',
  fisico: 'físico',
  todos: 'todos',
};

const FISICOS: TipoDano[] = ['balistico', 'corte', 'impacto', 'perfuracao'];
/** O dano paranormal tem sempre o subtipo de um elemento (LR p. 82). */
const PARANORMAIS: TipoDano[] = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
/** O grupo do tipo ("físico" ou "paranormal"), que a RD, a imunidade e a vulnerabilidade também cobrem. */
const grupoDe = (t: TipoDano): TipoDano | null => (FISICOS.includes(t) ? 'fisico' : PARANORMAIS.includes(t) ? 'paranormal' : null);

export interface ContaDano {
  /** soma dos dados + fixo */
  total: number;
  final: number;
  /** "46 − RD balística 10 = 36" */
  conta: string;
}

/**
 * Aplica imunidade, metade, vulnerabilidade e RD, nessa ordem (LR p. 312–313;
 * COMBATE.md 8.3). A RD do tipo soma com a do grupo ("físico" nos quatro tipos
 * das armas, "paranormal" nos cinco elementos) e com a geral.
 */
export function contaDano(o: {
  soma: number;
  fixo: number;
  tipo: TipoDano;
  rd?: Partial<Record<TipoDano, number>>;
  imunidades?: TipoDano[];
  vulnerabilidades?: TipoDano[];
  metade?: boolean;
}): ContaDano {
  const total = Math.max(0, o.soma + o.fixo);
  const nome = NOME_TIPO_DANO[o.tipo] ?? o.tipo;
  const grupo = grupoDe(o.tipo);
  const cobre = (lista: TipoDano[] | undefined) => !!lista && (lista.includes(o.tipo) || (!!grupo && lista.includes(grupo)));
  // "imune a dano" = a todo dano
  if (o.imunidades?.includes('todos')) return { total, final: 0, conta: 'imune a todo dano: 0' };
  if (cobre(o.imunidades)) return { total, final: 0, conta: `imune a ${nome}: 0` };
  let v = total;
  let conta = String(total);
  if (o.metade) {
    v = Math.floor(v / 2);
    conta += ` ÷ 2 = ${v}`;
  }
  if (cobre(o.vulnerabilidades)) {
    v *= 2;
    conta += ` × 2 (vulnerável) = ${v}`;
  }
  const rd = (o.rd?.[o.tipo] ?? 0) + (grupo ? (o.rd?.[grupo] ?? 0) : 0) + (o.rd?.todos ?? 0);
  if (rd > 0) {
    v = Math.max(0, v - rd);
    conta = `${conta} − RD ${nome} ${rd} = ${v}`;
  }
  return { total, final: v, conta };
}

export interface Consequencia {
  pv: number;
  machucado: boolean;
  /** chegou a 0 PV */
  zerou: boolean;
  /** com o dano não letal que já tinha, desmaiou sem chegar a 0 PV (inconsciente, sem morrendo) */
  desmaiou: boolean;
  /** dano massivo: Fortitude com esta DT (LR p. 88) */
  massivo: number | null;
}

const dtMassivo = (dano: number) => 15 + 2 * Math.floor(dano / 10);
/** A metade de um total (PV, SAN, PE): arredonda sempre para baixo (20/10, o Felipe: "10,5 vira 10"). */
export const metadeDe = (n: number) => Math.floor(n / 2);

/**
 * Dano letal: PV depois, machucado, 0 PV e dano massivo (≥ metade dos PV
 * totais sem zerar; DT 15 +2 a cada 10). O não letal que o ser já tem soma
 * para desmaiar, mas não para morrendo (LR p. 88).
 */
export function consequencia(v: { pv: number; pvMax: number }, dano: number, naoLetal = 0): Consequencia {
  const pv = Math.max(0, v.pv - Math.max(0, dano));
  const zerou = pv === 0 && dano > 0;
  const desmaiou = !zerou && dano > 0 && naoLetal > 0 && pv - naoLetal <= 0 && v.pv - naoLetal > 0;
  // desmaiar pelo não letal não tira o dano massivo: falhando, vai a 0 PV e fica morrendo (LR p. 88)
  const massivo = !zerou && dano > 0 && dano >= metadeDe(v.pvMax) ? dtMassivo(dano) : null;
  return { pv, machucado: pv > 0 && pv < metadeDe(v.pvMax), zerou, desmaiou, massivo };
}

export interface ConsequenciaNaoLetal {
  /** dano não letal acumulado depois */
  naoLetal: number;
  /** PV − não letal chegou a 0 agora: inconsciente, sem morrendo */
  desmaiou: boolean;
  /** dano massivo: Fortitude com esta DT; se falhar, desmaia (o não letal não deixa morrendo) */
  massivo: number | null;
}

/** Dano não letal: soma ao que o ser já tem; desmaia quando passa dos PV atuais (LR p. 88). */
export function consequenciaNaoLetal(v: { pv: number; pvMax: number }, antes: number, dano: number): ConsequenciaNaoLetal {
  const naoLetal = Math.max(0, antes) + Math.max(0, dano);
  const desmaiou = dano > 0 && v.pv - naoLetal <= 0 && v.pv - antes > 0;
  const massivo = !desmaiou && v.pv - naoLetal > 0 && dano > 0 && dano >= metadeDe(v.pvMax) ? dtMassivo(dano) : null;
  return { naoLetal, desmaiou, massivo };
}

export interface ConsequenciaMental {
  san: number;
  perturbado: boolean;
  /** chegou a SAN 0: enlouquecendo */
  zerou: boolean;
}

/** Dano mental: tira da Sanidade, não dos PV (LR p. 82, 88). */
export function consequenciaMental(v: { san: number; sanMax: number }, dano: number): ConsequenciaMental {
  const san = Math.max(0, v.san - Math.max(0, dano));
  return { san, perturbado: san > 0 && san < metadeDe(v.sanMax), zerou: san === 0 && dano > 0 };
}

/**
 * O que um dano faz em quem sofre, para a tela mostrar antes de confirmar
 * (as mesmas contas que o servidor faz): "PV 20 → 12 (machucado)", "SAN 10 → 4
 * (perturbado)", "não letal 0 → 8 (PV 20)". Sem PV marcados, `null`.
 */
export function previaDano(
  v: { pv: number; pvMax: number; san: number; sanMax: number } | undefined,
  final: number,
  o: { tipo: string; naoLetal?: boolean; naoLetalAntes?: number; agente?: boolean },
): { texto: string; massivo: number | null } | null {
  if (!v) return null;
  if (o.tipo === 'mental') {
    const q = consequenciaMental(v, final);
    return { texto: `SAN ${v.san} → ${q.san}${q.zerou ? ' (enlouquecendo)' : q.perturbado ? ' (perturbado)' : ''}`, massivo: null };
  }
  const antes = o.naoLetalAntes ?? 0;
  if (o.naoLetal) {
    const q = consequenciaNaoLetal(v, antes, final);
    return { texto: `não letal ${antes} → ${q.naoLetal} (PV ${v.pv})${q.desmaiou ? ': desmaia, sem morrendo' : ''}`, massivo: q.massivo };
  }
  const q = consequencia(v, final, antes);
  const estado = q.zerou ? (o.agente ? ' (inconsciente e morrendo)' : ' (0 PV)') : q.desmaiou ? ' (desmaia, sem morrendo)' : q.machucado ? ' (machucado)' : '';
  return { texto: `PV ${v.pv} → ${q.pv}${estado}`, massivo: q.massivo };
}
