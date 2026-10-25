/**
 * Onde cada item da mochila está: na mão, vestido ou guardado (LR p. 53).
 * Na mão vão as armas, o escudo e os itens "empunhado" (lanterna, celular...),
 * no máximo dois: a arma de duas mãos ocupa as duas. Vestidos vão as
 * proteções e os itens "vestido", sem limite além da carga. Sacar ou guardar
 * é ação de movimento; largar, livre; vestir, padrão; tirar, movimento.
 */
import * as cat from './dados';
import type { ItemFicha } from './ficha';
import { NOME_ELEMENTO } from './requisitos';

/** Mãos de um agente. */
export const MAOS = 2;

export type LugarItem = 'mao' | 'vestido' | 'mochila';

export type ResultadoMochila = { ok: true; inventario: ItemFicha[] } | { ok: false; motivo: string };

const erro = (motivo: string): ResultadoMochila => ({ ok: false, motivo });

/** Especial do item do catálogo ("empunhado", "vestido", "consumível"...). */
function especial(it: ItemFicha): string[] {
  if (it.tipo === 'equipamento') return cat.equipamento(it.id)?.especial ?? [];
  if (it.tipo === 'amaldicoado') return cat.amaldicoado(it.id)?.especial ?? [];
  return [];
}

/** Nome do item: o apelido, o do catálogo ou o do cenário. */
export function nomeDoItem(it: ItemFicha): string {
  if (it.apelido) return it.apelido;
  if (it.tipo === 'cena') return it.nome || it.id;
  const b = it.tipo === 'arma' ? cat.arma(it.id) : it.tipo === 'protecao' ? cat.protecao(it.id) : it.tipo === 'equipamento' ? cat.equipamento(it.id) : cat.amaldicoado(it.id);
  let nome = b?.nome ?? it.id;
  // o que se escolheu ao requisitar: "Amarras de Sangue", "Utensílio (Investigação)"
  const el = it.escolha?.elemento;
  if (el) nome = /\(elemento\)/i.test(nome) ? nome.replace(/\(elemento\)/i, NOME_ELEMENTO[el]) : `${nome} (${NOME_ELEMENTO[el]})`;
  if (it.escolha?.pericia) nome = `${nome} (${cat.pericia(it.escolha.pericia).nome})`;
  return nome;
}

/** Quantas mãos o item ocupa na mão (0 = não se empunha). */
export function maosDoItem(it: ItemFicha): number {
  switch (it.tipo) {
    case 'arma': {
      const a = it.id === 'ataque-desarmado' ? undefined : cat.arma(it.id);
      return a ? (a.empunhadura === 'duasMaos' ? 2 : 1) : 0;
    }
    case 'protecao':
      return cat.protecao(it.id)?.tipo === 'escudo' ? 1 : 0;
    case 'equipamento':
    case 'amaldicoado':
      return especial(it).includes('empunhado') ? 1 : 0;
    default:
      return 0;
  }
}

/** O item se veste: proteção leve ou pesada e itens "vestido". */
export function vestivel(it: ItemFicha): boolean {
  if (it.tipo === 'protecao') {
    const p = cat.protecao(it.id);
    return !!p && p.tipo !== 'escudo';
  }
  return especial(it).includes('vestido');
}

/** Gasta ao usar (granada, medicamento, catalisador; no cenário, o "consumível"). */
export function consumivel(it: ItemFicha): boolean {
  if (it.tipo === 'cena') return it.tipoCena === 'potion';
  return especial(it).includes('consumível');
}

/** Onde o item está. O vestível começa vestido; o que se empunha, guardado. */
export function lugarDoItem(it: ItemFicha): LugarItem {
  if (it.empunhado === true && maosDoItem(it)) return 'mao';
  if (it.vestido !== false && vestivel(it)) return 'vestido';
  return 'mochila';
}

/** Mãos ocupadas pelos itens empunhados. */
export function maosOcupadas(inv: ItemFicha[]): number {
  let n = 0;
  for (const it of inv) if (lugarDoItem(it) === 'mao') n += maosDoItem(it);
  return n;
}

/** Com uma arma na mão, o personagem está armado (retrato, pose e peça). */
export function armado(inv: ItemFicha[]): boolean {
  return inv.some((it) => it.tipo === 'arma' && lugarDoItem(it) === 'mao');
}

/** "a, b e c" */
function lista(nomes: string[]): string {
  return nomes.length < 2 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

function indice(inv: ItemFicha[], uid: number): number {
  return inv.findIndex((x) => x.uid === uid);
}

/**
 * Empunha o item. Sem mão livre, recusa dizendo o que está na mão; com
 * `trocar`, guarda primeiro o que for preciso (o do mesmo tipo antes: arma
 * troca com arma) e então empunha.
 */
export function empunhar(inv: ItemFicha[], uid: number, trocar = false): ResultadoMochila {
  const i = indice(inv, uid);
  if (i < 0) return erro('Item não encontrado.');
  const it = inv[i];
  const precisa = maosDoItem(it);
  if (!precisa) return erro(`${nomeDoItem(it)} não se empunha.`);
  if (lugarDoItem(it) === 'mao') return { ok: true, inventario: inv };
  const out = inv.map((x) => ({ ...x }));
  let livres = MAOS - maosOcupadas(inv);
  if (livres < precisa) {
    if (!trocar) return erro(`Mãos ocupadas: ${lista(inv.filter((x) => lugarDoItem(x) === 'mao').map(nomeDoItem))}.`);
    const naMao = out.map((x, j) => j).filter((j) => lugarDoItem(out[j]) === 'mao');
    naMao.sort((a, b) => Number(out[b].tipo === it.tipo) - Number(out[a].tipo === it.tipo) || b - a);
    for (const j of naMao) {
      if (livres >= precisa) break;
      livres += maosDoItem(out[j]);
      out[j].empunhado = false;
    }
  }
  out[i].empunhado = true;
  return { ok: true, inventario: out };
}

/** Guarda o item empunhado na mochila. */
export function guardar(inv: ItemFicha[], uid: number): ResultadoMochila {
  const i = indice(inv, uid);
  if (i < 0) return erro('Item não encontrado.');
  if (lugarDoItem(inv[i]) !== 'mao') return { ok: true, inventario: inv };
  return { ok: true, inventario: inv.map((x, j) => (j === i ? { ...x, empunhado: false } : x)) };
}

/** Veste o item (proteção ou item "vestido"). */
export function vestir(inv: ItemFicha[], uid: number): ResultadoMochila {
  const i = indice(inv, uid);
  if (i < 0) return erro('Item não encontrado.');
  if (!vestivel(inv[i])) return erro(`${nomeDoItem(inv[i])} não se veste.`);
  return { ok: true, inventario: inv.map((x, j) => (j === i ? { ...x, vestido: true } : x)) };
}

/** Tira o item vestido e guarda na mochila. */
export function tirar(inv: ItemFicha[], uid: number): ResultadoMochila {
  const i = indice(inv, uid);
  if (i < 0) return erro('Item não encontrado.');
  if (!vestivel(inv[i])) return { ok: true, inventario: inv };
  return { ok: true, inventario: inv.map((x, j) => (j === i ? { ...x, vestido: false } : x)) };
}

/** Usa o item: o consumível gasta um (e sai da mochila no último). */
export function usar(inv: ItemFicha[], uid: number): ResultadoMochila & { gastou?: boolean } {
  const i = indice(inv, uid);
  if (i < 0) return erro('Item não encontrado.');
  const it = inv[i];
  if (!consumivel(it)) return { ok: true, inventario: inv, gastou: false };
  const qtd = (it.qtd ?? 1) - 1;
  const resto = (x: ItemFicha): ItemFicha => {
    const { qtd: _q, ...sem } = x;
    void _q;
    return qtd > 1 ? { ...sem, qtd } : sem;
  };
  const out = qtd > 0 ? inv.map((x, j) => (j === i ? resto(x) : x)) : inv.filter((_, j) => j !== i);
  return { ok: true, inventario: out, gastou: true };
}

/**
 * Tira o item da mochila (para entregar ou largar). Sai da mão e deixa de
 * estar vestido: quem recebe guarda na mochila.
 */
export function retirar(inv: ItemFicha[], uid: number): { ok: true; inventario: ItemFicha[]; item: ItemFicha } | { ok: false; motivo: string } {
  const i = indice(inv, uid);
  if (i < 0) return { ok: false, motivo: 'Item não encontrado.' };
  const { empunhado: _e, vestido: _v, ...item } = inv[i];
  void _e;
  void _v;
  return { ok: true, inventario: inv.filter((_, j) => j !== i), item: vestivel(item) ? { ...item, vestido: false } : item };
}

/** Dá um número (uid) a cada item que ainda não tem. Devolve true se mudou algo. */
export function numerarItens(inv: ItemFicha[], proximo: () => number): boolean {
  let mudou = false;
  for (const it of inv)
    if (!Number.isInteger(it.uid)) {
      it.uid = proximo();
      mudou = true;
    }
  return mudou;
}
