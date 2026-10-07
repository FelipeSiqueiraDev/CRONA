/**
 * Barra do topo das telas novas (referências docs/referencias/mapa.webp e
 * docs/referencias/fichas.webp): emblema e nome, abas MAPA / COMBATE / FICHAS,
 * operação, local e os botões quadrados. A mesma barra serve ao mestre e à
 * ficha do jogador no celular.
 */
import { h } from './dom';
import { icAnimado, tocarUmaVez } from './iconesAnimados';
import { arteOu, ic, type NomeIcone } from './icons';

export interface AbaTopo {
  id: string;
  rotulo: string;
  icone: NomeIcone;
  /** aparece, mas não abre (ex.: MAPA para o jogador) */
  fora?: boolean;
}

export interface BotaoTopo {
  id: string;
  icone: NomeIcone;
  titulo: string;
  /** ícone preenchido (engrenagem) */
  cheio?: boolean;
  /** some no celular */
  soDesktop?: boolean;
  /** vermelho, depois do divisor */
  sair?: boolean;
  onclick: (ev: MouseEvent) => void;
}

export interface OpcoesTopo {
  abas: AbaTopo[];
  ativa: string;
  aoTrocar: (id: string) => void;
  botoes: BotaoTopo[];
  aoClicarMarca?: () => void;
}

const LOGO = '/arte/local/logo-ordem.png';
let emblemaPronto: Promise<HTMLCanvasElement | null> | null = null;

/**
 * O emblema da Ordem vem do logo local (fora do git: é símbolo oficial). A
 * imagem é branca sobre preto: o branco vira a forma, pintada em creme, e o
 * texto de baixo do logo fica de fora.
 */
function carregarEmblema(): Promise<HTMLCanvasElement | null> {
  emblemaPronto ??= new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const W = im.naturalWidth;
      const H = im.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      const lum = (i: number) => (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * (d[i + 3] / 255);
      // linhas com traço claro
      const linhas: number[] = [];
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = 0; x < W; x += 2) if (lum((y * W + x) * 4) > 90) n++;
        linhas.push(n);
      }
      const y0 = linhas.findIndex((n) => n > 0);
      if (y0 < 0) return res(null);
      let y1 = H - 1;
      while (y1 > y0 && !linhas[y1]) y1--;
      // o nome escrito embaixo: corta no maior vão de linhas vazias da metade de baixo
      let corte = y1;
      let vao = 0;
      let inicio = -1;
      for (let y = Math.floor(y0 + (y1 - y0) * 0.55); y <= y1; y++) {
        if (!linhas[y]) {
          if (inicio < 0) inicio = y;
        } else if (inicio >= 0) {
          if (y - inicio > vao) {
            vao = y - inicio;
            corte = inicio;
          }
          inicio = -1;
        }
      }
      if (vao < 3) corte = Math.floor(y0 + (y1 - y0) * 0.8);
      let x0 = W;
      let x1 = 0;
      for (let y = y0; y < corte; y++)
        for (let x = 0; x < W; x++)
          if (lum((y * W + x) * 4) > 90) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
          }
      const w = x1 - x0 + 1;
      const hh = corte - y0;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = hh;
      const o = out.getContext('2d')!;
      const img = o.createImageData(w, hh);
      for (let y = 0; y < hh; y++)
        for (let x = 0; x < w; x++) {
          const a = lum(((y + y0) * W + x + x0) * 4);
          const i = (y * w + x) * 4;
          // creme com leve degradê (mais claro em cima)
          const t = y / hh;
          img.data[i] = 246 - 30 * t;
          img.data[i + 1] = 240 - 34 * t;
          img.data[i + 2] = 228 - 40 * t;
          img.data[i + 3] = Math.min(255, a * 1.15);
        }
      o.putImageData(img, 0, 0);
      res(out);
    };
    im.onerror = () => res(null);
    im.src = LOGO;
  });
  return emblemaPronto;
}

/** Emblema genérico (asas e escudo redondo), enquanto o logo não estiver na pasta. */
function emblemaPadrao(): SVGSVGElement {
  const s = document.createElement('span');
  s.innerHTML = `<svg viewBox="0 0 66 60" aria-hidden="true"><defs><linearGradient id="emb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5efe4"/><stop offset="1" stop-color="#c9bfae"/></linearGradient></defs>
    <g fill="url(#emb-g)">
      <path d="M4 4 L20 30 L14 31 L24 44 L18 45 L30 56 L22 38 L28 37 L18 22 L24 21 Z"/>
      <path d="M62 4 L46 30 L52 31 L42 44 L48 45 L36 56 L44 38 L38 37 L48 22 L42 21 Z"/>
      <path d="M33 12a15 15 0 1 1 0 30a15 15 0 1 1 0-30zm0 4a11 11 0 1 0 0 22a11 11 0 1 0 0-22z"/>
      <path d="M33 21a6 6 0 0 1 6 6v5H27v-5a6 6 0 0 1 6-6z"/>
    </g></svg>`;
  return s.firstElementChild as SVGSVGElement;
}

/** O emblema vira máscara em CSS (--logo-mascara): marca-d'água do personagem e o selo da ficha. */
let mascaraPosta = false;
function porMascara() {
  if (mascaraPosta) return;
  mascaraPosta = true;
  void carregarEmblema().then((c) => c && document.documentElement.style.setProperty('--logo-mascara', `url(${c.toDataURL()})`));
}

/** Os ícones pintados do kit (arte/icones/topo-*.png); sem eles, o ícone animado de antes. */
const ICONE_PINTADO: Partial<Record<string, string>> = {
  mapa: 'topo-mapa',
  espadas: 'topo-combate',
  ficha: 'topo-fichas',
  sol: 'topo-clima',
  engrenagem: 'topo-config',
  documento: 'topo-registro',
  sair: 'topo-sair',
};
function iconeTopo(nome: NomeIcone): Element {
  const reserva = icAnimado(nome) ?? ic(nome);
  const pintado = ICONE_PINTADO[nome];
  return pintado ? arteOu([`/arte/icones/${pintado}.png`], reserva) : reserva;
}

export class TopBar {
  readonly el: HTMLElement;
  private abas = new Map<string, HTMLButtonElement>();
  private titulo: HTMLElement;
  private sub: HTMLElement;
  private op: HTMLElement;
  private opTxt: HTMLElement;
  private localT: HTMLElement;
  private localS: HTMLElement;
  private localBox: HTMLElement;
  readonly botoes = new Map<string, HTMLButtonElement>();

  constructor(o: OpcoesTopo) {
    porMascara();
    const emb = h('span', { class: 'tb2-emblema' }, emblemaPadrao());
    void carregarEmblema().then((c) => c && emb.replaceChildren(c));
    this.titulo = h('span', { class: 'tb2-titulo' }, 'ORDO REALITAS');
    this.sub = h('span', { class: 'tb2-sub' }, 'SEDE DA ORDEM');
    const marca = h('button', { class: 'tb2-marca', type: 'button', onclick: () => o.aoClicarMarca?.() }, emb, h('span', { class: 'tb2-nomes' }, this.titulo, this.sub));
    const abas = h('nav', { class: 'tb2-abas', role: 'tablist' });
    for (const a of o.abas) {
      const b = h(
        'button',
        {
          class: `tb2-aba${a.fora ? ' fora' : ''}`,
          type: 'button',
          role: 'tab',
          'data-aba': a.id,
          title: a.fora ? `${a.rotulo}: só na tela do mestre` : a.rotulo,
          onclick: () => !a.fora && o.aoTrocar(a.id),
        },
        iconeTopo(a.icone),
        h('span', null, a.rotulo),
      );
      this.abas.set(a.id, b);
      abas.append(b);
    }
    this.opTxt = h('span', { class: 'tb2-op-txt' });
    this.op = h('div', { class: 'tb2-op hidden' }, ic('pena'), this.opTxt);
    this.localT = h('b');
    this.localS = h('span');
    this.localBox = h('div', { class: 'tb2-local hidden' }, this.localT, this.localS);
    const botoes = h('div', { class: 'tb2-botoes' });
    for (const b of o.botoes) {
      if (b.sair) botoes.append(h('span', { class: 'tb2-div', 'aria-hidden': 'true' }));
      const el = h(
        'button',
        { class: `tb2-bt${b.cheio ? ' cheio' : ''}${b.soDesktop ? ' so-desktop' : ''}${b.sair ? ' sair' : ''}`, type: 'button', title: b.titulo, 'aria-label': b.titulo, onclick: (e: MouseEvent) => b.onclick(e) },
        iconeTopo(b.icone),
      );
      this.botoes.set(b.id, el);
      botoes.append(el);
    }
    const inner = h(
      'div',
      { class: 'tb2-in' },
      marca,
      h('span', { class: 'tb2-sep', style: 'left:36.5rem', 'aria-hidden': 'true' }),
      abas,
      this.op,
      h('span', { class: 'tb2-sep', style: 'left:113.2rem', 'aria-hidden': 'true' }),
      this.localBox,
      h('span', { class: 'tb2-sep', style: 'left:133.2rem', 'aria-hidden': 'true' }),
      botoes,
    );
    this.el = h('header', { class: 'tb2' }, inner);
    this.setAtiva(o.ativa);
  }

  setAtiva(id: string) {
    for (const [k, b] of this.abas) {
      // a aba que acabou de abrir toca a animação do ícone uma vez
      if (k === id && !b.classList.contains('on')) tocarUmaVez(b);
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-selected', String(k === id));
    }
  }

  setMarca(titulo: string, sub: string) {
    this.titulo.textContent = titulo.toUpperCase();
    this.sub.textContent = sub.toUpperCase();
  }

  /** "OPERAÇÃO / FULGOR": null esconde. */
  setOperacao(nome: string | null) {
    this.op.classList.toggle('hidden', !nome);
    if (!nome) return;
    const [a, ...b] = nome.trim().split(/\s+/);
    this.opTxt.replaceChildren(a ?? '', h('br'), b.join(' '));
  }

  setLocal(titulo: string | null, sub = '') {
    this.localBox.classList.toggle('hidden', !titulo);
    this.localT.textContent = (titulo ?? '').toUpperCase();
    this.localS.textContent = sub.toUpperCase();
  }
}
