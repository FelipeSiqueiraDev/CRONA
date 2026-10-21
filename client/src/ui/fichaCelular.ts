/**
 * A ficha do jogador no celular (a engrenagem da tela do jogador): cartões grandes, só os
 * máximos (os pontos de agora ficam no modo jogo) e cada cartão abre uma janela ampla para
 * mexer, com as regras do motor amarradas.
 *
 * O jogador não faz o que quer:
 * - atributo da criação: só gasta o ponto que falta (redistribuir o que já foi gasto é com o mestre);
 * - o resto (origem, classe, trilha, poderes, perícias, aumentos do NEX) vem pelas pendências, com as
 *   opções do livro liberadas ou travadas com o motivo;
 * - o servidor ainda recusa a ficha do jogador que traga mais erros de regra do que tinha.
 * Cada janela mexe numa cópia; Salvar manda, fechar descarta.
 */
import { NOME_TEMA, TEMAS, regras, type FichaSalva, type Tema } from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import { sprites } from '../render/sprites';
import type { App } from './app';
import { h, toast } from './dom';
import { botao, escolher, janela } from './fichaModal';
import { escolherCampo, escolherPendencia, GRAU_CURTO, infoItem, NOME_ATR, NOME_GRAU, periciasCriacao, podeMudarAtributo, pontosAtributo, textoTeste, type Campo } from './fichaRegras';
import { abrirRequisicao } from './requisicao';
import { arteDoItem } from './arteItem';
import { arte, arteOu, ic, type NomeIcone } from './icons';
import { sfx } from './sfx';
import { vestirTema } from './temaUi';
import { faixaAtributos } from './jogador';

type Calc = regras.Calculado;
const cat = regras.catalogo;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const numero = (n: number) => String(n).replace('.', ',');
const ICONE_ATR: Record<regras.AtributoId, NomeIcone> = { agi: 'correr', for: 'punho', int: 'cerebro', pre: 'olho', vig: 'escudo' };
const pintado = (nome: string, icone: NomeIcone) => arteOu([`/arte/icones/${nome}.png`], ic(icone));

function calcular(f: regras.Ficha): Calc | null {
  try {
    return regras.calcular(f);
  } catch {
    return null;
  }
}

export class FichaCelular {
  readonly el: HTMLElement;
  private fs: FichaSalva | null = null;
  private calc: Calc | null = null;
  private corpo = h('main', { class: 'fc-corpo' });

  constructor(
    private app: App,
    voltar: () => void,
    /** abre o item no mesmo modal da aba Mochila */
    private abrirItem: (uid: number) => void,
  ) {
    const topo = h(
      'header',
      { class: 'fc-topo' },
      h('button', { class: 'fc-voltar', type: 'button', onclick: () => (sfx.click(), voltar()) }, ic('esquerda'), h('span', null, 'Jogo')),
      h('h1', null, 'FICHA'),
      h('span', { class: 'fc-esp' }),
    );
    this.el = h('div', { class: 'fc hidden' }, topo, this.corpo);
  }

  setFicha(fs: FichaSalva | null) {
    this.fs = fs ? clone(fs) : null;
    this.render();
    this.subida?.();
  }

  /** a janela da subida de NEX aberta: redesenha quando a ficha volta do servidor */
  private subida: (() => void) | null = null;
  /** o jogador fechou a janela nesta visita (volta na próxima vez que entrar) */
  private subidaFechada = false;
  /** a lista saiu da frente para uma escolha (volta quando ela fecha) */
  private escolhendo = false;

  /** As escolhas que o jogador faz sozinho ao subir de NEX (as da criação são com o mestre). */
  private pendenciasDaSubida(): regras.Pendencia[] {
    if (!this.fs) return [];
    // a perícia que repetiu (classe e origem dão a mesma) é escolha dele; o resto das perícias da criação é com o mestre
    return regras.calcular(this.fs.ficha).pendencias.filter((p) => p.tipo !== 'atributos' && (p.tipo !== 'pericias' || /^Escolha mais/.test(p.texto)));
  }

  /** Subiu de NEX e ainda não viu o aviso (`nexVisto` menor que o NEX da ficha). */
  private evoluiuSemVer(): boolean {
    const f = this.fs?.ficha;
    return !!f && f.nexVisto !== undefined && f.nex > f.nexVisto;
  }

  /**
   * A subida de NEX (19/10, o Felipe: "quando eles entrarem, uma mensagem: parece que você está mais forte e precisa
   * tomar decisões; a lista do que decidir, clica, escolhe, confirma e volta pra lista até acabar"; 21/10: "mesmo que não
   * tenha nada pra escolher, um aviso de que evoluiu, com o que o livro dá"). Abre no login, sozinha: para cada NEX
   * subido, o que o livro dá (PV, PE, SAN, habilidades) e o que o jogador escolhe; acabando as escolhas, fica o resumo
   * e o "Entendi", que marca o NEX como visto. Depois, uma vez, o aviso de refazer o equipamento.
   */
  verificarSubida() {
    if (this.subida || !this.fs) return;
    if (!this.pendenciasDaSubida().length && !this.evoluiuSemVer()) return this.verificarEquipamento();
    if (this.subidaFechada) return;
    const j = janela('VOCÊ EVOLUIU', 'estrela', () => {
      this.subida = null;
      if (this.escolhendo) return;
      if (this.pendenciasDaSubida().length || this.evoluiuSemVer()) this.subidaFechada = true;
      else this.verificarEquipamento();
    }, 46);
    j.el.classList.add('fc-subida');
    const pintar = () => {
      const fs = this.fs!;
      const pend = this.pendenciasDaSubida();
      const de = fs.ficha.nexVisto;
      const passos = de !== undefined && fs.ficha.nex > de ? regras.resumoEvolucao(fs.ficha, de as regras.Nex) : [];
      if (!pend.length && !passos.length) return j.fechar();
      const r = clone(fs);
      const botaoPend = (p: regras.Pendencia) => {
        const e = escolherPendencia(r.ficha, p);
        return h(
          'button',
          {
            class: 'fc-pend',
            type: 'button',
            disabled: !e,
            title: e ? 'Abre as opções do livro' : 'Essa escolha é com o mestre',
            // a lista sai da frente enquanto ele escolhe e volta depois (a escolha abria por trás dela)
            onclick: () => {
              if (!e) return;
              this.escolhendo = true;
              j.fechar();
              void escolher(e, () => this.salvar(r)).then(() => {
                this.escolhendo = false;
                this.verificarSubida();
              });
            },
          },
          h('span', { class: 'fc-pend-txt' }, p.texto),
          e ? ic('direita') : h('small', null, 'com o mestre'),
        );
      };
      const soma = (n: number) => (n > 0 ? ` (+${n})` : '');
      const cartaoPasso = (ps: regras.PassoEvolucao) => {
        const doNex = pend.filter((p) => p.nex === ps.nex);
        const sozinhos = ps.ganhos.filter((g) => !g.escolha);
        const aEscolher = ps.ganhos.filter((g) => g.escolha);
        return h(
          'section',
          { class: 'fc-evo-passo' },
          h('h4', { class: 'fc-subida-nex' }, `NEX ${ps.nex}%`),
          h(
            'p',
            { class: 'fc-evo-nums' },
            h('span', null, `PV ${ps.pv.total}${soma(ps.pv.mais)}`),
            h('span', null, `PE ${ps.pe.total}${soma(ps.pe.mais)}`),
            h('span', null, `SAN ${ps.san.total}${soma(ps.san.mais)}`),
            h('span', null, `${ps.limitePe} PE por turno`),
          ),
          ...(sozinhos.length
            ? [
                h('p', { class: 'fc-evo-rot' }, 'O livro dá sozinho'),
                h('ul', { class: 'fc-evo-lista' }, ...sozinhos.map((g) => h('li', null, h('b', null, g.titulo), g.texto ? ` ${g.texto}` : '', g.ref ? h('small', null, ` ${regras.textoRef(g.ref)}`) : null))),
              ]
            : []),
          ...(aEscolher.length || doNex.length
            ? [
                h('p', { class: 'fc-evo-rot' }, 'Você escolhe'),
                ...(doNex.length ? [h('div', { class: 'fc-pends' }, ...doNex.map(botaoPend))] : [h('p', { class: 'fj-dica' }, 'Já escolhido.')]),
              ]
            : [h('p', { class: 'fj-dica' }, sozinhos.some((g) => g.mestre) ? 'Nada a escolher aqui: o que está acima entra sozinho, e a alteração do Monstruoso o mestre aplica com você.' : 'Neste NEX o livro não pede escolha: o que está acima entra sozinho.')]),
        );
      };
      const avulsas = pend.filter((p) => !passos.some((ps) => ps.nex === p.nex));
      const avulsasPorNex = [...new Set(avulsas.map((p) => p.nex))].sort((x, y) => x - y);
      j.corpo.replaceChildren(
        h('p', { class: 'fc-subida-intro' }, passos.length ? `Você subiu de NEX ${de}% para ${fs.ficha.nex}%.` : 'Parece que você está mais forte e precisa tomar decisões.'),
        ...passos.map(cartaoPasso),
        ...avulsasPorNex.map((nex) => h('section', { class: 'fc-evo-passo' }, h('h4', { class: 'fc-subida-nex' }, `NEX ${nex}% (ficou pendente)`), h('div', { class: 'fc-pends' }, ...avulsas.filter((p) => p.nex === nex).map(botaoPend)))),
        ...(pend.length ? [h('p', { class: 'fj-dica' }, 'Escolha tudo o que está marcado. O que o livro dá sozinho já está na ficha.')] : []),
      );
      j.rodape.replaceChildren(
        ...(pend.length
          ? [botao('Depois', 'fechar', '', () => j.fechar())]
          : [
              botao('Entendi', 'ok', 'forte', () => {
                const nova = clone(this.fs!);
                nova.ficha.nexVisto = nova.ficha.nex;
                j.fechar();
                this.salvar(nova);
                this.verificarEquipamento();
              }),
            ]),
      );
    };
    this.subida = pintar;
    pintar();
  }

  /** O aviso único de refazer o equipamento (19/10): abre a requisição da Ordem, pelas regras. */
  private verificarEquipamento() {
    if (!this.fs?.ficha.refazerEquipamento || this.subida) return;
    const j = janela('EQUIPAMENTO', 'mochila', () => {}, 42);
    j.corpo.append(h('p', { class: 'fc-subida-intro' }, 'Ops, parece que não sobrou quase nada por aí, né?! Vamos refazer nossos equipamentos.'), h('p', { class: 'fj-dica' }, 'Peça à Ordem o que vai levar: a patente limita as categorias, e a carga a mais só avisa. As modificações ficam em cada item da mochila.'));
    j.rodape.append(
      botao('Agora não', 'fechar', '', () => j.fechar()),
      botao('Vamos lá', 'mochila', 'forte', () => {
        j.fechar();
        const r = clone(this.fs!);
        abrirRequisicao({
          ficha: r.ficha,
          nome: r.nome,
          tema: r.tema,
          mestre: false,
          aoAdicionar: () => {},
          aoFechar: () => {
            delete r.ficha.refazerEquipamento;
            this.salvar(r);
          },
        });
      }),
    );
  }

  /** Manda a cópia mexida (o servidor confere e devolve a ficha para todo mundo). */
  private salvar(r: FichaSalva) {
    r.nome = (r.ficha.nome || r.nome || 'Sem nome').trim();
    r.ficha.nome = r.nome;
    r.atualizadaEm = new Date().toISOString();
    this.app.net.send({ t: 'fichaSalvar', ficha: r });
    this.fs = clone(r);
    sfx.stamp();
    toast('Ficha salva.');
    this.render();
    this.subida?.();
  }

  private render() {
    const fs = this.fs;
    if (!fs) return this.corpo.replaceChildren(h('p', { class: 'jg-vazio' }, 'Carregando a ficha…'));
    vestirTema(this.el, fs.tema);
    this.calc = calcular(fs.ficha);
    const c = this.calc;
    if (!c) return this.corpo.replaceChildren(h('p', { class: 'jg-vazio' }, 'A ficha tem um problema que o motor não fecha: peça ao mestre.'));
    this.corpo.replaceChildren(this.cartaoIdent(fs, c), this.cartaoStatus(c), this.cartaoAtributos(fs, c), this.cartaoEvolucao(c), this.cartaoPericias(c), this.cartaoEquipamento(fs, c));
  }

  /** Um cartão de papel: título com o ícone pintado, conteúdo e, se der, o toque que abre a janela. */
  private cartao(titulo: string, pint: string, icone: NomeIcone, conteudo: Node[], abrir?: () => void, extra?: Node | null) {
    return h(
      abrir ? 'button' : 'section',
      { class: `fc-cartao${abrir ? ' abre' : ''}`, type: abrir ? 'button' : undefined, onclick: abrir ? () => (sfx.paper(), abrir()) : undefined },
      h('div', { class: 'fc-cartao-tit' }, h('span', { class: 'fc-cartao-ic' }, pintado(pint, icone)), h('h2', null, titulo), extra ?? null, abrir ? h('span', { class: 'fc-abre' }, ic('lapis')) : null),
      ...conteudo,
    );
  }

  // ---------------------------------------------------------------- Identificação

  private cartaoIdent(fs: FichaSalva, c: Calc) {
    const f = fs.ficha;
    const look = fs.personagem ? { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: fs.personagem } : null;
    if (look && !sprites.def(look.charId)) setTimeout(() => this.fs && this.render(), 800);
    const linha = (rot: string, valor: string) => h('div', { class: 'fc-linha' }, h('small', null, rot), h('b', null, valor));
    return this.cartao(
      'IDENTIFICAÇÃO',
      'titulo-identificacao',
      'ficha',
      [
        h(
          'div',
          { class: 'fc-ident' },
          h('div', { class: 'fc-foto' }, look ? portraitCanvas(look, 140) : ic('pessoa')),
          h(
            'div',
            { class: 'fc-ident-txt' },
            h('h3', null, fs.nome),
            linha('Origem', f.origem ? (cat.origem(f.origem)?.nome ?? '—') : '—'),
            linha('Classe', f.classe ? cat.classe(f.classe).nome : '—'),
            linha('Trilha', (f.trilha && cat.trilha(f.trilha)?.nome) || '—'),
            linha('NEX · patente', `${f.nex}% · ${c.patente?.nome ?? '—'}`),
            linha('Tema', NOME_TEMA[fs.tema ?? 'ordem']),
          ),
        ),
      ],
      () => this.editarIdent(),
    );
  }

  private editarIdent() {
    const r = clone(this.fs!);
    const j = janela('IDENTIFICAÇÃO', 'ficha', () => {}, 50);
    j.el.classList.add('tela-toda', 'fc-janela');
    const nome = h('input', { class: 'fx-inp', value: r.nome, maxlength: 60 }) as HTMLInputElement;
    const temas = h(
      'div',
      { class: 'fc-temas' },
      ...TEMAS.map((t) => {
        const b = h('button', { class: `fc-tema${(r.tema ?? 'ordem') === t ? ' on' : ''}`, type: 'button', 'data-tema': t, onclick: () => ((r.tema = t as Tema), temas.querySelectorAll('.fc-tema').forEach((x) => x.classList.toggle('on', x === b))) }, NOME_TEMA[t]);
        return b;
      }),
    );
    const campo = (rot: string, el: HTMLElement) => h('label', { class: 'fc-campo' }, h('span', null, rot), el);
    // origem, classe e trilha: as opções do livro (a troca é rara; o motor diz o que cabe)
    const escolha = (rot: string, c: Campo, valor: string) =>
      h(
        'button',
        {
          class: 'fc-escolha',
          type: 'button',
          onclick: () => {
            const e = escolherCampo(r.ficha, r.ficha.nex, c);
            if (e) void escolher(e, () => (j.fechar(), this.salvar(r)));
          },
        },
        h('small', null, rot),
        h('b', null, valor),
        ic('direita'),
      );
    const f = r.ficha;
    j.corpo.append(
      campo('Nome', nome),
      h('div', { class: 'fc-campo' }, h('span', null, 'Tema da tela'), temas),
      h('p', { class: 'fj-dica' }, 'Origem, classe e trilha só mudam pelas opções do livro. O NEX e a patente ficam com o mestre.'),
      escolha('Origem', 'origem', f.origem ? (cat.origem(f.origem)?.nome ?? '—') : 'Escolher'),
      escolha('Classe', 'classe', f.classe ? cat.classe(f.classe).nome : 'Escolher'),
      escolha('Trilha', 'trilha', (f.trilha && cat.trilha(f.trilha)?.nome) || 'Escolher'),
    );
    j.rodape.append(
      botao('Cancelar', 'fechar', '', () => j.fechar()),
      botao('Salvar', 'salvar', 'forte', () => {
        const n = nome.value.trim();
        if (!n) return toast('Dê um nome ao agente.', 'error');
        r.nome = n;
        r.ficha.nome = n;
        j.fechar();
        this.salvar(r);
      }),
    );
  }

  // ---------------------------------------------------------------- Status (só os máximos)

  private cartaoStatus(c: Calc) {
    const t = (pint: string, icone: NomeIcone, rot: string, valor: string, dica: string) => h('div', { class: 'fc-st', title: dica }, h('span', { class: 'fc-st-ic' }, pintado(pint, icone)), h('b', null, valor), h('small', null, rot));
    const res = Object.entries(c.resistencias).filter(([, v]) => v);
    const partes: (HTMLElement | null)[] = [
      h(
        'div',
        { class: 'fc-status' },
        t('pv', 'coracao', 'PV máx.', String(c.pv), 'Pontos de vida, no máximo.'),
        t('pe', 'raio', 'PE máx.', String(c.pe), 'Pontos de esforço, no máximo.'),
        t('san', 'espiral', 'SAN máx.', String(c.san), 'Sanidade, no máximo.'),
        t('defesa', 'escudo', 'Defesa', String(c.defesa), '10 + Agilidade + proteção.'),
        t('deslocamento', 'correr', 'Desloc.', `${numero(c.deslocamento)} m`, 'Por ação de movimento.'),
        t('pe', 'raio', 'Limite PE', String(c.limitePe), 'PE por turno.'),
        t('estado-ritual', 'pentagrama', 'DT rituais', String(c.dtRituais), 'A DT dos seus rituais.'),
        t('protecao', 'colete', 'Proteção', `+${c.protecao}`, 'O que a proteção soma na Defesa.'),
      ),
      res.length ? h('p', { class: 'fc-nota' }, h('b', null, 'Resistências: '), res.map(([k, v]) => `${k} ${v}`).join(', ')) : null,
    ];
    return this.cartao('STATUS', 'titulo-derivados', 'escudo', partes.filter((x): x is HTMLElement => !!x));
  }

  // ---------------------------------------------------------------- Atributos

  private cartaoAtributos(fs: FichaSalva, c: Calc) {
    const { gastos, total } = pontosAtributo(fs.ficha);
    const falta = total - gastos;
    return this.cartao(
      'ATRIBUTOS',
      'titulo-atributos',
      'pulso',
      [
        // a mesma faixa da aba Agente (o cartão inteiro já abre a edição)
        faixaAtributos(c.atributos, false),
      ],
      () => this.editarAtributos(),
      falta > 0 ? h('span', { class: 'fc-selo' }, `${falta} ponto${falta > 1 ? 's' : ''}`) : null,
    );
  }

  /** Os atributos grandes: −/+ só nos pontos que faltam (LR p. 21), e os aumentos do NEX pela evolução. */
  private editarAtributos() {
    const r = clone(this.fs!);
    const original = { ...r.ficha.atributos };
    const j = janela('ATRIBUTOS', 'pulso', () => {}, 50);
    j.el.classList.add('tela-toda', 'fc-janela');
    const lista = h('div', { class: 'fc-atr-lista' });
    const pontos = h('p', { class: 'fc-pontos' });
    const salvar = botao('Salvar', 'salvar', 'forte', () => (j.fechar(), this.salvar(r)));
    const desenhar = () => {
      const c = calcular(r.ficha);
      const { gastos, total } = pontosAtributo(r.ficha);
      pontos.replaceChildren(h('b', null, `${gastos}/${total}`), ' pontos da criação gastos', ...(total - gastos > 0 ? [h('em', null, ` · faltam ${total - gastos}`)] : []));
      lista.replaceChildren(
        ...regras.ATRIBUTOS.map((a) => {
          const base = r.ficha.atributos[a];
          // sobe: só com ponto sobrando; desce: só o que subiu agora (o resto é com o mestre)
          const sobe = podeMudarAtributo(r.ficha, a, 1);
          const desce = base > original[a] && podeMudarAtributo(r.ficha, a, -1);
          const final = c?.atributos[a] ?? base;
          const mudar = (d: 1 | -1) => {
            sfx.click();
            r.ficha.atributos[a] += d;
            desenhar();
          };
          return h(
            'div',
            { class: `fc-atr-l${base !== original[a] ? ' mudou' : ''}` },
            h('span', { class: 'fc-atr-ic grande' }, arte(`/arte/icones/${a}.png`, ICONE_ATR[a])),
            h('div', { class: 'fc-atr-txt' }, h('b', null, regras.NOME_ATRIBUTO[a]), h('small', null, final !== base ? `criação ${base} · com o NEX ${final}` : `rola ${final > 0 ? `${final}d20` : '2d20, o pior'}`)),
            h('button', { class: 'fc-pm', type: 'button', disabled: !desce, 'aria-label': `Tirar 1 de ${regras.NOME_ATRIBUTO[a]}`, onclick: () => mudar(-1) }, ic('menos')),
            h('b', { class: 'fc-atr-v' }, String(final)),
            h('button', { class: 'fc-pm', type: 'button', disabled: !sobe, 'aria-label': `Somar 1 em ${regras.NOME_ATRIBUTO[a]}`, onclick: () => mudar(1) }, ic('mais')),
          );
        }),
      );
      const mudou = regras.ATRIBUTOS.some((a) => r.ficha.atributos[a] !== original[a]);
      (salvar as HTMLButtonElement).disabled = !mudou;
      // os aumentos de atributo do NEX que faltam
      const aumentos = (c?.pendencias ?? []).filter((p) => p.tipo === 'atributo');
      aum.replaceChildren(...aumentos.map((p) => this.botaoPendencia(r, p, () => j.fechar())));
    };
    const aum = h('div', { class: 'fc-pends' });
    j.corpo.append(h('p', { class: 'fj-dica' }, 'Na criação cada atributo vai de 0 a 3, só um pode ficar em 0. Aqui você gasta os pontos que faltam; mudar o que já foi gasto é com o mestre. Os aumentos do NEX vêm da evolução.'), pontos, lista, aum);
    j.rodape.append(botao('Cancelar', 'fechar', '', () => j.fechar()), salvar);
    desenhar();
  }

  // ---------------------------------------------------------------- Evolução (as pendências)

  private botaoPendencia(r: FichaSalva, p: regras.Pendencia, antes?: () => void) {
    return h(
      'button',
      {
        class: 'fc-pend',
        type: 'button',
        onclick: () => {
          if (p.tipo === 'atributos') return antes?.(), this.editarAtributos();
          if (p.tipo === 'pericias') return antes?.(), this.editarPericiasCriacao();
          const e = escolherPendencia(r.ficha, p);
          if (!e) return toast('Essa escolha é com o mestre.', 'error');
          antes?.();
          void escolher(e, () => this.salvar(r));
        },
      },
      h('span', { class: 'fc-pend-nex' }, `NEX ${p.nex}%`),
      h('span', { class: 'fc-pend-txt' }, p.texto),
      ic('direita'),
    );
  }

  private cartaoEvolucao(c: Calc) {
    const pend = c.pendencias;
    const erros = c.problemas.filter((p) => p.severidade === 'erro');
    if (!pend.length && !erros.length) return h('span', { class: 'hidden' });
    const r = clone(this.fs!);
    return this.cartao(
      'EVOLUÇÃO',
      'titulo-poderes',
      'estrela',
      [
        h('p', { class: 'fc-nota' }, 'O que falta escolher na ficha. Cada toque abre as opções do livro: as liberadas e as travadas, com o motivo.'),
        h('div', { class: 'fc-pends' }, ...pend.map((p) => this.botaoPendencia(r, p))),
        ...erros.map((p) => h('p', { class: 'fc-erro' }, ic('alerta'), `${p.onde}: ${p.texto}`)),
      ],
      undefined,
      h('span', { class: 'fc-selo' }, String(pend.length + erros.length)),
    );
  }

  /**
   * As perícias da criação (a origem que deixa escolher, um de cada grupo da classe e as livres):
   * só completa o que falta; o que já foi escolhido fica (trocar é com o mestre).
   */
  private editarPericiasCriacao() {
    const r = clone(this.fs!);
    const f = r.ficha;
    const antes = { origem: [...(f.pericias.origem ?? [])], grupos: [...f.pericias.grupos], livres: [...f.pericias.livres] };
    const j = janela('PERÍCIAS DA CRIAÇÃO', 'livro', () => {}, 56);
    j.el.classList.add('tela-toda', 'fc-janela');
    const corpo = h('div', { class: 'fc-pc' });
    const salvar = botao('Salvar', 'salvar', 'forte', () => (j.fechar(), this.salvar(r)));
    const chip = (nome: string, on: boolean, pode: boolean, fn: () => void, fixo = false) =>
      h('button', { class: `fc-chip${on ? ' on' : ''}${fixo ? ' fixo' : ''}`, type: 'button', disabled: !pode, onclick: () => (sfx.click(), fn(), desenhar()) }, on ? ic('ok') : null, nome);
    const desenhar = () => {
      const info = periciasCriacao(f);
      const tomadas = new Set<regras.PericiaId>([...info.origem, ...info.fixas, ...f.pericias.grupos]);
      const sec: Node[] = [];
      if (info.origemEscolha) {
        const s = new Set(f.pericias.origem ?? []);
        sec.push(
          h('h4', null, `Da origem: ${s.size} de ${info.origemEscolha}`),
          h('div', { class: 'fc-chips' }, ...cat.CATALOGO.pericias.map((x) => chip(x.nome, s.has(x.id), s.has(x.id) ? !antes.origem.includes(x.id) : s.size < info.origemEscolha, () => {
            if (s.has(x.id)) s.delete(x.id);
            else s.add(x.id);
            f.pericias.origem = [...s];
          }))),
        );
      } else if (info.origem.length) sec.push(h('h4', null, 'Da origem'), h('div', { class: 'fc-chips' }, ...info.origem.map((x) => chip(cat.pericia(x).nome, true, false, () => {}, true))));
      if (info.fixas.length) sec.push(h('h4', null, 'Da classe'), h('div', { class: 'fc-chips' }, ...info.fixas.map((x) => chip(cat.pericia(x).nome, true, false, () => {}, true))));
      info.grupos.forEach((g) => {
        const escolhida = g.find((x) => f.pericias.grupos.includes(x));
        const travada = !!escolhida && antes.grupos.includes(escolhida);
        sec.push(
          h('h4', null, `Da classe: uma entre ${g.map((x) => cat.pericia(x).nome).join(' ou ')}`),
          h('div', { class: 'fc-chips' }, ...g.map((x) => chip(cat.pericia(x).nome, x === escolhida, !travada, () => {
            f.pericias.grupos = [...f.pericias.grupos.filter((y) => !g.includes(y)), x];
            f.pericias.livres = f.pericias.livres.filter((y) => y !== x);
          }))),
        );
      });
      const livres = new Set(f.pericias.livres);
      sec.push(
        h('h4', null, `À escolha: ${livres.size} de ${info.livres}`),
        h('p', { class: 'fj-dica' }, 'As da classe mais o Intelecto; a que a classe e a origem dão juntas vira uma a mais (LR p. 22).'),
        h('div', { class: 'fc-chips' }, ...cat.CATALOGO.pericias.map((x) => {
          const on = livres.has(x.id);
          const tomada = tomadas.has(x.id);
          const pode = on ? !antes.livres.includes(x.id) : !tomada && livres.size < info.livres;
          return chip(x.nome, on || tomada, pode, () => {
            if (on) livres.delete(x.id);
            else livres.add(x.id);
            f.pericias.livres = [...livres];
          }, tomada && !on);
        })),
      );
      corpo.replaceChildren(...sec);
      const mudou = JSON.stringify(antes) !== JSON.stringify({ origem: f.pericias.origem ?? [], grupos: f.pericias.grupos, livres: f.pericias.livres });
      (salvar as HTMLButtonElement).disabled = !mudou;
    };
    j.corpo.append(h('p', { class: 'fj-dica' }, 'Você completa o que falta. Trocar uma perícia já escolhida é com o mestre.'), corpo);
    j.rodape.append(botao('Cancelar', 'fechar', '', () => j.fechar()), salvar);
    desenhar();
  }

  // ---------------------------------------------------------------- Perícias

  private cartaoPericias(c: Calc) {
    const treinadas = cat.CATALOGO.pericias.filter((p) => c.pericias[p.id].grau !== 'destreinado');
    return this.cartao(
      'PERÍCIAS',
      'titulo-pericias',
      'livro',
      [
        h(
          'div',
          { class: 'fc-pers' },
          ...treinadas.map((p) => {
            const pc = c.pericias[p.id];
            return h('div', { class: 'fc-per' }, h('span', null, p.nome), h('em', null, GRAU_CURTO[pc.grau]), h('b', null, textoTeste(pc.dados, pc.bonus, pc.penalidadeDados)));
          }),
        ),
        h('p', { class: 'fc-nota' }, `${treinadas.length} treinadas · toque para ver todas`),
      ],
      () => this.verPericias(),
    );
  }

  private verPericias() {
    const fs = this.fs!;
    const c = this.calc!;
    const j = janela('PERÍCIAS', 'livro', () => {}, 56);
    j.el.classList.add('tela-toda', 'fc-janela');
    const per = c.pendencias.filter((p) => p.tipo === 'pericias' || p.tipo === 'periciaIntelecto' || p.tipo === 'grau');
    if (per.length) j.corpo.append(h('div', { class: 'fc-pends' }, ...per.map((p) => this.botaoPendencia(clone(fs), p, () => j.fechar()))));
    j.corpo.append(
      h('p', { class: 'fj-dica' }, 'O treino das perícias vem da origem, da classe e da evolução (as pendências acima).'),
      h(
        'div',
        { class: 'fc-per-tab' },
        ...cat.CATALOGO.pericias.map((p) => {
          const pc = c.pericias[p.id];
          return h(
            'div',
            { class: `fc-per-l${pc.grau !== 'destreinado' ? ' treinada' : ''}`, title: `${p.nome} · ${NOME_GRAU[pc.grau]}` },
            h('span', { class: 'fc-per-n' }, p.id === 'profissao' && fs.ficha.profissao ? `Profissão (${fs.ficha.profissao})` : p.nome),
            h('em', null, GRAU_CURTO[pc.grau]),
            h('small', null, NOME_ATR[pc.atributo]),
            h('b', null, pc.podeUsar ? textoTeste(pc.dados, pc.bonus, pc.penalidadeDados) : '—'),
          );
        }),
      ),
    );
    j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'ok', 'forte', () => j.fechar()));
  }

  // ---------------------------------------------------------------- Equipamento

  private cartaoEquipamento(fs: FichaSalva, c: Calc) {
    const vagas = c.itens.filter((l) => l.limite > 0);
    const itens = fs.ficha.inventario.filter((it) => it.uid);
    return this.cartao('EQUIPAMENTO', 'titulo-equipamentos', 'mochila', [
      h(
        'div',
        { class: 'fc-casas' },
        ...itens.map((it) =>
          h(
            'button',
            { class: `jg-casa${regras.lugarDoItem(it) !== 'mochila' ? ' usado' : ''}`, type: 'button', title: regras.nomeDoItem(it), onclick: (e: Event) => (e.stopPropagation(), sfx.paper(), this.abrirItem(it.uid!)) },
            h('span', { class: 'jg-casa-arte' }, arteDoItem(it, infoItem(it, c).icone)),
            (it.qtd ?? 1) > 1 ? h('span', { class: 'jg-casa-q' }, `x${it.qtd}`) : null,
          ),
        ),
      ),
      h('p', { class: 'fc-nota' }, `${numero(c.carga.usados)}/${c.carga.espacos} espaços · ${vagas.map((l) => `cat. ${['0', 'I', 'II', 'III', 'IV'][l.categoria]} ${l.usados}/${l.limite}`).join(' · ') || 'patente sem limite de categoria'}`),
      botao('Pedir itens à Ordem', 'mais', 'forte', () => {
        const r = clone(fs);
        const antes = r.ficha.inventario.length;
        abrirRequisicao({
          ficha: r.ficha,
          nome: r.nome,
          tema: r.tema,
          mestre: false,
          aoAdicionar: () => {},
          aoFechar: () => {
            if (r.ficha.inventario.length !== antes) this.salvar(r);
          },
        });
      }),
    ]);
  }
}
