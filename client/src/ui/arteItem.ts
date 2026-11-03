/**
 * A arte de um item, a mesma em todas as telas (FICHAS, aba ITENS, requisição, COMBATE): a
 * pintada (arte/itens/pintados/), depois o ícone da FICHAS (arte/itens/) e, sem arte, o desenho
 * de linha. O item achado no cenário procura pelo nome ("chave-do-arsenal") e depois pelo tipo
 * ("tipo-chave"); sem arte, o desenho do tipo.
 */
import { regras, type Loot, type LootKind } from '@crona/shared';
import { arteOu, ic } from './icons';
import { lootIcon } from './lootIcons';

/** Nome do tipo do item do cenário nos arquivos de arte (docs/ARTE.md, Itens). */
export const TIPO_CENA: Record<LootKind, string> = { weapon: 'arma', document: 'documento', key: 'chave', letter: 'carta', potion: 'consumivel', tape: 'midia', box: 'caixa', misc: 'item' };

/** `icone`: o ícone de linha do item (infoItem().icone), para quando não há arte. */
export function arteDoItem(it: Pick<regras.ItemFicha, 'id' | 'tipo' | 'nome' | 'tipoCena'>, icone: string, cls = 'ic'): HTMLElement {
  if (it.tipo === 'cena') {
    const kind = ((it.tipoCena as LootKind) || 'misc') as LootKind;
    const nome = regras.slug(it.nome || it.id);
    const tipo = `tipo-${TIPO_CENA[kind]}`;
    return arteOu([`/arte/itens/pintados/${nome}.png`, `/arte/itens/${nome}.png`, `/arte/itens/pintados/${tipo}.png`, `/arte/itens/${tipo}.png`], lootIcon(kind, 44), cls);
  }
  // a munição de calibre grosso usa a arte da munição normal (LR p. 60)
  const base = it.id.replace(/-calibre-grosso$/, '');
  return arteOu([`/arte/itens/pintados/${it.id}.png`, `/arte/itens/${it.id}.png`, ...(base !== it.id ? [`/arte/itens/pintados/${base}.png`, `/arte/itens/${base}.png`] : [])], ic(icone), cls);
}

/**
 * O ícone do item que está no cenário (o cartão "Contém" do painel OBJETO, o do documento, a entrega): a arte pintada do
 * catálogo quando é item do livro (a faca da gaveta), depois a do nome e a do tipo; sem arte, o desenho do tipo.
 * (03/11, o Felipe: o ícone da faca era o desenho de linha, "feião".)
 */
export function arteDoLoot(l: Pick<Loot, 'name' | 'kind' | 'item'>, tam = 52, cls = 'ic'): HTMLElement {
  const nome = regras.slug(l.name);
  const id = l.item?.id ?? '';
  const base = id.replace(/-calibre-grosso$/, '');
  const tipo = `tipo-${TIPO_CENA[l.kind]}`;
  const urls = [
    ...(id ? [`/arte/itens/pintados/${id}.png`, `/arte/itens/${id}.png`] : []),
    ...(base && base !== id ? [`/arte/itens/pintados/${base}.png`, `/arte/itens/${base}.png`] : []),
    `/arte/itens/pintados/${nome}.png`,
    `/arte/itens/${nome}.png`,
    `/arte/itens/pintados/${tipo}.png`,
    `/arte/itens/${tipo}.png`,
  ];
  return arteOu(urls, lootIcon(l.kind, tam), cls);
}
