/**
 * Contrato da sessão compartilhada: o que a interface recebe (Session) e o que
 * ela pode pedir (SessionAction). O servidor é quem decide; a interface mostra.
 * Detalhes e exemplos em docs/CONTRATO.md.
 */
import type { AvatarLook } from './avatar';
import { Z_PX } from './constants';
import type { Heightmap } from './heightmap';
import type { LightMode } from './protocol';
import type { LogEntry, LootKind, Objective } from './rpg';
import type { Vitals } from './vitals';
import { computeWalls, type Door } from './walls';

/** Mestre controla a sessão; jogador só acompanha. */
export type Role = 'gm' | 'player';
/** Papel de uma conta da plataforma: o mestre controla as sessões; o jogador, a própria ficha. */
export type PapelConta = 'mestre' | 'jogador';

/** Ponto no quadro da cena: 0..1 nos dois eixos (0,0 = canto superior esquerdo). */
export interface NormPoint {
  x: number;
  y: number;
}

/** Casa da grade de chão (colisão e caminho). */
export interface Tile {
  x: number;
  y: number;
}

/**
 * Como as casas se encaixam no quadro da cena. O ponto (tx, ty), em casas, na
 * altura tz, fica em:
 *   x = ox + (tx - ty) * hx
 *   y = oy + (tx + ty) * hy - tz * hz
 * O centro da casa (i, j) é (i + 0.5, j + 0.5). Use tileToPoint/pointToTile.
 */
export interface SceneGrid {
  ox: number;
  oy: number;
  hx: number;
  hy: number;
  hz: number;
}

export interface SceneExit {
  /** casa da passagem */
  tile: Tile;
  pos: NormPoint;
  /** cena de destino */
  to: number;
}

export interface Scene {
  id: number;
  /** nome curto ("Escritório") */
  name: string;
  /** nome completo ("Mansão Alvarez · Escritório") */
  title: string;
  /** andar ("Térreo", "Subsolo") */
  floor?: string;
  description: string;
  /** largura ÷ altura do quadro da cena */
  aspect: number;
  grid: SceneGrid;
  cols: number;
  rows: number;
  /** planta: uma linha por y; 'x' = sem chão, '0'-'9' e 'a'-'w' = altura */
  heightmap: string;
  exits: SceneExit[];
  lightMode: LightMode;
  /** névoa 0..1 */
  fog: number;
  /** escuridão 0..0.9 */
  darkness: number;
}

/** Objeto da cena que importa para o jogo: tem pista, itens ou interações. */
export interface SceneObject {
  id: number;
  sceneId: number;
  /** 'floor' = mobi no chão, 'wall' = na parede */
  kind: 'floor' | 'wall';
  defId: string;
  /** título da pista ou nome do mobi */
  name: string;
  description: string;
  /** tem pista escondida dos jogadores (só o mestre recebe true) */
  hidden: boolean;
  /** centro do objeto no quadro da cena */
  pos: NormPoint;
  /** topo do objeto (onde fica o ícone de pista) */
  top: NormPoint;
  itemIds: number[];
  interactions: { id: number; label: string; dt: number }[];
}

export interface Character {
  /** mesmo id da peça (Token) */
  id: number;
  name: string;
  color: string;
  capacity: number;
  /** soma dos pesos dos itens com o personagem, em todas as cenas */
  load: number;
  /** aparência; look.charId aponta para uma folha de sprite (CharacterDef) */
  look: AvatarLook;
  sceneId: number;
  /** com a arma e machucado: escolhem o retrato (ver PortraitState) */
  armed: boolean;
  /** a arma na mão (pela ficha): de fogo ou branca */
  arma?: 'fogo' | 'branca';
  hurt: boolean;
  /** PV, PE e SAN (atual e total); machucado = menos da metade dos PV */
  vitals?: Vitals;
}

export interface Token {
  /** mesmo id do Character */
  id: number;
  sceneId: number;
  /** casa atual */
  tile: Tile;
  /** centro da casa atual, na altura do chão */
  pos: NormPoint;
  /** próxima casa enquanto anda: chega lá em TOKEN_STEP_MS */
  to?: NormPoint;
  /**
   * Direção 0..7 na tela: 0 cima-direita, 1 direita, 2 baixo-direita, 3 baixo,
   * 4 baixo-esquerda, 5 esquerda, 6 cima-esquerda, 7 cima (na grade: 0 = −y,
   * 2 = +x, 4 = +y, 6 = −x). sheetDirFor(dir, ...) dá a linha da folha de sprite.
   */
  dir: number;
}

export interface Item {
  id: number;
  name: string;
  /** espaços que ocupa na mochila */
  espacos: number;
  /** texto do mestre */
  descricao?: string;
  kind: LootKind;
  kindLabel: string;
  sceneId: number;
  /** objeto da cena que guarda o item */
  objectId: number;
  /** personagem que está com o item (null = no objeto) */
  holderId: number | null;
  holderName: string | null;
  /** jogadores já podem ver */
  revealed: boolean;
}

/** Linha de "Últimas ações". */
export type GameEvent = LogEntry;

export interface Session {
  /** id da sessão (a campanha: cenas ligadas por passagens) */
  id: number;
  title: string;
  subtitle: string;
  me: { name: string; role: Role };
  /** cena que todos estão vendo (escolhida pelo mestre) */
  currentSceneId: number;
  scenes: Scene[];
  objects: SceneObject[];
  characters: Character[];
  tokens: Token[];
  items: Item[];
  objectives: Objective[];
  /** as últimas ações, da mais antiga para a mais nova */
  events: GameEvent[];
  /** posição de cada cena na planta do andar, em casas */
  layout: Record<number, { x: number; y: number }>;
}

/** Tudo o que a interface pode pedir. Só o mestre pode; o servidor recusa o resto. */
export type SessionAction =
  | { type: 'scene.change'; sceneId: number }
  /** walk = anda desviando dos móveis; place = coloca direto na casa livre mais próxima */
  | { type: 'token.move'; tokenId: number; to: NormPoint | { tile: Tile }; mode?: 'walk' | 'place' }
  /** vira a peça parada para a direção 0..7 (ver Token.dir) */
  | { type: 'token.face'; tokenId: number; dir: number }
  /** to = id do personagem, ou null para devolver o item ao objeto */
  | { type: 'item.give'; itemId: number; to: number | null }
  | { type: 'objective.add'; text: string }
  | { type: 'objective.set'; id: number; done: boolean }
  | { type: 'objective.remove'; id: number };

export type SessionActionType = SessionAction['type'];

export const SESSION_ACTIONS: SessionActionType[] = ['scene.change', 'token.move', 'token.face', 'item.give', 'objective.add', 'objective.set', 'objective.remove'];

/** Duração de um passo da peça (igual ao ciclo do servidor). */
export { TICK_MS as TOKEN_STEP_MS } from './constants';


// ------------------------------------------------------------------ casas ↔ quadro

// mesma geometria do desenho do tabuleiro (client/src/render/roomStatic.ts)
const WALL_T = 0.3;
const FLOOR_THICK = 0.55;

/** Projeção isométrica em pixels de mundo (casa 64×32, 32 px por unidade de altura). */
export function isoPx(x: number, y: number, z: number): [number, number] {
  return [(x - y) * 32, (x + y) * 16 - z * Z_PX];
}

/** Retângulo (pixels de mundo) que contém o chão e as paredes da cena. */
export function sceneFrame(hm: Heightmap, door: Door) {
  const walls = computeWalls(hm, door);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = ([x, y]: [number, number]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  let minH = Infinity;
  for (const row of hm.tiles) for (const t of row) if (t !== null && t < minH) minH = t;
  if (!Number.isFinite(minH)) minH = 0;
  for (let y = 0; y < hm.height; y++)
    for (let x = 0; x < hm.width; x++) {
      const h = hm.tiles[y][x];
      if (h === null) continue;
      add(isoPx(x, y, h));
      add(isoPx(x + 1, y + 1, minH - FLOOR_THICK));
      add(isoPx(x + 1, y, h));
      add(isoPx(x, y + 1, h));
    }
  for (const s of walls.segs) {
    if (s.wall === 'l') {
      add(isoPx(s.plane - WALL_T, s.at, walls.top));
      add(isoPx(s.plane - WALL_T, s.at + 1, walls.top));
    } else {
      add(isoPx(s.at, s.plane - WALL_T, walls.top));
      add(isoPx(s.at + 1, s.plane - WALL_T, walls.top));
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Grade e proporção do quadro de uma cena desenhada a partir da planta. */
export function sceneGrid(hm: Heightmap, door: Door): { grid: SceneGrid; aspect: number } {
  const f = sceneFrame(hm, door);
  const w = f.maxX - f.minX;
  const h = f.maxY - f.minY;
  return {
    aspect: r6(w / h),
    grid: { ox: r6(-f.minX / w), oy: r6(-f.minY / h), hx: r6(32 / w), hy: r6(16 / h), hz: r6(Z_PX / h) },
  };
}

/** Ponto em casas (contínuo) → quadro da cena. */
export function tileToPoint(grid: SceneGrid, tx: number, ty: number, tz = 0): NormPoint {
  return { x: r6(grid.ox + (tx - ty) * grid.hx), y: r6(grid.oy + (tx + ty) * grid.hy - tz * grid.hz) };
}

/** Centro da casa no quadro da cena. */
export function tileCenter(grid: SceneGrid, tile: Tile, z = 0): NormPoint {
  return tileToPoint(grid, tile.x + 0.5, tile.y + 0.5, z);
}

/** Casa do chão sob o ponto (considera a altura de cada casa; a da frente ganha). */
export function pointToTile(grid: SceneGrid, hm: Heightmap, p: NormPoint): Tile | null {
  let best: Tile | null = null;
  let bestKey = -Infinity;
  for (let y = 0; y < hm.height; y++)
    for (let x = 0; x < hm.width; x++) {
      const h = hm.tiles[y][x];
      if (h === null) continue;
      const c = tileToPoint(grid, x + 0.5, y + 0.5, h);
      if (Math.abs(p.x - c.x) / grid.hx + Math.abs(p.y - c.y) / grid.hy > 1) continue;
      const key = (x + y) * 1000 + h;
      if (key > bestKey) {
        bestKey = key;
        best = { x, y };
      }
    }
  return best;
}

/** Casas aceitas por `accept`, da mais perto para a mais longe do ponto (distância na tela). */
export function tilesByDistance(grid: SceneGrid, hm: Heightmap, p: NormPoint, accept: (x: number, y: number) => boolean): Tile[] {
  const out: { t: Tile; d: number }[] = [];
  for (let y = 0; y < hm.height; y++)
    for (let x = 0; x < hm.width; x++) {
      const h = hm.tiles[y][x];
      if (h === null || !accept(x, y)) continue;
      const c = tileToPoint(grid, x + 0.5, y + 0.5, h);
      // de volta a pixels de mundo, para a distância não depender da proporção
      const dx = ((p.x - c.x) * 32) / grid.hx;
      const dy = ((p.y - c.y) * 16) / grid.hy;
      out.push({ t: { x, y }, d: dx * dx + dy * dy });
    }
  return out.sort((a, b) => a.d - b.d).map((o) => o.t);
}

/** "Mansão Alvarez · Escritório" → "Escritório". */
export function sceneShortName(title: string) {
  return title.split('·').pop()!.trim() || title;
}
