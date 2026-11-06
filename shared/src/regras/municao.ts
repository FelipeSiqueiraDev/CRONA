/**
 * A contagem de munição concreta (LR p. 174, regra opcional que a mesa usa desde 06/11: "se um disparo for
 * efetuado a munição TEM que contar"):
 * - cada pacote tem munição para 20 ataques (o foguete, para 1);
 * - a arma de fogo tem a capacidade de armazenamento: faz esse número de ataques antes de recarregar
 *   (ação de movimento), tirando dos pacotes da mochila;
 * - a rajada gasta 10 balas e, nesta regra, causa +2 dados de dano (em vez de +1).
 * A arma sem capacidade no livro (arco, besta, lança-chamas, bazuca) tira direto do pacote a cada ataque.
 */
import * as cat from './dados';
import { MUNICAO_CALIBRE_GROSSO } from './dados/equipamentos';
import type { ItemFicha } from './ficha';

/** Ataques por pacote (LR p. 174). */
export const BALAS_POR_PACOTE = 20;

/** A rajada gasta 10 balas (LR p. 174). */
export const BALAS_DA_RAJADA = 10;

/**
 * A capacidade de armazenamento (LR p. 174). O revólver compacto e a pistola pesada (SaH) não estão na lista do livro:
 * ficam com a do revólver e a da pistola; a espingarda de cano duplo leva 2 cartuchos (os dois canos).
 */
export const CAPACIDADE: Record<string, number> = {
  pistola: 12,
  revolver: 6,
  'fuzil-de-caca': 4,
  submetralhadora: 20,
  espingarda: 6,
  'fuzil-de-assalto': 30,
  'fuzil-de-precisao': 1,
  metralhadora: 50,
  'revolver-compacto': 6,
  'pistola-pesada': 12,
  'espingarda-cano-duplo': 2,
};

/** A munição que a arma pede (com a de calibre grosso, se ela tiver a modificação; LR p. 60). */
export function municaoDaArma(arma: ItemFicha): string | undefined {
  if (arma.tipo !== 'arma') return undefined;
  const base = cat.arma(arma.id)?.municao;
  // o estilingue usa as bolinhas, que ocupam o mesmo espaço dele (SaH p. 37): não conta
  if (!base || base === 'bolinhas') return undefined;
  return arma.modificacoes?.includes('calibre-grosso') ? base + MUNICAO_CALIBRE_GROSSO : base;
}

/** As balas de um pacote ainda fechado ou já aberto. */
export function balasDoPacote(it: ItemFicha): number {
  return it.balas ?? (it.id.startsWith('foguete') ? 1 : BALAS_POR_PACOTE);
}

/** Quanto há nos pacotes da mochila: o aberto conta o que sobrou, os fechados contam cheios. */
export function balasNaMochila(inv: ItemFicha[], municao: string): number {
  return inv.filter((x) => x.tipo === 'equipamento' && x.id === municao).reduce((t, x) => t + balasDoPacote(x) + (Math.max(1, x.qtd ?? 1) - 1) * (x.id.startsWith('foguete') ? 1 : BALAS_POR_PACOTE), 0);
}

export interface EstadoMunicao {
  municao: string;
  nome: string;
  /** capacidade da arma (sem ela, tira direto do pacote) */
  capacidade?: number;
  /** balas na arma agora (só com capacidade) */
  naArma?: number;
  /** balas que sobram nos pacotes da mochila */
  naMochila: number;
}

/** O que a arma tem de munição. A arma nova vem carregada (a primeira carga é da requisição). */
export function estadoMunicao(inv: ItemFicha[], arma: ItemFicha): EstadoMunicao | null {
  const municao = municaoDaArma(arma);
  if (!municao) return null;
  const capacidade = CAPACIDADE[arma.id];
  return {
    municao,
    nome: cat.equipamento(municao)?.nome ?? municao,
    ...(capacidade ? { capacidade, naArma: Math.min(capacidade, arma.carregador ?? capacidade) } : {}),
    naMochila: balasNaMochila(inv, municao),
  };
}

/** "6/6 na arma · 40 na mochila" */
export function textoMunicao(e: EstadoMunicao): string {
  const mochila = `${e.naMochila} ${e.naMochila === 1 ? 'bala' : 'balas'} de ${e.nome.toLowerCase()} na mochila`;
  return e.capacidade ? `${e.naArma}/${e.capacidade} na arma · ${mochila}` : mochila;
}

/** A quantidade de uma pilha (1 = sem o campo). */
function comQtd(x: ItemFicha, qtd: number): ItemFicha {
  const { qtd: _q, ...s } = x;
  void _q;
  return qtd > 1 ? { ...s, qtd } : s;
}

/** Tira n balas dos pacotes: o aberto primeiro, depois abre outro (o pacote vazio sai da mochila). */
function tirarDosPacotes(inv: ItemFicha[], municao: string, n: number): ItemFicha[] {
  let out = inv.slice();
  let falta = n;
  const ehPacote = (x: ItemFicha) => x.tipo === 'equipamento' && x.id === municao;
  while (falta > 0) {
    let j = out.findIndex((x) => ehPacote(x) && x.balas !== undefined);
    if (j < 0) {
      j = out.findIndex(ehPacote);
      if (j < 0) break;
      const p = out[j];
      const qtd = Math.max(1, p.qtd ?? 1);
      // abre um pacote: da pilha de fechados sai um, aberto (sem o uid, que o servidor dá)
      if (qtd > 1) {
        const { uid: _u, ...semUid } = comQtd(p, 1);
        void _u;
        out = [...out.slice(0, j), comQtd(p, qtd - 1), { ...semUid, balas: balasDoPacote(p) }, ...out.slice(j + 1)];
        j += 1;
      } else out = out.map((x, k) => (k === j ? { ...x, balas: balasDoPacote(x) } : x));
    }
    const aberto = out[j].balas ?? 0;
    const tira = Math.min(aberto, falta);
    falta -= tira;
    out = aberto - tira > 0 ? out.map((x, k) => (k === j ? { ...x, balas: aberto - tira } : x)) : out.filter((_, k) => k !== j);
  }
  return out;
}

export type ResultadoMunicao = { ok: true; inventario: ItemFicha[]; texto: string } | { ok: false; motivo: string };

/** O disparo: gasta da arma (com capacidade) ou do pacote. Sem munição, não dispara. */
export function disparar(inv: ItemFicha[], uid: number, gasto = 1): ResultadoMunicao {
  const i = inv.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, motivo: 'A arma não está na mochila.' };
  const arma = inv[i];
  const e = estadoMunicao(inv, arma);
  if (!e) return { ok: true, inventario: inv, texto: '' };
  const nome = arma.apelido ?? cat.arma(arma.id)?.nome ?? 'A arma';
  if (e.capacidade) {
    if ((e.naArma ?? 0) < gasto) return { ok: false, motivo: `${nome} tem ${e.naArma} ${e.naArma === 1 ? 'bala' : 'balas'} e o disparo gasta ${gasto}: recarregue (ação de movimento; LR p. 174).` };
    const resta = (e.naArma ?? 0) - gasto;
    return { ok: true, inventario: inv.map((x, k) => (k === i ? { ...x, carregador: resta } : x)), texto: `${nome}: ${resta}/${e.capacidade}` };
  }
  if (e.naMochila < gasto) return { ok: false, motivo: `Sem ${e.nome.toLowerCase()} na mochila para ${nome} (LR p. 174).` };
  const out = tirarDosPacotes(inv, e.municao, gasto);
  return { ok: true, inventario: out, texto: `${e.nome}: sobram ${balasNaMochila(out, e.municao)}` };
}

/** Recarregar (ação de movimento): enche a arma com o que houver nos pacotes. */
export function recarregar(inv: ItemFicha[], uid: number): ResultadoMunicao {
  const i = inv.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, motivo: 'A arma não está na mochila.' };
  const arma = inv[i];
  const e = estadoMunicao(inv, arma);
  const nome = arma.apelido ?? cat.arma(arma.id)?.nome ?? 'A arma';
  if (!e?.capacidade) return { ok: false, motivo: `${nome} não tem carregador para recarregar.` };
  const falta = e.capacidade - (e.naArma ?? 0);
  if (falta <= 0) return { ok: false, motivo: `${nome} já está cheia (${e.capacidade}).` };
  const poe = Math.min(falta, e.naMochila);
  if (poe <= 0) return { ok: false, motivo: `Sem ${e.nome.toLowerCase()} na mochila para recarregar.` };
  const out = tirarDosPacotes(inv, e.municao, poe).map((x) => (x.uid === uid ? { ...x, carregador: (e.naArma ?? 0) + poe } : x));
  return { ok: true, inventario: out, texto: `${nome} recarregada: ${(e.naArma ?? 0) + poe}/${e.capacidade}` };
}
