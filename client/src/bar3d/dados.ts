/**
 * Os dados REAIS da cena do Bar da Ordem para o protótipo 3D: o `bar.json` sai do banco de testes por
 * `scripts/dev/exportar-bar3d.mts` (heightmap, móveis com giro, altura e tamanho, itens de parede, porta). O mapa de
 * casas e o caminho são os mesmos do jogo (`RoomMap` e `findPath`, de @crona/shared).
 */
import { RoomMap, type FloorItem, type WallItem } from '@crona/shared';

/** O lado de uma casa, em metros (a casa do jogo tem 0,75 m). */
export const CASA = 0.75;

export interface DefBar {
  id: string;
  name: string;
  kind: string;
  category: string;
  width: number;
  depth: number;
  alturaM: number;
  walkable: boolean;
  sit: boolean;
  flat: boolean;
  states: number;
  vazio: [number, number][] | null;
  vao: string | null;
  colors: string[];
  aumento: number;
}

export interface MobiBar {
  id: number;
  defId: string;
  x: number;
  y: number;
  /** a altura onde a peça está (em unidades de altura do jogo; ÷ Z_PER_M dá metros) */
  z: number;
  rot: number;
  state: number;
  lock?: unknown;
  link?: number;
}

export interface ParedeBar {
  id: number;
  defId: string;
  wall: 'l' | 'r';
  pos: number;
  z: number;
  plane: number;
  state: number;
}

export interface DefParede {
  id: string;
  name: string;
  kind: string;
  w: number;
  h: number;
  colors: string[];
}

export interface DadosBar {
  cena: {
    id: number;
    nome: string;
    descricao: string;
    heightmap: string;
    door: { x: number; y: number; dir: number };
    ambient: string;
    darkness: number;
    fog: number;
    floorStyle: string;
    particles: string[];
  };
  mobis: MobiBar[];
  parede: ParedeBar[];
  defs: Record<string, DefBar>;
  defsParede: Record<string, DefParede>;
  M_POR_CASA: number;
  Z_PER_M: number;
}

export async function carregarBar(): Promise<{ dados: DadosBar; mapa: RoomMap }> {
  const r = await fetch('/prototipo3d/bar.json');
  const dados = (await r.json()) as DadosBar;
  const itens = dados.mobis.map((m) => ({ id: m.id, defId: m.defId, x: m.x, y: m.y, z: m.z, rot: m.rot, state: m.state, ...(m.link !== undefined ? { link: m.link } : {}) }) as FloorItem);
  const paredes = dados.parede.map((w) => ({ id: w.id, defId: w.defId, wall: w.wall, pos: w.pos, z: w.z, plane: w.plane, state: w.state }) as unknown as WallItem);
  const mapa = new RoomMap(dados.cena.heightmap, dados.cena.door, itens, paredes);
  return { dados, mapa };
}

/** A casa do mundo (metros) para a casa do jogo, e o contrário. */
export const casaDe = (x: number, z: number) => ({ x: Math.floor(x / CASA), y: Math.floor(z / CASA) });
export const centroDa = (cx: number, cy: number) => ({ x: (cx + 0.5) * CASA, z: (cy + 0.5) * CASA });

/** O tamanho da pegada de um móvel girado (as casas em x e em y). */
export function pegada(def: Pick<DefBar, 'width' | 'depth'>, rot: number) {
  return rot === 2 || rot === 6 ? { sx: def.depth, sy: def.width } : { sx: def.width, sy: def.depth };
}

/** O giro do móvel para o desenho: a frente (+Z do móvel) aponta para onde o jogo diz (4 = +y, 0 = −y, 2 = +x, 6 = −x). */
export function anguloDoGiro(rot: number): number {
  return rot === 0 ? Math.PI : rot === 2 ? Math.PI / 2 : rot === 6 ? -Math.PI / 2 : 0;
}
