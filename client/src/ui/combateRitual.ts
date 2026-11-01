/**
 * Resolução do ritual na aba COMBATE (regras em docs/COMBATE.md, seção 15.1;
 * LR p. 117–121): 1. Ritual e forma, 2. Alvos e resistência, 3. Efeito e 4.
 * Custo do Paranormal. Os dados são físicos: o mestre digita o d20 que ficou de
 * cada teste e a soma do dano. As contas saem de @crona/shared
 * (combate/ritual.ts); o servidor gasta o PE, aplica o dano e as condições e
 * escreve o registro quando o mestre confirma.
 */
import { combate as cb, regras } from '@crona/shared';
import { campoDado, linhaInfo, type AlvoAtaque } from './combateAtaque';
import { botaoInfo } from './combateCards';
import { h } from './dom';
import { textoTeste } from './fichaRegras';
import { ic } from './icons';
import { sfx } from './sfx';

type Elemento = regras.Elemento;
type TipoDano = regras.TipoDano;

/** Um ritual que quem age pode conjurar (da ficha), já com o custo de cada forma. */
export interface RitualOpcao {
  id: string;
  nome: string;
  elemento: Elemento;
  circulo: number;
  qual: cb.TipoAcao;
  alcance: string;
  alvo?: string;
  duracao: string;
  resistencia?: string;
  dt: number;
  formas: { forma: cb.FormaRitual; pe: number; motivo: string | null }[];
  ref: string;
  /** os elementos à escolha (o Amaldiçoar Arma); `elemento` é o escolhido na ficha */
  elementos?: Elemento[];
  /** por que não dá para conjurar (sem mão livre, sem componentes; LR p. 119) */
  bloqueio?: string;
}

export interface CtxRitual {
  combate: cb.Combate;
  ator: cb.Participante;
  /** o conjurador é agente (paga PE e o Custo do Paranormal) */
  agente: boolean;
  condicoesAtor: string[];
  rituais: RitualOpcao[];
  ocultismo: { dados: number; bonus: number; penalidade?: number } | null;
  vontade: { dados: number; bonus: number; penalidade?: number } | null;
  limite: number | null;
  gasto: number;
  /** os catalisadores da mochila de quem conjura (SaH p. 44) */
  catalisadores?: { uid: number; id: string; nome: string; elemento?: Elemento }[];
  /** guarda na ficha o elemento escolhido do ritual de vários elementos */
  escolherElemento?: (id: string, el: Elemento) => void;
  alvo: AlvoAtaque | null;
  /** quem está na área desenhada no tabuleiro (ferramenta Área) */
  naArea: AlvoAtaque[] | null;
  testeDe: (p: cb.Participante, t: cb.TesteResistencia) => { dados: number; bonus: number; penalidade?: number } | null;
  elementoDe: (p: cb.Participante) => Elemento | null;
  /** metros até o alvo (null = em outra cena) */
  metrosAte: (p: cb.Participante) => number | null;
  acoes: cb.AcoesTurno;
  pedirArea: () => void;
  /** tela de cards (21/10): sem tabuleiro; a área é quem o mestre marca na lista de alvos */
  semMapa?: boolean;
  /** abre a abinha "O que é isso?" de um ritual */
  info?: (r: RitualOpcao) => void;
  enviar: (a: cb.AcaoCombate) => void;
  mudou: () => void;
}

export const PASSOS_RITUAL = ['Ação', 'Ritual e forma', 'Alvo ou área', 'Resistências', 'Efeito', 'Custo do Paranormal', 'Confirmar'];

// o tipo do dano pelo elemento; dano de Medo é paranormal e tira PV, o mental tira SAN (LR p. 82)
const ELEMENTO_DANO: Partial<Record<Elemento, TipoDano>> = { sangue: 'sangue', morte: 'morte', conhecimento: 'conhecimento', energia: 'energia', medo: 'medo' };

/**
 * O dano dos rituais de Medo que ferem, pelo livro: Conhecendo o Medo é mental
 * (LR p. 127); a Lâmina do Medo é de Medo e ignora as resistências (p. 135);
 * a Presença do Medo dá mental e mais o mesmo tanto de Medo (p. 139).
 */
const DANO_RITUAL: Record<string, { tipo: TipoDano; extra?: TipoDano; ignoraRd?: boolean }> = {
  'conhecendo-o-medo': { tipo: 'mental' },
  'lamina-do-medo': { tipo: 'medo', ignoraRd: true },
  'presenca-do-medo': { tipo: 'mental', extra: 'medo' },
};

interface Estado {
  chave: string;
  /** índice em `rituais`; -1 = ritual à mão */
  ritual: number;
  forma: cb.FormaRitual;
  modo: 'alvo' | 'area' | 'nenhum';
  avulso: { nome: string; pe: number; dt: number | null; resistencia: string; elemento: Elemento; qual: cb.TipoAcao };
  d20: Record<string, number | null>;
  conc: number | null;
  /** os dados do dano; null = os do livro para o ritual e a forma (DANO_DOS_RITUAIS) */
  formula: string | null;
  tipo: TipoDano | null;
  soma: number | null;
  /** o dano a mais de outro tipo (Presença do Medo: mental e de Medo) */
  formula2: string | null;
  tipo2: TipoDano | null;
  soma2: number | null;
  /** o dano ignora a RD (Lâmina do Medo); null = o que o ritual diz */
  ignoraRd: boolean | null;
  /** "parcial": o mestre marca quem sofre só a metade */
  metade: Record<string, boolean>;
  condicao: string;
  custo: number | null;
  sustentado: boolean | null;
  /** a soma dos dados de quem passou, quando o ritual dá outro dano a ele (Inexistir, Lâmina do Medo) */
  somaP: number | null;
  /** o dano que quem conjura sofreu durante a execução: a Vontade da concentração com DT igual a ele (LR p. 120) */
  danoExec: number | null;
  /** a névoa ou área em que conjura (Cinerária, Rejeitar Névoa, Dissonância) */
  ambiente: cb.AmbienteRitual;
  /** o catalisador usado (o uid da mochila) */
  catal: number | null;
}

const novo = (chave: string): Estado => ({
  chave,
  ritual: 0,
  forma: 'basica',
  modo: 'alvo',
  avulso: { nome: '', pe: 0, dt: null, resistencia: '', elemento: 'sangue', qual: 'padrao' },
  d20: {},
  conc: null,
  formula: null,
  tipo: null,
  soma: null,
  formula2: null,
  tipo2: null,
  soma2: null,
  ignoraRd: null,
  metade: {},
  condicao: '',
  custo: null,
  sustentado: null,
  somaP: null,
  danoExec: null,
  ambiente: '',
  catal: null,
});

const RESISTENCIAS = ['', 'Fortitude anula', 'Fortitude parcial', 'Fortitude reduz à metade', 'Reflexos anula', 'Reflexos parcial', 'Reflexos reduz à metade', 'Vontade anula', 'Vontade parcial', 'Vontade reduz à metade', 'Vontade desacredita'];

export class ResolucaoRitual {
  private e: Estado = novo('');

  private sincronizar(x: CtxRitual) {
    const chave = `${x.combate.rodada}|${x.combate.vez}|${x.ator.id}`;
    if (chave === this.e.chave) return;
    this.e = { ...novo(chave), ritual: x.rituais.length ? 0 : -1 };
  }

  /** O ritual escolhido, com os números da forma. */
  private escolhido(x: CtxRitual) {
    const r = this.e.ritual >= 0 ? x.rituais[this.e.ritual] : undefined;
    if (r) {
      const f = r.formas.find((q) => q.forma === this.e.forma && !q.motivo) ?? r.formas[0];
      const livro = cb.danoDoRitual(r.id, f.forma);
      const res = livro?.resistencia ?? r.resistencia;
      // Alquebrado: +1 PE (LR p. 309); as névoas mudam PE, DT e execução; o catalisador perturbador dá DT +2 (SaH p. 44)
      const amb = cb.noAmbiente(this.e.ambiente, { pe: f.pe + (x.condicoesAtor.includes('alquebrado') ? 1 : 0), dt: r.dt, qual: r.qual, circulo: r.circulo });
      const cat = this.catalisador(x);
      return {
        id: r.id,
        nome: r.nome,
        elemento: r.elemento,
        qual: amb.qual as cb.TipoAcao,
        pe: amb.pe,
        forma: f.forma,
        dt: amb.dt + (cat?.id === 'catalisador-perturbador' ? 2 : 0),
        resist: cb.lerResistencia(res),
        resistTexto: res ?? '',
        circulo: r.circulo,
        bloqueio: amb.bloqueio ?? r.bloqueio ?? null,
        ambiente: amb,
        alcance: r.alcance,
        sustentavel: /sustentad/i.test(r.duracao),
        pessoal: r.alcance === 'pessoal',
        ref: r.ref,
      };
    }
    const a = this.e.avulso;
    return {
      id: '',
      nome: a.nome.trim() || 'ritual',
      elemento: a.elemento,
      qual: a.qual,
      pe: a.pe,
      forma: 'basica' as cb.FormaRitual,
      dt: a.dt ?? 0,
      resist: cb.lerResistencia(a.resistencia),
      resistTexto: a.resistencia,
      circulo: 1,
      bloqueio: null as string | null,
      ambiente: cb.noAmbiente(this.e.ambiente, { pe: a.pe, dt: a.dt ?? 0, qual: a.qual, circulo: 1 }),
      alcance: '',
      sustentavel: false,
      pessoal: false,
      ref: '',
    };
  }

  /** O catalisador escolhido, se ainda está na mochila e é do elemento do ritual. */
  private catalisador(x: CtxRitual) {
    const c = this.e.catal !== null ? x.catalisadores?.find((y) => y.uid === this.e.catal) : undefined;
    return c ?? null;
  }

  /** A tela de cards escolhe o modo (um alvo, a área ou ninguém) no passo "Contra quem?". */
  definirModo(m: 'alvo' | 'area' | 'nenhum') {
    this.e.modo = m;
  }

  /** O modo de alvo de agora (a tela de cards troca a lista de alvos por caixas de marcar quando é a área). */
  modoDeAlvo(): 'alvo' | 'area' | 'nenhum' {
    return this.e.modo;
  }

  /** Os alvos pelo modo: o escolhido, os da área ou ninguém. */
  private alvos(x: CtxRitual): AlvoAtaque[] {
    if (this.e.modo === 'area') return x.naArea ?? [];
    if (this.e.modo === 'alvo') return x.alvo ? [x.alvo] : [];
    return [];
  }

  private conta(x: CtxRitual) {
    const r = this.escolhido(x);
    const alvos = this.alvos(x);
    const medo = r.elemento === 'medo';
    const doLivro = r.id ? DANO_RITUAL[r.id] : undefined;
    // os dados do livro já vêm preenchidos (29/10: sem eles, o ritual de dano pulava o passo do dano)
    const dadosLivro = r.id ? cb.danoDoRitual(r.id, r.forma) : null;
    // o catalisador potencializador: +1 dado do mesmo tipo no dano (SaH p. 44)
    const potente = this.catalisador(x)?.id === 'catalisador-potencializador';
    const mais = (f: string) => (potente && f.trim() ? f.replace(/(\d+)d(\d+)/, (_, n: string, d: string) => `${Number(n) + 1}d${d}`) : f);
    const formula = this.e.formula ?? mais(dadosLivro?.dano ?? '');
    const formulaP = dadosLivro?.passou ? mais(dadosLivro.passou.dano) : '';
    const partesP = formulaP ? cb.lerDano(formulaP) : null;
    const formula2 = this.e.formula2 ?? dadosLivro?.extra?.dano ?? '';
    const tipo = this.e.tipo ?? dadosLivro?.tipo ?? doLivro?.tipo ?? ELEMENTO_DANO[r.elemento] ?? 'paranormal';
    const tipo2 = this.e.tipo2 ?? dadosLivro?.extra?.tipo ?? doLivro?.extra ?? tipo;
    const ignoraRd = this.e.ignoraRd ?? !!doLivro?.ignoraRd;
    const partes = formula.trim() ? cb.lerDano(formula) : null;
    const partes2 = formula2.trim() ? cb.lerDano(formula2) : null;
    // a Cinerária verdadeira dá o dano máximo e a Rejeitar Névoa verdadeira, o mínimo: a soma sai sozinha
    const extremo = r.ambiente.dano;
    const soma = extremo && partes ? cb.somaExtrema(partes, extremo) : this.e.soma;
    const soma2 = extremo && partes2 ? cb.somaExtrema(partes2, extremo) : this.e.soma2;
    const somaP = extremo && partesP ? cb.somaExtrema(partesP, extremo) : this.e.somaP;
    const linhas = alvos.map((a) => {
      const k = String(a.p.id);
      const res = r.resist;
      // a criatura é imune a rituais de Medo (LR p. 180): nem testa
      const imune = medo && !!x.elementoDe(a.p);
      const base = res && !imune ? x.testeDe(a.p, res.teste) : null;
      const el = cb.elementoContra(r.elemento, x.elementoDe(a.p));
      // dados ganhos e perdidos separados: o elemento que vence o da criatura tira 2d20 (LR p. 11, 118)
      const dados = base ? base.dados + Math.max(0, el?.dados ?? 0) : null;
      const penalidade = base ? (base.penalidade ?? 0) + Math.min(0, el?.dados ?? 0) : 0;
      const d20 = this.e.d20[k] ?? null;
      const total = d20 !== null && base ? d20 + base.bonus : null;
      const passou = res && d20 !== null && total !== null ? cb.passouResistencia(d20, total, r.dt) : null;
      // anula: passou, nada acontece; metade: metade do dano; parcial: o mestre diz
      const anulou = !!res && passou === true && (res.efeito === 'anula' || res.efeito === 'desacredita');
      // parcial: a metade que o livro diz já vem marcada (29/10, a conferência: a Eletrocussão tirava o dano inteiro de quem passou)
      const metade = !!res && passou === true && (res.efeito === 'metade' || (res.efeito === 'parcial' && (this.e.metade[k] ?? !!dadosLivro?.parcialMetade)));
      // cada dano tem a sua conta; "ignora as resistências" tira a RD (Lâmina do Medo, LR p. 135)
      const contar = (p: cb.PartesDano, soma: number, t: TipoDano) => {
        const conta = cb.contaDano({ soma, fixo: p.fixo, tipo: t, rd: ignoraRd ? {} : a.rd, imunidades: a.imunidades, vulnerabilidades: el?.vulneravel ? [...a.vulnerabilidades, t] : a.vulnerabilidades, metade });
        return { conta, previa: cb.previaDano(a.vitais, conta.final, { tipo: t, naoLetalAntes: a.p.naoLetal, agente: a.agente, pessoa: a.pessoa }) };
      };
      // quem passa e o ritual dá outra coisa a ele (Inexistir, Lâmina e Conhecendo o Medo): os dados de quem passou, inteiros
      const outro = passou === true && !!dadosLivro?.passou;
      const dano = imune || anulou ? null : outro ? (partesP && somaP !== null ? contar(partesP, somaP, dadosLivro!.passou!.tipo ?? tipo) : null) : partes && soma !== null ? contar(partes, soma, tipo) : null;
      const extra = partes2 && soma2 !== null && !anulou && !imune && !outro ? contar(partes2, soma2, tipo2) : null;
      const falhou = !imune && (!res || passou === false);
      // quem falha na Lâmina ou no Conhecendo o Medo vai a 0 (PV ou SAN)
      const zera = falhou && passou === false ? dadosLivro?.falhou?.zera : undefined;
      return { a, k, base, el, dados, penalidade, d20, total, passou, anulou, metade: outro ? false : metade, dano, extra, falhou, imune, zera, pendente: !!res && !imune && d20 === null };
    });
    // a concentração: a condição ruim ou terrível, ou o dano sofrido durante a execução (DT igual ao dano; LR p. 120)
    const concCond = x.agente ? cb.dtConcentracao(x.condicoesAtor, r.pe) : null;
    const concDano = x.agente && this.e.danoExec ? { dt: this.e.danoExec, motivo: `${this.e.danoExec} de dano na execução` } : null;
    const conc = concCond && concDano ? (concDano.dt > concCond.dt ? concDano : concCond) : (concCond ?? concDano);
    const concPassou = conc && this.e.conc !== null && x.vontade ? cb.passouResistencia(this.e.conc, this.e.conc + x.vontade.bonus, conc.dt) : null;
    const custo = x.agente ? cb.custoParanormal(r.pe, medo, r.forma) : null;
    const custoRes = custo && !custo.medo && this.e.custo !== null && x.ocultismo ? cb.resultadoCusto(r.pe, this.e.custo, this.e.custo + x.ocultismo.bonus) : null;
    const semAcao =
      (r.qual === 'padrao' && (x.acoes.padrao || x.acoes.completa)) ||
      (r.qual === 'movimento' && (x.acoes.completa || (x.acoes.movimento && x.acoes.padrao))) ||
      (r.qual === 'completa' && (x.acoes.padrao || x.acoes.movimento || x.acoes.completa));
    const precisaP = !!partesP && linhas.some((l) => l.passou === true);
    return { r, alvos, linhas, medo, formula, formula2, formulaP, tipo, tipo2, ignoraRd, partes, partes2, partesP, precisaP, soma, soma2, somaP, livro: dadosLivro, conc, concPassou, custo, custoRes, semAcao };
  }

  passo(x: CtxRitual): number {
    const k = this.conta(x);
    if (this.e.modo !== 'nenhum' && !k.alvos.length) return 2;
    if (k.linhas.some((l) => l.pendente)) return 3;
    if ((k.partes && k.soma === null) || (k.partes2 && k.soma2 === null) || (k.precisaP && k.somaP === null)) return 4;
    if ((k.conc && this.e.conc === null) || (k.custo && !k.custo.medo && this.e.custo === null)) return 5;
    return 6;
  }

  montar(x: CtxRitual): HTMLElement {
    this.sincronizar(x);
    const k = this.conta(x);
    return h('div', { class: 'cb-atk cb-rit' }, this.colRitual(x, k), this.colAlvos(x, k), this.colEfeito(x, k), this.linhaCusto(x, k));
  }

  // ---------------------------------------------------------------- 1. ritual e forma

  private colRitual(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const escolher = (i: number) => () => {
      sfx.click();
      this.e = { ...novo(this.e.chave), ritual: i, modo: this.e.modo };
      x.mudou();
    };
    const cards = x.rituais.map((r, i) =>
      h(
        'button',
        { class: `cb-arma${i === this.e.ritual ? ' on' : ''}`, type: 'button', 'aria-pressed': String(i === this.e.ritual), title: `${r.nome} (${r.ref})`, onclick: escolher(i) },
        h('span', { class: 'cb-arma-ic' }, ic('pentagrama')),
        h('span', { class: 'cb-arma-txt' }, h('b', null, r.nome), h('small', null, `${r.circulo}º · ${r.formas[0].pe} PE · DT ${r.dt}`)),
        x.info ? botaoInfo(() => x.info!(r)) : null,
      ),
    );
    cards.push(
      h(
        'button',
        { class: `cb-arma${this.e.ritual === -1 ? ' on' : ''}`, type: 'button', 'aria-pressed': String(this.e.ritual === -1), onclick: escolher(-1) },
        h('span', { class: 'cb-arma-ic' }, ic('lapis')),
        h('span', { class: 'cb-arma-txt' }, h('b', null, 'Outro ritual'), h('small', null, x.agente ? 'à mão' : 'da ameaça, à mão')),
      ),
    );
    const extra: HTMLElement[] = [];
    const r = this.e.ritual >= 0 ? x.rituais[this.e.ritual] : undefined;
    // o elemento escolhido ao aprender (o Amaldiçoar Arma é de quatro elementos; LR p. 124): fica na ficha
    if (r?.elementos?.length && x.escolherElemento)
      extra.push(
        h(
          'label',
          { class: 'cb-man-arma' },
          h('small', null, 'Elemento escolhido ao aprender'),
          h(
            'select',
            { class: 'fx-inp', onchange: (ev: Event) => (x.escolherElemento!(r.id, (ev.target as HTMLSelectElement).value as Elemento), x.mudou()) },
            ...r.elementos.map((el) => h('option', { value: el, selected: el === r.elemento }, cb.NOME_ELEMENTO[el])),
          ),
        ),
      );
    // a névoa ou a área onde conjura (Cinerária, Rejeitar Névoa, Dissonância; LR p. 126, 130, 140)
    extra.push(
      h(
        'label',
        { class: 'cb-man-arma' },
        h('small', null, 'Conjura dentro de'),
        h(
          'select',
          { class: 'fx-inp', onchange: (ev: Event) => ((this.e.ambiente = (ev.target as HTMLSelectElement).value as cb.AmbienteRitual), (this.e.soma = this.e.soma2 = this.e.somaP = null), x.mudou()) },
          ...(Object.keys(cb.NOME_AMBIENTE) as cb.AmbienteRitual[]).map((a) => h('option', { value: a, selected: a === this.e.ambiente }, cb.NOME_AMBIENTE[a])),
        ),
      ),
    );
    if (k.r.ambiente.linhas.length) extra.push(h('small', { class: 'cb-rit-res' }, k.r.ambiente.linhas.join(' · ')));
    // o catalisador do elemento do ritual (SaH p. 44): consumido ao conjurar
    const cats = (x.catalisadores ?? []).filter((c) => !c.elemento || c.elemento === k.r.elemento);
    if (x.agente && cats.length)
      extra.push(
        h(
          'label',
          { class: 'cb-man-arma' },
          h('small', null, 'Catalisador (gasta um)'),
          h(
            'select',
            { class: 'fx-inp', onchange: (ev: Event) => ((this.e.catal = Number((ev.target as HTMLSelectElement).value) || null), (this.e.soma = null), x.mudou()) },
            h('option', { value: '' }, '—'),
            ...cats.map((c) => h('option', { value: String(c.uid), selected: c.uid === this.e.catal }, c.nome)),
          ),
        ),
      );
    const cat = this.catalisador(x);
    if (cat?.id === 'catalisador-ampliador') extra.push(h('small', { class: 'cb-rit-res' }, 'Ampliador: o alcance sobe um passo ou a área dobra (SaH p. 44).'));
    if (cat?.id === 'catalisador-prolongador') extra.push(h('small', { class: 'cb-rit-res' }, 'Prolongador: a duração dobra (não vale em instantâneo nem sustentado; SaH p. 44).'));
    if (k.r.bloqueio) extra.push(linhaInfo('alerta', k.r.bloqueio, 'ruim'));
    if (r && r.formas.length > 1)
      extra.push(
        h(
          'div',
          { class: 'cb-rit-formas', role: 'group', 'aria-label': 'Forma do ritual' },
          ...r.formas.map((f) =>
            h(
              'button',
              {
                class: `cb-reacao${k.r.forma === f.forma ? ' on' : ''}`,
                type: 'button',
                disabled: !!f.motivo,
                title: f.motivo ?? `Forma ${cb.NOME_FORMA[f.forma]}: ${f.pe} PE`,
                onclick: () => ((this.e.forma = f.forma), (this.e.custo = this.e.conc = this.e.soma = this.e.soma2 = null), x.mudou()),
              },
              `${cb.NOME_FORMA[f.forma]} ${f.pe}`,
            ),
          ),
        ),
      );
    if (this.e.ritual === -1) {
      const a = this.e.avulso;
      const nome = h('input', { class: 'fx-inp', value: a.nome, maxlength: 60, placeholder: 'Nome do ritual', 'data-foco': 'rit:nome' });
      nome.addEventListener('change', () => ((a.nome = nome.value), x.mudou()));
      const res = h('select', { class: 'fx-inp', 'aria-label': 'Resistência', onchange: (ev: Event) => ((a.resistencia = (ev.target as HTMLSelectElement).value), x.mudou()) }, ...RESISTENCIAS.map((t) => h('option', { value: t, selected: t === a.resistencia }, t || 'sem resistência')));
      const el = h('select', { class: 'fx-inp', 'aria-label': 'Elemento', onchange: (ev: Event) => ((a.elemento = (ev.target as HTMLSelectElement).value as Elemento), x.mudou()) }, ...(['sangue', 'morte', 'conhecimento', 'energia', 'medo'] as Elemento[]).map((t) => h('option', { value: t, selected: t === a.elemento }, cb.NOME_ELEMENTO[t])));
      extra.push(
        h(
          'div',
          { class: 'cb-rit-avulso' },
          nome,
          h('div', { class: 'cb-linha-dado' }, campoDado('PE', a.pe, 20, (n) => ((a.pe = n ?? 0), x.mudou()), 'rit:pe'), campoDado('DT', a.dt, 60, (n) => ((a.dt = n), x.mudou()), 'rit:dt')),
          el,
          res,
        ),
      );
    }
    return h('section', { class: 'cb-col cb-col-arma' }, h('h4', null, h('span', null, '1.'), ' RITUAL'), h('div', { class: 'cb-col-lista cb-rola' }, ...cards), ...(extra.length ? [h('div', { class: 'cb-man-extra' }, ...extra)] : []));
  }

  // ---------------------------------------------------------------- 2. alvos e resistência

  private colAlvos(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const modo = (id: Estado['modo'], rot: string, titulo: string) =>
      h('button', { class: `cb-reacao${this.e.modo === id ? ' on' : ''}`, type: 'button', title: titulo, onclick: () => (sfx.click(), (this.e.modo = id), id === 'area' && !x.naArea && x.pedirArea(), x.mudou()) }, rot);
    const corpo: HTMLElement[] = [
      h(
        'div',
        { class: 'cb-rit-modos' },
        modo('alvo', x.alvo ? `Alvo: ${x.alvo.p.nome}` : 'Alvo', 'O alvo escolhido no tabuleiro ou na ordem'),
        modo('area', x.naArea ? `Área (${x.naArea.length})` : 'Área', x.semMapa ? 'Quem o mestre marcou na lista de alvos' : 'Quem está na área desenhada no tabuleiro'),
        modo('nenhum', 'Sem alvo', 'Pessoal, efeito ou área sem ninguém'),
      ),
    ];
    const r = k.r;
    corpo.push(h('small', { class: 'cb-rit-res' }, r.resist ? `${cb.NOME_TESTE[r.resist.teste]} ${cb.NOME_EFEITO[r.resist.efeito]} · DT ${r.dt || '—'}` : r.resistTexto ? `${r.resistTexto} (sem conta: veja o ritual)` : 'Sem teste de resistência'));
    if (this.e.modo === 'alvo' && x.alvo && r.alcance) {
      const m = x.metrosAte(x.alvo.p);
      const f = cb.faixaArma(r.alcance);
      if (m !== null && f && m > cb.METROS_FAIXA[f]) corpo.push(linhaInfo('alerta', `Fora do alcance ${cb.NOME_FAIXA[f]}: ${cb.textoMetros(m)}`, 'ruim'));
      if (m !== null && r.alcance === 'toque' && m > 1.5) corpo.push(linhaInfo('alerta', `Toque pede o alvo adjacente (${cb.textoMetros(m)})`, 'ruim'));
    }
    if (this.e.modo === 'area' && !x.naArea) corpo.push(h('p', { class: 'cb-vazio' }, 'Desenhe a área no tabuleiro (botão Área) e clique no ponto.'));
    if (this.e.modo === 'area' && x.semMapa && !x.naArea?.length) corpo.push(h('p', { class: 'cb-vazio' }, 'Marque na lista de alvos quem está na área do ritual.'));
    if (this.e.modo === 'alvo' && !x.alvo) corpo.push(h('p', { class: 'cb-vazio' }, x.semMapa ? 'Escolha o alvo na lista de alvos, aqui em cima.' : 'Escolha o alvo: clique na peça ou no nome da ordem.'));
    for (const l of k.linhas) {
      const res = r.resist;
      const linha = h('div', { class: 'cb-rit-alvo' }, h('b', null, l.a.p.nome));
      if (l.imune) linha.append(h('small', null, 'criatura: imune a rituais de Medo (LR p. 180)'));
      else if (res) {
        linha.append(
          h('small', null, l.base && l.dados !== null ? `${cb.NOME_TESTE[res.teste]} ${textoTeste(l.dados, l.base.bonus, l.penalidade)}${l.el ? ` (${l.el.dados > 0 ? '+' : '−'}2d20)` : ''}` : 'sem ficha: bônus 0'),
          campoDado('d20', l.d20, 20, (n) => ((this.e.d20[l.k] = n && n >= 1 ? n : null), x.mudou()), `rit:${l.k}`),
          l.passou === null ? h('span') : h('span', { class: `cb-rit-marca ${l.passou ? 'bom' : 'ruim'}` }, l.passou ? 'passou' : 'falhou'),
        );
        if (l.zera) linha.append(h('small', { class: 'cb-rit-marca ruim' }, l.zera === 'pv' ? 'vai a 0 PV' : 'vai a 0 de SAN'));
        if (res.efeito === 'parcial' && l.passou && k.partes && !k.livro?.passou)
          linha.append(h('label', { class: 'cb-rit-meia', title: 'Parcial: o ritual diz o que sobra; marque se é metade do dano' }, h('input', { type: 'checkbox', checked: l.metade, onchange: (ev: Event) => ((this.e.metade[l.k] = (ev.target as HTMLInputElement).checked), x.mudou()) }), '½'));
      }
      if (l.el) linha.title = l.el.texto;
      corpo.push(linha);
    }
    return h('section', { class: 'cb-col cb-col-sit' }, h('h4', null, h('span', null, '2.'), ' ALVOS E RESISTÊNCIA'), h('div', { class: 'cb-col-lista cb-rola' }, ...corpo));
  }

  // ---------------------------------------------------------------- 3. efeito

  private colEfeito(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const formula = h('input', { class: 'fx-inp cb-rit-formula', value: k.formula, maxlength: 20, placeholder: 'dano: 3d6+3', 'data-foco': 'rit:formula', 'aria-label': 'Dados do dano do ritual' });
    formula.addEventListener('change', () => ((this.e.formula = formula.value.replace(/[^0-9dD+\-−\s]/g, '')), (this.e.soma = null), x.mudou()));
    const tipo = h(
      'select',
      { class: 'fx-inp', 'aria-label': 'Tipo do dano', onchange: (ev: Event) => ((this.e.tipo = (ev.target as HTMLSelectElement).value as TipoDano), x.mudou()) },
      ...cb.TIPOS_DANO.filter((t) => t !== 'todos' && t !== 'fisico').map((t) => h('option', { value: t, selected: t === k.tipo }, cb.NOME_TIPO_DANO[t])),
    );
    // o dano a mais de outro tipo, rolado à parte (Presença do Medo: mental e de Medo, LR p. 139)
    const formula2 = h('input', { class: 'fx-inp cb-rit-formula', value: k.formula2, maxlength: 20, placeholder: 'e mais: 5d8', 'data-foco': 'rit:formula2', 'aria-label': 'Dano a mais, de outro tipo' });
    formula2.addEventListener('change', () => ((this.e.formula2 = formula2.value.replace(/[^0-9dD+\-−\s]/g, '')), (this.e.soma2 = null), x.mudou()));
    const tipo2 = h(
      'select',
      { class: 'fx-inp', 'aria-label': 'Tipo do dano a mais', onchange: (ev: Event) => ((this.e.tipo2 = (ev.target as HTMLSelectElement).value as TipoDano), x.mudou()) },
      ...cb.TIPOS_DANO.filter((t) => t !== 'todos' && t !== 'fisico').map((t) => h('option', { value: t, selected: t === k.tipo2 }, cb.NOME_TIPO_DANO[t])),
    );
    const corpo: HTMLElement[] = [h('div', { class: 'cb-rit-dano' }, formula, tipo), h('div', { class: 'cb-rit-dano' }, formula2, tipo2)];
    if (k.partes || k.partes2)
      corpo.push(
        h(
          'label',
          { class: 'cb-dlg-check cb-man-check', title: 'O dano ignora as resistências (a Lâmina do Medo, LR p. 135)' },
          h('input', { type: 'checkbox', class: 'cb-check', checked: k.ignoraRd, onchange: (ev: Event) => ((this.e.ignoraRd = (ev.target as HTMLInputElement).checked), x.mudou()) }),
          h('span', null, 'Ignora a RD'),
        ),
      );
    // dano máximo ou mínimo (as névoas verdadeiras): a soma já vem pronta
    const ext = k.r.ambiente.dano;
    if (k.partes) corpo.push(h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, cb.textoDano(k.formula))), ext ? h('small', { class: 'cb-rit-res' }, `${ext === 'maximo' ? 'Máximo' : 'Mínimo'}: ${k.soma}`) : campoDado('soma dos dados', this.e.soma, 999, (n) => ((this.e.soma = n), x.mudou()), 'rit:soma', true));
    if (k.partes2) corpo.push(h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, `${cb.textoDano(k.formula2)} (${cb.NOME_TIPO_DANO[k.tipo2]})`)), ext ? h('small', { class: 'cb-rit-res' }, `${ext === 'maximo' ? 'Máximo' : 'Mínimo'}: ${k.soma2}`) : campoDado(`soma do dano a mais`, this.e.soma2, 999, (n) => ((this.e.soma2 = n), x.mudou()), 'rit:soma2'));
    // quem passou sofre outros dados (Inexistir, Lâmina e Conhecendo o Medo)
    if (k.precisaP)
      corpo.push(
        h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, `Quem passou: ${cb.textoDano(k.formulaP)}${k.livro?.passou?.condicao ? ` e fica ${regras.catalogo.condicao(k.livro.passou.condicao)?.nome.toLowerCase() ?? k.livro.passou.condicao}` : ''}`)),
        ext ? h('small', { class: 'cb-rit-res' }, `${ext === 'maximo' ? 'Máximo' : 'Mínimo'}: ${k.somaP}`) : campoDado('soma de quem passou', this.e.somaP, 999, (n) => ((this.e.somaP = n), x.mudou()), 'rit:somaP'),
      );
    if (k.livro?.falhou?.nota) corpo.push(h('small', { class: 'cb-rit-res' }, `Quem falha: ${k.livro.falhou.nota}.`));
    if (k.partes || k.partes2 || k.partesP)
      for (const l of k.linhas) {
        if (l.imune) corpo.push(h('small', { class: 'cb-rit-linha' }, `${l.a.p.nome}: imune (criatura).`));
        else if (l.anulou) corpo.push(h('small', { class: 'cb-rit-linha' }, `${l.a.p.nome}: anulou.`));
        else
          for (const d of [l.dano, l.extra]) if (d) corpo.push(h('small', { class: 'cb-rit-linha' }, `${l.a.p.nome}: ${d.conta.conta}${d.previa ? ` · ${d.previa.texto}` : ''}`));
      }
    const conds = regras.catalogo.CATALOGO.condicoes.filter((c) => !c.automatica);
    corpo.push(
      h(
        'label',
        { class: 'cb-man-arma' },
        h('small', null, k.r.resist ? 'Condição em quem falhou' : 'Condição nos alvos'),
        h(
          'select',
          { class: 'fx-inp', onchange: (ev: Event) => ((this.e.condicao = (ev.target as HTMLSelectElement).value), x.mudou()) },
          h('option', { value: '' }, '—'),
          ...conds.map((c) => h('option', { value: c.id, selected: c.id === (this.e.condicao || k.livro?.falhou?.condicao) }, c.nome)),
        ),
      ),
    );
    return h('section', { class: 'cb-col cb-col-rol' }, h('h4', null, h('span', null, '3.'), ' EFEITO'), h('div', { class: 'cb-col-corpo cb-rola' }, ...corpo));
  }

  // ---------------------------------------------------------------- 4. custo do paranormal e confirmar

  private linhaCusto(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const r = k.r;
    const partes: HTMLElement[] = [];
    // o dano que quem conjura sofreu durante a execução (atacado como reação, ou em chamas; LR p. 120)
    if (x.agente)
      partes.push(
        h(
          'div',
          { class: 'cb-rit-custo' },
          h('small', null, `Sofreu dano na execução?${x.condicoesAtor.includes('em-chamas') ? ' (em chamas: o dano do fogo)' : ''}`),
          campoDado('dano', this.e.danoExec, 999, (n) => ((this.e.danoExec = n && n > 0 ? n : null), (this.e.conc = null), x.mudou()), 'rit:danoExec'),
        ),
      );
    if (k.conc) {
      partes.push(
        h(
          'div',
          { class: 'cb-rit-custo' },
          h('small', null, `Concentração: Vontade ${x.vontade ? textoTeste(x.vontade.dados, x.vontade.bonus, x.vontade.penalidade) : ''} DT ${k.conc.dt} (${k.conc.motivo})`),
          campoDado('d20', this.e.conc, 20, (n) => ((this.e.conc = n && n >= 1 ? n : null), x.mudou()), 'rit:conc'),
          k.concPassou === null ? h('span') : h('span', { class: `cb-rit-marca ${k.concPassou ? 'bom' : 'ruim'}` }, k.concPassou ? 'passou' : 'falhou: não sai'),
        ),
      );
    }
    if (!x.agente) partes.push(h('small', { class: 'cb-rit-custo' }, 'Ameaça: sem PE e sem Custo do Paranormal.'));
    else if (k.custo?.medo) partes.push(h('small', { class: 'cb-rit-custo alerta' }, `Ritual de Medo: ${k.custo.mental} de dano mental e ${k.custo.sanPermanente} de SAN para sempre (LR p. 121).`));
    else if (k.custo)
      partes.push(
        h(
          'div',
          { class: 'cb-rit-custo' },
          h('small', null, `Ocultismo ${x.ocultismo ? textoTeste(x.ocultismo.dados, x.ocultismo.bonus, x.ocultismo.penalidade) : '—'} contra DT ${k.custo.dt}`),
          campoDado('d20', this.e.custo, 20, (n) => ((this.e.custo = n && n >= 1 ? n : null), x.mudou()), 'rit:custo'),
          k.custoRes === null
            ? h('span')
            : h('span', { class: `cb-rit-marca ${k.custoRes.passou ? 'bom' : 'ruim'}` }, k.custoRes.passou ? 'passou' : `${k.custoRes.mental} mental${k.custoRes.sanPermanente ? ' · −1 SAN para sempre' : ''}`),
        ),
      );
    const limite = x.limite;
    // atingido o limite, não conjura; o primeiro do turno na forma básica passa (LR p. 24; 29/10, o Felipe)
    const passaLimite = x.agente && limite !== null && x.gasto + r.pe > limite;
    const barrado = passaLimite && !(x.gasto === 0 && r.forma === 'basica');
    if (passaLimite)
      partes.push(h('small', { class: 'cb-rit-custo alerta' }, barrado ? `Passa do limite de PE (${limite}; já gastos ${x.gasto}): não dá para conjurar neste turno.` : `Acima do limite de PE (${limite}), mas vale: é o primeiro do turno, na forma básica (LR p. 24).`));
    const sust = this.e.sustentado ?? r.sustentavel;
    partes.push(
      h('label', { class: 'cb-dlg-check cb-man-check' }, h('input', { type: 'checkbox', class: 'cb-check', checked: sust, onchange: (ev: Event) => ((this.e.sustentado = (ev.target as HTMLInputElement).checked), x.mudou()) }), h('span', null, 'Sustentado')),
    );
    const faltaCusto = (!!k.conc && this.e.conc === null) || (!!k.custo && !k.custo.medo && this.e.custo === null && !!x.ocultismo);
    const pronto =
      !k.linhas.some((l) => l.pendente) &&
      !(k.partes && k.soma === null) &&
      !(k.partes2 && k.soma2 === null) &&
      !(k.precisaP && k.somaP === null) &&
      !faltaCusto &&
      (this.e.ritual >= 0 || !!this.e.avulso.nome.trim()) &&
      (this.e.modo === 'nenhum' || k.alvos.length > 0);
    const desfazer = h(
      'button',
      {
        class: 'cb-bt claro',
        type: 'button',
        title: 'Limpa os dados rolados',
        onclick: () => {
          sfx.click();
          this.e.d20 = {};
          this.e.soma = this.e.soma2 = this.e.custo = this.e.conc = null;
          x.mudou();
        },
      },
      ic('girarE'),
      h('span', null, 'Desfazer'),
    );
    const confirmar = h(
      'button',
      {
        class: 'cb-bt forte',
        type: 'button',
        disabled: !pronto || k.semAcao || barrado || !!r.bloqueio,
        title: r.bloqueio ?? (k.semAcao ? 'A ação deste ritual já foi usada no turno' : 'Gasta o PE, aplica o dano e escreve no registro'),
        onclick: () => {
          sfx.click();
          const concentracao = k.conc && this.e.conc !== null && x.vontade ? { dt: k.conc.dt, d20: this.e.conc, total: this.e.conc + x.vontade.bonus, passou: !!k.concPassou } : undefined;
          // a criatura imune ao ritual de Medo vai só com o id: o servidor escreve que ela é imune
          const alvos: cb.AlvoRitual[] = k.linhas.map((l) => ({
            id: l.a.p.id,
            ...(r.resist && l.d20 !== null && l.base && l.total !== null ? { teste: { nome: r.resist.teste, dados: l.dados ?? l.base.dados, bonus: l.base.bonus, d20: l.d20, total: l.total, passou: !!l.passou } } : {}),
            ...(l.dano
              ? {
                  dano: {
                    formula: cb.textoFormula(l.passou === true && k.livro?.passou ? k.partesP! : k.partes!),
                    soma: (l.passou === true && k.livro?.passou ? k.somaP : k.soma)!,
                    total: l.dano.conta.total,
                    tipo: k.tipo,
                    conta: l.dano.conta.conta,
                    final: l.dano.conta.final,
                  },
                }
              : {}),
            ...(l.extra
              ? {
                  danoExtra: {
                    formula: cb.textoFormula(k.partes2!),
                    soma: k.soma2!,
                    total: l.extra.conta.total,
                    tipo: k.tipo2,
                    conta: l.extra.conta.conta,
                    final: l.extra.conta.final,
                  },
                }
              : {}),
            // a condição de quem falha (a escolhida, ou a do livro) e a de quem passa (apavorado, debilitado)
            ...(() => {
              const cf = this.e.condicao || k.livro?.falhou?.condicao;
              const cp = k.livro?.passou?.condicao;
              return l.falhou && cf ? { condicao: cf } : l.passou === true && cp ? { condicao: cp } : {};
            })(),
            ...(l.zera ? { zera: l.zera } : {}),
            ...(l.falhou && l.passou === false && k.livro?.falhou?.nota ? { nota: k.livro.falhou.nota } : {}),
          }));
          const custo = k.custoRes && x.ocultismo && this.e.custo !== null ? { dt: 15 + r.pe, d20: this.e.custo, total: this.e.custo + x.ocultismo.bonus, passou: k.custoRes.passou } : undefined;
          const ritual: cb.RitualConfirmado = {
            quem: x.ator.id,
            ritual: r.nome,
            elemento: r.elemento,
            forma: r.forma,
            qual: r.qual,
            pe: x.agente ? r.pe : 0,
            ...(r.dt ? { dt: r.dt } : {}),
            ...(sust ? { sustentado: true } : {}),
            ...(concentracao ? { concentracao } : {}),
            alvos,
            ...(custo ? { custo } : {}),
            ...(k.custo?.medo ? { medo: true, mental: k.custo.mental, sanPermanente: k.custo.sanPermanente } : {}),
            ...(k.custoRes && !k.custoRes.passou ? { mental: k.custoRes.mental, sanPermanente: k.custoRes.sanPermanente } : {}),
            ...(this.catalisador(x) ? { gastar: [this.catalisador(x)!.uid] } : {}),
            // a Convocação Instantânea verdadeira: 1 PE para sempre (LR p. 128)
            ...(x.agente && r.id === 'convocacao-instantanea' && r.forma === 'verdadeira' ? { pePermanente: 1 } : {}),
          };
          x.enviar({ tipo: 'ritual', ritual });
          this.e.d20 = {};
          this.e.soma = this.e.soma2 = this.e.somaP = this.e.custo = this.e.conc = this.e.danoExec = this.e.catal = null;
          this.e.metade = {};
          x.mudou();
        },
      },
      ic('ok'),
      h('span', null, 'Confirmar ação'),
    );
    return h('section', { class: 'cb-dano cb-rit-pe' }, h('div', { class: 'cb-dano-cab' }, h('h4', null, h('span', null, '4.'), ' CUSTO DO PARANORMAL')), h('div', { class: 'cb-dano-corpo' }, ...partes), h('div', { class: 'cb-dano-botoes' }, desfazer, confirmar));
  }
}
