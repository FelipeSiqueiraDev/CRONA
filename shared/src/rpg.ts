import type { AvatarLook } from './avatar';
import type { ItemFicha } from './regras/ficha';
import type { SceneInfo } from './protocol';
import type { Vitals } from './vitals';

/** Tipos de item de RPG (ícone e rótulo). */
export type LootKind = 'weapon' | 'document' | 'key' | 'letter' | 'potion' | 'tape' | 'box' | 'misc';

export const LOOT_KINDS: { id: LootKind; label: string }[] = [
  { id: 'weapon', label: 'Arma Simples' },
  { id: 'document', label: 'Documento' },
  { id: 'key', label: 'Chave' },
  { id: 'letter', label: 'Carta' },
  { id: 'potion', label: 'Consumível' },
  { id: 'tape', label: 'Mídia' },
  { id: 'box', label: 'Caixa' },
  { id: 'misc', label: 'Item' },
];

export function lootKindLabel(k: LootKind) {
  return LOOT_KINDS.find((x) => x.id === k)?.label ?? 'Item';
}

/** Item do catálogo guardado no cenário: o mesmo da mochila, sem mão, roupa e origem. */
export type ItemNoCenario = Omit<ItemFicha, 'uid' | 'empunhado' | 'vestido' | 'achado' | 'descricao' | 'qtd'>;

/**
 * Item guardado num mobi (gaveta, estante...) ou largado no chão. Quem pega
 * leva para a mochila da ficha (docs/REGRAS.md, Mochila): o mesmo item, com o
 * mesmo número.
 */
export interface Loot {
  id: number;
  name: string;
  /** espaços que ocupa na mochila (LR p. 53) */
  espacos: number;
  kind: LootKind;
  /** nome de quem está com o item (só peça sem ficha: com ficha, o item vai para a mochila) */
  holder?: string;
  /** jogadores já podem ver */
  revealed?: boolean;
  /** item do catálogo: a faca da gaveta vira arma de verdade, com ataque */
  item?: ItemNoCenario;
  /** quantos (munição, frascos) */
  qtd?: number;
  /** texto do mestre ("Arquivos do Projeto Fulgor") */
  descricao?: string;
  /** a Ordem forneceu e alguém largou: ao pegar de novo, ocupa vaga da patente */
  daOrdem?: boolean;
}

/** Interação com teste: "Investigar (DT 15)". */
export interface ItemAction {
  id: number;
  label: string;
  dt: number;
}

export interface Objective {
  id: number;
  text: string;
  done: boolean;
}

export type LogIcon = 'user' | 'dice' | 'give' | 'scene' | 'obj';

export interface LogEntry {
  at: number;
  icon: LogIcon;
  text: string;
}

export interface PartyMember {
  name: string;
  /** id da conexão, se online */
  id: number | null;
  look: AvatarLook | null;
  load: number;
  capacity: number;
  roomId: number | null;
  color: string;
  /** está com a arma (retrato armado) */
  armed?: boolean;
  /** está machucado (retrato machucado, respiração irregular) */
  hurt?: boolean;
  /** PV, PE e SAN (atual e total) */
  vitals?: Vitals;
}

/** Tudo que a tela MAPA precisa sobre a campanha (cenas ligadas por Passagens). */
/** Anotação à mão do mestre na planta de um andar ("Acesso Restrito"), em células da planta. */
export interface NotaPlanta {
  id: number;
  andar: string;
  texto: string;
  x: number;
  y: number;
}

export interface CampaignState {
  key: number;
  title: string;
  subtitle: string;
  /** nome da operação em andamento ("Fulgor"), no topo da tela */
  operacao?: string;
  objectives: Objective[];
  /** posição de cada cena na planta (em células); r = giro em quartos de volta */
  layout: Record<number, { x: number; y: number; r?: number }>;
  log: LogEntry[];
  party: PartyMember[];
  scenes: SceneInfo[];
  /** anotações do mestre na planta, por andar */
  notas?: NotaPlanta[];
  /** as cenas onde um agente já pisou (o minimapa apaga as outras) */
  visitadas?: number[];
}

export const DEFAULT_CAPACITY = 10;

/** Nome, espaços (0 a 10, LR p. 53), tipo, quantidade e texto de um item novo do cenário. */
export function sanitizeLootInput(o: Record<string, unknown>): { name: string; espacos: number; kind: LootKind; qtd?: number; descricao?: string } | null {
  const name = typeof o.name === 'string' ? o.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
  // `weight`: o nome antigo dos espaços
  const n = typeof o.espacos === 'number' ? o.espacos : o.weight;
  const espacos = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 2) / 2)) : 1;
  const kind = LOOT_KINDS.some((k) => k.id === o.kind) ? (o.kind as LootKind) : 'misc';
  if (name.length < 1) return null;
  const out: { name: string; espacos: number; kind: LootKind; qtd?: number; descricao?: string } = { name, espacos, kind };
  if (typeof o.qtd === 'number' && Number.isInteger(o.qtd) && o.qtd > 1) out.qtd = Math.min(99, o.qtd);
  const d = typeof o.descricao === 'string' ? o.descricao.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 240) : '';
  if (d) out.descricao = d;
  return out;
}

/** Cor fixa de cada jogador (anel, retrato, minimapa). */
const PLAYER_COLORS = ['#e3a94c', '#d83a2e', '#3f6fd8', '#f2efe6', '#6fdc8c', '#c78bff', '#3fe0c0', '#ff6fb0'];
export function playerColorFor(name: string) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

export type { AvatarLook };
