/**
 * Resolução do ataque na aba COMBATE (referência docs/referencias/combate.webp; regras
 * em docs/COMBATE.md, seções 5.6 a 8): 1. Arma, 2. Situação, 3. Rolagem e
 * 4. Dano, com Desfazer e Confirmar ação. Os dados são físicos: o mestre digita
 * o d20 que ficou, o d10 da falha e a soma dos dados de dano. As contas saem de
 * @crona/shared (combate/ataque.ts); o servidor aplica o dano e escreve o
 * registro quando o mestre confirma.
 */
import { combate as cb, type Vitals } from '@crona/shared';
import type { regras } from '@crona/shared';
import type { Cobertura } from '../room/combateGeo';
import { h } from './dom';
import { textoTeste } from './fichaRegras';
import { arteOu, ic, type NomeIcone } from './icons';
import { arteDoItem } from './arteItem';
import { sfx } from './sfx';

type TipoDano = regras.TipoDano;

/** Um ataque que quem age pode fazer (da ficha do agente ou da ficha rápida da ameaça). */
export interface ArmaOpcao {
  /** o item do catálogo (a arte pintada dele); sem ele (ameaça), o ícone do ataque */
  item?: string;
  nome: string;
  pericia: 'luta' | 'pontaria';
  /** d20 do atributo e os ganhos */
  dados: number;
  /** d20 perdidos (0 ou negativo): a conta de "menos de 1 dado" usa os dois (LR p. 11) */
  penalidade?: number;
  bonus: number;
  /** "3d8+5" */
  dano: string;
  tipo: TipoDano;
  margem: number;
  multiplicador: number;
  /** faixa de alcance; null = corpo a corpo */
  faixa: cb.Faixa | null;
  notas: string[];
  /** ataques por ação (o "×2" da ameaça) */
  vezes?: number;
  /** dano a mais de outro tipo, rolado à parte ("e 1d8 mental") */
  extra?: { dano: string; tipo: TipoDano };
  /** a arma está na mão (da ficha): só assim ataca; a da mochila precisa sacar antes */
  naMao?: boolean;
  /** o item da mochila (para sacar) */
  uid?: number;
  /** a jogada pronta do agente (regras/jogadas.ts): já somada; os PE saem junto com o ataque */
  jogada?: { nome: string; pe: number; linhas: string[]; erros: string[]; avisos: string[]; nota?: string };
}

export interface AlvoAtaque {
  p: cb.Participante;
  agente: boolean;
  /** Defesa da ficha (agente) ou da ficha rápida (ameaça); null = sem ficha */
  defesa: number | null;
  rd: Partial<Record<TipoDano, number>>;
  imunidades: TipoDano[];
  vulnerabilidades: TipoDano[];
  vitais?: Vitals;
  /** esquiva = Defesa com a esquiva; bloqueio = RD; só agentes treinados (LR p. 88) */
  reacoes: { esquiva: number | null; bloqueio: number | null; contraAtaque: boolean } | null;
  /** condições do alvo (combate, ficha e as de PV/SAN) */
  condicoes: string[];
}

/** O que o tabuleiro viu entre quem ataca e o alvo. */
export interface TabuleiroAtaque {
  /** null = em outra cena */
  metros: number | null;
  adjacente: boolean;
  cobertura: Cobertura;
  elevado: boolean;
  flanqueia: boolean;
  /** o alvo está adjacente a alguém do lado de quem ataca */
  emCorpoACorpo: boolean;
}

export interface CtxAtaque {
  combate: cb.Combate;
  ator: cb.Participante;
  condicoesAtor: string[];
  armas: ArmaOpcao[];
  alvo: AlvoAtaque | null;
  tab: TabuleiroAtaque | null;
  /** clima da cena: escuridão e névoa viram camuflagem (DC-12; LR p. 290) */
  escuridao: 'normal' | 'camuflagem' | 'total';
  nevoa: 'nenhuma' | 'camuflagem' | 'espessa';
  acoes: cb.AcoesTurno;
  enviar: (a: cb.AcaoCombate) => void;
  /** saca a arma da mochila (gasta a ação de movimento) */
  sacar?: (a: ArmaOpcao) => void;
  /** pede para desenhar de novo (mudou uma escolha) */
  mudou: () => void;
  /** o retrato de uma peça (o cartão do dano mostra quem apanha) */
  retrato?: (id: number, tamanho: number) => HTMLElement;
}

interface Estado {
  chave: string;
  arma: number;
  reacao: 'nenhuma' | 'esquiva' | 'bloqueio';
  /** o mestre corrige o que o tabuleiro ligou (ou liga o que ele não vê) */
  manual: Partial<Record<cb.SituacaoId, boolean>>;
  /** Defesa digitada, para alvo sem ficha */
  defesaManual: number | null;
  d20: number | null;
  /** o dado da chance de falha (d10; d4 nos 75%) */
  d10: number | null;
  soma: number | null;
  /** soma do dano a mais de outro tipo */
  somaExtra: number | null;
}

/** O ícone pintado do kit de cada situação que tem um parecido (arte/icones/<nome>.png); as outras ficam com o de linha. */
const PINTADO_SIT: Partial<Record<cb.SituacaoId, string>> = {
  cobertura: 'defesa',
  camuflagem: 'clima-iluminacao',
  camuflagemTotal: 'clima-nevoa',
  alcanceDobro: 'tabuleiro-medir',
  emCorpoACorpo: 'combate-manobra',
  flanqueando: 'combate-atacar',
  elevado: 'clima-terreno',
  investida: 'combate-movimento',
  alvoCaido: 'estado-caido',
  atacanteCaido: 'estado-caido',
};
/** A arte da arma, como na aba Ataques do celular: a pintada do item; o desarmado é o punho; a da ameaça, o ataque. */
const arteArma = (a: ArmaOpcao) =>
  a.item && a.item !== 'ataque-desarmado'
    ? arteDoItem({ id: a.item, tipo: 'arma', nome: a.nome }, a.pericia === 'pontaria' ? 'pistola' : 'faca', 'arte-ic')
    : arteOu([a.item ? '/arte/icones/for.png' : '/arte/icones/combate-atacar.png'], ic(a.item ? 'punho' : 'espadas'));

const icSit = (id: cb.SituacaoId) => {
  const linha = ic(ICONE_SIT[id] ?? 'alerta');
  // a arte própria da situação (sit-<id>.png, PROMPT-ICONES-E-LOGO) e, até ela chegar, a do kit que serve
  const pintado = PINTADO_SIT[id];
  return arteOu([`/arte/icones/sit-${id}.png`, ...(pintado ? [`/arte/icones/${pintado}.png`] : [])], linha);
};

const ICONE_SIT: Partial<Record<cb.SituacaoId, NomeIcone>> = {
  cobertura: 'escudo',
  camuflagem: 'sol',
  camuflagemTotal: 'lua',
  alcanceDobro: 'regua',
  emCorpoACorpo: 'punho',
  flanqueando: 'espadas',
  elevado: 'montanha',
  investida: 'correr',
  alvoDesprevenido: 'alerta',
  alvoCaido: 'deitado',
  alvoVulneravel: 'alerta',
  alvoIndefeso: 'caveira',
  atacanteCaido: 'deitado',
  atacanteOfuscado: 'olho',
  atacanteAgarrado: 'mao',
  atacanteCego: 'olho',
  naoLetal: 'mao',
};

/** Situações que o mestre pode ligar à mão (o tabuleiro não vê). */
const MANUAIS: cb.SituacaoId[] = ['investida', 'naoLetal', 'alvoDesprevenido', 'alvoCaido', 'flanqueando', 'elevado', 'cobertura'];

const numero = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
};

export const PASSOS_ATAQUE = ['Ação', 'Arma', 'Alvo', 'Reação do alvo', 'Rolagem', 'Dano', 'Confirmar'];

/** Caixinha de um número rolado na mesa (d20, d10, soma do dano). */
export function campoDado(rotulo: string, valor: number | null, max: number, fn: (n: number | null) => void, foco: string, grande = false): HTMLElement {
  const inp = h('input', {
    class: `cb-dado${grande ? ' grande' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    maxlength: String(max).length,
    value: valor === null ? '' : String(valor),
    placeholder: '—',
    'data-foco': foco,
    'aria-label': rotulo,
  });
  const enviar = () => {
    const n = numero(inp.value);
    fn(n === null ? null : Math.max(0, Math.min(max, n)));
  };
  inp.addEventListener('change', enviar);
  inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && inp.blur());
  return h('label', { class: 'cb-caixa-dado' }, h('small', null, rotulo), inp);
}

/** Linha de aviso (sem chave) nas colunas da resolução; `arte` = o ícone pintado (arte/icones/<arte>.png), se houver. */
export function linhaInfo(icone: NomeIcone, texto: string, cls: string, arte?: string): HTMLElement {
  return h('div', { class: `cb-sit info ${cls}` }, h('span', { class: 'cb-sit-ic' }, arte ? arteOu([`/arte/icones/${arte}.png`], ic(icone)) : ic(icone)), h('span', { class: 'cb-sit-txt' }, texto));
}

/** Junta sem espaço: a linha não quebra no meio do crítico ("20/×2"). */
const JUNTA = String.fromCodePoint(0x2060);

export class ResolucaoAtaque {
  private e: Estado = { chave: '', arma: 0, reacao: 'nenhuma', manual: {}, defesaManual: null, d20: null, d10: null, soma: null, somaExtra: null };
  /** no ataque rápido: a lista das situações de marcar à mão aberta */
  private maisSituacoes = false;
  /** a investida escolhida no menu de ataque (fica até escolher outra coisa) */
  private investida = false;

  /** Zera a rolagem quando muda quem age, o alvo ou a rodada. */
  private sincronizar(x: CtxAtaque) {
    const chave = `${x.combate.rodada}|${x.combate.vez}|${x.ator.id}|${x.alvo?.p.id ?? 0}`;
    // a escolhida tem de estar na mão (a da mochila precisa sacar)
    const naMao = (i: number) => x.armas[i] && x.armas[i].naMao !== false;
    if (chave === this.e.chave) {
      if (!naMao(this.e.arma)) this.e.arma = Math.max(0, x.armas.findIndex((a) => a.naMao !== false));
      return;
    }
    let arma = Math.min(this.e.arma, Math.max(0, x.armas.length - 1));
    if (!naMao(arma)) arma = Math.max(0, x.armas.findIndex((a) => a.naMao !== false));
    this.e = { chave, arma, reacao: 'nenhuma', manual: {}, defesaManual: null, d20: null, d10: null, soma: null, somaExtra: null };
  }

  /** Arma escolhida (a tela usa para o anel de alcance). */
  armaEscolhida(x: CtxAtaque): ArmaOpcao | null {
    this.sincronizar(x);
    return x.armas[this.e.arma] ?? null;
  }

  // ---------------------------------------------------------------- contas

  /** As situações detectadas pelo tabuleiro e pelas condições. */
  private detectadas(x: CtxAtaque, arma: ArmaOpcao | null): Map<cb.SituacaoId, string> {
    const out = new Map<cb.SituacaoId, string>();
    const dist = !!arma?.faixa;
    const t = x.tab;
    if (t && x.alvo) {
      if (t.cobertura.tipo !== 'nenhuma') out.set('cobertura', `${t.cobertura.tipo === 'total' ? 'Cobertura total' : 'Cobertura'} (${t.cobertura.nome ?? 'obstáculo'})`);
      if (dist && t.metros !== null && arma?.faixa) {
        const m = cb.METROS_FAIXA[arma.faixa];
        if (t.metros > m && t.metros <= 2 * m) out.set('alcanceDobro', `Além do alcance ${cb.NOME_FAIXA[arma.faixa]}`);
      }
      if (dist && t.emCorpoACorpo) out.set('emCorpoACorpo', 'Alvo em corpo a corpo');
      if (!dist && t.flanqueia) out.set('flanqueando', 'Flanqueando');
      if (t.elevado) out.set('elevado', 'Posição elevada');
    }
    if (x.escuridao === 'total') out.set('camuflagemTotal', 'Escuridão');
    else if (x.escuridao === 'camuflagem' || x.nevoa !== 'nenhuma') out.set('camuflagem', x.escuridao === 'camuflagem' ? 'Iluminação baixa' : 'Névoa');
    if (x.nevoa === 'espessa' && t?.metros != null && t.metros > 1.5) out.set('camuflagemTotal', 'Névoa espessa');
    for (const c of x.alvo?.condicoes ?? []) {
      const s = cb.SITUACAO_DA_CONDICAO.alvo[c];
      if (s && !out.has(s)) out.set(s, `${cb.situacao(s).nome} (${c === 'surpreendido' ? 'surpreendido' : c.replace('-', ' ')})`);
    }
    for (const c of x.condicoesAtor) {
      const s = cb.SITUACAO_DA_CONDICAO.atacante[c];
      if (s && !out.has(s)) out.set(s, cb.situacao(s).nome);
    }
    return out;
  }

  private ativas(x: CtxAtaque, arma: ArmaOpcao | null, det: Map<cb.SituacaoId, string>): cb.SituacaoId[] {
    const ids = new Set<cb.SituacaoId>(det.keys());
    if (this.investida) ids.add('investida');
    for (const [k, v] of Object.entries(this.e.manual) as [cb.SituacaoId, boolean][]) {
      if (v) ids.add(k);
      else ids.delete(k);
    }
    // a camuflagem total engole a comum
    if (ids.has('camuflagemTotal')) ids.delete('camuflagem');
    const dist = !!arma?.faixa;
    return [...ids].filter((id) => {
      const s = cb.situacao(id);
      return !s.so || (s.so === 'distancia') === dist;
    });
  }

  private conta(x: CtxAtaque) {
    const arma = this.armaEscolhida(x);
    const det = this.detectadas(x, arma);
    const ids = this.ativas(x, arma, det);
    const alvo = x.alvo;
    const defesaBase = alvo?.defesa ?? this.e.defesaManual;
    const esquiva = this.e.reacao === 'esquiva' && alvo?.reacoes?.esquiva != null && alvo.defesa != null ? alvo.reacoes.esquiva - alvo.defesa : 0;
    const bruto = arma ? cb.montarTeste({ dados: arma.dados, penalidade: arma.penalidade ?? 0, bonus: arma.bonus, defesaBase: (defesaBase ?? 0) + esquiva, distancia: !!arma.faixa, situacoes: ids }) : null;
    // a esquiva aparece como parte da Defesa ("21 (16 + 5 esquiva)")
    const teste = bruto && esquiva ? { ...bruto, partesDefesa: [{ nome: 'esquiva', valor: esquiva }, ...bruto.partesDefesa] } : bruto;
    const res =
      arma && teste && this.e.d20 !== null && defesaBase !== null
        ? cb.resolver({ d20: this.e.d20, bonus: teste.bonus, defesa: teste.defesa, margem: arma.margem, falha: teste.falha, d10: this.e.d10 })
        : null;
    // chance de falha só importa quando acertaria
    const pedeD10 = !!teste && teste.falha > 0 && !!res && (res.acertou || res.falhou);
    const falhaPendente = pedeD10 && this.e.d10 === null;
    const acertou = !!res && res.resultado !== 'erro' && !falhaPendente;
    const mult = res?.resultado === 'critico' ? arma!.multiplicador : 1;
    const naoLetal = ids.includes('naoLetal');
    const bloqueio = this.e.reacao === 'bloqueio' ? (alvo?.reacoes?.bloqueio ?? 0) : 0;
    type Dano = { partes: cb.PartesDano; conta: cb.ContaDano; previa: ReturnType<typeof cb.previaDano> };
    let dano: Dano | null = null;
    // o que o dano faz no alvo: PV, o dano não letal à parte ou a SAN (LR p. 82, 88)
    const previa = (final: number, tipo: TipoDano, nl: boolean) => (alvo ? cb.previaDano(alvo.vitais, final, { tipo, naoLetal: nl, naoLetalAntes: alvo.p.naoLetal, agente: alvo.agente }) : null);
    if (arma && acertou && this.e.soma !== null && alvo) {
      const partes = cb.danoCritico(arma.dano, mult);
      const conta = cb.contaDano({ soma: this.e.soma, fixo: partes.fixo, tipo: arma.tipo, rd: alvo.rd, imunidades: alvo.imunidades, vulnerabilidades: alvo.vulnerabilidades });
      // o bloqueio é RD de outra fonte: soma com a do alvo (LR p. 88, 313)
      if (bloqueio && conta.final > 0) {
        const f = Math.max(0, conta.final - bloqueio);
        conta.conta = `${conta.conta} − bloqueio ${bloqueio} = ${f}`;
        conta.final = f;
      }
      dano = { partes, conta, previa: previa(conta.final, arma.tipo, naoLetal) };
    }
    // o dano a mais de outro tipo ("e 1d8 mental"): rolado à parte; no crítico, não multiplica (LR p. 82)
    let extra: Dano | null = null;
    if (arma?.extra && acertou && this.e.somaExtra !== null && alvo) {
      const partes = cb.lerDano(arma.extra.dano);
      const conta = cb.contaDano({ soma: this.e.somaExtra, fixo: partes.fixo, tipo: arma.extra.tipo, rd: alvo.rd, imunidades: alvo.imunidades, vulnerabilidades: alvo.vulnerabilidades });
      extra = { partes, conta, previa: previa(conta.final, arma.extra.tipo, false) };
    }
    return { arma, det, ids, teste, defesaBase, res, pedeD10, falhaPendente, acertou, mult, naoLetal, bloqueio, dano, extra };
  }

  /** Em que passo está (para a barra de passos). */
  passo(x: CtxAtaque): number {
    const k = this.conta(x);
    if (!k.arma) return 1;
    if (!x.alvo) return 2;
    if (k.defesaBase === null || this.e.d20 === null || k.falhaPendente) return 4;
    if (k.acertou && (this.e.soma === null || (k.arma.extra && this.e.somaExtra === null))) return 5;
    return 6;
  }

  // ---------------------------------------------------------------- desenho

  montar(x: CtxAtaque): HTMLElement {
    this.sincronizar(x);
    const k = this.conta(x);
    return h('div', { class: 'cb-atk' }, this.colArma(x), this.colSituacao(x, k), this.colRolagem(x, k), this.linhaDano(x, k));
  }

  private colArma(x: CtxAtaque): HTMLElement {
    const movimentoUsado = x.acoes.movimento || x.acoes.completa;
    const cards = x.armas.map((a, i) =>
      a.naMao === false
        ? // na mochila: não ataca; sacar gasta a ação de movimento (LR p. 54)
          h(
            'div',
            { class: 'cb-arma fora' },
            h('span', { class: 'cb-arma-ic' }, arteArma(a)),
            h('span', { class: 'cb-arma-txt' }, h('b', null, a.nome), h('small', null, `na mochila · ${a.dano}`)),
            x.sacar && a.uid !== undefined
              ? h(
                  'button',
                  {
                    class: 'cb-sacar',
                    type: 'button',
                    disabled: movimentoUsado,
                    title: movimentoUsado ? 'A ação de movimento já foi usada nesta rodada.' : 'Sacar: a arma vai para a mão (ação de movimento)',
                    onclick: () => (sfx.click(), x.sacar!(a)),
                  },
                  'Sacar',
                )
              : null,
          )
        : a.jogada
          ? this.cartaoJogada(x, a, i)
          : h(
        'button',
        {
          class: `cb-arma${i === this.e.arma ? ' on' : ''}`,
          type: 'button',
          'aria-pressed': String(i === this.e.arma),
          onclick: () => {
            sfx.click();
            this.e.arma = i;
            this.e.d20 = this.e.d10 = this.e.soma = this.e.somaExtra = null;
            x.mudou();
          },
        },
        h('span', { class: 'cb-arma-ic' }, arteArma(a)),
        i === this.e.arma
          ? h(
              'span',
              { class: 'cb-arma-txt' },
              h('b', null, a.vezes ? `${a.nome} ×${a.vezes}` : a.nome),
              h('small', null, `${a.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${textoTeste(a.dados, a.bonus, a.penalidade)} · dano ${a.dano}${a.extra ? ` e ${a.extra.dano} ${cb.NOME_TIPO_DANO[a.extra.tipo]}` : ''}`),
              h('small', null, [`${a.margem}/${JUNTA}×${a.multiplicador}`, a.faixa ? cb.NOME_FAIXA[a.faixa] : 'corpo a corpo', ...a.notas].join(' · ')),
            )
          : h(
              'span',
              { class: 'cb-arma-txt' },
              h('b', null, a.vezes ? `${a.nome} ×${a.vezes}` : a.nome),
              h('small', null, [`${a.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${textoTeste(a.dados, a.bonus, a.penalidade)}`, a.dano, a.margem < 20 ? String(a.margem) : '', a.faixa ? cb.NOME_FAIXA[a.faixa] : ''].filter(Boolean).join(' · ')),
            ),
      ),
    );
    return h(
      'section',
      { class: 'cb-col cb-col-arma' },
      h('h4', null, h('span', null, '1.'), ' ARMA'),
      h('div', { class: 'cb-col-lista cb-rola' }, ...(cards.length ? cards : [h('p', { class: 'cb-vazio' }, 'Sem ataques: crie a ficha da ameaça no painel do alvo.')])),
    );
  }

  /** A jogada pronta: o nome, o que ela soma (passo a passo) e o que o motor achou. Com erro, não escolhe. */
  private cartaoJogada(x: CtxAtaque, a: ArmaOpcao, i: number): HTMLElement {
    const jg = a.jogada!;
    const on = i === this.e.arma;
    const travada = jg.erros.length > 0;
    return h(
      'button',
      {
        class: `cb-arma cb-jogada${on ? ' on' : ''}${travada ? ' travada' : ''}`,
        type: 'button',
        disabled: travada && !on,
        'aria-pressed': String(on),
        title: travada ? jg.erros.join(' · ') : `Jogada pronta: ${jg.linhas.join('; ')}`,
        onclick: () => {
          if (travada) return;
          sfx.click();
          this.e.arma = i;
          this.e.d20 = this.e.d10 = this.e.soma = this.e.somaExtra = null;
          x.mudou();
        },
      },
      h('span', { class: 'cb-arma-ic' }, arteOu(['/arte/icones/combate-habilidade.png'], ic('estrela'))),
      h(
        'span',
        { class: 'cb-arma-txt' },
        h('b', null, jg.nome, jg.pe ? h('em', { class: 'cb-jogada-pe' }, ` ${jg.pe} PE`) : null),
        ...(on || travada ? jg.linhas.map((l) => h('small', null, l)) : [h('small', null, `${a.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${textoTeste(a.dados, a.bonus, a.penalidade)} · ${a.dano} · ${a.margem}/${JUNTA}×${a.multiplicador}`)]),
        ...jg.erros.map((e) => h('small', { class: 'cb-jogada-erro' }, '✕ ', e)),
        ...(on ? jg.avisos.map((e) => h('small', { class: 'cb-jogada-aviso' }, '! ', e)) : []),
        on && jg.nota ? h('small', { class: 'cb-jogada-nota' }, `“${jg.nota}”`) : null,
      ),
    );
  }

  private colSituacao(x: CtxAtaque, k: ReturnType<ResolucaoAtaque['conta']>): HTMLElement {
    const linhas: HTMLElement[] = [];
    const dist = !!k.arma?.faixa;
    const t = x.tab;
    // alcance e alvo (informação, sem chave)
    if (x.alvo && k.arma) {
      if (!t || t.metros === null) linhas.push(this.info('mapa', 'Alvo em outra cena: o tabuleiro não mede.', 'aviso'));
      else if (!dist) linhas.push(t.adjacente ? this.info('ok', `Corpo a corpo: alvo adjacente (${cb.textoMetros(t.metros)})`, 'bom') : this.info('alerta', `Fora do alcance corpo a corpo (${cb.textoMetros(t.metros)})`, 'ruim'));
      else {
        const m = cb.METROS_FAIXA[k.arma.faixa!];
        const fx = cb.faixaDaDistancia(t.metros);
        if (t.metros <= m) linhas.push(this.info('mira', `Alcance ${cb.NOME_FAIXA[fx ?? k.arma.faixa!]}: sem penalidade (${cb.textoMetros(t.metros)})`, 'bom'));
        else if (t.metros > 2 * m) linhas.push(this.info('alerta', `Fora do alcance: ${cb.textoMetros(t.metros)}, passa do dobro (${cb.textoMetros(2 * m)})`, 'ruim'));
      }
      if (t?.cobertura.tipo === 'total') linhas.push(this.info('escudo', `Cobertura total (${t.cobertura.nome}): não pode ser alvo`, 'ruim', 'sit-coberturaTotal'));
    }
    const vistas = new Set<cb.SituacaoId>();
    const chave = (id: cb.SituacaoId, texto: string, auto: boolean) => {
      vistas.add(id);
      const s = cb.situacao(id);
      const on = k.ids.includes(id);
      const efeito = id === 'alvoCaido' ? (dist ? '+5 na Defesa à distância' : '−5 na Defesa no corpo a corpo') : s.efeito;
      return h(
        'label',
        { class: `cb-sit${on ? ' on' : ''}`, title: `${s.nome}: ${s.efeito} (LR p. ${s.pagina})${auto ? ' · visto no tabuleiro' : ''}` },
        // a cobertura total tem o ícone dela (a parede de tijolos)
        h('span', { class: 'cb-sit-ic' }, id === 'cobertura' && x.tab?.cobertura.tipo === 'total' ? arteOu(['/arte/icones/sit-coberturaTotal.png', '/arte/icones/sit-cobertura.png'], ic('escudo')) : icSit(id)),
        h('span', { class: 'cb-sit-txt' }, `${texto}: ${efeito}`),
        auto ? h('i', { class: 'cb-visto', title: 'Visto no tabuleiro' }, ic('olho')) : h('i', { class: 'cb-visto vazio' }),
        h('input', {
          type: 'checkbox',
          class: 'cb-chave',
          checked: on,
          'aria-label': s.nome,
          onchange: (ev: Event) => {
            const v = (ev.target as HTMLInputElement).checked;
            if (v === k.det.has(id)) delete this.e.manual[id];
            else this.e.manual[id] = v;
            x.mudou();
          },
        }),
      );
    };
    for (const [id, texto] of k.det) {
      const s = cb.situacao(id);
      if (s.so && (s.so === 'distancia') !== dist) continue;
      linhas.push(chave(id, texto, true));
    }
    for (const id of MANUAIS) {
      if (vistas.has(id) || k.det.has(id)) continue;
      const s = cb.situacao(id);
      if (s.so && (s.so === 'distancia') !== dist) continue;
      linhas.push(chave(id, s.nome, false));
    }
    return h(
      'section',
      { class: 'cb-col cb-col-sit' },
      h('h4', null, h('span', null, '2.'), ' SITUAÇÃO'),
      h('div', { class: 'cb-col-lista cb-rola' }, ...linhas),
      h('small', { class: 'cb-col-pe' }, 'O olho marca o que o tabuleiro viu. Corrija nas chaves.'),
    );
  }

  private info(icone: NomeIcone, texto: string, cls: string, arte?: string) {
    return linhaInfo(icone, texto, cls, arte);
  }

  private campo(rotulo: string, valor: number | null, max: number, fn: (n: number | null) => void, foco: string, grande = false): HTMLElement {
    return campoDado(rotulo, valor, max, fn, foco, grande);
  }

  private colRolagem(x: CtxAtaque, k: ReturnType<ResolucaoAtaque['conta']>): HTMLElement {
    const corpo: (HTMLElement | null)[] = [];
    const alvo = x.alvo;
    if (!k.arma) corpo.push(h('p', { class: 'cb-vazio' }, 'Escolha a arma.'));
    else if (!alvo) corpo.push(h('p', { class: 'cb-vazio' }, 'Escolha o alvo: clique na peça do tabuleiro ou no nome da ordem.'));
    else {
      // defesa especial do alvo, antes de rolar (LR p. 88)
      const r = alvo.reacoes;
      if (alvo.agente && r && !alvo.p.reacao && (r.esquiva != null || (r.bloqueio != null && !k.arma.faixa))) {
        const op = (id: Estado['reacao'], rot: string) =>
          h(
            'button',
            {
              class: `cb-reacao${this.e.reacao === id ? ' on' : ''}`,
              type: 'button',
              onclick: () => {
                sfx.click();
                this.e.reacao = id;
                x.mudou();
              },
            },
            rot,
          );
        corpo.push(
          h(
            'div',
            { class: 'cb-reacoes', title: 'Defesa especial: uma por rodada, declarada antes de o atacante rolar (LR p. 88)' },
            h('small', null, `Reação de ${alvo.p.nome}:`),
            op('nenhuma', 'Nenhuma'),
            r.esquiva != null && alvo.defesa != null ? op('esquiva', `Esquiva +${r.esquiva - alvo.defesa}`) : null,
            r.bloqueio != null && !k.arma.faixa ? op('bloqueio', `Bloqueio RD ${r.bloqueio}`) : null,
          ),
        );
      } else if (alvo.agente && alvo.p.reacao) corpo.push(h('small', { class: 'cb-nota-mini' }, `${alvo.p.nome} já usou a defesa especial nesta rodada.`));
      if (k.defesaBase === null)
        corpo.push(
          h(
            'div',
            { class: 'cb-linha-dado' },
            this.campo('Defesa do alvo', this.e.defesaManual, 99, (n) => ((this.e.defesaManual = n), x.mudou()), 'atk:def'),
            h('small', { class: 'cb-nota-mini' }, 'Sem ficha: digite a Defesa (ou crie a ficha no painel do alvo).'),
          ),
        );
      if (k.teste) {
        corpo.push(h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, cb.textoRolagem(k.teste.dados, k.teste.bonus, k.teste.penalidade))));
        const res = k.res;
        const carimbo = res && !k.falhaPendente ? this.carimbo(res.resultado, k.mult) : null;
        corpo.push(h('div', { class: 'cb-linha-dado' }, this.campo('d20 que ficou', this.e.d20, 20, (n) => ((this.e.d20 = n && n >= 1 ? n : null), (this.e.d10 = null), (this.e.soma = this.e.somaExtra = null), x.mudou()), 'atk:d20', true)));
        if (carimbo) corpo.push(carimbo);
        if (res && k.defesaBase !== null) corpo.push(h('p', { class: 'cb-total' }, `Total ${res.total} vs Defesa ${cb.textoDefesa(k.teste, k.defesaBase)}${this.e.d20 === 20 ? ' · 20 natural' : ''}`));
        if (k.pedeD10) {
          // d10 nas dezenas; os 75% (o teto da soma) não cabem no d10: 1 a 3 no d4 (LR p. 89, 313)
          const { faces, ate } = cb.dadoDaFalha(k.teste.falha);
          corpo.push(
            h(
              'div',
              { class: 'cb-linha-dado falha' },
              this.campo(`d${faces} da falha (${k.teste.falha}%)`, this.e.d10, faces, (n) => ((this.e.d10 = n && n >= 1 ? n : null), x.mudou()), 'atk:d10'),
              h('small', null, this.e.d10 === null ? `Falha com 1${ate > 1 ? ` a ${ate}` : ''} no d${faces}.` : `d${faces} = ${this.e.d10} · ${res?.falhou ? 'falhou' : 'não falhou'}`),
            ),
          );
        }
      }
    }
    return h('section', { class: 'cb-col cb-col-rol' }, h('h4', null, h('span', null, '3.'), ' ROLAGEM'), h('div', { class: 'cb-col-corpo cb-rola' }, ...corpo));
  }

  /** Desfazer (volta um passo da rolagem) e Confirmar ação (aplica o dano e escreve no registro). */
  private botoesFinais(x: CtxAtaque, k: ReturnType<ResolucaoAtaque['conta']>, pronto: boolean) {
    const arma = k.arma;
    const alvo = x.alvo;
    const desfazer = h(
      'button',
      {
        class: 'cb-bt claro',
        type: 'button',
        disabled: this.e.d20 === null && this.e.soma === null && this.e.d10 === null,
        title: 'Volta um passo da rolagem',
        onclick: () => {
          sfx.click();
          if (this.e.somaExtra !== null) this.e.somaExtra = null;
          else if (this.e.soma !== null) this.e.soma = null;
          else if (this.e.d10 !== null) this.e.d10 = null;
          else this.e.d20 = null;
          x.mudou();
        },
      },
      ic('girarE'),
      h('span', null, 'Desfazer'),
    );
    // o "×2" da ameaça deixa mais ataques na mesma ação padrão
    const semAcao = x.acoes.completa || (x.acoes.padrao && !k.ids.includes('investida') && !x.acoes.golpes);
    const confirmar = h(
      'button',
      {
        class: 'cb-bt forte',
        type: 'button',
        disabled: !pronto || semAcao || !!arma?.jogada?.erros.length,
        title: semAcao ? 'A ação padrão deste turno já foi usada' : 'Aplica o dano e escreve no registro',
        onclick: () => {
          if (!arma || !alvo || !k.res || !k.teste) return;
          sfx.click();
          const ataque: cb.AtaqueConfirmado = {
            quem: x.ator.id,
            alvo: alvo.p.id,
            arma: arma.nome,
            qual: k.ids.includes('investida') ? 'completa' : 'padrao',
            teste: { dados: k.teste.dados, bonus: k.teste.bonus, d20: this.e.d20!, total: k.res.total, defesa: k.teste.defesa },
            situacoes: k.teste.ativas.map((s) => s.nome.toLowerCase()),
            resultado: k.res.resultado,
            ...(k.res.resultado === 'critico' ? { multiplicador: k.mult } : {}),
            ...(k.pedeD10 && this.e.d10 !== null ? { falha: { chance: k.teste.falha, d10: this.e.d10, falhou: k.res.falhou } } : {}),
            ...(this.e.reacao !== 'nenhuma' ? { reacao: this.e.reacao } : {}),
            ...(k.dano
              ? {
                  dano: {
                    formula: cb.textoFormula(k.dano.partes),
                    soma: this.e.soma!,
                    total: k.dano.conta.total,
                    tipo: arma.tipo,
                    conta: k.dano.conta.conta,
                    final: k.dano.conta.final,
                    ...(k.naoLetal ? { naoLetal: true } : {}),
                  },
                }
              : {}),
            ...(k.extra && arma.extra
              ? {
                  danoExtra: {
                    formula: cb.textoFormula(k.extra.partes),
                    soma: this.e.somaExtra!,
                    total: k.extra.conta.total,
                    tipo: arma.extra.tipo,
                    conta: k.extra.conta.conta,
                    final: k.extra.conta.final,
                  },
                }
              : {}),
            ...(k.res.resultado === 'erro' && !arma.faixa && alvo.agente && alvo.reacoes?.contraAtaque && !alvo.p.reacao ? { contraAtaque: true } : {}),
            ...(arma.vezes ? { vezes: arma.vezes } : {}),
            ...(arma.jogada ? { jogada: { nome: arma.jogada.nome, pe: arma.jogada.pe } } : {}),
          };
          x.enviar({ tipo: 'ataque', ataque });
          this.e.d20 = this.e.d10 = this.e.soma = this.e.somaExtra = null;
          this.e.reacao = 'nenhuma';
          this.e.manual = {};
          x.mudou();
        },
      },
      ic('ok'),
      h('span', null, 'Confirmar ação'),
    );
    return { desfazer, confirmar };
  }

  /** Pronto para confirmar: rolou, e, se acertou, o dano está digitado. */
  private pronto(x: CtxAtaque, k: ReturnType<ResolucaoAtaque['conta']>) {
    if (!k.arma || !x.alvo || !k.res || k.falhaPendente) return false;
    if (!k.acertou) return true;
    return !!k.dano && (!k.arma.extra || !!k.extra);
  }

  // ---------------------------------------------------------------- o ataque rápido (08/10)

  /** A arma escolhida no menu de ataque (a investida liga a situação dela). Zera a rolagem. */
  escolher(i: number, investida = false) {
    this.e.arma = i;
    this.investida = investida;
    this.e.d20 = this.e.d10 = this.e.soma = this.e.somaExtra = null;
    this.e.reacao = 'nenhuma';
    this.e.manual = {};
    this.maisSituacoes = false;
  }

  /** O alvo está onde a arma alcança? (null = dá para atacar; o texto = por que não) */
  private foraDoAlcance(x: CtxAtaque, arma: ArmaOpcao): string | null {
    const t = x.tab;
    if (!t || t.metros === null) return null;
    if (t.cobertura.tipo === 'total') return `Cobertura total (${t.cobertura.nome ?? 'obstáculo'}): não dá para mirar.`;
    // a investida anda até o dobro do deslocamento antes do golpe: não trava pela distância
    if (!arma.faixa) return t.adjacente || this.investida ? null : `Longe demais para o corpo a corpo (${cb.textoMetros(t.metros)}). Use Movimento ou a Investida.`;
    const m = cb.METROS_FAIXA[arma.faixa];
    return t.metros > 2 * m ? `Fora do alcance: ${cb.textoMetros(t.metros)}, passa do dobro (${cb.textoMetros(2 * m)}).` : null;
  }

  /**
   * O ataque em dois cartões (pedido do Felipe): primeiro EM QUEM, o que vale e o d20 que ficou na mesa; acertou,
   * o cartão do DANO: quem apanha (o retrato, a vida de agora e a que vai ficar), a soma que o jogador falou e a
   * conta explicada (o tipo de cada parte, a resistência, a imunidade). Os dados são sempre físicos: a tela só faz
   * a conta. Fora do alcance, trava.
   */
  montarRapido(x: CtxAtaque): HTMLElement {
    this.sincronizar(x);
    const k = this.conta(x);
    const arma = k.arma;
    const alvo = x.alvo;
    const dist = !!arma?.faixa;
    const partes: (HTMLElement | null)[] = [];
    if (!arma) return h('div', { class: 'atq' }, h('p', { class: 'atq-vazio' }, 'Sem ataque escolhido.'));

    // a arma escolhida, numa linha (trocar volta ao menu de ataque)
    partes.push(
      h(
        'div',
        { class: 'atq-escolhida' },
        h('span', { class: 'atq-arma-ic' }, arma.jogada ? arteOu(['/arte/icones/combate-habilidade.png'], ic('estrela')) : arteArma(arma)),
        h(
          'div',
          null,
          h('b', null, this.investida ? `Investida com ${arma.nome}` : arma.jogada ? arma.jogada.nome : arma.nome),
          h('small', null, `${arma.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${textoTeste(arma.dados, arma.bonus, arma.penalidade)} · dano ${arma.dano}${arma.extra ? ` e ${arma.extra.dano} ${cb.NOME_TIPO_DANO[arma.extra.tipo]}` : ''} · crítico ${arma.margem}/${JUNTA}×${arma.multiplicador} · ${arma.faixa ? cb.NOME_FAIXA[arma.faixa] : 'corpo a corpo'}`),
        ),
      ),
    );

    // sem alvo: o chamado para clicar no mapa
    if (!alvo) {
      partes.push(h('div', { class: 'atq-bloco atq-chama' }, ic('mira'), h('div', null, h('b', null, 'Clique no alvo no mapa'), h('small', null, 'ou no nome dele na ordem de iniciativa'))));
      return h('div', { class: 'atq' }, h('div', { class: 'atq-corpo' }, ...partes));
    }

    const fora = this.foraDoAlcance(x, arma);
    const acertou = !!k.res && k.acertou && !k.falhaPendente;

    // ---------- o cartão do dano (depois de acertar)
    if (acertou && k.teste && k.res) {
      partes.push(
        h(
          'div',
          { class: 'atq-resumo' },
          this.carimbo(k.res.resultado, k.mult),
          h('span', null, `${k.res.total} contra Defesa ${k.teste.defesa}${this.e.d20 === 20 ? ' · 20 natural' : ''}`),
          h('button', { class: 'atq-link', type: 'button', onclick: () => (sfx.click(), (this.e.d20 = this.e.d10 = this.e.soma = this.e.somaExtra = null), x.mudou()) }, 'corrigir o d20'),
        ),
      );
      // quem apanha: o retrato, a vida de agora e a que vai ficar
      const v = alvo.vitais;
      const naVida = [k.dano, k.extra].filter((d, i) => d && (i === 0 ? arma.tipo : arma.extra?.tipo) !== 'mental' && !(i === 0 && k.naoLetal)).reduce((s, d) => s + (d ? d.conta.final : 0), 0);
      const depois = v ? Math.max(0, v.pv - naVida) : null;
      const pct = (n: number) => (v && v.pvMax ? Math.max(0, Math.min(1, n / v.pvMax)) : 0);
      partes.push(
        h(
          'div',
          { class: 'atq-bloco atq-vitima' },
          h('span', { class: 'atq-vitima-foto' }, x.retrato?.(alvo.p.id, 80) ?? null),
          h(
            'div',
            { class: 'atq-vitima-info' },
            h('b', null, alvo.p.nome),
            v
              ? h(
                  'div',
                  { class: 'atq-vida' },
                  h('span', { class: 'atq-vida-barra', style: `--agora:${pct(v.pv)};--depois:${pct(depois ?? v.pv)}` }, h('i', { class: 'agora' }), h('i', { class: 'depois' })),
                  h('span', { class: 'atq-vida-n' }, h('strong', null, String(v.pv)), naVida && depois !== null ? h('em', null, ` → ${depois}`) : null, h('small', null, ` / ${v.pvMax} PV`)),
                )
              : h('small', null, 'Sem PV marcados: o dano vai só para o registro.'),
            alvo.imunidades.length || Object.keys(alvo.rd).length || alvo.vulnerabilidades.length
              ? h(
                  'div',
                  { class: 'atq-resist' },
                  ...alvo.imunidades.map((t) => h('span', { class: 'imune' }, `imune a ${cb.NOME_TIPO_DANO[t] ?? t}`)),
                  ...Object.entries(alvo.rd).map(([t, n]) => h('span', { class: 'rd' }, `resiste ${n} a ${cb.NOME_TIPO_DANO[t as TipoDano] ?? t}`)),
                  ...alvo.vulnerabilidades.map((t) => h('span', { class: 'vuln' }, `vulnerável a ${cb.NOME_TIPO_DANO[t] ?? t}`)),
                )
              : null,
          ),
        ),
      );
      // a soma do dano e a conta explicada
      const ex = arma.extra;
      const linhaConta = (nome: string, tipo: TipoDano, soma: number | null, d: typeof k.dano) =>
        d
          ? h(
              'div',
              { class: 'atq-parte' },
              h('span', { class: 'atq-parte-nome' }, h('b', null, nome), h('small', null, cb.NOME_TIPO_DANO[tipo] ?? tipo)),
              h('span', { class: 'atq-parte-conta' }, `${soma ?? 0} nos dados${d.partes.fixo ? ` + ${d.partes.fixo}` : ''} = ${d.conta.total}`, d.conta.conta !== String(d.conta.total) ? h('small', null, d.conta.conta) : null),
              h('strong', { class: `atq-parte-final${d.conta.final < d.conta.total ? ' menos' : ''}` }, String(d.conta.final)),
            )
          : null;
      const total = (k.dano?.conta.final ?? 0) + (k.extra?.conta.final ?? 0);
      partes.push(
        h(
          'div',
          { class: 'atq-bloco atq-dano' },
          h('div', { class: 'atq-rotulo' }, 'Quanto deu o dano?', h('small', null, ` · ${cb.textoDano(arma.dano, k.mult)}${ex ? `; à parte, ${ex.dano} ${cb.NOME_TIPO_DANO[ex.tipo]}` : ''}`)),
          h(
            'div',
            { class: 'atq-linha' },
            this.campo('soma dos dados', this.e.soma, 999, (n) => ((this.e.soma = n), x.mudou()), 'atk:dano', true),
            ex ? this.campo(`soma ${cb.NOME_TIPO_DANO[ex.tipo]}`, this.e.somaExtra, 999, (n) => ((this.e.somaExtra = n), x.mudou()), 'atk:extra', true) : null,
          ),
          k.dano
            ? h(
                'div',
                { class: 'atq-contas' },
                linhaConta(arma.nome, arma.tipo, this.e.soma, k.dano),
                ex ? linhaConta(`${arma.nome} (à parte)`, ex.tipo, this.e.somaExtra, k.extra) : null,
                h('div', { class: 'atq-total-dano' }, h('span', null, `${alvo.p.nome} toma`), h('strong', null, String(total)), h('span', null, k.naoLetal ? 'de dano não letal' : 'de dano')),
                ...[k.dano, k.extra].filter((d) => d?.previa?.massivo).map((d) => h('p', { class: 'atq-efeito ruim' }, `Dano massivo: Fortitude DT ${d!.previa!.massivo} (LR p. 88)`)),
                alvo.p.sustenta ? h('p', { class: 'atq-efeito' }, `${alvo.p.nome} sustenta ${alvo.p.sustenta}: o dano pode quebrar.`) : null,
              )
            : null,
        ),
      );
      const { desfazer, confirmar } = this.botoesFinais(x, k, this.pronto(x, k));
      return h('div', { class: 'atq' }, h('div', { class: 'atq-corpo' }, ...partes), h('div', { class: 'atq-fim' }, desfazer, confirmar));
    }

    // ---------- o primeiro cartão: em quem, o que vale e o d20
    const t = x.tab;
    let alcance: [string, string] = ['', ''];
    if (!t || t.metros === null) alcance = ['aviso', 'em outra cena'];
    else if (!dist) alcance = t.adjacente ? ['bom', `adjacente (${cb.textoMetros(t.metros)})`] : ['ruim', `longe (${cb.textoMetros(t.metros)})`];
    else {
      const m = cb.METROS_FAIXA[arma.faixa!];
      alcance = t.metros <= m ? ['bom', `no alcance (${cb.textoMetros(t.metros)})`] : t.metros <= 2 * m ? ['aviso', `além do alcance (${cb.textoMetros(t.metros)})`] : ['ruim', `fora do alcance (${cb.textoMetros(t.metros)})`];
    }
    partes.push(
      h(
        'div',
        { class: 'atq-bloco atq-alvo' },
        h('div', { class: 'atq-rotulo' }, 'Em quem'),
        h(
          'div',
          { class: 'atq-alvo-linha' },
          h('span', { class: 'atq-alvo-foto' }, x.retrato?.(alvo.p.id, 48) ?? null),
          h('b', null, alvo.p.nome),
          k.defesaBase !== null ? h('span', { class: 'atq-def' }, `Defesa ${k.teste ? cb.textoDefesa(k.teste, k.defesaBase) : k.defesaBase}`) : null,
          alcance[1] ? h('span', { class: `atq-alcance ${alcance[0]}` }, alcance[1]) : null,
        ),
        k.defesaBase === null ? h('div', { class: 'atq-linha' }, this.campo('Defesa do alvo', this.e.defesaManual, 99, (n) => ((this.e.defesaManual = n), x.mudou()), 'atk:def'), h('small', null, 'Sem ficha: digite a Defesa.')) : null,
      ),
    );
    if (fora) {
      partes.push(h('div', { class: 'atq-bloco atq-trava' }, ic('alerta'), h('div', null, h('b', null, 'Não dá para atacar daqui'), h('small', null, fora))));
      return h('div', { class: 'atq' }, h('div', { class: 'atq-corpo' }, ...partes));
    }

    // o que vale: etiquetas (tocar tira); o "+" mostra as de marcar à mão
    const etq = k.ids.map((id) => {
      const st = cb.situacao(id);
      const efeito = id === 'alvoCaido' ? (dist ? '+5 na Defesa' : '−5 na Defesa') : st.efeito;
      return h(
        'button',
        {
          class: `atq-sit${k.det.has(id) ? ' auto' : ''}`,
          type: 'button',
          title: `${st.nome}: ${st.efeito} (LR p. ${st.pagina})${k.det.has(id) ? ' · o mapa viu' : ''}. Tocar tira.`,
          onclick: () => {
            sfx.click();
            if (id === 'investida') this.investida = false;
            else if (k.det.has(id)) this.e.manual[id] = false;
            else delete this.e.manual[id];
            x.mudou();
          },
        },
        h('span', { class: 'atq-sit-ic' }, id === 'cobertura' && x.tab?.cobertura.tipo === 'total' ? arteOu(['/arte/icones/sit-coberturaTotal.png'], ic('escudo')) : icSit(id)),
        h('span', null, h('b', null, k.det.get(id) ?? st.nome), h('small', null, efeito)),
        h('i', { class: 'atq-x', 'aria-hidden': 'true' }, '×'),
      );
    });
    const paraMarcar = [...new Set([...k.det.keys(), ...MANUAIS])].filter((id) => id !== 'investida' && !k.ids.includes(id) && (!cb.situacao(id).so || (cb.situacao(id).so === 'distancia') === dist));
    partes.push(
      h(
        'div',
        { class: 'atq-bloco' },
        h('div', { class: 'atq-rotulo' }, 'O que vale', h('small', null, etq.length ? ' · o mapa achou; tocar tira' : ' · nada especial neste ataque')),
        h(
          'div',
          { class: 'atq-sits' },
          ...etq,
          h('button', { class: `atq-mais${this.maisSituacoes ? ' on' : ''}`, type: 'button', title: 'Marcar outra situação à mão', onclick: () => (sfx.click(), (this.maisSituacoes = !this.maisSituacoes), x.mudou()) }, this.maisSituacoes ? '− fechar' : '+ situação'),
        ),
        this.maisSituacoes
          ? h(
              'div',
              { class: 'atq-sits atq-sits-mais' },
              ...paraMarcar.map((id) =>
                h(
                  'button',
                  {
                    class: 'atq-sit livre',
                    type: 'button',
                    title: `${cb.situacao(id).nome}: ${cb.situacao(id).efeito}`,
                    onclick: () => {
                      sfx.click();
                      if (k.det.has(id)) delete this.e.manual[id];
                      else this.e.manual[id] = true;
                      x.mudou();
                    },
                  },
                  h('span', { class: 'atq-sit-ic' }, icSit(id)),
                  h('span', null, h('b', null, cb.situacao(id).nome), h('small', null, cb.situacao(id).efeito)),
                ),
              ),
            )
          : null,
      ),
    );

    // a reação do alvo (agente treinado), antes de rolar
    const r = alvo.reacoes;
    if (alvo.agente && r && !alvo.p.reacao && (r.esquiva != null || (r.bloqueio != null && !dist))) {
      const op = (id: Estado['reacao'], rot: string) =>
        h('button', { class: `atq-reacao${this.e.reacao === id ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), (this.e.reacao = id), x.mudou()) }, rot);
      partes.push(
        h(
          'div',
          { class: 'atq-bloco atq-linha' },
          h('div', { class: 'atq-rotulo' }, `${alvo.p.nome} reage?`),
          op('nenhuma', 'Não'),
          r.esquiva != null && alvo.defesa != null ? op('esquiva', `Esquiva +${r.esquiva - alvo.defesa}`) : null,
          r.bloqueio != null && !dist ? op('bloqueio', `Bloqueio RD ${r.bloqueio}`) : null,
        ),
      );
    }

    // o d20 que ficou na mesa (e o d10 da camuflagem)
    if (k.teste && k.defesaBase !== null) {
      const res = k.res;
      partes.push(
        h(
          'div',
          { class: 'atq-bloco atq-rola' },
          h('div', { class: 'atq-rotulo' }, 'Rolou na mesa', h('small', null, ` · ${cb.textoRolagem(k.teste.dados, k.teste.bonus, k.teste.penalidade)}`)),
          h(
            'div',
            { class: 'atq-linha' },
            this.campo('d20 que ficou', this.e.d20, 20, (n) => ((this.e.d20 = n && n >= 1 ? n : null), (this.e.d10 = null), (this.e.soma = this.e.somaExtra = null), x.mudou()), 'atk:d20', true),
            res && !k.falhaPendente ? this.carimbo(res.resultado, k.mult) : null,
            res ? h('small', { class: 'atq-total' }, `${res.total} contra ${k.teste.defesa}${this.e.d20 === 20 ? ' · 20 natural' : ''}`) : null,
          ),
          k.pedeD10
            ? (() => {
                const { faces, ate } = cb.dadoDaFalha(k.teste!.falha);
                return h(
                  'div',
                  { class: 'atq-linha' },
                  this.campo(`d${faces} da falha (${k.teste!.falha}%)`, this.e.d10, faces, (n) => ((this.e.d10 = n && n >= 1 ? n : null), x.mudou()), 'atk:d10'),
                  h('small', null, this.e.d10 === null ? `Camuflagem: falha com 1${ate > 1 ? ` a ${ate}` : ''} no d${faces}.` : res?.falhou ? 'A camuflagem desviou o golpe.' : 'Passou pela camuflagem.'),
                );
              })()
            : null,
        ),
      );
    }
    // errou: o aviso, e confirma para o registro
    if (k.res && !k.falhaPendente && !k.acertou) {
      const contra = !dist && alvo.agente && alvo.reacoes?.contraAtaque && !alvo.p.reacao;
      partes.push(h('div', { class: 'atq-bloco atq-errou' }, h('b', null, k.res.falhou ? 'A camuflagem desviou: sem dano.' : 'Errou: sem dano.'), contra ? h('small', null, `${alvo.p.nome} pode contra-atacar.`) : null));
    }
    const { desfazer, confirmar } = this.botoesFinais(x, k, this.pronto(x, k));
    return h('div', { class: 'atq' }, h('div', { class: 'atq-corpo' }, ...partes), h('div', { class: 'atq-fim' }, desfazer, confirmar));
  }

  private carimbo(r: cb.ResultadoAtaque, mult: number): HTMLElement {
    const texto = r === 'erro' ? 'ERROU' : r === 'critico' ? `ACERTO CRÍTICO ×${mult}` : 'ACERTO';
    return h('span', { class: `cb-carimbo ${r}`, role: 'status' }, h('span', null, texto));
  }

  private linhaDano(x: CtxAtaque, k: ReturnType<ResolucaoAtaque['conta']>): HTMLElement {
    const alvo = x.alvo;
    const partes: (HTMLElement | null)[] = [];
    const arma = k.arma;
    let pronto = false;
    let instrucao: HTMLElement | null = null;
    if (!arma || !alvo || !k.res || k.falhaPendente) partes.push(h('p', { class: 'cb-vazio' }, 'O dano aparece depois da rolagem.'));
    else if (!k.acertou) {
      pronto = true;
      const contra = !arma.faixa && alvo.agente && alvo.reacoes?.contraAtaque && !alvo.p.reacao;
      partes.push(h('p', { class: 'cb-dano-conta' }, h('b', null, k.res.falhou ? 'A camuflagem desviou o golpe: sem dano.' : 'Errou: sem dano.'), contra ? h('span', { class: 'alerta' }, ` ${alvo.p.nome} pode contra-atacar.`) : null));
    } else {
      const ex = arma.extra;
      instrucao = h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, `${cb.textoDano(arma.dano, k.mult)}${ex ? `; à parte, ${ex.dano} ${cb.NOME_TIPO_DANO[ex.tipo]}` : ''}`));
      partes.push(this.campo('soma dos dados', this.e.soma, 999, (n) => ((this.e.soma = n), x.mudou()), 'atk:dano', true));
      if (ex) partes.push(this.campo(`soma do ${ex.dano} ${cb.NOME_TIPO_DANO[ex.tipo]}`, this.e.somaExtra, 999, (n) => ((this.e.somaExtra = n), x.mudou()), 'atk:extra'));
      if (k.dano && (!ex || k.extra)) {
        pronto = true;
        const nome = alvo.p.nome;
        const linhas: HTMLElement[] = [];
        for (const d of [k.dano, k.extra]) {
          if (!d) continue;
          linhas.push(h('span', null, d.conta.conta));
          linhas.push(h('span', { class: 'alerta' }, d.previa ? `${nome}: ${d.previa.texto}` : `${nome} não tem PV marcados: o dano só vai para o registro.`));
          if (d.previa?.massivo) linhas.push(h('span', { class: 'alerta' }, `Dano massivo: Fortitude DT ${d.previa.massivo} (LR p. 88)`));
        }
        if (alvo.p.sustenta) linhas.push(h('span', { class: 'alerta' }, `Sustenta ${alvo.p.sustenta}.`));
        partes.push(h('div', { class: 'cb-dano-conta' }, ...linhas));
      }
    }
    const { desfazer, confirmar } = this.botoesFinais(x, k, pronto);
    return h(
      'section',
      { class: 'cb-dano' },
      h('div', { class: 'cb-dano-cab' }, h('h4', null, h('span', null, '4.'), ' DANO'), instrucao),
      h('div', { class: 'cb-dano-corpo' }, ...partes),
      h('div', { class: 'cb-dano-botoes' }, desfazer, confirmar),
    );
  }
}
