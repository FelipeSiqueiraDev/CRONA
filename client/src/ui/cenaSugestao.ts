import type { App } from './app';
import { h } from './dom';
import { ic } from './icons';
import { sfx } from './sfx';

/**
 * O aviso da cena da sala (17/10, o Felipe: "quando entrasse na sala da Agatha eu tivesse a opção de colocar uma imagem
 * bonitona dela... e deixar ali ou voltar pro tabuleiro"): quando o mestre entra numa sala que tem cena ligada a ela, um
 * cartão discreto oferece soltar. Nunca solta sozinho (a hora do momento é do mestre); some se ele recusar ou soltar.
 */
export function iniciarSugestaoDeCenas(app: App) {
  let dispensada = new Set<number>();
  let cartao: HTMLElement | null = null;
  let salaDoCartao = 0;

  const tirar = () => {
    cartao?.remove();
    cartao = null;
    salaDoCartao = 0;
  };

  const atualizar = () => {
    const sala = app.state.room;
    if (app.state.role !== 'gm' || !sala || document.querySelector('.cn-tela')) return tirar();
    const cenas = app.state.cenas.filter((c) => c.salas?.includes(sala.id));
    if (!cenas.length || dispensada.has(sala.id)) return tirar();
    if (cartao && salaDoCartao === sala.id) return;
    tirar();
    salaDoCartao = sala.id;
    const dispensar = () => (dispensada.add(sala.id), sfx.click(), tirar());
    cartao = h(
      'aside',
      { class: 'cn-sugestao', role: 'status', 'aria-label': 'Cena desta sala' },
      h('small', null, cenas.length > 1 ? 'CENAS DESTA SALA' : 'CENA DESTA SALA'),
      ...cenas.map((c) =>
        h(
          'button',
          { class: 'cn-sug-bt', type: 'button', title: 'Soltar na tela de todos', onclick: () => (sfx.click(), app.net.send({ t: 'cenaTocar', id: c.id }), tirar()) },
          ic('avancar'),
          h('span', null, c.titulo),
        ),
      ),
      h('button', { class: 'cn-sug-x', type: 'button', title: 'Agora não', 'aria-label': 'Agora não', onclick: dispensar }, ic('fechar')),
    );
    document.body.append(cartao);
  };

  app.on('room', atualizar);
  app.on('cenas', atualizar);
  // quando a cena fecha (ou abre), o cartão se acerta
  new MutationObserver(() => atualizar()).observe(document.body, { childList: true });
  // o mestre que voltou para uma sala dispensada vê o aviso de novo na próxima vez que entrar nela depois de sair
  app.on('room', () => {
    const id = app.state.room?.id;
    dispensada = new Set([...dispensada].filter((x) => x === id));
  });
}
