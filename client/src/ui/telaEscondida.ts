import { h } from './dom';

/**
 * A tela escondida (18/10, o Felipe: "um botãozinho pequeno junto com o Ampliar pra esconder a tela, e a gente coloca a
 * tela de loading que tem lá no C.R.I.S"): o mestre esconde o tabuleiro da mesa atrás do carregamento do C.R.I.S (o d20
 * girando e "Vasculhando os arquivos…", as cores e as letras de lá, as mesmas do falso C.R.I.S da entrada).
 */
let el: HTMLElement | null = null;

export function mostrarTelaEscondida(on: boolean) {
  if (!on) {
    el?.classList.add('saindo');
    const velho = el;
    el = null;
    setTimeout(() => velho?.remove(), 500);
    return;
  }
  if (el) return;
  el = h(
    'div',
    { class: 'tela-escondida falso-cris', role: 'status', 'aria-label': 'Carregando' },
    h('div', { class: 'te-meio' }, h('img', { class: 'te-d20', src: '/cris/icon.svg', alt: '' }), h('span', { class: 'te-texto' }, 'Vasculhando os arquivos…')),
  );
  document.body.append(el);
}
