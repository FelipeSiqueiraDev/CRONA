/**
 * Ícones da barra do topo com animação (iconesAnimados.css): o mesmo desenho de
 * linha dos ícones (icons.ts), separado em partes que se mexem quando o mouse passa
 * em cima e quando a aba abre. Movimentos pequenos, do tamanho do ícone: o mapa
 * abre um pouco e o caminho se traça até o X, as espadas recuam e batem com uma
 * faísca, a ficha se preenche, os raios do sol giram e pulsam, a engrenagem dá o
 * tique, o registro se escreve e a seta sai pela porta.
 */

const A: Record<string, string> = {
  mapa:
    '<g class="m-mapa"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></g>' +
    '<path class="m-rota" pathLength="1" d="M6.2 16.4c1.5-.5 2.2-1.9 3.2-3.1s2.5-1.6 3.7-1.3 2.3-.4 3.1-1.6"/>' +
    '<path class="m-x" d="M16.3 7.4l2 2M18.3 7.4l-2 2"/>',
  espadas:
    '<g class="e-b"><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5"/><line x1="11" x2="5" y1="19" y2="13"/><line x1="8" x2="4" y1="16" y2="20"/><line x1="5" x2="3" y1="21" y2="19"/></g>' +
    '<g class="e-a"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/></g>' +
    '<path class="e-faisca" d="M12 4.6l.75 1.95 1.95.75-1.95.75-.75 1.95-.75-1.95-1.95-.75 1.95-.75z"/>',
  ficha:
    '<rect class="f-cartao" x="2" y="5" width="20" height="14" rx="2"/><g class="f-rosto"><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 15.5a3 3 0 0 1 6 0"/></g>' +
    '<path class="f-l1" d="M14 10h5"/><path class="f-l2" d="M14 13h5"/><path class="f-l3" d="M14 16h3"/>',
  sol:
    '<circle class="s-nucleo" cx="12" cy="12" r="4"/><g class="s-raios">' +
    '<path class="s-reto" d="M12 2v2"/><path class="s-reto" d="M12 20v2"/><path class="s-reto" d="M2 12h2"/><path class="s-reto" d="M20 12h2"/>' +
    '<path class="s-diag" d="m4.93 4.93 1.41 1.41"/><path class="s-diag" d="m17.66 17.66 1.41 1.41"/><path class="s-diag" d="m6.34 17.66-1.41 1.41"/><path class="s-diag" d="m19.07 4.93-1.41 1.41"/></g>',
  engrenagem:
    '<g class="g-roda"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g>',
  documento:
    '<g class="d-folha"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path class="d-dobra" d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
    '<path class="d-l1" pathLength="1" d="M8 9h2"/><path class="d-l2" pathLength="1" d="M8 13h8"/><path class="d-l3" pathLength="1" d="M8 17h8"/></g>',
  sair: '<path class="x-porta" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><g class="x-seta"><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></g>',
};

/** O ícone animado (classe `ic`, como os outros), ou null se esse nome não tem animação. */
export function icAnimado(nome: string): SVGSVGElement | null {
  const corpo = A[nome];
  if (!corpo) return null;
  const s = document.createElement('span');
  s.innerHTML = `<svg class="ic ic-anim ia-${nome}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
  return s.firstElementChild as SVGSVGElement;
}

/** Toca a animação uma vez (a aba que acabou de abrir), sem esperar o mouse. */
export function tocarUmaVez(el: HTMLElement, ms = 1500) {
  el.classList.remove('toca');
  // recomeça a animação dois quadros depois (o navegador vê a classe sair e voltar). Antes era `void el.offsetWidth`,
  // que forçava o layout da página inteira no meio do clique: ~50 ms ao trocar de aba (29/10)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.classList.add('toca');
      window.setTimeout(() => el.classList.remove('toca'), ms);
    }),
  );
}
