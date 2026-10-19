/**
 * Aba FICHAS (referência docs/referencias/fichas.webp; no celular, a disposição de
 * docs/referencias/fichas-celular.webp). Mostra a ficha de cada agente com tudo que o
 * motor de regras calcula, e deixa editar com as escolhas amarradas às regras:
 * cada pendência abre as opções do livro, liberadas ou travadas com o motivo.
 *
 * Dois modos: jogo (PV, PE, SAN, condições e anotações mudam na hora e são
 * salvos sozinhos) e editar (um rascunho da ficha inteira; Salvar grava,
 * Cancelar descarta). NEX e pontos de prestígio só o mestre muda.
 */
import { combate, NOME_TEMA, TEMAS, regras, vitalConditions, type AvatarLook, type CampaignState, type CharacterDef, type FichaSalva, type Npc, type Vitals } from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import type { App } from './app';
import { CorpoView } from './corpo';
import { h, toast } from './dom';
import { arteDoItem } from './arteItem';
import { caberNumaLinha, corpoDoItem } from './jogador';
import { abrirRequisicao } from './requisicao';
import { confirmar, escolher, janela, janelaAberta, mostrar, perguntarTexto, quandoFecharTodas } from './fichaModal';
import { opcoesMelhoria } from './melhorias';
import { blocoDia, bolinhasDia } from './porDia';
import { abrirCriacao, type Assistente } from './criacao';
import {
  escolherCampo,
  escolherPendencia,
  GRAU_CURTO,
  infoItem,
  NOME_ATR,
  NOME_ATR_LONGO,
  NOME_ELEMENTO,
  NOME_GRAU,
  periciasCriacao,
  podeMudarAtributo,
  pontosAtributo,
  romano,
  sinal,
  textoRef,
  textoTeste,
  type Campo,
} from './fichaRegras';
import { arte, arteOu, ic, type NomeIcone } from './icons';
import { paperize } from './paperArt';
import { sfx } from './sfx';
import { vestirTema } from './temaUi';

type Ficha = regras.Ficha;
type Calc = regras.Calculado;
type Nex = regras.Nex;
const cat = regras.catalogo;

type Modo = 'jogo' | 'editar';
type AbaNotas = 'anotacoes' | 'documentos' | 'pistas' | 'perfil';
/** As abas do painel da direita, embaixo (repaginada de 05/10). */
type AbaGrupo = 'poderes' | 'rituais' | 'companheiro' | 'anotacoes' | 'evolucao';

const ICONE_ATR: Record<regras.AtributoId, NomeIcone> = { agi: 'correr', for: 'punho', int: 'cerebro', pre: 'olho', vig: 'escudo' };
const CLASSE_NOME = (c: regras.ClasseId | null) => (c ? cat.classe(c).nome : '—');

/** Condições de toque rápido (as outras ficam em "Outro"). */
const RAPIDAS: { id: string; nome: string; icone: NomeIcone }[] = [
  { id: 'machucado', nome: 'Machucado', icone: 'gota' },
  { id: 'sangrando', nome: 'Sangrando', icone: 'gota' },
  { id: 'atordoado', nome: 'Atordoado', icone: 'tontura' },
  { id: 'abalado', nome: 'Abalado', icone: 'fantasma' },
  { id: 'envenenado', nome: 'Envenenado', icone: 'frasco' },
  { id: 'inconsciente', nome: 'Inconsciente', icone: 'lua' },
];
const AUTOMATICAS = ['machucado', 'morrendo', 'perturbado', 'enlouquecendo'];

const COR_ELEMENTO: Record<regras.Elemento, string> = { sangue: '#d9302c', morte: '#8d8d93', conhecimento: '#e2b53a', energia: '#a45cff', medo: '#f1efe9' };

function agora() {
  return new Date().toISOString();
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Aparência mínima para desenhar o retrato do personagem ligado à ficha. */
function lookDe(charId: number | undefined): AvatarLook | null {
  if (!charId) return null;
  return { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId };
}

export interface OpcoesFichas {
  /** tela do jogador (link ?ficha=): só a própria ficha, sem criar nem apagar */
  jogador: boolean;
}

/** O ícone pintado do título de cada painel (o kit de interface). */
const TITULO_PINTADO: Record<string, string> = {
  'fx-ident': 'identificacao',
  'fx-atrib': 'atributos',
  'fx-rec': 'recursos',
  'fx-deriv': 'derivados',
  'fx-cond': 'condicoes',
  'fx-per': 'pericias',
  'fx-pod': 'poderes',
  'fx-rit': 'rituais',
  'fx-comp': 'companheiro',
  'fx-equip': 'equipamentos',
  'fx-inv': 'inventario',
  'fx-notas': 'anotacoes',
};

export class FichasScreen {
  readonly el: HTMLElement;
  private app: App;
  private o: OpcoesFichas;
  private lista: FichaSalva[] = [];
  /** a coluna da esquerda: os agentes ou os NPCs do Elenco (17/10, o Felipe: "uma aba de ficha pros NPCs") */
  private grupoAg: 'agentes' | 'npcs' = 'agentes';
  private agTit!: HTMLElement;
  private selId: number | null = null;
  private rascunho: FichaSalva | null = null;
  private modo: Modo = 'jogo';
  private calc: Calc | null = null;
  private campanha: CampaignState | null = null;
  private corpo = new CorpoView();
  /** a foto do agente no lugar do boneco grande (19/10, o Felipe: "cada um parece de um sistema diferente; só a foto por enquanto") */
  private corpoFoto = h('img', { class: 'fx-corpo-foto', alt: '', decoding: 'async' }) as HTMLImageElement;
  private abaNotas: AbaNotas = 'anotacoes';
  private abaGrupo: AbaGrupo = 'poderes';
  private soTreinadas = false;
  private timers = new Map<number, number>();
  private dica: HTMLElement;
  // painéis
  private pAgentes: HTMLElement;
  private agLista: HTMLElement;
  private pCorpo: HTMLElement;
  private pIdent: HTMLElement;
  private pAtrib: HTMLElement;
  private pRec: HTMLElement;
  private pDeriv: HTMLElement;
  private pCond: HTMLElement;
  private pPer: HTMLElement;
  private pPod: HTMLElement;
  private pRit: HTMLElement;
  private pTat: HTMLElement;
  private pEvol: HTMLElement;
  /** os papéis que juntam os painéis (Vida, Atributos e combate, Itens e as Abas) */
  private gVida: HTMLElement;
  private gComb: HTMLElement;
  private gItens: HTMLElement;
  private gAbas: HTMLElement;
  private abasNav: HTMLElement;
  private pComp: HTMLElement;
  private pEquip: HTMLElement;
  private pInv: HTMLElement;
  private pNotas: HTMLElement;
  private barra: HTMLElement;
  private vazio: HTMLElement;

  constructor(app: App, o: OpcoesFichas) {
    this.app = app;
    this.o = o;
    const papel = (el: HTMLElement, seed: number, extra: Parameters<typeof paperize>[1] = { seed }) => (paperize(el, { tone: '#d9c9a9', burn: 1, torn: 1.1, stains: 1, creases: 0.3, crumple: 0.35, specks: 0.6, pad: 18, ...extra, seed }), el);
    const secao = (cls: string, titulo: string | null, icone: NomeIcone | null, escuro = false) => {
      const s = h('section', { class: `fx-p ${cls}${escuro ? ' escuro' : ''}` });
      // o ícone pintado do título (arte/icones/titulo-*.png); sem ele, o de linha
      const pintado = TITULO_PINTADO[cls];
      const icTit = icone ? (pintado ? arteOu([`/arte/icones/titulo-${pintado}.png`], ic(icone)) : ic(icone)) : null;
      if (titulo) s.append(h('header', { class: 'fx-tit' }, icTit ? h('span', { class: 'fx-tit-ic' }, icTit) : null, h('h3', null, titulo), h('span', { class: 'fx-tit-extra' })));
      s.append(h('div', { class: 'fx-corpo-p' }));
      return s;
    };
    // ---------- agentes ----------
    this.agLista = h('div', { class: 'fx-ag-lista' });
    this.agTit = h('h2', { class: 'fx-ag-tit' }, 'AGENTES');
    this.pAgentes = h('section', { class: 'fx-p fx-agentes' }, this.agTit, this.agLista);
    // ---------- personagem grande ----------
    this.pCorpo = h(
      'section',
      { class: 'fx-p fx-corpo' },
      h('div', { class: 'fx-corpo-fundo', 'aria-hidden': 'true' }, h('span', { class: 'fx-corpo-marca' }), h('span', { class: 'fx-corpo-chao' })),
      this.corpo.el,
      this.corpoFoto,
      h('span', { class: 'fx-cantos', 'aria-hidden': 'true' }),
      h('button', { class: 'fx-seta esq', type: 'button', title: 'Girar', 'aria-label': 'Girar para a esquerda', onclick: () => (sfx.click(), this.corpo.girar(-1)) }, ic('esquerda')),
      h('button', { class: 'fx-seta dir', type: 'button', title: 'Girar', 'aria-label': 'Girar para a direita', onclick: () => (sfx.click(), this.corpo.girar(1)) }, ic('direita')),
      h('button', { class: 'fx-zoom', type: 'button', title: 'Ver maior', 'aria-label': 'Ver maior', onclick: () => this.verMaior() }, ic('lupaMais')),
    );
    // ---------- painéis de papel ----------
    this.pIdent = papel(secao('fx-ident', 'IDENTIFICAÇÃO', 'pessoa'), 101);
    this.pAtrib = papel(secao('fx-atrib', 'ATRIBUTOS', 'espadas'), 102);
    this.pRec = papel(secao('fx-rec', 'RECURSOS', 'pulso'), 103);
    this.pDeriv = papel(secao('fx-deriv', 'DERIVADOS', 'escudo'), 104);
    this.pCond = papel(secao('fx-cond', 'CONDIÇÕES / STATUS', 'pulso'), 105);
    this.pPer = papel(secao('fx-per', 'PERÍCIAS', 'dados'), 106);
    this.pPod = papel(secao('fx-pod', 'PODERES / HABILIDADES', 'estrela', true), 107, { seed: 107, tone: '#d4c3a2', burn: 1, torn: 1, pad: 18 });
    this.pRit = papel(secao('fx-rit', 'RITUAIS / PODERES PARANORMAIS', 'pentagrama', true), 108, { seed: 108, tone: '#d4c3a2', burn: 1, torn: 1, pad: 18 });
    this.pTat = secao('fx-tat', null, null);
    this.pComp = papel(secao('fx-comp', 'COMPANHEIRO', 'pata'), 109);
    this.pEquip = papel(secao('fx-equip', 'ITENS E ATAQUES', 'mochila'), 110);
    this.pInv = papel(secao('fx-inv', 'MOCHILA', 'mochila', true), 111, { seed: 111, tone: '#d4c3a2', burn: 1, torn: 1, pad: 18 });
    this.pNotas = papel(secao('fx-notas', 'ANOTAÇÕES / DOCUMENTOS / PISTAS', 'documento'), 112);
    this.pEvol = papel(secao('fx-evol', 'EVOLUÇÃO', 'linhaTempo'), 113);
    // ---------- os grupos (na tela grande): cada um é um papel só, com os painéis dentro; no celular
    // eles somem (display: contents) e cada painel volta a ter o próprio papel ----------
    const grupo = (cls: string, seed: number, ...filhos: HTMLElement[]) => papel(h('section', { class: `fx-grupo ${cls}` }, ...filhos), seed);
    this.gVida = grupo('fx-g-vida', 120, this.pRec, this.pCond);
    this.gComb = grupo('fx-g-comb', 121, this.pAtrib, this.pDeriv, this.pTat);
    this.gItens = grupo('fx-g-itens', 122, this.pEquip, this.pInv);
    this.abasNav = h('nav', { class: 'fx-g-abas-nav', role: 'tablist' });
    this.gAbas = grupo('fx-g-abas', 123, this.abasNav, this.pPod, this.pRit, this.pComp, this.pNotas, this.pEvol);
    this.barra = h('div', { class: 'fx-barra' });
    this.vazio = h('div', { class: 'fx-vazio hidden' });
    const pilha = h('div', { class: 'fx-pilha', 'aria-hidden': 'true' }, h('span', { class: 'fx-pilha-a' }), h('span', { class: 'fx-pilha-b' }), h('span', { class: 'fx-pilha-c' }));
    for (const [i, s] of [...pilha.children].entries()) paperize(s as HTMLElement, { kit: false, seed: 130 + i, tone: i === 1 ? '#cdbb99' : '#c4b08e', burn: 1.2, torn: 2, stains: 1.4, pad: 12 });
    this.dica = h('div', { class: 'fx-dica hidden', role: 'tooltip' });
    this.el = h(
      'div',
      { class: `fx${o.jogador ? ' jogador' : ''}` },
      h(
        'div',
        { class: 'fx-palco' },
        pilha,
        this.pAgentes,
        this.pCorpo,
        this.pIdent,
        this.gComb,
        this.gVida,
        this.pPer,
        this.gAbas,
        this.gItens,
        this.barra,
        this.vazio,
      ),
      this.dica,
    );
    this.ligarDicas();
    app.on('characters', () => (this.escondida() ? (this.sujo = true) : this.render()));
    // os NPCs do Elenco (a aba NPCs) chegam com o bestiário: quando mudam (nome novo, NPC novo), a lista acompanha
    app.on('bestiario', () => this.grupoAg === 'npcs' && (this.escondida() ? (this.sujo = true) : this.render()));
  }

  // ================================================================ dados

  /** a tela está fechada (outra aba do mestre): não se redesenha nada, abre refeita */
  private sujo = false;
  private escondida() {
    return this.el.classList.contains('hidden');
  }

  /** A ficha sem o que muda em jogo (PV, PE e SAN de agora, condições): se o resto é igual, a tela só acerta os números. */
  private semJogo(f: FichaSalva) {
    return JSON.stringify({ ...f, atual: undefined, condicoes: undefined, atualizadaEm: undefined });
  }

  private soNumerosDeJogo(a: FichaSalva[], b: FichaSalva[]) {
    return a.length === b.length && a.every((f, i) => f.id === b[i].id && this.semJogo(f) === this.semJogo(b[i]));
  }

  /**
   * Só PV, PE, SAN ou condições mudaram: acerta no lugar (as barras da lista, os recursos e as condições do
   * jogador, o estado do corpo) em vez de refazer a ficha inteira, que piscava a cada ponto de vida.
   */
  private renderJogo() {
    const fs = this.atual();
    if (!fs) return this.render();
    this.calc = regras.calcular(fs.ficha);
    for (const f of this.lista) {
      const v = this.vitais(f, regras.calcular(f.ficha));
      const i = this.agLista.querySelector<HTMLElement>(`.fx-ag[data-id="${f.id}"] .fx-ag-pv i`);
      if (i) i.style.width = `${Math.round((v.pv / Math.max(1, v.pvMax)) * 100)}%`;
    }
    this.corpo.setCondicoes(vitalConditions(this.vitais(fs, this.calc)));
    this.poseDoCorpo(fs);
    if (this.o.jogador) {
      this.renderRec(fs, this.calc);
      this.renderCond(fs, this.calc);
    }
  }

  /** Lista que chega do servidor (todas para o mestre; só a própria para o jogador). */
  setFichas(lista: FichaSalva[], nova?: number) {
    const antes = this.lista;
    // ficha com gravação a caminho: fica a versão da tela (a do servidor está um passo atrás)
    this.lista = lista.map((f) => (this.timers.has(f.id) ? (this.lista.find((x) => x.id === f.id) ?? f) : f)).sort((a, b) => a.id - b.id);
    if (nova) {
      this.selId = nova;
      if (this.rascunho?.id === 0) {
        this.rascunho = null;
        this.modo = 'jogo';
      }
    }
    if (this.selId === null || (!this.lista.some((f) => f.id === this.selId) && this.rascunho?.id !== 0)) this.selId = this.lista[0]?.id ?? null;
    if (this.escondida()) {
      this.sujo = true;
      return;
    }
    if (!nova && !this.rascunho && this.soNumerosDeJogo(antes, this.lista)) return this.renderJogo();
    this.render();
  }

  setCampanha(c: CampaignState) {
    this.campanha = c;
    this.renderIdent();
  }

  private get gm() {
    return this.app.isGm && !this.o.jogador;
  }

  /** A ficha na tela: o rascunho, se estiver editando; senão a da lista. */
  private atual(): FichaSalva | null {
    if (this.rascunho) return this.rascunho;
    return this.lista.find((f) => f.id === this.selId) ?? null;
  }

  private get editando() {
    return this.modo === 'editar' && !!this.rascunho;
  }

  /** Máximos da ficha e o estado atual (sem estado = cheio). */
  private vitais(fs: FichaSalva, c: Calc): Vitals {
    const a = fs.atual;
    return {
      pv: Math.min(a?.pv ?? c.pv, c.pv),
      pvMax: c.pv,
      pe: Math.min(a?.pe ?? c.pe, c.pe),
      peMax: c.pe,
      san: Math.min(a?.san ?? c.san, c.san),
      sanMax: c.san,
    };
  }

  /** Grava uma mudança de jogo (PV, condição, anotação): tela na hora, servidor logo depois. */
  private salvarJogo(fs: FichaSalva) {
    fs.atualizadaEm = agora();
    const i = this.lista.findIndex((x) => x.id === fs.id);
    if (i >= 0) this.lista[i] = fs;
    if (!fs.id) return;
    clearTimeout(this.timers.get(fs.id));
    this.timers.set(
      fs.id,
      window.setTimeout(() => {
        this.timers.delete(fs.id);
        this.app.net.send({ t: 'fichaSalvar', ficha: fs });
      }, 450),
    );
  }

  /** Muda a ficha: no rascunho (editando) ou direto (jogo). */
  private mudar(fn: (fs: FichaSalva) => void, redesenhar = true) {
    const fs = this.atual();
    if (!fs) return;
    let soJogo = false;
    if (this.editando) fn(fs);
    else {
      const c = clone(fs);
      const antes = this.semJogo(c);
      fn(c);
      soJogo = this.semJogo(c) === antes;
      this.salvarJogo(c);
    }
    if (redesenhar) soJogo ? this.renderJogo() : this.render();
  }

  // ================================================================ modos

  /**
   * A edição direta do mestre (19/10, o Felipe: "tirar o botão Editar; cliquei no NEX, abre o modal para upar o NEX;
   * cliquei na patente, abre para mudar a patente"): o clique num campo abre um rascunho sem mudar a tela, a janela
   * mexe nele, e quando a última janela fecha a ficha grava sozinha (se mudou algo) e o rascunho some.
   */
  private direto: { base: string } | null = null;
  private comecarDireto(): boolean {
    if (this.editando) return true;
    const fs = this.atual();
    if (!fs) return false;
    this.rascunho = clone(fs);
    this.modo = 'editar';
    this.direto = { base: JSON.stringify(this.rascunho) };
    quandoFecharTodas(() => this.fecharDireto());
    // a ação que não abriu janela nenhuma (um aviso só) não deixa o rascunho preso
    window.setTimeout(() => {
      if (this.direto && !janelaAberta()) this.fecharDireto();
    }, 120);
    return true;
  }

  private fecharDireto() {
    const d = this.direto;
    if (!d) return;
    this.direto = null;
    const fs = this.rascunho;
    this.rascunho = null;
    this.modo = 'jogo';
    if (fs && JSON.stringify(fs) !== d.base) {
      fs.nome = (fs.ficha.nome || fs.nome || 'Sem nome').trim();
      fs.ficha.nome = fs.nome;
      fs.atualizadaEm = agora();
      this.app.net.send({ t: 'fichaSalvar', ficha: fs });
      const npc = fs.npc ? this.app.state.npcs.find((n) => n.id === fs.npc) : undefined;
      if (npc && npc.nome !== fs.nome) this.app.net.send({ t: 'npcSalvar', npc: { ...npc, nome: fs.nome } });
      const i = this.lista.findIndex((x) => x.id === fs.id);
      if (i >= 0) this.lista[i] = clone(fs);
      sfx.stamp();
      toast('Ficha salva.');
    }
    this.render();
  }

  /** Antes de abrir uma janela que mexe na ficha: o mestre edita direto; o jogador entra na edição. */
  private garantirEdicao(): boolean {
    if (this.editando) return true;
    if (this.gm) return this.comecarDireto();
    this.entrarEdicao();
    return this.editando;
  }

  /** O clique de um campo da ficha: o mestre sempre, o jogador só editando. */
  private acao(fn: () => void): (() => void) | undefined {
    if (!this.editando && !this.gm) return undefined;
    return () => {
      if (this.garantirEdicao()) fn();
    };
  }

  private entrarEdicao(passos = true) {
    const fs = this.atual();
    if (!fs || this.editando) return;
    this.rascunho = clone(fs);
    this.modo = 'editar';
    sfx.paper();
    this.render();
    // o Editar do mestre abre os passos da criação (a ficha de trás muda junto)
    if (passos && this.gm) this.abrirAssistente(false);
  }

  /** A criação passo a passo, no rascunho (docs/CRIACAO-DE-PERSONAGEM.md). */
  private assistente: Assistente | null = null;
  private abrirAssistente(nova: boolean) {
    if (this.assistente || !this.rascunho) return;
    this.assistente = abrirCriacao({
      fs: () => this.rascunho,
      gm: this.gm,
      nova,
      pericias: (alvo) => this.editarPericias(alvo),
      escolha: (e) => this.abrirEscolha(e),
      item: (i) => this.detalheItem(i),
      requisicao: () => this.adicionarItem(),
      tema: () => this.escolherTema(),
      render: () => this.render(),
      salvar: () => this.salvarEdicao(),
      cancelar: () => this.cancelarEdicao(),
      fechou: () => (this.assistente = null),
    });
  }

  private cancelarEdicao() {
    if (!this.editando) return;
    const novo = this.rascunho?.id === 0;
    this.rascunho = null;
    this.modo = 'jogo';
    if (novo) this.selId = this.lista[0]?.id ?? null;
    this.render();
  }

  private salvarEdicao() {
    const fs = this.rascunho;
    if (!fs) return;
    fs.nome = (fs.ficha.nome || fs.nome || 'Sem nome').trim();
    fs.ficha.nome = fs.nome;
    fs.atualizadaEm = agora();
    this.app.net.send({ t: 'fichaSalvar', ficha: fs });
    const npc = fs.npc ? this.app.state.npcs.find((n) => n.id === fs.npc) : undefined;
    if (npc && npc.nome !== fs.nome) this.app.net.send({ t: 'npcSalvar', npc: { ...npc, nome: fs.nome } });
    sfx.stamp();
    if (fs.id) {
      const i = this.lista.findIndex((x) => x.id === fs.id);
      if (i >= 0) this.lista[i] = clone(fs);
      this.rascunho = null;
      this.modo = 'jogo';
      toast('Ficha salva.');
    } else toast('Criando a ficha…');
    this.render();
  }

  private novoAgente() {
    if (!this.gm) return;
    if (this.editando && !this.rascunho?.id) return;
    const f = regras.novaFicha('Novo agente');
    this.rascunho = { id: 0, nome: 'Novo agente', ficha: f, criadaEm: agora(), atualizadaEm: agora() };
    this.modo = 'editar';
    this.selId = null;
    sfx.paper();
    this.render();
    this.abrirAssistente(true);
  }

  private selecionar(id: number) {
    if (id === this.selId && !this.rascunho) return;
    if (this.direto) this.fecharDireto();
    if (this.editando) {
      toast('Salve ou cancele a edição antes de trocar de agente.', 'error');
      return;
    }
    this.selId = id;
    sfx.click();
    this.render();
  }

  // ================================================================ tela

  show() {
    this.el.classList.remove('hidden');
    this.sujo = false;
    this.render();
  }

  hide() {
    this.el.classList.add('hidden');
  }

  private render() {
    this.renderTela();
    // os passos da criação, abertos por cima, acompanham
    this.assistente?.atualizar();
  }

  private renderTela() {
    const fs = this.atual();
    this.calc = fs ? regras.calcular(fs.ficha) : null;
    this.el.classList.toggle('editando', this.editando && !this.direto);
    // o tema do agente veste a ficha dele (e, no celular, a tela inteira do jogador)
    vestirTema(this.el, fs?.tema);
    const tela = this.el.closest<HTMLElement>('.tela-ficha');
    if (tela) vestirTema(tela, fs?.tema);
    this.renderAgentes();
    const tem = !!fs;
    this.vazio.classList.toggle('hidden', tem);
    if (!tem) {
      const npcs = this.gm && this.grupoAg === 'npcs';
      this.vazio.replaceChildren(
        h('p', null, this.o.jogador ? 'Sua ficha ainda não chegou. Peça o link de novo ao mestre.' : npcs ? 'Escolha um NPC na lista: abre a ficha dele, ou começa uma.' : 'Nenhuma ficha ainda.'),
        this.gm && !npcs ? h('button', { class: 'fx-bt forte', type: 'button', onclick: () => this.novoAgente() }, ic('mais'), h('span', null, 'Novo agente')) : '',
      );
    }
    // sem ficha, nada de moldura vazia (os grupos também somem)
    for (const p of [this.pCorpo, this.pIdent, this.pAtrib, this.pRec, this.pDeriv, this.pCond, this.pPer, this.pPod, this.pRit, this.pTat, this.pComp, this.pEquip, this.pInv, this.pNotas, this.barra, this.gVida, this.gComb, this.gItens, this.gAbas]) p.classList.toggle('hidden', !tem);
    if (!fs || !this.calc) return;
    this.renderCorpo(fs, this.calc);
    this.renderIdent();
    this.renderAtrib(fs, this.calc);
    this.renderRec(fs, this.calc);
    this.renderDeriv(this.calc);
    this.renderCond(fs, this.calc);
    this.renderPer(fs, this.calc);
    this.renderPod(fs, this.calc);
    this.renderRit(fs, this.calc);
    this.renderTat(fs, this.calc);
    this.renderComp(fs);
    this.renderEquip(fs, this.calc);
    this.renderInv(fs, this.calc);
    this.renderNotas(fs);
    this.renderAbas(this.calc);
    this.renderBarra(fs);
  }

  private corpoDe(p: HTMLElement) {
    return p.querySelector('.fx-corpo-p') as HTMLElement;
  }

  private extraDe(p: HTMLElement) {
    return p.querySelector('.fx-tit-extra') as HTMLElement;
  }

  // ---------------------------------------------------------------- agentes

  private renderAgentes() {
    // o título vira as duas abas para o mestre
    if (this.gm) {
      // só o ícone (19/10, o Felipe: "o trem cortado ali me mata"): o da Ordem para os agentes, a pessoa para os NPCs
      const aba = (id: 'agentes' | 'npcs', nome: string, icone: NomeIcone) =>
        h('button', { class: `fx-ag-aba${this.grupoAg === id ? ' on' : ''}`, type: 'button', title: nome, 'aria-label': nome, onclick: () => this.trocarGrupo(id) }, ic(icone));
      this.agTit.replaceChildren(aba('agentes', 'Agentes', 'escudoEstrela'), aba('npcs', 'NPCs', 'pessoa'));
    } else this.agTit.replaceChildren('AGENTES');
    if (this.gm && this.grupoAg === 'npcs') return this.renderNpcs();
    const cards: HTMLElement[] = [];
    const lista = this.lista.filter((f) => !f.npc);
    if (this.rascunho?.id === 0) lista.push(this.rascunho);
    for (const fs of lista) {
      const on = this.rascunho ? fs === this.rascunho || fs.id === this.rascunho.id : fs.id === this.selId;
      const c = regras.calcular(fs.ficha);
      const v = this.vitais(fs, c);
      const pend = c.pendencias.length;
      const look = lookDe(fs.personagem);
      const foto = look ? portraitCanvas(look, 140) : h('span', { class: 'fx-ag-sem' }, ic('pessoa'));
      cards.push(
        h(
          'button',
          { class: `fx-ag${on ? ' on' : ''}`, type: 'button', title: fs.nome, 'data-id': String(fs.id), onclick: () => fs.id && this.selecionar(fs.id) },
          h('span', { class: 'fx-ag-foto' }, foto),
          h('span', { class: 'fx-ag-placa' }, h('span', { class: 'fx-ag-nome', title: fs.nome }, fs.nome.split(/\s+/)[0]), h('span', { class: 'fx-ag-info' }, `NEX ${fs.ficha.nex}% · ${CLASSE_NOME(fs.ficha.classe)}`)),
          h('span', { class: 'fx-ag-pv' }, h('i', { style: `width:${Math.round((v.pv / Math.max(1, v.pvMax)) * 100)}%` })),
          pend ? h('span', { class: 'fx-ag-pend', title: `${pend} pendência${pend > 1 ? 's' : ''}` }, String(pend)) : null,
        ),
      );
    }
    if (this.gm) cards.push(h('button', { class: 'fx-ag novo', type: 'button', onclick: () => this.novoAgente() }, ic('mais'), h('span', null, 'Novo', h('br'), 'Agente')));
    this.agLista.replaceChildren(...cards);
  }

  /** Agentes ou NPCs: troca a lista e escolhe o primeiro da outra (sem perder uma edição aberta). */
  private trocarGrupo(id: 'agentes' | 'npcs') {
    if (id === this.grupoAg) return;
    if (this.editando) {
      toast('Salve ou cancele a edição antes de trocar.', 'error');
      return;
    }
    this.grupoAg = id;
    // a lista dos NPCs vem com o bestiário: pede ao servidor se ainda não chegou
    if (id === 'npcs' && !this.app.state.npcs.length) this.app.net.send({ t: 'bestiario' });
    const primeira = this.lista.find((f) => (id === 'npcs' ? !!f.npc : !f.npc));
    this.selId = primeira?.id ?? null;
    sfx.click();
    this.render();
  }

  /** O personagem do tabuleiro de um NPC (pela pasta da arte dele). */
  private charDoNpc(n: Npc) {
    return n.arte ? this.app.state.characters.find((c) => c.sheet.includes(`/personagens/${n.arte}/`))?.id : undefined;
  }

  /** A lista dos NPCs do Elenco: com ficha, abre; sem ficha, o mestre cria. O lápis troca o nome. */
  private renderNpcs() {
    const cards: HTMLElement[] = [];
    for (const n of this.app.state.npcs) {
      const fs = this.lista.find((f) => f.npc === n.id) ?? (this.rascunho?.npc === n.id ? this.rascunho : undefined);
      const on = !!fs && (this.rascunho ? fs === this.rascunho || fs.id === this.rascunho.id : fs.id === this.selId);
      const charId = this.charDoNpc(n);
      const look = lookDe(charId);
      const foto = look ? portraitCanvas(look, 140) : h('span', { class: 'fx-ag-sem' }, ic('pessoa'));
      const c = fs ? regras.calcular(fs.ficha) : null;
      cards.push(
        h(
          'div',
          { class: `fx-ag npc${on ? ' on' : ''}${fs ? '' : ' sem-ficha'}`, role: 'button', tabindex: 0, title: n.nome, onclick: () => this.abrirNpc(n) },
          h('span', { class: 'fx-ag-foto' }, foto),
          h(
            'span',
            { class: 'fx-ag-placa' },
            h('span', { class: 'fx-ag-nome', title: n.nome }, n.nome.split(/\s+/)[0]),
            h('span', { class: 'fx-ag-info' }, fs && c ? `NEX ${fs.ficha.nex}% · ${CLASSE_NOME(fs.ficha.classe)}` : 'Sem ficha'),
          ),
          h(
            'button',
            { class: 'fx-ag-lapis', type: 'button', 'aria-label': `Trocar o nome de ${n.nome}`, 'data-dica': 'Trocar o nome', onclick: (e: Event) => (e.stopPropagation(), this.renomearNpc(n)) },
            ic('lapis'),
          ),
          c && c.pendencias.length ? h('span', { class: 'fx-ag-pend', title: `${c.pendencias.length} pendência${c.pendencias.length > 1 ? 's' : ''}` }, String(c.pendencias.length)) : null,
        ),
      );
    }
    if (!cards.length) cards.push(h('p', { class: 'fx-ag-vazio' }, 'Nenhum NPC no Elenco ainda.'));
    this.agLista.replaceChildren(...cards);
  }

  /** Abre a ficha do NPC, ou começa uma (o mestre preenche como a de um agente). */
  private abrirNpc(n: Npc) {
    const fs = this.lista.find((f) => f.npc === n.id);
    if (fs) return this.selecionar(fs.id);
    if (this.editando) {
      toast('Salve ou cancele a edição antes de trocar.', 'error');
      return;
    }
    const f = regras.novaFicha(n.nome);
    this.rascunho = { id: 0, nome: n.nome, npc: n.id, personagem: this.charDoNpc(n), ficha: f, criadaEm: agora(), atualizadaEm: agora() };
    this.modo = 'editar';
    this.selId = null;
    sfx.paper();
    this.render();
    this.abrirAssistente(true);
  }

  /** O nome do NPC (o Felipe, 17/10: "depois eu quero conseguir colocar nome neles"): no Elenco e na ficha dele. */
  private renomearNpc(n: Npc) {
    this.editarTexto('Nome do NPC', 'Nome', n.nome, (v) => {
      if (!v || v === n.nome) return;
      this.app.net.send({ t: 'npcSalvar', npc: { ...n, nome: v } });
      const fs = this.lista.find((f) => f.npc === n.id);
      if (fs && !this.editando) {
        fs.nome = v;
        fs.ficha.nome = v;
        fs.atualizadaEm = agora();
        this.app.net.send({ t: 'fichaSalvar', ficha: fs });
      }
    });
  }

  // ---------------------------------------------------------------- corpo

  private renderCorpo(fs: FichaSalva, c: Calc) {
    const def: CharacterDef | undefined = fs.personagem ? this.app.state.characters.find((x) => x.id === fs.personagem) : undefined;
    this.corpo.setPersonagem(def);
    this.poseDoCorpo(fs);
    this.corpo.setCondicoes(vitalConditions(this.vitais(fs, c)));
    this.pCorpo.classList.toggle('sem-folha', !def);
    // a foto: a de corpo inteiro, só da ficha (foto-ficha.webp, 19/10), que cobre o quadro todo; senão o retrato
    // do agente, ou a foto que o mestre mandou do NPC
    // o NPC: a pasta da arte dele (a foto que o Felipe mandou, foto.jpg, de corpo inteiro como a dos Marcados)
    const npc = fs.npc ? this.app.state.npcs.find((n) => n.id === fs.npc) : undefined;
    const pasta = npc?.arte ?? def?.sheet?.match(/\/arte\/personagens\/([^/]+)\//)?.[1];
    const fotos = [pasta && `/arte/personagens/${pasta}/foto-ficha.webp`, pasta && `/arte/personagens/${pasta}/foto.jpg`, def?.portraits?.desarmado?.open].filter((x): x is string => !!x);
    const chave = fotos.join('|');
    if (this.corpoFoto.dataset.fotos !== chave) {
      this.corpoFoto.dataset.fotos = chave;
      let i = 0;
      this.corpoFoto.onerror = () => {
        if (++i < fotos.length) this.corpoFoto.src = fotos[i];
        else this.pCorpo.classList.remove('com-foto');
      };
      this.corpoFoto.onload = () => {
        this.pCorpo.classList.toggle('foto-cheia', /\/foto(-ficha)?\.(webp|jpg)$/.test(this.corpoFoto.src));
        this.corpoFoto.style.visibility = '';
      };
      // a foto do agente de antes não aparece enquanto a nova carrega
      this.corpoFoto.style.visibility = 'hidden';
      this.pCorpo.classList.remove('foto-cheia');
      if (fotos.length) this.corpoFoto.src = fotos[0];
    }
    this.pCorpo.classList.toggle('com-foto', fotos.length > 0);
  }

  private verMaior() {
    const fs = this.atual();
    if (!fs) return;
    const def = fs.personagem ? this.app.state.characters.find((x) => x.id === fs.personagem) : undefined;
    const v = new CorpoView();
    const j = mostrar(fs.nome, 'pessoa', [h('div', { class: 'fx-corpo grande' }, h('div', { class: 'fx-corpo-fundo' }, h('span', { class: 'fx-corpo-chao' })), v.el)], 60);
    v.setPersonagem(def);
    if (this.calc) v.setCondicoes(vitalConditions(this.vitais(fs, this.calc)));
    const obs = new MutationObserver(() => {
      if (!j.el.isConnected) {
        v.destruir();
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true });
  }

  // ---------------------------------------------------------------- identificação

  private renderIdent() {
    const fs = this.atual();
    const c = this.calc;
    if (!fs || !c) return;
    const f = fs.ficha;
    const ed = this.editando;
    void ed;
    const corpo = this.corpoDe(this.pIdent);
    const linha = (rotulo: string, valor: Node | string, acao?: () => void, dica?: string) =>
      h(
        'div',
        { class: `fx-id-l${acao ? ' clica' : ''}`, 'data-campo': rotulo },
        h('span', { class: 'fx-id-r' }, rotulo),
        acao ? h('button', { class: 'fx-id-v', type: 'button', onclick: acao, 'data-dica': dica }, valor, ic('lapis', 'ic fx-id-lapis')) : h('span', { class: 'fx-id-v', 'data-dica': dica }, valor),
      );
    const origem = f.origem ? cat.origem(f.origem) : undefined;
    const trilha = f.trilha ? cat.trilha(f.trilha) : undefined;
    const escolherF = (campo: Campo, nex: Nex) => this.acao(() => this.abrirEscolha(escolherCampo(this.rascunho!.ficha, nex, campo)));
    const r = () => this.rascunho!;
    const gmAcao = (fn: () => void) => (this.gm ? this.acao(fn) : undefined);
    const nexBar = h('span', { class: 'fx-nex' }, h('b', null, `${f.nex}%`), h('span', { class: 'fx-nex-bar' }, h('i', { style: `width:${f.nex}%` })));
    const pat = c.patente ? `${c.patente.nome}` : f.nex === 0 ? 'Pessoa comum' : '—';
    const party = this.campanha?.party.find((p) => p.look?.charId && p.look.charId === fs.personagem);
    const local = party?.roomId ? (this.campanha?.scenes.find((s) => s.id === party.roomId)?.name.split('·').pop()?.trim() ?? '—') : '—';
    const esquerda = h(
      'div',
      { class: 'fx-id-col' },
      linha('Nome', h('span', null, h('strong', null, fs.nome), f.textos?.idade ? h('small', { class: 'fx-id-idade' }, ` · ${f.textos.idade}`) : null), this.acao(() => this.editarTexto('Nome do agente', 'Nome', r().nome, (v) => ((r().nome = v || 'Sem nome'), (r().ficha.nome = r().nome))))),
      linha('Jogador', f.jogador || '—', this.acao(() => this.editarTexto('Jogador', 'Quem joga', r().ficha.jogador ?? '', (v) => (r().ficha.jogador = v || undefined)))),
      linha('Origem', origem?.nome ?? 'Escolher…', escolherF('origem', f.comecouMundano ? 0 : 5), origem ? `${origem.resumo ?? ''} (${textoRef(origem.ref)})` : undefined),
      linha('Classe', CLASSE_NOME(f.classe), escolherF('classe', 5)),
      linha('Trilha', trilha?.nome ?? (f.nex >= 10 ? 'Escolher…' : '— (NEX 10%)'), f.nex >= 10 && f.classe ? escolherF('trilha', 10) : undefined, trilha ? `${trilha.resumo ?? ''} (${textoRef(trilha.ref)})` : undefined),
    );
    const direita = h(
      'div',
      { class: 'fx-id-col' },
      linha('NEX', nexBar, gmAcao(() => this.escolherNex()), 'Nível de exposição paranormal. Só o mestre muda.'),
      linha('Patente', h('span', null, pat, h('small', null, ` ${f.pp} PP`)), gmAcao(() => this.escolherPatente()), c.patente ? `Crédito ${c.patente.credito}. Só o mestre muda os pontos de prestígio.` : undefined),
      linha('Idade', f.textos?.idade || '—', this.acao(() => this.editarTexto('Idade', 'Idade', r().ficha.textos?.idade ?? '', (v) => ((r().ficha.textos ??= {}).idade = v || undefined)))),
      linha('Tema', NOME_TEMA[fs.tema ?? 'ordem'], this.acao(() => this.escolherTema()), 'O tema da interface do agente: veste a ficha, a requisição e o celular dele.'),
      // no computador a campanha vai no título (a casa fica escondida); no celular, aqui
      linha('Campanha', this.campanha?.nomeCampanha || this.campanha?.title || '—'),
      linha('Local', local),
    );
    corpo.replaceChildren(esquerda, h('span', { class: 'fx-id-div', 'aria-hidden': 'true' }), direita, h('span', { class: 'fx-selo', 'aria-hidden': 'true' }));
    // menu do mestre
    const extra = this.extraDe(this.pIdent);
    extra.replaceChildren();
    // a campanha vai no título (17/10): é a mesma de todos os agentes, e a identificação fica em duas linhas
    const campanha = this.campanha?.nomeCampanha || this.campanha?.title;
    if (campanha) extra.append(h('span', { class: 'fx-id-camp', 'data-dica': 'Campanha' }, campanha));
    if (this.gm && fs.id) extra.append(h('button', { class: 'fx-mini', type: 'button', title: 'Mais', 'aria-label': 'Mais opções', onclick: (e: MouseEvent) => this.menuMestre(e, fs) }, ic('reticencias')));
    else if (!ed) extra.append(h('button', { class: 'fx-mini so-cel', type: 'button', title: 'Editar', 'aria-label': 'Editar', onclick: () => this.entrarEdicao() }, ic('lapis')));
  }

  private editarTexto(titulo: string, rotulo: string, valor: string, gravar: (v: string) => void) {
    void perguntarTexto(titulo, rotulo, valor).then((v) => {
      if (v === null) return;
      gravar(v.trim());
      this.render();
    });
  }

  private escolherTema() {
    const fs = this.rascunho;
    if (!fs) return;
    const ops = TEMAS.map((t) => ({ id: t, nome: NOME_TEMA[t], ok: true, motivos: [], avisos: [] }));
    void escolher(
      {
        titulo: 'Tema da interface',
        dica: 'A cor e a arte da tela do agente. Ordem é o neutro, o das telas do mestre.',
        qtd: 1,
        opcoes: () => ops,
        atual: () => [fs.tema ?? 'ordem'],
        aplicar: (ids) => {
          const t = ids[0] as (typeof TEMAS)[number] | undefined;
          if (t) fs.tema = t === 'ordem' ? undefined : t;
        },
      },
      () => this.render(),
    );
  }

  private escolherNex() {
    const fs = this.rascunho;
    if (!fs || !this.gm) return;
    const f = fs.ficha;
    const ops = regras.NEX_LISTA.filter((n) => n > 0 || f.comecouMundano).map((n) => ({ id: String(n), nome: `NEX ${n}%`, ok: true, motivos: [], avisos: [] }));
    void escolher(
      {
        titulo: 'NEX do agente',
        dica: 'Subir o NEX abre as escolhas do novo patamar (Evolução). Descer mantém as escolhas guardadas, mas elas só valem até o NEX atual.',
        qtd: 1,
        opcoes: () => ops,
        atual: () => [String(f.nex)],
        aplicar: (ids) => {
          if (ids[0]) f.nex = Number(ids[0]) as Nex;
        },
      },
      () => this.render(),
    );
  }

  private escolherPatente() {
    const fs = this.rascunho;
    if (!fs || !this.gm) return;
    const f = fs.ficha;
    const pats = cat.CATALOGO.patentes;
    const daPP = (pp: number) => [...pats].reverse().find((p) => pp >= p.pp) ?? pats[0];
    const ops = [
      ...pats.map((p, i) => {
        const prox = pats[i + 1];
        const itens = ([1, 2, 3, 4] as const).map((k) => `${romano(k)} ${p.itens[k]}`).join(' · ');
        return { id: p.id, nome: p.nome, ref: p.ref, resumo: `${prox ? `${p.pp} a ${prox.pp - 1} PP` : `${p.pp} PP ou mais`}. Crédito ${p.credito}; itens por categoria: ${itens}.`, ok: true, motivos: [], avisos: [] };
      }),
      { id: 'pp', nome: 'Pontos exatos…', resumo: `Hoje ${f.pp} PP. Digitar os pontos de prestígio; a patente sai deles.`, ok: true, motivos: [], avisos: [] },
    ];
    let exato = false;
    void escolher(
      {
        titulo: 'Patente',
        dica: 'A patente vem dos pontos de prestígio (LR p. 52). Escolher uma patente põe os PP no mínimo dela; quem já está nela fica com os pontos que tem.',
        qtd: 1,
        opcoes: () => ops,
        atual: () => [daPP(f.pp).id],
        aplicar: (ids) => {
          if (ids[0] === 'pp') return void (exato = true);
          const p = pats.find((x) => x.id === ids[0]);
          if (p && daPP(f.pp).id !== p.id) f.pp = p.pp;
        },
      },
      () => this.render(),
    ).then(() => {
      if (exato) this.editarPP();
    });
  }

  private editarPP() {
    const fs = this.rascunho;
    if (!fs || !this.gm) return;
    void perguntarTexto('Pontos de prestígio', 'PP (a patente sai deles)', String(fs.ficha.pp), 5).then((v) => {
      if (v === null) return;
      const n = Math.max(0, Math.min(9999, Math.round(Number(v.replace(',', '.')) || 0)));
      fs.ficha.pp = n;
      this.render();
    });
  }

  private menuMestre(e: MouseEvent, fs: FichaSalva) {
    e.stopPropagation();
    const chars = this.app.state.characters;
    const link = fs.chave ? `${location.origin}/?ficha=${fs.chave}` : null;
    const conteudo: Node[] = [];
    // link do jogador
    const linkBox = h('div', { class: 'fj-link' });
    const desenharLink = (url: string | null) => {
      linkBox.replaceChildren(
        url ? h('input', { class: 'fx-inp', value: url, readonly: true, onfocus: (ev: Event) => (ev.target as HTMLInputElement).select() }) : h('p', { class: 'fj-texto' }, 'Ainda sem link. Gere um para mandar ao jogador: ele abre a própria ficha no celular.'),
        h(
          'div',
          { class: 'fj-linha' },
          url ? h('button', { class: 'fx-bt', type: 'button', onclick: () => void navigator.clipboard?.writeText(url).then(() => toast('Link copiado.')) }, ic('copiar'), h('span', null, 'Copiar')) : null,
          h('button', { class: 'fx-bt', type: 'button', onclick: () => (this.app.net.send({ t: 'fichaLink', id: fs.id }), toast(url ? 'Link novo gerado: o antigo parou de valer.' : 'Link gerado.')) }, ic('link'), h('span', null, url ? 'Gerar outro' : 'Gerar link')),
        ),
      );
    };
    desenharLink(link);
    conteudo.push(h('h4', { class: 'fj-sub' }, 'Link do jogador'), linkBox);
    // personagem do tabuleiro
    const sel = h('select', { class: 'fx-inp' }, h('option', { value: '' }, '— nenhum —'), ...chars.map((ch) => h('option', { value: String(ch.id), selected: ch.id === fs.personagem }, ch.name))) as HTMLSelectElement;
    sel.addEventListener('change', () => {
      const c = clone(fs);
      c.personagem = sel.value ? Number(sel.value) : undefined;
      this.salvarJogo(c);
      this.render();
    });
    conteudo.push(h('h4', { class: 'fj-sub' }, 'Personagem do tabuleiro'), h('p', { class: 'fj-texto' }, 'Ligada a um personagem, a ficha manda PV, PE e SAN para a peça, e o retrato e o corpo saem da folha dele.'), sel);
    // apagar
    conteudo.push(
      h('h4', { class: 'fj-sub' }, 'Apagar'),
      h(
        'button',
        {
          class: 'fx-bt perigo',
          type: 'button',
          onclick: async () => {
            if (!(await confirmar('APAGAR FICHA?', `A ficha de ${fs.nome} some para sempre (o banco guarda cópias pelo backup).`, 'Apagar', true))) return;
            this.app.net.send({ t: 'fichaApagar', id: fs.id });
            j.fechar();
          },
        },
        ic('lixo'),
        h('span', null, 'Apagar esta ficha'),
      ),
    );
    const j = mostrar(`Ficha de ${fs.nome}`, 'engrenagem', conteudo, 56);
    // quando o link novo chegar, atualiza a janela
    const olhar = window.setInterval(() => {
      if (!j.el.isConnected) return clearInterval(olhar);
      const nova = this.lista.find((x) => x.id === fs.id)?.chave;
      if (nova && nova !== fs.chave) {
        fs.chave = nova;
        desenharLink(`${location.origin}/?ficha=${nova}`);
      }
    }, 400);
  }

  // ---------------------------------------------------------------- atributos

  private renderAtrib(fs: FichaSalva, c: Calc) {
    const f = fs.ficha;
    const ed = this.editando;
    const corpo = this.corpoDe(this.pAtrib);
    const pts = pontosAtributo(f);
    const linhas = regras.ATRIBUTOS.map((a) => {
      const base = f.atributos[a];
      const final = c.atributos[a];
      const aumentos = final - base;
      // fora da edição, o mestre mexe livre (o ponto tirado vira a pendência "Distribua 1 ponto"), sempre dentro dos
      // limites da criação (0 a 3, só um em 0, os pontos contados); o jogador só põe o ponto que ficou pendente
      // (o Felipe, 17/10: "eu como mestre quero poder mudar a ficha de todo mundo livremente, mantendo as regras")
      const pode = (d: 1 | -1) => podeMudarAtributo(f, a, d) && (ed || this.gm || (d > 0 && pts.gastos < pts.total));
      const mudar = (d: 1 | -1) => {
        if (!pode(d)) return sfx.denied();
        sfx.tick();
        if (ed) {
          f.atributos[a] += d;
          this.render();
        } else this.mudar((x) => (x.ficha.atributos[a] += d));
      };
      return h(
        'div',
        { class: 'fx-at' },
        h('span', { class: 'fx-at-ic' }, arte(`/arte/icones/${a}.png`, ICONE_ATR[a])),
        h('span', { class: 'fx-at-n', 'data-dica': NOME_ATR_LONGO[a] }, NOME_ATR[a]),
        h('b', { class: 'fx-at-v', 'data-dica': aumentos ? `${base} na criação ${sinal(aumentos)} pelo NEX e poderes` : `${base} na criação` }, String(final)),
        h('button', { class: 'fx-q', type: 'button', disabled: !pode(-1), 'aria-label': `Menos ${NOME_ATR_LONGO[a]}`, onclick: () => mudar(-1) }, ic('menos')),
        h('button', { class: 'fx-q', type: 'button', disabled: !pode(1), 'aria-label': `Mais ${NOME_ATR_LONGO[a]}`, onclick: () => mudar(1) }, ic('mais')),
      );
    });
    corpo.replaceChildren(...linhas);
    const extra = this.extraDe(this.pAtrib);
    extra.replaceChildren(ed || pts.gastos < pts.total ? h('span', { class: `fx-pontos${pts.gastos === pts.total ? ' ok' : ''}`, 'data-dica': 'Pontos da criação: cada atributo começa em 1; um pode cair para 0 e dar um ponto a mais.' }, `${pts.total - pts.gastos} pts`) : '');
  }

  // ---------------------------------------------------------------- recursos

  private renderRec(fs: FichaSalva, c: Calc) {
    const v = this.vitais(fs, c);
    const corpo = this.corpoDe(this.pRec);
    // a FICHAS do mestre é a das regras: só os máximos. O que acontece em jogo (PV, PE e SAN de agora,
    // as condições) fica na lateral do MAPA e no celular do jogador, que continua com as barras.
    if (!this.o.jogador) {
      // a placa com o número, e embaixo dela, fora, o nome curto (o Felipe, 17/10: o desenho com PV, PE e SAN)
      const caixa = (k: 'pv' | 'pe' | 'san', rotulo: string, icone: NomeIcone, dica: string) =>
        h(
          'div',
          { class: `fx-rec-c ${k}`, 'data-dica': dica },
          h('div', { class: `fx-dv ${k}` }, h('span', { class: 'fx-dv-ic' }, arte(`/arte/icones/${k}.png`, icone)), h('span', { class: 'fx-dv-t' }, caberNumaLinha(h('b', { class: 'fx-dv-v' }, String(v[`${k}Max` as const])), 0.7))),
          h('span', { class: 'fx-rec-nome' }, rotulo),
        );
      corpo.replaceChildren(
        caixa('pv', 'PV', 'coracao', 'Pontos de vida (o máximo): os da classe, mais o Vigor, e o que cada NEX soma.'),
        caixa('pe', 'PE', 'cerebro', 'Pontos de esforço (o máximo): os da classe, mais a Presença, e o que cada NEX soma.'),
        caixa('san', 'SAN', 'espiral', 'Sanidade (o máximo): a da classe e o que cada NEX soma.'),
      );
      return;
    }
    const linha = (k: 'pv' | 'pe' | 'san', rotulo: string, icone: NomeIcone) => {
      const atual = v[k];
      const max = v[`${k}Max` as const];
      const temp = fs.atual?.[`${k}Temp` as const] ?? 0;
      const pct = Math.max(0, Math.min(100, (atual / Math.max(1, max)) * 100));
      const mexer = (d: number) => {
        this.mudar((x) => {
          const a = x.atual ?? { pv: c.pv, pe: c.pe, san: c.san };
          // o temporário some primeiro quando perde (LR p. 88)
          let delta = d;
          const tk = `${k}Temp` as const;
          if (delta < 0 && a[tk]) {
            const usa = Math.min(a[tk]!, -delta);
            a[tk] = a[tk]! - usa || undefined;
            delta += usa;
          }
          a[k] = Math.max(0, Math.min(max, a[k] + delta));
          x.atual = a;
        });
        sfx.tick();
      };
      return h(
        'div',
        { class: `fx-rc ${k}` },
        h('span', { class: `fx-rc-ic ${k}` }, arte(`/arte/icones/${k}.png`, icone)),
        h('span', { class: 'fx-rc-n' }, rotulo),
        h(
          'button',
          { class: `fx-bar ${k}`, type: 'button', title: 'Mudar o valor', onclick: () => this.editarVital(fs, k, rotulo, max) },
          h('i', { style: `width:${pct}%` }),
          h('span', null, `${atual} / ${max}`, temp ? h('em', null, ` +${temp}`) : null),
        ),
        h('button', { class: 'fx-q', type: 'button', 'aria-label': `Menos ${rotulo}`, title: 'Shift: 5', onclick: (e: MouseEvent) => mexer(e.shiftKey ? -5 : -1) }, ic('menos')),
        h('button', { class: 'fx-q', type: 'button', 'aria-label': `Mais ${rotulo}`, title: 'Shift: 5', onclick: (e: MouseEvent) => mexer(e.shiftKey ? 5 : 1) }, ic('mais')),
      );
    };
    corpo.replaceChildren(linha('pv', 'PV', 'coracao'), linha('pe', 'PE', 'cerebro'), linha('san', 'SAN', 'espiral'));
  }

  private editarVital(fs: FichaSalva, k: 'pv' | 'pe' | 'san', rotulo: string, max: number) {
    const c = this.calc;
    if (!c) return;
    const v = this.vitais(fs, c);
    const tk = `${k}Temp` as const;
    const j = janela(`${rotulo} de ${fs.nome}`, k === 'pv' ? 'coracao' : k === 'pe' ? 'cerebro' : 'espiral', () => {}, 40);
    const inpA = h('input', { class: 'fx-inp', type: 'number', value: String(v[k]), min: 0, max }) as HTMLInputElement;
    const inpT = h('input', { class: 'fx-inp', type: 'number', value: String(fs.atual?.[tk] ?? 0), min: 0, max: 999 }) as HTMLInputElement;
    j.corpo.append(
      h('p', { class: 'fj-dica' }, `Máximo ${max}, calculado pela ficha.`),
      h('label', { class: 'fj-campo' }, h('span', null, 'Atual'), inpA),
      h('label', { class: 'fj-campo' }, h('span', null, 'Temporário (some primeiro)'), inpT),
    );
    const ok = () => {
      this.mudar((x) => {
        const a = x.atual ?? { pv: c.pv, pe: c.pe, san: c.san };
        a[k] = Math.max(0, Math.min(max, Math.round(Number(inpA.value) || 0)));
        const t = Math.max(0, Math.round(Number(inpT.value) || 0));
        a[tk] = t || undefined;
        x.atual = a;
      });
      j.fechar();
    };
    for (const i of [inpA, inpT]) i.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
    j.rodape.append(h('span', { class: 'fj-esp' }), h('button', { class: 'fx-bt', type: 'button', onclick: () => j.fechar() }, ic('fechar'), h('span', null, 'Cancelar')), h('button', { class: 'fx-bt forte', type: 'button', onclick: ok }, ic('ok'), h('span', null, 'Gravar')));
    setTimeout(() => (inpA.focus(), inpA.select()), 30);
  }

  // ---------------------------------------------------------------- derivados

  private renderDeriv(c: Calc) {
    const corpo = this.corpoDe(this.pDeriv);
    const res = resistenciasParaMostrar(c.resistencias).map(([t, v]) => `${nomeDano(t)} ${v}`);
    const caixa = (icone: NomeIcone, rotulo: string, valor: string, dica: string, url: string) =>
      h('div', { class: 'fx-dv', 'data-dica': dica }, h('span', { class: 'fx-dv-ic' }, arte(url, icone)), h('span', { class: 'fx-dv-t' }, h('span', { class: 'fx-dv-r' }, rotulo), caberNumaLinha(h('b', { class: 'fx-dv-v' }, valor), 0.7)));
    corpo.replaceChildren(
      caixa('escudoEstrela', 'DEFESA', String(c.defesa), `10 + Agilidade + proteção${c.carga.sobrecarregado ? ' − 5 (sobrecarregado)' : ''}.`, '/arte/icones/defesa.png'),
      caixa('bota', 'DESLOCAMENTO', `${c.deslocamento}\u2009m`, c.carga.sobrecarregado ? 'Sobrecarregado: −3 m.' : 'Por rodada, com uma ação de movimento.', '/arte/icones/deslocamento.png'),
      caixa('colete', 'PROTEÇÃO', String(c.protecao ?? 0), 'Defesa que vem da proteção vestida (e do escudo).', '/arte/icones/protecao.png'),
      h('div', { class: 'fx-dv largo', 'data-dica': res.length ? res.join(', ') : 'Sem resistência a dano.' }, h('span', { class: 'fx-dv-ic' }, arte('/arte/icones/resistencias.png', 'escudo')), h('span', { class: 'fx-dv-t' }, h('span', { class: 'fx-dv-r' }, 'RESISTÊNCIAS'), h('span', { class: 'fx-dv-l' }, res.length ? res.join(', ') : '—'))),
    );
  }

  // ---------------------------------------------------------------- condições

  private renderCond(fs: FichaSalva, c: Calc) {
    // as condições são do jogo, não das regras: na FICHAS do mestre não aparecem
    this.pCond.classList.toggle('hidden', !this.o.jogador);
    if (!this.o.jogador) return;
    const v = this.vitais(fs, c);
    const auto = vitalConditions(v);
    const marcadas = new Set(fs.condicoes ?? []);
    const autoAtivas = AUTOMATICAS.filter((k) => auto[k as keyof typeof auto]);
    const nada = !autoAtivas.length && !marcadas.size;
    const chip = (id: string, nome: string, icone: NomeIcone, on: boolean, clicavel: boolean, extraCls = '') =>
      h(
        'button',
        {
          class: `fx-ch${on ? ' on' : ''}${extraCls}`,
          type: 'button',
          disabled: !clicavel,
          'data-dica': cat.condicao(id)?.resumo ?? (id === 'normal' ? 'Sem condição.' : ''),
          onclick: () => {
            if (!clicavel) return;
            this.mudar((x) => {
              const s = new Set(x.condicoes ?? []);
              if (s.has(id)) s.delete(id);
              else s.add(id);
              x.condicoes = [...s];
              if (!x.condicoes.length) delete x.condicoes;
            });
            sfx.click();
          },
        },
        ic(icone),
        h('span', null, nome),
      );
    const chips: HTMLElement[] = [chip('normal', 'Normal', 'normal', nada, false, ' normal')];
    for (const r of RAPIDAS) {
      if (r.id === 'machucado') {
        const morrendo = auto.morrendo;
        chips.push(chip(morrendo ? 'morrendo' : 'machucado', morrendo ? 'Morrendo' : 'Machucado', morrendo ? 'caveira' : 'gota', auto.machucado || morrendo, false, ' auto'));
      } else chips.push(chip(r.id, r.nome, r.icone, marcadas.has(r.id), true));
    }
    const outras = [...autoAtivas.filter((k) => k === 'perturbado' || k === 'enlouquecendo'), ...[...marcadas].filter((k) => !RAPIDAS.some((r) => r.id === k))];
    const outro = h(
      'button',
      { class: `fx-ch${outras.length ? ' on' : ''}`, type: 'button', 'data-dica': outras.length ? outras.map((k) => cat.condicao(k)?.nome ?? k).join(', ') : 'Todas as condições do livro.', onclick: () => this.escolherCondicoes() },
      ic('mais3'),
      h('span', null, outras.length ? `Outro (${outras.length})` : 'Outro'),
    );
    chips.push(outro);
    this.corpoDe(this.pCond).replaceChildren(...chips);
  }

  private escolherCondicoes() {
    const fs = this.atual();
    if (!fs) return;
    void escolher(
      {
        titulo: 'Condições',
        dica: 'Machucado, morrendo, perturbado e enlouquecendo saem sozinhos pelo PV e pela SAN (LR p. 310–311).',
        qtd: 40,
        podeVazio: true,
        opcoes: () =>
          cat.CATALOGO.condicoes.map((x) => ({
            id: x.id,
            nome: x.nome,
            ref: x.ref,
            resumo: x.resumo,
            ok: !x.automatica,
            motivos: x.automatica ? ['Sai sozinha pela ficha.'] : [],
            avisos: x.inclui?.length ? [`Inclui: ${x.inclui.map((i) => cat.condicao(i)?.nome ?? i).join(', ')}.`] : [],
          })),
        atual: () => fs.condicoes ?? [],
        aplicar: (ids) =>
          this.mudar((x) => {
            x.condicoes = ids.filter((i) => !AUTOMATICAS.includes(i));
            if (!x.condicoes.length) delete x.condicoes;
          }, false),
      },
      () => this.render(),
    );
  }

  // ---------------------------------------------------------------- perícias

  private renderPer(fs: FichaSalva, c: Calc) {
    const ed = this.editando || this.gm;
    const corpo = this.corpoDe(this.pPer);
    const cab = h('div', { class: 'fx-tab-cab' }, h('span', null, 'PERÍCIA'), h('span', null, 'GRAU'), h('span', null, 'ATR.'), h('span', null, 'TESTE'));
    const linhas: HTMLElement[] = [];
    for (const p of cat.CATALOGO.pericias) {
      const pc = c.pericias[p.id];
      if (this.soTreinadas && pc.grau === 'destreinado') continue;
      const nome = p.id === 'profissao' && fs.ficha.profissao ? `Profissão (${fs.ficha.profissao})` : p.nome;
      const marcas = [p.somenteTreinada ? 'só treinada' : '', p.carga ? 'carga' : ''].filter(Boolean).join(', ');
      linhas.push(
        h(
          ed ? 'button' : 'div',
          {
            class: `fx-tab-l${pc.grau !== 'destreinado' ? ' treinada' : ''}${!pc.podeUsar ? ' nao-usa' : ''}`,
            type: ed ? 'button' : undefined,
            onclick: ed ? this.acao(() => this.editarPericias()) : undefined,
            'data-dica': `${p.nome} (${NOME_ATR_LONGO[pc.atributo]})${marcas ? ` · ${marcas}` : ''} · ${NOME_GRAU[pc.grau]} · ${textoRef(p.ref)}`,
          },
          h('span', { class: 'fx-tab-n' }, nome),
          h('span', { class: `fx-grau ${pc.grau}` }, GRAU_CURTO[pc.grau]),
          h('span', null, NOME_ATR[pc.atributo]),
          h('b', null, pc.podeUsar ? textoTeste(pc.dados, pc.bonus, pc.penalidadeDados) : '—'),
        ),
      );
    }
    corpo.replaceChildren(h('div', { class: 'fx-tab-cabs' }, cab, cab.cloneNode(true)), avisarRolagem(h('div', { class: 'fx-tab-rol' }, ...linhas)));
    this.extraDe(this.pPer).replaceChildren(
      h('button', { class: `fx-mini txt${this.soTreinadas ? ' on' : ''}`, type: 'button', title: 'Mostrar só as treinadas', onclick: () => ((this.soTreinadas = !this.soTreinadas), this.render()) }, this.soTreinadas ? 'Treinadas' : 'Todas'),
    );
  }

  /** Perícias da criação: as da origem, as fixas e os grupos da classe, e as livres. */
  /** As perícias da criação: numa janela ou, no assistente, dentro de `alvo`. */
  private editarPericias(alvo?: HTMLElement) {
    const fs = this.rascunho;
    if (!fs) return;
    const f = fs.ficha;
    const info = periciasCriacao(f);
    const j = alvo ? null : janela('Perícias treinadas (criação)', 'dados', () => this.render(), 72);
    const corpo = alvo ?? h('div', { class: 'fj-per' });
    if (alvo) corpo.classList.add('fj-per');
    const desenhar = () => {
      const info2 = periciasCriacao(f);
      const livres = new Set(f.pericias.livres);
      const tomadas = new Set<regras.PericiaId>([...info2.origem, ...info2.fixas, ...f.pericias.grupos]);
      const secoes: Node[] = [];
      secoes.push(
        h('h4', { class: 'fj-sub' }, `Origem${f.origem ? `: ${cat.origem(f.origem)?.nome}` : ''}`),
        info2.origemEscolha
          ? h(
              'div',
              { class: 'fj-chips' },
              ...cat.CATALOGO.pericias.map((p) => {
                const on = (f.pericias.origem ?? []).includes(p.id);
                return h(
                  'button',
                  {
                    class: `fj-chip${on ? ' on' : ''}`,
                    type: 'button',
                    onclick: () => {
                      const s = new Set(f.pericias.origem ?? []);
                      if (s.has(p.id)) s.delete(p.id);
                      else if (s.size < info2.origemEscolha) s.add(p.id);
                      f.pericias.origem = [...s];
                      desenhar();
                    },
                  },
                  p.nome,
                );
              }),
            )
          : h('p', { class: 'fj-texto' }, info2.origem.length ? info2.origem.map((p) => cat.pericia(p).nome).join(' e ') : 'Escolha a origem primeiro.'),
      );
      if (info2.fixas.length) secoes.push(h('h4', { class: 'fj-sub' }, 'Da classe'), h('p', { class: 'fj-texto' }, info2.fixas.map((p) => cat.pericia(p).nome).join(' e ')));
      info2.grupos.forEach((g) => {
        secoes.push(
          h('h4', { class: 'fj-sub' }, `Da classe: ${g.map((p) => cat.pericia(p).nome).join(' ou ')}`),
          h(
            'div',
            { class: 'fj-chips' },
            ...g.map((p) => {
              const on = f.pericias.grupos.includes(p);
              return h(
                'button',
                {
                  class: `fj-chip${on ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    f.pericias.grupos = [...f.pericias.grupos.filter((x) => !g.includes(x)), p];
                    f.pericias.livres = f.pericias.livres.filter((x) => x !== p);
                    desenhar();
                  },
                },
                cat.pericia(p).nome,
              );
            }),
          ),
        );
      });
      secoes.push(
        h('h4', { class: 'fj-sub' }, `À escolha: ${livres.size} de ${info2.livres}`, h('small', null, ' (as da classe + Intelecto; perícia repetida entre classe e origem vira uma a mais)')),
        h(
          'div',
          { class: 'fj-chips' },
          ...cat.CATALOGO.pericias.map((p) => {
            const on = livres.has(p.id);
            const tomada = tomadas.has(p.id);
            return h(
              'button',
              {
                class: `fj-chip${on ? ' on' : ''}${tomada ? ' tomada' : ''}`,
                type: 'button',
                disabled: tomada && !on,
                title: tomada ? 'Já vem da origem ou da classe.' : '',
                onclick: () => {
                  if (on) livres.delete(p.id);
                  else if (livres.size < info2.livres) livres.add(p.id);
                  else return sfx.denied();
                  f.pericias.livres = [...livres];
                  desenhar();
                },
              },
              p.nome,
            );
          }),
        ),
      );
      if (livres.has('profissao') || tomadas.has('profissao'))
        secoes.push(
          h('h4', { class: 'fj-sub' }, 'Profissão'),
          h('input', { class: 'fx-inp', value: f.profissao ?? '', placeholder: 'Ex.: historiador, advogado…', maxlength: 40, oninput: (e: Event) => (f.profissao = (e.target as HTMLInputElement).value || undefined) }),
        );
      corpo.replaceChildren(...secoes);
    };
    void info;
    desenhar();
    if (!j) return;
    j.corpo.append(corpo);
    j.rodape.append(h('span', { class: 'fj-esp' }), h('button', { class: 'fx-bt forte', type: 'button', onclick: () => j.fechar() }, ic('ok'), h('span', null, 'Pronto')));
  }

  // ---------------------------------------------------------------- poderes

  private renderPod(fs: FichaSalva, c: Calc) {
    const f = fs.ficha;
    const corpo = this.corpoDe(this.pPod);
    // o ícone pintado de cada grupo (os mesmos dos filtros do celular: classe, trilha, origem, paranormal)
    const PINTADO_GRUPO: Partial<Record<NomeIcone, string>> = { ficha: 'poder-origem', estrela: 'poder-classe', pino: 'poder-trilha', olho: 'poder-paranormal' };
    const grupo = (titulo: string, itens: regras.PoderObtido[], icone: NomeIcone) => {
      if (!itens.length) return null;
      const pint = PINTADO_GRUPO[icone];
      const icp = () => (pint ? arteOu([`/arte/icones/${pint}.png`], ic(icone)) : ic(icone));
      return h(
        'div',
        { class: 'fx-pg' },
        h('h4', null, titulo),
        ...itens.map((p) => {
          const info = infoPoder(p);
          const chave = regras.chaveDia.poder(p.id);
          return h(
            'div',
            { class: 'fx-pi clica', role: 'button', tabindex: 0, 'data-dica': info, onclick: () => this.janelaDia(p.nome, icone, info, chave) },
            h('span', { class: 'fx-pi-ic' }, icp()),
            h('span', { class: 'fx-pi-n' }, p.nome, p.escolha ? h('small', null, ` ${textoValor(p.escolha)}`) : null),
            bolinhasDia(f, chave, (u) => this.marcarDia(chave, u)),
          );
        }),
      );
    };
    const origem = f.origem ? cat.origem(f.origem) : undefined;
    const trilha = f.trilha ? cat.trilha(f.trilha) : undefined;
    const doTipo = (t: regras.OrigemPoder) => c.poderes.filter((p) => p.tipo === t);
    const classe = [...doTipo('habilidade'), ...doTipo('classe')];
    corpo.replaceChildren(
      ...[
        grupo(`Origem – ${origem?.nome ?? '—'}`, doTipo('origem'), 'ficha'),
        grupo(`Classe – ${CLASSE_NOME(f.classe)}`, classe, 'estrela'),
        grupo(`Trilha – ${trilha?.nome ?? '—'}`, doTipo('trilha'), 'pino'),
        grupo('Paranormais', doTipo('paranormal'), 'olho'),
      ].filter((x): x is HTMLDivElement => !!x),
    );
    if (!c.poderes.length) corpo.append(h('p', { class: 'fx-nada' }, 'Sem poderes ainda.'));
  }

  /** Marca o uso de hoje de um poder, ritual ou item: grava na hora, como PV e condições. */
  private marcarDia(chave: string, usos: number) {
    this.mudar((x) => regras.marcarUsosDia(x.ficha, chave, usos));
  }

  /** A janela de um poder ou ritual: o que faz e, para o mestre, quantas vezes vale por dia (19/10). */
  private janelaDia(titulo: string, icone: NomeIcone, texto: string, chave: string) {
    const j = mostrar(titulo, icone, [], 52);
    const pintar = () => {
      const f = this.atual()?.ficha;
      if (!f) return;
      j.corpo.replaceChildren(
        h('p', { class: 'fj-texto' }, texto),
        blocoDia(
          f,
          chave,
          this.gm,
          (n) => (this.mudar((x) => regras.definirLimiteDia(x.ficha, chave, n)), pintar()),
          (u) => (this.marcarDia(chave, u), pintar()),
        ) ?? '',
      );
    };
    pintar();
  }

  // ---------------------------------------------------------------- rituais

  private renderRit(fs: FichaSalva, c: Calc) {
    const f = fs.ficha;
    const corpo = this.corpoDe(this.pRit);
    const max = f.classe ? regras.circuloMaximo(c.classe, f.nex) : 0;
    const pend = c.pendencias.filter((p) => p.tipo === 'ritual');
    const rows: HTMLElement[] = [];
    for (const circ of [1, 2, 3, 4] as const) {
      const conhecidos = c.rituais.filter((r) => cat.ritual(r.id)?.circulo === circ);
      const slots: HTMLElement[] = conhecidos.map((r) => {
        const rit = cat.ritual(r.id)!;
        const chave = regras.chaveDia.ritual(rit.id);
        return h(
          'div',
          { class: 'fx-rt', role: 'button', tabindex: 0, style: `--cor:${COR_ELEMENTO[rit.elemento]}`, 'data-dica': infoRitual(rit, c), 'aria-label': rit.nome, onclick: () => this.janelaDia(rit.nome, 'pentagrama', infoRitual(rit, c), chave) },
          sigiloComArte(rit.elemento),
          h('span', { class: 'fx-rt-n' }, rit.nome),
          bolinhasDia(f, chave, (u) => this.marcarDia(chave, u)),
        );
      });
      const liberado = circ <= Math.max(max, c.rituais.length ? 1 : 0);
      const podeAqui = liberado && pend.length > 0;
      const vazios = Math.max(0, 3 - slots.length) || (podeAqui ? 1 : 0);
      for (let i = 0; i < vazios; i++)
        slots.push(
          h(
            'button',
            {
              class: `fx-rt vazio${podeAqui && i === 0 ? ' pode' : ''}`,
              type: 'button',
              disabled: !(podeAqui && i === 0),
              'data-dica': !liberado ? (f.classe === 'ocultista' ? `Liberado em NEX ${cat.classe('ocultista').rituais?.circulos[circ]}%.` : 'Rituais vêm do ocultista ou de Aprender Ritual.') : podeAqui ? 'Aprender ritual' : '',
              onclick: () => this.adicionarRitual(),
            },
            ic('mais'),
          ),
        );
      rows.push(h('div', { class: `fx-rc-circ${liberado ? '' : ' travado'}` }, h('h4', null, `CÍRCULO ${circ}`, !liberado ? ic('cadeado') : null), h('div', { class: 'fx-rt-lista' }, ...slots)));
    }
    const paran = c.poderes.filter((p) => p.tipo === 'paranormal');
    corpo.replaceChildren(...rows, paran.length ? h('div', { class: 'fx-rit-par' }, h('h4', null, 'PODERES PARANORMAIS'), ...paran.map((p) => {
              const chave = regras.chaveDia.poder(p.id);
              return h('div', { class: 'fx-pi clica', role: 'button', tabindex: 0, 'data-dica': infoPoder(p), onclick: () => this.janelaDia(p.nome, 'olho', infoPoder(p), chave) }, h('span', { class: 'fx-pi-ic' }, ic('olho')), h('span', { class: 'fx-pi-n' }, p.nome), bolinhasDia(f, chave, (u) => this.marcarDia(chave, u)));
            })) : '');
    this.extraDe(this.pRit).replaceChildren(c.rituais.length || f.classe === 'ocultista' ? h('span', { class: 'fx-dt', 'data-dica': 'DT dos rituais: 10 + limite de PE + Presença.' }, `DT ${c.dtRituais}`) : '');
  }

  // ---------------------------------------------------------------- tático

  /** Os números do combate (no papel de Atributos e combate) e a linha da evolução (na aba dela). */
  private renderTat(fs: FichaSalva, c: Calc) {
    const pend = c.pendencias.length;
    const erros = c.problemas.filter((p) => p.severidade === 'erro').length;
    const avisos = c.problemas.length - erros;
    const ini = c.pericias.iniciativa;
    const cel = (rotulo: string, valor: string, dica: string) => h('div', { class: 'fx-tc', 'data-dica': dica }, h('span', null, rotulo), caberNumaLinha(h('b', null, valor), 0.7));
    const profs = c.proficiencias.map(nomeProf).join(', ') || '—';
    this.pTat.replaceChildren(
      h(
        'div',
        { class: 'fx-tat-corpo' },
        cel('INICIATIVA', textoTeste(ini.dados, ini.bonus, ini.penalidadeDados), 'Teste de Iniciativa (Agilidade).'),
        cel('ESQUIVA', c.reacoes.esquiva !== null ? String(c.reacoes.esquiva) : '—', 'Reação (treinado em Reflexos): Defesa + bônus de Reflexos contra um ataque.'),
        cel('BLOQUEIO', c.reacoes.bloqueio !== null ? `RD ${c.reacoes.bloqueio}` : '—', 'Reação (treinado em Fortitude): resistência a dano igual ao bônus de Fortitude contra um ataque corpo a corpo.'),
        cel('CONTRA-ATAQUE', c.reacoes.contraAtaque ? 'Sim' : '—', 'Reação (treinado em Luta): quando um ataque corpo a corpo erra você.'),
        cel('LIMITE PE', `${c.limitePe}/turno`, 'Quantos PE pode gastar por turno.'),
        cel('DT RITUAIS', String(c.dtRituais), '10 + limite de PE + Presença.'),
        h('div', { class: 'fx-tc largo', 'data-dica': profs }, h('span', null, 'PROFICIÊNCIAS'), h('b', null, profs)),
      ),
    );
    const f = fs.ficha;
    // a Evolução (o Felipe, 17/10: "essa aba tá horrível"): um cartão por NEX, do mais novo para o mais velho, com o que
    // ele deu, o que falta escolher (com o botão) e o que quebra regra; em cima, o resumo e o Ver tudo
    const cartoes: Node[] = [];
    for (const n of regras.NEX_LISTA.filter((x) => x <= f.nex && (x > 0 || f.comecouMundano)).reverse()) {
      const pends = c.pendencias.filter((p) => p.nex === n);
      const probs = c.problemas.filter((p) => p.nex === n);
      const feito = feitoNoNex(f, n, c);
      const er = probs.some((p) => p.severidade === 'erro');
      const estado = pends.length ? 'pend' : er ? 'erro' : probs.length ? 'aviso' : 'ok';
      const selo = pends.length ? `${pends.length} a escolher` : er ? 'Erro' : probs.length ? 'Aviso' : 'Completo';
      cartoes.push(
        h(
          'div',
          { class: `fx-evc ${estado}` },
          h('div', { class: 'fx-evc-cab' }, h('b', null, n === 0 ? 'Mundano' : `NEX ${n}%`), h('span', { class: 'fx-evc-selo' }, selo)),
          ...pends.map((p) =>
            h(
              'div',
              { class: 'fx-evc-l pend' },
              ic('alerta'),
              h('span', null, p.texto),
              h('button', { class: 'fx-bt mini', type: 'button', onclick: () => this.abrirEvolucao(n) }, 'Escolher'),
            ),
          ),
          ...probs.map((p) => h('div', { class: `fx-evc-l ${p.severidade}` }, ic('alerta'), h('span', null, p.texto))),
          ...feito.map((t) => h('div', { class: 'fx-evc-l ok' }, ic('ok'), h('span', null, t.texto))),
          !pends.length && !probs.length && !feito.length ? h('div', { class: 'fx-evc-l vazio' }, h('span', null, 'Nada neste NEX.')) : null,
        ),
      );
    }
    this.corpoDe(this.pEvol).replaceChildren(
      h(
        'div',
        { class: `fx-ev-res${pend ? ' pend' : erros ? ' erro' : ''}` },
        h('span', null, pend ? `${pend} escolha${pend > 1 ? 's' : ''} pendente${pend > 1 ? 's' : ''}` : 'Tudo escolhido', erros ? ` · ${erros} erro${erros > 1 ? 's' : ''}` : '', avisos ? ` · ${avisos} aviso${avisos > 1 ? 's' : ''}` : ''),
        h('button', { class: 'fx-bt mini', type: 'button', onclick: () => this.abrirEvolucao() }, ic('linhaTempo'), h('span', null, 'Ver tudo')),
      ),
      ...(f.avisos?.length ? [h('div', { class: 'fx-evc aviso' }, h('div', { class: 'fx-evc-cab' }, h('b', null, 'Avisos para o jogador'), h('span', { class: 'fx-evc-selo' }, String(f.avisos.length))), ...f.avisos.map((t) => h('div', { class: 'fx-evc-l aviso' }, ic('alerta'), h('span', null, t))))] : []),
      h('div', { class: 'fx-evc-lista' }, ...cartoes),
    );
  }

  /** O personagem grande na pose do tabuleiro: com a arma na mão, armado; com menos da metade dos PV, machucado. */
  private poseDoCorpo(fs: FichaSalva) {
    const v = this.vitais(fs, regras.calcular(fs.ficha));
    const armado = fs.ficha.inventario.some((it) => it.tipo === 'arma' && regras.lugarDoItem(it) === 'mao');
    this.corpo.setEstado(armado, v.pv < v.pvMax / 2);
  }

  /** As abas do painel da direita: só a escolhida aparece (no celular, todas, uma embaixo da outra). */
  private renderAbas(c: Calc) {
    const temComp = !this.el.classList.contains('sem-comp');
    const pend = c.pendencias.length + c.problemas.filter((p) => p.severidade === 'erro').length;
    const abas: [AbaGrupo, string, HTMLElement, number][] = [
      ['poderes', 'PODERES', this.pPod, 0],
      ['rituais', 'RITUAIS', this.pRit, c.pendencias.filter((p) => p.tipo === 'ritual').length],
      ['companheiro', 'COMPANHEIRO', this.pComp, 0],
      ['anotacoes', 'ANOTAÇÕES', this.pNotas, 0],
      ['evolucao', 'EVOLUÇÃO', this.pEvol, pend],
    ];
    if (this.abaGrupo === 'companheiro' && !temComp) this.abaGrupo = 'poderes';
    // a aba sem nada (o agente sem rituais): não abre; avisa e o aviso some sozinho (o Felipe, 17/10)
    const ocultistaEditando = this.editando && this.atual()?.ficha.classe === 'ocultista';
    const vazia = (id: AbaGrupo) => id === 'rituais' && !c.rituais.length && !c.pendencias.some((p) => p.tipo === 'ritual') && !ocultistaEditando;
    if (vazia(this.abaGrupo)) this.abaGrupo = 'poderes';
    this.abasNav.replaceChildren(
      ...abas
        .filter(([id]) => id !== 'companheiro' || temComp)
        .map(([id, nome, , n]) =>
          h(
            'button',
            {
              class: `fx-g-aba${this.abaGrupo === id ? ' on' : ''}${vazia(id) ? ' vazia' : ''}`,
              type: 'button',
              role: 'tab',
              'aria-selected': String(this.abaGrupo === id),
              'aria-disabled': vazia(id) ? 'true' : undefined,
              onclick: (e: Event) => (vazia(id) ? avisoVazio(e.currentTarget as HTMLElement) : (sfx.click(), (this.abaGrupo = id), this.renderAbas(c))),
            },
            nome,
            n ? h('span', { class: 'fx-g-aba-n' }, String(n)) : null,
          ),
        ),
    );
    for (const [id, , el] of abas) el.classList.toggle('fora-da-aba', id !== this.abaGrupo);
  }

  /** Linha do tempo completa: o que foi escolhido em cada NEX, o que falta e o que quebra regra. */
  private abrirEvolucao(so?: Nex) {
    if (this.gm) this.garantirEdicao();
    const fs = this.atual();
    if (!fs) return;
    const pintar = () => {
      const fsa = this.atual();
      if (!fsa) return;
      const f = fsa.ficha;
      const c = regras.calcular(f);
      const ed = this.editando;
      const blocos: Node[] = [];
      if (!ed) blocos.push(h('p', { class: 'fj-dica' }, 'Para escolher ou trocar, entre em edição. ', h('button', { class: 'fx-bt mini', type: 'button', onclick: () => (this.entrarEdicao(), pintar()) }, ic('lapis'), h('span', null, 'Editar agora'))));
      for (const n of regras.NEX_LISTA.filter((x) => x <= f.nex && (x > 0 || f.comecouMundano))) {
        const itens: Node[] = [];
        for (const t of feitoNoNex(f, n, c)) itens.push(h('div', { class: 'fe-l' }, ic('ok'), h('span', null, t.texto), ed && t.campo ? h('button', { class: 'fx-bt mini', type: 'button', onclick: () => this.abrirEscolha(escolherCampo(this.rascunho!.ficha, n, t.campo!, t.alvo), pintar) }, 'Trocar') : null));
        for (const p of c.pendencias.filter((x) => x.nex === n)) {
          const e = ed ? escolherPendencia(this.rascunho!.ficha, p) : null;
          const noPainel = p.tipo === 'atributos' ? 'Use o − e o + dos atributos.' : p.tipo === 'pericias' ? '' : '';
          itens.push(
            h(
              'div',
              { class: 'fe-l pend' },
              ic('alerta'),
              h('span', null, p.texto, noPainel ? h('small', null, ` ${noPainel}`) : null),
              ed && (e || p.tipo === 'pericias') ? h('button', { class: 'fx-bt mini forte', type: 'button', onclick: () => (p.tipo === 'pericias' && !e ? this.editarPericias() : this.abrirEscolha(e, pintar)) }, 'Escolher') : null,
            ),
          );
        }
        for (const p of c.problemas.filter((x) => x.nex === n)) itens.push(h('div', { class: `fe-l ${p.severidade}` }, ic(p.severidade === 'erro' ? 'fechar' : 'alerta'), h('span', null, `${p.onde}: ${p.texto}`)));
        if (!itens.length) continue;
        blocos.push(h('section', { class: `fe-nex${so === n ? ' foco' : ''}`, 'data-nex': String(n) }, h('h4', null, `NEX ${n}%`), ...itens));
      }
      j.corpo.replaceChildren(...blocos);
      if (so !== undefined) j.corpo.querySelector('.fe-nex.foco')?.scrollIntoView({ block: 'nearest' });
    };
    const j = mostrar(`Evolução de ${fs.nome}`, 'linhaTempo', [], 76);
    pintar();
  }

  /** Abre a escolha no rascunho e redesenha ao gravar. */
  private abrirEscolha(e: ReturnType<typeof escolherCampo>, depois?: () => void) {
    if (!e) return toast('Essa escolha é feita no painel da ficha.', 'error');
    if (!this.garantirEdicao()) return;
    void escolher(e, () => {
      this.render();
      depois?.();
    });
  }

  // ---------------------------------------------------------------- companheiro

  private renderComp(fs: FichaSalva) {
    const cp = fs.companheiro;
    this.pComp.classList.toggle('vazio', !cp);
    this.el.classList.toggle('sem-comp', !cp && !this.editando && !this.gm);
    const corpo = this.corpoDe(this.pComp);
    if (!cp) {
      corpo.replaceChildren(
        this.editando || this.gm
          ? h('button', { class: 'fx-bt', type: 'button', onclick: this.acao(() => this.editarCompanheiro()) }, ic('mais'), h('span', null, 'Adicionar companheiro'))
          : h('p', { class: 'fx-nada' }, 'Sem companheiro.'),
      );
      this.extraDe(this.pComp).replaceChildren();
      return;
    }
    const pv = cp.pvMax ? `${cp.pv ?? cp.pvMax} / ${cp.pvMax}` : '—';
    const pct = cp.pvMax ? Math.round(((cp.pv ?? cp.pvMax) / cp.pvMax) * 100) : 100;
    const foto = arte(`/arte/companheiros/${cp.imagem || `${regras.slug(cp.nome)}.png`}`, 'pata', 'ic fx-cp-img');
    corpo.replaceChildren(
      h('div', { class: 'fx-cp-foto' }, foto),
      h(
        'div',
        { class: 'fx-cp-dados' },
        h('b', { class: 'fx-cp-nome' }, cp.nome),
        h('span', { class: 'fx-cp-tipo' }, cp.tipo || '—'),
        // só o PV (19/10, o Felipe: "a foto grandinha na horizontal e as informações embaixo; é só PV")
        h('div', { class: 'fx-cp-l' }, h('span', null, ic('coracao'), 'PV'), h('span', { class: `fx-bar ${cp.pvMax ? 'pv' : 'sem'} mini` }, h('i', { style: `width:${cp.pvMax ? pct : 0}%` }), h('span', null, pv))),
      ),
    );
    this.extraDe(this.pComp).replaceChildren(this.editando || this.gm ? h('button', { class: 'fx-mini', type: 'button', title: 'Editar companheiro', 'aria-label': 'Editar companheiro', onclick: this.acao(() => this.editarCompanheiro()) }, ic('reticencias')) : '');
  }

  private editarCompanheiro() {
    const fs = this.rascunho;
    if (!fs) return;
    const cp = fs.companheiro ?? { nome: '', tipo: '' };
    const j = janela('Companheiro', 'pata', () => this.render(), 50);
    const campo = (rotulo: string, valor: string, max = 40) => {
      const i = h('input', { class: 'fx-inp', value: valor, maxlength: max }) as HTMLInputElement;
      j.corpo.append(h('label', { class: 'fj-campo' }, h('span', null, rotulo), i));
      return i;
    };
    const nome = campo('Nome', cp.nome);
    const tipo = campo('Tipo (ex.: Cão de serviço)', cp.tipo, 60);
    const pv = campo('PV máximo (vazio = sem PV)', cp.pvMax ? String(cp.pvMax) : '', 4);
    const funcao = campo('Função', cp.funcao ?? '', 120);
    const tracos = campo('Traços (separados por vírgula)', (cp.tracos ?? []).join(', '), 120);
    const imagem = campo('Imagem (em /arte/companheiros/)', cp.imagem ?? '', 120);
    j.rodape.append(
      fs.companheiro ? h('button', { class: 'fx-bt perigo', type: 'button', onclick: () => (delete fs.companheiro, j.fechar()) }, ic('lixo'), h('span', null, 'Tirar')) : h('span'),
      h('span', { class: 'fj-esp' }),
      h('button', { class: 'fx-bt', type: 'button', onclick: () => j.fechar() }, ic('fechar'), h('span', null, 'Cancelar')),
      h(
        'button',
        {
          class: 'fx-bt forte',
          type: 'button',
          onclick: () => {
            if (!nome.value.trim()) return toast('Dê um nome ao companheiro.', 'error');
            // sem PV digitado, o do livro: o tipo que bate com um animal das ameaças do livro (Cão de Guarda, LR p. 282)
            const doLivro = combate.AMEACAS_LIVRO.find((a) => a.tipo === 'Animal' && regras.slug(a.nome) === regras.slug(tipo.value.trim()));
            const max = Math.round(Number(pv.value) || 0) || doLivro?.pv || 0;
            fs.companheiro = {
              nome: nome.value.trim(),
              tipo: tipo.value.trim(),
              pvMax: max || undefined,
              pv: max ? Math.min(cp.pv ?? max, max) : undefined,
              funcao: funcao.value.trim() || undefined,
              tracos: tracos.value.split(',').map((t) => t.trim()).filter(Boolean),
              imagem: imagem.value.trim() || undefined,
            };
            j.fechar();
          },
        },
        ic('ok'),
        h('span', null, 'Gravar'),
      ),
    );
  }

  // ---------------------------------------------------------------- equipamentos

  private renderEquip(fs: FichaSalva, c: Calc) {
    const corpo = this.corpoDe(this.pEquip);
    const cab = h('div', { class: 'fx-tab-cab' }, h('span'), h('span', null, 'ITEM'), h('span', null, 'TIPO'), h('span', null, 'DANO / EFEITO'), h('span', { class: 'fx-eq-obs-cab' }, 'OBS.'));
    const ordem: Record<regras.ItemFicha['tipo'], number> = { arma: 0, protecao: 1, amaldicoado: 2, equipamento: 3, cena: 4 };
    const itens = fs.ficha.inventario.map((it, i) => ({ it, i })).sort((a, b) => ordem[a.it.tipo] - ordem[b.it.tipo] || a.i - b.i);
    const linhas = itens.map(({ it, i }) => {
      const inf = infoItem(it, c);
      return h(
        'div',
        { class: `fx-tab-l${it.empunhado ? ' empunhado' : ''}`, 'data-dica': `${inf.nome} · categoria ${romano(inf.categoria)} · ${inf.espacos} espaço${inf.espacos === 1 ? '' : 's'}${inf.ref ? ` · ${textoRef(inf.ref)}` : ''}` },
        h('span', { class: 'fx-eq-ic' }, arteDoItem(it, inf.icone)),
        h('span', { class: 'fx-tab-n' }, inf.nome),
        h('span', null, inf.tipo),
        h('span', null, inf.efeito),
        h('button', { class: 'fx-eq-bt', type: 'button', 'data-dica': inf.obs ? `${inf.obs}. Clique para a regra inteira.` : 'A regra do item.', 'aria-label': `Regra de ${inf.nome}`, onclick: () => this.detalheItem(i) }, ic('livro')),
      );
    });
    // o ataque desarmado não é item, mas é ataque (LR p. 57)
    const des = c.ataques.find((a) => a.item === 'ataque-desarmado' && !fs.ficha.inventario.some((it) => it.id === 'ataque-desarmado'));
    if (des)
      linhas.push(
        h(
          'div',
          { class: 'fx-tab-l desarmado', 'data-dica': 'Ataque desarmado: dano de impacto, não letal (LR p. 57).' },
          h('span', { class: 'fx-eq-ic' }, ic('punho')),
          h('span', { class: 'fx-tab-n' }, des.nome),
          h('span', null, 'Desarmado'),
          h('span', null, des.dano),
          h('button', { class: 'fx-eq-bt', type: 'button', 'data-dica': `${[`Luta ${textoTeste(des.dados, des.bonus, des.penalidadeDados)}`, `${des.critico.margem}/x${des.critico.multiplicador}`, ...des.notas].join(' · ')}. Clique para a regra inteira.`, 'aria-label': 'Regra do ataque desarmado', onclick: () => this.detalheDesarmado(des) }, ic('livro')),
        ),
      );
    corpo.replaceChildren(cab, avisarRolagem(h('div', { class: 'fx-tab-rol' }, ...(linhas.length ? linhas : [h('p', { class: 'fx-nada' }, 'Mochila vazia.')]))));
  }

  /** A janela do ataque desarmado, como a de um item (ele não é item, mas é ataque: LR p. 57). */
  private detalheDesarmado(des: regras.Ataque) {
    const j = janela('ATAQUE DESARMADO', 'mochila', () => this.render(), 50);
    j.el.classList.add('tela-toda', 'fj-item-jg');
    const campo = (rot: string, valor: string) => h('div', { class: 'jg-mi-campo' }, h('small', null, rot), h('b', null, valor));
    const dado = (rot: string, valor: string) => h('div', { class: 'jg-mi-dado' }, h('small', null, rot), h('b', null, valor));
    j.corpo.append(
      h(
        'div',
        { class: 'jg-mi' },
        h('div', { class: 'jg-mi-arte' }, ic('punho')),
        h('div', { class: 'jg-mi-campos' }, campo('Tipo', 'Desarmado'), campo('Peso', '—'), campo('Categoria', '—'), campo('Onde', 'As mãos')),
        h(
          'div',
          { class: 'jg-mi-dados' },
          dado('Dano', des.dano),
          dado('Teste de Luta', textoTeste(des.dados, des.bonus, des.penalidadeDados)),
          dado('Crítico', `${des.critico.margem}${des.critico.margem < 20 ? '–20' : ''} · ×${des.critico.multiplicador}`),
          ...(des.notas.length ? [h('p', { class: 'jg-mi-notas' }, des.notas.join(' · '))] : []),
        ),
        h('p', { class: 'jg-mi-txt' }, 'Soco, chute ou cotovelada: dano de impacto e não letal. Quem não tem arma na mão sempre pode atacar assim.'),
        h('p', { class: 'jg-det-meta' }, 'Livro de Regras, p. 57'),
      ),
    );
    j.rodape.append(h('span', { class: 'fj-esp' }), h('button', { class: 'fx-bt', type: 'button', onclick: () => j.fechar() }, ic('fechar'), h('span', null, 'Fechar')));
  }

  private detalheItem(i: number) {
    if (this.gm) this.garantirEdicao();
    const fs = this.atual();
    if (!fs) return;
    const it = fs.ficha.inventario[i];
    if (!it) return;
    const c = this.calc;
    const inf = infoItem(it, c);
    const ed = this.editando;
    // o mesmo miolo da janela do item no celular do jogador: a arte grande, os campos, o efeito em destaque e o texto
    const j = janela(inf.nome.toUpperCase(), 'mochila', () => this.render(), 50);
    j.el.classList.add('tela-toda', 'fj-item-jg');
    const efeito = [inf.efeito, inf.obs].filter((x) => x && x !== '—');
    const base = it.tipo === 'cena' ? undefined : it.tipo === 'arma' ? cat.arma(it.id) : it.tipo === 'protecao' ? cat.protecao(it.id) : it.tipo === 'equipamento' ? cat.equipamento(it.id) : cat.amaldicoado(it.id);
    const esp = (base as { especial?: string[] } | undefined)?.especial;
    // sem repetir o que o texto do livro já diz
    const resumo = (it.descricao || (base as { resumo?: string } | undefined)?.resumo || '').toLowerCase();
    const limpo = (x: string) => x.replace(/\s*\(a tabela marca[^)]*\)/, '').trim();
    const espLivre = esp?.map(limpo).filter((x) => x && !efeito.some((e) => limpo(e).includes(x)) && !resumo.includes(x.toLowerCase()));
    j.corpo.append(corpoDoItem(it, c), ...(espLivre?.length ? [h('p', { class: 'jg-mi-txt' }, espLivre.join(' · '))] : []));
    if (!ed) {
      j.rodape.append(h('span', { class: 'fj-esp' }), h('button', { class: 'fx-bt', type: 'button', onclick: () => j.fechar() }, ic('fechar'), h('span', null, 'Fechar')));
      return;
    }
    const apelido = h('input', { class: 'fx-inp', value: it.apelido ?? '', maxlength: 40, placeholder: 'Nome próprio (opcional)', oninput: (e: Event) => (it.apelido = (e.target as HTMLInputElement).value.trim() || undefined) });
    const qtd = h('input', { class: 'fx-inp', type: 'number', min: 1, max: 99, value: String(it.qtd ?? 1), oninput: (e: Event) => (it.qtd = Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1)) || undefined) });
    j.corpo.append(h('label', { class: 'fj-campo' }, h('span', null, 'Apelido'), apelido), h('label', { class: 'fj-campo' }, h('span', null, 'Quantidade'), qtd));
    // na mão: armas, escudo e o que se empunha (duas mãos no máximo, LR p. 53)
    if (regras.maosDoItem(it)) {
      const cb = h('input', { type: 'checkbox', checked: regras.lugarDoItem(it) === 'mao', onchange: (e: Event) => (it.empunhado = (e.target as HTMLInputElement).checked || undefined) });
      j.corpo.append(h('label', { class: 'fj-check' }, cb, regras.maosDoItem(it) === 2 ? 'Na mão (as duas)' : 'Na mão'));
    }
    if (regras.vestivel(it)) {
      const cb = h('input', { type: 'checkbox', checked: it.vestido !== false, onchange: (e: Event) => (it.vestido = (e.target as HTMLInputElement).checked ? undefined : false) });
      j.corpo.append(h('label', { class: 'fj-check' }, cb, 'Vestido'));
    }
    // a perícia do utensílio ou o elemento das amarras (LR p. 63 e 66)
    const qual = it.tipo === 'cena' ? null : regras.escolhaDoItem(it.tipo, it.id);
    if (qual) {
      const lista = qual === 'pericia' ? regras.periciasDoItem() : (['sangue', 'morte', 'conhecimento', 'energia'] as const).map((id) => ({ id, nome: NOME_ELEMENTO[id] }));
      const atual = qual === 'pericia' ? it.escolha?.pericia : it.escolha?.elemento;
      const sel = h('select', { class: 'fx-inp' }, h('option', { value: '' }, '—'), ...lista.map((x) => h('option', { value: x.id, selected: atual === x.id }, x.nome))) as HTMLSelectElement;
      sel.addEventListener('change', () => {
        if (!sel.value) delete it.escolha;
        else it.escolha = qual === 'pericia' ? { pericia: sel.value as regras.PericiaId } : { elemento: sel.value as regras.Elemento };
      });
      j.corpo.append(h('label', { class: 'fj-campo' }, h('span', null, qual === 'pericia' ? 'Perícia que ele melhora' : 'Elemento'), sel));
    }
    if (it.tipo !== 'cena') {
      const cb = h('input', { type: 'checkbox', checked: !!it.achado, onchange: (e: Event) => (it.achado = (e.target as HTMLInputElement).checked || undefined) });
      j.corpo.append(h('label', { class: 'fj-check' }, cb, 'Achado na missão (não ocupa vaga da patente)'));
    }
    // quantas vezes por dia (19/10): no rascunho, como o resto do item
    if (it.uid) {
      const chave = regras.chaveDia.item(it.uid);
      const dia = h('div');
      const pintarDia = (): void =>
        dia.replaceChildren(
          blocoDia(
            fs.ficha,
            chave,
            true,
            (n) => (regras.definirLimiteDia(fs.ficha, chave, n), pintarDia()),
            (u) => (regras.marcarUsosDia(fs.ficha, chave, u), pintarDia()),
          ) ?? '',
        );
      pintarDia();
      j.corpo.append(dia);
    }
    // modificações e maldições
    const mods = h('div', { class: 'fj-chips' });
    const desenharMods = () => {
      mods.replaceChildren(
        ...(it.modificacoes ?? []).map((m) => h('button', { class: 'fj-chip on', type: 'button', title: 'Tirar', onclick: () => ((it.modificacoes = it.modificacoes!.filter((x) => x !== m)), it.modificacoes.length || delete it.modificacoes, desenharMods()) }, cat.modificacao(m)?.nome ?? m, ' ✕')),
        ...(it.maldicoes ?? []).map((m) => h('button', { class: 'fj-chip on mald', type: 'button', title: 'Tirar', onclick: () => ((it.maldicoes = it.maldicoes!.filter((x) => x !== m)), it.maldicoes.length || delete it.maldicoes, desenharMods()) }, cat.maldicao(m)?.nome ?? m, ' ✕')),
      );
    };
    desenharMods();
    if (it.tipo !== 'amaldicoado' && it.tipo !== 'cena') {
      j.corpo.append(
        h('h4', { class: 'fj-sub' }, 'Modificações e maldições'),
        mods,
        h(
          'div',
          { class: 'fj-linha' },
          h('button', { class: 'fx-bt mini', type: 'button', onclick: () => this.escolherMod(it, 'mod', desenharMods) }, ic('mais'), h('span', null, 'Modificação')),
          h('button', { class: 'fx-bt mini', type: 'button', onclick: () => this.escolherMod(it, 'mald', desenharMods) }, ic('mais'), h('span', null, 'Maldição')),
        ),
      );
    }
    j.rodape.append(
      h('button', { class: 'fx-bt perigo', type: 'button', onclick: () => (fs.ficha.inventario.splice(i, 1), j.fechar()) }, ic('lixo'), h('span', null, 'Tirar da mochila')),
      h('span', { class: 'fj-esp' }),
      h('button', { class: 'fx-bt forte', type: 'button', onclick: () => j.fechar() }, ic('ok'), h('span', null, 'Pronto')),
    );
  }

  private escolherMod(it: regras.ItemFicha, tipo: 'mod' | 'mald', depois: () => void) {
    const alvo = alvoMod(it);
    const f = this.rascunho?.ficha;
    if (!f) return;
    void escolher(
      tipo === 'mod'
        ? {
            titulo: 'Modificação',
            dica: 'Cada modificação sobe a categoria do item em I (LR p. 60).',
            qtd: 1,
            // o motor confere: onde vai, requisitos, as que não combinam e a categoria contra a patente
            opcoes: () => opcoesMelhoria(f, f.inventario.indexOf(it), 'modificacao', this.gm).filter((o) => !(it.modificacoes ?? []).includes(o.id.split(':')[1])),
            atual: () => [],
            aplicar: (ids) => ids[0] && (it.modificacoes = [...(it.modificacoes ?? []), ids[0].split(':')[1]]),
          }
        : {
            titulo: 'Maldição',
            dica: 'A primeira maldição sobe a categoria em II; cada outra, em I (LR p. 144).',
            qtd: 1,
            // e nas maldições: os elementos que se oprimem e só de agente especial em diante
            opcoes: () => opcoesMelhoria(f, f.inventario.indexOf(it), 'maldicao', this.gm).filter((o) => !(it.maldicoes ?? []).includes(o.id.split(':')[1])),
            atual: () => [],
            aplicar: (ids) => ids[0] && (it.maldicoes = [...(it.maldicoes ?? []), ids[0].split(':')[1]]),
          },
      () => depois(),
    );
  }

  // ---------------------------------------------------------------- inventário

  private renderInv(fs: FichaSalva, c: Calc) {
    const corpo = this.corpoDe(this.pInv);
    const slots: HTMLElement[] = fs.ficha.inventario.map((it, i) => {
      const inf = infoItem(it, c);
      const esp = inf.espacos * (it.qtd ?? 1);
      const lugar = regras.lugarDoItem(it);
      return h(
        'button',
        { class: `fx-sl${lugar !== 'mochila' ? ' em-uso' : ''}`, type: 'button', 'data-dica': `${inf.nome} · ${romano(inf.categoria)} · ${fmtNum(esp)} esp.${lugar === 'mao' ? ' · na mão' : lugar === 'vestido' ? ' · vestido' : ''}`, 'aria-label': inf.nome, onclick: () => this.detalheItem(i) },
        arteDoItem(it, inf.icone, `ic fx-sl-ic ${inf.icone === 'kitMedico' ? 'vermelho' : ''}`),
        (it.qtd ?? 1) > 1 ? h('small', null, `×${it.qtd}`) : null,
        // o selo da categoria no canto (17/10, o Felipe: "um selo amarelinho redondinho com I, II, III ou IV"); o peso
        // fica no detalhe, ao abrir o item
        inf.categoria >= 1 && it.tipo !== 'cena' ? h('i', { class: 'fx-sl-cat', 'aria-hidden': 'true' }, romano(inf.categoria)) : null,
      );
    });
    // só as linhas que os itens ocupam (17/10, o Felipe: "o número de linhas igual ao de itens"): os itens e a casa do
    // "+"; a última linha se completa com casas apagadas (mochilaUmaLinha)
    slots.push(h('button', { class: 'fx-sl vazio', type: 'button', 'aria-label': 'Adicionar item', onclick: () => this.adicionarItem() }, ic('mais')));
    // a mochila (14/10, o Felipe): casas grandes, uma linha por vez, e a faixa embaixo dizendo que tem mais
    const grade = h('div', { class: 'fx-sl-grade uma-linha' }, ...slots);
    const nav = h('div', { class: 'fx-sl-nav' });
    corpo.replaceChildren(h('div', { class: 'fx-sl-caixa' }, grade, nav));
    mochilaUmaLinha(grade, nav, fs.ficha.inventario.length);
    const lim = c.itens.map((l) => h('span', { class: `fx-lim${l.usados > l.limite ? ' passou' : ''}`, 'data-dica': `Categoria ${romano(l.categoria)}: ${l.usados} de ${l.limite} pela patente.` }, `${romano(l.categoria)} ${l.usados}/${l.limite}`));
    this.extraDe(this.pInv).replaceChildren(
      h('span', { class: 'fx-lims' }, ...lim),
      h('span', { class: `fx-carga${c.carga.sobrecarregado ? ' passou' : ''}`, 'data-dica': c.carga.sobrecarregado ? 'Sobrecarregado: −5 na Defesa e nas perícias de carga, −3 m de deslocamento.' : `Carga: 5 espaços por ponto de Força. Máximo ${c.carga.maximo}.` }, ic('mochila'), `${fmtNum(c.carga.usados)} / ${c.carga.espacos}`),
    );
  }

  private adicionarItem() {
    if (!this.garantirEdicao()) return;
    const fs = this.rascunho;
    if (!fs) return;
    // a requisição: o item entra no rascunho (Salvar grava) e a ficha atrás acompanha
    abrirRequisicao({ ficha: fs.ficha, nome: fs.ficha.nome, tema: fs.tema, mestre: this.gm, aoAdicionar: () => this.render(), aoFechar: () => this.render() });
  }

  private adicionarRitual() {
    const fs = this.atual();
    if (!fs || !this.calc) return;
    const p = this.calc.pendencias.find((x) => x.tipo === 'ritual') ?? this.calc.pendencias.find((x) => x.tipo === 'paranormal');
    if (!p) return toast(fs.ficha.classe === 'ocultista' ? 'Nenhum ritual para aprender agora: o ocultista aprende um a cada NEX.' : 'Rituais vêm do ocultista ou do poder paranormal Aprender Ritual.', 'error');
    if (!this.garantirEdicao()) return;
    this.abrirEscolha(escolherPendencia(this.rascunho!.ficha, p));
  }

  // ---------------------------------------------------------------- anotações

  private renderNotas(fs: FichaSalva, forcar = false) {
    const corpo = this.corpoDe(this.pNotas);
    // digitando: não refaz o campo (perderia o cursor quando o servidor confirma)
    const foco = document.activeElement;
    if (!forcar && foco?.tagName === 'TEXTAREA' && corpo.contains(foco)) return;
    const abas = h(
      'div',
      { class: 'fx-nt-abas', role: 'tablist' },
      ...(
        [
          ['anotacoes', 'Anotações'],
          ['documentos', 'Documentos'],
          ['pistas', 'Pistas'],
          ['perfil', 'Perfil'],
        ] as [AbaNotas, string][]
      ).map(([id, nome]) => h('button', { class: `fx-nt-aba${this.abaNotas === id ? ' on' : ''}`, type: 'button', role: 'tab', onclick: () => ((this.abaNotas = id), this.renderNotas(fs, true)) }, nome)),
    );
    const area = (valor: string, ph: string, gravar: (x: FichaSalva, v: string) => void, cls = '') => {
      const t = h('textarea', { class: `fx-nt-txt ${cls}`, placeholder: ph, maxlength: 8000 }, valor) as HTMLTextAreaElement;
      t.addEventListener('input', () => this.mudar((x) => gravar(x, t.value), false));
      return t;
    };
    let conteudo: Node;
    if (this.abaNotas === 'perfil') {
      const tx = fs.ficha.textos ?? {};
      const campo = (k: 'aparencia' | 'personalidade' | 'historico' | 'objetivo', rotulo: string) =>
        h(
          'label',
          { class: 'fx-nt-campo' },
          h('span', null, rotulo),
          area(tx[k] ?? '', rotulo, (x, v) => {
            x.ficha.textos ??= {};
            x.ficha.textos[k] = v || undefined;
          }, 'curto'),
        );
      conteudo = h('div', { class: 'fx-nt-perfil' }, campo('aparencia', 'Aparência'), campo('personalidade', 'Personalidade'), campo('historico', 'Histórico'), campo('objetivo', 'Objetivo'));
    } else {
      const k = this.abaNotas;
      const ph = k === 'anotacoes' ? 'Registrar anotações sobre o agente…' : k === 'documentos' ? 'Documentos que o agente tem…' : 'Pistas encontradas…';
      conteudo = area(fs.notas?.[k] ?? '', ph, (x, v) => {
        x.notas ??= {};
        x.notas[k] = v || undefined;
      });
    }
    corpo.replaceChildren(abas, conteudo);
  }

  // ---------------------------------------------------------------- botões

  private renderBarra(fs: FichaSalva) {
    const ed = this.editando && !this.direto;
    const bt = (rotulo: string, icone: NomeIcone, cls: string, onclick: () => void, desligado = false) => h('button', { class: `fx-bt ${cls}`, type: 'button', disabled: desligado, onclick }, ic(icone), h('span', null, rotulo));
    // o mestre edita clicando em cada campo (19/10): sem Editar; o Salvar e o Cancelar só no agente novo, que ainda não existe
    if (this.gm) {
      this.barra.replaceChildren(
        ed ? bt('Cancelar', 'fechar', 'fx-b-cancelar', () => this.cancelarEdicao()) : h('span'),
        bt('Adicionar Item', 'caixa', 'fx-b-item', () => this.adicionarItem()),
        bt('Adicionar Ritual', 'pentagrama', 'fx-b-ritual', () => this.adicionarRitual()),
        ed ? bt('Salvar Ficha', 'salvar', 'fx-b-salvar forte', () => this.salvarEdicao()) : h('span', { class: 'fx-b-dica', 'data-dica': 'Clique em qualquer campo da ficha para mudar: grava ao confirmar.' }, ic('lapis'), 'Clique num campo para mudar'),
      );
      return;
    }
    this.barra.replaceChildren(
      bt('Cancelar', 'fechar', 'fx-b-cancelar', () => this.cancelarEdicao(), !ed),
      bt(ed ? 'Editando' : 'Editar', 'lapis', `fx-b-editar${ed ? ' on' : ''}`, () => this.entrarEdicao()),
      bt('Adicionar Item', 'caixa', 'fx-b-item', () => this.adicionarItem()),
      bt('Adicionar Ritual', 'pentagrama', 'fx-b-ritual', () => this.adicionarRitual()),
      ed ? bt('Salvar Ficha', 'salvar', 'fx-b-salvar forte', () => this.salvarEdicao(), false) : bt('Ficha salva', 'ok', 'fx-b-salvar', () => toast('Em jogo, tudo grava sozinho.'), false),
    );
    void fs;
  }

  // ---------------------------------------------------------------- dicas

  private ligarDicas() {
    let alvo: HTMLElement | null = null;
    const esconder = () => {
      alvo = null;
      this.dica.classList.add('hidden');
    };
    this.el.addEventListener('pointerover', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-dica]');
      if (!t || t === alvo) return;
      const txt = t.dataset.dica;
      if (!txt) return esconder();
      alvo = t;
      this.dica.textContent = txt;
      this.dica.classList.remove('hidden');
      const r = t.getBoundingClientRect();
      const d = this.dica.getBoundingClientRect();
      const x = Math.max(8, Math.min(innerWidth - d.width - 8, r.left + r.width / 2 - d.width / 2));
      const y = r.top - d.height - 8 > 8 ? r.top - d.height - 8 : r.bottom + 8;
      this.dica.style.left = `${x}px`;
      this.dica.style.top = `${y}px`;
    });
    this.el.addEventListener('pointerout', (e) => {
      const para = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-dica]');
      if (para !== alvo) esconder();
    });
    this.el.addEventListener('scroll', esconder, true);
  }
}

// ==================================================================== textos

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

export const NOME_DANO: Record<string, string> = {
  balistico: 'Balístico',
  corte: 'Corte',
  eletricidade: 'Eletricidade',
  fogo: 'Fogo',
  frio: 'Frio',
  impacto: 'Impacto',
  mental: 'Mental',
  perfuracao: 'Perfuração',
  quimico: 'Químico',
  sangue: 'Sangue',
  morte: 'Morte',
  conhecimento: 'Conhecimento',
  energia: 'Energia',
  medo: 'Medo',
  paranormal: 'Paranormal',
  fisico: 'Físico',
  todos: 'Todos',
};
function nomeDano(t: string) {
  return NOME_DANO[t] ?? t;
}

/** RD para mostrar: os quatro tipos físicos iguais viram "Físico"; os cinco elementos iguais, "Paranormal". */
export function resistenciasParaMostrar(res: Partial<Record<string, number>>): [string, number][] {
  const r = { ...res };
  const grupo = (tipos: string[], nome: string) => {
    const v = r[tipos[0]];
    if (!v || !tipos.every((t) => r[t] === v)) return;
    for (const t of tipos) delete r[t];
    r[nome] = (r[nome] ?? 0) + v;
  };
  grupo(['balistico', 'corte', 'impacto', 'perfuracao'], 'fisico');
  grupo(['sangue', 'morte', 'conhecimento', 'energia', 'medo'], 'paranormal');
  return (Object.entries(r) as [string, number | undefined][]).filter((x): x is [string, number] => !!x[1]);
}

const NOME_PROF: Record<regras.Proficiencia, string> = {
  armasSimples: 'armas simples',
  armasTaticas: 'armas táticas',
  armasPesadas: 'armas pesadas',
  protecoesLeves: 'proteções leves',
  protecoesPesadas: 'proteções pesadas',
  armasTaticasCorpoACorpo: 'táticas corpo a corpo',
  armasTaticasFogo: 'táticas de fogo',
  armasFogoBalasLongas: 'armas de balas longas',
};
function nomeProf(p: regras.Proficiencia) {
  return NOME_PROF[p] ?? p;
}

/** Texto curto do que foi escolhido junto com um poder. */
function textoValor(v: regras.ValorEscolha): string {
  const partes: string[] = [];
  if (v.elemento) partes.push(NOME_ELEMENTO[v.elemento]);
  if (v.atributo) partes.push(NOME_ATR_LONGO[v.atributo]);
  if (v.pericias?.length) partes.push(v.pericias.map((p) => cat.pericia(p).nome).join(', '));
  if (v.arma) partes.push(cat.arma(v.arma)?.nome ?? v.arma);
  if (v.poder) partes.push(cat.paranormal(v.poder)?.nome ?? cat.poder(v.poder)?.nome ?? v.poder);
  if (v.rituais?.length) partes.push(`${v.rituais.length} ritual${v.rituais.length > 1 ? 'is' : ''}`);
  if (v.texto) partes.push(v.texto);
  return partes.length ? `(${partes.join('; ')})` : '';
}

/** Dica do poder: resumo, custo, NEX em que veio, efeitos em números, página. */
function infoPoder(p: regras.PoderObtido): string {
  const def = cat.poder(p.id) ?? cat.paranormal(p.id);
  const hab = def ? undefined : buscaHabilidade(p.id);
  const resumo = (def as { resumo?: string } | undefined)?.resumo ?? hab?.resumo ?? '';
  const custo = (def as { custoPe?: number } | undefined)?.custoPe ?? hab?.custoPe;
  const ref = def?.ref ?? hab?.ref;
  const efeitos = p.efeitos.filter((e) => e.alvo !== 'nota').map((e) => regras.textoEfeito(e) + (e.condicional ? ` (${e.condicional})` : ''));
  const notas = p.efeitos.filter((e): e is Extract<regras.Efeito, { alvo: 'nota' }> => e.alvo === 'nota').map((e) => e.texto);
  return [p.nome, resumo, custo ? `Custo: ${custo} PE.` : '', efeitos.length ? `Efeitos: ${efeitos.join('; ')}.` : '', ...notas, `NEX ${p.nex}%${p.via ? ` (${p.via})` : ''}${ref ? ` · ${textoRef(ref)}` : ''}`].filter(Boolean).join('\n');
}

function buscaHabilidade(id: string): regras.Habilidade | undefined {
  for (const c of cat.CATALOGO.classes) for (const h of c.habilidades) if (h.id === id) return h;
  for (const t of cat.CATALOGO.trilhas) for (const h of t.habilidades) if (h.id === id) return h;
  for (const o of cat.CATALOGO.origens) if (o.poder.id === id) return o.poder;
  return undefined;
}

/** Dica do ritual: elemento, círculo, custo, execução, alcance, alvo, duração, resistência, DT e página. */
function infoRitual(r: regras.Ritual, c: Calc): string {
  const conta = c.custoRituais[r.id] ?? { pe: [0, 1, 3, 6, 10][r.circulo], dt: c.dtRituais };
  const partes = [
    `${r.nome} (${NOME_ELEMENTO[r.elemento]}, ${r.circulo}º círculo)`,
    `Custo ${conta.pe} PE · ${r.execucao} · alcance ${r.alcance}${r.alvo ? ` · ${r.alvo}` : ''} · ${r.duracao}`,
    r.resistencia ? `Resistência: ${r.resistencia} (DT ${conta.dt})` : '',
    r.discente ? `Discente: +${r.discente.custoExtra} PE${r.discente.circulo ? `, ${r.discente.circulo}º círculo` : ''}` : '',
    r.verdadeiro ? `Verdadeiro: +${r.verdadeiro.custoExtra} PE${r.verdadeiro.circulo ? `, ${r.verdadeiro.circulo}º círculo` : ''}${r.verdadeiro.afinidade ? ', com afinidade' : ''}` : '',
    textoRef(r.ref),
  ];
  return partes.filter(Boolean).join('\n');
}

/** A que a modificação serve, pelo item. */
function alvoMod(it: regras.ItemFicha): regras.AlvoModificacao | null {
  if (it.tipo === 'protecao') return 'protecao';
  if (it.tipo === 'arma') {
    const a = cat.arma(it.id);
    if (!a) return null;
    return a.tipo === 'fogo' ? 'armaFogo' : a.tipo === 'corpoACorpo' ? 'armaCorpoACorpo' : 'armaDisparo';
  }
  const e = cat.equipamento(it.id);
  if (e?.grupo === 'municao') return 'municao';
  return 'acessorio';
}

/** Sigilo do elemento: a arte (arte/icones/sigilo-<elemento>.png) quando existir; senão o desenho padrão. */
function sigiloComArte(e: regras.Elemento): HTMLElement {
  const box = arte(`/arte/icones/sigilo-${e}.png`, 'mais3', 'fx-sig');
  // enquanto a arte não chega, o desenho padrão no lugar do ícone de linha
  if (box.querySelector('svg')) box.replaceChildren(sigilo(e));
  return box;
}

/** Sigilo de um elemento (desenho simples até a arte dos sigilos chegar). */
function sigilo(e: regras.Elemento): SVGSVGElement {
  const formas: Record<regras.Elemento, string> = {
    sangue: '<path d="M12 5c2.5 3.6 4.5 6.2 4.5 8.6a4.5 4.5 0 0 1-9 0C7.5 11.2 9.5 8.6 12 5z"/><path d="M5 19h14"/>',
    morte: '<path d="M8 5h8M8 19h8M9 5c0 4 6 5 6 7s-6 3-6 7M15 5c0 4-6 5-6 7"/>',
    conhecimento: '<path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="12" cy="12" r="2"/>',
    energia: '<path d="M13 4 7 13h5l-1 7 6-9h-5z"/>',
    medo: '<path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  };
  const s = document.createElement('span');
  s.innerHTML = `<svg viewBox="0 0 24 24" class="fx-sig" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10.2"/><circle cx="12" cy="12" r="8.4" opacity=".45"/>${formas[e]}</svg>`;
  return s.firstElementChild as SVGSVGElement;
}

/** O que foi escolhido num NEX, com o campo para trocar. */
function feitoNoNex(f: Ficha, n: Nex, c: Calc): { texto: string; campo?: Campo; alvo?: string }[] {
  const out: { texto: string; campo?: Campo; alvo?: string }[] = [];
  const inicio: Nex = f.comecouMundano ? 0 : 5;
  if (n === inicio) {
    out.push({ texto: `Atributos: ${regras.ATRIBUTOS.map((a) => `${NOME_ATR[a]} ${f.atributos[a]}`).join(', ')}` });
    if (f.origem) out.push({ texto: `Origem: ${cat.origem(f.origem)?.nome ?? f.origem}`, campo: 'origem' });
  }
  if (n === 5 && f.classe) out.push({ texto: `Classe: ${cat.classe(f.classe).nome}`, campo: 'classe' });
  if (n === 10 && f.trilha) out.push({ texto: `Trilha: ${cat.trilha(f.trilha)?.nome ?? f.trilha}`, campo: 'trilha' });
  const e = f.progressao[n];
  if (e?.atributoTreino) out.push({ texto: `Treinamento: +1 em ${NOME_ATR_LONGO[e.atributoTreino]}`, campo: 'atributoTreino' });
  if (e?.atributo) out.push({ texto: `Aumento: +1 em ${NOME_ATR_LONGO[e.atributo]}`, campo: 'atributo' });
  if (e?.periciaIntelecto) out.push({ texto: `Perícia pelo Intelecto: ${cat.pericia(e.periciaIntelecto).nome}`, campo: 'periciaIntelecto' });
  if (e?.grau?.length) out.push({ texto: `Grau de treinamento: ${e.grau.map((p) => cat.pericia(p).nome).join(', ')}`, campo: 'grau' });
  if (e?.poder) out.push({ texto: `Poder: ${cat.poder(e.poder.id)?.nome ?? e.poder.id}${e.poder.escolha ? ` ${textoValor(e.poder.escolha)}` : ''}`, campo: 'poder' });
  if (e?.versatilidade) out.push({ texto: `Versatilidade: ${e.versatilidade.poder ? (cat.poder(e.versatilidade.poder.id)?.nome ?? '') : `trilha ${cat.trilha(e.versatilidade.trilha ?? '')?.nome ?? ''}`}`, campo: 'versatilidade' });
  if (e?.afinidade) out.push({ texto: `Afinidade: ${NOME_ELEMENTO[e.afinidade]}`, campo: 'afinidade' });
  if (e?.rituais?.length) out.push({ texto: `Ritual: ${e.rituais.map((r) => cat.ritual(r)?.nome ?? r).join(', ')}`, campo: 'ritual' });
  for (const [id, v] of Object.entries(e?.parametros ?? {})) {
    const nome = buscaHabilidade(id)?.nome ?? cat.poder(id)?.nome ?? id;
    const rit = v?.rituais?.length ? `: ${v.rituais.map((r) => cat.ritual(r)?.nome ?? r).join(', ')}` : '';
    out.push({ texto: `${nome}${rit || ` ${textoValor(v)}`}`, campo: v?.rituais?.length ? 'ritualHabilidade' : 'parametro', alvo: id });
  }
  void c;
  return out;
}

/** Lista que rola por dentro (perícias, equipamentos, inventário): some embaixo enquanto tem mais para ver. */
function avisarRolagem<T extends HTMLElement>(el: T): T {
  const ver = () => el.classList.toggle('tem-mais', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  el.addEventListener('scroll', ver, { passive: true });
  requestAnimationFrame(ver);
  return el;
}

/**
 * A mochila numa linha por vez (14/10): as casas ficam quadradas e do tamanho que a altura deixa (no celular, pela
 * largura), a rolagem para em cada linha e a faixa embaixo mostra em que linha se está e quantos itens há nas de
 * baixo, com as setas para subir e descer. Recalcula quando o painel muda de tamanho.
 * No computador (17/10), as setas ficam em pé ao lado das casas, com "1/2" e "+3" entre elas (a frase inteira na dica):
 * a faixa de baixo dava a altura para os Itens e Ataques.
 */
function mochilaUmaLinha(grade: HTMLElement, nav: HTMLElement, itens: number) {
  const caixa = grade.parentElement!;
  const sobe = h('button', { class: 'fx-sl-seta', type: 'button', 'aria-label': 'Linha de cima' }, '▲');
  const desce = h('button', { class: 'fx-sl-seta', type: 'button', 'aria-label': 'Linha de baixo' }, '▼');
  const texto = h('span', { class: 'fx-sl-onde' });
  nav.replaceChildren(sobe, texto, desce);
  let lado = 0;
  let cols = 1;
  let gap = 0;
  const celular = () => window.matchMedia('(max-width: 820px) and (orientation: portrait), (max-width: 560px)').matches;
  const atualizar = () => {
    const passo = lado + gap;
    if (!passo) return;
    const total = Math.max(1, Math.ceil(grade.children.length / cols));
    const linha = Math.min(total - 1, Math.round(grade.scrollTop / passo));
    const abaixo = Math.max(0, itens - (linha + 1) * cols);
    const frase = `Linha ${linha + 1} de ${total}` + (abaixo ? ` · ${abaixo} ${abaixo === 1 ? 'item' : 'itens'} embaixo` : '');
    if (caixa.classList.contains('de-lado')) {
      texto.replaceChildren(h('b', null, `${linha + 1}/${total}`), abaixo ? h('small', null, `+${abaixo}`) : '');
      texto.dataset.dica = frase;
    } else texto.textContent = frase;
    sobe.disabled = linha === 0;
    desce.disabled = linha >= total - 1;
    desce.classList.toggle('chama', abaixo > 0);
  };
  const montar = () => {
    const cs = getComputedStyle(grade);
    gap = parseFloat(cs.rowGap) || parseFloat(cs.columnGap) || 0;
    caixa.classList.toggle('de-lado', !celular());
    const w = grade.clientWidth;
    if (!w) return;
    const disp = caixa.classList.contains('de-lado') ? caixa.clientHeight : caixa.clientHeight - nav.offsetHeight - (parseFloat(getComputedStyle(caixa).rowGap) || 0);
    // a casa nunca menor que um dedo: no celular a rem é pequena (~4 px), então o mínimo é em px (o painel lá já
    // vem ampliado 1,45x, então 52 px viram ~75 px na tela)
    const minimo = Math.max(52, parseFloat(getComputedStyle(document.documentElement).fontSize) * 6);
    // no computador a altura do painel manda (as casas cabem nela); no celular, a largura (casas de ~6 rem)
    cols = celular() || disp < minimo ? Math.max(4, Math.floor((w + gap) / (minimo + gap))) : Math.max(3, Math.ceil((w + gap) / (disp + gap)));
    lado = Math.floor((w - gap * (cols - 1)) / cols);
    // a última linha cheia: as casas que sobram viram casas vazias apagadas
    for (const s of [...grade.querySelectorAll('.fx-sl.sobra')]) s.remove();
    const falta = (cols - (grade.children.length % cols)) % cols;
    for (let i = 0; i < falta; i++) grade.append(h('button', { class: 'fx-sl vazio sobra', type: 'button', disabled: true, 'aria-hidden': 'true', tabindex: '-1' }));
    grade.style.setProperty('--sl', `${lado}px`);
    grade.style.setProperty('grid-template-columns', `repeat(${cols}, ${lado}px)`, 'important');
    grade.style.setProperty('grid-auto-rows', `${lado}px`, 'important');
    grade.style.setProperty('height', `${lado}px`, 'important');
    atualizar();
  };
  sobe.onclick = () => grade.scrollBy({ top: -(lado + gap), behavior: 'smooth' });
  desce.onclick = () => grade.scrollBy({ top: lado + gap, behavior: 'smooth' });
  grade.addEventListener('scroll', atualizar, { passive: true });
  new ResizeObserver(montar).observe(caixa);
  requestAnimationFrame(montar);
}

/** O aviso da aba vazia: um bilhetinho em cima da aba, que aparece e some sozinho. */
function avisoVazio(aba: HTMLElement) {
  document.querySelector('.fx-aviso-vazio')?.remove();
  const r = aba.getBoundingClientRect();
  const el = h('div', { class: 'fx-aviso-vazio', role: 'status' }, 'Não há nada pra ver aqui ainda');
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.bottom + 8}px`;
  document.body.append(el);
  setTimeout(() => el.classList.add('sai'), 1600);
  setTimeout(() => el.remove(), 2000);
}
