/**
 * O que é "N vezes por dia" (19/10, o Felipe: "várias magias, ações e itens são 1 vez por dia; o passar o dia é pra
 * isso tudo"). O livro quase não tem "por dia" (tem por cena e por missão): é regra da mesa, e o mestre marca na
 * ficha quantas vezes cada poder, ritual ou item vale por dia. O uso é marcado na ficha; passar o dia zera.
 */
import type { Ficha } from './ficha';

/** A chave de cada coisa que pode ter limite por dia. */
export const chaveDia = {
  poder: (id: string) => `poder:${id}`,
  ritual: (id: string) => `ritual:${id}`,
  item: (uid: number) => `item:${uid}`,
};

/** Quantas vezes por dia (0 = sem limite). */
export function limiteDia(f: Ficha, chave: string): number {
  return Math.max(0, Math.round(f.limitesDia?.[chave] ?? 0));
}

/** Quantas vezes já usou hoje (nunca passa do limite). */
export function usosDia(f: Ficha, chave: string): number {
  return Math.min(limiteDia(f, chave), Math.max(0, Math.round(f.usosDia?.[chave] ?? 0)));
}

/** Põe ou tira o limite (o mestre). Sem limite, o uso de hoje some junto. */
export function definirLimiteDia(f: Ficha, chave: string, n: number): void {
  const v = Math.max(0, Math.min(9, Math.round(n)));
  if (v) (f.limitesDia ??= {})[chave] = v;
  else if (f.limitesDia) delete f.limitesDia[chave];
  if (f.limitesDia && !Object.keys(f.limitesDia).length) delete f.limitesDia;
  marcarUsosDia(f, chave, usosDia(f, chave));
}

/** Marca quantas vezes usou hoje (entre 0 e o limite). */
export function marcarUsosDia(f: Ficha, chave: string, n: number): void {
  const v = Math.max(0, Math.min(limiteDia(f, chave), Math.round(n)));
  if (v) (f.usosDia ??= {})[chave] = v;
  else if (f.usosDia) delete f.usosDia[chave];
  if (f.usosDia && !Object.keys(f.usosDia).length) delete f.usosDia;
}

/** Começa um dia novo: tudo que é por dia volta (e a etapa ritualística volta a "não cumpriu"). */
export function passarDia(f: Ficha): void {
  delete f.usosDia;
  delete f.etapaCumprida;
}

/** Limpa o que não tem mais dono: o limite e o uso de item que saiu da mochila. */
export function limparPorDia(f: Ficha): void {
  const uids = new Set(f.inventario.map((i) => i.uid).filter((x): x is number => x !== undefined));
  for (const reg of [f.limitesDia, f.usosDia]) {
    if (!reg) continue;
    for (const k of Object.keys(reg)) if (k.startsWith('item:') && !uids.has(Number(k.slice(5)))) delete reg[k];
  }
  if (f.limitesDia && !Object.keys(f.limitesDia).length) delete f.limitesDia;
  if (f.usosDia) {
    for (const k of Object.keys(f.usosDia)) marcarUsosDia(f, k, f.usosDia[k]);
    if (!Object.keys(f.usosDia).length) delete f.usosDia;
  }
}
