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
  alvo: AlvoAtaque | null;
  /** quem está na área desenhada no tabuleiro (ferramenta Área) */
  naArea: AlvoAtaque[] | null;
  testeDe: (p: cb.Participante, t: cb.TesteResistencia) => { dados: number; bonus: number; penalidade?: number } | null;
  elementoDe: (p: cb.Participante) => Elemento | null;
  /** metros até o alvo (null = em outra cena) */
  metrosAte: (p: cb.Participante) => number | null;
  acoes: cb.AcoesTurno;
  pedirArea: () => void;
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
  formula: string;
  tipo: TipoDano | null;
  soma: number | null;
  /** o dano a mais de outro tipo (Presença do Medo: mental e de Medo) */
  formula2: string;
  tipo2: TipoDano | null;
  soma2: number | null;
  /** o dano ignora a RD (Lâmina do Medo); null = o que o ritual diz */
  ignoraRd: boolean | null;
  /** "parcial": o mestre marca quem sofre só a metade */
  metade: Record<string, boolean>;
  condicao: string;
  custo: number | null;
  sustentado: boolean | null;
}

const novo = (chave: string): Estado => ({
  chave,
  ritual: 0,
  forma: 'basica',
  modo: 'alvo',
  avulso: { nome: '', pe: 0, dt: null, resistencia: '', elemento: 'sangue', qual: 'padrao' },
  d20: {},
  conc: null,
  formula: '',
  tipo: null,
  soma: null,
  formula2: '',
  tipo2: null,
  soma2: null,
  ignoraRd: null,
  metade: {},
  condicao: '',
  custo: null,
  sustentado: null,
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
      return {
        id: r.id,
        nome: r.nome,
        elemento: r.elemento,
        qual: r.qual,
        pe: f.pe,
        forma: f.forma,
        dt: r.dt,
        resist: cb.lerResistencia(r.resistencia),
        resistTexto: r.resistencia ?? '',
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
      alcance: '',
      sustentavel: false,
      pessoal: false,
      ref: '',
    };
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
    const tipo = this.e.tipo ?? doLivro?.tipo ?? ELEMENTO_DANO[r.elemento] ?? 'paranormal';
    const tipo2 = this.e.tipo2 ?? doLivro?.extra ?? tipo;
    const ignoraRd = this.e.ignoraRd ?? !!doLivro?.ignoraRd;
    const partes = this.e.formula.trim() ? cb.lerDano(this.e.formula) : null;
    const partes2 = this.e.formula2.trim() ? cb.lerDano(this.e.formula2) : null;
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
      const metade = !!res && passou === true && (res.efeito === 'metade' || (res.efeito === 'parcial' && !!this.e.metade[k]));
      // cada dano tem a sua conta; "ignora as resistências" tira a RD (Lâmina do Medo, LR p. 135)
      const contar = (p: cb.PartesDano, soma: number, t: TipoDano) => {
        const conta = cb.contaDano({ soma, fixo: p.fixo, tipo: t, rd: ignoraRd ? {} : a.rd, imunidades: a.imunidades, vulnerabilidades: el?.vulneravel ? [...a.vulnerabilidades, t] : a.vulnerabilidades, metade });
        return { conta, previa: cb.previaDano(a.vitais, conta.final, { tipo: t, naoLetalAntes: a.p.naoLetal, agente: a.agente }) };
      };
      const dano = partes && this.e.soma !== null && !anulou && !imune ? contar(partes, this.e.soma, tipo) : null;
      const extra = partes2 && this.e.soma2 !== null && !anulou && !imune ? contar(partes2, this.e.soma2, tipo2) : null;
      const falhou = !imune && (!res || passou === false);
      return { a, k, base, el, dados, penalidade, d20, total, passou, anulou, metade, dano, extra, falhou, imune, pendente: !!res && !imune && d20 === null };
    });
    const conc = x.agente ? cb.dtConcentracao(x.condicoesAtor, r.pe) : null;
    const concPassou = conc && this.e.conc !== null && x.vontade ? cb.passouResistencia(this.e.conc, this.e.conc + x.vontade.bonus, conc.dt) : null;
    const custo = x.agente ? cb.custoParanormal(r.pe, medo, r.forma) : null;
    const custoRes = custo && !custo.medo && this.e.custo !== null && x.ocultismo ? cb.resultadoCusto(r.pe, this.e.custo, this.e.custo + x.ocultismo.bonus) : null;
    const semAcao =
      (r.qual === 'padrao' && (x.acoes.padrao || x.acoes.completa)) ||
      (r.qual === 'movimento' && (x.acoes.completa || (x.acoes.movimento && x.acoes.padrao))) ||
      (r.qual === 'completa' && (x.acoes.padrao || x.acoes.movimento || x.acoes.completa));
    return { r, alvos, linhas, medo, tipo, tipo2, ignoraRd, partes, partes2, conc, concPassou, custo, custoRes, semAcao };
  }

  passo(x: CtxRitual): number {
    const k = this.conta(x);
    if (this.e.modo !== 'nenhum' && !k.alvos.length) return 2;
    if (k.linhas.some((l) => l.pendente)) return 3;
    if ((k.partes && this.e.soma === null) || (k.partes2 && this.e.soma2 === null)) return 4;
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
                onclick: () => ((this.e.forma = f.forma), (this.e.custo = this.e.conc = null), x.mudou()),
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
        modo('area', x.naArea ? `Área (${x.naArea.length})` : 'Área', 'Quem está na área desenhada no tabuleiro'),
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
    if (this.e.modo === 'alvo' && !x.alvo) corpo.push(h('p', { class: 'cb-vazio' }, 'Escolha o alvo: clique na peça ou no nome da ordem.'));
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
        if (res.efeito === 'parcial' && l.passou && k.partes)
          linha.append(h('label', { class: 'cb-rit-meia', title: 'Parcial: o ritual diz o que sobra; marque se é metade do dano' }, h('input', { type: 'checkbox', checked: !!this.e.metade[l.k], onchange: (ev: Event) => ((this.e.metade[l.k] = (ev.target as HTMLInputElement).checked), x.mudou()) }), '½'));
      }
      if (l.el) linha.title = l.el.texto;
      corpo.push(linha);
    }
    return h('section', { class: 'cb-col cb-col-sit' }, h('h4', null, h('span', null, '2.'), ' ALVOS E RESISTÊNCIA'), h('div', { class: 'cb-col-lista cb-rola' }, ...corpo));
  }

  // ---------------------------------------------------------------- 3. efeito

  private colEfeito(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const formula = h('input', { class: 'fx-inp cb-rit-formula', value: this.e.formula, maxlength: 20, placeholder: 'dano: 3d6+3', 'data-foco': 'rit:formula', 'aria-label': 'Dados do dano do ritual' });
    formula.addEventListener('change', () => ((this.e.formula = formula.value.replace(/[^0-9dD+\-−\s]/g, '')), (this.e.soma = null), x.mudou()));
    const tipo = h(
      'select',
      { class: 'fx-inp', 'aria-label': 'Tipo do dano', onchange: (ev: Event) => ((this.e.tipo = (ev.target as HTMLSelectElement).value as TipoDano), x.mudou()) },
      ...cb.TIPOS_DANO.filter((t) => t !== 'todos' && t !== 'fisico').map((t) => h('option', { value: t, selected: t === k.tipo }, cb.NOME_TIPO_DANO[t])),
    );
    // o dano a mais de outro tipo, rolado à parte (Presença do Medo: mental e de Medo, LR p. 139)
    const formula2 = h('input', { class: 'fx-inp cb-rit-formula', value: this.e.formula2, maxlength: 20, placeholder: 'e mais: 5d8', 'data-foco': 'rit:formula2', 'aria-label': 'Dano a mais, de outro tipo' });
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
    if (k.partes) corpo.push(h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, cb.textoDano(this.e.formula))), campoDado('soma dos dados', this.e.soma, 999, (n) => ((this.e.soma = n), x.mudou()), 'rit:soma', true));
    if (k.partes2) corpo.push(h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, `${cb.textoDano(this.e.formula2)} (${cb.NOME_TIPO_DANO[k.tipo2]})`)), campoDado(`soma do dano a mais`, this.e.soma2, 999, (n) => ((this.e.soma2 = n), x.mudou()), 'rit:soma2'));
    if (k.partes || k.partes2)
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
          ...conds.map((c) => h('option', { value: c.id, selected: c.id === this.e.condicao }, c.nome)),
        ),
      ),
    );
    return h('section', { class: 'cb-col cb-col-rol' }, h('h4', null, h('span', null, '3.'), ' EFEITO'), h('div', { class: 'cb-col-corpo cb-rola' }, ...corpo));
  }

  // ---------------------------------------------------------------- 4. custo do paranormal e confirmar

  private linhaCusto(x: CtxRitual, k: ReturnType<ResolucaoRitual['conta']>): HTMLElement {
    const r = k.r;
    const partes: HTMLElement[] = [];
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
    if (x.agente && limite !== null && x.gasto + r.pe > limite) partes.push(h('small', { class: 'cb-rit-custo alerta' }, `Passa do limite de PE (${limite}; já gastos ${x.gasto}).`));
    const sust = this.e.sustentado ?? r.sustentavel;
    partes.push(
      h('label', { class: 'cb-dlg-check cb-man-check' }, h('input', { type: 'checkbox', class: 'cb-check', checked: sust, onchange: (ev: Event) => ((this.e.sustentado = (ev.target as HTMLInputElement).checked), x.mudou()) }), h('span', null, 'Sustentado')),
    );
    const faltaCusto = (!!k.conc && this.e.conc === null) || (!!k.custo && !k.custo.medo && this.e.custo === null && !!x.ocultismo);
    const pronto = !k.linhas.some((l) => l.pendente) && !(k.partes && this.e.soma === null) && !(k.partes2 && this.e.soma2 === null) && !faltaCusto && (this.e.ritual >= 0 || !!this.e.avulso.nome.trim()) && (this.e.modo === 'nenhum' || k.alvos.length > 0);
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
        disabled: !pronto || k.semAcao,
        title: k.semAcao ? 'A ação deste ritual já foi usada no turno' : 'Gasta o PE, aplica o dano e escreve no registro',
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
                    formula: cb.textoFormula(k.partes!),
                    soma: this.e.soma!,
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
                    soma: this.e.soma2!,
                    total: l.extra.conta.total,
                    tipo: k.tipo2,
                    conta: l.extra.conta.conta,
                    final: l.extra.conta.final,
                  },
                }
              : {}),
            ...(this.e.condicao && l.falhou ? { condicao: this.e.condicao } : {}),
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
          };
          x.enviar({ tipo: 'ritual', ritual });
          this.e.d20 = {};
          this.e.soma = this.e.soma2 = this.e.custo = this.e.conc = null;
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
