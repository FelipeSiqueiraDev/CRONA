/**
 * Um inventário só (docs/REGRAS.md, Mochila): o item do cenário (Loot, num
 * mobi ou no chão) e o da mochila (ItemFicha) são o mesmo item em dois
 * lugares, com o mesmo número. Pegar faz dele um item da ficha, achado na
 * missão; largar devolve ao cenário.
 */
import * as cat from './regras/dados';
import type { ItemFicha, TipoItemCatalogo } from './regras/ficha';
import { nomeDoItem, vestivel } from './regras/mochila';
import type { Loot, LootKind } from './rpg';

const TIPOS: TipoItemCatalogo[] = ['arma', 'protecao', 'equipamento', 'amaldicoado'];

/** O item existe no catálogo? */
export function noCatalogo(tipo: unknown, id: unknown): tipo is TipoItemCatalogo {
  if (typeof id !== 'string' || !TIPOS.includes(tipo as TipoItemCatalogo)) return false;
  return !!(tipo === 'arma' ? cat.arma(id) : tipo === 'protecao' ? cat.protecao(id) : tipo === 'equipamento' ? cat.equipamento(id) : cat.amaldicoado(id));
}

/** Ícone do item da mochila no cenário. */
export function kindDoItem(it: ItemFicha): LootKind {
  if (it.tipo === 'cena') return (it.tipoCena as LootKind) || 'misc';
  if (it.tipo === 'arma') return 'weapon';
  if (it.tipo === 'equipamento') {
    const g = cat.equipamento(it.id)?.grupo;
    if (g === 'medicamento') return 'potion';
    if (it.id === 'chaves') return 'key';
    if (it.id === 'documentos-falsos' || it.id === 'manual-operacional') return 'document';
  }
  return 'misc';
}

/** Espaços do item (do catálogo, ou o que o mestre deu ao item do cenário). */
export function espacosDoItemFicha(it: ItemFicha): number {
  if (it.tipo === 'cena') return it.espacos ?? 1;
  const b = it.tipo === 'arma' ? cat.arma(it.id) : it.tipo === 'protecao' ? cat.protecao(it.id) : it.tipo === 'equipamento' ? cat.equipamento(it.id) : cat.amaldicoado(it.id);
  return b?.espacos ?? 1;
}

/**
 * Item do cenário que alguém pegou: entra na mochila com o mesmo número, como
 * achado na missão (o que a Ordem forneceu e foi largado continua da Ordem).
 * O que se veste entra guardado: vestir é uma ação à parte (LR p. 53, 63).
 */
export function lootParaItem(l: Loot): ItemFicha {
  const extra: Partial<ItemFicha> = { uid: l.id };
  if (!l.daOrdem) extra.achado = true;
  if ((l.qtd ?? 1) > 1) extra.qtd = l.qtd;
  if (l.descricao) extra.descricao = l.descricao;
  if (l.item && noCatalogo(l.item.tipo, l.item.id)) {
    const it: ItemFicha = { ...l.item, ...extra };
    // o nome que o mestre deu no cenário ("Faca de Cozinha") fica como apelido
    // (sem contar maiúsculas e acentos: o item largado antes da troca de nomes de 25/10 tem o nome antigo, só com outra caixa)
    const plano = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    if (l.name && !it.apelido && plano(l.name) !== plano(nomeDoItem({ id: l.item.id, tipo: l.item.tipo }))) it.apelido = l.name;
    if (vestivel(it)) it.vestido = false;
    return it;
  }
  return { id: l.name, tipo: 'cena', nome: l.name, espacos: l.espacos, tipoCena: l.kind, ...extra };
}

/** Item da mochila largado no cenário: visível para todos, com o mesmo número. */
export function itemParaLoot(it: ItemFicha): Loot {
  const l: Loot = { id: it.uid ?? 0, name: nomeDoItem(it), espacos: espacosDoItemFicha(it), kind: kindDoItem(it), revealed: true };
  if (!it.achado && it.tipo !== 'cena') l.daOrdem = true;
  if ((it.qtd ?? 1) > 1) l.qtd = it.qtd;
  if (it.descricao) l.descricao = it.descricao;
  if (it.tipo !== 'cena') {
    const { uid: _u, empunhado: _e, vestido: _v, achado: _a, descricao: _d, qtd: _q, ...item } = it;
    void [_u, _e, _v, _a, _d, _q];
    l.item = item as Loot['item'];
  }
  return l;
}
