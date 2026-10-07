/**
 * Aba COMBATE (referência docs/referencias/combate.webp; docs/TELA-COMBATE.md).
 *
 * Só o mestre mexe: monta o combate, digita a Iniciativa, passa os turnos,
 * resolve os ataques e declara as outras ações. Os dados são físicos: o mestre
 * digita o que saiu na mesa. As regras ficam em @crona/shared (combate) e o
 * servidor aplica; esta tela mostra, faz as contas e pede. O tabuleiro é o
 * mesmo da tela MAPA, com as marcações do combate por cima.
 */
import { combate as cb, regras, vitalConditions, type Character, type FichaSalva, type Session, type Vitals } from '@crona/shared';
import { COR_LADO, marcasVazias } from '../render/combateMarcas';
import { portraitCanvas } from '../render/portrait';
import { cobertura as coberturaEntre, elevado, flanqueia, FORMAS, naArea, type Casa, type FormaArea } from '../room/combateGeo';
import type { App } from './app';
import { editarAmeaca } from './combateAmeaca';
import { PASSOS_ATAQUE, ResolucaoAtaque, type AlvoAtaque, type ArmaOpcao, type CtxAtaque, type TabuleiroAtaque } from './combateAtaque';
import { PASSOS_MANOBRA, ResolucaoManobra, type CtxManobra, type TesteLuta } from './combateManobra';
import { PASSOS_RITUAL, ResolucaoRitual, type CtxRitual, type RitualOpcao } from './combateRitual';
import { h, toast } from './dom';
import { confirmar, janela, perguntarTexto } from './fichaModal';
import { textoTeste } from './fichaRegras';
import { NOME_DANO, resistenciasParaMostrar } from './fichas';
import { arteOu, ic, type NomeIcone } from './icons';
import { paperize } from './paperArt';
import { sfx } from './sfx';

type Combate = cb.Combate;
type Participante = cb.Participante;
type Entrada = cb.Entrada;
type Calc = regras.Calculado;

type Aba = 'atacar' | 'manobra' | 'ritual' | 'habilidade' | 'item' | 'movimento' | 'outras';
const ABAS: { id: Aba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'atacar', rotulo: 'ATACAR', icone: 'espadas' },
  { id: 'manobra', rotulo: 'MANOBRA', icone: 'mao' },
  { id: 'ritual', rotulo: 'RITUAL', icone: 'pentagrama' },
  { id: 'habilidade', rotulo: 'HABILIDADE', icone: 'engrenagem' },
  { id: 'item', rotulo: 'ITEM', icone: 'mochila' },
  { id: 'movimento', rotulo: 'MOVIMENTO', icone: 'bota' },
  { id: 'outras', rotulo: 'OUTRAS', icone: 'reticencias' },
];

/** Uma ação do livro para declarar, com o que ela gasta do turno. */
interface OpcaoAcao {
  id: string;
  nome: string;
  qual: cb.TipoAcao;
  dica: string;
  pagina: number;
  /** a ação tem um alvo (entra "contra X" no registro) */
  alvo?: boolean;
}

/** As ações de cada aba (LR p. 44–46, 58, 85–87, 310; COMBATE.md, seção 5). As manobras têm resolução própria (combateManobra.ts). */
const ACOES: Record<'movimento' | 'outras', OpcaoAcao[]> = {
  movimento: [
    { id: 'mover', nome: 'Movimentar-se', qual: 'movimento', dica: 'até o deslocamento; arraste a peça no tabuleiro', pagina: 87 },
    { id: 'levantar', nome: 'Levantar-se', qual: 'movimento', dica: 'sai do caído', pagina: 87 },
    { id: 'sacar', nome: 'Sacar ou guardar', qual: 'movimento', dica: 'um item', pagina: 87 },
    { id: 'manipular', nome: 'Manipular item', qual: 'movimento', dica: 'pegar na mochila, abrir uma porta', pagina: 87 },
    { id: 'mirar', nome: 'Mirar', qual: 'movimento', dica: 'com Pontaria treinada, tira o −5 de atirar em corpo a corpo', pagina: 87, alvo: true },
    { id: 'recarregar', nome: 'Recarregar', qual: 'movimento', dica: 'arma que pede recarga', pagina: 58 },
  ],
  outras: [
    { id: 'fintar', nome: 'Fintar', qual: 'padrao', dica: 'Enganação contra Reflexos, alcance curto', pagina: 86, alvo: true },
    { id: 'socorros', nome: 'Primeiros socorros', qual: 'padrao', dica: 'Medicina DT 20, +5 a cada vez na cena', pagina: 46, alvo: true },
    { id: 'acalmar', nome: 'Acalmar', qual: 'padrao', dica: 'Diplomacia DT 20, +5 a cada vez na cena', pagina: 44, alvo: true },
    { id: 'assustar', nome: 'Assustar', qual: 'padrao', dica: 'Intimidação contra Vontade, alcance curto', pagina: 45, alvo: true },
    { id: 'apagar', nome: 'Apagar as chamas', qual: 'padrao', dica: 'tira o em chamas', pagina: 310 },
    { id: 'investida', nome: 'Investida', qual: 'completa', dica: 'até 2× o deslocamento, +1d20 no ataque, −5 na Defesa', pagina: 87, alvo: true },
    { id: 'corrida', nome: 'Corrida', qual: 'completa', dica: 'Atletismo; aguenta rodadas iguais ao Vigor', pagina: 87 },
    { id: 'misericordia', nome: 'Golpe de misericórdia', qual: 'completa', dica: 'alvo indefeso adjacente: crítico automático', pagina: 87, alvo: true },
    { id: 'esconder', nome: 'Esconder-se', qual: 'livre', dica: 'Furtividade, no fim do turno', pagina: 45 },
    { id: 'chao', nome: 'Jogar-se no chão', qual: 'livre', dica: 'fica caído', pagina: 87 },
    { id: 'falar', nome: 'Falar', qual: 'livre', dica: 'frases curtas', pagina: 87 },
  ],
};

const NOME_LADO: Record<cb.Lado, string> = { agente: 'Agente', inimigo: 'Inimigo', neutro: 'Neutro' };
const NOME_QUAL: Record<cb.TipoAcao, string> = { padrao: 'padrão', movimento: 'movimento', completa: 'completa', livre: 'livre', reacao: 'reação' };
const NOME_FORA: Record<cb.Saida, string> = { morto: 'Morte', insano: 'Insanidade', saiu: 'Fora do combate' };
const FILTROS: { id: 'todos' | cb.TipoRegistro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'turno', rotulo: 'Turnos' },
  { id: 'acao', rotulo: 'Ações' },
  { id: 'estado', rotulo: 'Estados' },
  { id: 'nota', rotulo: 'Notas' },
];
/** Condições que o combate mostra como estado na ordem e no alvo. */
const ICONE_CONDICAO: Record<string, NomeIcone> = {
  caido: 'deitado',
  inconsciente: 'deitado',
  'em-chamas': 'chama',
  sangrando: 'gota',
  agarrado: 'mao',
  atordoado: 'tontura',
  cego: 'olho',
  ofuscado: 'olho',
  desprevenido: 'alerta',
  surpreendido: 'alerta',
  abalado: 'fantasma',
  apavorado: 'fantasma',
  confuso: 'espiral',
  envenenado: 'frasco',
};
const AUTOMATICAS = ['machucado', 'morrendo', 'perturbado', 'enlouquecendo'];

const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const nomeCurto = (nome: string) => nome.split('·').pop()?.trim() ?? nome;
/** Número digitado: `null` = vazio, `undefined` = não é número. */
const numero = (s: string): number | null | undefined => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};
const nomeCond = (id: string) => regras.catalogo.condicao(id)?.nome ?? id;

/** Papel dos painéis (o mesmo da FICHAS). */
function papel(el: HTMLElement, seed: number) {
  paperize(el, { seed, tone: '#d9c9a9', burn: 1, torn: 1.1, stains: 1, creases: 0.3, crumple: 0.35, specks: 0.6, pad: 18 });
  return el;
}

/** Título do painel: marcador vermelho, nome e um canto para o que vier à direita. */
function titulo(texto: string, ...extra: (Node | null)[]) {
  return h('header', { class: 'cb-tit' }, h('i', { class: 'cb-marca', 'aria-hidden': 'true' }), h('h3', null, texto), h('span', { class: 'cb-tit-extra' }, ...extra));
}

/** Os ícones de linha que têm o pintado do kit (arte/icones/<nome>.png); sem a arte, fica o de linha. */
const PINTADO: Partial<Record<NomeIcone, string>> = {
  mira: 'tabuleiro-alcance',
  regua: 'tabuleiro-medir',
  area: 'tabuleiro-area',
  tatico: 'tabuleiro-tatico',
  centralizar: 'tabuleiro-centralizar',
  avancar: 'combate-passar-turno',
  girarE: 'combate-desfazer',
  ok: 'combate-confirmar',
  ampulheta: 'combate-atrasar',
  escudo: 'combate-preparar',
  espadas: 'combate-atacar',
  dados: 'combate-dado',
  sol: 'clima-iluminacao',
  vento: 'clima-nevoa',
  montanha: 'clima-terreno',
  caveira: 'estado-morrendo',
  deitado: 'estado-caido',
  coracao: 'pv',
  estrela: 'combate-habilidade',
  mochila: 'combate-item',
  bota: 'combate-movimento',
  reticencias: 'combate-outras',
  pentagrama: 'estado-ritual',
  gota: 'cond-sangrando',
  lapis: 'botao-editar',
};
const icPintado = (icone: NomeIcone, pintado = PINTADO[icone]) => (pintado ? arteOu([`/arte/icones/${pintado}.png`], ic(icone)) : ic(icone));

function botao(rotulo: string, icone: NomeIcone | null, fn: () => void, cls = '', dica?: string, desligado = false) {
  return h('button', { class: `cb-bt ${cls}`, type: 'button', title: dica, disabled: desligado, onclick: () => (sfx.click(), fn()) }, icone ? icPintado(icone) : null, h('span', null, rotulo));
}

function botaoJanela(rotulo: string, icone: NomeIcone, cls: string, fn: () => void) {
  return h('button', { class: `fx-bt ${cls}`, type: 'button', onclick: fn }, ic(icone), h('span', null, rotulo));
}

/** Texto com os trechos em destaque (vermelhos no registro). */
function comDestaque(texto: string, destaques?: string[]): (string | HTMLElement)[] {
  if (!destaques?.length) return [texto];
  const out: (string | HTMLElement)[] = [];
  let resto = texto;
  for (const d of destaques) {
    const i = resto.indexOf(d);
    if (i < 0) continue;
    if (i) out.push(resto.slice(0, i));
    out.push(h('b', { class: 'cb-reg-destaque' }, d));
    resto = resto.slice(i + d.length);
  }
  if (resto) out.push(resto);
  return out;
}

/** Custo em PE de um poder ou habilidade da ficha (sem custo = passivo ou de graça). */
function custoPoder(p: regras.PoderObtido, f: regras.Ficha): number | undefined {
  const c = regras.catalogo;
  switch (p.tipo) {
    case 'classe':
      return c.poder(p.id)?.custoPe;
    case 'paranormal':
      return c.paranormal(p.id)?.custoPe;
    case 'trilha':
      return f.trilha ? c.trilha(f.trilha)?.habilidades.find((x) => x.id === p.id)?.custoPe : undefined;
    case 'origem': {
      const o = f.origem ? c.origem(f.origem) : undefined;
      return o?.poder.id === p.id ? o.poder.custoPe : undefined;
    }
    case 'habilidade':
      return f.classe ? c.classe(f.classe).habilidades.find((x) => x.id === p.id)?.custoPe : undefined;
  }
  return undefined;
}

export class CombateScreen {
  readonly el: HTMLElement;
  /** onde o tabuleiro aparece (a tela MAPA usa este retângulo como janela do canvas) */
  readonly quadro: HTMLElement;
  private app: App;
  private combate: Combate | null = null;
  private podeDesfazer = false;
  private ameacas: Record<string, cb.FichaAmeaca> = {};
  private fichas: FichaSalva[] = [];
  private calcCache = new Map<string, Calc | null>();
  private alvoId: number | null = null;
  private atorId: number | null = null;
  private aba: Aba = 'atacar';
  private filtro: 'todos' | cb.TipoRegistro = 'todos';
  private visivel = false;
  /** a tela está pondo a peça da vez no comando (a seleção que vem daí não troca o alvo) */
  private pondoNaVez = false;
  private ataque = new ResolucaoAtaque();
  private manobra = new ResolucaoManobra();
  private ritualRes = new ResolucaoRitual();
  // ferramentas do tabuleiro
  private mostrarAlcance = true;
  private medida: { a: Casa; b: Casa | null } | null = null;
  private area: { forma: FormaArea; metros: number; alvo: Casa | null; fixa: boolean } | null = null;
  private relogio = 0;
  private fundo: HTMLElement;
  private sigs = new Map<string, string>();
  private ultimaVez: string | null = null;
  private iniCorpo: HTMLElement;
  private rodadaEl: HTMLElement;
  private pendCorpo: HTMLElement;
  private resCorpo: HTMLElement;
  private alvoCorpo: HTMLElement;
  private regCorpo: HTMLElement;
  private regFiltro: HTMLSelectElement;
  private regDesfazer: HTMLButtonElement;
  private tabCena: HTMLElement;
  private tabClima: HTMLElement;
  private tabArea: HTMLElement;
  private btAlcance: HTMLButtonElement;
  private btTatico: HTMLButtonElement;
  private btMedir: HTMLButtonElement;
  private btArea: HTMLButtonElement;
  private btApontar: HTMLButtonElement;
  private btDesenhar: HTMLButtonElement;
  private alvoExtra: HTMLElement;
  /** Apontar e Desenhar (as ferramentas da mesa, as mesmas do MAPA): a tela MAPA liga e desliga */
  aoFerramentaMesa: ((tipo: 'ponto' | 'traco') => void) | null = null;

  constructor(app: App) {
    this.app = app;
    // ---------- ordem de iniciativa ----------
    // a rodada é também o menu do combate (pôr e tirar do combate, encerrar)
    this.rodadaEl = h('button', { class: 'cb-rodada', type: 'button', title: 'Mais do combate: pôr ou tirar alguém, encerrar', onclick: () => (sfx.click(), this.menu()) }, '—');
    this.iniCorpo = h('div', { class: 'cb-ini-corpo' });
    const pIni = papel(h('section', { class: 'cb-p cb-ini' }, titulo('ORDEM DE INICIATIVA', this.rodadaEl), this.iniCorpo), 301);
    // ---------- efeitos e pendências ----------
    this.pendCorpo = h('div', { class: 'cb-pend-corpo' });
    const pPend = papel(h('section', { class: 'cb-p cb-pend' }, titulo('EFEITOS E PENDÊNCIAS'), this.pendCorpo), 302);
    // ---------- tabuleiro ----------
    this.tabCena = h('span', { class: 'cb-tab-cena' }, '—');
    this.tabClima = h('div', { class: 'cb-tab-clima' });
    this.tabArea = h('div', { class: 'cb-tab-area hidden' });
    this.btAlcance = botao('Alcance', 'mira', () => ((this.mostrarAlcance = !this.mostrarAlcance), this.pintarFerramentas(), this.atualizarMarcas()), 'cb-ferr on', 'Anel de alcance da arma escolhida');
    this.btMedir = botao('Medir', 'regua', () => this.ferramentaMedir(), 'cb-ferr', 'Medir: clique em dois pontos do tabuleiro (Esc sai)');
    this.btArea = botao('Área', 'area', () => this.ferramentaArea(), 'cb-ferr', 'Área de ritual ou granada: escolha o formato e clique no tabuleiro (Esc sai)');
    // a vista tática: a câmera sobe e mostra a sala de cima (a mesa acompanha)
    this.btTatico = botao('Tática', 'tatico', () => this.trocarVista(), 'cb-ferr', 'Vista tática: a sala de cima, como mapa de batalha (T); de novo volta ao isométrico');
    // o que o mestre mostra na mesa: o ponto de atenção e o desenho rápido (docs/FERRAMENTAS-DA-MESA.md)
    this.btApontar = botao('Apontar', 'apontar', () => this.aoFerramentaMesa?.('ponto'), 'cb-ferr', 'Apontar: clique num lugar e a mesa pisca ali (P). Alt + clique aponta sem ligar');
    this.btDesenhar = botao('Desenhar', 'giz', () => this.aoFerramentaMesa?.('traco'), 'cb-ferr', 'Desenhar: arraste no tabuleiro; some sozinho (D). Formato e cor na aba MAPA');
    const ferr = h('div', { class: 'cb-tab-ferr' }, this.btAlcance, this.btMedir, this.btArea, this.btTatico, this.btApontar, this.btDesenhar, botao('Centralizar', 'centralizar', () => this.centralizar(), 'cb-ferr', 'Centralizar em quem está na vez'));
    this.quadro = h('section', { class: 'cb-tab' }, this.tabCena, ferr, this.tabArea, this.tabClima);
    // ---------- resolução da ação ----------
    this.resCorpo = h('div', { class: 'cb-res-corpo' });
    const pRes = papel(h('section', { class: 'cb-p cb-res' }, titulo('RESOLUÇÃO DA AÇÃO'), this.resCorpo), 303);
    // ---------- alvo ----------
    this.alvoCorpo = h('div', { class: 'cb-alvo-corpo' });
    this.alvoExtra = h('span', { class: 'cb-alvo-extra' });
    const pAlvo = papel(h('section', { class: 'cb-p cb-alvo' }, titulo('ALVO', this.alvoExtra), this.alvoCorpo), 304);
    // ---------- registro ----------
    this.regFiltro = h(
      'select',
      { class: 'cb-filtro', 'aria-label': 'Filtro do registro', onchange: () => ((this.filtro = this.regFiltro.value as typeof this.filtro), this.renderReg()) },
      ...FILTROS.map((f) => h('option', { value: f.id }, f.rotulo)),
    );
    this.regCorpo = h('div', { class: 'cb-reg-corpo' });
    this.regDesfazer = botao('Desfazer último', 'girarE', () => this.acao({ tipo: 'desfazer' }), 'cb-desfazer', 'Volta o combate um passo (com o dano que ele causou)');
    const anotar = h('button', { class: 'cb-menu', type: 'button', title: 'Anotar no registro', 'aria-label': 'Anotar no registro', onclick: () => (sfx.click(), void this.anotar()) }, icPintado('lapis'));
    const pReg = papel(h('section', { class: 'cb-p cb-reg' }, titulo('REGISTRO DO COMBATE', anotar), this.regFiltro, this.regCorpo, this.regDesfazer), 305);

    this.fundo = h('div', { class: 'cb-fundo', 'aria-hidden': 'true' });
    this.el = h('div', { class: 'cb hidden' }, this.fundo, h('div', { class: 'cb-palco' }, pIni, pPend, this.quadro, pRes, pAlvo, pReg));
    // o fundo escuro tem um buraco onde fica o tabuleiro
    new ResizeObserver(() => this.furar()).observe(this.quadro);
    window.addEventListener('resize', () => this.furar());
    window.addEventListener('keydown', (e) => {
      if (!this.visivel || e.key !== 'Escape' || (!this.medida && !this.area)) return;
      this.sairFerramenta();
    });

    app.session.subscribe(() => this.render());
    app.on('room', () => this.render());
    app.on('characters', () => (this.sigs.clear(), this.render()));
    app.on('selection', () => {
      const s = app.view?.selection;
      if (!this.visivel || this.pondoNaVez || s?.kind !== 'user' || s.id >= 0) return;
      // clicar numa peça do tabuleiro sem a tela interceptar (fora do combate): vira o alvo
      if (-s.id !== this.daVez()?.ator?.id) this.alvoId = -s.id;
      this.render();
    });
  }

  // ================================================================ entrada

  show() {
    this.visivel = true;
    this.el.classList.remove('hidden');
    this.sigs.clear();
    const v = this.app.view;
    v.aoClicarPeca = (id) => this.cliquePeca(id);
    this.render();
    requestAnimationFrame(() => this.furar());
    // as peças andam: distância, cobertura e marcações acompanham
    this.relogio = window.setInterval(() => {
      if (!this.visivel) return;
      this.renderRes();
      this.atualizarMarcas();
    }, 250);
  }

  hide() {
    this.visivel = false;
    this.el.classList.add('hidden');
    clearInterval(this.relogio);
    const v = this.app.view;
    if (v) {
      v.aoClicarPeca = null;
      v.aoClicarCasa = null;
      v.combate = null;
    }
    this.medida = null;
    this.area = null;
  }

  setCombate(c: Combate | null, podeDesfazer = false, ameacas: Record<string, cb.FichaAmeaca> = {}) {
    this.combate = c;
    this.podeDesfazer = podeDesfazer;
    this.ameacas = ameacas;
    if ((c?.vez ?? null) !== this.ultimaVez) {
      this.ultimaVez = c?.vez ?? null;
      this.atorId = null;
      this.porNaVez();
    }
    this.render();
  }

  setFichas(lista: FichaSalva[]) {
    this.fichas = lista;
    this.calcCache.clear();
    this.sigs.clear();
    this.render();
  }

  // ================================================================ dados

  private get sessao(): Session | null {
    return this.app.session.session;
  }

  private personagem(id: number): Character | null {
    return this.sessao?.characters.find((c) => c.id === id) ?? null;
  }

  private fichaDe(id: number): FichaSalva | null {
    const charId = this.personagem(id)?.look.charId;
    if (!charId) return null;
    return this.fichas.find((f) => f.personagem === charId) ?? null;
  }

  private calcDe(id: number): Calc | null {
    const f = this.fichaDe(id);
    if (!f) return null;
    const k = `${f.id}:${f.atualizadaEm}`;
    if (!this.calcCache.has(k)) {
      let c: Calc | null = null;
      try {
        c = regras.calcular(f.ficha);
      } catch {
        c = null;
      }
      this.calcCache.set(k, c);
    }
    return this.calcCache.get(k) ?? null;
  }

  private vitais(id: number): Vitals | undefined {
    return this.personagem(id)?.vitals;
  }

  private ameacaDe(id: number): cb.FichaAmeaca | null {
    return this.ameacas[String(id)] ?? null;
  }

  private nomeCena(sceneId: number) {
    const s = this.sessao?.scenes.find((x) => x.id === sceneId);
    return s ? nomeCurto(s.name) : '';
  }

  private retrato(id: number, tamanho: number) {
    return portraitCanvas(this.personagem(id)?.look ?? null, tamanho, { dir: 2, hurt: vitalConditions(this.vitais(id)).machucado });
  }

  private acao(a: cb.AcaoCombate) {
    this.app.net.send({ t: 'combate', a });
  }

  /** A entrada da vez e quem dela está agindo (no turno do mestre, o ser que o mestre escolheu). */
  private daVez(): { e: Entrada; ativos: Participante[]; ator: Participante | null } | null {
    const c = this.combate;
    if (!c || c.fase !== 'andamento') return null;
    const e = cb.entrada(c, c.vez);
    if (!e) return null;
    const ativos = cb.ativosDa(c, e);
    const ator = ativos.find((p) => p.id === this.atorId) ?? ativos[0] ?? null;
    return { e, ativos, ator };
  }

  /** Todas as condições de um ser: as do combate, as marcadas na ficha, as de PV e SAN e a surpresa da rodada 1. */
  private condicoesDe(c: Combate, p: Participante): string[] {
    const s = new Set(p.condicoes ?? []);
    for (const x of this.fichaDe(p.id)?.condicoes ?? []) s.add(x);
    const v = this.vitais(p.id);
    const vc = vitalConditions(v);
    if (vc.morrendo) {
      s.add('inconsciente');
      if (p.lado === 'agente') s.add('morrendo');
    }
    if (vc.machucado) s.add('machucado');
    if (vc.enlouquecendo) s.add('enlouquecendo');
    else if (vc.perturbado) s.add('perturbado');
    if (c.fase !== 'encerrado' && cb.surpreendido(c, p)) s.add('surpreendido');
    return [...s];
  }

  // ================================================================ ataque

  private armasDe(p: Participante): ArmaOpcao[] {
    const calc = this.calcDe(p.id);
    if (calc) return [...this.armasDaFicha(calc), ...this.jogadasDe(p, calc)];
    return (this.ameacaDe(p.id)?.ataques ?? []).map((a) => ({
      nome: a.nome,
      pericia: a.pericia,
      dados: a.dados,
      bonus: a.bonus,
      dano: a.dano,
      tipo: a.tipo,
      margem: a.margem,
      multiplicador: a.multiplicador,
      faixa: cb.faixaArma(a.alcance),
      notas: [],
      ...(a.vezes ? { vezes: a.vezes } : {}),
      ...(a.extra ? { extra: a.extra } : {}),
    }));
  }

  /**
   * As jogadas prontas do agente, conferidas agora: o PE que sobra na peça e o já gasto no turno
   * (LR p. 23). A margem e o crítico são os da arma da jogada; o dano passa pela resistência e
   * pela RD do alvo como qualquer ataque.
   */
  private jogadasDe(p: Participante, calc: regras.Calculado): ArmaOpcao[] {
    const fs = this.fichaDe(p.id);
    if (!fs?.jogadas?.length) return [];
    const gasto = this.combate ? (cb.acoesDe(this.combate, p.id).pe ?? 0) : 0;
    const peAtual = this.vitais(p.id)?.pe;
    return fs.jogadas.map((j) => {
      const r = regras.conferirJogada(fs.ficha, calc, j, { ...(peAtual !== undefined ? { peAtual } : {}), gastoTurno: gasto });
      const a = r.ataque;
      const jogada = { nome: j.nome, pe: r.pe, linhas: r.linhas, erros: r.erros, avisos: r.avisos, ...(j.nota ? { nota: j.nota } : {}) };
      if (!a) return { nome: j.nome, pericia: 'luta' as const, dados: 0, bonus: 0, dano: '—', tipo: 'impacto' as const, margem: 20, multiplicador: 2, faixa: null, notas: [], jogada: { ...jogada, erros: r.erros.length ? r.erros : ['Sem ataque.'] } };
      return {
        naMao: a.naMao,
        ...(a.uid !== undefined ? { uid: a.uid } : {}),
        nome: `${j.nome} (${a.nome})`,
        pericia: a.pericia === 'pontaria' ? ('pontaria' as const) : ('luta' as const),
        dados: a.dados,
        penalidade: a.penalidadeDados,
        bonus: a.bonus,
        dano: a.dano,
        tipo: a.tipoDano[0] ?? 'impacto',
        margem: a.critico.margem,
        multiplicador: a.critico.multiplicador,
        faixa: cb.faixaArma(a.alcance),
        notas: a.notas,
        jogada: a.naMao ? jogada : { ...jogada, erros: [...jogada.erros, `${a.nome} está guardada: saque antes (ação de movimento).`] },
      };
    });
  }

  private armasDaFicha(calc: regras.Calculado): ArmaOpcao[] {
    {
      // a arma na mão primeiro (e o desarmado); a da mochila por último, para sacar
      return [...calc.ataques].sort((x, y) => Number(y.naMao) - Number(x.naMao)).map((a) => ({
        item: a.item,
        naMao: a.naMao,
        ...(a.uid !== undefined ? { uid: a.uid } : {}),
        nome: a.nome,
        pericia: a.pericia === 'pontaria' ? 'pontaria' : 'luta',
        dados: a.dados,
        penalidade: a.penalidadeDados,
        bonus: a.bonus,
        dano: a.dano,
        tipo: a.tipoDano[0] ?? 'impacto',
        margem: a.critico.margem,
        multiplicador: a.critico.multiplicador,
        faixa: cb.faixaArma(a.alcance),
        notas: a.notas,
      }));
    }
  }

  private alvoAtaque(c: Combate, p: Participante): AlvoAtaque {
    const calc = this.calcDe(p.id);
    const f = this.ameacaDe(p.id);
    return {
      p,
      agente: p.lado === 'agente',
      defesa: calc?.defesa ?? f?.defesa ?? null,
      rd: calc?.resistencias ?? f?.rd ?? {},
      // a criatura é imune a dano mental mesmo na ficha feita à mão (LR p. 180)
      imunidades: f ? cb.imunidadesDaAmeaca(f) : [],
      vulnerabilidades: f?.vulnerabilidades ?? [],
      vitais: this.vitais(p.id),
      reacoes: p.lado === 'agente' && calc ? calc.reacoes : null,
      condicoes: this.condicoesDe(c, p),
    };
  }

  /** Casa de uma peça no cômodo à vista (null = em outra cena). */
  private casa(id: number): Casa | null {
    const u = this.app.view?.users.get(-id);
    return u ? { x: u.x, y: u.y } : null;
  }

  private tabuleiroEntre(c: Combate, ator: Participante, alvo: Participante): TabuleiroAtaque | null {
    const map = this.app.view?.map;
    const a = this.casa(ator.id);
    const b = this.casa(alvo.id);
    if (!map || !a || !b) return a && b ? null : { metros: null, adjacente: false, cobertura: { tipo: 'nenhuma' }, elevado: false, flanqueia: false, emCorpoACorpo: false };
    const outras: Casa[] = [];
    for (const u of this.app.view.users.values()) if (-u.id !== ator.id && -u.id !== alvo.id) outras.push({ x: u.x, y: u.y });
    const doLado = c.participantes.filter((p) => p.lado === ator.lado && !p.fora && !vitalConditions(this.vitais(p.id)).morrendo);
    const casasLado = doLado.map((p) => this.casa(p.id)).filter((x): x is Casa => !!x);
    return {
      metros: cb.metrosDe(cb.distanciaCasas(a, b)),
      adjacente: cb.adjacente(a, b),
      cobertura: coberturaEntre(map, a, b, outras),
      elevado: elevado(map, a, b),
      flanqueia: flanqueia(
        a,
        b,
        casasLado.filter((x) => !(x.x === a.x && x.y === a.y)),
      ),
      emCorpoACorpo: casasLado.some((x) => cb.adjacente(x, b)),
    };
  }

  private clima(): { escuridao: CtxAtaque['escuridao']; nevoa: CtxAtaque['nevoa'] } {
    const r = this.app.state.room;
    const esc = r ? (r.lightMode === 'blackout' ? 1 : r.darkness) : 0;
    const fog = r?.fog ?? 0;
    return { escuridao: esc > 0.8 ? 'total' : esc >= 0.5 ? 'camuflagem' : 'normal', nevoa: fog >= 0.6 ? 'espessa' : fog >= 0.2 ? 'camuflagem' : 'nenhuma' };
  }

  private ctxAtaque(c: Combate, ator: Participante): CtxAtaque {
    const alvoP = this.alvoId !== null && this.alvoId !== ator.id ? cb.participante(c, this.alvoId) : undefined;
    const alvo = alvoP && !alvoP.fora ? this.alvoAtaque(c, alvoP) : null;
    return {
      combate: c,
      ator,
      condicoesAtor: this.condicoesDe(c, ator),
      armas: this.armasDe(ator),
      alvo,
      tab: alvo ? this.tabuleiroEntre(c, ator, alvo.p) : null,
      ...this.clima(),
      acoes: cb.acoesDe(c, ator.id),
      enviar: (a) => this.acao(a),
      sacar: (arma) => arma.uid !== undefined && this.acao({ tipo: 'declarar', qual: 'movimento', texto: `sacou ${arma.nome}`, quem: ator.id, sacar: arma.uid }),
      mudou: () => (this.sigs.delete('res'), this.renderRes(), this.atualizarMarcas()),
    };
  }

  // ================================================================ manobra

  /** Luta de quem resiste à manobra: a da ficha, a da ameaça, ou a do primeiro ataque corpo a corpo dela. */
  private lutaDe(p: Participante): TesteLuta | null {
    const calc = this.calcDe(p.id);
    const l = calc?.pericias.luta;
    if (l) return { dados: l.dados, bonus: l.bonus, penalidade: l.penalidadeDados, origem: 'da ficha' };
    const f = this.ameacaDe(p.id);
    if (f?.luta) return { ...f.luta, origem: 'da ficha da ameaça' };
    const golpe = f?.ataques.find((a) => a.pericia === 'luta');
    return golpe ? { dados: golpe.dados, bonus: golpe.bonus, origem: `pelo ataque ${golpe.nome}` } : null;
  }

  private tamanhoDe(p: Participante): cb.Tamanho {
    return this.ameacaDe(p.id)?.tamanho ?? 'medio';
  }

  private ctxManobra(c: Combate, ator: Participante): CtxManobra {
    const alvoP = this.alvoId !== null && this.alvoId !== ator.id ? cb.participante(c, this.alvoId) : undefined;
    const agarraP = ator.agarra ? cb.participante(c, ator.agarra) : undefined;
    const porP = c.participantes.find((q) => q.agarra === ator.id && !q.fora);
    return {
      combate: c,
      ator,
      condicoesAtor: this.condicoesDe(c, ator),
      armas: this.armasDe(ator),
      tamanhoAtor: this.tamanhoDe(ator),
      alvo: alvoP && !alvoP.fora ? this.alvoAtaque(c, alvoP) : null,
      agarra: agarraP && !agarraP.fora ? this.alvoAtaque(c, agarraP) : null,
      agarradoPor: porP ? this.alvoAtaque(c, porP) : null,
      lutaDe: (p) => this.lutaDe(p),
      tamanhoDe: (p) => this.tamanhoDe(p),
      tabDe: (p) => this.tabuleiroEntre(c, ator, p),
      acoes: cb.acoesDe(c, ator.id),
      enviar: (a) => this.acao(a),
      empurrar: (alvo, casas) => this.empurrar(ator.id, alvo, casas),
      mudou: () => (this.sigs.delete('res'), this.renderRes(), this.atualizarMarcas()),
    };
  }

  /**
   * Empurra a peça do alvo para longe de quem age, em linha reta, até `casas`
   * ou até a primeira casa bloqueada ou ocupada (COMBATE.md 9: o mestre ajusta).
   */
  private empurrar(atorId: number, alvoId: number, casas: number) {
    const map = this.app.view?.map;
    const a = this.casa(atorId);
    const b = this.casa(alvoId);
    if (!map || !a || !b || casas <= 0) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const dx = Math.round(Math.cos(ang));
    const dy = Math.round(Math.sin(ang));
    if (!dx && !dy) return;
    const ocupadas = new Set<string>();
    for (const u of this.app.view.users.values()) if (-u.id !== alvoId) ocupadas.add(`${u.x},${u.y}`);
    let dest = b;
    for (let i = 1; i <= casas; i++) {
      const c = { x: b.x + dx * i, y: b.y + dy * i };
      if (map.walkState(c.x, c.y) === 'blocked' || ocupadas.has(`${c.x},${c.y}`)) break;
      dest = c;
    }
    if (dest === b) return toast('Sem espaço para empurrar: ajuste a peça à mão.');
    this.app.net.send({ t: 'tokenWalk', tokenId: -alvoId, x: dest.x, y: dest.y });
  }

  // ================================================================ ritual

  /** Os rituais da ficha, com o custo e a DT de cada forma e o motivo das travadas (LR p. 121). */
  private rituaisDe(p: Participante): RitualOpcao[] {
    const calc = this.calcDe(p.id);
    const ficha = this.fichaDe(p.id)?.ficha;
    if (!calc || !ficha) return [];
    const circuloMax = ficha.classe ? regras.circuloMaximo(ficha.classe, ficha.nex) : 0;
    // a afinidade escolhida em 50% só vale depois do próximo poder paranormal (LR p. 110, 114)
    let afinidade: regras.Elemento | null = null;
    try {
      const st = regras.montarEstado(ficha);
      afinidade = st.afinidadeAtiva ? st.afinidade : null;
    } catch {
      afinidade = null;
    }
    const out: RitualOpcao[] = [];
    for (const r of calc.rituais) {
      const d = regras.catalogo.ritual(r.id);
      if (!d) continue;
      const custo = calc.custoRituais[r.id] ?? { pe: 1, dt: calc.dtRituais, base: 1, ajuste: 0 };
      // o mínimo de 1 PE vale no custo final, com a forma (LR p. 78, 121)
      const formas = (['basica', 'discente', 'verdadeira'] as cb.FormaRitual[])
        .filter((f) => f === 'basica' || (f === 'discente' ? d.discente : d.verdadeiro))
        .map((f) => ({ forma: f, pe: cb.custoDaForma(custo.base, d, f, custo.ajuste), motivo: cb.formaLiberada(d, f, circuloMax, afinidade) }));
      const exec = d.execucao;
      out.push({
        id: d.id,
        nome: d.nome,
        elemento: d.elemento,
        circulo: d.circulo,
        qual: exec === 'movimento' || exec === 'completa' || exec === 'livre' || exec === 'reacao' ? exec : 'padrao',
        alcance: d.alcance,
        ...(d.alvo ? { alvo: d.alvo } : {}),
        duracao: d.duracao,
        ...(d.resistencia ? { resistencia: d.resistencia } : {}),
        dt: custo.dt,
        formas,
        ref: `${d.ref.fonte} p. ${d.ref.pagina}`,
      });
    }
    return out;
  }

  /** Quem do combate está na área desenhada (a ferramenta Área, já fixada no tabuleiro). */
  private naAreaDoCombate(c: Combate, ator: Participante): AlvoAtaque[] | null {
    const a = this.area;
    if (!a?.fixa || !a.alvo) return null;
    const origem = this.casa(ator.id) ?? a.alvo;
    const area = { forma: a.forma, metros: a.metros, origem, alvo: a.alvo };
    return c.participantes.filter((p) => !p.fora && (() => { const x = this.casa(p.id); return !!x && naArea(area, x); })()).map((p) => this.alvoAtaque(c, p));
  }

  private ctxRitual(c: Combate, ator: Participante): CtxRitual {
    const alvoP = this.alvoId !== null ? cb.participante(c, this.alvoId) : undefined;
    const calc = this.calcDe(ator.id);
    const ac = cb.acoesDe(c, ator.id);
    return {
      combate: c,
      ator,
      agente: ator.lado === 'agente' && !!calc,
      condicoesAtor: this.condicoesDe(c, ator),
      rituais: this.rituaisDe(ator),
      ocultismo: calc ? { dados: calc.pericias.ocultismo.dados, bonus: calc.pericias.ocultismo.bonus, penalidade: calc.pericias.ocultismo.penalidadeDados } : null,
      vontade: calc ? { dados: calc.pericias.vontade.dados, bonus: calc.pericias.vontade.bonus, penalidade: calc.pericias.vontade.penalidadeDados } : null,
      limite: calc ? (calc.limitePeRituais ?? calc.limitePe) : null,
      gasto: ac.pe ?? 0,
      alvo: alvoP && !alvoP.fora ? this.alvoAtaque(c, alvoP) : null,
      naArea: this.naAreaDoCombate(c, ator),
      testeDe: (p, t) => {
        const pc = this.calcDe(p.id)?.pericias[t];
        if (pc) return { dados: pc.dados, bonus: pc.bonus, penalidade: pc.penalidadeDados };
        const f = this.ameacaDe(p.id);
        return f ? { ...f[t] } : null;
      },
      elementoDe: (p) => this.ameacaDe(p.id)?.elemento ?? null,
      metrosAte: (p) => {
        const a = this.casa(ator.id);
        const b = this.casa(p.id);
        return a && b ? cb.metrosDe(cb.distanciaCasas(a, b)) : null;
      },
      acoes: ac,
      pedirArea: () => this.ferramentaArea(),
      enviar: (a) => this.acao(a),
      mudou: () => (this.sigs.delete('res'), this.renderRes(), this.atualizarMarcas()),
    };
  }

  // ================================================================ tabuleiro

  /** Recorta o fundo escuro no retângulo do tabuleiro (o canvas aparece por baixo). */
  private furar() {
    if (!this.visivel) return;
    const r = this.quadro.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.fundo.style.clipPath = `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${r.left}px ${r.top}px, ${r.right}px ${r.top}px, ${r.right}px ${r.bottom}px, ${r.left}px ${r.bottom}px, ${r.left}px ${r.top}px)`;
  }

  private centralizar() {
    const at = this.daVez()?.ator;
    const v = this.app.view;
    if (at && v.users.has(-at.id)) v.focusUser(-at.id);
    else v.fit();
  }

  /** A vez mudou: a peça de quem age passa a ser a comandada no tabuleiro. */
  private porNaVez() {
    const at = this.daVez()?.ator;
    const v = this.app.view;
    if (!at || !v || !v.users.has(-at.id)) return;
    this.pondoNaVez = true;
    try {
      v.setActive(-at.id);
    } finally {
      this.pondoNaVez = false;
    }
    if (this.visivel) v.focusUser(-at.id);
  }

  /** Clique numa peça: um ser da vez passa a agir; qualquer outro vira o alvo. */
  private cliquePeca(viewId: number): boolean {
    const c = this.combate;
    if (!c || c.fase === 'encerrado') return false;
    const id = -viewId;
    const v = this.daVez();
    if (v?.ativos.some((p) => p.id === id)) {
      this.atorId = id;
      this.render();
      return false;
    }
    this.alvoId = id;
    sfx.click();
    this.render();
    return true;
  }

  /** A ferramenta da mesa ligada (o MAPA avisa). */
  marcarFerramentaMesa(tipo: string | null) {
    this.btApontar.classList.toggle('on', tipo === 'ponto');
    this.btDesenhar.classList.toggle('on', tipo === 'traco');
  }

  private pintarFerramentas() {
    this.btAlcance.classList.toggle('on', this.mostrarAlcance);
    this.btMedir.classList.toggle('on', !!this.medida);
    this.btArea.classList.toggle('on', !!this.area);
  }

  private sairFerramenta() {
    this.medida = null;
    this.area = null;
    this.app.view.aoClicarCasa = null;
    this.tabArea.classList.add('hidden');
    this.pintarFerramentas();
    this.atualizarMarcas();
  }

  private ferramentaMedir() {
    if (this.medida) return this.sairFerramenta();
    this.area = null;
    this.tabArea.classList.add('hidden');
    this.medida = { a: { x: -1, y: -1 }, b: null };
    this.app.view.aoClicarCasa = (x, y) => {
      const m = this.medida;
      if (!m) return false;
      if (m.a.x < 0 || m.b) this.medida = { a: { x, y }, b: null };
      else m.b = { x, y };
      this.atualizarMarcas();
      return true;
    };
    this.pintarFerramentas();
    toast('Medir: clique no primeiro ponto e depois no segundo. Esc sai.');
  }

  private ferramentaArea() {
    if (this.area) return this.sairFerramenta();
    const j = janela('ÁREA', 'area', () => {}, 50);
    let forma: FormaArea = 'esfera';
    const tam = h('select', { class: 'fx-inp' }, ...[1.5, 3, 4.5, 6, 9, 12, 18].map((m) => h('option', { value: String(m), selected: m === 6 }, `${String(m).replace('.', ',')} m`)));
    const formas = h('div', { class: 'cb-dlg-lista quatro' });
    const desenhar = () =>
      formas.replaceChildren(
        ...FORMAS.map((f) => h('button', { class: `cb-dlg-peca${f.id === forma ? ' on' : ''}`, type: 'button', onclick: () => ((forma = f.id), desenhar()) }, h('span', null, h('b', null, f.nome), h('small', null, f.id === 'esfera' ? 'raio, num ponto' : f.id === 'cubo' ? 'lado, num ponto' : 'sai de quem age')))),
      );
    desenhar();
    j.corpo.append(formas, h('label', { class: 'fj-campo' }, h('span', null, 'Tamanho (raio da esfera, lado do cubo, comprimento do cone e da linha)'), tam), h('p', { class: 'fj-texto' }, 'Depois clique no tabuleiro para pôr a área. Esc sai.'));
    j.rodape.append(
      h('span', { class: 'fj-esp' }),
      botaoJanela('Cancelar', 'fechar', '', () => j.fechar()),
      botaoJanela('Pôr no tabuleiro', 'ok', 'forte', () => {
        this.medida = null;
        this.area = { forma, metros: Number(tam.value), alvo: null, fixa: false };
        this.app.view.aoClicarCasa = (x, y) => {
          if (!this.area) return false;
          this.area.alvo = { x, y };
          this.area.fixa = true;
          this.atualizarMarcas();
          return true;
        };
        this.pintarFerramentas();
        this.atualizarMarcas();
        j.fechar();
      }),
    );
  }

  /** Troca a câmera do tabuleiro: isométrica ou tática (só o mestre; a mesa acompanha). */
  private trocarVista() {
    if (!this.app.state.room?.isOwner) return;
    this.app.net.send({ t: 'roomFx', tatico: !this.app.view.tatico });
  }

  /** O botão da vista tática aceso enquanto ela está ligada. */
  marcarVista(tatico: boolean) {
    this.btTatico.classList.toggle('on', tatico);
  }

  /** Marcações do combate no tabuleiro (bases, deitados, alcance, linha, cobertura, medida, área). */
  private atualizarMarcas() {
    const v = this.app.view;
    if (!v) return;
    if (!this.visivel) {
      v.combate = null;
      return;
    }
    const m = marcasVazias();
    const c = this.combate;
    if (c && c.fase !== 'encerrado') {
      for (const p of c.participantes) {
        if (p.fora) continue;
        const vid = -p.id;
        m.bases.set(vid, COR_LADO[p.lado]);
        const cs = this.condicoesDe(c, p);
        if (cs.includes('caido') || cs.includes('inconsciente')) m.deitadas.add(vid);
        if (vitalConditions(this.vitais(p.id)).morrendo) m.caveiras.add(vid);
        if (p.sustenta) m.rituais.add(vid);
      }
      const vez = this.daVez();
      const ator = vez?.ator;
      for (const p of vez?.ativos ?? []) m.vez.add(-p.id);
      if (ator && this.aba === 'atacar') {
        const x = this.ctxAtaque(c, ator);
        const arma = this.ataque.armaEscolhida(x);
        if (this.mostrarAlcance && arma && v.users.has(-ator.id)) {
          const metros = arma.faixa ? cb.METROS_FAIXA[arma.faixa] : 1.5;
          m.alcance = { id: -ator.id, casas: metros / cb.METROS_POR_CASA, rotulo: arma.faixa ? `${cb.NOME_FAIXA[arma.faixa]} ${cb.textoMetros(metros)}` : 'corpo a corpo', dobro: !!arma.faixa };
        }
        if (x.alvo) {
          m.mira = -x.alvo.p.id;
          const t = x.tab;
          if (t && t.metros !== null && v.users.has(-ator.id) && v.users.has(-x.alvo.p.id)) {
            const f = cb.faixaDaDistancia(t.metros);
            const limite = arma?.faixa ? 2 * cb.METROS_FAIXA[arma.faixa] : null;
            const fora = arma ? (arma.faixa ? t.metros > limite! : !t.adjacente) : false;
            m.linha = { de: -ator.id, ate: -x.alvo.p.id, rotulo: `${cb.textoMetros(t.metros)} · ${t.adjacente ? 'adjacente' : f ? cb.NOME_FAIXA[f] : 'além'}`, fora };
            if (t.cobertura.tipo !== 'nenhuma' && t.cobertura.casa)
              m.cobertura = { casa: t.cobertura.casa, rotulo: t.cobertura.tipo === 'total' ? 'cobertura total' : 'cobertura +5', total: t.cobertura.tipo === 'total' };
          }
        }
      } else if (ator && this.aba === 'manobra') {
        const x = this.ctxManobra(c, ator);
        const alvo = this.manobra.alvoEscolhido(x);
        if (this.mostrarAlcance && v.users.has(-ator.id)) m.alcance = { id: -ator.id, casas: 1.5 / cb.METROS_POR_CASA, rotulo: 'corpo a corpo', dobro: false };
        if (alvo) {
          m.mira = -alvo.p.id;
          const t = x.tabDe(alvo.p);
          if (t && t.metros !== null && v.users.has(-ator.id) && v.users.has(-alvo.p.id))
            m.linha = { de: -ator.id, ate: -alvo.p.id, rotulo: `${cb.textoMetros(t.metros)} · ${t.adjacente ? 'adjacente' : 'longe'}`, fora: !t.adjacente };
        }
      } else if (ator && this.aba === 'ritual' && this.alvoId !== null && this.alvoId !== ator.id && v.users.has(-this.alvoId)) {
        m.mira = -this.alvoId;
        const a = this.casa(ator.id);
        const b = this.casa(this.alvoId);
        if (a && b && v.users.has(-ator.id)) m.linha = { de: -ator.id, ate: -this.alvoId, rotulo: cb.textoMetros(cb.metrosDe(cb.distanciaCasas(a, b))) };
      } else if (this.alvoId !== null && v.users.has(-this.alvoId)) m.mira = -this.alvoId;
    }
    // ferramentas
    if (this.medida && this.medida.a.x >= 0) m.medida = this.medida;
    if (this.area) {
      const alvo = this.area.fixa ? this.area.alvo : v.casaDoMouse;
      const ator = this.daVez()?.ator;
      const origem = (ator && this.casa(ator.id)) ?? alvo;
      if (alvo && origem) {
        const nome = FORMAS.find((f) => f.id === this.area!.forma)!.nome;
        const area = { forma: this.area.forma, metros: this.area.metros, origem, alvo };
        m.area = { ...area, rotulo: `${nome.toLowerCase()} ${cb.textoMetros(this.area.metros)}` };
        const dentro: string[] = [];
        for (const u of v.users.values()) {
          if (naArea(area, { x: u.x, y: u.y })) {
            m.naArea.add(u.id);
            dentro.push(u.name);
          }
        }
        const txt = dentro.length ? `Na área (${dentro.length}): ${dentro.join(', ')}` : 'Ninguém na área';
        if (this.tabArea.textContent !== txt) this.tabArea.replaceChildren(ic('area'), h('span', null, txt));
        this.tabArea.classList.remove('hidden');
      }
    }
    v.combate = m;
  }

  // ================================================================ desenho

  private mudou(parte: string, dados: unknown) {
    const s = JSON.stringify(dados);
    if (this.sigs.get(parte) === s) return false;
    this.sigs.set(parte, s);
    return true;
  }

  /** Troca o conteúdo de um painel mantendo a rolagem e o campo onde o mestre está digitando. */
  private trocar(corpo: HTMLElement, ...filhos: (Node | string)[]) {
    const at = document.activeElement as HTMLInputElement | null;
    const chave = at && corpo.contains(at) ? at.dataset.foco : undefined;
    const digitado = chave && at && at.tagName === 'INPUT' && at.value !== at.defaultValue ? at.value : undefined;
    const rolagens = [...corpo.querySelectorAll('.cb-rola')].map((x) => x.scrollTop);
    corpo.replaceChildren(...filhos);
    corpo.querySelectorAll<HTMLElement>('.cb-rola').forEach((x, i) => {
      x.scrollTop = rolagens[i] ?? 0;
      avisarRolagem(x);
    });
    if (!chave) return;
    const novo = corpo.querySelector<HTMLInputElement>(`[data-foco="${chave}"]`);
    if (!novo) return;
    if (digitado !== undefined) novo.value = digitado;
    novo.focus();
  }

  private render() {
    if (!this.visivel) return;
    this.renderIni();
    this.renderPend();
    this.renderTab();
    this.renderRes();
    this.renderAlvo();
    this.renderReg();
    this.atualizarMarcas();
  }

  /** O que muda o desenho de uma peça (sem a posição no tabuleiro). */
  private assinaturaPecas() {
    return (this.sessao?.characters ?? []).map((c) => [c.id, c.name, c.sceneId, c.look.charId, c.vitals]);
  }

  private assinaturaFichas() {
    return this.fichas.map((f) => [f.id, f.personagem, f.atualizadaEm]);
  }

  // ---------------------------------------------------------------- iniciativa

  private renderIni() {
    const c = this.combate;
    if (!this.mudou('ini', [c && { ...c, registro: 0 }, this.assinaturaPecas(), this.assinaturaFichas()])) return;
    this.rodadaEl.textContent = !c ? 'Rodada —' : c.fase === 'montando' ? 'Montando' : c.fase === 'encerrado' ? 'Encerrado' : `Rodada ${c.rodada}`;
    if (!c) {
      this.iniCorpo.replaceChildren(h('p', { class: 'cb-vazio' }, 'Nenhum combate nesta campanha. Abra um na resolução da ação.'));
      return;
    }
    const linhas: HTMLElement[] = cb.entradas(c).map((e) => this.linhaIni(c, e));
    // quem ainda não tem lugar na ordem (sem Iniciativa)
    for (const p of c.participantes.filter((x) => x.lado === 'agente' && x.iniciativa === null)) linhas.push(this.linhaSemLugar(p.nome, NOME_LADO[p.lado], [p.id]));
    const doM = c.participantes.filter(cb.doMestre);
    if (doM.length && c.mestre.iniciativa === null)
      linhas.push(
        this.linhaSemLugar(
          'TURNO DO MESTRE',
          doM.map((x) => x.nome).join(' · '),
          doM.map((x) => x.id),
        ),
      );
    const vez = c.fase === 'andamento' && !!c.vez;
    const botoes = h(
      'div',
      { class: 'cb-ini-botoes' },
      botao('Atrasar', 'ampulheta', () => void this.atrasar(), 'escuro', 'Agir mais tarde nesta rodada (LR p. 87)', !vez),
      botao('Preparar', 'escudo', () => void this.preparar(), 'escuro', 'Preparar uma ação com gatilho (LR p. 86)', !vez),
      botao('Passar turno', 'avancar', () => this.acao({ tipo: 'passar' }), 'escuro', 'Fim do turno de quem está na vez', !vez),
    );
    this.trocar(this.iniCorpo, h('div', { class: 'cb-ini-lista cb-rola' }, ...linhas), botoes);
  }

  private linhaIni(c: Combate, e: Entrada): HTMLElement {
    const naVez = c.fase === 'andamento' && c.vez === e.id;
    const agiu = c.fase === 'andamento' && c.agiram.includes(e.id) && !naVez;
    const ps = e.participantes.map((id) => cb.participante(c, id)).filter((p): p is Participante => !!p);
    const nome = e.mestre ? 'TURNO DO MESTRE' : (ps[0]?.nome ?? '?');
    const sub = e.mestre ? ps.map((p) => p.nome).join(' · ') : NOME_LADO[ps[0]?.lado ?? 'agente'];
    return h(
      'button',
      {
        class: `cb-ini-linha${naVez ? ' vez' : ''}${agiu ? ' agiu' : ''}${e.mestre ? ' mestre' : ''}`,
        type: 'button',
        title: e.mestre ? 'Turno do mestre: os seres dele agem juntos neste turno' : `Ver ${nome} no alvo`,
        onclick: () => {
          sfx.click();
          const id = ps[0]?.id ?? null;
          if (id !== null && id !== this.daVez()?.ator?.id) this.alvoId = id;
          this.render();
        },
      },
      h('span', { class: 'cb-num' }, String(e.valor)),
      this.fotos(
        ps.map((p) => p.id),
        ps.map((p) => !!p.fora),
      ),
      h(
        'span',
        { class: 'cb-ini-txt' },
        h('b', null, nome),
        h('span', { class: 'cb-ini-sub' }, h('span', null, sub), naVez ? h('span', { class: 'cb-suavez' }, 'Sua vez') : e.mestre ? this.estadoMestre(c, ps) : this.estadoCurto(c, ps[0])),
      ),
      naVez ? h('span', { class: 'cb-seta' }, ic('direita')) : null,
    );
  }

  private linhaSemLugar(nome: string, sub: string, ids: number[]): HTMLElement {
    return h(
      'div',
      { class: 'cb-ini-linha sem' },
      h('span', { class: 'cb-num' }, '—'),
      this.fotos(ids, []),
      h('span', { class: 'cb-ini-txt' }, h('b', null, nome), h('span', { class: 'cb-ini-sub' }, h('span', null, sub), h('span', { class: 'cb-estado aviso' }, 'sem Iniciativa'))),
    );
  }

  private fotos(ids: number[], fora: boolean[]) {
    const n = Math.min(ids.length, 3);
    return h('span', { class: `cb-fotos n${n}` }, ...ids.slice(0, 3).map((id, i) => h('span', { class: `cb-foto${fora[i] ? ' fora' : ''}` }, this.retrato(id, 64))));
  }

  /** O estado mais importante de um ser, para a linha da ordem. */
  private estadoCurto(c: Combate, p: Participante | undefined): HTMLElement | null {
    if (!p) return null;
    const cond = vitalConditions(this.vitais(p.id));
    const cs = this.condicoesDe(c, p);
    const est = (icone: NomeIcone, texto: string, cls: string, pintado?: string) => h('span', { class: `cb-estado ${cls}` }, pintado ? icPintado(icone, pintado) : ic(icone), h('span', null, texto));
    if (p.fora) return est('caveira', NOME_FORA[p.fora], 'ruim', 'estado-caido');
    if (cond.morrendo) return est('caveira', `Morrendo ${p.morrendo}/3`, 'ruim', 'estado-morrendo');
    if (cond.enlouquecendo) return est('espiral', `Enlouquecendo ${p.enlouquecendo}/3`, 'ruim');
    if (c.fase !== 'encerrado' && cb.surpreendido(c, p)) return est('alerta', 'Surpreendido', 'aviso');
    if (c.fase === 'andamento' && p.desde > c.rodada) return est('entrar', `Entra na rodada ${p.desde}`, 'aviso');
    if (p.sustenta) return est('pentagrama', 'Ritual sustentado', 'ritual', 'estado-ritual');
    if (cs.includes('caido')) return est('deitado', 'Caído', '');
    const outra = (p.condicoes ?? []).find((x) => ICONE_CONDICAO[x]);
    if (outra) return est(ICONE_CONDICAO[outra], nomeCond(outra), 'aviso');
    if (c.preparadas.some((x) => x.entrada === cb.idAgente(p.id))) return est('escudo', 'Ação preparada', 'aviso');
    if (cond.machucado) return est('gota', 'Machucado', 'aviso');
    if (cond.perturbado) return est('espiral', 'Perturbado', 'aviso');
    return null;
  }

  /** No turno do mestre: quantos dele estão fora, caídos ou sustentando. */
  private estadoMestre(c: Combate, ps: Participante[]): HTMLElement | null {
    const fora = ps.filter((p) => p.fora || vitalConditions(this.vitais(p.id)).morrendo).length;
    if (fora) return h('span', { class: 'cb-estado ruim' }, ic('caveira'), h('span', null, `${fora} fora`));
    if (ps.some((p) => p.sustenta)) return h('span', { class: 'cb-estado ritual' }, icPintado('pentagrama', 'estado-ritual'), h('span', null, 'Ritual'));
    void c;
    return null;
  }

  // ---------------------------------------------------------------- pendências

  private renderPend() {
    const c = this.combate;
    if (!this.mudou('pend', [c && { ...c, registro: c.registro.slice(-16) }, this.assinaturaPecas(), this.assinaturaFichas(), this.atorId])) return;
    const itens: HTMLElement[] = [];
    const item = (icone: NomeIcone, cls: string, texto: Node | string, ...extra: (Node | null)[]) =>
      h('div', { class: `cb-pend-item ${cls}` }, h('span', { class: 'cb-pend-ic' }, icPintado(icone)), h('p', null, texto, ...extra));
    const quem = (nome: string, resto: string) => h('span', null, h('b', null, `${nome}: `), resto);
    if (!c) itens.push(item('espadas', 'neutro', 'Abra o combate na cena para montar a ordem de iniciativa.'));
    else if (c.fase === 'montando') {
      itens.push(item('pessoa', 'neutro', 'Inclua quem luta, diga o lado de cada um e marque quem não percebeu os inimigos: fica surpreendido na rodada 1.'));
      itens.push(item('dados', 'neutro', 'Cada agente rola a própria Iniciativa. O mestre rola uma vez pelo grupo dele, com o menor bônus de Iniciativa entre os seres (LR p. 83).'));
      for (const g of cb.empates(c))
        itens.push(
          item(
            'alerta',
            'aviso',
            `Empate em ${g[0].valor}: ${g.map((e) => cb.nomeEntrada(c, e)).join(' e ')}. Quem tiver o maior bônus de Iniciativa vai antes; se empatar de novo, rolem entre si (LR p. 83).`,
          ),
        );
    } else if (c.fase === 'encerrado') itens.push(item('bandeira', 'neutro', `Combate encerrado na rodada ${c.rodada}. Feche para limpar a ordem.`));
    else {
      const v = this.daVez();
      const daVez = new Set(v?.ativos.map((p) => p.id) ?? []);
      // o que aconteceu sozinho no começo deste turno (até a primeira ação) e o que a última ação pediu
      let ini = c.registro.length - 1;
      while (ini >= 0 && c.registro[ini].tipo !== 'turno') ini--;
      const doTurno: string[] = [];
      const depois: string[] = [];
      let agiu = false;
      for (const l of ini >= 0 ? c.registro.slice(ini + 1) : []) {
        if (l.tipo === 'acao') {
          agiu = true;
          depois.length = 0;
        } else if (l.tipo === 'estado' && !/sustenta|está em chamas|está sangrando|entra na condição|sai da condição/.test(l.texto)) (agiu ? depois : doTurno).push(l.texto);
      }
      if (v) {
        const dono = v.e.mestre ? 'do mestre' : `de ${v.ativos[0]?.nome ?? '?'}`;
        const t = h('span', null, h('b', null, `Começo do turno ${dono}: `), doTurno.length ? doTurno.join(' ') : 'nada pendente.');
        itens.push(item(doTurno.length ? 'alerta' : 'ok', doTurno.length ? 'aviso' : 'bom', t));
      } else itens.push(item('alerta', 'aviso', 'Ninguém pode agir: ponha alguém no combate ou encerre.'));
      for (const d of depois) itens.push(item('alerta', 'ruim', h('span', null, h('b', null, 'Da última ação: '), d)));
      for (const p of c.participantes) {
        const cond = vitalConditions(this.vitais(p.id));
        const cs = this.condicoesDe(c, p);
        const agora = daVez.has(p.id);
        if (p.fora) {
          itens.push(item('caveira', 'ruim', quem(p.nome, `${NOME_FORA[p.fora].toLowerCase()}.`)));
          continue;
        }
        if (p.lado === 'agente' && cond.morrendo) itens.push(item('caveira', 'ruim', quem(p.nome, `morrendo ${p.morrendo}/3 — primeiros socorros, Medicina DT 20 (+5 a cada vez na cena).`)));
        else if (cond.morrendo) itens.push(item('caveira', 'ruim', quem(p.nome, '0 PV — tire do combate ou deixe caído (DC-16).'), botao('Tirar', null, () => this.dialogoSair(p.id), 'cb-mini')));
        if (p.lado === 'agente' && cond.enlouquecendo) itens.push(item('espiral', 'ruim', quem(p.nome, `enlouquecendo ${p.enlouquecendo}/3 — acalmar, Diplomacia DT 20 (+5 a cada vez na cena).`)));
        if (p.sustenta)
          itens.push(
            item(
              'pentagrama',
              'ritual',
              quem(p.nome, `ritual sustentado (${p.sustenta}) — paga 1 PE no começo do turno.`),
              agora ? botao('Pagar 1 PE', null, () => this.acao({ tipo: 'gastarPe', quem: p.id, pe: 1, motivo: `sustentar ${p.sustenta}` }), 'cb-mini') : null,
              botao('Encerrar', null, () => this.acao({ tipo: 'sustentar', id: p.id, ritual: null }), 'cb-mini'),
            ),
          );
        if (cs.includes('caido') && !cond.morrendo)
          itens.push(
            item(
              'deitado',
              'neutro',
              quem(p.nome, 'caído — levantar gasta ação de movimento.'),
              agora ? botao('Levantar', null, () => this.levantar(p), 'cb-mini') : null,
            ),
          );
        if (cs.includes('em-chamas')) itens.push(item('chama', 'ruim', quem(p.nome, 'em chamas — 1d6 de fogo no começo do turno; apagar é ação padrão.')));
        if (cs.includes('sangrando')) itens.push(item('gota', 'ruim', quem(p.nome, 'sangrando — Vigor DT 20 no começo do turno; falhou, perde 1d6 PV.')));
        if (cb.surpreendido(c, p)) itens.push(item('alerta', 'aviso', quem(p.nome, 'surpreendido — desprevenido e sem turno na rodada 1.')));
        if (p.desde > c.rodada) itens.push(item('entrar', 'aviso', quem(p.nome, `entra no combate na rodada ${p.desde}.`)));
        if (p.reacao) itens.push(item('escudo', 'neutro', quem(p.nome, 'já usou a defesa especial desta rodada.')));
      }
      for (const x of c.preparadas) {
        const e = cb.entrada(c, x.entrada);
        if (!e) continue;
        const usar = c.vez !== x.entrada ? botao('Usar agora', null, () => this.acao({ tipo: 'usarPreparada', entrada: x.entrada }), 'cb-mini', 'O gatilho aconteceu: a ação preparada acontece agora') : null;
        itens.push(item('escudo', 'aviso', quem(cb.nomeEntrada(c, e), `ação preparada — ${x.texto}.`), usar));
      }
    }
    this.trocar(this.pendCorpo, h('div', { class: 'cb-pend-lista cb-rola' }, ...itens));
  }

  private levantar(p: Participante) {
    this.acao({ tipo: 'declarar', qual: 'movimento', texto: 'levanta-se', quem: p.id });
    this.acao({ tipo: 'condicao', id: p.id, condicao: 'caido', ativa: false });
  }

  // ---------------------------------------------------------------- tabuleiro (moldura)

  private renderTab() {
    const r = this.app.state.room;
    if (!this.mudou('tab', [r?.id, r?.name, r?.floor, r?.darkness, r?.lightMode, r?.fog])) return;
    const nome = r ? nomeCurto(r.name) : '—';
    this.tabCena.textContent = r?.floor ? `${nome} — ${r.floor}` : nome;
    // clima da cena → situação da regra (DC-12; névoa, LR p. 290)
    const cl = this.clima();
    const ilum = cl.escuridao === 'total' ? 'escuridão (camuflagem total)' : cl.escuridao === 'camuflagem' ? 'baixa (camuflagem)' : 'normal';
    const nev = cl.nevoa === 'espessa' ? 'espessa (camuflagem total)' : cl.nevoa === 'camuflagem' ? 'neblina (camuflagem)' : 'nenhuma';
    const chip = (icone: NomeIcone, rotulo: string, valor: string, alerta: boolean, dica: string) =>
      h('span', { class: 'cb-chip', title: dica }, icPintado(icone), h('span', null, `${rotulo}: `, h('b', { class: alerta ? 'alerta' : '' }, valor)));
    this.tabClima.replaceChildren(
      chip('sol', 'Iluminação', ilum, cl.escuridao !== 'normal', 'Vem da escuridão da cena (☀ Clima da cena)'),
      chip('vento', 'Névoa', nev, cl.nevoa !== 'nenhuma', 'Vem da névoa da cena (☀ Clima da cena)'),
      chip('montanha', 'Terreno difícil', '—', false, 'Marcar terreno difícil no tabuleiro chega com o movimento em casas (etapa B)'),
    );
  }

  // ---------------------------------------------------------------- resolução

  private renderRes() {
    if (!this.visivel) return;
    const c = this.combate;
    const v = this.daVez();
    const x = c && v?.ator && this.aba === 'atacar' ? this.ctxAtaque(c, v.ator) : null;
    const mx = c && v?.ator && this.aba === 'manobra' ? this.ctxManobra(c, v.ator) : null;
    const rx = c && v?.ator && this.aba === 'ritual' ? this.ctxRitual(c, v.ator) : null;
    const tab = x?.tab ?? (mx ? (() => { const a = this.manobra.alvoEscolhido(mx); return a ? mx.tabDe(a.p) : null; })() : null);
    const geo = tab ? [tab.metros === null ? null : Math.round(tab.metros * 10), tab.adjacente, tab.cobertura.tipo, tab.cobertura.nome, tab.elevado, tab.flanqueia, tab.emCorpoACorpo] : null;
    const areaSig = rx ? [this.area?.forma, this.area?.metros, this.area?.alvo, this.area?.fixa, rx.naArea?.map((a) => a.p.id), rx.alvo ? rx.metrosAte(rx.alvo.p) : null] : null;
    const dados = [c && { ...c, registro: 0 }, this.aba, this.atorId, this.alvoId, this.assinaturaPecas(), this.assinaturaFichas(), this.app.state.room?.id, this.ameacas, geo, this.clima(), areaSig];
    if (!this.mudou('res', dados)) return;
    if (!c) return this.trocar(this.resCorpo, this.semCombate());
    if (c.fase === 'montando') return this.trocar(this.resCorpo, this.montagem(c));
    if (c.fase === 'encerrado') return this.trocar(this.resCorpo, this.encerrado(c));
    if (!v?.ator)
      return this.trocar(
        this.resCorpo,
        h(
          'div',
          { class: 'cb-sem' },
          h('h4', null, 'Ninguém pode agir agora'),
          h('p', null, 'Todos no combate estão fora ou ainda não chegaram. Ponha alguém no combate ou encerre.'),
          h('div', { class: 'cb-sem-botoes' }, botao('Pôr no combate', 'entrar', () => this.dialogoEntrar(), 'claro'), botao('Encerrar combate', 'bandeira', () => void this.encerrar(), 'forte')),
        ),
      );
    const corpo = x ? this.ataque.montar(x) : mx ? this.manobra.montar(mx) : rx ? this.ritualRes.montar(rx) : this.conteudoAba(c, v.ator);
    const passo = x ? this.ataque.passo(x) : mx ? this.manobra.passo(mx) : rx ? this.ritualRes.passo(rx) : 0;
    const nomes = x ? PASSOS_ATAQUE : mx ? PASSOS_MANOBRA : rx ? PASSOS_RITUAL : this.passosDaAba();
    this.trocar(this.resCorpo, this.faixaAtor(c, v.e, v.ativos, v.ator), this.passos(nomes, passo, !!x || !!mx || !!rx), corpo);
  }

  private semCombate(): HTMLElement {
    const r = this.app.state.room;
    return h(
      'div',
      { class: 'cb-sem' },
      h('h4', null, 'Nenhum combate aberto'),
      h('p', null, `O combate abre em ${r ? nomeCurto(r.name) : 'esta cena'}, com as peças que estão nela. Na montagem dá para incluir peças de outros cômodos da campanha.`),
      h('p', null, 'Os dados são físicos: cada um rola na mesa e o mestre digita o resultado.'),
      h('div', { class: 'cb-sem-botoes' }, botao('Abrir combate nesta cena', 'espadas', () => this.acao({ tipo: 'abrir' }), 'forte')),
    );
  }

  private montagem(c: Combate): HTMLElement {
    const chars = [...(this.sessao?.characters ?? [])];
    const dentro = new Set(c.participantes.map((p) => p.id));
    chars.sort((a, b) => Number(dentro.has(b.id)) - Number(dentro.has(a.id)) || Number(b.sceneId === c.cena) - Number(a.sceneId === c.cena) || a.id - b.id);
    const linhas = chars.map((ch) => {
      const p = cb.participante(c, ch.id);
      const ini = this.calcDe(ch.id)?.pericias.iniciativa;
      const incluir = h('input', {
        type: 'checkbox',
        class: 'cb-check',
        checked: !!p,
        'aria-label': `Incluir ${ch.name}`,
        onchange: (ev: Event) => this.acao({ tipo: 'participante', id: ch.id, incluir: (ev.target as HTMLInputElement).checked }),
      });
      const ladoAtual = p?.lado ?? (this.fichaDe(ch.id) ? 'agente' : 'inimigo');
      const lado = h(
        'select',
        { class: 'cb-sel', disabled: !p, 'aria-label': `Lado de ${ch.name}`, onchange: (ev: Event) => this.acao({ tipo: 'participante', id: ch.id, lado: (ev.target as HTMLSelectElement).value as cb.Lado }) },
        ...cb.LADOS.map((l) => h('option', { value: l, selected: ladoAtual === l }, NOME_LADO[l])),
      );
      const surpreso = !!p && !p.ciente;
      const ciente = h(
        'button',
        {
          class: `cb-ciente${surpreso ? ' surpreso' : ''}`,
          type: 'button',
          disabled: !p,
          'aria-pressed': String(surpreso),
          title: 'Percebeu os inimigos? Quem não percebeu fica surpreendido: desprevenido e sem turno na rodada 1 (LR p. 83)',
          onclick: () => p && (sfx.click(), this.acao({ tipo: 'participante', id: ch.id, ciente: !p.ciente })),
        },
        surpreso ? 'Surpreendido' : 'Percebeu',
      );
      let campo: HTMLElement;
      if (p?.lado === 'agente') {
        const inp = h('input', {
          class: 'cb-inp',
          type: 'text',
          inputmode: 'numeric',
          maxlength: 4,
          value: p.iniciativa === null ? '' : String(p.iniciativa),
          placeholder: '—',
          'data-foco': `ini:${ch.id}`,
          'aria-label': `Iniciativa de ${ch.name}`,
        });
        const enviar = () => {
          const n = numero(inp.value);
          if (n === undefined) return toast('Iniciativa é um número.', 'error');
          if (n !== p.iniciativa) this.acao({ tipo: 'participante', id: ch.id, iniciativa: n });
        };
        inp.addEventListener('change', enviar);
        inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && inp.blur());
        campo = h('label', { class: 'cb-ini-campo' }, inp, h('small', null, ini ? `rola ${textoTeste(ini.dados, ini.bonus, ini.penalidadeDados)}` : 'sem ficha'));
      } else campo = h('span', { class: 'cb-ini-mestre' }, p ? (this.ameacaDe(ch.id) ? 'no grupo do mestre' : 'no grupo do mestre · sem ficha') : '');
      return h(
        'div',
        { class: `cb-mont-linha${p ? '' : ' fora'}` },
        incluir,
        h('span', { class: 'cb-foto' }, this.retrato(ch.id, 48)),
        h('span', { class: 'cb-mont-nome' }, h('b', null, ch.name), h('small', null, ch.sceneId === c.cena ? 'nesta cena' : `em ${this.nomeCena(ch.sceneId)}`)),
        lado,
        ciente,
        campo,
      );
    });
    const temMestre = c.participantes.some(cb.doMestre);
    const inpM = h('input', {
      class: 'cb-inp',
      type: 'text',
      inputmode: 'numeric',
      maxlength: 4,
      value: c.mestre.iniciativa === null ? '' : String(c.mestre.iniciativa),
      placeholder: '—',
      disabled: !temMestre,
      'data-foco': 'ini:mestre',
      'aria-label': 'Iniciativa do grupo do mestre',
    });
    inpM.addEventListener('change', () => {
      const n = numero(inpM.value);
      if (n === undefined) return toast('Iniciativa é um número.', 'error');
      if (n !== c.mestre.iniciativa) this.acao({ tipo: 'iniciativaMestre', valor: n });
    });
    inpM.addEventListener('keydown', (ev) => ev.key === 'Enter' && inpM.blur());
    const empates = cb.empates(c).map((g) =>
      h(
        'div',
        { class: 'cb-empate' },
        ic('alerta'),
        h('span', null, `Empate em ${g[0].valor}. Quem vai antes?`),
        ...g.map((e) => botao(cb.nomeEntrada(c, e), null, () => this.desempatar(c, g, e), 'cb-mini')),
      ),
    );
    return h(
      'div',
      { class: 'cb-mont' },
      h('div', { class: 'cb-mont-cab' }, h('span', null, ''), h('span', null, ''), h('span', null, 'Peça'), h('span', null, 'Lado'), h('span', null, 'Começo'), h('span', null, 'Iniciativa')),
      h('div', { class: 'cb-mont-lista cb-rola' }, ...linhas),
      h(
        'div',
        { class: 'cb-mont-pe' },
        h(
          'label',
          { class: 'cb-mont-mestre' },
          h('span', { class: 'cb-mont-rot' }, ic('dados'), h('b', null, 'Grupo do mestre')),
          h('small', null, temMestre ? 'Uma rolagem por todos os seres do mestre, com o menor bônus de Iniciativa entre eles (LR p. 83).' : 'Sem inimigos nem neutros no combate.'),
          inpM,
        ),
        ...empates,
        h('div', { class: 'cb-mont-botoes' }, botao('Cancelar', 'fechar', () => this.acao({ tipo: 'encerrar' }), 'claro'), botao('Começar combate', 'espadas', () => this.acao({ tipo: 'comecar' }), 'forte')),
      ),
    );
  }

  /** Quem ganhou o desempate fica na frente dos outros empatados. */
  private desempatar(c: Combate, grupo: Entrada[], vencedor: Entrada) {
    const topo = Math.max(...grupo.map((e) => e.desempate)) + 1;
    if (vencedor.mestre) this.acao({ tipo: 'iniciativaMestre', valor: c.mestre.iniciativa, desempate: topo });
    else this.acao({ tipo: 'participante', id: vencedor.participantes[0], desempate: topo });
  }

  private encerrado(c: Combate): HTMLElement {
    const fora = c.participantes.filter((p) => p.fora);
    const contadores = c.participantes.filter((p) => p.morrendo || p.enlouquecendo);
    return h(
      'div',
      { class: 'cb-sem' },
      h('h4', null, `Combate encerrado na rodada ${c.rodada}`),
      h('p', null, fora.length ? `Fora do combate: ${fora.map((p) => `${p.nome} (${NOME_FORA[p.fora!].toLowerCase()})`).join(', ')}.` : 'Ninguém saiu do combate.'),
      contadores.length ? h('p', null, `Contadores da cena: ${contadores.map((p) => `${p.nome}, morrendo ${p.morrendo}/3 e enlouquecendo ${p.enlouquecendo}/3`).join('; ')}.`) : '',
      h('p', null, 'O que dura até o fim da cena acaba agora. PV, PE e SAN ficam como estão.'),
      h('div', { class: 'cb-sem-botoes' }, botao('Fechar o combate', 'ok', () => this.acao({ tipo: 'fechar' }), 'forte')),
    );
  }

  /** Quem age: retrato, recursos, Defesa, deslocamento, limite de PE e o gasto, o que já usou e as abas. */
  private faixaAtor(c: Combate, e: Entrada, ativos: Participante[], ator: Participante): HTMLElement {
    const ch = this.personagem(ator.id);
    const calc = this.calcDe(ator.id);
    const f = this.fichaDe(ator.id);
    const am = this.ameacaDe(ator.id);
    const vit = this.vitais(ator.id);
    // como no celular: a sigla e o número grande em cima, a barra sozinha embaixo (sem texto dentro)
    const barra = (rot: string, cls: string, a?: number, m?: number) =>
      h(
        'span',
        { class: `cb-rec ${cls}` },
        h('span', { class: 'cb-rec-topo' }, h('b', null, rot), h('span', { class: 'cb-rec-n' }, h('strong', null, a !== undefined ? String(a) : '—'), m ? h('small', null, `/${m}`) : null)),
        h('span', { class: `cb-barra ${cls}`, style: `--p:${a !== undefined && m ? Math.max(0, Math.min(1, a / m)) : 0}` }, h('i')),
      );
    const ac = cb.acoesDe(c, ator.id);
    const chipAc = (qual: 'padrao' | 'movimento', rot: string) => {
      const usada = ac.completa || ac[qual];
      const texto = !usada ? 'livre' : ac.completa ? 'completa' : qual === 'padrao' ? 'usada' : 'usado';
      return h(
        'button',
        {
          class: `cb-acao-chip ${usada ? 'usado' : 'livre'}`,
          type: 'button',
          title: usada ? 'Marcar como livre' : 'Marcar como usada',
          onclick: () => (sfx.click(), this.acao({ tipo: 'orcamento', qual: ac.completa ? 'completa' : qual, usada: !usada, quem: ator.id })),
        },
        `${rot}: ${texto}`,
      );
    };
    const reacao = h(
      'button',
      {
        class: `cb-acao-chip ${ator.reacao ? 'usado' : 'livre'}`,
        type: 'button',
        title: 'Defesa especial (bloqueio, esquiva, contra-ataque): uma por rodada; volta no começo do próprio turno',
        onclick: () => (sfx.click(), this.acao({ tipo: 'reacao', id: ator.id, usada: !ator.reacao })),
      },
      `Reação: ${ator.reacao ? 'usada' : 'disponível'}`,
    );
    const classe = f?.ficha.classe ? ` · ${regras.catalogo.classe(f.ficha.classe).nome} · NEX ${f.ficha.nex}%` : ` · ${am?.tipo ?? NOME_LADO[ator.lado]}`;
    const longe = ch && ch.sceneId !== this.app.state.room?.id ? h('small', { class: 'cb-longe' }, `em ${this.nomeCena(ch.sceneId)}`) : null;
    const seletor =
      e.mestre && ativos.length > 1
        ? h(
            'div',
            { class: 'cb-quem', role: 'group', 'aria-label': 'Quem age no turno do mestre' },
            ...ativos.map((p) =>
              h(
                'button',
                {
                  class: `cb-quem-bt${p.id === ator.id ? ' on' : ''}`,
                  type: 'button',
                  'aria-pressed': String(p.id === ator.id),
                  onclick: () => {
                    sfx.click();
                    this.atorId = p.id;
                    this.porNaVez();
                    this.render();
                  },
                },
                p.nome,
              ),
            ),
          )
        : null;
    const gasto = ac.pe ?? 0;
    const limite = calc?.limitePe;
    return h(
      'div',
      { class: 'cb-ator' },
      h('span', { class: 'cb-foto grande' }, this.retrato(ator.id, 96)),
      h(
        'div',
        { class: 'cb-ator-dir' },
        h(
          'div',
          { class: 'cb-ator-linha' },
          h(
            'div',
            { class: 'cb-ator-meio' },
            h('div', { class: 'cb-ator-nome' }, h('b', null, ator.nome), h('span', null, classe), longe),
            h('div', { class: 'cb-recs' }, barra('PV', 'pv', vit?.pv, vit?.pvMax), barra('PE', 'pe', vit?.pe, vit?.peMax), barra('SAN', 'san', vit?.san, vit?.sanMax)),
            seletor,
          ),
          // Defesa e Deslocamento como os números da rodada do celular: o ícone pintado, o número e o nome
          h('span', { class: 'cb-caixa defesa' }, icPintado('escudo', 'defesa'), h('small', null, 'Defesa'), h('b', null, calc ? String(calc.defesa) : am ? String(am.defesa) : '—')),
          h('span', { class: 'cb-caixa desloc' }, icPintado('bota', 'deslocamento'), h('small', null, 'Desloc.'), h('b', null, calc ? `${String(calc.deslocamento).replace('.', ',')} m` : '—')),
          h(
            'div',
            { class: 'cb-ator-turno' },
            h('span', { class: `cb-limite${limite !== undefined && gasto > limite ? ' alerta' : ''}` }, `Limite de PE: ${limite ?? '—'} · gasto: ${gasto}`),
            h('div', { class: 'cb-acoes-chips' }, chipAc('padrao', 'Padrão'), chipAc('movimento', 'Movimento'), reacao),
          ),
        ),
        this.abas(),
      ),
    );
  }

  private abas(): HTMLElement {
    return h(
      'div',
      { class: 'cb-abas', role: 'tablist' },
      ...ABAS.map((a) =>
        h(
          'button',
          {
            class: `cb-aba${this.aba === a.id ? ' on' : ''}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(this.aba === a.id),
            onclick: () => {
              sfx.click();
              this.aba = a.id;
              this.renderRes();
              this.atualizarMarcas();
            },
          },
          // o ícone pintado do kit (arte/icones/combate-<aba>.png); sem ele, o de linha
          arteOu([`/arte/icones/combate-${a.id}.png`], ic(a.icone)),
          h('span', null, a.rotulo),
        ),
      ),
    );
  }

  private passosDaAba(): string[] {
    switch (this.aba) {
      case 'movimento':
        return ['Ação', 'Caminho no tabuleiro', 'Confirmar'];
      default:
        return ['Ação', 'Escolha', 'Confirmar'];
    }
  }

  /** A barra de passos: os feitos em vermelho, o atual com anel, os que faltam em cinza. */
  private passos(nomes: string[], atual: number, vivo: boolean): HTMLElement {
    return h(
      'ol',
      { class: `cb-passos${vivo ? ' vivo' : ''}`, style: `--feito:${nomes.length > 1 ? Math.min(1, atual / (nomes.length - 1)) : 0}` },
      ...nomes.map((p, i) => h('li', { class: i < atual ? 'feito' : i === atual ? 'atual' : '' }, h('span', null, String(i + 1)), h('small', null, p))),
    );
  }

  private conteudoAba(c: Combate, ator: Participante): HTMLElement {
    const alvo = this.alvoId !== null && this.alvoId !== ator.id ? cb.participante(c, this.alvoId) : undefined;
    const contra = alvo ? ` contra ${alvo.nome}` : '';
    const opcao = (icone: NomeIcone, nome: string, detalhe: string, qual: cb.TipoAcao, fn: () => void, pagina?: string) =>
      h(
        'button',
        { class: 'cb-opcao', type: 'button', title: `${nome} (${NOME_QUAL[qual]})${pagina ? ` · ${pagina}` : ''}`, onclick: () => (sfx.click(), fn()) },
        h('span', { class: 'cb-opcao-ic' }, icPintado(icone)),
        h('span', { class: 'cb-opcao-txt' }, h('b', null, nome), h('small', null, detalhe)),
        h('span', { class: `cb-custo ${qual}` }, NOME_QUAL[qual]),
      );
    const declarar = (qual: cb.TipoAcao, texto: string) => this.acao({ tipo: 'declarar', qual, texto, quem: ator.id });
    const calc = this.calcDe(ator.id);
    const ficha = this.fichaDe(ator.id)?.ficha ?? null;
    const gasto = cb.acoesDe(c, ator.id).pe ?? 0;
    let lista: HTMLElement[] = [];
    let nota = 'Declarar escreve no registro e gasta a ação do turno. O resultado dos dados que não tem conta aqui vai no lápis do registro.';
    switch (this.aba) {
      case 'habilidade':
        if (ficha && calc)
          for (const p of calc.poderes) {
            const custo = custoPoder(p, ficha);
            if (custo) lista.push(opcao('estrela', p.nome, `${custo} PE · NEX ${p.nex}%`, 'livre', () => this.usarHabilidade(ator, p.nome, custo, calc.limitePe, gasto, contra)));
          }
        nota = lista.length
          ? 'Usar gasta o PE e escreve no registro. A ação de cada habilidade é a que a descrição dela diz; sem nada escrito, é livre (LR p. 78).'
          : calc
            ? 'Sem habilidades de gastar PE na ficha.'
            : 'Habilidade de ameaça: anote no lápis do registro.';
        break;
      case 'item':
        for (const it of ficha?.inventario ?? []) {
          if (it.tipo !== 'equipamento' && it.tipo !== 'amaldicoado') continue;
          const d = it.tipo === 'equipamento' ? regras.catalogo.equipamento(it.id) : regras.catalogo.amaldicoado(it.id);
          const nome = it.apelido ?? d?.nome ?? it.id;
          lista.push(opcao('mochila', nome, it.qtd && it.qtd > 1 ? `${it.qtd} unidades` : 'na mochila', 'padrao', () => declarar('padrao', `usa ${nome}${contra}`)));
        }
        if (!lista.length) nota = ficha ? 'Nenhum item de usar na mochila.' : 'Item de ameaça: declare em Outras ou anote no registro.';
        break;
      default: {
        const aba = this.aba as 'movimento' | 'outras';
        const icone: NomeIcone = aba === 'movimento' ? 'bota' : 'reticencias';
        lista = ACOES[aba].map((o) => opcao(icone, o.nome, o.dica, o.qual, () => this.acaoDoLivro(c, ator, o, alvo), `LR p. ${o.pagina}`));
      }
    }
    return h(
      'div',
      { class: 'cb-aba-corpo' },
      h('div', { class: 'cb-opcoes cb-rola' }, ...lista),
      h(
        'div',
        { class: 'cb-res-pe' },
        h('p', { class: 'cb-nota' }, nota),
        h('span', { class: `cb-alvo-tag${alvo ? '' : ' vazio'}` }, ic('mira'), alvo ? `Alvo: ${alvo.nome}` : 'Sem alvo: clique numa peça'),
      ),
    );
  }

  /** Ações da lista do livro que mexem em algo além do registro. */
  private acaoDoLivro(c: Combate, ator: Participante, o: OpcaoAcao, alvo: Participante | undefined) {
    const contra = o.alvo && alvo ? ` contra ${alvo.nome}` : '';
    const declarar = () => this.acao({ tipo: 'declarar', qual: o.qual, texto: `${o.nome.toLowerCase()}${contra}`, quem: ator.id });
    if (o.id === 'levantar') return this.levantar(ator);
    if (o.id === 'chao') {
      declarar();
      return this.acao({ tipo: 'condicao', id: ator.id, condicao: 'caido', ativa: true });
    }
    if (o.id === 'apagar') {
      declarar();
      return this.acao({ tipo: 'condicao', id: ator.id, condicao: 'em-chamas', ativa: false });
    }
    if ((o.id === 'socorros' || o.id === 'acalmar') && alvo) {
      const v = this.vitais(alvo.id);
      const socorro = o.id === 'socorros';
      const precisa = socorro ? vitalConditions(v).morrendo : vitalConditions(v).enlouquecendo;
      if (!precisa) return toast(socorro ? `${alvo.nome} não está morrendo.` : `${alvo.nome} não está enlouquecendo.`);
      const j = janela(o.nome.toUpperCase(), socorro ? 'kitMedico' : 'coracao', () => {}, 50);
      j.corpo.append(
        h(
          'p',
          { class: 'fj-texto' },
          socorro
            ? `${ator.nome} faz primeiros socorros em ${alvo.nome}: Medicina DT 20, +5 a cada vez que ele já foi estabilizado nesta cena; sem kit de medicina, −5 (LR p. 46). Passando, fica com 1 PV.`
            : `${ator.nome} acalma ${alvo.nome}: Diplomacia (ou Religião) DT 20, +5 a cada vez que ele já foi acalmado nesta cena (LR p. 44). Passando, fica com 1 de SAN.`,
        ),
      );
      j.rodape.append(
        botaoJanela('Cancelar', 'fechar', '', () => j.fechar()),
        h('span', { class: 'fj-esp' }),
        botaoJanela('Falhou', 'fechar', '', () => {
          this.acao({ tipo: 'declarar', qual: 'padrao', texto: `${o.nome.toLowerCase()} em ${alvo.nome}: falhou`, quem: ator.id });
          j.fechar();
        }),
        botaoJanela('Passou', 'ok', 'forte', () => {
          this.acao({ tipo: 'declarar', qual: 'padrao', texto: `${o.nome.toLowerCase()} em ${alvo.nome}: passou`, quem: ator.id });
          this.acao({ tipo: 'vitais', id: alvo.id, ...(socorro ? { pv: 1 } : { san: 1 }), motivo: o.nome.toLowerCase() });
          j.fechar();
        }),
      );
      return;
    }
    void c;
    declarar();
  }

  private usarHabilidade(ator: Participante, nome: string, custo: number, limite: number, gasto: number, contra: string) {
    const passa = gasto + custo > limite;
    void confirmar(
      `USAR ${nome.toUpperCase()}?`,
      `Gasta ${custo} PE (limite ${limite} por turno, já gastos ${gasto}).${passa ? ' Passa do limite: só vale se for o custo mínimo de uma habilidade neste turno (LR p. 23).' : ''}`,
      'Usar',
    ).then((ok) => {
      if (!ok) return;
      this.acao({ tipo: 'gastarPe', quem: ator.id, pe: custo, motivo: nome });
      this.acao({ tipo: 'declarar', qual: 'livre', texto: `usa ${nome}${contra}`, quem: ator.id });
    });
  }

  // ---------------------------------------------------------------- alvo

  private renderAlvo() {
    const c = this.combate;
    const id = this.alvoId;
    const p = c && id !== null ? cb.participante(c, id) : undefined;
    if (!this.mudou('alvo', [id, p, c?.fase, c?.rodada, this.assinaturaPecas(), this.assinaturaFichas(), id !== null ? this.ameacas[String(id)] : null])) return;
    const ch = id !== null ? this.personagem(id) : null;
    if (!ch) {
      this.alvoExtra.replaceChildren();
      this.alvoCorpo.replaceChildren(h('p', { class: 'cb-vazio' }, 'Clique numa peça do tabuleiro ou num nome da ordem para ver o alvo.'));
      return;
    }
    const calc = this.calcDe(ch.id);
    const f = this.fichaDe(ch.id);
    const am = this.ameacaDe(ch.id);
    const vit = ch.vitals;
    const lado = p?.lado ?? (f ? 'agente' : 'inimigo');
    const tipo =
      lado === 'agente'
        ? `Agente${f?.ficha.classe ? ` · ${regras.catalogo.classe(f.ficha.classe).nome} · NEX ${f.ficha.nex}%` : ''}`
        : `${lado === 'inimigo' ? 'Ameaça' : 'Neutro'}${am ? ` · ${am.tipo}${am.tamanho ? ` ${cb.NOME_TAMANHO[am.tamanho]}` : ''}${am.vd !== undefined ? ` · VD ${am.vd}` : ''}${am.livro ? ` · LR p. ${cb.ameacaLivro(am.livro)?.pagina ?? ''}` : ''}` : ' · sem ficha'}`;
    // a página do livro já vai na linha do tipo; nas notas fica o resto
    const notasAm = am?.notas ? (am.livro ? am.notas.replace(/^LR p\. \d+( · )?/, '') : am.notas) : '';
    const editarPv = () => void this.editarPv(ch.id, ch.name, vit);
    const pv = vit
      ? h(
          'div',
          { class: 'cb-alvo-pv' },
          h('span', { class: 'cb-rec-topo' }, h('b', null, 'PV'), h('span', { class: 'cb-rec-n' }, h('strong', null, String(vit.pv)), h('small', null, `/${vit.pvMax}`))),
          h('button', { class: 'cb-barra pv', type: 'button', title: 'Mudar PV', style: `--p:${vit.pvMax ? Math.max(0, Math.min(1, vit.pv / vit.pvMax)) : 0}`, onclick: editarPv }, h('i')),
          h('span', { class: 'cb-machucado' }, h('i')),
          h('small', null, `machucado: abaixo de ${Math.ceil(vit.pvMax / 2)}`),
        )
      : h('div', { class: 'cb-alvo-pv' }, botao('Marcar PV', 'coracao', editarPv, 'cb-mini'));
    // o ícone pintado de cada número do alvo (Defesa, as reações, os testes de resistência)
    const pintadoDaCaixa = (rot: string) => (/^Defesa/.test(rot) ? 'defesa' : /^Bloqueio/.test(rot) ? 'protecao' : /^Esquiva/.test(rot) ? 'deslocamento' : 'resistencias');
    const caixa = (rot: string, val: string) => h('span', { class: 'cb-caixa' }, icPintado('escudo', pintadoDaCaixa(rot)), h('small', null, rot), h('b', null, val));
    const res = (per: 'fortitude' | 'reflexos' | 'vontade', rot: string) => {
      const pc = calc?.pericias[per];
      const x = pc ? { dados: pc.dados, bonus: pc.bonus, penalidade: pc.penalidadeDados } : am?.[per];
      return caixa(rot, x ? textoTeste(x.dados, x.bonus, 'penalidade' in x ? x.penalidade : 0) : '—');
    };
    // RD numa linha, como no livro: os tipos com o mesmo valor juntos ("balístico, impacto e perfuração 5 · Sangue 10")
    const rdFonte: Partial<Record<string, number>> = calc?.resistencias ?? am?.rd ?? {};
    const porValor = new Map<number, string[]>();
    for (const [t, n] of resistenciasParaMostrar(rdFonte)) porValor.set(n, [...(porValor.get(n) ?? []), t === 'todos' ? 'todo dano' : (NOME_DANO[t] ?? t).toLowerCase()]);
    const junta = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}` : xs[0]);
    const rdTexto = [...porValor].map(([n, ts]) => `${junta(ts)} ${n}`).join(' · ');
    const defesa = calc?.defesa ?? am?.defesa;
    const esquiva = calc?.reacoes.esquiva;
    const bloqueio = calc?.reacoes.bloqueio;
    const linhaDefesa = h(
      'div',
      { class: 'cb-alvo-linha um' },
      caixa('Defesa', defesa !== undefined ? String(defesa) : '—'),
      esquiva != null ? caixa(p?.reacao ? 'Esquiva (usada)' : 'Esquiva', String(esquiva)) : null,
      bloqueio != null ? caixa(p?.reacao ? 'Bloqueio (usado)' : 'Bloqueio', `RD ${bloqueio}`) : null,
    );
    // condições: as do combate saem no ×; as da ficha e as de PV/SAN só aparecem
    const doCombate = new Set(p?.condicoes ?? []);
    const todas = c && p ? this.condicoesDe(c, p) : [];
    const chips = todas
      .filter((k) => k !== 'machucado' || !vitalConditions(vit).morrendo)
      .map((k) =>
        h(
          'span',
          { class: `cb-cond${doCombate.has(k) ? ' tira' : ''}${AUTOMATICAS.includes(k) || k === 'inconsciente' ? ' auto' : ''}` },
          ic(ICONE_CONDICAO[k] ?? (k === 'morrendo' ? 'caveira' : k === 'enlouquecendo' || k === 'perturbado' ? 'espiral' : 'alerta')),
          h('span', null, k === 'morrendo' && p ? `Morrendo ${p.morrendo}/3` : k === 'enlouquecendo' && p ? `Enlouquecendo ${p.enlouquecendo}/3` : nomeCond(k)),
          doCombate.has(k)
            ? h('button', { class: 'cb-cond-x', type: 'button', title: `Tirar ${nomeCond(k)}`, 'aria-label': `Tirar ${nomeCond(k)}`, onclick: () => (sfx.click(), this.acao({ tipo: 'condicao', id: ch.id, condicao: k, ativa: false })) }, ic('fechar'))
            : null,
        ),
      );
    const podeMexer = !!c && !!p && c.fase === 'andamento' && !p.fora;
    const condicoes = h(
      'div',
      { class: 'cb-alvo-conds' },
      ...chips,
      podeMexer ? h('button', { class: 'cb-cond mais', type: 'button', onclick: () => (sfx.click(), this.escolherCondicao(p!)) }, ic('mais'), h('span', null, 'Condição')) : null,
      !chips.length && !podeMexer ? h('small', null, 'Sem condições.') : null,
    );
    const sustenta = p?.sustenta
      ? h('div', { class: 'cb-alvo-ritual' }, ic('pentagrama'), h('span', null, `Sustentando ${p.sustenta}`), podeMexer ? botao('Encerrar', null, () => this.acao({ tipo: 'sustentar', id: ch.id, ritual: null }), 'cb-mini') : null)
      : null;
    const noCombate = !!p && !p.fora;
    const icone = (nome: NomeIcone, dica: string, fn: () => void) => h('button', { class: 'cb-menu', type: 'button', title: dica, 'aria-label': dica, onclick: () => (sfx.click(), fn()) }, icPintado(nome));
    this.alvoExtra.replaceChildren(
      ...[
        lado !== 'agente' || !f ? icone('lapis', am ? 'Ficha da ameaça' : 'Criar a ficha da ameaça (Defesa, resistências, RD, ataques)', () => this.editarFichaAmeaca(ch.id, ch.name)) : null,
        c?.fase === 'andamento' ? (noCombate ? icone('sair', 'Tirar do combate', () => this.dialogoSair(ch.id)) : icone('entrar', 'Pôr no combate', () => this.dialogoEntrar(ch.id))) : null,
      ].filter((x): x is HTMLButtonElement => !!x),
    );
    const semFicha = lado !== 'agente' && !am ? h('p', { class: 'cb-alvo-nota aviso' }, icPintado('lapis'), h('span', null, 'Sem ficha: no lápis do cabeçalho, escolha uma ameaça do livro ou preencha à mão.')) : null;
    // dano não letal: fica à parte dos PV; desmaia quando passa deles, sem morrendo (LR p. 88)
    const naoLetal = p?.naoLetal
      ? h(
          'div',
          { class: 'cb-alvo-ritual nl', title: 'Dano não letal: soma com o letal para desmaiar, mas não deixa morrendo. A cura tira primeiro ele (LR p. 88).' },
          ic('punho'),
          h('span', null, `Dano não letal ${p.naoLetal}${vit && vit.pv - p.naoLetal <= 0 ? ' · desmaiado' : ''}`),
          podeMexer ? botao('Mudar', null, () => void this.editarNaoLetal(p), 'cb-mini') : null,
        )
      : null;
    this.alvoCorpo.replaceChildren(
      h(
        'div',
        { class: 'cb-alvo-topo' },
        h('span', { class: 'cb-foto alvo' }, this.retrato(ch.id, 132)),
        h('div', { class: 'cb-alvo-id' }, h('b', null, ch.name), h('small', null, c && !noCombate && c.fase !== 'montando' ? `${tipo} · fora do combate` : tipo), pv),
      ),
      naoLetal ?? '',
      linhaDefesa,
      h('div', { class: 'cb-alvo-linha tres' }, res('fortitude', 'Fortitude'), res('reflexos', 'Reflexos'), res('vontade', 'Vontade')),
      rdTexto ? h('small', { class: 'cb-alvo-nota rd' }, h('b', null, 'RD '), rdTexto) : '',
      // imunidades, vulnerabilidades e presença perturbadora numa linha só
      am && (am.imunidades.length || am.vulnerabilidades.length || am.presenca)
        ? h(
            'small',
            { class: 'cb-alvo-nota' },
            [
              am.imunidades.length ? `Imune a ${am.imunidades.map((t) => this.nomeImune(t)).join(', ')}` : '',
              am.vulnerabilidades.length ? `vulnerável a ${am.vulnerabilidades.map((t) => cb.NOME_TIPO_DANO[t]).join(', ')}` : '',
              am.presenca ? `presença: Vontade DT ${am.presenca.dt}, ${am.presenca.dano} mental (NEX ${am.presenca.nex}% imune)` : '',
            ]
              .filter(Boolean)
              .join(' · ') + '.',
          )
        : '',
      condicoes,
      sustenta ?? '',
      notasAm ? h('small', { class: 'cb-alvo-nota' }, notasAm) : '',
      semFicha ?? '',
    );
  }

  private escolherCondicao(p: Participante) {
    const c = this.combate;
    if (!c) return;
    const j = janela(`CONDIÇÃO · ${p.nome.toUpperCase()}`, 'alerta', () => {}, 64);
    const ativas = new Set(p.condicoes ?? []);
    const lista = h('div', { class: 'cb-conds-lista' });
    for (const x of regras.catalogo.CATALOGO.condicoes) {
      if (x.automatica) continue;
      const on = ativas.has(x.id);
      lista.append(
        h(
          'button',
          {
            class: `cb-cond-op${on ? ' on' : ''}`,
            type: 'button',
            title: x.resumo ?? '',
            onclick: () => {
              sfx.click();
              this.acao({ tipo: 'condicao', id: p.id, condicao: x.id, ativa: !on });
              j.fechar();
            },
          },
          ic(ICONE_CONDICAO[x.id] ?? 'alerta'),
          h('span', null, x.nome),
        ),
      );
    }
    j.corpo.append(lista, h('p', { class: 'fj-texto' }, 'Condições do combate duram a cena, salvo o que a causa disser (LR p. 311). Machucado, morrendo, perturbado e enlouquecendo saem sozinhas pelo PV e pela SAN.'));
    j.rodape.append(h('span', { class: 'fj-esp' }), botaoJanela('Fechar', 'fechar', '', () => j.fechar()));
  }

  private editarFichaAmeaca(id: number, nome: string) {
    editarAmeaca(nome, this.ameacaDe(id), this.vitais(id), (ficha, pv) => {
      this.app.net.send({ t: 'ameaca', tokenId: id, ficha });
      if (pv) this.mandarPv(id, pv.pv, pv.pvMax);
    });
  }

  /** "Imune a todo dano" quando a ficha diz `todos`. */
  private nomeImune(t: regras.TipoDano) {
    return t === 'todos' ? 'todo dano' : cb.NOME_TIPO_DANO[t];
  }

  private async editarPv(id: number, nome: string, vit: Vitals | undefined) {
    const t = await perguntarTexto(`PV · ${nome.toUpperCase()}`, 'PV atual / total (ex.: 42/42)', vit ? `${vit.pv}/${vit.pvMax}` : '', 9);
    if (t === null) return;
    const [a, b] = t.split('/').map((x) => numero(x));
    const max = b ?? vit?.pvMax ?? a;
    if (typeof a !== 'number' || typeof max !== 'number' || max < 1) return toast('Escreva como 42/42.', 'error');
    this.mandarPv(id, Math.min(a, max), max);
  }

  /** Dano não letal do ser: a cura tira primeiro ele (LR p. 88), e o mestre ajusta aqui. */
  private async editarNaoLetal(p: Participante) {
    const t = await perguntarTexto(`NÃO LETAL · ${p.nome.toUpperCase()}`, 'Dano não letal (a cura tira primeiro ele)', String(p.naoLetal ?? 0), 4);
    if (t === null) return;
    const n = numero(t);
    if (typeof n !== 'number' || n < 0) return toast('Escreva um número.', 'error');
    this.acao({ tipo: 'naoLetal', id: p.id, valor: n, motivo: 'cura ou ajuste' });
  }

  /** PV da peça direto no tabuleiro (fora do desfazer do combate, como na tela MAPA). */
  private mandarPv(id: number, pv: number, pvMax: number) {
    this.app.net.send({ t: 'vitals', tokenId: -id, key: 'pv', max: pvMax });
    this.app.net.send({ t: 'vitals', tokenId: -id, key: 'pv', value: pv });
  }

  // ---------------------------------------------------------------- registro

  private renderReg() {
    const c = this.combate;
    this.regDesfazer.disabled = !this.podeDesfazer;
    if (!this.mudou('reg', [c?.registro, this.filtro])) return;
    const linhas = (c?.registro ?? []).filter((l) => this.filtro === 'todos' || l.tipo === this.filtro || l.tipo === 'rodada');
    if (!linhas.length) {
      this.regCorpo.replaceChildren(h('p', { class: 'cb-vazio' }, c ? 'Nada ainda.' : 'O registro começa quando o combate abre.'));
      return;
    }
    const els = linhas
      .slice(-120)
      .map((l) =>
        l.tipo === 'rodada'
          ? h('div', { class: 'cb-reg-rodada' }, h('span', null, `— ${l.texto.replace(/\.$/, '')} —`))
          : h('div', { class: `cb-reg-linha t-${l.tipo}` }, h('time', null, `[${hora(l.em)}]`), h('span', null, ...comDestaque(l.texto, l.destaque))),
      );
    this.regCorpo.replaceChildren(...els);
    this.regCorpo.scrollTop = this.regCorpo.scrollHeight;
  }

  // ---------------------------------------------------------------- pedidos

  private menu() {
    const c = this.combate;
    const j = janela('COMBATE', 'espadas', () => {}, 46);
    const item = (rotulo: string, icone: NomeIcone, dica: string, fn: () => void, desligado = false) =>
      h('button', { class: 'cb-menu-item', type: 'button', disabled: desligado, onclick: () => (j.fechar(), fn()) }, ic(icone), h('span', null, h('b', null, rotulo), h('small', null, dica)));
    const andando = c?.fase === 'andamento';
    j.corpo.append(
      h(
        'div',
        { class: 'cb-menu-lista' },
        !c ? item('Abrir combate nesta cena', 'espadas', 'Monta a ordem com as peças da cena.', () => this.acao({ tipo: 'abrir' })) : '',
        item('Pôr alguém no combate', 'entrar', 'Quem chega depois entra na ordem e age a partir da rodada seguinte.', () => this.dialogoEntrar(), !andando),
        item('Tirar alguém do combate', 'sair', 'Morreu, enlouqueceu, fugiu ou se rendeu.', () => this.dialogoSair(), !andando),
        item('Encerrar o combate', 'bandeira', 'Fica o resumo até você fechar. Dá para desfazer.', () => void this.encerrar(), !andando),
        c?.fase === 'montando' ? item('Cancelar a montagem', 'fechar', 'Apaga o combate que ainda não começou.', () => this.acao({ tipo: 'encerrar' })) : '',
      ),
    );
    j.rodape.append(h('span', { class: 'fj-esp' }), botaoJanela('Fechar', 'fechar', '', () => j.fechar()));
  }

  /** Quem chega com o combate andando (LR p. 83). */
  private dialogoEntrar(id?: number) {
    const c = this.combate;
    if (!c || c.fase !== 'andamento') return;
    const fora = (this.sessao?.characters ?? []).filter((ch) => {
      const p = cb.participante(c, ch.id);
      return !p || p.fora;
    });
    if (!fora.length) return toast('Todas as peças da campanha já estão no combate.');
    let escolhido = fora.find((x) => x.id === id)?.id ?? fora[0].id;
    const j = janela('PÔR NO COMBATE', 'entrar', () => {}, 56);
    const lista = h('div', { class: 'cb-dlg-lista' });
    const lado = h('select', { class: 'fx-inp' }, ...cb.LADOS.map((l) => h('option', { value: l }, NOME_LADO[l])));
    const ini = h('input', { class: 'fx-inp', type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: '—' });
    const dica = h('small', { class: 'cb-dlg-dica' });
    const campoIni = h('label', { class: 'fj-campo' }, h('span', null, 'Iniciativa'), ini, dica);
    const atualizar = () => {
      const calc = this.calcDe(escolhido)?.pericias.iniciativa;
      const agente = lado.value === 'agente';
      const grupoTem = c.mestre.iniciativa !== null;
      campoIni.classList.toggle('hidden', !agente && grupoTem);
      dica.textContent = agente ? (calc ? `Rola ${textoTeste(calc.dados, calc.bonus, calc.penalidadeDados)}.` : 'Sem ficha: o mestre diz o número.') : grupoTem ? '' : 'O grupo do mestre ainda não tem Iniciativa: esta vira a do grupo.';
    };
    const desenhar = () => {
      lista.replaceChildren(
        ...fora.map((ch) =>
          h(
            'button',
            {
              class: `cb-dlg-peca${ch.id === escolhido ? ' on' : ''}`,
              type: 'button',
              'aria-pressed': String(ch.id === escolhido),
              onclick: () => {
                escolhido = ch.id;
                lado.value = this.fichaDe(ch.id) ? 'agente' : 'inimigo';
                desenhar();
              },
            },
            h('span', { class: 'cb-foto' }, this.retrato(ch.id, 48)),
            h('span', null, h('b', null, ch.name), h('small', null, ch.sceneId === c.cena ? 'na cena do combate' : `em ${this.nomeCena(ch.sceneId)}`)),
          ),
        ),
      );
      atualizar();
    };
    lado.value = this.fichaDe(escolhido) ? 'agente' : 'inimigo';
    lado.addEventListener('change', atualizar);
    desenhar();
    const ok = () => {
      const n = numero(ini.value);
      if (n === undefined) return toast('Iniciativa é um número.', 'error');
      this.acao({ tipo: 'entrar', id: escolhido, lado: lado.value as cb.Lado, iniciativa: n });
      j.fechar();
    };
    ini.addEventListener('keydown', (ev) => ev.key === 'Enter' && ok());
    j.corpo.append(
      lista,
      h('div', { class: 'cb-dlg-campos' }, h('label', { class: 'fj-campo' }, h('span', null, 'Lado'), lado), campoIni),
      h('p', { class: 'fj-texto' }, `Entra na ordem e age a partir da rodada ${c.rodada + 1}.`),
    );
    j.rodape.append(h('span', { class: 'fj-esp' }), botaoJanela('Cancelar', 'fechar', '', () => j.fechar()), botaoJanela('Pôr no combate', 'ok', 'forte', ok));
  }

  /** Quem sai do combate: morte, insanidade ou só fora (fugiu, se rendeu). */
  private dialogoSair(id?: number) {
    const c = this.combate;
    if (!c || c.fase !== 'andamento') return;
    const dentro = c.participantes.filter((p) => !p.fora);
    if (!dentro.length) return toast('Ninguém no combate.');
    let escolhido = dentro.find((p) => p.id === id)?.id ?? dentro[0].id;
    const j = janela('TIRAR DO COMBATE', 'sair', () => {}, 52);
    const lista = h('div', { class: 'cb-dlg-lista' });
    const desenhar = () =>
      lista.replaceChildren(
        ...dentro.map((p) =>
          h(
            'button',
            { class: `cb-dlg-peca${p.id === escolhido ? ' on' : ''}`, type: 'button', 'aria-pressed': String(p.id === escolhido), onclick: () => ((escolhido = p.id), desenhar()) },
            h('span', { class: 'cb-foto' }, this.retrato(p.id, 48)),
            h('span', null, h('b', null, p.nome), h('small', null, NOME_LADO[p.lado])),
          ),
        ),
      );
    desenhar();
    const sair = (motivo: cb.Saida) => {
      this.acao({ tipo: 'sair', id: escolhido, motivo });
      j.fechar();
    };
    j.corpo.append(lista, h('p', { class: 'fj-texto' }, 'Quem sai não volta à ordem, a não ser que você ponha de novo. Dá para desfazer.'));
    j.rodape.append(
      botaoJanela('Cancelar', 'fechar', '', () => j.fechar()),
      h('span', { class: 'fj-esp' }),
      botaoJanela('Saiu', 'sair', '', () => sair('saiu')),
      botaoJanela('Insanidade', 'espiral', 'perigo', () => sair('insano')),
      botaoJanela('Morte', 'caveira', 'perigo', () => sair('morto')),
    );
  }

  private async atrasar() {
    const c = this.combate;
    const e = c && cb.entrada(c, c.vez);
    if (!c || !e) return;
    const depois = cb.entradas(c).find((x) => x.id !== e.id && !c.agiram.includes(x.id) && cb.ativosDa(c, x).length > 0);
    if (!depois) return toast('Ninguém mais age nesta rodada: não há como atrasar.', 'error');
    const v = await perguntarTexto('ATRASAR', `Nova Iniciativa de ${cb.nomeEntrada(c, e)} (hoje ${e.valor}). Para agir logo depois de ${cb.nomeEntrada(c, depois)}: ${depois.valor}.`, String(depois.valor), 4);
    if (v === null) return;
    const n = numero(v);
    if (n === null) return;
    if (n === undefined) return toast('Iniciativa é um número.', 'error');
    this.acao({ tipo: 'atrasar', valor: n });
  }

  private async preparar() {
    const t = await perguntarTexto('PREPARAR', 'A ação e o gatilho (ex.: atira no primeiro que passar pela porta)', '', 180);
    if (t?.trim()) this.acao({ tipo: 'preparar', texto: t });
  }

  private async anotar() {
    if (!this.combate) return toast('O registro começa quando o combate abre.');
    const t = await perguntarTexto('ANOTAR', 'O que vai para o registro (ex.: Cora rolou 18 no ataque e acertou)', '', 300);
    if (t?.trim()) this.acao({ tipo: 'nota', texto: t });
  }

  private async encerrar() {
    if (await confirmar('ENCERRAR O COMBATE?', 'Fica o resumo até você fechar. Dá para desfazer.', 'Encerrar')) this.acao({ tipo: 'encerrar' });
  }
}

/** Lista que rola por dentro: some embaixo enquanto tem mais para ver (a SITUAÇÃO, as armas, a ordem). */
function avisarRolagem(el: HTMLElement) {
  const ver = () => el.classList.toggle('tem-mais', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  if (!el.dataset.avisa) {
    el.dataset.avisa = '1';
    el.addEventListener('scroll', ver, { passive: true });
  }
  requestAnimationFrame(ver);
}
