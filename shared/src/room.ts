import { STACK_LIMIT, WALL_PX_PER_TILE, Z_PX } from './constants';
import { footprint, getFurni, getWallFurni, ocupa, type FurniDef } from './furni';
import { parseHeightmap, type Heightmap } from './heightmap';
import { computeWalls, type Door, type WallInfo } from './walls';
import type { ItemAction, Loot } from './rpg';

export interface Point {
  x: number;
  y: number;
}

export type HintIcon = 'inspect' | 'interact' | 'document' | 'gear' | 'alert';
export const HINT_ICONS: HintIcon[] = ['inspect', 'interact', 'document', 'gear', 'alert'];

/**
 * Fechadura com senha (passagem secreta): o mestre digita a senha e o mobi
 * desliza para o lado, revelando a passagem escondida que estava embaixo.
 */
export interface ItemLock {
  /** senha, só números (só o mestre recebe) */
  code?: string;
  open: boolean;
  /** quanto o mobi anda ao abrir, em casas */
  slide: { dx: number; dy: number };
  /** sem senha (o feno em cima do alçapão do celeiro): o clique duplo do mestre empurra e revela, e de novo cobre */
  semSenha?: boolean;
}

/** Piso do cômodo (cor e desenho do chão). */
export const FLOOR_STYLES = [
  { id: 'pedra', name: 'Pedra' },
  { id: 'concreto', name: 'Concreto' },
  { id: 'bloco', name: 'Bloco de concreto' },
  { id: 'cela', name: 'Concreto da prisão' },
  { id: 'madeira', name: 'Madeira escura' },
  { id: 'taco', name: 'Madeira clara' },
  { id: 'ladrilho', name: 'Ladrilho branco' },
  { id: 'xadrez', name: 'Xadrez' },
  { id: 'azulejo', name: 'Azulejo azul' },
  { id: 'carpete', name: 'Carpete roxo' },
  { id: 'musgo', name: 'Pedra verde' },
  { id: 'metal', name: 'Chapa de metal' },
  { id: 'terra', name: 'Terra' },
  { id: 'grama', name: 'Grama' },
  { id: 'estrada', name: 'Estrada de terra' },
  { id: 'lavoura', name: 'Terra arada' },
  { id: 'cascalho', name: 'Pedra clara' },
  { id: 'selo', name: 'Pedra antiga' },
  { id: 'pier', name: 'Tábuas do píer' },
  { id: 'calabouco', name: 'Pedra do calabouço' },
  // pixel art 1:1 (13/10): o ladrilho e a parede de azulejo e cal da cozinha da fazenda (scripts/3d/estilo/texturas_px.py)
  { id: 'cozinha_fazenda', name: 'Ladrilho da cozinha da fazenda' },
  // Santo Berço (14/10): as tábuas largas com a parede de taipa e vigas (taverna, casas) e a pedra escura da ferraria
  { id: 'enxaimel', name: 'Tábuas e enxaimel' },
  { id: 'ferraria', name: 'Pedra da ferraria' },
] as const;
export type FloorStyle = (typeof FLOOR_STYLES)[number]['id'];
export const isFloorStyle = (s: unknown): s is FloorStyle => FLOOR_STYLES.some((f) => f.id === s);

/**
 * Chão ao ar livre, casa por casa (`terreno` do cômodo): uma letra por casa, nas
 * mesmas linhas e colunas da planta. Letra fora da lista (ou '.') = o piso do cômodo.
 * A água fica numa casa vazia da planta ('x'): ninguém pisa, e o tabuleiro desenha a
 * água ali, mais baixa que a margem.
 */
export const TERRENOS: Record<string, FloorStyle | 'agua'> = {
  g: 'grama',
  t: 'estrada',
  l: 'lavoura',
  p: 'cascalho',
  d: 'terra',
  m: 'pier',
  a: 'agua',
};

/** O chão da casa (x, y) pelo terreno, ou null (vale o piso do cômodo). */
export function terrenoEm(terreno: string[] | undefined, x: number, y: number): FloorStyle | 'agua' | null {
  return TERRENOS[terreno?.[y]?.[x] ?? ''] ?? null;
}

/** Partículas do cômodo (enfeite): poeira que brilha na luz, fumaça e brasas do fogo. */
export const PARTICLE_KINDS = [
  { id: 'dust', name: 'Poeira na luz' },
  { id: 'smoke', name: 'Fumaça das velas' },
  { id: 'embers', name: 'Brasas do fogo' },
] as const;
export type ParticleKind = (typeof PARTICLE_KINDS)[number]['id'];
export const sanitizeParticles = (v: unknown): ParticleKind[] =>
  Array.isArray(v) ? PARTICLE_KINDS.map((p) => p.id).filter((id) => v.includes(id)) : [];
/** Quantidade de partículas quando a cena ainda não tem uma (0..1). */
export const DEFAULT_PARTICLE_LEVEL = 0.35;

/** Cor do ambiente: #rrggbb (tinge a escuridão do cômodo). */
export const isHexColor = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

/** Pista/interação que o mestre anexa a um mobi. */
export interface Hint {
  icon: HintIcon;
  title: string;
  text: string;
  /** false = só o mestre vê */
  visible: boolean;
}

export interface FloorItem {
  id: number;
  defId: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  state: number;
  hint?: Hint;
  /** Passagem: id do quarto de destino */
  link?: number;
  /** itens guardados dentro (gaveta, estante...) */
  loot?: Loot[];
  /** interações com teste (DT) */
  actions?: ItemAction[];
  /** o móvel mostra a arte VAZIA ("<defId>!vazio"), se houver: para lugares abandonados. Nada liga isso sozinho (ainda não há botão do mestre) */
  vazio?: boolean;
  /** o desenho escolhido entre os modelos do móvel ("05" = a arte `quadro_fazenda~05`); sem ele, sorteia pelo id */
  modelo?: string;
  /** fechadura com senha (passagem secreta) */
  lock?: ItemLock;
  /** tamanho do desenho (quadro na parede, tapete no chão), 1 = o do catálogo; o mestre muda no painel do objeto */
  escala?: number;
  /**
   * destruído (09/10, o orfanato queimado): aparece carbonizado e torto; não senta, não liga nem abre, e tapa só metade
   * da altura (cobertura). O mestre liga e desliga no painel do objeto.
   */
  quebrado?: boolean;
}

/** A altura que o móvel tapa de verdade: o quebrado, só a metade. */
export function alturaQueTapa(it: Pick<FloorItem, 'quebrado'>, def: { height: number }): number {
  return it.quebrado ? def.height * 0.5 : def.height;
}

export interface WallItem {
  id: number;
  defId: string;
  wall: 'l' | 'r';
  /** plano da parede: x para 'l', y para 'r' */
  plane: number;
  /** posição (centro) ao longo da parede, em tiles */
  pos: number;
  /** altura da base do item */
  z: number;
  state: number;
  hint?: Hint;
  loot?: Loot[];
  actions?: ItemAction[];
  /** levaram tudo: mostra a arte vazia, se houver */
  vazio?: boolean;
  /** o desenho escolhido entre os modelos do móvel ("05" = a arte `quadro_fazenda~05`); sem ele, sorteia pelo id */
  modelo?: string;
  /** tamanho do desenho (quadro na parede, tapete no chão), 1 = o do catálogo; o mestre muda no painel do objeto */
  escala?: number;
}

export type WalkState = 'blocked' | 'walk' | 'sit';

export interface PlaceResult {
  ok: boolean;
  z: number;
  reason?: string;
}

const fail = (reason: string): PlaceResult => ({ ok: false, z: 0, reason });

export class RoomMap {
  readonly hm: Heightmap;
  readonly door: Door;
  readonly walls: WallInfo;
  private items = new Map<number, FloorItem>();
  private wallItems = new Map<number, WallItem>();
  private grid: FloorItem[][][] = [];

  constructor(heightmap: string | Heightmap, door: Door, items: FloorItem[] = [], wallItems: WallItem[] = []) {
    this.hm = typeof heightmap === 'string' ? parseHeightmap(heightmap) : heightmap;
    this.door = door;
    this.walls = computeWalls(this.hm, door);
    for (const it of items) this.items.set(it.id, it);
    for (const w of wallItems) this.wallItems.set(w.id, w);
    this.rebuild();
  }

  get width() {
    return this.hm.width;
  }
  get height() {
    return this.hm.height;
  }

  floorHeight(x: number, y: number): number | null {
    // posição quebrada (um mobi deslizando, com o tremido): vale a casa embaixo
    const tx = Math.floor(x + 1e-6);
    const ty = Math.floor(y + 1e-6);
    if (tx < 0 || ty < 0 || tx >= this.hm.width || ty >= this.hm.height) return null;
    return this.hm.tiles[ty][tx];
  }

  isDoor(x: number, y: number) {
    return x === this.door.x && y === this.door.y;
  }

  // ---------- itens de chão ----------
  allItems(): FloorItem[] {
    return [...this.items.values()];
  }
  getItem(id: number) {
    return this.items.get(id);
  }
  addItem(it: FloorItem) {
    this.items.set(it.id, it);
    this.rebuild();
  }
  updateItem(it: FloorItem) {
    this.items.set(it.id, it);
    this.rebuild();
  }
  removeItem(id: number) {
    const ok = this.items.delete(id);
    this.rebuild();
    return ok;
  }

  // ---------- itens de parede ----------
  allWallItems(): WallItem[] {
    return [...this.wallItems.values()];
  }
  getWallItem(id: number) {
    return this.wallItems.get(id);
  }
  setWallItem(it: WallItem) {
    this.wallItems.set(it.id, it);
  }
  removeWallItem(id: number) {
    return this.wallItems.delete(id);
  }

  private rebuild() {
    const { width: w, height: h } = this.hm;
    this.grid = Array.from({ length: h }, () => Array.from({ length: w }, () => [] as FloorItem[]));
    for (const it of this.items.values()) {
      const def = getFurni(it.defId);
      if (!def) continue;
      const fp = footprint(def, it.rot);
      for (let dy = 0; dy < fp.sy; dy++)
        for (let dx = 0; dx < fp.sx; dx++) {
          const x = it.x + dx;
          const y = it.y + dy;
          if (x >= 0 && y >= 0 && x < w && y < h && ocupa(def, it.rot, dx, dy)) this.grid[y][x].push(it);
        }
    }
    for (const row of this.grid) for (const cell of row) if (cell.length > 1) cell.sort((a, b) => a.z - b.z || a.id - b.id);
  }

  itemsAt(x: number, y: number): FloorItem[] {
    return this.grid[y]?.[x] ?? [];
  }

  topItem(x: number, y: number): FloorItem | undefined {
    const cell = this.itemsAt(x, y);
    return cell[cell.length - 1];
  }

  /** Item de assento no tile (se houver). */
  sitItem(x: number, y: number): FloorItem | undefined {
    const cell = this.itemsAt(x, y);
    for (let i = cell.length - 1; i >= 0; i--) if (getFurni(cell[i].defId)?.sit && !cell[i].quebrado) return cell[i];
    return undefined;
  }

  walkState(x: number, y: number): WalkState {
    if (this.floorHeight(x, y) === null) return 'blocked';
    let sit = false;
    // embaixo da mesa vazada se passa (abaixado): ela e o que está em cima dela não tapam a casa
    const mesa = this.mesaDaCasa(x, y);
    const topo = mesa && mesa.def.vao === 'vazada' ? mesa.it.z + mesa.def.height - 0.01 : Infinity;
    for (const it of this.itemsAt(x, y)) {
      const def = getFurni(it.defId);
      if (!def) continue;
      if (mesa && (it === mesa.it ? def.vao === 'vazada' : it.z >= topo)) continue;
      // a cadeira quebrada não senta: tapa a casa como um móvel qualquer
      if (def.sit && !it.quebrado) sit = true;
      // porta aberta deixa passar; fechada (ou trancada), bloqueia, mesmo a passagem de pisar em cima
      else if (def.openState !== undefined ? it.state !== def.openState : !def.walkable) return 'blocked';
    }
    return sit ? 'sit' : 'walk';
  }

  /** A mesa com vão embaixo nesta casa (`vao`), se houver. */
  mesaDaCasa(x: number, y: number): { it: FloorItem; def: FurniDef } | undefined {
    for (const it of this.itemsAt(x, y)) {
      const def = getFurni(it.defId);
      if (def?.vao && !it.quebrado) return { it, def };
    }
    return undefined;
  }

  /** A casa fica embaixo de uma mesa vazada: quem está aqui está abaixado, escondido atrás dela. */
  sobMesa(x: number, y: number): boolean {
    return this.mesaDaCasa(x, y)?.def.vao === 'vazada';
  }

  /** O mobi de camas de andares (beliche) neste tile, se houver. */
  leitoItem(x: number, y: number): FloorItem | undefined {
    return this.itemsAt(x, y).find((it) => getFurni(it.defId)?.leitos?.length);
  }

  /** Altura em que um avatar fica no tile (piso, tapete ou assento; no beliche, a cama de baixo ou, com `alto`, a de cima). */
  standHeight(x: number, y: number, alto = false): number {
    const f = this.floorHeight(x, y) ?? 0;
    const cell = this.itemsAt(x, y);
    if (!cell.length) return f;
    let top = f;
    let seat: number | null = null;
    // embaixo da mesa: a mesa e o que está em cima dela não contam (a peça fica no chão)
    const mesa = this.mesaDaCasa(x, y);
    const topoMesa = mesa ? mesa.it.z + mesa.def.height - 0.01 : Infinity;
    for (const it of cell) {
      const def = getFurni(it.defId);
      if (!def) continue;
      if (mesa && (it === mesa.it || it.z >= topoMesa)) continue;
      const t = it.z + def.height;
      if (def.sit && !it.quebrado) seat = def.leitos?.length ? it.z + def.leitos[alto ? def.leitos.length - 1 : 0] : t;
      if (t > top) top = t;
    }
    return seat ?? top;
  }

  canPlace(defId: string, x: number, y: number, rot: number, ignoreId?: number): PlaceResult {
    const def = getFurni(defId);
    if (!def) return fail('Mobi desconhecido.');
    if (!def.rotations.includes(rot)) return fail('Rotação inválida.');
    if (!Number.isInteger(x) || !Number.isInteger(y)) return fail('Posição inválida.');
    const fp = footprint(def, rot);
    let base: number | null = null;
    let z = -Infinity;
    for (let dy = 0; dy < fp.sy; dy++)
      for (let dx = 0; dx < fp.sx; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        // a casa vazia da peça (o meio da mesa em U) não conta: lá dentro fica outra coisa
        if (!ocupa(def, rot, dx, dy)) continue;
        const h = this.floorHeight(tx, ty);
        if (h === null) return fail('Fora do quarto.');
        if (this.isDoor(tx, ty)) return fail('Não bloqueie a porta.');
        if (base === null) base = h;
        else if (h !== base) return fail('O piso precisa estar nivelado.');
        let tileTop = h;
        // tapete, símbolo no chão, mancha: vai para baixo dos móveis (fica no chão, por baixo de tudo)
        if (def.flat) {
          z = Math.max(z, h);
          continue;
        }
        const cell = this.itemsAt(tx, ty).filter((it) => it.id !== ignoreId);
        // a mesa com vão: a cadeira e a banqueta encaixam embaixo dela, no chão
        const mesa = cell.map((it) => ({ it, d: getFurni(it.defId) })).find((m) => m.d?.vao && !m.it.quebrado);
        const encaixa = (d: FurniDef, m: { it: FloorItem; d?: FurniDef }) => !!d.sit && !d.vao && d.height < (m.d?.height ?? 0) && m.it.z <= h + 0.01;
        if (mesa && encaixa(def, mesa)) {
          // embaixo dela, só ela (e o que estiver em cima): a casa precisa estar livre no chão
          const embaixo = cell.some((it) => {
            const idef = getFurni(it.defId);
            return it !== mesa.it && idef && !idef.flat && it.z < mesa.it.z + (mesa.d?.height ?? 0) - 0.01;
          });
          if (embaixo) return fail('Já tem algo embaixo da mesa.');
          z = Math.max(z, h);
          continue;
        }
        for (const it of cell) {
          const idef = getFurni(it.defId);
          if (!idef) continue;
          // a cadeira encaixada embaixo da mesa não conta: o que vai para a mesa fica em cima dela
          const sob = def.vao ? !!idef.sit && idef.height < def.height && it.z <= h + 0.01 : mesa && it !== mesa.it && encaixa(idef, mesa);
          if (sob) continue;
          if (!idef.stackable) return fail('Não dá para empilhar aqui.');
          tileTop = Math.max(tileTop, it.z + idef.height);
        }
        z = Math.max(z, tileTop);
      }
    if (z + def.height > STACK_LIMIT) return fail('Alto demais.');
    return { ok: true, z: Math.round(z * 1000) / 1000 };
  }

  /** Tiles ocupados por um mobi numa posição/rotação. */
  tilesFor(defId: string, x: number, y: number, rot: number): Point[] {
    const def = getFurni(defId);
    if (!def) return [];
    const fp = footprint(def, rot);
    const out: Point[] = [];
    for (let dy = 0; dy < fp.sy; dy++) for (let dx = 0; dx < fp.sx; dx++) if (ocupa(def, rot, dx, dy)) out.push({ x: x + dx, y: y + dy });
    return out;
  }

  canPlaceWall(defId: string, wall: 'l' | 'r', plane: number, pos: number, z: number): PlaceResult {
    const def = getWallFurni(defId);
    if (!def) return fail('Mobi de parede desconhecido.');
    if (![plane, pos, z].every(Number.isFinite)) return fail('Posição inválida.');
    const half = def.w / WALL_PX_PER_TILE / 2;
    const a0 = pos - half;
    const a1 = pos + half;
    let maxBase = -Infinity;
    for (let c = Math.floor(a0 + 1e-6); c <= Math.floor(a1 - 1e-6); c++) {
      const seg = this.walls.find(wall, plane, c);
      if (!seg) return fail('Precisa ficar inteiro numa parede.');
      if (seg.door) return fail('Não cubra a porta.');
      maxBase = Math.max(maxBase, seg.base);
    }
    if (z < maxBase + 0.05) return fail('Baixo demais.');
    if (z + def.h / Z_PX > this.walls.top - 0.02) return fail('Alto demais.');
    return { ok: true, z };
  }
}
