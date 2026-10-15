type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Criador de elementos: h('div', { class: 'x', onclick: fn }, filhos...) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/**
 * Troca os filhos de `el` sem piscar as imagens (14/10, o Felipe: "a piscadinha"): uma <img> nova, mesmo com a
 * figura no cache, aparece vazia por um quadro até decodificar. Aqui cada imagem nova que já estava na tela (o mesmo
 * endereço, já carregada) é trocada pela antiga, que só ganha os atributos da nova.
 */
export function trocarFilhos(el: Element, ...nodes: (Node | string)[]) {
  const velhas = new Map<string, HTMLImageElement[]>();
  for (const img of el.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src || !img.complete || !img.naturalWidth) continue;
    const lista = velhas.get(src);
    if (lista) lista.push(img);
    else velhas.set(src, [img]);
  }
  const reaproveitar = (nova: HTMLImageElement): HTMLImageElement => {
    const src = nova.getAttribute('src');
    const velha = src ? velhas.get(src)?.shift() : undefined;
    if (!velha) return nova;
    for (const a of [...velha.attributes]) if (a.name !== 'src' && !nova.hasAttribute(a.name)) velha.removeAttribute(a.name);
    for (const a of [...nova.attributes]) if (a.name !== 'src' && velha.getAttribute(a.name) !== a.value) velha.setAttribute(a.name, a.value);
    return velha;
  };
  const prontos = velhas.size
    ? nodes.map((n) => {
        if (!(n instanceof Element)) return n;
        if (n instanceof HTMLImageElement) return reaproveitar(n);
        for (const nova of n.querySelectorAll('img')) {
          const velha = reaproveitar(nova);
          if (velha !== nova) nova.replaceWith(velha);
        }
        return n;
      })
    : nodes;
  el.replaceChildren(...prontos);
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

const PATHS: Record<string, string> = {
  nav: '<path d="M3 21V5l9-3 9 3v16"/><path d="M9 21v-6h6v6"/><path d="M3 10h18"/>',
  catalog: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 4v16"/><path d="M12 9h5M12 13h5"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  log: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
  dice: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2v6M3 7l9 1 9-1M12 8l-6 9h12z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
  pickup: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M12 7v8M9 12l3 3 3-3"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
  clue: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21"/>',
  wave: '<path d="M7 11V6a2 2 0 0 1 4 0v5M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-14 0v-3a2 2 0 0 1 4 0"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  sit: '<path d="M6 21v-6h12v6M6 15V4M6 11h12"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  door: '<path d="M5 21V3h11v18"/><path d="M16 5l3 1v15h-3"/><circle cx="13" cy="12" r="1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/><path d="M4 21h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
};

export function icon(name: keyof typeof PATHS | string, size = 18): SVGSVGElement {
  const span = document.createElement('span');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
  return span.firstElementChild as SVGSVGElement;
}

// ---------- avisos ----------
let toastBox: HTMLElement | null = null;
export function toast(msg: string, kind: 'error' | 'info' = 'info') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- janelas ----------
let zTop = 20;
const openWins: Win[] = [];

/**
 * As janelas das ferramentas do mestre (construir, configurar a cena, todas as cenas, sprites,
 * clima, ajuda, pistas): grandes, no meio da tela, com a moldura de papel do kit e o conteúdo num
 * poço escuro por dentro; atrás, a tela inteira desfoca (como o teclado da geladeira). As que
 * mexem no tabuleiro ao vivo (o clima) ficam de lado, sem desfocar, para ver o efeito.
 */
export class Win {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private fundo: HTMLElement;
  private titleEl: HTMLElement;
  onClose: (() => void) | null = null;

  constructor(title: string, opts: { width?: number; x?: number; y?: number; cls?: string; aoVivo?: boolean } = {}) {
    this.titleEl = h('h3', null, title);
    const closeBtn = h('button', { class: 'fj-x', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => this.close() }, icon('close', 16));
    const head = h('header', { class: 'fx-tit' }, h('span', { class: 'fx-tit-ic win-marca' }), this.titleEl, closeBtn);
    this.body = h('div', { class: 'win-body win-poco' });
    // a largura de antes vira um pouco maior (as janelas eram pequenas e espremidas)
    const largura = Math.round((opts.width ?? 360) * 1.25);
    this.el = h('section', { class: `win fj win-papel ${opts.cls ?? ''}`, style: `width:min(${largura}px, 94vw)`, role: 'dialog', 'aria-modal': opts.aoVivo ? 'false' : 'true', 'aria-label': title }, head, this.body);
    this.fundo = h('div', { class: `fj-fundo tela-toda win-fundo${opts.aoVivo ? ' ao-vivo' : ''}` }, this.el);
    this.fundo.style.display = 'none';
    // o papel pintado (carregado na hora, para não prender o dom.ts ao desenho)
    void import('./paperArt').then(({ paperize }) => paperize(this.el, { seed: 71 + title.length, tone: '#d8c7a6', burn: 1, torn: 1.4, stains: 1, creases: 0.4, pad: 26 }));
    this.fundo.addEventListener('pointerdown', (e) => {
      if (e.target === this.fundo) this.close();
    });
    document.body.append(this.fundo);
    void opts.x;
    void opts.y;
  }

  setTitle(t: string) {
    this.titleEl.textContent = t;
  }

  get isOpen() {
    return this.fundo.style.display !== 'none';
  }

  front() {
    this.fundo.style.zIndex = String(90 + ++zTop);
    const i = openWins.indexOf(this);
    if (i >= 0) openWins.splice(i, 1);
    if (this.isOpen) openWins.push(this);
  }

  open() {
    this.fundo.style.display = '';
    this.front();
  }

  close() {
    if (!this.isOpen) return;
    this.fundo.style.display = 'none';
    const i = openWins.indexOf(this);
    if (i >= 0) openWins.splice(i, 1);
    this.onClose?.();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}

/** Fecha todas as janelas das ferramentas (o mestre vai mexer no tabuleiro). */
export function fecharJanelas() {
  for (const w of [...openWins]) w.close();
}

/** Fecha a janela do topo (Esc). Retorna true se fechou algo. */
export function closeTopWindow(): boolean {
  const w = openWins.pop();
  if (!w) return false;
  w.close();
  return true;
}
