/**
 * Junta duas mudanças da mesma ficha (27/10, auditoria: "a ficha inteira por cima").
 *
 * Quem edita guarda a cópia de onde partiu (`base`). Quando grava, o servidor tem a ficha de agora (`atual`), que pode
 * ter mudado no meio do caminho (o dano do combate, o item que o colega entregou, a condição que o mestre marcou).
 * A mescla de três vias fica com o que cada lado mudou: o que só um lado mexeu vale; o que os dois mexeram, vale quem
 * grava agora. As listas com chave (os itens pelo `uid`, as notas pelo `id`) e as de texto (condições, favoritos) se
 * juntam item a item: o item que um lado tirou sai, o que um lado pôs fica.
 */
import type { FichaSalva } from './fichas';

type Obj = Record<string, unknown>;

const ehObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || !a || !b || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => iguais(x, bb[i]));
  }
  const ka = Object.keys(a as Obj).filter((k) => (a as Obj)[k] !== undefined);
  const kb = Object.keys(b as Obj).filter((k) => (b as Obj)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => iguais((a as Obj)[k], (b as Obj)[k]));
}

/** A chave de um item da lista: o `uid` dos itens, o `id` das notas e das jogadas. */
function chave(x: unknown): string | undefined {
  if (typeof x === 'string') return `s:${x}`;
  if (!ehObj(x)) return undefined;
  if (typeof x.uid === 'number') return `u:${x.uid}`;
  if (typeof x.id === 'string' || typeof x.id === 'number') return `i:${String(x.id)}`;
  return undefined;
}

/** As chaves da lista, se todo item tem uma e nenhuma se repete (senão a lista se mescla inteira). */
function chaves(l: unknown[]): string[] | null {
  const ks: string[] = [];
  const vistos = new Set<string>();
  for (const x of l) {
    const k = chave(x);
    // item novo sem número (o item que acabou de entrar na mochila) não tem chave, mas entra
    if (k === undefined) {
      if (ehObj(x) && !('uid' in x) && !('id' in x)) {
        ks.push('');
        continue;
      }
      return null;
    }
    if (vistos.has(k)) return null;
    vistos.add(k);
    ks.push(k);
  }
  return ks;
}

function mesclarLista(base: unknown[], minha: unknown[], atual: unknown[]): unknown[] {
  const kb = chaves(base);
  const km = chaves(minha);
  const ka = chaves(atual);
  // sem chave: quem grava agora vence
  if (!kb || !km || !ka || [...kb, ...ka].includes('')) return minha;
  const naBase = new Map(kb.map((k, i) => [k, base[i]]));
  const naMinha = new Map(km.map((k, i) => [k, minha[i]] as const).filter(([k]) => k));
  const out: unknown[] = [];
  // a ordem de agora; o que eu tirei sai, o que mexi se mescla
  ka.forEach((k, i) => {
    const m = naMinha.get(k);
    if (m === undefined) {
      if (naBase.has(k)) return;
      out.push(atual[i]);
      return;
    }
    out.push(mesclar(naBase.get(k), m, atual[i]));
  });
  // o que eu pus (e o servidor não tirou)
  const emAtual = new Set(ka);
  km.forEach((k, i) => {
    if (k === '') return void out.push(minha[i]);
    if (!emAtual.has(k) && !naBase.has(k)) out.push(minha[i]);
  });
  return out;
}

/** A mescla de três vias de um valor qualquer da ficha. */
export function mesclar(base: unknown, minha: unknown, atual: unknown): unknown {
  if (iguais(minha, base)) return atual;
  if (iguais(atual, base) || iguais(minha, atual)) return minha;
  if (Array.isArray(base) && Array.isArray(minha) && Array.isArray(atual)) return mesclarLista(base, minha, atual);
  if (ehObj(minha) && ehObj(atual)) {
    const b = ehObj(base) ? base : {};
    const out: Obj = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(minha), ...Object.keys(atual)])) {
      const v = mesclar(b[k], minha[k], atual[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return minha;
}

/** A ficha que o jogador (ou a janela) mexeu, sem apagar o que mudou no servidor desde a `base`. */
export function mesclarFicha(base: FichaSalva, minha: FichaSalva, atual: FichaSalva): FichaSalva {
  // a hora da gravação não é mudança de ninguém
  const semHora = (f: FichaSalva) => ({ ...f, atualizadaEm: '' });
  const r = mesclar(semHora(base), semHora(minha), semHora(atual)) as FichaSalva;
  r.atualizadaEm = minha.atualizadaEm;
  return r;
}
