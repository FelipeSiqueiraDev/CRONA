import {
  anyFurniName,
  distinctFacings,
  getFurni,
  getWallFurni,
  LOOT_KINDS,
  lootKindLabel,
  MAX_TOKEN_NAME,
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
  type Loot,
  type LootKind,
  espacosDoItemFicha,
  kindDoItem,
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
import { brushSweep, brushWash, bump, countUp, drawStroke, eraseDraw, enter, floatText, flyArc, fxLayer, leave, pencilDraw, pencilShade, reduced, shake, stamp, tilt, typeInto, wait, wipeIn } from './motion';
import { askNote, promptNote } from './note';
import { brushize, paperize, textures, unpaint } from './paperArt';
import { sfx } from './sfx';
import { CombateScreen } from './combate';
import { FichasScreen } from './fichas';
import { AbaItens } from './itens';
import { infoItem, romano, textoRef } from './fichaRegras';
import { doCatalogoPeloNome, listaDoCatalogo } from './catalogoItens';
import { TecladoSenha } from './teclado';
import { FerramentasMesa } from './ferramentasMesa';
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
const RPG_TABS: RpgTab[] = ['PLAYERS', 'INTERLÚDIO', 'ITENS'];

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
  private planCanvas: HTMLCanvasElement;
  /** andar que a planta está mostrando agora */
  private planShown = '';
  /** a arte do alfinete (interface/alfinete.png), quando existe */
  private alfineteImg: HTMLImageElement | null = null;
  private planRects: { id: number; x: number; y: number; w: number; h: number; name: string }[] = [];
  private planDrag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; mover: boolean } | null = null;
  private planScale = 6;
  private planOrigin = { x: 0, y: 0 };
  private planHatch = { room: -1, t: 1 };
  private planFade = { room: -1, t: 1 };
  private planHover = -1;
  /** andar que a planta mostra (null = o da cena atual) */
  private planFloor: string | null = null;
  private planTitle!: HTMLElement;
  private planTabs!: HTMLElement;
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
  private rpgSig = '';
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
        { id: 'clima', icone: 'sol', titulo: 'Clima da cena', soDesktop: true, onclick: () => (sfx.click(), act.fx()) },
        { id: 'config', icone: 'engrenagem', titulo: 'Configurações', cheio: true, onclick: (e) => (e.stopPropagation(), this.toggleMenu()) },
        { id: 'registro', icone: 'documento', titulo: 'Registro da sessão', soDesktop: true, onclick: (e) => (e.stopPropagation(), this.toggleRegistro()) },
        {
          id: 'sair',
          icone: 'sair',
          titulo: 'Encerrar sessão',
          sair: true,
          onclick: async () => (await askNote('ENCERRAR SESSÃO?', 'O tabuleiro fecha nesta aba. Tudo fica salvo para a próxima sessão.', 'Encerrar', true)) && act.logout(),
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
    this.planCanvas = h('canvas', { class: 'plan-canvas' });
    this.planTitle = h('span', null, 'PLANTA');
    this.planTabs = h('div', { class: 'plan-tabs hidden', role: 'tablist', 'aria-label': 'Andares' });
    // rosa dos ventos a nanquim (desenho padrão até chegar rosa-dos-ventos.png)
    const rosa = svg(`<svg class="rosa" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#2a241f" stroke-linejoin="round">
      <circle cx="32" cy="34" r="17" stroke-width="1.2"/><circle cx="32" cy="34" r="12.5" stroke-width="0.7" stroke-dasharray="1.6 1.6"/>
      <path d="M32 11 36 30 32 34 28 30Z" fill="#2a241f"/><path d="M32 57 36 38 32 34 28 38Z" fill="#fff8" /><path d="M9 34 28 30 32 34 28 38Z" fill="#fff8"/><path d="M55 34 36 30 32 34 36 38Z" fill="#2a241f"/>
      <path d="M32 11 32 57M9 34 55 34" stroke-width="0.6"/><text x="32" y="8" text-anchor="middle" font-size="8" font-family="Courier Prime, monospace" font-weight="700" fill="#2a241f" stroke="none">N</text></svg>`);
    void rosa;
    const plan = h('section', { class: 'sheet p-plan wide' }, h('h3', { class: 'p-title' }, this.planTitle), this.planTabs, this.planCanvas, h('span', { class: 'tachinha', 'aria-hidden': 'true' }));
    void existeArte('/arte/interface/alfinete.png').then((ok) => {
      if (!ok) return;
      const im = new Image();
      im.onload = () => ((this.alfineteImg = im), this.drawPlan());
      im.src = '/arte/interface/alfinete.png';
    });
    paperize(plan, { kit: false, seed: 12, tone: '#c3b09a', burn: 0.85, grid: 11, backs: [{ dx: -10, dy: 5, rot: -1.4 }] });
    this.bindPlan();
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
    );
    this.ferramentas = new FerramentasMesa(app);
    this.abaInterludio = new AbaInterludio(app);
    this.combate.aoFerramentaMesa = (tipo) => this.ferramentas.alternar(tipo, false);
    this.ferramentas.aoMudar = (tipo) => this.combate.marcarFerramentaMesa(tipo);
    // a disposição de 06/10 (docs/ref-mapa-3.webp): as ferramentas numa fileira no canto de cima à direita,
    // a plaquinha do cômodo à esquerda e, embaixo, a faixa do estado da cena
    // (a faixa do estado embaixo saiu a pedido do Felipe; ISO e TÁTICA voltaram para o canto de baixo)
    this.placaEl = h('div', { class: 'board-placa' });
    this.estadoEl = h('div', { class: 'board-estado hidden' });
    const ferr = h('div', { class: 'board-ferr' }, this.ferramentas.el, centro);
    this.board = h('main', { class: 'board' }, moldura, this.placeBar, zoom, this.placaEl, ferr, this.vistaEl, this.tabOverlay, this.teclado.el);

    // ================= direita =================
    const backboard = h('div', { class: 'backboard', 'aria-hidden': 'true' });
    this.closeTag = h('button', { class: 'insp-x hidden', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => (sfx.click(), app.view.select(null)) }, paperclip('x-clip'), h('span', null, '✕'));
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
    const mapCol = h('aside', { class: 'col-map' }, plan, paperclip('clip clip-sala'), this.salaEl, this.inspEl, this.giveWrap);

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
    app.on('characters', () => ((this.sigs.party = ''), this.renderParty()));
    setInterval(() => this.captureThumb(), 4000);
    setInterval(() => this.markWalking(), 180);
    window.addEventListener('resize', () => this.drawPlan());
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
    this.drawPlan();
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
    const id = this.app.state.room?.id ?? null;
    if (id !== this.lastRoom) this.planFloor = null;
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
    this.drawPlan();
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
    j.corpo.append(h('div', { class: 'cfg-grade' }, ...opcoes.map(([i, n, t, f]) => cartao(i, n, t, f)), som));
    j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'fechar', '', () => j.fechar()));
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
      this.planFade = { room: this.planHatch.room, t: 0 };
      this.animatePlan(cur ?? -1, this.intro(1100));
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

  // ================= 1º andar =================
  private bindPlan() {
    const c = this.planCanvas;
    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * c.clientWidth) / r.width, y: ((e.clientY - r.top) * c.clientHeight) / r.height };
    };
    const hitRect = (p: { x: number; y: number }) => [...this.planRects].reverse().find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    c.addEventListener('pointerdown', (e) => {
      const p = at(e);
      const r = hitRect(p);
      if (!r || !this.campaign) return;
      const lay = this.campaign.layout[r.id] ?? { x: 0, y: 0 };
      // clicar leva ao cômodo; mudar o cômodo de lugar na planta só segurando Alt (sem mexer no mapa por engano)
      this.planDrag = { id: r.id, sx: p.x, sy: p.y, ox: lay.x, oy: lay.y, moved: false, mover: e.altKey };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.planDrag;
      const p = at(e);
      const hit = hitRect(p);
      c.style.cursor = hit ? 'pointer' : 'default';
      const hid = hit?.id ?? -1;
      if (hid !== this.planHover) {
        this.planHover = hid;
        this.drawPlan(true);
      }
      // o nome do cômodo só no aviso do navegador (aparece se o mouse parar em cima)
      const titulo = hit ? hit.name : '';
      if (c.title !== titulo) c.title = titulo;
      if (!d || !d.mover || !this.campaign || !this.owner) return;
      const dx = Math.round((p.x - d.sx) / this.planScale);
      const dy = Math.round((p.y - d.sy) / this.planScale);
      if (dx || dy) d.moved = true;
      if (d.moved) {
        this.campaign.layout[d.id] = { x: d.ox + dx, y: d.oy + dy };
        this.drawPlan(true);
      }
    });
    c.addEventListener('pointerleave', () => {
      this.planHover = -1;
      this.drawPlan(true);
    });
    c.addEventListener('pointerup', () => {
      const d = this.planDrag;
      this.planDrag = null;
      if (!d || !this.campaign) return;
      if (d.moved) {
        const l = this.campaign.layout[d.id];
        this.app.net.send({ t: 'layoutSet', roomId: d.id, x: l.x, y: l.y });
      } else if (d.id !== this.app.state.room?.id) this.goScene(d.id);
    });
  }

  /** Lápis de cor pintando o cômodo atual na planta (hachuras + preenchimento). */
  private animatePlan(room: number, delay: number) {
    this.planHatch = { room, t: 0 };
    const run = async () => {
      if (delay) await wait(delay);
      if (this.planHatch.room !== room) return;
      const r = this.planRects.find((x) => x.id === room);
      const lines = r ? this.hatchLines(r) : [];
      const cr = this.planCanvas.getBoundingClientRect();
      const k = cr.width / (this.planCanvas.clientWidth || 1);
      const pts: { x: number; y: number }[] = [];
      lines.forEach(([x0, y0, x1, y1], i) => {
        const a = { x: cr.left + x0 * k, y: cr.top + y0 * k };
        const b = { x: cr.left + x1 * k, y: cr.top + y1 * k };
        if (i % 2) pts.push(b, a);
        else pts.push(a, b);
      });
      await pencilShade(pts, 950, (t) => {
        if (this.planHatch.room !== room) return;
        this.planHatch.t = t;
        this.planFade.t = Math.min(1, t * 1.6);
        this.drawPlan(true);
      });
      this.planHatch.t = 1;
      this.planFade = { room: -1, t: 1 };
      this.drawPlan(true);
    };
    void run();
  }

  /** Hachuras a 45° dentro do retângulo do cômodo (x0,y0 → x1,y1). */
  private hatchLines(r: { x: number; y: number; w: number; h: number }) {
    const out: [number, number, number, number][] = [];
    const step = 3.2;
    for (let c = r.x + r.y + step; c < r.x + r.w + r.y + r.h; c += step) {
      const x0 = Math.max(r.x, c - (r.y + r.h));
      const x1 = Math.min(r.x + r.w, c - r.y);
      out.push([x0, c - x0, x1, c - x1]);
    }
    return out;
  }

  // ================= direita: controle do RPG =================
  /** Abas da direita e o conteúdo da aba aberta (PLAYERS: a ficha de cada um). */
  private renderRpg(force = false) {
    const party = this.campaign?.party ?? [];
    const sig = JSON.stringify([this.rpgTab, this.gm, party.map((p) => [p.id, p.name, p.color, p.vitals ?? null, p.roomId, p.look?.charId ?? null, !!p.armed])]);
    if (!force && sig === this.rpgSig) return;
    this.rpgSig = sig;
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
          h('span', null, t),
          t === this.rpgTab ? tabRing() : null,
        ),
      ),
    );
    const body = clear(this.rpgBody);
    if (this.rpgTab === 'ITENS') {
      this.abaItens.render(body, party, this.fichasMapa, this.gm);
      return;
    }
    if (this.rpgTab === 'INTERLÚDIO') {
      this.abaInterludio.render(body, party, this.fichasMapa, this.gm, () => this.renderRpg(true));
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
        { class: 'rpg-player', style: `--c:${p.color}` },
        h(
          'button',
          { class: 'rp-foto', title: here ? 'Comandar' : `Ir para ${this.sceneName(p.roomId)}`, onclick: () => this.pickCard(id) },
          portraitCanvas(p.look, 96, { dir: 2, armed: !!p.armed, hurt: vitalConditions(p.vitals).machucado }),
          // armado sem retrato armado na arte: o sinal da arma no canto
          p.armed && !sprites.def(p.look?.charId)?.portraits?.armado ? h('span', { class: 'rp-arma', title: 'Arma na mão' }, ic(this.app.session.session?.characters.find((c) => c.id === -id)?.arma === 'fogo' ? 'pistola' : 'espada')) : null,
        ),
        h(
          'div',
          { class: 'rp-info' },
          h('div', { class: 'rp-nome' }, h('b', null, p.name), h('button', { class: 'rp-mais', type: 'button', title: 'Mais', 'aria-label': `Mais de ${p.name}`, onclick: () => (sfx.click(), here ? this.app.view.select({ kind: 'user', id }) : this.pickCard(id)) }, ic('reticencias'))),
          h('div', { class: 'rp-local' }, ic('pino'), h('span', null, this.sceneName(p.roomId) || '—')),
          this.vitaisCarta(id, p),
        ),
      );
      paperize(card, { seed: 300 + id, tone: '#dfd0b3', burn: 0.7, torn: 0.8, stains: 0.6, pad: 12 });
      body.append(card);
    }
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
    // a mochila (ITENS) e as condições marcadas (PLAYERS) vêm das fichas
    this.renderRpg(true);
  }

  /** Abas dos andares acima da planta (só com mais de um andar). */
  private renderPlanTabs(floors: string[], shown: string) {
    const label = (f: string) => (f ? f.toUpperCase() : '1º ANDAR');
    const sig = JSON.stringify([floors, shown]);
    if (this.planTabs.dataset.sig === sig) return;
    this.planTabs.dataset.sig = sig;
    clear(this.planTabs).classList.toggle('hidden', floors.length < 2);
    // muitos andares (a fazenda tem cinco): as abas encolhem para caber
    this.planTabs.classList.toggle('muitas', floors.length > 3);
    for (const f of floors)
      this.planTabs.append(
        h(
          'button',
          {
            class: `plan-tab${f === shown ? ' on' : ''}`,
            role: 'tab',
            'aria-selected': String(f === shown),
            onclick: () => {
              if (f === shown) return;
              sfx.paper();
              this.planFloor = f;
              this.drawPlan();
            },
          },
          label(f),
        ),
      );
  }

  /**
   * Planta (como a referência): uma planta de arquitetura no papel quadriculado. Todos os
   * andares da campanha na mesma escala (o bar fica pequeno perto do subsolo, como é); os
   * cômodos de pedra cinza com o contorno grosso e a linha clara por dentro, as portas
   * marcadas na parede, o atual em vermelho com o alfinete e o nome numa plaquinha. Ao ar
   * livre, o terreno (grama, estrada, água) e os prédios com o nome.
   */
  private drawPlan(keepScale = false) {
    const c = this.planCanvas;
    const cssW = c.clientWidth || 220;
    const cssH = c.clientHeight || 170;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const camp = this.campaign;
    const cur = this.app.state.room?.id;
    this.planRects = [];
    if (!camp || !camp.scenes.length) return;
    // um andar por vez: o da cena atual, ou o que o mestre escolheu nas abas
    const floorOf = (id: number | undefined) => camp.scenes.find((s) => s.id === id)?.floor ?? '';
    const floors = [...new Set(camp.scenes.map((s) => s.floor ?? ''))];
    const shown = this.planFloor !== null && floors.includes(this.planFloor) ? this.planFloor : floorOf(cur);
    this.planShown = shown;
    this.renderPlanTabs(floors, shown);
    const todos = camp.scenes.map((s) => {
      const p = camp.layout[s.id] ?? { x: 0, y: 0 };
      const raw = parseHeightmap(s.heightmap);
      const rot = (x: number, y: number) => rotatePt(raw, p.r ?? 0, x, y);
      // o vão da porta (a casa de fora da parede) não entra no desenho
      const porta = s.aberto ? null : rot(s.door.x, s.door.y);
      return { s, raw, hm: rotateHm(raw, p.r ?? 0), p, rot, porta };
    });
    const caixa = (lista: typeof todos) => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const { hm, p } of lista) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x + hm.width);
        y1 = Math.max(y1, p.y + hm.height);
      }
      return { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
    };
    const parsed = todos.filter((q) => (q.s.floor ?? '') === shown);
    void todos;
    if (!keepScale || !this.planDrag) {
      const pad = 8;
      // o andar enche o papel (como o prédio da referência); um cômodo sozinho (o bar) fica em no máximo metade dele
      const b = caixa(parsed);
      const sozinho = parsed.length === 1 && !parsed[0].s.aberto;
      const teto = sozinho ? Math.min((cssW * 0.5) / b.w, (cssH * 0.7) / b.h) : Infinity;
      this.planScale = Math.max(1.5, Math.min(teto, (cssW - pad * 2) / b.w, (cssH - pad * 2) / b.h));
      this.planOrigin = {
        x: pad + (cssW - pad * 2 - b.w * this.planScale) / 2 - b.x0 * this.planScale,
        y: pad + (cssH - pad * 2 - b.h * this.planScale) / 2 - b.y0 * this.planScale,
      };
    }
    const S = this.planScale;
    const O = this.planOrigin;
    // o minimapa do game (06/10): azul-noite com a grade, os cômodos em azul-escuro com as paredes
    // beges, o cômodo de agora aceso de ouro, as portas marcadas, os nomes em pixel e as peças como
    // pontos de luz na cor de cada um
    const granito = '#13233d';
    // a grade de 1,5 m (duas casas), de leve, no papel inteiro
    ctx.save();
    ctx.strokeStyle = 'rgba(161,136,115,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const passo = S * 2;
    if (passo >= 4) {
      for (let x = ((O.x % passo) + passo) % passo; x < cssW; x += passo) (ctx.moveTo(Math.round(x) + 0.5, 0), ctx.lineTo(Math.round(x) + 0.5, cssH));
      for (let y = ((O.y % passo) + passo) % passo; y < cssH; y += passo) (ctx.moveTo(0, Math.round(y) + 0.5), ctx.lineTo(cssW, Math.round(y) + 0.5));
    }
    ctx.stroke();
    ctx.restore();
    // de quem é cada casa do andar (na planta): parede entre dois cômodos é fina; a de fora, grossa
    const dono = new Map<string, number>();
    const formas = new Map<number, Path2D>();
    for (const { s, hm, p, porta } of parsed) {
      if (s.aberto) continue;
      const forma = new Path2D();
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          if (hm.tiles[y]?.[x] === null || hm.tiles[y]?.[x] === undefined || (porta && x === porta[0] && y === porta[1])) continue;
          dono.set(`${p.x + x},${p.y + y}`, s.id);
          forma.rect(O.x + (p.x + x) * S, O.y + (p.y + y) * S, S + 0.35, S + 0.35);
        }
      formas.set(s.id, forma);
    }
    // a sombra do prédio e o chão dos cômodos
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = granito;
    for (const f of formas.values()) ctx.fill(f);
    ctx.restore();
    const rotulos: { x: number; y: number; w: number; h: number; nome: string; atual: boolean }[] = [];
    for (const { s, hm, raw, p, rot } of parsed) {
      const ox = O.x + p.x * S;
      const oy = O.y + p.y * S;
      const atual = s.id === cur;
      const rect = { id: s.id, x: ox, y: oy, w: hm.width * S, h: hm.height * S, name: s.name.split('·').pop()!.trim() };
      if (s.aberto) {
        this.terrenoNaPlanta(ctx, s, raw, rot, ox, oy, S, granito);
        this.planRects.push(rect);
        continue;
      }
      const forma = formas.get(s.id)!;
      const tile = (x: number, y: number) => dono.get(`${p.x + x},${p.y + y}`) === s.id;
      // o xadrez bem leve das casas (dá a escala, como o chão de um mapa de jogo)
      if (S >= 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.028)';
        for (let y = 0; y < hm.height; y++)
          for (let x = 0; x < hm.width; x++) if (tile(x, y) && (p.x + x + p.y + y) % 2 === 0) ctx.fillRect(ox + x * S, oy + y * S, S, S);
      }
      // o cômodo de agora: o ouro acende (entrando, sobe aos poucos, com a varredura de luz)
      if (atual) {
        const anima = this.planHatch.room === s.id ? this.planHatch.t : 1;
        ctx.save();
        ctx.clip(forma);
        const g = ctx.createLinearGradient(ox, oy, ox, oy + rect.h);
        g.addColorStop(0, `rgba(255,210,122,${(0.34 * anima).toFixed(3)})`);
        g.addColorStop(1, `rgba(201,127,44,${(0.2 * anima).toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.fill(forma);
        if (anima < 1) {
          const yv = oy + rect.h * anima;
          const v = ctx.createLinearGradient(0, yv - 10, 0, yv + 2);
          v.addColorStop(0, 'rgba(255,236,190,0)');
          v.addColorStop(1, 'rgba(255,236,190,0.65)');
          ctx.fillStyle = v;
          ctx.fillRect(ox, yv - 10, rect.w, 12);
        }
        ctx.restore();
      } else if (s.id === this.planFade.room && this.planFade.t < 1) {
        ctx.fillStyle = `rgba(233,169,68,${0.3 * (1 - this.planFade.t)})`;
        ctx.fill(forma);
      }
      if (s.id === this.planHover) {
        ctx.fillStyle = 'rgba(160,200,255,0.12)';
        ctx.fill(forma);
      }
      // as paredes: fina entre dois cômodos, grossa por fora; limpas, como num mapa de jogo
      const fina: [number, number, number, number][] = [];
      const grossa: [number, number, number, number][] = [];
      const vizinho = (x: number, y: number) => dono.get(`${p.x + x},${p.y + y}`);
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          if (!tile(x, y)) continue;
          const X = ox + x * S;
          const Y = oy + y * S;
          for (const [nx, ny, seg] of [
            [x, y - 1, [X, Y, X + S, Y]],
            [x, y + 1, [X, Y + S, X + S, Y + S]],
            [x - 1, y, [X, Y, X, Y + S]],
            [x + 1, y, [X + S, Y, X + S, Y + S]],
          ] as [number, number, [number, number, number, number]][]) {
            const v = vizinho(nx, ny);
            if (v === s.id) continue;
            (v === undefined ? grossa : fina).push(seg);
          }
        }
      const traco = (segs: [number, number, number, number][], cor: string, lw: number, brilho = 0) => {
        if (!segs.length) return;
        ctx.save();
        ctx.strokeStyle = cor;
        ctx.lineWidth = lw;
        ctx.lineCap = 'square';
        if (brilho) {
          ctx.shadowColor = 'rgba(255,196,90,0.85)';
          ctx.shadowBlur = brilho;
        }
        ctx.beginPath();
        for (const [a, b2, c2, d2] of segs) (ctx.moveTo(a, b2), ctx.lineTo(c2, d2));
        ctx.stroke();
        ctx.restore();
      };
      traco(fina, 'rgba(161,136,115,0.45)', 1);
      traco(grossa, '#a18873', Math.max(1.5, Math.min(2.4, S * 0.34)));
      if (atual) traco([...fina, ...grossa], '#ffd27a', 1.6, 7);
      // as portas: um tracinho de ouro atravessando a parede
      ctx.fillStyle = atual ? '#fff0c8' : '#e9a944';
      for (const pt of s.portals) {
        const [px, py] = rot(pt.x, pt.y);
        if (!tile(px, py)) continue;
        const X = ox + px * S;
        const Y = oy + py * S;
        const e = Math.max(1.6, S * 0.3);
        if (!tile(px, py - 1)) ctx.fillRect(X + S * 0.2, Y - e / 2, S * 0.6, e);
        else if (!tile(px, py + 1)) ctx.fillRect(X + S * 0.2, Y + S - e / 2, S * 0.6, e);
        else if (!tile(px - 1, py)) ctx.fillRect(X - e / 2, Y + S * 0.2, e, S * 0.6);
        else if (!tile(px + 1, py)) ctx.fillRect(X + S - e / 2, Y + S * 0.2, e, S * 0.6);
      }
      rotulos.push({ x: ox, y: oy, w: rect.w, h: rect.h, nome: rect.name, atual });
      this.planRects.push(rect);
    }
    // os nomes dos cômodos, em pixel, quando cabem (o de agora em ouro)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of rotulos) {
      const f = Math.max(7, Math.min(10.5, S * 1.15));
      ctx.font = `600 ${f.toFixed(1)}px "Pixelify Sans", "Ubuntu Mono", monospace`;
      let nome = r.nome;
      if (ctx.measureText(nome).width > r.w - 4) nome = nome.split(/\s+/)[0];
      if (ctx.measureText(nome).width > r.w - 4 || r.h < f + 4) continue;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,11,20,0.9)';
      ctx.strokeText(nome, r.x + r.w / 2, r.y + r.h / 2);
      ctx.fillStyle = r.atual ? '#ffd27a' : 'rgba(243,233,216,0.78)';
      ctx.fillText(nome, r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
    // onde estão as peças: pontos de luz na cor de cada um
    for (const { s, p, rot } of parsed)
      for (const u of s.users) {
        const pm = camp.party.find((q) => q.id === u.id);
        const [ux, uy] = rot(u.x, u.y);
        const cx = O.x + (p.x + ux + 0.5) * S;
        const cy = O.y + (p.y + uy + 0.5) * S;
        const r = Math.max(2.4, Math.min(3.8, S * 0.42));
        ctx.save();
        ctx.shadowColor = pm?.color ?? '#fff';
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = pm?.color ?? '#fff';
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#050b14';
        ctx.stroke();
      }
  }

  /** O granito dos cômodos da planta: pedra cinza salpicada, com uns veios (como a referência). */
  private granito: CanvasPattern | null = null;
  private padraoGranito(ctx: CanvasRenderingContext2D): CanvasPattern | string {
    if (this.granito) return this.granito;
    const T = 72;
    const p = document.createElement('canvas');
    p.width = T;
    p.height = T;
    const g = p.getContext('2d');
    if (!g) return '#9d9993';
    let semente = 9;
    const r = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#928e87';
    g.fillRect(0, 0, T, T);
    // manchas grandes e claras/escuras (a pedra da referência), repetidas nas bordas para não ter emenda
    const mancha = (x: number, y: number, rx: number, ry: number, cor: string) => {
      for (const dx of [-T, 0, T])
        for (const dy of [-T, 0, T]) {
          g.beginPath();
          g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, Math.PI * 2);
          g.fillStyle = cor;
          g.fill();
        }
    };
    for (let i = 0; i < 26; i++) mancha(r() * T, r() * T, 3 + r() * 7, 2 + r() * 5, r() < 0.55 ? 'rgba(70,66,60,0.16)' : 'rgba(225,221,212,0.18)');
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.6 ? 'rgba(52,48,44,0.38)' : 'rgba(232,228,220,0.35)';
      g.fillRect(Math.floor(r() * T), Math.floor(r() * T), r() < 0.3 ? 2 : 1, r() < 0.3 ? 2 : 1);
    }
    g.strokeStyle = 'rgba(46,42,38,0.38)';
    g.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      let x = r() * T;
      let y = r() * T;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (r() - 0.5) * 18;
        y += (r() - 0.5) * 18;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    this.granito = ctx.createPattern(p, 'repeat');
    return this.granito ?? '#9d9993';
  }

  /** O lugar ao ar livre na planta: o terreno com cores de mapa e os prédios de pedra, com o nome. */
  private terrenoNaPlanta(ctx: CanvasRenderingContext2D, s: SceneInfo, raw: Heightmap, rot: (x: number, y: number) => [number, number], ox: number, oy: number, S: number, granito: CanvasPattern | string) {
    const linhas = (s.terreno ?? '').replace(/\r/g, '').split('\n');
    const COR: Record<string, string> = { '.': '#1d3426', g: '#1d3426', t: '#3a3123', l: '#34402a', p: '#2b3242', d: '#3c3427', m: '#362b20', a: '#12304d' };
    for (let y = 0; y < raw.height; y++)
      for (let x = 0; x < raw.width; x++) {
        const ch = linhas[y]?.[x] ?? '.';
        const chao = raw.tiles[y]?.[x] !== null && raw.tiles[y]?.[x] !== undefined;
        if (!chao && ch !== 'a') continue;
        const [rx, ry] = rot(x, y);
        ctx.fillStyle = COR[ch] ?? COR['.'];
        ctx.fillRect(ox + rx * S, oy + ry * S, S + 0.35, S + 0.35);
      }
    // a borda do lugar
    const largura = (rot(raw.width - 1, raw.height - 1)[0] === raw.width - 1 ? raw.width : raw.height) * S;
    const altura = (rot(raw.width - 1, raw.height - 1)[0] === raw.width - 1 ? raw.height : raw.width) * S;
    ctx.strokeStyle = s.id === this.app.state.room?.id ? '#ffd27a' : '#a18873';
    ctx.lineWidth = s.id === this.app.state.room?.id ? 2 : 1.4;
    ctx.strokeRect(ox, oy, largura, altura);
    // os prédios
    for (const m of s.marcos ?? []) {
      const [ax, ay] = rot(m.x, m.y);
      const [bx, by] = rot(m.x + m.w - 1, m.y + m.h - 1);
      const x0 = ox + Math.min(ax, bx) * S;
      const y0 = oy + Math.min(ay, by) * S;
      const w = (Math.abs(bx - ax) + 1) * S;
      const h = (Math.abs(by - ay) + 1) * S;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x0 + 1.2, y0 + 1.4, w, h);
      ctx.fillStyle = granito;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = '#a18873';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x0, y0, w, h);
      const f = Math.min(8.5, h * 0.42, (w / Math.max(4, m.nome.length)) * 1.8);
      if (f >= 5) {
        ctx.save();
        ctx.font = `600 ${f.toFixed(1)}px "Pixelify Sans", "Ubuntu Mono", monospace`;
        ctx.fillStyle = '#f3e9d8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.nome, x0 + w / 2, y0 + h / 2);
        ctx.restore();
      }
    }
  }

  /** O alfinete da sala atual: a arte (alfinete.png) ou o marcador de mapa desenhado. */
  private alfinete(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    if (this.alfineteImg) {
      const w = r * 2.4;
      const hh = w * 1.4;
      ctx.drawImage(this.alfineteImg, cx - w / 2, cy - hh * 0.8, w, hh);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.7);
    ctx.bezierCurveTo(cx - r * 0.45, cy + r * 0.9, cx - r, cy + r * 0.3, cx - r, cy - r * 0.15);
    ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
    ctx.bezierCurveTo(cx + r, cy + r * 0.3, cx + r * 0.45, cy + r * 0.9, cx, cy + r * 1.7);
    ctx.closePath();
    ctx.fillStyle = '#f6efe3';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#4a120d';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.15, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#b3261e';
    ctx.fill();
    ctx.restore();
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
    const party = (this.campaign?.party ?? []).map((p) => [p.id, p.name, p.color, p.load, p.capacity, p.look, !!p.armed, p.vitals ?? null]);
    let data: unknown = null;
    if (sel?.kind === 'user') {
      const u = view.users.get(sel.id);
      data = u ? [u.name, u.look, u.color, view.myId === sel.id] : null;
    } else if (sel) data = this.selection()?.item ?? null;
    else {
      const map = view.map;
      data = map ? [...map.allItems(), ...map.allWallItems()].filter((it) => it.hint || it.loot?.length || it.actions?.length) : null;
    }
    return JSON.stringify([sel, this.inspTab, this.giveLoot, this.addingLoot, this.logging, this.gm, this.app.state.room?.id, this.app.state.room?.description, data, party]);
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
    body.querySelectorAll('.insp-tip, .tools, .tool-sel').forEach((c) => enter(c, 'fade', 300, 400));
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
    const tab = (id: InspTab, label: string) => {
      const on = this.inspTab === id;
      return h(
        'button',
        {
          class: `itab${on ? ' on' : ''}`,
          role: 'tab',
          'aria-selected': String(on),
          onclick: () => {
            if (this.inspTab === id) return;
            this.inspTab = id;
            this.giveLoot = null;
            this.renderInspector();
          },
        },
        h('span', null, label),
        on ? tabRing() : null,
      );
    };
    body.append(h('div', { class: 'itabs', role: 'tablist' }, tab('items', `CONTÉM (${loot.length})`), tab('desc', 'DESCRIÇÃO'), tab('inter', 'INTERAÇÕES')));
    const pane = h('div', { class: `ipane ${this.inspTab}` });
    body.append(pane, selo());
    if (this.inspTab === 'desc') this.paneDesc(pane, s);
    else if (this.inspTab === 'inter') this.paneInter(pane, s, actions);
    else this.paneItems(pane, s, loot);
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
    if (states > 1) tools.append(tool('Usar', () => net.send({ t: 'use', id: item.id })));
    if (hint) tools.append(tool('Ler', () => this.hintViewer.open(kind, item.id)));
    if (this.gm) {
      const floor = kind === 'floor' ? (item as FloorItem) : null;
      if (floor && fdef && fdef.rotations.length > 1)
        tools.append(
          tool('Girar', () => {
            const rot = nextRotation(fdef, floor.rot);
            const map = this.app.view.map!;
            if (!map.canPlace(floor.defId, floor.x, floor.y, rot, floor.id).ok) return toast('Não dá para girar aqui.', 'error');
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

  private paneInter(pane: HTMLElement, s: NonNullable<Sel>, actions: NonNullable<FloorItem['actions']>) {
    const net = this.app.net;
    if (!actions.length) pane.append(h('p', { class: 'empty' }, 'Nenhuma interação cadastrada.'));
    actions.forEach((a) => {
      const card = h('div', { class: 'icard' }, h('div', { class: 'ic-icon dt' }, h('b', null, 'DT'), h('span', null, String(a.dt))), h('div', { class: 'ic-text' }, h('b', null, a.label), h('small', null, `Teste | DT ${a.dt}`)));
      if (this.gm) {
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
              h('button', { class: 'ic-del', title: 'Remover', 'aria-label': 'Remover interação', onclick: () => net.send({ t: 'actionRemove', itemId: s.item.id, actionId: a.id }) }, '×'),
            ),
          );
      }
      pane.append(card);
    });
    if (this.gm) {
      const label = h('input', { class: 'mini grow', placeholder: 'Nova interação (ex: Investigar)', maxlength: 40 });
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

  private paneItems(pane: HTMLElement, s: NonNullable<Sel>, loot: Loot[]) {
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
        : this.gm
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
      if (this.gm && !l.holder)
        card.append(h('button', { class: 'ic-del', title: 'Remover item', 'aria-label': 'Remover item', onclick: () => net.send({ t: 'lootRemove', itemId: s.item.id, lootId: l.id }) }, '×'));
      pane.append(card);
      if (justGiven && right && !reduced()) {
        right.animate([{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, delay: 650, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
        card.animate([{ boxShadow: '0 0 0 0.3rem rgba(80,160,90,.55)' }, { boxShadow: '0 0 0 0 rgba(80,160,90,0)' }], { duration: 900, delay: 650 });
        setTimeout(() => sfx.pop(), 700);
      }
    });
    if (this.gm) {
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

  private renderTokenInspector(body: HTMLElement, id: number) {
    const view = this.app.view;
    const u = view.users.get(id)!;
    const p = this.campaign?.party.find((x) => x.id === id);
    const color = p?.color ?? u.color;
    const net = this.app.net;
    const carried: { l: Loot; from: string }[] = [];
    const ficha = this.fichasMapa.find((f) => f.personagem && f.personagem === u.look.charId);
    const map = view.map;
    if (map) for (const it of [...map.allItems(), ...map.allWallItems()]) for (const l of it.loot ?? []) if (l.holder?.toLowerCase() === u.name.toLowerCase()) carried.push({ l, from: anyFurniName(it.defId) });
    const active = view.myId === id;
    const ratio = p && p.capacity ? p.load / p.capacity : 0;
    const load = p
      ? h('div', { class: 'tk-load' }, h('span', null, `Carga ${fmt(p.load)} / ${fmt(p.capacity)}`), h('div', { class: `g-bar ${level(ratio)}` }, h('i', { style: `--w:${Math.min(100, ratio * 100)}%` })))
      : null;
    body.append(
      h(
        'div',
        { class: 'insp-head' },
        this.polaroid(this.livePortrait(u.look, 262, p)),
        this.headText(
          u.name.toUpperCase(),
          (active ? 'Sob seu comando: clique no chão para andar.' : 'Clique em Comandar (ou no retrato dele) para mover este personagem.') + (this.gm ? ' Q e E giram.' : ''),
          load,
        ),
      ),
    );
    const tools = h('div', { class: 'tools' });
    const tool = (label: string, fn: () => void) => h('button', { class: 'tool', onclick: () => (sfx.click(), fn()) }, label);
    if (!active) tools.append(tool('Comandar', () => view.setActive(id)));
    tools.append(tool('Centralizar', () => view.focusUser(id)));
    if (this.gm) {
      tools.append(
        h('button', { class: 'tool', title: 'Girar para a esquerda (Q)', onclick: () => this.turnToken(id, false) }, '↺ Girar'),
        h('button', { class: 'tool', title: 'Girar para a direita (E)', onclick: () => this.turnToken(id, true) }, 'Girar ↻'),
        this.stateTool('Armado', !!p?.armed, ficha ? 'Vem da mão: empunha a arma da mochila ou guarda as armas' : 'Com a arma na mão (retrato armado)', () => net.send({ t: 'tokenEdit', tokenId: id, armed: !p?.armed })),
        tool('Editar', () => this.tokenWin.open({ id, name: u.name, look: u.look, color, capacity: p?.capacity ?? 10 })),
        tool('Remover', async () => (await askNote(`TIRAR ${u.name.toUpperCase()}?`, `${u.name} sai do tabuleiro. Os itens que carrega continuam registrados.`, 'Tirar do tabuleiro', true)) && net.send({ t: 'tokenRemove', tokenId: id })),
      );
    }
    body.append(tools);
    if (p) body.append(this.vitalsPanel(id, p));
    if (this.gm) {
      const sc = h('select', { class: 'tool-sel', 'aria-label': 'Levar para outra cena' }, h('option', { value: '' }, 'Levar para outra cena…'), ...this.sceneList().filter((r) => r.id !== this.app.state.room?.id).map((r) => h('option', { value: String(r.id) }, r.name)));
      sc.addEventListener('change', () => sc.value && net.send({ t: 'tokenScene', tokenId: id, roomId: Number(sc.value) }));
      body.append(sc);
    }
    if (ficha) {
      // com ficha, a mochila dela (um inventário só): o resto se faz na aba ITENS
      const inv = ficha.ficha.inventario;
      body.append(h('div', { class: 'itabs' }, h('span', { class: 'itab on' }, h('span', null, `MOCHILA (${inv.length})`), tabRing())));
      const pane = h('div', { class: 'ipane' });
      if (!inv.length) pane.append(h('p', { class: 'empty' }, 'Mochila vazia.'));
      const lugar = { mao: 'na mão', vestido: 'vestido', mochila: 'na mochila' } as const;
      for (const it of inv) {
        const icone = it.tipo === 'cena' ? lootIcon((it.tipoCena as LootKind) || 'misc', 52) : lootIcon(kindDoItem(it), 52);
        pane.append(h('div', { class: 'icard' }, h('div', { class: 'ic-icon' }, icone), h('div', { class: 'ic-text' }, h('b', null, regras.nomeDoItem(it)), h('small', null, `${fmt(espacosDoItemFicha(it))} esp. | ${lugar[regras.lugarDoItem(it)]}${(it.qtd ?? 1) > 1 ? ` · x${it.qtd}` : ''}`))));
      }
      pane.append(h('button', { class: 'add-item', onclick: () => (sfx.paper(), this.abrirItens(id)) }, 'Abrir na aba ITENS'));
      body.append(pane);
      return;
    }
    body.append(h('div', { class: 'itabs' }, h('span', { class: 'itab on' }, h('span', null, `CARREGANDO (${carried.length})`), tabRing())));
    const pane = h('div', { class: 'ipane' });
    if (!carried.length) pane.append(h('p', { class: 'empty' }, 'Nada nas mãos (itens desta cena).'));
    carried.forEach(({ l, from }) =>
      pane.append(h('div', { class: 'icard' }, h('div', { class: 'ic-icon' }, lootIcon(l.kind, 52)), h('div', { class: 'ic-text' }, h('b', null, l.name), h('small', null, `Espaços: ${fmt(l.espacos)} | ${lootKindLabel(l.kind)} · ${from}`)))),
    );
    body.append(pane);
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

  /** Ficha no inspetor do personagem: PV, PE e SAN com − e + (Shift = de 5 em 5) e o total editável. */
  private vitalsPanel(id: number, p: PartyMember) {
    const v = p.vitals ?? DEFAULT_VITALS;
    const net = this.app.net;
    const c = vitalConditions(p.vitals);
    const wrap = h('div', { class: 'vitals' });
    for (const k of VITAL_KEYS) {
      const cur = v[k];
      const max = v[`${k}Max`];
      const change = (delta: number) => (e: MouseEvent) => {
        sfx.click();
        net.send({ t: 'vitals', tokenId: id, key: k, delta: e.shiftKey ? delta * 5 : delta });
      };
      const total = h('input', { class: 'vt-max', type: 'number', min: '1', max: '999', value: String(max), 'aria-label': `${VITAL_NAME[k]} total`, title: 'Total' });
      total.addEventListener('change', () => {
        const n = Number(total.value);
        if (Number.isFinite(n) && n >= 1) net.send({ t: 'vitals', tokenId: id, key: k, max: n });
      });
      const w = Math.max(0, Math.min(100, (cur / max) * 100));
      wrap.append(
        h(
          'div',
          { class: `vt ${k}` },
          h('b', { class: 'vt-k', title: VITAL_NAME[k] }, VITAL_LABEL[k]),
          this.gm ? h('button', { class: 'vt-btn', title: `Tirar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Tirar ${VITAL_NAME[k]}`, onclick: change(-1) }, '−') : null,
          h('span', { class: 'vt-bar' }, h('i', { style: `--w:${w}%` }), h('em', null, `${cur} / `)),
          this.gm ? total : h('span', null, String(max)),
          this.gm ? h('button', { class: 'vt-btn', title: `Dar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Dar ${VITAL_NAME[k]}`, onclick: change(1) }, '+') : null,
        ),
      );
    }
    const labels = conditionLabels(c);
    if (labels.length) wrap.append(h('div', { class: 'vt-conds' }, ...labels.map((l) => h('span', { class: 'vt-cond' }, l))));
    return wrap;
  }

  /** Barras da carta de PLAYERS: PV, PE e SAN com − e + (Shift: de 5 em 5); clicar na barra muda o total. */
  private vitaisCarta(id: number, p: PartyMember) {
    const v = p.vitals ?? DEFAULT_VITALS;
    const net = this.app.net;
    const wrap = h('div', { class: 'rp-vit' });
    for (const k of VITAL_KEYS) {
      const cur = v[k];
      const max = v[`${k}Max`];
      const w = Math.max(0, Math.min(100, (cur / max) * 100));
      const change = (delta: number) => (e: MouseEvent) => {
        sfx.click();
        net.send({ t: 'vitals', tokenId: id, key: k, delta: e.shiftKey ? delta * 5 : delta });
      };
      const total = async () => {
        if (!this.gm) return;
        const r = await promptNote(`${VITAL_NAME[k].toUpperCase()} DE ${p.name.toUpperCase()}`, [{ label: 'Total', value: String(max), max: 3 }]);
        const n = r ? Number(r[0]) : NaN;
        if (Number.isFinite(n) && n >= 1) net.send({ t: 'vitals', tokenId: id, key: k, max: n });
      };
      wrap.append(
        h(
          'div',
          { class: `rp-l ${k}` },
          h('b', { title: VITAL_NAME[k] }, VITAL_LABEL[k]),
          this.gm ? h('button', { class: 'rp-q', title: `Tirar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Tirar ${VITAL_NAME[k]}`, onclick: change(-1) }, ic('menos')) : h('span'),
          h('button', { class: `rp-bar ${k}`, title: this.gm ? 'Clique para mudar o total' : VITAL_NAME[k], onclick: () => void total() }, h('i', { style: `width:${w}%` }), h('span', null, `${cur} / ${max}`)),
          this.gm ? h('button', { class: 'rp-q', title: `Dar 1 ${VITAL_LABEL[k]} (Shift: 5)`, 'aria-label': `Dar ${VITAL_NAME[k]}`, onclick: change(1) }, ic('mais')) : h('span'),
        ),
      );
    }
    // as condições do agente: as que saem sozinhas pelo PV e pela SAN e as que o mestre marca (na ficha).
    // Ficam aqui e no celular do jogador; a FICHAS do mestre é só a das regras.
    const labels = conditionLabels(vitalConditions(p.vitals));
    const ficha = this.fichasMapa.find((f) => f.personagem !== undefined && f.personagem === p.look?.charId);
    const marcadas = (ficha?.condicoes ?? []).map((c) => regras.catalogo.condicao(c)?.nome ?? c);
    if (labels.length || marcadas.length || (this.gm && ficha))
      wrap.append(
        h(
          'div',
          { class: 'vt-conds' },
          ...labels.map((l) => h('span', { class: 'vt-cond' }, l)),
          ...marcadas.map((l) => h('span', { class: 'vt-cond marcada' }, l)),
          this.gm && ficha ? h('button', { class: 'vt-cond mais', type: 'button', title: 'Condições', 'aria-label': `Condições de ${p.name}`, onclick: () => this.escolherCondicoes(ficha) }, ic('mais'), marcadas.length ? null : h('span', null, 'Condição')) : null,
        ),
      );
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
    const sig = JSON.stringify([r?.id, r?.name, r?.description, cena?.floor, r?.area, !!url, this.campaign?.scenes.length]);
    if (sig === this.salaSig) return;
    this.salaSig = sig;
    clear(this.salaCorpo).append(
      this.polaroid(url ? h('img', { src: url, alt: '', 'data-room': String(r!.id) }) : h('span', { class: 'thumb-ph', 'data-room': String(r?.id ?? 0) })),
      h(
        'div',
        { class: 'sala-txt' },
        h('h3', { class: 'marca' }, nome),
        h('p', null, r?.description || 'Clique num objeto do cenário para ver descrição, interações e itens.'),
        h('div', { class: 'sala-chips' }, h('span', null, ic('pino'), (cena?.floor ?? 'Andar único').toUpperCase()), h('span', null, ic('camadas'), r?.area ? r.area.toUpperCase() : `${this.campaign?.scenes.length ?? 1} CÔMODOS`)),
      ),
    );
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
            ? (['Fechar a porta', 'Trancar a porta', 'Destrancar e abrir'][(it as FloorItem).state] ?? 'Abrir ou fechar')
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
          else if (porta && !lock) this.app.net.send({ t: 'use', id: it!.id });
          else if (lock && this.abrirTeclado(it as FloorItem)) return;
          else ((this.inspTab = lock ? 'desc' : 'items'), this.renderInspector(true));
        },
      },
      { id: 'usar', rotulo: 'Usar', icone: 'mao', ok: !!s && usa, dica: 'Ligar, acender, abrir a gaveta…', fazer: () => s && this.app.net.send({ t: 'use', id: it!.id }) },
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
    // folha de 4 direções: só as 4 poses; de 8 ou avatar pixel: as 8
    const allowed = def ? distinctFacings((k) => def.dirs.some((d, i) => d === k && (def.anims?.[i] ?? 'idle') === 'idle')) : [];
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
  private renderParty() {
    const party = this.campaign?.party ?? [];
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
      c.name.textContent = p.name.split(/\s+/)[0];
      c.name.title = p.name;
      const here = p.roomId === cur;
      const wasOn = c.el.classList.contains('on');
      c.el.classList.toggle('on', view.myId === id);
      c.el.classList.toggle('away', !here);
      c.away.textContent = here ? '' : this.sceneName(p.roomId);
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
        'data-token': String(id),
        onclick: () => this.pickCard(id),
      },
      h('span', { class: 'pc-photo' }, img, h('i', { class: 'pc-corner k1' }), h('i', { class: 'pc-corner k2' }), h('i', { class: 'pc-corner k3' }), h('i', { class: 'pc-corner k4' })),
      name,
      vitals,
      away,
      h('i', { class: 'pc-glow', 'aria-hidden': 'true' }),
      h('i', { class: 'pc-glare', 'aria-hidden': 'true' }),
      this.turnButton(id, false),
      this.turnButton(id, true),
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

  /** Botãozinho de girar no canto da carta (a carta inteira continua comandando). */
  private turnButton(id: number, cw: boolean) {
    const run = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      this.turnToken(id, cw);
    };
    return h(
      'span',
      {
        class: `pc-turn ${cw ? 'r' : 'l'}`,
        role: 'button',
        tabindex: '0',
        title: cw ? 'Girar para a direita (E)' : 'Girar para a esquerda (Q)',
        'aria-label': cw ? 'Girar para a direita' : 'Girar para a esquerda',
        onclick: run,
        onpointerdown: (e: Event) => e.stopPropagation(),
        onkeydown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && run(e),
      },
      cw ? '↻' : '↺',
    );
  }

  private pickCard(id: number) {
    const p = this.campaign?.party.find((x) => x.id === id);
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
      const ic = lootIcon(s.l.kind, 44);
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
    const s = this.sceneList().find((x) => x.id === id);
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

/** Planta girada em quartos de volta (r) no sentido horário, para encaixar o cômodo na planta. */
function rotateHm(hm: Heightmap, r: number): Heightmap {
  const k = ((r % 4) + 4) % 4;
  if (!k) return hm;
  const W = k % 2 ? hm.height : hm.width;
  const H = k % 2 ? hm.width : hm.height;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      const [ox, oy] = k === 1 ? [y, hm.height - 1 - x] : k === 2 ? [hm.width - 1 - x, hm.height - 1 - y] : [hm.width - 1 - y, x];
      return hm.tiles[oy]?.[ox] ?? null;
    }),
  );
  return { width: W, height: H, tiles };
}

/** Uma casa (x, y) do cômodo na planta girada. */
function rotatePt(hm: Heightmap, r: number, x: number, y: number): [number, number] {
  const k = ((r % 4) + 4) % 4;
  if (k === 1) return [hm.height - 1 - y, x];
  if (k === 2) return [hm.width - 1 - x, hm.height - 1 - y];
  if (k === 3) return [y, hm.width - 1 - x];
  return [x, y];
}
