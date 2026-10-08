import { arteDaIlustracao } from '@crona/shared';
import { h } from './dom';
import { sfx } from './sfx';

/**
 * A tela da viagem (07/10): na partida e na chegada, uma das pinturas da viagem cobre a tela de todo mundo (o mestre, a
 * mesa e os celulares) por uns segundos, com o nome do destino e o som do carro saindo ou chegando. Toque para fechar.
 */

const DURACAO_MS = 6200;

export function mostrarTelaViagem(fase: 'partida' | 'chegada', ilustracao: string, texto: string) {
  document.querySelector('.vg-tela')?.remove();
  const img = h('img', { class: 'vg-tela-img', src: arteDaIlustracao(ilustracao), alt: '' }) as HTMLImageElement;
  const legenda = h('div', { class: 'vg-tela-legenda' }, h('small', null, fase === 'partida' ? 'PARTIDA' : 'CHEGADA'), h('b', null, texto));
  const tela = h('div', { class: 'vg-tela', role: 'dialog', 'aria-label': texto }, img, h('div', { class: 'vg-tela-vinheta' }), legenda);
  // a pintura aproxima devagar enquanto está na tela
  img.style.transformOrigin = fase === 'partida' ? '58% 55%' : '42% 50%';
  let fechou = false;
  const fechar = () => {
    if (fechou) return;
    fechou = true;
    tela.classList.add('saindo');
    setTimeout(() => tela.remove(), 900);
  };
  tela.addEventListener('pointerdown', fechar);
  const mostrar = () => {
    document.body.append(tela);
    requestAnimationFrame(() => tela.classList.add('on'));
    if (fase === 'partida') sfx.carroPartindo();
    else sfx.carroChegando();
    setTimeout(fechar, DURACAO_MS);
  };
  // espera a pintura carregar (no máximo um segundo e meio), para não aparecer a tela preta
  let foi = false;
  const vai = () => {
    if (foi) return;
    foi = true;
    mostrar();
  };
  img.addEventListener('load', vai, { once: true });
  img.addEventListener('error', vai, { once: true });
  setTimeout(vai, 1500);
}
