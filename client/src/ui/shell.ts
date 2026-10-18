import {
  anyFurniName,
  distinctFacings,
  bar,
  getFurni,
  getWallFurni,
  LOOT_KINDS,
  lootKindLabel,
  lootParaItem,
  MAX_TOKEN_NAME,
  giroQueCabe,
  nextRotation,
  parseHeightmap,
  turnFacing,
  type Heightmap,
  conditionLabels,
  DEFAULT_VITALS,
  VITAL_KEYS,
  VITAL_LABEL,
  VITAL_NAME,
  vitalConditions,
  type AvatarLook,
  type VitalKey,
  type Vitals,
  type CampaignState,
  type Documento,
  type FichaSalva,
  type FloorItem,
  type FloorStyle,
  type Loot,
  type LootKind,
  regras,
  type Objective,
  type PartyMember,
  type RoomInfo,
  type SceneInfo,
  type WallItem,
} from '@crona/shared';
import { abrirDocumentos, documentosMudaram } from './documentos';
import { breathMode, livePortrait, portraitCanvas } from '../render/portrait';
import { sprites } from '../render/sprites';
import { thumbCopy } from '../render/thumbs';
import { RoomView } from '../room/RoomView';
import type { App } from './app';
import { clear, h, icon, toast, Win } from './dom';
import { HintEditor, HintViewer } from './infostand';
import { characterPicker, lookEditor } from './lookEditor';
import { logIcon, lootIcon } from './lootIcons';
import { arteDoItem } from './arteItem';
import { brushSweep, brushWash, bump, countUp, drawStroke, eraseDraw, enter, floatText, flyArc, fxLayer, leave, pencilDraw, reduced, shake, stamp, tilt, typeInto, wait, wipeIn } from './motion';
import { askNote, promptNote } from './note';
import { abrirMapaMundi } from './mapaMundi';
import { TelaDeViagem } from './telaDeViagem';
import { abrirViagem, ViagemPainel } from './viagem';
import { brushize, paperize, textures, unpaint } from './paperArt';
import { sfx } from './sfx';
import { CombateScreen } from './combate';
import { FichasScreen } from './fichas';
import { iconePixel } from './iconesPixel';
import { AbaItens } from './itens';
import { infoItem, romano, textoRef } from './fichaRegras';
import { doCatalogoPeloNome, listaDoCatalogo } from './catalogoItens';
import { TecladoSenha } from './teclado';
import { FerramentasMesa } from './ferramentasMesa';
import { Minimapa, type MinimapaHost } from './minimapa';
import { AbaInterludio } from './interludio';
import { TopBar } from './topbar';
import { botao, escolher, janela } from './fichaModal';
import { arteOu, existeArte, ic, type NomeIcone } from './icons';

export interface ShellActions {
  fx(): void;
  catalog(): void;
  /** abre o catálogo para trocar o móvel por outro, no mesmo lugar */
  trocar(id: number, defId: string): void;
  inventory(): void;
  settings(): void;
  characters(): void;
  navigator(): void;
  help(): void;
  logout(): void;
}

type InspTab = 'desc' | 'inter' | 'items';
type Sel = { kind: 'floor' | 'wall'; item: FloorItem | WallItem } | null;

const THUMB_KEY = 'crona.thumb.';
/** Os botões das AÇÕES com o ícone pintado do kit (arte/icones/<nome>.png). */
const PINTADO_ACAO: Record<string, string> = { lupa: 'busca', caixa: 'cadeado', mao: 'combate-item', trocar: 'carga' };
const COLORS = ['#e3a94c', '#d83a2e', '#3f6fd8', '#f2efe6', '#6fdc8c', '#c78bff', '#3fe0c0', '#ff6fb0'];
const INSP_TABS: InspTab[] = ['desc', 'inter', 'items'];

/** Abas do painel da direita (controle do RPG). */
type RpgTab = 'PLAYERS' | 'INTERLÚDIO' | 'ITENS';
const RPG_TABS: RpgTab[] = ['PLAYERS', 'ITENS', 'INTERLÚDIO'];
const ABA_ARTE: Record<RpgTab, string[]> = {
  PLAYERS: ['/arte/icones/painel-players.png', '/arte/icones/titulo-identificacao.png'],
  ITENS: ['/arte/icones/painel-itens.png', '/arte/icones/titulo-inventario.png'],
  INTERLÚDIO: ['/arte/icones/painel-interludio.png', '/arte/icones/il-dormir.png'],
};
const ABA_LINHA: Record<RpgTab, NomeIcone> = { PLAYERS: 'pessoa', ITENS: 'mochila', INTERLÚDIO: 'lua' };

function loadThumb(id: number): string | null {
  try {
    return localStorage.getItem(THUMB_KEY + id);
  } catch {
    return null;
  }
}
function saveThumb(id: number, url: string) {
  try {
    localStorage.setItem(THUMB_KEY + id, url);
  } catch {
    /* sem storage */
  }
}

function svg(html: string): SVGSVGElement {
  const s = document.createElement('span');
  s.innerHTML = html.trim();
  return s.firstElementChild as SVGSVGElement;
}

/** Clipe de papel metálico. */
function paperclip(cls: string): SVGSVGElement {
  return svg(`<svg class="${cls}" viewBox="0 0 22 50" aria-hidden="true" fill="none" stroke-linecap="round">
    <defs><linearGradient id="clipg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d9398"/><stop offset=".35" stop-color="#f4f6f7"/><stop offset=".6" stop-color="#a9afb4"/><stop offset="1" stop-color="#e2e5e7"/></linearGradient></defs>
    <path d="M6 33 V10 A5 5 0 0 1 16 10 V40 A3.6 3.6 0 0 1 8.8 40 V14 A2.1 2.1 0 0 1 13 14 V35" stroke="#2d3033" stroke-width="3.6"/>
    <path d="M6 33 V10 A5 5 0 0 1 16 10 V40 A3.6 3.6 0 0 1 8.8 40 V14 A2.1 2.1 0 0 1 13 14 V35" stroke="url(#clipg)" stroke-width="2.2"/>
  </svg>`);
}

/** Traço de tinta sob títulos (grosso à esquerda, afina à direita). */
function uline(cls = 'uline'): SVGSVGElement {
  return svg(`<svg class="${cls}" viewBox="0 0 140 10" preserveAspectRatio="none" aria-hidden="true"><path d="M1 5.2 C 20 3.4 60 3.6 100 3.6 C 118 3.5 132 3.1 139 3.2 L 138.6 5 C 110 5.8 60 6.9 22 7.7 C 12 7.9 4 7.9 1.4 7.3 Z" fill="currentColor"/></svg>`);
}

/** Contorno vermelho feito à mão (aba ativa do inspetor). */
function tabRing(): SVGSVGElement {
  return svg(`<svg class="tab-ring" viewBox="0 0 112 34" preserveAspectRatio="none" aria-hidden="true">
    <path class="ring-line" d="M3.2 33 L2.6 7.4 Q2.4 2.6 7.2 2.3 L103.6 1.4 Q109.4 1.2 109.8 6.4 L110.6 33" fill="none" stroke="#c9352b" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path class="ring-under" d="M9 30.6 C 40 29.4 80 30.2 104 30.6 L 103.4 33 C 80 33.5 40 33.8 8.6 33.4 Z" fill="#c9352b"/>
  </svg>`);
}

/** Check a lápis, um pouco diferente em cada objetivo. */
function checkMark(seed: number): SVGSVGElement {
  const r = (i: number) => {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  };
  const n = (base: number, i: number, amp: number) => (base + r(i) * amp).toFixed(2);
  const d = `M${n(3.1, 1, 0.8)} ${n(10.6, 2, 0.8)} C ${n(4.8, 3, 0.6)} ${n(12.2, 4, 0.6)} ${n(6.3, 5, 0.5)} ${n(13.8, 6, 0.5)} ${n(7.8, 7, 0.5)} ${n(15.9, 8, 0.5)} C ${n(10.2, 9, 1)} ${n(10.5, 10, 1)} ${n(13.8, 11, 1)} ${n(5.6, 12, 1)} ${n(18.8, 13, 0.8)} ${n(1.4, 14, 0.8)}`;
  return svg(`<svg viewBox="0 0 20 20" aria-hidden="true"><path class="chk-p" d="${d}"/></svg>`);
}

function arrow(): SVGSVGElement {
  return svg(`<svg class="arr" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.2 5h11.6M9.2 1.6L12.8 5l-3.6 3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
}

function warnIcon(): SVGSVGElement {
  return svg(`<svg class="warn" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 1.6 L23.2 20.6 H0.8 Z" fill="#d33a30" stroke="#d33a30" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 7.6v6.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.45" fill="#fff"/></svg>`);
}

/** Rabiscos a lápis dos papéis soltos. */
function scribble(): SVGSVGElement {
  return svg(`<svg class="scrib" viewBox="0 0 60 80" aria-hidden="true" fill="none" stroke="#4a3d31" stroke-width="1" stroke-linecap="round" opacity=".55">
    <path d="M8 16 c6 -4 10 4 16 0 s8 -3 12 1"/><path d="M8 28 c5 -2 9 2 14 -1"/><path d="M26 30 l6 -8 l4 9"/>
    <path d="M10 44 c4 6 12 6 16 0 c3 -5 9 -3 11 2"/><path d="M12 58 h22 v10 h-22 z"/><path d="M16 62 h14"/>
  </svg>`);
}

/** Janela para criar/editar uma peça. */
class TokenWin {
  readonly win: Win;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.win = new Win('Personagem', { width: 460, y: 60 });
  }

  open(edit?: { id: number; name: string; look: AvatarLook; color: string; capacity: number }) {
    let look: AvatarLook = edit
      ? { ...edit.look }
      : { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };
    let color = edit?.color ?? COLORS[(this.app.view.users.size + 1) % COLORS.length];
    const name = h('input', { class: 'input', maxlength: MAX_TOKEN_NAME, placeholder: 'Nome do personagem', value: edit?.name ?? '' });
    const cap = h('input', { class: 'input small', type: 'number', min: '1', max: '99', value: String(edit?.capacity ?? 10) });
    const colors = h('div', { class: 'swatches' });
    for (const c of COLORS) {
      const b = h('button', {
        type: 'button',
        class: `swatch${c === color ? ' on' : ''}`,
        style: `background:${c}`,
        'aria-label': `Cor ${c}`,
        onclick: () => {
          color = c;
          colors.querySelectorAll('.swatch').forEach((e) => e.classList.remove('on'));
          b.classList.add('on');
        },
      });
      colors.append(b);
    }
    const body = h('div', { class: 'token-look' });
    const renderBody = () => {
      clear(body);
      body.append(
        h('label', { class: 'field-label' }, 'Sprite'),
        characterPicker(this.app.state.characters, look.charId, (id) => {
          look = { ...look, charId: id };
          renderBody();
        }),
      );
      if (!look.charId) body.append(h('label', { class: 'field-label' }, 'Avatar pixel'), lookEditor(look, (l) => (look = { ...l, charId: null })));
    };
    renderBody();
    clear(this.win.body).append(
      h(
        'form',
        {
          class: 'form',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const n = name.value.trim();
            if (!n) return toast('Dê um nome ao personagem.', 'error');
            const capacity = Math.max(1, Math.min(99, Number(cap.value) || 10));
            if (edit) this.app.net.send({ t: 'tokenEdit', tokenId: edit.id, name: n, look, color, capacity });
            else this.app.net.send({ t: 'tokenAdd', name: n, look, color, capacity });
            this.win.close();
          },
        },
        h('label', { class: 'field-label' }, 'Nome'),
        name,
        h('div', { class: 'row' }, h('label', { class: 'field-label' }, 'Carga máx.'), cap),
        h('label', { class: 'field-label' }, 'Cor'),
        colors,
        body,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, edit ? 'Salvar' : 'Colocar no tabuleiro')),
      ),
    );
    this.win.setTitle(edit ? `Editar ${edit.name}` : 'Novo personagem');
    this.win.open();
    name.focus();
  }
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const level = (ratio: number) => (ratio >= 1 ? 'red' : ratio >= 0.75 ? 'yellow' : 'green');

interface Card {
  el: HTMLButtonElement;
  img: HTMLElement;
  name: HTMLElement;
  away: HTMLElement;
  look: string;
  color: string;
  /** barrinhas de PV/PE/SAN */
  vitals: HTMLElement;
  vitalsKey: string;
}
interface ObjRow {
  id: number;
  el: HTMLElement;
  path: SVGPathElement;
  text: HTMLElement;
  done: boolean;
  busy: boolean;
}
interface Slot {
  el: HTMLButtonElement;
  key: string;
}

/** Tela MAPA, fiel ao layout de referência, com as interações animadas. */
/** Bloco de PV, PE e SAN que se acerta no lugar (sem ser refeito). */
type VitaisVivos = HTMLElement & { atualizar?: (p: PartyMember) => void };


export class Shell {
  readonly el: HTMLElement;
  readonly board: HTMLElement;
  /** os botões da câmera do tabuleiro (isométrica ou tática) */
  private vistaEl: HTMLElement;
  /** a plaquinha do cômodo e a faixa do estado (luz, névoa, partículas) do tabuleiro */
  private placaEl!: HTMLElement;
  private estadoEl!: HTMLElement;
  /** Apontar, Desenhar e Névoa: o que o mestre mostra na mesa */
  readonly ferramentas: FerramentasMesa;
  /** a aba INTERLÚDIO (LR p. 92–93) */
  private abaInterludio: AbaInterludio;
  private app: App;
  private campaign: CampaignState | null = null;
  private viagemPainel!: ViagemPainel;
  /** a coluna da esquerda (na viagem a planta some e o painel da viagem ocupa o lugar dela) */
  private mapColEl!: HTMLElement;
  private tokenWin: TokenWin;
  private hintEditor: HintEditor;
  private hintViewer: HintViewer;
  private mapLayer: HTMLElement;
  private mapCanvas: HTMLCanvasElement | null = null;
  private shownAt = 0;
  private sigs: Record<string, string> = {};
  // topo
  private topo: TopBar;
  /** aba FICHAS (as fichas dos agentes) */
  readonly fichas: FichasScreen;
  /** aba COMBATE (ordem de iniciativa, turnos e registro) */
  readonly combate: CombateScreen;
  private registro: HTMLElement;
  private registroLog!: HTMLElement;
  // esquerda: cartão da sala e o do objeto selecionado
  private salaEl!: HTMLElement;
  private salaCorpo!: HTMLElement;
  private salaSig = '';
  private inspCab!: HTMLElement;
  // baixo: ações sobre o objeto escolhido
  private acoesEl!: HTMLElement;
  private acaoAtiva = 'examinar';
  private fxBtn: HTMLButtonElement;
  /** último giro pedido de cada peça (para cliques seguidos) */
  private turnGoal = new Map<number, { dir: number; at: number }>();
  private menu: HTMLElement;
  private soundItem: HTMLElement;
  private activeTab = 'MAPA';
  // esquerda
  private scenesEl: HTMLElement;
  private sceneRows = new Map<number, HTMLElement>();
  private activeScene: number | null = null;
  private peeked = new Set<number>();
  /** o minimapa: Terreno › Prédio › Andar › Cômodo (minimapa.ts) */
  private minimapa: Minimapa;
  /** o teclado de senha grande, no meio do tabuleiro (a geladeira do bar) */
  private teclado: TecladoSenha;
  /** painel da direita: controle do RPG */
  private rpgTab: RpgTab = 'PLAYERS';
  /** aba ITENS: a mochila de cada agente, pela ficha */
  private abaItens: AbaItens;
  private fichasMapa: FichaSalva[] = [];
  private docs: Documento[] = [];
  private rpgTabsEl!: HTMLElement;
  private rpgBody!: HTMLElement;
  /** a aba da direita da última vez que o painel foi refeito (a rolagem só volta na mesma aba) */
  private rpgRolagemDe = '';
  private rpgSig = '';
  /** os números (PV, PE, SAN) da última passada: só eles mudando se acertam no lugar, sem refazer as cartas */
  private rpgVit = '';
  private rpgTabsDe: RpgTab | null = null;
  private fichasMapaSig = '';
  private objEl: HTMLElement;
  private objPlus: HTMLElement;
  private objRows = new Map<number, ObjRow>();
  private addingObj = false;
  // centro
  private placeBar: HTMLElement;
  private tabOverlay: HTMLElement;
  private hoverTimer = 0;
  private lastRoom: number | null = null;
  // direita
  private inspEl: HTMLElement;
  private inspBody: HTMLElement;
  private closeTag: HTMLElement;
  private giveWrap: HTMLElement;
  private giveBody: HTMLElement;
  private giveOpen = false;
  private giveKey = '';
  private inspTab: InspTab = 'desc';
  /** o painel do objeto em três momentos: jogar (o agente usa), configurar (texto, itens, testes) e mexer (lugar) */
  private objModo: 'jogar' | 'config' | 'mexer' = 'jogar';
  private inspKey = '';
  private inspSig = '';
  private photoUrl: string | null = null;
  private giveLoot: { itemId: number; lootId: number } | null = null;
  private delivering = false;
  private addingLoot = false;
  private logging: number | null = null;
  private holders = new Map<number, string | undefined>();
  // baixo
  private partyEl: HTMLElement;
  private cards = new Map<number, Card>();
  private addCard: HTMLElement | null = null;
  private quickEl: HTMLElement;
  private slots: Slot[] = [];
  private logEl: HTMLElement;
  private logRows = new Map<string, HTMLElement>();
  private logReady = false;

  /** as ações da tela (o catálogo, o inventário...) */
  private acts: ShellActions;

  /** o que os menus abrem (as janelas de construir, configurar, ajuda) */
  private actions: ShellActions;

  constructor(app: App, act: ShellActions) {
    this.actions = act;
    this.acts = act;
    this.app = app;
    this.tokenWin = new TokenWin(app);
    this.hintEditor = new HintEditor(app);
    this.hintViewer = new HintViewer(app);
    const tex = textures();
    const rs = document.documentElement.style;
    rs.setProperty('--tex-paper', `url(${tex.paper})`);
    rs.setProperty('--tex-dark', `url(${tex.dark})`);
    rs.setProperty('--tex-wood', `url(${tex.wood})`);

    // ================= topo =================
    this.topo = new TopBar({
      abas: [
        { id: 'MAPA', rotulo: 'MAPA', icone: 'mapa' },
        { id: 'COMBATE', rotulo: 'COMBATE', icone: 'espadas' },
        { id: 'FICHAS', rotulo: 'FICHAS', icone: 'ficha' },
      ],
      ativa: 'MAPA',
      aoTrocar: (id) => this.setTab(id),
      aoClicarMarca: () => void this.renameCampaign(),
      botoes: [
        // no celular, só a engrenagem e o sair, como na referência
        { id: 'mundo', icone: 'globo', titulo: 'Mapa-múndi', soDesktop: true, onclick: () => (sfx.click(), abrirMapaMundi(app, { aoViajar: (l) => abrirViagem(app, this.campaign?.party ?? [], l) })) },
        { id: 'clima', icone: 'sol', titulo: 'Clima da cena', soDesktop: true, onclick: () => (sfx.click(), act.fx()) },
        { id: 'config', icone: 'engrenagem', titulo: 'Configurações', cheio: true, onclick: (e) => (e.stopPropagation(), this.toggleMenu()) },
        { id: 'registro', icone: 'documento', titulo: 'Registro da sessão', soDesktop: true, onclick: (e) => (e.stopPropagation(), this.toggleRegistro()) },
        {
          id: 'sair',
          icone: 'sair',
          titulo: 'Encerrar sessão',
          sair: true,
          onclick: async () => (await askNote('ENCERRAR SESSÃO?', 'Volta para a tela de entrada. Tudo fica salvo para a próxima sessão.', 'Encerrar', true)) && act.logout(),
        },
      ],
    });
    this.fxBtn = this.topo.botoes.get('clima')!;
    this.soundItem = h('button', { role: 'menuitemcheckbox', onclick: () => this.toggleSound() });
    this.menu = h(
      'div',
      { class: 'tb2-menu hidden', role: 'menu' },
      ...(
        [
          ['user', 'Novo personagem', () => this.tokenWin.open()],
          ['catalog', 'Construir (catálogo)', act.catalog],
          ['gear', 'Configurar cena', act.settings],
          ['box', 'Mobis guardados', act.inventory],
          ['user', 'Sprites dos personagens', act.characters],
          ['nav', 'Todas as cenas', act.navigator],
          ['help', 'Como usar', act.help],
        ] as [string, string, () => void][]
      ).map(([ic, label, fn]) => h('button', { role: 'menuitem', onclick: () => (this.menu.classList.add('hidden'), fn()) }, icon(ic, 16), label)),
      this.soundItem,
    );
    this.renderSoundItem();
    this.registro = h('div', { class: 'tb2-menu tb2-registro hidden', role: 'dialog', 'aria-label': 'Registro da sessão' });
    this.topo.botoes.get('config')!.parentElement!.append(this.menu, this.registro);
    this.menu.addEventListener('click', (e) => e.stopPropagation());
    this.registro.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => (this.menu.classList.add('hidden'), this.registro.classList.add('hidden')));
    const top = this.topo.el;
    this.fichas = new FichasScreen(app, { jogador: false });
    this.abaItens = new AbaItens(app, (o) => this.hintViewer.abrirItem(o));
    this.fichas.hide();
    this.combate = new CombateScreen(app);

    // ================= esquerda =================
    this.scenesEl = h('div', { class: 'scene-list' });
    const scenes = h('section', { class: 'sheet p-scenes' }, h('h3', { class: 'p-title' }, 'CENÁRIO ATUAL'), this.scenesEl);
    paperize(scenes, { seed: 11, tone: '#ceb69b', burn: 1, curl: 'br', curlSize: 32, backs: [{ dx: -6, dy: -3, rot: -1.1, dw: 2, dh: 4 }, { dx: 5, dy: 5, rot: 0.9 }] });
    this.minimapa = new Minimapa(this.hostMinimapa());
    // M abre e fecha a planta grande; Esc fecha (fora de um campo de texto)
    document.addEventListener('keydown', (e) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape' && this.plantaGrande && !document.querySelector('.mm-janela-fundo')) return this.fecharPlantaGrande();
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && !document.documentElement.classList.contains('modo-ficha')) this.abrirPlantaGrande();
    });
    const mm = this.minimapa;
    // o minimapa no painel do HUD (azul-noite, borda bege, ouro), com o botão da planta grande (M)
    const ampliar = h('button', { class: 'plan-ampliar', type: 'button', title: 'Abrir a planta grande (M)', 'aria-label': 'Abrir a planta grande', onclick: () => this.abrirPlantaGrande() }, ic('lupaMais'));
    const plan = h('section', { class: 'sheet p-plan wide mm' }, h('h3', { class: 'p-title mm-titulo' }, mm.trilha), ampliar, mm.botoes, mm.canvas, mm.cartao);
    // a lista de cenários saiu: a planta interativa é a navegação (a lista fica pronta, fora da tela)
    void scenes;
    const scrapA = h('span', { class: 'scrap scrap-a', 'aria-hidden': 'true' });
    paperize(scrapA, { kit: false, seed: 41, tone: '#c1ae97', burn: 0.8, shadow: 0.9, torn: 2.4 });
    const note = h('span', { class: 'scrap scrap-note', 'aria-hidden': 'true' }, scribble());
    paperize(note, { kit: false, seed: 42, tone: '#c4af96', burn: 0.8, torn: 2.2 });
    const noteTape = h('span', { class: 'tape tape-note', 'aria-hidden': 'true' });

    // ================= objetivos =================
    this.objEl = h('div', { class: 'obj-list' });
    this.objPlus = h('button', { class: 'obj-plus hidden', title: 'Novo objetivo', 'aria-label': 'Novo objetivo', onclick: () => ((this.addingObj = true), this.renderObjectives()) }, '+');
    const objs = h('section', { class: 'sheet p-obj' }, h('h3', { class: 'p-title' }, 'OBJETIVOS'), this.objPlus, this.objEl);
    paperize(objs, { seed: 13, tone: '#d6c4a4', burn: 0.8, pad: 16 });
    this.registroLog = h('div', { class: 'tb2-reg-lista' });
    this.registro.append(objs, h('h4', null, 'REGISTRO DA SESSÃO'), this.registroLog);

    // ================= centro =================
    this.placeBar = h('div', { class: 'place-bar hidden' });
    this.tabOverlay = h('div', { class: 'tab-overlay hidden' });
    const zoom = h(
      'div',
      { class: 'board-zoom' },
      h('button', { class: 'bz', title: 'Afastar', 'aria-label': 'Afastar', onclick: () => app.view.zoomStep(-1) }, icon('minus', 16)),
      h('button', { class: 'bz', title: 'Enquadrar', 'aria-label': 'Enquadrar', onclick: () => app.view.fit() }, icon('target', 16)),
      h('button', { class: 'bz', title: 'Aproximar', 'aria-label': 'Aproximar', onclick: () => app.view.zoomStep(1) }, icon('plus', 16)),
    );
    const moldura = h('div', { class: 'board-moldura', 'aria-hidden': 'true' }, h('i', { class: 'bm-risco r1' }), h('i', { class: 'bm-risco r2' }));
    const centro = h(
      'button',
      { class: 'board-centro', title: 'Enquadrar a sala', 'aria-label': 'Enquadrar a sala', onclick: () => (sfx.click(), app.view.fit()) },
      svg('<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 3 37 20 20 37 3 20Z"/><circle cx="20" cy="20" r="6.5"/><path d="M20 10v4M20 26v4M10 20h4M26 20h4"/></svg>'),
    );
    this.teclado = new TecladoSenha(app);
    // a câmera do tabuleiro: isométrica ou tática (a sala de cima, como mapa de batalha); a mesa acompanha
    this.vistaEl = h(
      'div',
      { class: 'board-vista', role: 'group', 'aria-label': 'Câmera do tabuleiro' },
      h('button', { class: 'bv', type: 'button', 'data-tatico': 'nao', title: 'Vista isométrica (T)', onclick: () => this.trocarVista(false) }, ic('isometrico'), h('span', null, 'ISO')),
      h('button', { class: 'bv', type: 'button', 'data-tatico': 'sim', title: 'Vista tática: a sala de cima, como mapa de batalha (T)', onclick: () => this.trocarVista(true) }, arteOu(['/arte/icones/tabuleiro-tatico.png'], ic('tatico')), h('span', null, 'TÁTICA')),
      // o tabuleiro na altura toda: a fileira de baixo (agentes, inventário, ações) some até clicar de novo
      h(
        'button',
        { class: 'bv bv-foco', type: 'button', title: 'Tabuleiro na altura toda (esconde a fileira de baixo)', 'aria-pressed': 'false', onclick: (e: MouseEvent) => this.alternarFoco(e.currentTarget as HTMLElement) },
        svg('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'),
        h('span', null, 'AMPLIAR'),
      ),
      // esconder a tela da mesa atrás do carregamento do C.R.I.S (18/10)
      h(
        'button',
        {
          class: 'bv bv-esconde',
          type: 'button',
          title: 'Esconder a tela da mesa (mostra o carregamento do C.R.I.S)',
          'aria-pressed': 'false',
          onclick: (e: MouseEvent) => {
            const bt = e.currentTarget as HTMLElement;
            const on = bt.getAttribute('aria-pressed') !== 'true';
            bt.setAttribute('aria-pressed', String(on));
            bt.classList.toggle('on', on);
            bt.querySelector('span')!.textContent = on ? 'MOSTRAR' : 'ESCONDER';
            sfx.click();
            app.net.send({ t: 'telaEscondida', on });
          },
        },
        svg('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.2 6.3C4.2 7.7 2.7 9.7 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.7-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'),
        h('span', null, 'ESCONDER'),
      ),
    );
    try {
      if (localStorage.getItem('crona.foco') === '1') queueMicrotask(() => this.alternarFoco(this.vistaEl.querySelector('.bv-foco')!, true));
    } catch {
      /* sem armazenamento: começa com a fileira */
    }
    this.ferramentas = new FerramentasMesa(app);
    this.ferramentas.aoViagem = () => abrirViagem(app, this.campaign?.party ?? []);
    this.viagemPainel = new ViagemPainel(app);
    this.abaInterludio = new AbaInterludio(app);
    this.combate.aoFerramentaMesa = (tipo) => this.ferramentas.alternar(tipo, false);
    this.ferramentas.aoMudar = (tipo) => this.combate.marcarFerramentaMesa(tipo);
    // a disposição de 06/10 (docs/ref-mapa-3.webp): as ferramentas numa fileira no canto de cima à direita,
    // a plaquinha do cômodo à esquerda e, embaixo, a faixa do estado da cena
    // (a faixa do estado embaixo saiu a pedido do Felipe; ISO e TÁTICA voltaram para o canto de baixo)
    this.placaEl = h('div', { class: 'board-placa' });
    this.estadoEl = h('div', { class: 'board-estado hidden' });
    const ferr = h('div', { class: 'board-ferr' }, this.ferramentas.el, centro);
    this.board = h('main', { class: 'board' }, moldura, this.placeBar, zoom, this.placaEl, ferr, this.vistaEl, this.tabOverlay, this.teclado.el, new TelaDeViagem(app).el);

    // ================= direita =================
    const backboard = h('div', { class: 'backboard', 'aria-hidden': 'true' });
    this.closeTag = h('button', { class: 'insp-x hidden', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => (sfx.click(), app.view.select(null)) }, paperclip('x-clip'), ic('fechar'));
    this.inspBody = h('div', { class: 'insp-body' });
    this.inspCab = h('h3', { class: 'insp-cab' }, 'NESTA CENA');
    this.inspEl = h('section', { class: 'sheet p-insp' }, this.closeTag, this.inspCab, this.inspBody);
    paperize(this.inspEl, { seed: 14, tone: '#d8c7a7', burn: 1, torn: 1.2, stains: 1, pad: 18 });
    // cartão da sala: a foto, o nome, a descrição e o andar
    this.salaCorpo = h('div', { class: 'sala-corpo' });
    this.salaEl = h('section', { class: 'sheet p-sala' }, this.salaCorpo);
    paperize(this.salaEl, { seed: 19, tone: '#dccbad', burn: 0.95, torn: 1.3, stains: 1, pad: 18 });
    this.giveBody = h('div', { class: 'give-body' });
    this.giveWrap = h('section', { class: 'sheet p-give hidden' }, this.giveBody);
    paperize(this.giveWrap, { seed: 15, tone: '#d2bba6', burn: 0.9 });
    const giveScrap = h('span', { class: 'scrap scrap-give', 'aria-hidden': 'true' }, scribble());
    paperize(giveScrap, { kit: false, seed: 43, tone: '#c6b199', burn: 0.8, torn: 2.2, backs: [{ dx: -4, dy: 10, rot: -3, dh: -20 }] });
    // esquerda: tudo do mapa (planta, cômodo e objeto, entrega)
    const mapCol = h('aside', { class: 'col-map' }, plan, paperclip('clip clip-sala'), this.salaEl, this.viagemPainel.el, this.inspEl, this.giveWrap);
    this.mapColEl = mapCol;

    // ================= direita: controle do RPG =================
    this.rpgTabsEl = h('div', { class: 'rpg-tabs', role: 'tablist' });
    this.rpgBody = h('div', { class: 'rpg-body' });
    const rpg = h('section', { class: 'sheet p-rpg' }, h('span', { class: 'tape tape-rpg', 'aria-hidden': 'true' }), this.rpgTabsEl, this.rpgBody);
    paperize(rpg, { seed: 18, tone: '#d0baa4', burn: 0.9, backs: [{ dx: 4, dy: 4, rot: 0.8, dw: -4 }] });
    const rpgCol = h('aside', { class: 'col-rpg' }, rpg);

    // ================= baixo =================
    this.partyEl = h('div', { class: 'party' });
    this.quickEl = h('div', { class: 'quick-slots' });
    for (let i = 0; i < 6; i++) {
      const el = h('button', { class: 'qslot empty', disabled: true, style: `--i:${i}`, onclick: () => this.pickSlot(i) });
      this.slots.push({ el, key: '' });
      this.quickEl.append(el);
    }
    const quick = h(
      'section',
      { class: 'sheet p-quick' },
      h('span', { class: 'tape tape-q1', 'aria-hidden': 'true' }),
      h('span', { class: 'tape tape-q2', 'aria-hidden': 'true' }),
      h('h3', { class: 'p-title' }, h('i', { class: 'losango', 'aria-hidden': 'true' }), 'INVENTÁRIO RÁPIDO', h('small', null, '(CENÁRIO)')),
      this.quickEl,
    );
    paperize(quick, { seed: 16, tone: '#c9b49b', burn: 1, backs: [{ dx: 4, dy: 5, rot: 0.7, dw: -8 }] });
    this.logEl = h('div', { class: 'log-lines' });
    const log = h('section', { class: 'sheet p-log' }, h('span', { class: 'tape tape-log', 'aria-hidden': 'true' }), h('h3', { class: 'p-title' }, 'ÚLTIMAS AÇÕES'), this.logEl);
    paperize(log, { seed: 17, tone: '#cab59c', burn: 1, tab: { w: 163, h: 11 }, backs: [{ dx: -5, dy: 6, rot: -0.8, dw: 4 }] });
    this.acoesEl = h('div', { class: 'acoes' });
    const acoes = h('section', { class: 'sheet p-acoes' }, h('h3', { class: 'p-title' }, h('i', { class: 'losango', 'aria-hidden': 'true' }), 'AÇÕES'), this.acoesEl);
    paperize(acoes, { seed: 22, tone: '#cdb99c', burn: 1, backs: [{ dx: -4, dy: 5, rot: -0.8, dw: -6 }] });
    const pilha = h('div', { class: 'pilha-mapa', 'aria-hidden': 'true' }, h('span', { class: 'pm-a' }), h('span', { class: 'pm-b' }), h('span', { class: 'pm-c' }));
    for (const [i, x] of [...pilha.children].entries()) paperize(x as HTMLElement, { kit: false, seed: 150 + i, tone: i === 1 ? '#cdbb99' : '#c4b08e', burn: 1.2, torn: 2, stains: 1.4, pad: 12 });
    void log;
    // os agentes num papel com título, como o inventário e as ações
    const agentes = h('section', { class: 'sheet p-agentes' }, h('h3', { class: 'p-title' }, h('i', { class: 'losango', 'aria-hidden': 'true' }), 'AGENTES'), this.partyEl);
    paperize(agentes, { seed: 23, tone: '#cbb69a', burn: 1, backs: [{ dx: 3, dy: 4, rot: 0.6 }] });
    const bottom = h('footer', { class: 'bottom' }, agentes, quick, acoes, pilha);

    this.mapLayer = h('div', { class: 'map-layer' }, h('div', { class: 'map-fx', 'aria-hidden': 'true' }));
    void note;
    void noteTape;
    void giveScrap;
    void scrapA;
    void backboard;
    const ui = h('div', { class: 'ui' }, top, this.board, mapCol, rpgCol, bottom, this.combate.el, this.fichas.el);
    // textura de grafite para os traços a lápis
    const defs = svg(`<svg class="svg-defs" aria-hidden="true"><defs><filter id="pencil-tex" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.9" result="d"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.45" result="a"/>
      <feComposite in="d" in2="a" operator="in"/></filter></defs></svg>`);
    this.el = h('div', { class: 'shell hidden' }, defs, this.mapLayer, ui);

    app.on('room', () => this.onRoom());
    app.on('rooms', () => this.renderScenes());
    app.on('selection', () => {
      this.giveLoot = null;
      this.addingLoot = false;
      this.logging = null;
      this.renderInspector();
      this.renderParty();
      this.renderAcoes();
    });
    app.on('items', () => (this.renderInspector(), this.renderQuick(), this.renderAcoes()));
    // o bestiário chegou depois de a peça ser escolhida (recarregou a página): o painel da criatura (aparência, passo pelas sombras) se refaz
    app.on('bestiario', () => {
      const sel = this.app.view.selection;
      const cid = sel?.kind === 'user' ? this.app.view.users.get(sel.id)?.criatura?.id : undefined;
      if (cid && this.app.state.bestiario.some((c) => c.id === cid)) this.renderInspector(true);
    });
    app.on('characters', () => ((this.sigs.party = ''), this.renderParty()));
    setInterval(() => this.captureThumb(), 4000);
    setInterval(() => this.markWalking(), 180);
    window.addEventListener('resize', () => (this.minimapa.desenhar(), this.plantaGrande?.mm.desenhar()));
  }

  // ================= montagem =================
  /** Coloca o canvas do tabuleiro atrás da interface e informa a área visível. */
  mountCanvas(canvas: HTMLCanvasElement) {
    this.mapCanvas = canvas;
    this.app.view.fundoPontos = true;
    this.mapLayer.prepend(canvas);
    const upd = () => this.updateFrame();
    const ro = new ResizeObserver(upd);
    ro.observe(this.board);
    ro.observe(this.combate.quadro);
    window.addEventListener('resize', upd);
    canvas.addEventListener('pointermove', () => {
      this.el.classList.add('map-hover');
      clearTimeout(this.hoverTimer);
      this.hoverTimer = window.setTimeout(() => this.el.classList.remove('map-hover'), 2200);
    });
  }

  /** Janela do tabuleiro: o quadro da tela MAPA ou, na aba COMBATE, o da tela de combate. */
  private updateFrame() {
    const el = this.activeTab === 'COMBATE' ? this.combate.quadro : this.board;
    const r = el.getBoundingClientRect();
    this.app.view.setFrame(r.width > 4 && r.height > 4 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
  }

  show() {
    this.el.classList.remove('hidden');
    this.shownAt = performance.now();
    requestAnimationFrame(() => this.el.classList.add('ready'));
    this.renderAll();
  }

  /** Atraso de entrada: escalonado na abertura da tela, imediato depois. */
  private intro(ms: number) {
    return performance.now() - this.shownAt < 1500 ? ms : 0;
  }

  setPlacement(text: string | null) {
    this.placeBar.classList.toggle('hidden', !text);
    this.placeBar.textContent = text ?? '';
  }

  setCampaign(s: CampaignState) {
    this.campaign = s;
    this.fichas.setCampanha(s);
    this.renderSala();
    this.renderRpg();
    this.renderTop();
    this.renderScenes();
    this.atualizarMinimapa();
    this.renderObjectives();
    this.renderParty();
    this.renderLog();
    this.renderInspector();
  }

  partyIds(): number[] {
    return (this.campaign?.party ?? []).map((p) => p.id ?? 0).filter(Boolean);
  }

  /** Troca a câmera do tabuleiro (só o mestre): a mesa acompanha. */
  trocarVista(tatico = !this.app.view.tatico) {
    if (!this.app.state.room?.isOwner || this.app.view.tatico === tatico) return;
    sfx.click();
    this.app.net.send({ t: 'roomFx', tatico });
  }

  /** Os botões da câmera mostram a vista de agora. */
  /** A plaquinha do cômodo e a faixa do estado da cena (a luz, a névoa do ar e as partículas); clicar abre o ☀. */
  private renderEstado() {
    const r = this.app.state.room;
    if (!this.placaEl || !r) return;
    const nome = r.name.split('·').pop()?.trim() ?? r.name;
    this.placaEl.textContent = `${nome}${r.floor ? ` — ${r.floor}` : ''}`;
    const luz = r.lightMode === 'blackout' ? 'apagão' : r.lightMode === 'flicker' ? 'piscando' : r.darkness >= 0.6 ? 'baixa' : r.darkness >= 0.3 ? 'média' : 'alta';
    const nevoa = (r.fog ?? 0) < 0.05 ? 'nenhuma' : (r.fog ?? 0) < 0.4 ? 'leve' : 'densa';
    const part = r.particles?.length ? `${r.particles.length === 1 ? ({ dust: 'poeira', smoke: 'fumaça', embers: 'brasas' } as Record<string, string>)[r.particles[0]] ?? r.particles[0] : `${r.particles.length} tipos`}` : 'nenhuma';
    const cel = (icone: string, rot: string, val: string) =>
      h('button', { class: 'be-cel', type: 'button', title: 'Clima da cena', disabled: !r.isOwner, onclick: () => (sfx.click(), this.actions.fx()) }, ic(icone), h('span', null, `${rot}: `), h('b', null, val));
    void cel;
    void luz;
    void nevoa;
    void part;
  }

  private marcarVista() {
    this.renderEstado();
    const tat = this.app.view.tatico;
    for (const b of this.vistaEl.querySelectorAll<HTMLElement>('.bv')) b.classList.toggle('on', (b.dataset.tatico === 'sim') === tat);
    this.vistaEl.classList.toggle('hidden', !this.app.state.room?.isOwner);
    this.combate.marcarVista(tat);
  }

  private onRoom() {
    this.marcarVista();
    this.ferramentas.atualizar();
    this.viagemPainel.atualizar();
    this.mapColEl.classList.toggle('em-viagem', !!this.app.state.room?.viagem && !!this.app.state.room?.isOwner);
    const id = this.app.state.room?.id ?? null;
    if (id !== this.lastRoom && this.lastRoom !== null) this.sceneFade();
    this.lastRoom = id;
    this.renderAll();
    setTimeout(() => this.captureThumb(), 1200);
  }

  private renderAll() {
    this.sigs = {};
    this.salaSig = '';
    this.renderTop();
    this.renderSala();
    this.renderAcoes();
    this.renderScenes();
    this.atualizarMinimapa();
    this.renderObjectives();
    this.renderInspector(true);
    this.renderParty();
    this.renderRpg(true);
    this.renderQuick();
    this.renderLog();
  }

  /** Só redesenha uma parte quando os dados dela mudaram. */
  private changed(part: string, data: unknown) {
    const s = JSON.stringify(data);
    if (this.sigs[part] === s) return false;
    this.sigs[part] = s;
    return true;
  }

  private get gm() {
    return !!this.app.state.room?.canBuild;
  }
  private get owner() {
    return !!this.app.state.room?.isOwner;
  }

  /** Troca de cena no tabuleiro: o quadro antigo dissolve por cima do novo. */
  private sceneFade() {
    const src = this.mapCanvas;
    if (!src || reduced() || !src.width) return;
    const c = document.createElement('canvas');
    c.className = 'scene-fade';
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    src.after(c);
    c.animate(
      [
        { opacity: 1, filter: 'blur(0px) brightness(1)', transform: 'scale(1)' },
        { opacity: 0, filter: 'blur(6px) brightness(0.4)', transform: 'scale(1.05)' },
      ],
      { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' },
    ).onfinish = () => c.remove();
    src.animate([{ opacity: 0, filter: 'brightness(0.3)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 750, easing: 'ease-out' });
  }

  // ================= topo =================
  private renderTop() {
    this.fxBtn.style.visibility = this.owner ? 'visible' : 'hidden';
    // o nome vem com a campanha (evita piscar o nome da sala antes)
    if (!this.campaign) return;
    const r = this.app.state.room;
    // marca: organização e sede; à direita, a campanha e o andar da cena aberta
    this.topo.setMarca(this.campaign.subtitle || 'Ordo Realitas', this.campaign.title || r?.name || 'CRONA');
    const cena = this.campaign.scenes.find((x) => x.id === r?.id);
    this.topo.setLocal(this.campaign.title || null, cena?.floor ? `Andar ${cena.floor}` : (r?.name.split('·').pop()?.trim() ?? ''));
    this.topo.setOperacao(this.campaign.operacao ? `Operação ${this.campaign.operacao}` : null);
  }

  /** Configurações (a engrenagem do topo): uma janela de papel com as opções em cartões. */
  private toggleMenu() {
    sfx.paper();
    const act = this.actions;
    const j = janela('Configurações', 'engrenagem', () => {}, 96);
    j.el.classList.add('tela-toda');
    const opcoes: [NomeIcone, string, string, () => void][] = [
      ['pessoa', 'Novo personagem', 'Uma peça nova no tabuleiro (agente, NPC ou ameaça).', () => this.tokenWin.open()],
      ['caixa', 'Construir', 'O catálogo de móveis: pôr na cena, girar e mover.', act.catalog],
      ['engrenagem', 'Configurar cena', 'Nome, descrição, andar, piso, cor do ambiente e partículas.', act.settings],
      ['mochila', 'Mobis guardados', 'Os móveis tirados da cena, para pôr de novo.', act.inventory],
      ['ficha', 'Sprites dos personagens', 'As folhas de cada personagem e as poses.', act.characters],
      ['mapa', 'Todas as cenas', 'Abrir qualquer cena, de qualquer campanha.', act.navigator],
      ['documento', 'Documentos', 'Relatórios, fotos e pistas para entregar aos agentes (aba Docs do celular).', () => this.abrirDocs()],
      ['livro', 'Como usar', 'Os atalhos e as ferramentas do mestre.', act.help],
    ];
    const cartao = (icone: NomeIcone, nome: string, texto: string, fazer: () => void) =>
      h('button', { class: 'cfg-carta', type: 'button', onclick: () => (sfx.click(), j.fechar(), fazer()) }, ic(icone), h('b', null, nome), h('span', null, texto));
    const som = h(
      'button',
      { class: `cfg-carta cfg-som${sfx.enabled ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(sfx.enabled), onclick: () => (this.toggleSound(), som.classList.toggle('on', sfx.enabled), som.setAttribute('aria-checked', String(sfx.enabled)), (som.querySelector('span')!.textContent = sfx.enabled ? 'Ligados: clique para desligar.' : 'Desligados: clique para ligar.')) },
      ic('radio'),
      h('b', null, 'Sons da interface'),
      h('span', null, sfx.enabled ? 'Ligados: clique para desligar.' : 'Desligados: clique para ligar.'),
    );
    // a tela do falso C.R.I.S (a brincadeira de 18/10): o estado vem do servidor (mostrarFalsoCris)
    const cris = h(
      'button',
      { class: 'cfg-carta cfg-som', type: 'button', role: 'switch', onclick: () => (sfx.click(), this.app.net.send({ t: 'falsoCris', ligado: !cris.classList.contains('on') })) },
      ic('fantasma'),
      h('b', null, 'Tela do C.R.I.S'),
      h('span', null, '…'),
    );
    this.cartaoCris = cris;
    this.app.net.send({ t: 'falsoCris' });
    j.corpo.append(h('div', { class: 'cfg-grade' }, ...opcoes.map(([i, n, t, f]) => cartao(i, n, t, f)), som, cris));
    j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'fechar', '', () => j.fechar()));
  }

  /** o cartão da tela do C.R.I.S nas Configurações, enquanto a janela estiver aberta */
  private cartaoCris: HTMLElement | null = null;

  /** O servidor disse como está a tela do falso C.R.I.S (quem entra de fora vê o C.R.I.S, que quebra e vira o CRONA). */
  mostrarFalsoCris(ligado: boolean) {
    const c = this.cartaoCris;
    if (!c?.isConnected) return;
    c.classList.toggle('on', ligado);
    c.setAttribute('aria-checked', String(ligado));
    c.querySelector('span')!.textContent = ligado
      ? 'Ligada: quem entra pelo link vê o C.R.I.S, que dá pau e vira o CRONA. Clique para desligar.'
      : 'Desligada: todo mundo vê a entrada do CRONA. Clique para ligar.';
  }

  /** Registro da sessão (objetivos e as últimas ações), no botão de documento do topo: uma janela de papel. */
  private toggleRegistro() {
    sfx.paper();
    const j = janela('Registro da sessão', 'documento', () => this.registro.remove(), 80);
    j.el.classList.add('tela-toda');
    const log = [...(this.campaign?.log ?? [])].reverse().slice(0, 60);
    this.registroLog.replaceChildren(
      ...(log.length
        ? log.map((e) => h('div', { class: 'tb2-reg' }, h('time', null, new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), logIcon(e.icon, 15), h('span', null, e.text)))
        : [h('p', null, 'Nada ainda nesta sessão.')]),
    );
    this.registro.classList.remove('hidden', 'tb2-menu');
    this.registro.classList.add('reg-janela');
    j.corpo.append(this.registro);
    j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'fechar', '', () => j.fechar()));
  }

  private toggleSound() {
    sfx.setEnabled(!sfx.enabled);
    this.renderSoundItem();
  }

  private renderSoundItem() {
    clear(this.soundItem).append(icon('music', 16), sfx.enabled ? 'Sons da interface: ligados' : 'Sons da interface: desligados');
    this.soundItem.setAttribute('aria-checked', String(sfx.enabled));
  }

  private paintTabs() {
    this.topo.setAtiva(this.activeTab);
  }

  private setTab(t: string) {
    if (t === this.activeTab) return;
    this.activeTab = t;
    sfx.paper();
    this.paintTabs();
    this.el.classList.toggle('aba-fichas', t === 'FICHAS');
    this.el.classList.toggle('aba-combate', t === 'COMBATE');
    if (t === 'FICHAS') this.fichas.show();
    else this.fichas.hide();
    if (t === 'COMBATE') this.combate.show();
    else this.combate.hide();
    this.updateFrame();
    const o = this.tabOverlay;
    if (t === 'MAPA' || t === 'FICHAS' || t === 'COMBATE') {
      if (!o.classList.contains('hidden')) {
        o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () => {
          o.classList.add('hidden');
          o.getAnimations().forEach((a) => a.cancel());
        };
      }
      return;
    }
    const note = h('section', { class: 'sheet p-soon' }, h('h3', { class: 'p-title' }, t, uline()), h('p', null, 'Esta aba chega nas próximas etapas.'), h('button', { class: 'dbtn', onclick: () => this.setTab('MAPA') }, 'Voltar ao mapa'));
    paperize(note, { kit: false, seed: 20 + t.length, tone: '#d0bba5', burn: 0.8 });
    clear(o).append(note);
    o.classList.remove('hidden');
    enter(note, 'drop', 0, 520);
  }

  private async renameCampaign() {
    if (!this.owner || !this.campaign) return;
    const v = await promptNote('CAMPANHA', [
      { label: 'Nome', value: this.campaign.title, max: 40 },
      { label: 'Subtítulo', value: this.campaign.subtitle, max: 40 },
      { label: 'Operação em andamento', value: this.campaign.operacao ?? '', max: 40 },
    ]);
    if (v) this.app.net.send({ t: 'campaignSet', title: v[0], subtitle: v[1], operacao: v[2] ?? '' });
  }

  // ================= cenário atual =================
  private captureThumb() {
    const r = this.app.state.room;
    if (!r) return;
    const url = this.app.view.snapshot(150, 98);
    if (!url) return;
    saveThumb(r.id, url);
    this.setThumb(r.id, url);
  }

  private setThumb(id: number, url: string) {
    this.el.querySelectorAll<HTMLImageElement>(`img[data-room="${id}"]`).forEach((img) => (img.src = url));
    this.el.querySelectorAll(`.thumb-ph[data-room="${id}"]`).forEach((ph) => {
      const img = h('img', { src: url, alt: '', 'data-room': String(id) });
      ph.replaceWith(img);
      img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    });
  }

  /** Pede ao servidor o conteúdo das cenas sem miniatura. */
  /** Miniaturas das outras cenas (para a lista de cenários, hoje fora da tela). */
  requestThumbs() {
    const cur = this.app.state.room?.id;
    for (const s of this.campaign?.scenes ?? []) {
      if (s.id === cur || this.peeked.has(s.id) || loadThumb(s.id)) continue;
      this.peeked.add(s.id);
      this.app.net.send({ t: 'peek', roomId: s.id });
    }
  }

  /** Miniatura de outra cena, desenhada fora da tela. */
  onPeek(room: RoomInfo, items: FloorItem[], wallItems: WallItem[]) {
    const url = RoomView.still(room, items, wallItems, 150, 98);
    if (!url) return;
    saveThumb(room.id, url);
    this.setThumb(room.id, url);
  }

  private sceneList(): { id: number; name: string }[] {
    const camp = this.campaign?.scenes ?? [];
    if (camp.length) return camp.map((s) => ({ id: s.id, name: s.name }));
    return this.app.state.rooms.map((r) => ({ id: r.id, name: r.name }));
  }

  private renderScenes() {
    const list = this.sceneList();
    const cur = this.app.state.room?.id ?? null;
    if (!this.changed('scenes', [list, cur])) return;
    const ids = new Set(list.map((s) => s.id));
    for (const [id, row] of this.sceneRows)
      if (!ids.has(id)) {
        this.sceneRows.delete(id);
        void leave(row, 'left');
      }
    list.forEach((s, i) => {
      const name = s.name.split('·').pop()!.trim();
      let row = this.sceneRows.get(s.id);
      if (!row) {
        const url = loadThumb(s.id);
        const thumb = url ? h('img', { src: url, alt: '', 'data-room': String(s.id) }) : h('span', { class: 'thumb-ph', 'data-room': String(s.id) });
        row = h('button', { class: 'sc-row', onclick: () => this.goScene(s.id) }, h('span', { class: 'sc-thumb' }, thumb), h('span', { class: 'sc-name' }, name));
        this.sceneRows.set(s.id, row);
        enter(row, 'right', this.intro(250 + i * 55));
      } else row.querySelector('.sc-name')!.textContent = name;
      const at = this.scenesEl.children[i];
      if (at !== row) this.scenesEl.insertBefore(row, at ?? null);
    });
    if (cur !== this.activeScene) {
      const old = this.activeScene !== null ? this.sceneRows.get(this.activeScene) : undefined;
      if (old) this.unmarkScene(old);
      const row = cur !== null ? this.sceneRows.get(cur) : undefined;
      if (row) this.markScene(row, this.intro(900));
      this.activeScene = cur;
      this.minimapa.animarAtual(this.intro(1100));
    }
  }

  private goScene(id: number) {
    if (id === this.app.state.room?.id) {
      const row = this.sceneRows.get(id);
      if (row) shake(row, 0.25);
      return;
    }
    sfx.click();
    this.app.net.send({ t: 'join', roomId: id });
  }

  /** Cena atual: pincel vermelho passa pintando a linha. */
  private markScene(row: HTMLElement, delay: number) {
    row.classList.add('on');
    const cv = brushize(row, { seed: 5 + [...this.sceneRows.values()].indexOf(row), color: '#cf5a4e', arrow: true });
    void brushSweep(row, cv, 640, delay);
  }

  /** Cena que deixou de ser a atual: a tinta lava. */
  private unmarkScene(row: HTMLElement) {
    row.classList.remove('on');
    const cv = row.querySelector<HTMLElement>(':scope > .paper-cv');
    if (!cv) return;
    void brushWash(cv).then(() => {
      if (!row.classList.contains('on')) unpaint(row);
    });
  }


  // ================= direita: controle do RPG =================
  /** Abas da direita e o conteúdo da aba aberta (PLAYERS: a ficha de cada um). */
  private renderRpg(force = false) {
    // os agentes primeiro (todos, onde estiverem: é aqui que o mestre tira e dá PV, PE e SAN, 17/10), depois as outras
    // peças da campanha (os NPCs e as ameaças em cena)
    const agentes = this.campaign?.agentes ?? [];
    const deAgente = new Set(agentes.map((p) => p.id));
    const party = [...agentes, ...(this.campaign?.party ?? []).filter((p) => !deAgente.has(p.id))];
    // a estrutura (o que obriga a refazer as cartas) fica separada dos números (PV, PE, SAN): os números se
    // acertam no lugar. Refazer tudo a cada ponto de vida piscava o painel inteiro.
    const sig = JSON.stringify([this.rpgTab, this.gm, party.map((p) => [p.id, p.name, p.color, p.roomId, p.look?.charId ?? null, !!p.armed, vitalConditions(p.vitals).machucado])]);
    const vit = JSON.stringify(party.map((p) => [p.id, p.vitals ?? null]));
    if (!force && sig === this.rpgSig) {
      if (vit !== this.rpgVit) {
        this.rpgVit = vit;
        for (const p of party) this.rpgBody.querySelector<VitaisVivos>(`.rpg-player[data-id="${p.id}"] .rp-vit`)?.atualizar?.(p);
      }
      return;
    }
    this.rpgSig = sig;
    this.rpgVit = vit;
    // as abas só se refazem quando a aba muda
    if (this.rpgTabsDe !== this.rpgTab || !this.rpgTabsEl.childElementCount) {
      this.rpgTabsDe = this.rpgTab;
      clear(this.rpgTabsEl).append(
        ...RPG_TABS.map((t) =>
          h(
            'button',
            {
              class: `itab${t === this.rpgTab ? ' on' : ''}`,
              role: 'tab',
              'aria-selected': String(t === this.rpgTab),
              onclick: () => {
                if (t === this.rpgTab) return;
                sfx.paper();
                this.rpgTab = t;
                this.renderRpg(true);
              },
            },
            // o ícone pintado da aba (arte/icones/painel-<nome>.png); até chegar, um do kit ou o de linha
            arteOu(ABA_ARTE[t], ic(ABA_LINHA[t])),
            h('span', null, t),
            t === this.rpgTab ? tabRing() : null,
          ),
        ),
      );
    }
    // a rolagem fica onde estava ao refazer a mesma aba (17/10, o Felipe: "quando eu tô selecionando uma opção no
    // interlúdio ele tá subindo a tela toda"): a do painel e a das listas de dentro, pela classe de cada uma
    const rolagem = this.rpgRolagemDe === this.rpgTab ? guardarRolagem(this.rpgBody) : [];
    this.rpgRolagemDe = this.rpgTab;
    const body = clear(this.rpgBody);
    queueMicrotask(() => devolverRolagem(body, rolagem));
    if (this.rpgTab === 'ITENS') {
      this.abaItens.render(body, party, this.fichasMapa, this.gm);
      return;
    }
    if (this.rpgTab === 'INTERLÚDIO') {
      this.abaInterludio.render(body, party, this.fichasMapa, this.gm, () => this.renderRpg(true), this.campaign?.scenes ?? []);
      return;
    }
    if (!party.length) {
      body.append(h('p', { class: 'empty' }, 'Nenhum personagem nesta campanha.'));
      return;
    }
    const cur = this.app.state.room?.id;
    // mais de 4 agentes: o cartão encolhe para todos caberem sem rolar
    body.classList.toggle('muitos', party.filter((p) => p.id).length > 4);
    for (const p of party) {
      if (!p.id) continue;
      const id = p.id;
      const here = p.roomId === cur;
      const card = h(
        'div',
        { class: 'rpg-player', style: `--c:${p.color}`, 'data-id': String(id) },
        h(
          'button',
          { class: 'rp-foto', title: here ? 'Comandar' : `Ir para ${this.sceneName(p.roomId)}`, onclick: () => this.pickCard(id) },
          portraitCanvas(p.look, 96, { dir: 2, armed: !!p.armed, hurt: vitalConditions(p.vitals).machucado }),
        ),
        h(
          'div',
          { class: 'rp-info' },
          // armado: a arma logo depois do nome, em pixel (14/10: antes era um selo por cima do retrato; depois do nome
          // para o nome não mudar de lugar quando o agente saca ou guarda)
          h('div', { class: 'rp-nome' }, h('b', null, p.name, p.armed ? this.armaNaMao(id) : null), h('button', { class: 'rp-mais', type: 'button', title: 'Mais', 'aria-label': `Mais de ${p.name}`, onclick: (ev: Event) => (sfx.click(), this.menuDaPeca(ev.currentTarget as HTMLElement, p, here)) }, ic('reticencias'))),
          h('div', { class: 'rp-local' }, ic('pino'), h('span', null, this.sceneName(p.roomId) || '—')),
          this.vitaisCarta(id, p),
        ),
      );
      paperize(card, { seed: 300 + id, tone: '#dfd0b3', burn: 0.7, torn: 0.8, stains: 0.6, pad: 12 });
      body.append(card);
    }
  }

  /**
   * O menu do "⋯" do card da peça (17/10, o Felipe: "os ⋯ ali na direita deviam me abrir um menu; quero poder excluir
   * um personagem da cena"): comandar ou ir até ela, centralizar, a mochila, editar e tirar da cena.
   */
  private menuDaPeca(botao: HTMLElement, p: PartyMember, here: boolean) {
    document.querySelector('.rp-menu')?.remove();
    const id = p.id!;
    const view = this.app.view;
    const fechar = () => {
      menu.remove();
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', esc, true);
    };
    const fora = (e: Event) => !menu.contains(e.target as Node) && e.target !== botao && fechar();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    const item = (rotulo: string, icone: string, fazer: () => void, perigo = false, desligado = '') =>
      h(
        'button',
        { class: `rp-menu-i${perigo ? ' perigo' : ''}`, type: 'button', disabled: !!desligado, title: desligado || rotulo, onclick: () => (fechar(), sfx.click(), fazer()) },
        ic(icone),
        h('span', null, rotulo),
      );
    const ficha = this.fichasMapa.some((f) => f.personagem === p.look?.charId);
    const menu = h(
      'div',
      { class: 'rp-menu', role: 'menu' },
      here ? item('Comandar', 'pessoa', () => view.setActive(id)) : item('Ir até a cena', 'pino', () => this.pickCard(id)),
      here ? item('Centralizar', 'mira', () => view.focusUser(id)) : null,
      this.gm && ficha ? item('Mochila', 'mochila', () => (sfx.paper(), this.abrirItens(id))) : null,
      this.gm && p.look ? item('Editar', 'lapis', () => this.tokenWin.open({ id, name: p.name, look: p.look!, color: p.color, capacity: p.capacity ?? 10 })) : null,
      this.gm
        ? item(
            'Tirar da cena',
            'lixo',
            async () => (await askNote(`TIRAR ${p.name.toUpperCase()}?`, `${p.name} sai do tabuleiro. Os itens que carrega continuam registrados.`, 'Tirar do tabuleiro', true)) && this.app.net.send({ t: 'tokenRemove', tokenId: id }),
            true,
            here ? '' : 'Vá até a cena da peça para tirar ela de lá',
          )
        : null,
    );
    document.body.append(menu);
    const r = botao.getBoundingClientRect();
    const larg = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - larg - 8, r.right - larg))}px`;
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6)}px`;
    setTimeout(() => {
      document.addEventListener('pointerdown', fora, true);
      document.addEventListener('keydown', esc, true);
    });
  }

  /** O ícone da arma na mão do agente (espada ou pistola), para ir logo depois do nome. */
  private armaNaMao(id: number): HTMLElement {
    const fogo = this.app.session.session?.characters.find((c) => c.id === -id)?.arma === 'fogo';
    const el = iconePixel(fogo ? 'pistola' : 'espada', 'rp-arma');
    el.title = fogo ? 'Arma de fogo na mão' : 'Arma na mão';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', el.title);
    return el;
  }

  /** Fichas do servidor: a aba ITENS mostra a mochila de cada agente por elas. */
  /** Os documentos da investigação (o mestre recebe todos). */
  setDocs(docs: Documento[]) {
    this.docs = docs;
    documentosMudaram();
  }

  private abrirDocs() {
    abrirDocumentos(this.app, { docs: () => this.docs, fichas: () => this.fichasMapa, campanha: () => this.campaign?.key });
  }

  setFichasMapa(lista: FichaSalva[]) {
    this.fichasMapa = lista;
    // só o que as cartas mostram da ficha (mochila, condições marcadas, tema...). Os pontos de agora (PV, PE, SAN)
    // ficam de fora: eles já se acertam no lugar pela party, e refazer o painel a cada ponto piscava os retratos e os
    // ícones (14/10). O INTERLÚDIO mostra os pontos, então lá eles contam.
    const pontos = this.rpgTab === 'INTERLÚDIO';
    const fs = JSON.stringify(lista.map((f) => [f.id, { ...f, atualizadaEm: 0, atual: pontos ? f.atual : 0 }]));
    if (fs === this.fichasMapaSig) return;
    this.fichasMapaSig = fs;
    // as cartas dos agentes vestem o elemento de cada um (o tema da ficha)
    for (const [id, c] of this.cards) c.el.dataset.tema = this.temaDe(this.campaign?.party.find((x) => x.id === id));
    // a mochila (ITENS) e as condições marcadas (PLAYERS) vêm das fichas
    this.renderRpg(true);
  }

  /** O tabuleiro na altura toda: esconde a fileira de baixo (e guarda a escolha neste navegador). */
  private alternarFoco(bt: HTMLElement, ligar?: boolean) {
    const on = ligar ?? !this.el.classList.contains('foco-tabuleiro');
    this.el.classList.toggle('foco-tabuleiro', on);
    bt.setAttribute('aria-pressed', String(on));
    bt.classList.toggle('on', on);
    bt.querySelector('span')!.textContent = on ? 'REDUZIR' : 'AMPLIAR';
    if (ligar === undefined) sfx.click();
    try {
      localStorage.setItem('crona.foco', on ? '1' : '0');
    } catch {
      /* sem armazenamento */
    }
  }

  /**
   * A planta grande, por cima da tela (botão da planta ou a tecla M): o mesmo minimapa, em
   * tamanho de ler, com os níveis, o cartão e a lista de lugares. Entrar ou Levar fecham a janela.
   */
  private plantaGrande: { el: HTMLElement; mm: Minimapa } | null = null;

  private abrirPlantaGrande() {
    if (this.plantaGrande) return this.fecharPlantaGrande();
    sfx.paper();
    const host = this.hostMinimapa();
    const mm = new Minimapa(
      {
        ...host,
        ir: (id) => (this.fecharPlantaGrande(), host.ir(id)),
        levar: (roomId, tokens, entrar) => (entrar !== false && this.fecharPlantaGrande(), host.levar(roomId, tokens, entrar)),
      },
      { grande: true },
    );
    const fechar = h('button', { class: 'plg-x', type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar a planta', onclick: () => this.fecharPlantaGrande() }, ic('fechar'));
    const el = h(
      'div',
      { class: 'plg', role: 'dialog', 'aria-label': 'Planta', onclick: (e: MouseEvent) => e.target === el && this.fecharPlantaGrande() },
      h(
        'div',
        { class: 'plg-janela mm-grande' },
        h('header', { class: 'plg-cab' }, mm.trilha, mm.botoes, fechar),
        h('div', { class: 'plg-mapa' }, mm.canvas, mm.cartao),
        h('p', { class: 'plg-dica' }, 'Clique num prédio para ver dentro e num cômodo para o cartão. Botão direito sobe. Esc fecha.'),
      ),
    );
    document.body.append(el);
    this.plantaGrande = { el, mm };
    requestAnimationFrame(() => mm.atualizar());
  }

  private fecharPlantaGrande() {
    const g = this.plantaGrande;
    if (!g) return;
    this.plantaGrande = null;
    g.el.classList.add('saindo');
    setTimeout(() => g.el.remove(), 180);
  }

  /** Atualiza o minimapa da coluna e o da planta grande (quando aberta). */
  private atualizarMinimapa() {
    this.minimapa.atualizar();
    this.plantaGrande?.mm.atualizar();
  }

  /** O que o minimapa pede à tela: a campanha, a cena aberta e as ações do mestre. */
  private hostMinimapa(): MinimapaHost {
    return {
      campanha: () => this.campaign,
      cenaAtual: () => this.app.state.room?.id,
      mestre: () => this.owner,
      ir: (id) => this.goScene(id),
      levar: (roomId, tokens, entrar) => (sfx.click(), this.app.net.send({ t: 'grupoPara', roomId, ...(tokens ? { tokens } : {}), ...(entrar === false ? { entrar } : {}) })),
      marcarVisita: (roomId, visitada) => this.app.net.send(roomId === null ? { t: 'visitada', campanha: this.app.state.room?.id, visitada } : { t: 'visitada', roomId, visitada }),
      ehAgente: (charId) => !!charId && this.fichasMapa.some((f) => f.personagem === charId),
      nomearArea: (cena, x, y, texto, id) => this.app.net.send(id !== undefined ? { t: 'planNota', id, texto, x, y } : { t: 'planNota', andar: `t${cena}`, texto, x, y }),
    };
  }

  // ================= objetivos =================
  private renderObjectives() {
    const list = this.campaign?.objectives ?? [];
    this.objPlus.classList.toggle('hidden', !this.owner || this.addingObj);
    if (!this.changed('obj', [list, this.owner, this.addingObj])) return;
    const ids = new Set(list.map((o) => o.id));
    for (const [id, r] of this.objRows)
      if (!ids.has(id)) {
        this.objRows.delete(id);
        void leave(r.el, 'left');
      }
    list.forEach((o, i) => {
      let r = this.objRows.get(o.id);
      if (!r) {
        r = this.makeObjRow(o);
        this.objRows.set(o.id, r);
        enter(r.el, 'left', this.intro(420 + i * 60));
        if (o.done) r.path.style.strokeDashoffset = '0px';
      } else {
        if (r.text.textContent !== o.text) r.text.textContent = o.text;
        if (r.done !== o.done && !r.busy) this.animateCheck(r, o.done);
      }
      r.el.classList.toggle('done', o.done);
      const at = this.objEl.children[i];
      if (at !== r.el) this.objEl.insertBefore(r.el, at ?? null);
    });
    this.objEl.querySelector('.obj-add')?.remove();
    if (this.owner && this.addingObj) {
      const inp = h('input', { class: 'obj-add', placeholder: 'novo objetivo (Enter)', maxlength: 80 });
      const done = () => {
        this.addingObj = false;
        this.renderObjectives();
      };
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && inp.value.trim()) {
          this.app.net.send({ t: 'objAdd', text: inp.value.trim() });
          inp.value = '';
        } else if (e.key === 'Escape') done();
      });
      inp.addEventListener('blur', () => !inp.value.trim() && done());
      this.objEl.append(inp);
      enter(inp, 'up', 0, 260);
      setTimeout(() => inp.focus(), 0);
    }
  }

  private makeObjRow(o: Objective): ObjRow {
    const mark = checkMark(o.id);
    const path = mark.querySelector('path')!;
    const box = h('span', { class: 'chk' }, mark);
    const text = h('span', { class: 'obj-t' }, o.text);
    const row: ObjRow = { id: o.id, el: h('div', { class: 'obj' }), path, text, done: o.done, busy: false };
    const toggle = () => {
      if (!this.owner || row.busy) return;
      const next = !row.done;
      // otimista: anima já; o servidor confirma em seguida
      const obj = this.campaign?.objectives.find((x) => x.id === o.id);
      if (obj) obj.done = next;
      this.animateCheck(row, next);
      row.el.classList.toggle('done', next);
      this.sigs.obj = '';
      this.app.net.send({ t: 'objToggle', id: o.id });
    };
    row.el.append(h('button', { class: 'obj-hit', 'aria-label': 'Concluir ou desmarcar', onclick: toggle }, box), h('span', { class: 'obj-tx', onclick: toggle }, text));
    if (this.owner) row.el.append(h('button', { class: 'obj-x', title: 'Remover', 'aria-label': 'Remover objetivo', onclick: () => this.app.net.send({ t: 'objRemove', id: o.id }) }, '×'));
    return row;
  }

  /** Lápis risca o check (ou a borracha apaga). */
  private animateCheck(r: ObjRow, done: boolean) {
    r.done = done;
    r.busy = true;
    const p = done ? pencilDraw(r.path, 560) : eraseDraw(r.path, 520);
    void p.finally(() => {
      r.busy = false;
      const want = this.campaign?.objectives.find((x) => x.id === r.id)?.done;
      if (want !== undefined && want !== r.done) this.animateCheck(r, want);
    });
  }

  // ================= inspetor =================
  private selection(): Sel {
    const sel = this.app.view.selection;
    const map = this.app.view.map;
    if (!sel || !map || sel.kind === 'user') return null;
    const item = sel.kind === 'floor' ? map.getItem(sel.id) : map.getWallItem(sel.id);
    return item ? { kind: sel.kind, item } : null;
  }

  private member(name: string | undefined): PartyMember | undefined {
    if (!name) return undefined;
    return this.campaign?.party.find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  private polaroid(content: HTMLElement | HTMLCanvasElement): HTMLElement {
    return h('div', { class: 'polaroid' }, h('span', { class: 'pol-photo' }, content), h('i', { class: 'pc-dot d1' }), h('i', { class: 'pc-dot d2' }), h('i', { class: 'pc-dot d3' }), h('i', { class: 'pc-dot d4' }));
  }

  private headText(title: string, desc: string, extra?: Node | null): HTMLElement {
    return h('div', { class: 'insp-text' }, h('h2', null, h('span', null, title), uline()), h('p', null, desc), extra ?? null);
  }

  /** Estado que muda o que o inspetor mostra (para não redesenhar à toa). */
  private inspState() {
    const view = this.app.view;
    const sel = view.selection;
    const party = (this.campaign?.party ?? []).map((p) => [p.id, p.name, p.color, p.load, p.capacity, p.look, !!p.armed, vitalConditions(p.vitals).machucado, breathMode(vitalConditions(p.vitals))]);
    let data: unknown = null;
    if (sel?.kind === 'user') {
      const u = view.users.get(sel.id);
      data = u ? [u.name, u.look, u.color, view.myId === sel.id, !!u.agachado, !!u.alto, !!view.map?.leitoItem(u.x, u.y)] : null;
    } else if (sel) data = this.selection()?.item ?? null;
    else {
      const map = view.map;
      data = map ? [...map.allItems(), ...map.allWallItems()].filter((it) => it.hint || it.loot?.length || it.actions?.length) : null;
    }
    return JSON.stringify([sel, this.inspTab, this.objModo, this.giveLoot, this.addingLoot, this.logging, this.gm, this.app.state.room?.id, this.app.state.room?.description, data, party]);
  }

  private renderInspector(force = false) {
    const view = this.app.view;
    const sel = view.selection;
    const key = sel ? `${sel.kind}${sel.id}` : `none${this.app.state.room?.id ?? 0}`;
    const fresh = key !== this.inspKey;
    const sig = this.inspState();
    if (!force && !fresh && sig === this.inspSig) return;
    this.inspSig = sig;
    const prevTab = this.inspTab;
    if (fresh) {
      const locked = sel?.kind === 'floor' && !!this.selection()?.item && !!(this.selection()!.item as FloorItem).lock;
      this.inspTab = sel && sel.kind !== 'user' && !locked ? 'items' : 'desc';
      this.objModo = 'jogar';
      this.photoUrl = sel && sel.kind !== 'user' ? view.photo(sel.kind, sel.id, 262, 250) : null;
      this.inspSig = this.inspState();
      if (sel) sfx.paper();
    }
    this.inspKey = key;
    const body = this.inspBody;
    clear(body);
    this.inspCab.textContent = sel?.kind === 'user' ? 'PERSONAGEM' : sel ? 'OBJETO' : 'NESTA CENA';
    // com algo aberto, o cartão da sala encolhe (só o nome e o andar) e o do objeto ganha a altura
    this.inspEl.parentElement?.classList.toggle('com-selecao', !!sel);
    this.closeTag.classList.toggle('hidden', !sel);
    if (fresh && sel) this.closeTag.animate([{ transform: 'rotate(-14deg)' }, { transform: 'rotate(8deg)', offset: 0.45 }, { transform: 'rotate(-3deg)', offset: 0.75 }, { transform: 'rotate(0)' }], { duration: 700, easing: 'ease-out' });

    if (sel?.kind === 'user') {
      if (view.users.get(sel.id)) this.renderTokenInspector(body, sel.id);
    } else {
      const s = this.selection();
      if (!s) this.renderSceneInspector(body);
      else this.renderItemInspector(body, s);
    }
    if (fresh) this.animateInspector(body);
    else if (prevTab !== this.inspTab) this.animateTabSwitch(body, prevTab);
    this.renderGive();
  }

  /** Nova seleção: polaroid revela, título sublinha, texto é datilografado, cartões entram. */
  private animateInspector(body: HTMLElement) {
    const pol = body.querySelector<HTMLElement>('.polaroid');
    if (pol && !reduced()) {
      pol.animate([{ transform: 'translateY(-1.8rem) rotate(-7deg) scale(1.08)', opacity: 0 }, { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.2,.9,.3,1.25)', composite: 'add' });
      const photo = pol.querySelector<HTMLElement>('.pol-photo > *');
      photo?.animate([{ filter: 'brightness(2.4) contrast(0.45) sepia(0.9) blur(1.5px)' }, { filter: 'brightness(1.3) contrast(0.8) sepia(0.5) blur(0.5px)', offset: 0.5 }, { filter: 'brightness(0.9) contrast(1.15) saturate(1.15) sepia(0.22)' }], {
        duration: 1600,
        easing: 'ease-out',
      });
    }
    const h2 = body.querySelector('.insp-text h2');
    if (h2) {
      enter(h2, 'fade', 80, 300);
      const ul = h2.querySelector('.uline');
      if (ul) wipeIn(ul, 420, 260);
    }
    const p = body.querySelector<HTMLElement>('.insp-text > p');
    if (p) typeInto(p, p.textContent ?? '', 750);
    body.querySelectorAll('.itabs').forEach((t) => enter(t, 'up', 180, 360));
    this.drawRing(body, 380);
    body.querySelectorAll('.ipane > *').forEach((c, i) => enter(c, 'left', 260 + i * 70, 420));
    body.querySelectorAll('.insp-tip, .tk-grupo').forEach((c, i) => enter(c, 'up', 260 + i * 70, 380));
  }

  private animateTabSwitch(body: HTMLElement, prev: InspTab) {
    const dir = INSP_TABS.indexOf(this.inspTab) > INSP_TABS.indexOf(prev) ? 'left' : 'right';
    body.querySelectorAll('.ipane').forEach((pane) => enter(pane, dir, 0, 300));
    body.querySelectorAll('.ipane > *').forEach((c, i) => enter(c, 'fade', 40 + i * 40, 260));
    this.drawRing(body, 0);
    sfx.paper();
  }

  /** O contorno vermelho da aba ativa é desenhado a lápis. */
  private drawRing(body: HTMLElement, delay: number) {
    body.querySelectorAll<SVGPathElement>('.tab-ring .ring-line').forEach((p) => drawStroke(p, 460, delay));
    body.querySelectorAll('.tab-ring .ring-under').forEach((p) => wipeIn(p, 300, delay + 380));
  }

  private renderSceneInspector(body: HTMLElement) {
    const map = this.app.view.map;
    const marks: { kind: 'floor' | 'wall'; item: FloorItem | WallItem }[] = [];
    if (map) {
      for (const it of map.allItems()) if ((it.hint && (it.hint.visible || this.gm)) || it.loot?.length || it.actions?.length || (it.lock && this.gm)) marks.push({ kind: 'floor', item: it });
      for (const it of map.allWallItems()) if ((it.hint && (it.hint.visible || this.gm)) || it.loot?.length || it.actions?.length) marks.push({ kind: 'wall', item: it });
    }
    const pane = h('div', { class: 'ipane cena' });
    if (!marks.length) pane.append(h('p', { class: 'empty' }, 'Nada marcado nesta cena.'));
    marks.forEach(({ kind, item }) => {
      const free = (item.loot ?? []).filter((l) => !l.holder).length;
      const lock = (item as FloorItem).lock;
      const parts = [
        lock ? (lock.open ? 'Passagem aberta' : lock.semSenha ? 'Esconde uma passagem' : 'Com senha') : null,
        item.hint ? 'Pista' : null,
        free ? `${free} ${free > 1 ? 'itens' : 'item'}` : null,
        item.actions?.length ? `${item.actions.length} ${item.actions.length > 1 ? 'interações' : 'interação'}` : null,
      ].filter(Boolean);
      const go = () => {
        this.app.view.focusItem(kind, item.id);
        this.app.view.select({ kind, id: item.id });
      };
      pane.append(
        h(
          'div',
          { class: 'icard link', onclick: go },
          h('div', { class: 'ic-icon' }, thumbCopy(item.defId, 56)),
          h('div', { class: 'ic-text' }, h('b', null, item.hint?.title || anyFurniName(item.defId)), h('small', null, parts.join(' | '))),
          h('button', { class: 'dbtn', onclick: (e: Event) => (e.stopPropagation(), go()) }, 'Ver'),
        ),
      );
    });
    body.append(pane, h('p', { class: 'insp-tip' }, 'Clique num personagem (ou no retrato dele, embaixo) para comandá-lo; depois clique no chão para ele andar.'));
  }

  private renderItemInspector(body: HTMLElement, s: NonNullable<Sel>) {
    const { item } = s;
    const fdef = s.kind === 'floor' ? getFurni(item.defId) : undefined;
    const wdef = s.kind === 'wall' ? getWallFurni(item.defId) : undefined;
    const hint = item.hint && (item.hint.visible || this.gm) ? item.hint : undefined;
    const title = (hint?.title || anyFurniName(item.defId)).toUpperCase();
    const desc = hint?.text || fdef?.desc || wdef?.desc || 'Nada de especial à primeira vista.';
    const loot = item.loot ?? [];
    const actions = item.actions ?? [];
    const photo = this.photoUrl ? h('img', { src: this.photoUrl, alt: '' }) : thumbCopy(item.defId, 124);
    body.append(h('div', { class: 'insp-head' }, this.polaroid(photo), this.headText(title, desc)));
    const modo = this.gm ? this.objModo : 'jogar';
    if (this.gm) {
      // os três momentos: o ícone em cima, o nome embaixo; o pintado quando chegar (PROMPT-ICONES-E-LOGO)
      const botaoModo = (id: typeof modo, nome: string, pintado: string, linha: NomeIcone, dica: string) =>
        h(
          'button',
          {
            class: `obj-modo${modo === id ? ' on' : ''}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(modo === id),
            title: dica,
            onclick: () => {
              if (this.objModo === id) return;
              sfx.paper();
              this.objModo = id;
              this.giveLoot = null;
              this.renderInspector(true);
            },
          },
          arteOu([`/arte/icones/${pintado}.png`], ic(linha)),
          h('span', null, nome),
        );
      body.append(
        h(
          'div',
          { class: 'obj-modos', role: 'tablist', 'aria-label': 'O que fazer com o objeto' },
          botaoModo('jogar', 'Jogar', 'obj-interagir', 'mao', 'O agente vai lá e usa: abrir, ler, pegar e entregar itens, fazer os testes'),
          botaoModo('config', 'Configurar', 'obj-configurar', 'engrenagem', 'Preparar o objeto: o texto e a pista, os itens dentro e os testes'),
          botaoModo('mexer', 'Mexer', 'obj-mover', 'mover', 'Mudar de lugar: mover, girar, trocar, tamanho e guardar'),
        ),
      );
    }
    const pane = h('div', { class: `ipane obj-${modo}` });
    body.append(pane, selo());
    if (modo === 'mexer') this.paneMexer(pane, s);
    else if (modo === 'config') this.paneConfig(pane, s, loot, actions);
    else this.paneJogar(pane, s, loot, actions);
  }

  private secao(titulo: string, ...conteudo: (Node | null)[]) {
    return h('section', { class: 'obj-sec' }, h('h4', { class: 'obj-sec-tit' }, titulo), ...conteudo);
  }

  private botaoObj(rotulo: string, pintado: string | null, linha: NomeIcone, fn: () => void, cls = '') {
    return h('button', { class: `obj-bt ${cls}`, type: 'button', onclick: () => (sfx.click(), fn()) }, pintado ? arteOu([`/arte/icones/${pintado}.png`], ic(linha)) : ic(linha), h('span', null, rotulo));
  }

  /** Jogar: o que o agente faz com o objeto (abrir/usar, ler a pista, os itens e os testes). */
  private paneJogar(pane: HTMLElement, s: NonNullable<Sel>, loot: Loot[], actions: NonNullable<FloorItem['actions']>) {
    const { item, kind } = s;
    const net = this.app.net;
    const fdef = kind === 'floor' ? getFurni(item.defId) : undefined;
    const wdef = kind === 'wall' ? getWallFurni(item.defId) : undefined;
    const hint = item.hint && (item.hint.visible || this.gm) ? item.hint : undefined;
    const trancado = kind === 'floor' && !!(item as FloorItem).lock;
    if (trancado && this.gm) pane.append(this.keypad(item as FloorItem));
    // a tranca do Ctrl + clique: o tabuleiro não mostra; só o mestre vê aqui, para lembrar
    if (kind === 'floor' && (item as FloorItem).trancado && this.gm) pane.append(h('p', { class: 'obj-nota' }, 'Trancado. Ctrl + clique no tabuleiro destranca.'));
    if (hint && !hint.visible) pane.append(h('p', { class: 'desc-hidden' }, '● pista oculta para os jogadores'));
    const usos = h('div', { class: 'obj-bts' });
    const states = fdef?.states ?? wdef?.states ?? 0;
    const porta = fdef?.openState !== undefined;
    // um jogo do bar: o agente comandado vai até ele e o jogo abre quando ele chega
    const quemJoga = this.jogador(kind, item.defId);
    if (quemJoga) usos.append(this.botaoObj(`Jogar (${quemJoga.split(' ')[0]})`, 'combate-item', 'mao', () => this.usar(kind, item.id, item.defId), 'forte'));
    else if (states > 1) usos.append(this.botaoObj(porta ? (item.state === fdef!.openState ? 'Fechar' : 'Abrir') : 'Usar', porta ? 'cadeado' : 'combate-item', porta ? 'cadeado' : 'mao', () => this.usar(kind, item.id, item.defId), 'forte'));
    if (!quemJoga && this.gm && bar.jogoDoBar(item.defId)) pane.append(h('p', { class: 'obj-nota' }, 'Para jogar: comande um agente (clique no retrato dele) e escolha o jogo de novo. Ele vai até lá e o jogo abre quando chegar.'));
    if (hint) usos.append(this.botaoObj('Ler a pista', 'busca', 'lupa', () => this.hintViewer.open(kind, item.id)));
    if (usos.childElementCount) pane.append(usos);
    if (loot.length) {
      const lista = h('div', { class: 'obj-lista' });
      this.paneItems(lista, s, loot, 'jogar');
      pane.append(this.secao(`Contém (${loot.length})`, lista));
    }
    if (actions.length) {
      const lista = h('div', { class: 'obj-lista' });
      this.paneInter(lista, s, actions, 'jogar');
      pane.append(this.secao('Testes', lista));
    }
    if (!usos.childElementCount && !loot.length && !actions.length && !trancado)
      pane.append(h('p', { class: 'empty' }, this.gm ? 'Nada para fazer aqui. Em Configurar, ponha itens, uma pista ou testes.' : 'Nada de especial aqui.'));
  }

  /** Configurar: o texto (a pista), os itens dentro, os testes e o destino da passagem. */
  private paneConfig(pane: HTMLElement, s: NonNullable<Sel>, loot: Loot[], actions: NonNullable<FloorItem['actions']>) {
    const { item, kind } = s;
    const net = this.app.net;
    const texto = h('div', { class: 'obj-bts' }, this.botaoObj(item.hint ? 'Editar o texto' : 'Escrever um texto', 'botao-editar', 'lapis', () => this.hintEditor.open(kind, item.id)));
    if (item.hint) {
      const hh = item.hint;
      texto.append(this.botaoObj(hh.visible ? 'Esconder' : 'Mostrar', null, hh.visible ? 'olhoFechado' : 'olho', () => net.send({ t: 'setHint', id: item.id, hint: { ...hh, visible: !hh.visible } })));
    }
    const nota = item.hint ? (item.hint.visible ? 'Os jogadores leem este texto.' : 'Só você vê o texto; mostre quando acharem.') : 'Uma descrição especial, um documento ou uma pista para os jogadores lerem.';
    pane.append(this.secao('Texto e pista', h('p', { class: 'obj-nota' }, nota), texto));
    const itens = h('div', { class: 'obj-lista' });
    this.paneItems(itens, s, loot, 'config');
    pane.append(this.secao(`Itens dentro (${loot.length})`, itens));
    const testes = h('div', { class: 'obj-lista' });
    this.paneInter(testes, s, actions, 'config');
    pane.append(this.secao('Testes', testes));
    const floor = kind === 'floor' ? (item as FloorItem) : null;
    const fdef = floor ? getFurni(floor.defId) : undefined;
    if (floor && fdef?.portal) {
      const others = this.app.state.rooms.filter((r) => r.id !== this.app.state.room?.id);
      const sel = h('select', { class: 'tool-sel', 'aria-label': 'Destino da passagem' }, h('option', { value: '' }, 'Sem destino'), ...others.map((r) => h('option', { value: String(r.id), selected: r.id === floor.link }, r.name)));
      sel.addEventListener('change', () => net.send({ t: 'setLink', id: floor.id, roomId: sel.value ? Number(sel.value) : null }));
      pane.append(this.secao('Leva para', sel));
    }
  }

  /** Mexer: o lugar do objeto (mover, girar, trocar por outro, o tamanho do desenho e guardar). */
  private paneMexer(pane: HTMLElement, s: NonNullable<Sel>) {
    const { item, kind } = s;
    const net = this.app.net;
    const floor = kind === 'floor' ? (item as FloorItem) : null;
    const fdef = floor ? getFurni(floor.defId) : undefined;
    const bts = h('div', { class: 'obj-bts grade' });
    bts.append(
      this.botaoObj('Mover', 'obj-mover', 'mover', () => {
        if (floor) this.app.view.startPlacement({ kind: 'floor', defId: floor.defId, rot: floor.rot, moveId: floor.id });
        else this.app.view.startPlacement({ kind: 'wall', defId: item.defId, moveId: item.id });
        this.app.emit('placement');
      }),
    );
    if (floor && fdef && fdef.rotations.length > 1)
      bts.append(
        this.botaoObj('Girar', null, 'girarD', () => {
          const map = this.app.view.map!;
          const rot = giroQueCabe(fdef, floor.rot, (r) => map.canPlace(floor.defId, floor.x, floor.y, r, floor.id).ok);
          if (rot === null) return toast('Não dá para girar aqui.', 'error');
          net.send({ t: 'moveItem', id: floor.id, x: floor.x, y: floor.y, rot });
        }),
      );
    if (floor) bts.append(this.botaoObj('Trocar', null, 'trocar', () => this.acts.trocar(floor.id, floor.defId)));
    // destruído: carbonizado e torto, não senta nem liga, tapa metade (o orfanato queimado)
    if (floor && fdef && !fdef.portal && !fdef.flat)
      bts.append(
        floor.quebrado
          ? this.botaoObj('Consertar', null, 'ok', () => net.send({ t: 'quebrarItem', id: floor.id, quebrado: false }))
          : this.botaoObj('Destruir', null, 'chama', () => net.send({ t: 'quebrarItem', id: floor.id, quebrado: true })),
      );
    if (kind === 'wall' || fdef?.flat) {
      const e = item.escala ?? 1;
      const passo = (d: number) => net.send({ t: 'resizeItem', id: item.id, escala: Math.round((e + d) * 100) / 100 });
      if (e < 3) bts.append(this.botaoObj('Maior', null, 'mais', () => passo(0.25)));
      if (e > 0.5) bts.append(this.botaoObj('Menor', null, 'menos', () => passo(-0.25)));
    }
    bts.append(this.botaoObj('Guardar', null, 'mochila', () => net.send({ t: 'pickup', id: item.id }), 'perigo'));
    pane.append(bts, h('p', { class: 'obj-nota' }, 'Movendo: clique na casa nova; R ou o botão direito giram. Guardar tira o objeto da cena.'));
  }


  /**
   * A fechadura de um mobi no painel do objeto: trancada, o botão que abre o teclado grande no
   * meio do tabuleiro (os jogadores dizem a senha, o mestre digita); aberta, fechar de novo.
   */
  private keypad(it: FloorItem) {
    const lock = it.lock!;
    const net = this.app.net;
    if (lock.open)
      return h(
        'div',
        { class: 'keypad open' },
        h('div', { class: 'kp-head' }, h('b', null, 'PASSAGEM ABERTA')),
        h('button', { class: 'dbtn', onclick: () => (sfx.click(), net.send({ t: 'relock', id: it.id })) }, 'Fechar a passagem'),
      );
    // sem senha (o feno em cima do alçapão): empurrar já revela
    if (lock.semSenha)
      return h(
        'div',
        { class: 'keypad' },
        h('div', { class: 'kp-head' }, h('b', null, 'ESCONDE UMA PASSAGEM')),
        h('button', { class: 'dbtn', onclick: () => (sfx.click(), net.send({ t: 'use', id: it.id })) }, 'Empurrar e revelar'),
      );
    return h(
      'div',
      { class: 'keypad' },
      h('div', { class: 'kp-head' }, h('b', null, 'COM SENHA')),
      h('button', { class: 'dbtn', onclick: () => this.abrirTeclado(it) }, 'Digitar a senha'),
    );
  }

  /** Abre o teclado grande da fechadura (só o mestre, com ela trancada). false se não abriu. */
  abrirTeclado(it: FloorItem): boolean {
    if (!this.gm || !it.lock || it.lock.open || it.lock.semSenha) return false;
    this.teclado.abrir(it);
    return true;
  }

  /** Resposta do servidor à senha: no teclado grande (aberto) ou, sem ele, um carimbo no painel do objeto. */
  onLockResult(m: { id: number; ok: boolean; reason?: string }) {
    if (m.reason && !m.ok) toast(m.reason, 'error');
    if (this.teclado.resultado(m)) return;
    const at = this.inspBody.querySelector<HTMLElement>('.keypad') ?? this.inspBody;
    if (m.ok) {
      sfx.granted();
      this.stampCard(at, 'ACESSO LIBERADO', true);
    } else {
      sfx.denied();
      shake(at, 0.6);
      this.stampCard(at, m.reason ? 'NÃO DÁ' : 'SENHA ERRADA', false);
    }
  }

  private paneDesc(pane: HTMLElement, s: NonNullable<Sel>) {
    const { item, kind } = s;
    const net = this.app.net;
    if (kind === 'floor' && (item as FloorItem).lock && this.gm) pane.append(this.keypad(item as FloorItem));
    const fdef = kind === 'floor' ? getFurni(item.defId) : undefined;
    const wdef = kind === 'wall' ? getWallFurni(item.defId) : undefined;
    const hint = item.hint && (item.hint.visible || this.gm) ? item.hint : undefined;
    pane.append(h('p', { class: 'desc-full' }, hint?.text || fdef?.desc || wdef?.desc || 'Sem descrição. O mestre pode escrever uma em "Escrever".'));
    if (hint && !hint.visible) pane.append(h('p', { class: 'desc-hidden' }, '● oculto para os jogadores'));
    const tools = h('div', { class: 'tools' });
    const tool = (label: string, fn: () => void) => h('button', { class: 'tool', onclick: () => (sfx.click(), fn()) }, label);
    const states = fdef?.states ?? wdef?.states ?? 0;
    if (states > 1 || this.jogador(kind, item.defId)) tools.append(tool('Usar', () => this.usar(kind, item.id, item.defId)));
    if (hint) tools.append(tool('Ler', () => this.hintViewer.open(kind, item.id)));
    if (this.gm) {
      const floor = kind === 'floor' ? (item as FloorItem) : null;
      if (floor && fdef && fdef.rotations.length > 1)
        tools.append(
          tool('Girar', () => {
            const map = this.app.view.map!;
            const rot = giroQueCabe(fdef, floor.rot, (r) => map.canPlace(floor.defId, floor.x, floor.y, r, floor.id).ok);
            if (rot === null) return toast('Não dá para girar aqui.', 'error');
            net.send({ t: 'moveItem', id: floor.id, x: floor.x, y: floor.y, rot });
          }),
        );
      tools.append(
        tool('Mover', () => {
          if (floor) this.app.view.startPlacement({ kind: 'floor', defId: floor.defId, rot: floor.rot, moveId: floor.id });
          else this.app.view.startPlacement({ kind: 'wall', defId: item.defId, moveId: item.id });
          this.app.emit('placement');
        }),
        tool(item.hint ? 'Editar texto' : 'Escrever', () => this.hintEditor.open(kind, item.id)),
      );
      if (item.hint) {
        const hh = item.hint;
        tools.append(tool(hh.visible ? 'Ocultar' : 'Revelar', () => net.send({ t: 'setHint', id: item.id, hint: { ...hh, visible: !hh.visible } })));
      }
      if (floor) tools.append(tool('Trocar', () => this.acts.trocar(floor.id, floor.defId)));
      // quadros e tapetes: o tamanho do desenho
      if (kind === 'wall' || fdef?.flat) {
        const e = item.escala ?? 1;
        const passo = (d: number) => net.send({ t: 'resizeItem', id: item.id, escala: Math.round((e + d) * 100) / 100 });
        if (e < 3) tools.append(tool('Maior', () => passo(0.25)));
        if (e > 0.5) tools.append(tool('Menor', () => passo(-0.25)));
      }
      tools.append(tool('Guardar', () => net.send({ t: 'pickup', id: item.id })));
      if (floor && fdef?.portal) {
        const others = this.app.state.rooms.filter((r) => r.id !== this.app.state.room?.id);
        const sel = h('select', { class: 'tool-sel', 'aria-label': 'Destino da passagem' }, h('option', { value: '' }, 'Passagem: sem destino'), ...others.map((r) => h('option', { value: String(r.id), selected: r.id === floor.link }, `Leva para: ${r.name}`)));
        sel.addEventListener('change', () => net.send({ t: 'setLink', id: floor.id, roomId: sel.value ? Number(sel.value) : null }));
        pane.append(sel);
      }
    }
    pane.append(tools);
  }

  private paneInter(pane: HTMLElement, s: NonNullable<Sel>, actions: NonNullable<FloorItem['actions']>, modo: 'jogar' | 'config' = 'jogar') {
    const net = this.app.net;
    if (!actions.length) pane.append(h('p', { class: 'empty' }, 'Nenhum teste cadastrado.'));
    actions.forEach((a) => {
      const card = h('div', { class: 'icard' }, h('div', { class: 'ic-icon dt' }, h('b', null, 'DT'), h('span', null, String(a.dt))), h('div', { class: 'ic-text' }, h('b', null, a.label), h('small', null, `Teste | DT ${a.dt}`)));
      if (this.gm && modo === 'config')
        card.append(h('button', { class: 'ic-del', title: 'Remover', 'aria-label': 'Remover o teste', onclick: () => net.send({ t: 'actionRemove', itemId: s.item.id, actionId: a.id }) }, '×'));
      else if (this.gm) {
        if (this.logging === a.id) {
          const who = h('select', { class: 'mini' }, ...(this.campaign?.party ?? []).map((p) => h('option', { value: p.name }, p.name)));
          const val = h('input', { class: 'mini num', type: 'number', placeholder: 'valor' });
          const send = (success: boolean) => {
            net.send({ t: 'actionLog', itemId: s.item.id, actionId: a.id, player: who.value, success, value: val.value ? Number(val.value) : undefined });
            this.stampCard(card, success ? 'SUCESSO' : 'FALHA', success);
            this.logging = null;
            this.renderInspector();
          };
          const logRow = h('div', { class: 'ic-log' }, who, val, h('button', { class: 'dbtn ok', onclick: () => send(true) }, 'Sucesso'), h('button', { class: 'dbtn bad', onclick: () => send(false) }, 'Falha'));
          card.append(logRow);
          enter(logRow, 'up', 0, 280);
        } else
          card.append(
            h(
              'div',
              { class: 'ic-right' },
              h('button', { class: 'dbtn', onclick: () => ((this.logging = a.id), sfx.click(), this.renderInspector()) }, 'Registrar'),
            ),
          );
      }
      pane.append(card);
    });
    if (this.gm && modo === 'config') {
      const label = h('input', { class: 'mini grow', placeholder: 'Novo teste (ex: Investigar)', maxlength: 40 });
      const dt = h('input', { class: 'mini num', type: 'number', value: '15', min: '0', max: '60' });
      const form = h(
        'form',
        {
          class: 'add-row',
          onsubmit: (e: Event) => {
            e.preventDefault();
            if (!label.value.trim()) return;
            net.send({ t: 'actionAdd', itemId: s.item.id, label: label.value.trim(), dt: Number(dt.value) || 10 });
          },
        },
        label,
        h('span', { class: 'mini-l' }, 'DT'),
        dt,
        h('button', { class: 'dbtn', type: 'submit' }, '+'),
      );
      pane.append(form);
    }
  }

  private paneItems(pane: HTMLElement, s: NonNullable<Sel>, loot: Loot[], modo: 'jogar' | 'config' = 'jogar') {
    const net = this.app.net;
    if (!loot.length && !this.gm) pane.append(h('p', { class: 'empty' }, 'Nada aqui.'));
    // quem está sob comando pega direto (vai para a mochila da ficha dele)
    const ativo = this.app.view.users.get(this.app.view.myId ?? 0);
    const quemPega = ativo && this.fichasMapa.some((f) => f.personagem && f.personagem === ativo.look.charId) ? ativo.name : null;
    loot.forEach((l) => {
      const holder = this.member(l.holder);
      const prev = this.holders.get(l.id);
      const justGiven = this.holders.has(l.id) && prev !== l.holder && !!l.holder;
      this.holders.set(l.id, l.holder);
      const right = l.holder
        ? h(
            'button',
            { class: 'given', title: this.gm ? 'Devolver ao cenário' : '', onclick: () => this.gm && net.send({ t: 'lootGive', itemId: s.item.id, lootId: l.id, to: null }) },
            h('span', { class: 'given-face', style: `--c:${holder?.color ?? '#999'}` }, portraitCanvas(holder?.look ?? null, 72)),
            h('span', { class: 'given-t' }, 'Entregue', h('br'), `para ${l.holder}`),
          )
        : this.gm && modo === 'jogar'
          ? h(
              'div',
              { class: 'ic-bts' },
              quemPega
                ? h('button', { class: 'dbtn', title: `${quemPega} pega e guarda na mochila`, onclick: () => (sfx.click(), net.send({ t: 'lootGive', itemId: s.item.id, lootId: l.id, to: quemPega })) }, 'Pegar')
                : null,
              h(
                'button',
                {
                  class: `dbtn${this.giveLoot?.lootId === l.id ? ' on' : ''}`,
                  onclick: () => {
                    sfx.click();
                    this.giveLoot = this.giveLoot?.lootId === l.id ? null : { itemId: s.item.id, lootId: l.id };
                    this.renderInspector();
                  },
                },
                'Entregar',
              ),
            )
          : null;
      const card = h(
        'div',
        {
          class: `icard${this.giveLoot?.lootId === l.id ? ' sel' : ''}${l.revealed || this.gm ? '' : ' dim'}`,
          'data-loot': String(l.id),
          title: 'Clique para inspecionar (ou ler)',
          // inspecionar o item (ou ler o documento): clique fora dos botões
          onclick: (e: Event) => !(e.target as Element).closest('button') && (sfx.paper(), this.inspecionarLoot(l, s)),
        },
        h('div', { class: 'ic-icon' }, lootIcon(l.kind, 52)),
        h('div', { class: 'ic-text' }, h('b', null, l.name), h('small', null, `Espaços: ${fmt(l.espacos)} | ${lootKindLabel(l.kind)}${l.item ? ' · do livro' : ''}`)),
        right,
      );
      if (this.gm && !l.holder && modo === 'config')
        card.append(h('button', { class: 'ic-del', title: 'Remover item', 'aria-label': 'Remover item', onclick: () => net.send({ t: 'lootRemove', itemId: s.item.id, lootId: l.id }) }, '×'));
      pane.append(card);
      if (justGiven && right && !reduced()) {
        right.animate([{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, delay: 650, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
        card.animate([{ boxShadow: '0 0 0 0.3rem rgba(80,160,90,.55)' }, { boxShadow: '0 0 0 0 rgba(80,160,90,0)' }], { duration: 900, delay: 650 });
        setTimeout(() => sfx.pop(), 700);
      }
    });
    if (!loot.length && this.gm && modo === 'jogar') pane.append(h('p', { class: 'empty' }, 'Nada aqui.'));
    if (this.gm && modo === 'config') {
      if (this.addingLoot) {
        // um nome do livro (lista do campo) faz do item o do catálogo: espaços, tipo e, para arma, o ataque
        const name = h('input', { class: 'mini grow', placeholder: 'Nome do item (ou um do livro)', maxlength: 40, list: listaDoCatalogo() }) as HTMLInputElement;
        const weight = h('input', { class: 'mini num', type: 'number', value: '1', step: '0.5', min: '0', max: '10', 'aria-label': 'Espaços' }) as HTMLInputElement;
        const kind = h('select', { class: 'mini', 'aria-label': 'Tipo' }, ...LOOT_KINDS.map((k) => h('option', { value: k.id }, k.label))) as HTMLSelectElement;
        const desc = h('input', { class: 'mini add-desc', placeholder: 'Texto do mestre (opcional)', maxlength: 240 }) as HTMLInputElement;
        name.addEventListener('change', () => {
          const c = doCatalogoPeloNome(name.value);
          if (!c) return;
          weight.value = String(c.espacos);
          kind.value = c.kind;
        });
        const form = h(
          'form',
          {
            class: 'add-row',
            onsubmit: (e: Event) => {
              e.preventDefault();
              if (!name.value.trim()) return;
              const c = doCatalogoPeloNome(name.value);
              const texto = desc.value.trim();
              net.send({ t: 'lootAdd', itemId: s.item.id, name: name.value.trim(), espacos: Number(weight.value) || 0, kind: kind.value as LootKind, ...(c ? { item: { tipo: c.tipo, id: c.id } } : {}), ...(texto ? { descricao: texto } : {}) });
              this.addingLoot = false;
            },
          },
          name,
          h('span', { class: 'mini-l' }, 'Espaços'),
          weight,
          kind,
          h('button', { class: 'dbtn', type: 'submit' }, 'OK'),
          desc,
        );
        pane.append(form);
        enter(form, 'up', 0, 260);
        setTimeout(() => name.focus(), 0);
      } else pane.append(h('button', { class: 'add-item', onclick: () => ((this.addingLoot = true), this.renderInspector()) }, '+ Adicionar item'));
    }
  }

  /** O que é o item do cenário: o texto do mestre (o documento se lê assim), e os números do livro. */
  private inspecionarLoot(l: Loot, s: NonNullable<Sel>) {
    const linhas: Node[] = [];
    const linha = (rot: string, txt: string) => txt && linhas.push(h('p', { class: 'dossier-linha' }, h('b', null, `${rot} `), txt));
    let texto = l.descricao ?? '';
    if (l.item) {
      const it: regras.ItemFicha = { id: l.item.id, tipo: l.item.tipo };
      const inf = infoItem(it, null);
      const base = regras.baseDoItem(it) as { resumo?: string; especial?: string[] } | undefined;
      texto ||= base?.resumo ?? '';
      linha('Do livro:', `${inf.tipo} · categoria ${romano(inf.categoria)}`);
      if (l.item.tipo === 'arma' || l.item.tipo === 'protecao') linha(l.item.tipo === 'arma' ? 'Ataque:' : 'Proteção:', [inf.efeito, inf.obs].filter((x) => x && x !== '—').join(' · '));
      if (base?.especial?.length) linha('Regras:', base.especial.join(' · '));
      if (inf.ref) linha('Livro:', textoRef(inf.ref));
    }
    linha('Espaços:', `${fmt(l.espacos)}${(l.qtd ?? 1) > 1 ? ` (x${l.qtd})` : ''}`);
    linha('Onde está:', s.item.hint?.title || anyFurniName(s.item.defId));
    if (this.gm && !l.revealed) linha('Mestre:', 'os jogadores ainda não sabem deste item.');
    this.hintViewer.abrirItem({ titulo: l.name, rotulo: lootKindLabel(l.kind), icone: lootIcon(l.kind, 26), texto: texto || (['document', 'letter', 'tape'].includes(l.kind) ? 'Não há nada escrito que dê para ler.' : ''), linhas });
  }

  /** Carimbo que bate sobre o cartão e desbota (resultado de um teste). */
  private stampCard(card: HTMLElement, text: string, ok: boolean) {
    const r = card.getBoundingClientRect();
    const st = h('span', { class: `stamp-mark${ok ? ' ok' : ' bad'}` }, text);
    st.style.left = `${r.left + r.width * 0.62}px`;
    st.style.top = `${r.top + r.height / 2}px`;
    fxLayer().append(st);
    stamp(st);
    st.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 1400, fill: 'forwards' }).onfinish = () => st.remove();
  }

  /** "ENTREGAR X PARA:" com a carga de cada personagem. */
  private renderGive() {
    const g = this.giveLoot;
    const s = this.selection();
    const l = g && s && s.item.id === g.itemId ? s.item.loot?.find((x) => x.id === g.lootId) : undefined;
    if (!l || !this.campaign || l.holder) {
      this.closeGive();
      return;
    }
    const key = JSON.stringify([l, this.campaign.party.map((p) => [p.id, p.load, p.capacity, p.color, p.look])]);
    if (this.giveOpen && key === this.giveKey) return;
    const opening = !this.giveOpen;
    this.giveKey = key;
    this.giveOpen = true;
    this.giveWrap.getAnimations().forEach((a) => a.cancel());
    this.giveWrap.classList.remove('hidden');
    if (opening) {
      sfx.paper();
      if (!reduced())
        this.giveWrap.animate([{ transform: 'translateY(3rem) rotate(1.5deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.15)', composite: 'add' });
    }
    const body = clear(this.giveBody);
    body.append(h('h3', { class: 'p-title' }, `ENTREGAR ${l.name.toUpperCase()} PARA:`));
    this.campaign.party.forEach((p, i) => {
      const after = Math.round((p.load + l.espacos) * 10) / 10;
      const over = Math.round((after - p.capacity) * 10) / 10;
      const ratio = p.capacity ? p.load / p.capacity : 1;
      const pct = Math.min(100, ratio * 100);
      const loadEl = h('span', null, `${fmt(p.load)} / ${fmt(p.capacity)}`);
      const fill = h('i', { style: `--w:${pct}%` });
      const bar = h('div', { class: `g-bar ${level(ratio)}`, role: 'meter', 'aria-valuenow': String(p.load), 'aria-valuemax': String(p.capacity), 'aria-label': `Carga de ${p.name}` }, fill);
      const btn = h('button', { class: 'dbtn', onclick: () => void this.deliver(p, l, g!, { row, bar, fill, loadEl, btn }) }, 'Entregar');
      const row = h(
        'div',
        { class: 'grow-row' },
        h('span', { class: 'g-face', style: `--c:${p.color}` }, portraitCanvas(p.look, 104)),
        h('div', { class: 'g-name' }, h('b', null, p.name), loadEl),
        bar,
        h(
          'div',
          { class: `g-after${over > 0 ? ' over' : ''}` },
          h('b', null, `+${fmt(l.espacos)} `, arrow(), ` ${fmt(after)} / ${fmt(p.capacity)}`),
          over > 0 ? h('small', null, warnIcon(), h('u', null, `Excederá o limite em ${fmt(over)}`)) : null,
        ),
        btn,
      );
      body.append(row);
      if (opening) {
        enter(row, 'left', 120 + i * 60, 380);
        if (!reduced()) fill.animate([{ width: '0%' }, { width: `${pct}%` }], { duration: 800, delay: 240 + i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        const warn = row.querySelector('.g-after small');
        if (warn) setTimeout(() => shake(warn, 0.3), 700 + i * 60);
      }
    });
  }

  private closeGive() {
    if (!this.giveOpen) {
      this.giveWrap.classList.add('hidden');
      return;
    }
    this.giveOpen = false;
    this.giveKey = '';
    if (reduced()) return this.giveWrap.classList.add('hidden');
    const a = this.giveWrap.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(2.4rem) rotate(1deg)', opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards', composite: 'add' });
    a.onfinish = () => {
      if (this.giveOpen) return;
      this.giveWrap.classList.add('hidden');
      a.cancel();
    };
  }

  /** Entrega: a barra enche, os números contam, o item voa até o retrato. */
  private async deliver(p: PartyMember, l: Loot, g: { itemId: number; lootId: number }, ui: { row: HTMLElement; bar: HTMLElement; fill: HTMLElement; loadEl: HTMLElement; btn: HTMLElement }) {
    if (this.delivering) return;
    this.delivering = true;
    try {
      const after = Math.round((p.load + l.espacos) * 10) / 10;
      const over = after > p.capacity;
      sfx.click();
      this.giveBody.querySelectorAll('.dbtn').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      ui.row.classList.add('giving');
      const pct = Math.min(100, (after / p.capacity) * 100);
      if (!reduced()) ui.fill.animate([{ width: getComputedStyle(ui.fill).width }, { width: `${pct}%` }], { duration: 480, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
      ui.bar.className = `g-bar ${level(after / p.capacity)}`;
      countUp(ui.loadEl, p.load, after, 480, (v) => `${fmt(v)} / ${fmt(p.capacity)}`);
      if (over) setTimeout(() => shake(ui.bar, 0.4), 420);
      await wait(reduced() ? 0 : 520);
      // voa do ícone do item no inspetor até o retrato
      const src = this.inspBody.querySelector<HTMLElement>(`[data-loot="${l.id}"] .ic-icon`) ?? ui.btn;
      const from = src.getBoundingClientRect();
      const card = this.cards.get(p.id ?? 0)?.el;
      this.app.net.send({ t: 'lootGive', itemId: g.itemId, lootId: l.id, to: p.name });
      this.giveLoot = null;
      if (card) {
        const to = card.getBoundingClientRect();
        await flyArc(lootIcon(l.kind, 52), from, to);
        bump(card, 1.07, 1.4);
        floatText(card, `+${fmt(l.espacos)}`, over ? '#ff6a5c' : '#8fe39a');
      }
    } finally {
      this.delivering = false;
    }
  }

  /** O painel PERSONAGEM: só os comandos do tabuleiro (PV, PE, SAN e a mochila ficam em PLAYERS e ITENS, à direita). */
  private renderTokenInspector(body: HTMLElement, id: number) {
    const view = this.app.view;
    const u = view.users.get(id)!;
    const p = this.campaign?.party.find((x) => x.id === id);
    const color = p?.color ?? u.color;
    const net = this.app.net;
    const ficha = this.fichasMapa.find((f) => f.personagem && f.personagem === u.look.charId);
    const map = view.map;
    const active = view.myId === id;
    body.append(
      h(
        'div',
        { class: 'insp-head' },
        this.polaroid(this.livePortrait(u.look, 262, p)),
        this.headText(u.name.toUpperCase(), active ? 'Sob seu comando: clique no chão para andar.' : 'Clique em Comandar (ou no retrato) para mover esta peça.' + (this.gm ? ' Q e E giram.' : '')),
      ),
    );
    const tool = (label: string, fn: () => void, title?: string) => h('button', { class: 'tool', title, onclick: () => (sfx.click(), fn()) }, label);
    const grupo = (nome: string, ...bts: (HTMLElement | null)[]) => {
      const lista = bts.filter((b): b is HTMLElement => !!b);
      return lista.length ? h('div', { class: 'tk-grupo' }, h('span', { class: 'tk-rot' }, nome), h('div', { class: 'tools' }, ...lista)) : null;
    };
    // a peça é uma criatura do bestiário: trocar a aparência (as outras peças da mesma criatura continuam como estão)
    const cr = u.criatura ? this.app.state.bestiario.find((c) => c.id === u.criatura!.id) : undefined;
    if (u.criatura && !cr) this.app.net.send({ t: 'bestiario' });
    const blocos = [
      cr && this.gm && cr.aparencias.length > 1
        ? grupo(
            'Aparência',
            ...cr.aparencias.map((a) => this.stateTool(a.nome, u.criatura?.aparencia === a.id, `${cr.nome}: a aparência ${a.nome} (a ficha é a mesma)`, () => net.send({ t: 'pecaAparencia', tokenId: id, aparencia: a.id }))),
          )
        : null,
      grupo(
        'Mover',
        active ? null : tool('Comandar', () => view.setActive(id), 'Os cliques no chão passam a mover esta peça'),
        tool('Centralizar', () => view.focusUser(id), 'A câmera vai até a peça'),
        this.gm ? h('button', { class: 'tool', title: 'Girar para a esquerda (Q)', onclick: () => this.turnToken(id, false) }, '↺ Girar') : null,
        this.gm ? h('button', { class: 'tool', title: 'Girar para a direita (E)', onclick: () => this.turnToken(id, true) }, 'Girar ↻') : null,
      ),
      this.gm && cr?.passoSombras
        ? grupo(
            'Sombras',
            tool('Passo', () => this.passoPelasSombras(id), `${cr.nome} some numa sombra e sai de outra que você escolhe (Onipresença, LR p. 252)`),
            this.stateTool('Marcar', view.marcandoSombra, 'Marca ou desmarca uma sombra à mão no chão (além das casas escuras de luz)', () => this.marcarSombras()),
          )
        : null,
      this.gm
        ? grupo(
            'Postura',
            this.stateTool('Armado', !!p?.armed, ficha ? 'Vem da mão: empunha a arma da mochila ou guarda as armas' : 'Com a arma na mão (retrato armado)', () => net.send({ t: 'tokenEdit', tokenId: id, armed: !p?.armed })),
            this.stateTool('Agachado', !!u.agachado, 'De cócoras (furtivo, atrás de um móvel): o corpo tem 1,0 m e um móvel mais baixo já dá cobertura', () => net.send({ t: 'tokenEdit', tokenId: id, agachado: !u.agachado })),
            map?.leitoItem(u.x, u.y) ? this.stateTool('Cama de cima', !!u.alto, 'Escalar o beliche: sobe pela escadinha para a cama de cima (e desce de volta)', () => net.send({ t: 'tokenEdit', tokenId: id, alto: !u.alto })) : null,
          )
        : null,
      this.gm
        ? grupo(
            'Peça',
            ficha ? tool('Mochila', () => (sfx.paper(), this.abrirItens(id)), 'Abre a mochila na aba ITENS') : null,
            tool('Editar', () => this.tokenWin.open({ id, name: u.name, look: u.look, color, capacity: p?.capacity ?? 10 }), 'Nome, aparência, cor e carga'),
            tool('Remover', async () => (await askNote(`TIRAR ${u.name.toUpperCase()}?`, `${u.name} sai do tabuleiro. Os itens que carrega continuam registrados.`, 'Tirar do tabuleiro', true)) && net.send({ t: 'tokenRemove', tokenId: id }), 'Tira a peça do tabuleiro'),
          )
        : null,
    ];
    for (const b of blocos) if (b) body.append(b);
    if (this.gm) {
      const sc = h('select', { class: 'tool-sel', 'aria-label': 'Levar para outra cena' }, h('option', { value: '' }, 'Levar para outra cena…'), ...this.sceneList().filter((r) => r.id !== this.app.state.room?.id).map((r) => h('option', { value: String(r.id) }, r.name)));
      sc.addEventListener('change', () => sc.value && net.send({ t: 'tokenScene', tokenId: id, roomId: Number(sc.value) }));
      body.append(h('div', { class: 'tk-grupo' }, h('span', { class: 'tk-rot' }, 'Cena'), sc));
    }
  }

  /** O passo pelas sombras (Magistrada): as sombras se acendem e o clique numa delas leva a peça para lá. */
  private passoPelasSombras(id: number) {
    const view = this.app.view;
    view.marcandoSombra = false;
    view.escolherSombra(
      id,
      (x, y) => this.app.net.send({ t: 'passoSombras', tokenId: id, x, y }),
      () => undefined,
    );
  }

  /** Liga e desliga o marcar sombras à mão: o clique numa casa marca ou desmarca. */
  private marcarSombras() {
    const view = this.app.view;
    view.cancelarSombra();
    view.marcandoSombra = !view.marcandoSombra;
    view.aoMarcarSombra = (x, y, marcada) => this.app.net.send({ t: 'sombraMarcar', x, y, marcada });
    this.renderInspector(true);
  }

  /** Abre a aba ITENS na mochila do agente (id da peça). */
  private abrirItens(id: number) {
    this.abaItens.escolher(id);
    this.rpgTab = 'ITENS';
    this.renderRpg(true);
  }

  /** Botão que liga/desliga um estado do personagem (Armado, Machucado). */
  private stateTool(label: string, on: boolean, title: string, fn: () => void) {
    return h('button', { class: `tool state${on ? ' on' : ''}`, title, 'aria-pressed': String(on), onclick: () => (sfx.click(), fn()) }, on ? `✓ ${label}` : label);
  }

  /** Retrato que respira e pisca, olhando para a direita, no estado atual do personagem (pela ficha). */
  private livePortrait(look: PartyMember['look'], size: number, p?: PartyMember) {
    const c = vitalConditions(p?.vitals);
    return livePortrait(look, size, { dir: 2, armed: !!p?.armed, hurt: c.machucado, breath: breathMode(c) });
  }

  /** O que muda o retrato de uma carta: aparência, arma, condições da ficha e as imagens do personagem. */
  private portraitKey(p: PartyMember) {
    const c = vitalConditions(p.vitals);
    return JSON.stringify([p.look, !!p.armed, c.machucado, breathMode(c), sprites.def(p.look?.charId)?.portraits ?? null]);
  }

  /** Barrinhas da carta: PV, PE e SAN atuais (cheias, pela metade, zeradas). */
  private cardVitals(el: HTMLElement, p: PartyMember) {
    const v = p.vitals ?? DEFAULT_VITALS;
    const c = vitalConditions(p.vitals);
    const low: Record<VitalKey, boolean> = { pv: c.machucado, pe: c.cansado, san: c.perturbado };
    // já tem as três barrinhas: acerta no lugar (recriar a cada ponto de vida piscava a carta)
    const feitas = el.querySelectorAll<HTMLElement>(':scope > .pcv');
    if (feitas.length === VITAL_KEYS.length) {
      VITAL_KEYS.forEach((k, i) => {
        const cur = v[k];
        const max = v[`${k}Max`];
        const row = feitas[i];
        row.className = `pcv ${k}${low[k] ? ' low' : ''}${cur <= 0 ? ' zero' : ''}`;
        row.title = `${VITAL_NAME[k]}: ${cur} de ${max}`;
        row.querySelector<HTMLElement>('.pcv-bar > i')?.style.setProperty('--w', `${Math.max(0, Math.min(100, (cur / max) * 100))}%`);
        const em = row.querySelector('em');
        if (em && em.textContent !== String(cur)) em.textContent = String(cur);
      });
      return;
    }
    const rows = VITAL_KEYS.map((k) => {
      const cur = v[k];
      const max = v[`${k}Max`];
      const w = Math.max(0, Math.min(100, (cur / max) * 100));
      return h(
        'span',
        { class: `pcv ${k}${low[k] ? ' low' : ''}${cur <= 0 ? ' zero' : ''}`, title: `${VITAL_NAME[k]}: ${cur} de ${max}` },
        h('b', null, VITAL_LABEL[k]),
        h('span', { class: 'pcv-bar' }, h('i', { style: `--w:${w}%` })),
        h('em', null, String(cur)),
      );
    });
    clear(el).append(...rows);
  }

  /** Barras da carta de PLAYERS: PV, PE e SAN com − e + (Shift: de 5 em 5); clicar na barra muda o total. */
  private vitaisCarta(id: number, p: PartyMember) {
    const net = this.app.net;
    // o agente de agora: os botões e o total leem daqui, para a carta mudar sem ser refeita
    const atual = { p };
    const wrap = h('div', { class: 'rp-vit' }) as VitaisVivos;
    const linhas: { k: VitalKey; num: HTMLElement; max: HTMLElement; barra: HTMLElement; fill: HTMLElement }[] = [];
    const v0 = p.vitals ?? DEFAULT_VITALS;
    for (const k of VITAL_KEYS) {
      const cur = v0[k];
      const max = v0[`${k}Max`];
      const w = Math.max(0, Math.min(100, (cur / max) * 100));
      const change = (delta: number) => (e: MouseEvent) => {
        sfx.click();
        net.send({ t: 'vitals', tokenId: id, key: k, delta: e.shiftKey ? delta * 5 : delta });
      };
      const total = async () => {
        if (!this.gm) return;
        const m = (atual.p.vitals ?? DEFAULT_VITALS)[`${k}Max`];
        const r = await promptNote(`${VITAL_NAME[k].toUpperCase()} DE ${atual.p.name.toUpperCase()}`, [{ label: 'Total', value: String(m), max: 3 }]);
        const n = r ? Number(r[0]) : NaN;
        if (Number.isFinite(n) && n >= 1) net.send({ t: 'vitals', tokenId: id, key: k, max: n });
      };
      const num = h('strong', null, String(cur));
      const maxEl = h('small', null, `/${max}`);
      const fill = h('i', { style: `width:${w}%` });
      const barra = h('button', { class: `rp-bar ${k}`, title: this.gm ? 'Clique para mudar o total' : VITAL_NAME[k], 'aria-label': `${VITAL_NAME[k]} ${cur} de ${max}`, onclick: () => void total() }, fill);
      wrap.append(
        h(
          'div',
          { class: `rp-l ${k}` },
          h('b', { title: VITAL_NAME[k] }, VITAL_LABEL[k]),
          // o número fora da barra, como no celular
          h('span', { class: 'rp-n' }, num, maxEl),
          this.gm ? h('button', { class: 'rp-q', title: `Tirar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Tirar ${VITAL_NAME[k]}`, onclick: change(-1) }, ic('menos')) : h('span'),
          barra,
          this.gm ? h('button', { class: 'rp-q', title: `Dar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Dar ${VITAL_NAME[k]}`, onclick: change(1) }, ic('mais')) : h('span'),
        ),
      );
      linhas.push({ k, num, max: maxEl, barra, fill });
    }
    // as condições do agente: as que saem sozinhas pelo PV e pela SAN e as que o mestre marca (na ficha).
    // Ficam aqui e no celular do jogador; a FICHAS do mestre é só a das regras. O bloco só se refaz quando elas mudam.
    const conds = h('div', { style: 'display:contents' });
    let chave = '';
    const pintaConds = (q: PartyMember) => {
      const labels = conditionLabels(vitalConditions(q.vitals));
      const ficha = this.fichasMapa.find((f) => f.personagem !== undefined && f.personagem === q.look?.charId);
      const marcadas = (ficha?.condicoes ?? []).map((c) => regras.catalogo.condicao(c)?.nome ?? c);
      const k = JSON.stringify([labels, marcadas, !!ficha, this.gm]);
      if (k === chave) return;
      chave = k;
      conds.replaceChildren(
        ...(labels.length || marcadas.length || (this.gm && ficha)
          ? [
              h(
                'div',
                { class: 'vt-conds' },
                ...labels.map((l) => h('span', { class: 'vt-cond' }, l)),
                ...marcadas.map((l) => h('span', { class: 'vt-cond marcada' }, l)),
                this.gm && ficha ? h('button', { class: 'vt-cond mais', type: 'button', title: 'Condições', 'aria-label': `Condições de ${q.name}`, onclick: () => this.escolherCondicoes(ficha) }, ic('mais'), marcadas.length ? null : h('span', null, 'Condição')) : null,
              ),
            ]
          : []),
      );
    };
    pintaConds(p);
    wrap.append(conds);
    // acerta os números e as barras no lugar (nada é recriado: o painel não pisca)
    wrap.atualizar = (q) => {
      atual.p = q;
      const v = q.vitals ?? DEFAULT_VITALS;
      for (const l of linhas) {
        const cur = v[l.k];
        const max = v[`${l.k}Max`];
        const t = String(cur);
        if (l.num.textContent !== t) l.num.textContent = t;
        const mt = `/${max}`;
        if (l.max.textContent !== mt) l.max.textContent = mt;
        l.fill.style.width = `${Math.max(0, Math.min(100, (cur / max) * 100))}%`;
        l.barra.setAttribute('aria-label', `${VITAL_NAME[l.k]} ${cur} de ${max}`);
      }
      pintaConds(q);
    };
    return wrap;
  }

  /** As condições do livro para marcar no agente (as automáticas saem sozinhas pelo PV e pela SAN). */
  private escolherCondicoes(ficha: FichaSalva) {
    const AUTO = ['machucado', 'morrendo', 'perturbado', 'enlouquecendo'];
    void escolher(
      {
        titulo: `Condições de ${ficha.nome}`,
        dica: 'Machucado, morrendo, perturbado e enlouquecendo saem sozinhos pelo PV e pela SAN (LR p. 310–311).',
        qtd: 40,
        podeVazio: true,
        opcoes: () =>
          regras.catalogo.CATALOGO.condicoes.map((x) => ({
            id: x.id,
            nome: x.nome,
            ref: x.ref,
            resumo: x.resumo,
            ok: !x.automatica,
            motivos: x.automatica ? ['Sai sozinha pela ficha.'] : [],
            avisos: x.inclui?.length ? [`Inclui: ${x.inclui.map((i) => regras.catalogo.condicao(i)?.nome ?? i).join(', ')}.`] : [],
          })),
        atual: () => ficha.condicoes ?? [],
        aplicar: (ids) => {
          const nova: FichaSalva = { ...ficha, condicoes: ids.filter((i) => !AUTO.includes(i)), atualizadaEm: new Date().toISOString() };
          if (!nova.condicoes?.length) delete nova.condicoes;
          this.app.net.send({ t: 'fichaSalvar', ficha: nova });
        },
      },
      () => this.renderRpg(true),
    );
  }

  /** Cartão da sala (esquerda): a foto, o nome, a descrição e o andar. */
  private renderSala() {
    const r = this.app.state.room;
    const cena = this.campaign?.scenes.find((x) => x.id === r?.id);
    const url = r ? loadThumb(r.id) : null;
    const nome = (r?.name.split('·').pop()?.trim() ?? 'Cena').toUpperCase();
    const sig = JSON.stringify([r?.id, r?.name, r?.description, cena?.floor, r?.area, !!url, this.campaign?.scenes.length, r?.mapa, this.gm]);
    if (sig === this.salaSig) return;
    this.salaSig = sig;
    clear(this.salaCorpo).append(
      this.polaroid(url ? h('img', { src: url, alt: '', 'data-room': String(r!.id) }) : h('span', { class: 'thumb-ph', 'data-room': String(r?.id ?? 0) })),
      h(
        'div',
        { class: 'sala-txt' },
        h('h3', { class: 'marca' }, nome),
        h('p', null, r?.description || 'Clique num objeto do cenário para ver descrição, interações e itens.'),
        h(
          'div',
          { class: 'sala-chips' },
          h('span', null, ic('pino'), (cena?.floor ?? 'Andar único').toUpperCase()),
          h('span', null, ic('camadas'), r?.area ? r.area.toUpperCase() : `${this.campaign?.scenes.length ?? 1} CÔMODOS`),
          // o quarto (de hotel, de pousada): a condição do descanso de quem dorme aqui (LR p. 92)
          r?.descanso ? h('span', { title: 'Condição do descanso no interlúdio (LR p. 92)' }, ic('estrela'), `CONDIÇÃO ${regras.LUGARES_DESCANSO.find((l) => l.id === r.descanso)?.nome.toUpperCase()}`) : null,
        ),
        // o mapa improvisado (a imagem que o mestre subiu) se apaga daqui; quem estiver nele volta
        r?.mapa && this.gm
          ? h('button', { class: 'sala-apagar', type: 'button', onclick: () => void this.apagarMapa(r.id, nome) }, ic('lixo'), h('span', null, 'Apagar este mapa'))
          : null,
      ),
    );
  }

  private async apagarMapa(roomId: number, nome: string) {
    if (!(await askNote('Apagar o mapa', `O mapa improvisado "${nome}" some, e quem estiver nele volta para a cena ligada.`, 'Apagar', true))) return;
    this.app.net.send({ t: 'mapaApagar', roomId });
  }

  /** O agente comandado que vai jogar, se o objeto for um jogo do bar (o fliperama, o alvo, a sinuca; só o mestre). */
  private jogador(kind: string, defId: string): string | null {
    const id = this.app.view.myId;
    if (!this.gm || !id || !bar.jogoDoBar(defId) || (kind !== 'floor' && kind !== 'wall')) return null;
    return this.app.view.users.get(id)?.name ?? null;
  }

  /** Usar um objeto: liga e desliga; um jogo do bar, com um agente escolhido, leva o agente para jogar. */
  private usar(kind: string, id: number, defId: string) {
    if (this.jogador(kind, defId)) this.app.net.send({ t: 'barJogar', tokenId: this.app.view.myId, itemId: id });
    else this.app.net.send({ t: 'use', id, tokenId: this.app.view.myId || undefined });
  }

  /** AÇÕES sobre o objeto escolhido: examinar, abrir, usar e entregar. */
  private renderAcoes() {
    const s = this.selection();
    const it = s?.item;
    const fdef = s?.kind === 'floor' ? getFurni(it!.defId) : undefined;
    const wdef = s?.kind === 'wall' ? getWallFurni(it!.defId) : undefined;
    const temPista = !!it?.hint && (it.hint.visible || this.gm);
    const livres = (it?.loot ?? []).filter((l) => !l.holder).length;
    const lock = s?.kind === 'floor' ? (it as FloorItem).lock : undefined;
    const porta = fdef?.openState !== undefined;
    const usa = (fdef?.states ?? wdef?.states ?? 0) >= 2;
    const abrir = !!s && (porta || !!lock || livres > 0 || (it?.loot?.length ?? 0) > 0);
    const acoes: { id: string; rotulo: string; icone: string; ok: boolean; fazer: () => void; dica: string }[] = [
      {
        id: 'examinar',
        rotulo: 'Examinar',
        icone: 'lupa',
        ok: !!s,
        dica: temPista ? 'Ver a pista' : 'Ver a descrição',
        fazer: () => {
          if (!s) return;
          if (temPista) this.hintViewer.open(s.kind, it!.id);
          else ((this.inspTab = 'desc'), this.renderInspector(true));
        },
      },
      {
        id: 'abrir',
        rotulo: 'Abrir',
        icone: 'caixa',
        ok: abrir,
        dica: porta
          ? fdef?.portal
            ? (['Fechar a porta', 'Abrir a porta'][(it as FloorItem).state] ?? 'Abrir ou fechar')
            : 'Abrir ou fechar'
          : lock?.semSenha
            ? lock.open
              ? 'Cobrir a passagem de novo'
              : 'Empurrar e ver o que esconde'
            : lock
              ? 'Senha da passagem'
              : 'Ver o que tem dentro',
        fazer: () => {
          if (!s) return;
          if (lock?.semSenha) this.app.net.send({ t: 'use', id: it!.id });
          // trancada, a peça comandada vai até a porta tentar abrir
          else if (porta && !lock) this.app.net.send({ t: 'use', id: it!.id, tokenId: this.app.view.myId || undefined });
          else if (lock && this.abrirTeclado(it as FloorItem)) return;
          else ((this.inspTab = lock ? 'desc' : 'items'), this.renderInspector(true));
        },
      },
      { id: 'usar', rotulo: s && this.jogador(s.kind, it!.defId) ? 'Jogar' : 'Usar', icone: 'mao', ok: !!s && (usa || !!this.jogador(s.kind, it!.defId)), dica: s && this.jogador(s.kind, it!.defId) ? `${this.jogador(s.kind, it!.defId)} vai até o jogo e ele abre quando chegar (de novo: sai do jogo)` : 'Ligar, acender, abrir a gaveta…', fazer: () => s && this.usar(s.kind, it!.id, it!.defId) },
      { id: 'entregar', rotulo: 'Entregar', icone: 'trocar', ok: livres > 0 && this.gm, dica: 'Entregar um item daqui a um personagem', fazer: () => ((this.inspTab = 'items'), this.renderInspector(true)) },
    ];
    if (!acoes.find((a) => a.id === this.acaoAtiva)?.ok) this.acaoAtiva = acoes.find((a) => a.ok)?.id ?? 'examinar';
    clear(this.acoesEl).append(
      ...acoes.map((a) =>
        h(
          'button',
          {
            class: `acao${a.id === this.acaoAtiva && a.ok ? ' on' : ''}`,
            type: 'button',
            disabled: !a.ok,
            title: a.ok ? a.dica : 'Escolha um objeto no tabuleiro',
            onclick: () => {
              sfx.click();
              this.acaoAtiva = a.id;
              a.fazer();
              this.renderAcoes();
            },
          },
          // o ícone pintado do kit quando há um parecido (o resto fica com o de linha)
          PINTADO_ACAO[a.icone] ? arteOu([`/arte/icones/${PINTADO_ACAO[a.icone]}.png`], ic(a.icone as NomeIcone)) : ic(a.icone as NomeIcone),
          h('span', null, a.rotulo),
        ),
      ),
    );
  }

  /** Gira a peça parada para o próximo ângulo que a folha dela tem (cw = sentido horário na tela). */
  turnToken(viewId: number, cw: boolean) {
    const u = this.app.view.users.get(viewId);
    if (!u) return;
    if (!this.gm) return toast('Só o mestre gira os personagens. Abra o link do mestre (aparece no terminal do servidor).', 'error');
    const def = sprites.def(u.look.charId);
    // folha de 4 direções: só as 4 poses; de 8 ou avatar pixel: as 8. As poses do tabuleiro (a pasta tabuleiro-32bits)
    // também contam: a Camarilla tem a folha antiga de 2 direções e as 8 poses novas (17/10)
    const temPose = (k: string) => Object.values(def?.poses ?? {}).some((dirs) => !!(dirs as Record<string, unknown> | undefined)?.[k]);
    const allowed = def ? distinctFacings((k) => temPose(k) || def.dirs.some((d, i) => d === k && (def.anims?.[i] ?? 'idle') === 'idle')) : [];
    // cliques seguidos contam a partir do último pedido, não do que o servidor já confirmou
    const now = performance.now();
    const goal = this.turnGoal.get(viewId);
    const base = goal && now - goal.at < 800 ? goal.dir : u.dir;
    const next = turnFacing(base, cw, allowed);
    if (next === base) return;
    this.turnGoal.set(viewId, { dir: next, at: now });
    sfx.click();
    this.app.session.faceToken(-viewId, next);
  }

  // ================= baixo =================
  /** O painel AGENTES de baixo mostra sempre todos os agentes do jogo (em qualquer lugar); o da direita, só os do lugar. */
  private agentesDoJogo(): PartyMember[] {
    return this.campaign?.agentes ?? this.campaign?.party ?? [];
  }

  private renderParty() {
    const party = this.agentesDoJogo();
    const view = this.app.view;
    const cur = this.app.state.room?.id;
    if (!this.changed('party', [party, cur, view.myId, this.gm])) return;
    this.partyEl.style.setProperty('--n', String(Math.max(4, party.length)));
    const ids = new Set(party.map((p) => p.id ?? 0));
    for (const [id, c] of this.cards)
      if (!ids.has(id)) {
        this.cards.delete(id);
        void leave(c.el, 'down');
      }
    party.forEach((p, i) => {
      const id = p.id ?? 0;
      let c = this.cards.get(id);
      if (!c) {
        c = this.makeCard(p, i);
        this.cards.set(id, c);
        enter(c.el, 'up', this.intro(300 + i * 80), 560);
      }
      const look = this.portraitKey(p);
      if (c.look !== look) {
        clear(c.img).append(this.livePortrait(p.look, this.cardPortraitSize(), p));
        c.look = look;
      }
      const vk = JSON.stringify(p.vitals ?? null);
      if (c.vitalsKey !== vk) {
        this.cardVitals(c.vitals, p);
        c.vitalsKey = vk;
      }
      c.el.classList.toggle('hurt', vitalConditions(p.vitals).machucado);
      if (c.color !== p.color) {
        c.color = p.color;
        c.el.style.setProperty('--c', p.color);
        paperize(c.el, { kit: false, seed: 60 + i * 3, tone: '#cfb99f', burn: 0.72, stripe: p.color, torn: 1.8, backs: [{ dx: 3, dy: 3, rot: 1.8 }, { dx: -3, dy: 5, rot: -1.3 }], pad: 22 });
      }
      // na carta cabe o nome curto (como na referência: Catarina, Alosi)
      const curto = p.name.split(/\s+/)[0];
      if (c.name.textContent !== curto) c.name.textContent = curto;
      if (c.name.title !== p.name) c.name.title = p.name;
      const here = p.roomId === cur;
      const wasOn = c.el.classList.contains('on');
      c.el.classList.toggle('on', view.myId === id);
      c.el.classList.toggle('away', !here);
      const longe = here ? '' : this.sceneName(p.roomId);
      if (c.away.textContent !== longe) c.away.textContent = longe;
      c.away.classList.toggle('hidden', here);
      c.el.title = here ? `${p.name} (tecla ${i + 1})` : `${p.name} — em ${this.sceneName(p.roomId)}`;
      if (!wasOn && view.myId === id && this.cards.size && performance.now() - this.shownAt > 1500) bump(c.el, 1.04, 0.8);
      const at = this.partyEl.children[i];
      if (at !== c.el) this.partyEl.insertBefore(c.el, at ?? null);
    });
    if (this.gm && this.campaign && !party.length) {
      if (!this.addCard) {
        this.addCard = h('button', { class: 'pcard add', title: 'Novo personagem', onclick: () => this.tokenWin.open() }, h('span', { class: 'plus' }, '+'), h('span', null, 'Personagem'));
        this.partyEl.append(this.addCard);
        enter(this.addCard, 'up', 0, 400);
      }
    } else if (this.addCard) {
      this.addCard.remove();
      this.addCard = null;
    }
  }

  /** O elemento do agente (o tema da ficha dele): Sangue, Morte, Conhecimento, Energia ou a Ordem. */
  private temaDe(p: PartyMember | undefined): string {
    return this.fichasMapa.find((f) => f.personagem !== undefined && f.personagem === p?.look?.charId)?.tema ?? 'ordem';
  }

  private makeCard(p: PartyMember, i: number): Card {
    const id = p.id ?? 0;
    const img = h('span', { class: 'pc-img' }, this.livePortrait(p.look, this.cardPortraitSize(), p));
    // na plaquinha da carta, o primeiro nome (o inteiro no title)
    const name = h('span', { class: 'pc-name', title: p.name }, p.name.split(/\s+/)[0]);
    const vitals = h('span', { class: 'pc-vitals' });
    this.cardVitals(vitals, p);
    const away = h('span', { class: 'pc-away hidden' });
    const el = h(
      'button',
      {
        class: 'pcard',
        style: `--c:${p.color};--r:${[-1.2, 0.8, -0.5, 1.1, -0.9, 0.6][i % 6]}deg`,
        'data-tema': this.temaDe(p),
        'data-token': String(id),
        onclick: () => this.pickCard(id),
      },
      h('span', { class: 'pc-photo' }, img, h('i', { class: 'pc-corner k1' }), h('i', { class: 'pc-corner k2' }), h('i', { class: 'pc-corner k3' }), h('i', { class: 'pc-corner k4' })),
      name,
      vitals,
      away,
      h('i', { class: 'pc-glow', 'aria-hidden': 'true' }),
      h('i', { class: 'pc-glare', 'aria-hidden': 'true' }),
    );
    paperize(el, { kit: false, seed: 60 + i * 3, tone: '#cfb99f', burn: 0.72, stripe: p.color, torn: 1.8, backs: [{ dx: 3, dy: 3, rot: 1.8 }, { dx: -3, dy: 5, rot: -1.3 }], pad: 22 });
    tilt(el);
    return { el, img, name, away, look: this.portraitKey(p), color: p.color, vitals, vitalsKey: JSON.stringify(p.vitals ?? null) };
  }

  /** Tamanho do retrato na carta, em px de tela (o canvas não precisa ser encolhido pelo navegador). */
  private cardPortraitSize() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    return Math.max(64, Math.round(12.5 * 0.8 * rem));
  }

  private pickCard(id: number) {
    const p = this.agentesDoJogo().find((x) => x.id === id) ?? this.campaign?.party.find((x) => x.id === id);
    if (!p || !p.id) return;
    const view = this.app.view;
    sfx.click();
    if (p.roomId === this.app.state.room?.id) {
      view.setActive(p.id);
      view.focusUser(p.id);
    } else if (p.roomId) {
      this.app.pendingActive = p.id;
      this.app.net.send({ t: 'join', roomId: p.roomId });
    }
  }

  /** Retrato balança enquanto a peça anda no tabuleiro. */
  private markWalking() {
    const now = performance.now();
    for (const [id, c] of this.cards) {
      const u = this.app.view.users.get(id);
      const walking = !!u?.anim && now - u.anim.start < 620;
      if (c.el.classList.contains('walking') !== walking) c.el.classList.toggle('walking', walking);
    }
  }

  private renderQuick() {
    const map = this.app.view.map;
    const list: { l: Loot; kind: 'floor' | 'wall'; id: number }[] = [];
    if (map) {
      for (const it of map.allItems()) for (const l of it.loot ?? []) if (!l.holder) list.push({ l, kind: 'floor', id: it.id });
      for (const it of map.allWallItems()) for (const l of it.loot ?? []) if (!l.holder) list.push({ l, kind: 'wall', id: it.id });
    }
    // agrupados por tipo: armas, documentos, chaves, cartas, consumíveis, mídia, caixas
    const order = LOOT_KINDS.map((k) => k.id);
    list.sort((a, b) => order.indexOf(a.l.kind) - order.indexOf(b.l.kind));
    this.slots.forEach((slot, i) => {
      const s = list[i];
      // a última casa mostra quantos sobram (+N) quando não cabe tudo
      const ultima = this.slots.length - 1;
      const more = i === ultima && list.length > this.slots.length ? list.length - ultima : 0;
      const key = s ? `${s.kind}${s.id}:${s.l.id}:${s.l.name}:${more}` : '';
      if (key === slot.key) return;
      const had = slot.key !== '';
      slot.key = key;
      const el = slot.el;
      el.dataset.kind = s?.kind ?? '';
      el.dataset.item = s ? String(s.id) : '';
      el.disabled = !s;
      el.classList.toggle('empty', !s);
      el.title = s ? `${s.l.name} (${lootKindLabel(s.l.kind)})` : '';
      clear(el);
      if (!s) return;
      // a arte do item, a mesma do chão e da mochila (a pintada, o ícone e, sem arte, o desenho do tipo)
      const ic = arteDoItem(lootParaItem(s.l), 'caixa', 'q-arte');
      el.append(ic, h('span', { class: 'q-tag', 'aria-hidden': 'true' }, h('b', null, s.l.name), h('small', null, `${fmt(s.l.espacos)} esp.`)));
      if (more) el.append(h('b', { class: 'q-more' }, `+${more}`));
      if (!reduced()) {
        const d = this.intro(520 + i * 50);
        ic.animate([{ transform: 'scale(0.2) rotate(-40deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(6deg)', opacity: 1, offset: 0.65 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], {
          duration: 460,
          delay: d,
          easing: 'cubic-bezier(.3,.7,.3,1)',
          fill: 'backwards',
        });
        if (had || d === 0) setTimeout(() => sfx.pop(), d);
      }
    });
  }

  private pickSlot(i: number) {
    const el = this.slots[i].el;
    const kind = el.dataset.kind as 'floor' | 'wall' | '';
    const id = Number(el.dataset.item);
    if (!kind || !id) return;
    sfx.click();
    bump(el, 1.05, 0.3);
    this.app.view.focusItem(kind, id);
    this.app.view.select({ kind, id });
    this.inspTab = 'items';
    this.renderInspector(true);
  }

  private renderLog() {
    if (!this.campaign) return;
    const log = [...this.campaign.log].reverse();
    if (!this.changed('log', log)) return;
    const keys = log.map((e) => `${e.at}|${e.text}`);
    const want = new Set(keys);
    for (const [k, row] of this.logRows)
      if (!want.has(k)) {
        this.logRows.delete(k);
        row.remove();
      }
    this.logEl.querySelector('.empty')?.remove();
    if (!log.length) this.logEl.append(h('p', { class: 'empty' }, 'Nada ainda nesta sessão.'));
    log.forEach((e, i) => {
      const k = keys[i];
      let row = this.logRows.get(k);
      const isNew = !row;
      if (!row) {
        const t = new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        row = h('div', { class: 'log-line' }, h('time', null, t), h('span', { class: 'lg-ic' }, logIcon(e.icon, 15)), h('span', { class: 'lg-t' }, e.text));
        this.logRows.set(k, row);
      }
      const at = this.logEl.children[i];
      if (at !== row) this.logEl.insertBefore(row, at ?? null);
      if (isNew && this.logReady && i === 0) this.animateLogLine(row, e.text);
      else if (isNew && !this.logReady) enter(row, 'up', this.intro(560 + i * 70), 420);
    });
    this.logReady = true;
  }

  /** Linha nova: abre espaço, carimba a hora e datilografa o texto. */
  private animateLogLine(row: HTMLElement, text: string) {
    if (reduced()) return;
    row.animate([{ height: '0px', opacity: 0 }, { height: getComputedStyle(row).height, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    stamp(row.querySelector('time')!, 200);
    row.querySelector('.lg-ic')?.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 380, delay: 320, easing: 'ease-out', fill: 'backwards' });
    const t = row.querySelector<HTMLElement>('.lg-t')!;
    setTimeout(() => typeInto(t, text, 700), 380);
    row.animate([{ background: 'rgba(200,53,43,.18)' }, { background: 'rgba(200,53,43,0)' }], { duration: 1600, delay: 300, fill: 'backwards' });
  }

  private sceneName(id: number | null) {
    // o agente pode estar em outro lugar do mapa (outra campanha): vale a lista de todas as cenas
    const s = this.sceneList().find((x) => x.id === id) ?? this.app.state.rooms.find((x) => x.id === id);
    return s ? s.name.split('·').pop()!.trim() : '';
  }
}

/**
 * Carimbo da Ordem bem apagado no painel do objeto (a referência): o anel com
 * o nome e o emblema no meio, que vem do logo local (fora do git); sem o logo,
 * fica só o anel.
 */
function selo(): HTMLElement {
  const el = h('span', { class: 'insp-selo', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 100 100"><defs><path id="selo-arco" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" stroke-width="1"/><text font-size="8.6" letter-spacing="1.6" fill="currentColor" font-family="Courier Prime, monospace" font-weight="700"><textPath href="#selo-arco">ORDO REALITAS · SEDE DA ORDEM ·</textPath></text></svg><i></i>`;
  return el;
}

/** A rolagem do painel e das listas de dentro dele (pela classe e pela ordem), para devolver depois de refazer. */
function guardarRolagem(raiz: HTMLElement): [string, number, number][] {
  const out: [string, number, number][] = [['', 0, raiz.scrollTop]];
  raiz.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.scrollTop <= 0) return;
    const chave = el.className || el.tagName;
    out.push([chave, [...raiz.querySelectorAll<HTMLElement>('*')].filter((x) => (x.className || x.tagName) === chave).indexOf(el), el.scrollTop]);
  });
  return out;
}

function devolverRolagem(raiz: HTMLElement, rolagem: [string, number, number][]) {
  for (const [chave, n, topo] of rolagem) {
    if (!chave) {
      raiz.scrollTop = topo;
      continue;
    }
    const el = [...raiz.querySelectorAll<HTMLElement>('*')].filter((x) => (x.className || x.tagName) === chave)[n];
    if (el) el.scrollTop = topo;
  }
}
