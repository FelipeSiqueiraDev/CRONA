/**
 * Ritual no combate (LR p. 117–121, 311; COMBATE.md, seção 15.1): a forma e o
 * custo, o teste de resistência de cada alvo, o elemento contra o da criatura,
 * a concentração e o Custo do Paranormal. Funções puras: a tela usa para
 * mostrar a conta, e o servidor para escrever o registro.
 */
import type { Elemento, Ritual } from '../regras/tipos';

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
export const passouResistencia = (d20: number, total: number, dt: number) => d20 >= 20 || total >= dt;
/** Resistir ao que alguém lança contra você: o empate favorece o ataque (20/10), então é preciso passar da DT. */
export const resisteAoAtaque = (d20: number, total: number, dt: number) => d20 >= 20 || total > dt;

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
