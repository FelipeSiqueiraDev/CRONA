/**
 * O "N vezes por dia" na tela (19/10): as bolinhas de uso (cheia = livre, vazia = usada hoje) e, para o mestre, os
 * botões de quantas vezes por dia. As contas ficam em `regras` (shared/src/regras/porDia.ts); quem chama grava.
 */
import { regras } from '@crona/shared';
import { h } from './dom';
import { ic } from './icons';
import { sfx } from './sfx';

/** As bolinhas de uma coisa com limite (nada se não tiver). Tocar gasta a próxima ou devolve a última. */
export function bolinhasDia(f: regras.Ficha, chave: string, marcar: (usos: number) => void, grande = false): HTMLElement | null {
  const lim = regras.limiteDia(f, chave);
  if (!lim) return null;
  const usos = regras.usosDia(f, chave);
  const livres = lim - usos;
  return h(
    'span',
    {
      class: `dia-bolas${grande ? ' grande' : ''}${livres ? '' : ' gasto'}`,
      title: `${lim}× por dia: ${livres ? `${livres} livre${livres === 1 ? '' : 's'} hoje` : 'já usado hoje'}. Toque para marcar o uso (ou devolver).`,
    },
    ...Array.from({ length: lim }, (_, i) =>
      h('button', {
        class: `dia-bola${i < livres ? ' livre' : ''}`,
        type: 'button',
        'aria-label': i < livres ? 'Usar uma vez' : 'Devolver o uso',
        onclick: (e: Event) => {
          e.stopPropagation();
          sfx.click();
          // a bolinha livre da ponta gasta; a vazia devolve
          marcar(i < livres ? usos + 1 : usos - 1);
        },
      }),
    ),
    grande ? h('small', null, livres ? `${livres}/${lim} hoje` : 'usado hoje') : null,
  );
}

/** O bloco do mestre: quantas vezes por dia (sem limite, 1, 2, 3) e as bolinhas de hoje. */
export function blocoDia(f: regras.Ficha, chave: string, mestre: boolean, limite: (n: number) => void, marcar: (usos: number) => void): HTMLElement | null {
  const lim = regras.limiteDia(f, chave);
  if (!mestre && !lim) return null;
  return h(
    'div',
    { class: 'dia-bloco' },
    h('h4', { class: 'fj-sub' }, ic('ampulheta'), 'Por dia'),
    mestre
      ? h(
          'div',
          { class: 'dia-ops' },
          ...[0, 1, 2, 3].map((n) =>
            h('button', { class: `fx-bt mini${n === lim ? ' forte' : ''}`, type: 'button', 'aria-pressed': String(n === lim), onclick: () => (sfx.click(), limite(n)) }, n ? `${n}× por dia` : 'Sem limite'),
          ),
        )
      : null,
    lim ? bolinhasDia(f, chave, marcar, true) : h('p', { class: 'fj-dica' }, 'Sem limite por dia. Marque quantas vezes vale, se for regra da mesa; passar o dia devolve os usos.'),
  );
}

/** O selinho da lista (sem toque): quantas vezes ainda dá hoje. */
export function seloDia(f: regras.Ficha, chave: string): HTMLElement | null {
  const lim = regras.limiteDia(f, chave);
  if (!lim) return null;
  const livres = lim - regras.usosDia(f, chave);
  return h('em', { class: `jg-selo dia${livres ? '' : ' gasto'}`, title: `${lim}× por dia` }, livres ? `${livres}/${lim} hoje` : 'usado hoje');
}
