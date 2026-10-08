import type { LugarInfo, ViagemInfo } from '@crona/shared';
import { DioramaViagem } from '../render/dioramaViagem';
import { spriteDoLugar } from '../render/lugarSprites';
import { portraitCanvas } from '../render/portrait';
import { vanDeLado } from '../render/vanDeCima';
import { MundoViagem } from '../render/viagemMundo';
import type { App } from './app';
import { h } from './dom';

/**
 * A tela da viagem (07/10, pedido do Felipe): a viagem é um "carregando" bonito, sem tabuleiro. Enquanto a cena aberta
 * é a viagem, esta tela cobre o tabuleiro (do mestre e da mesa): a pintura do caminho se mexendo devagar, "Rumo a …",
 * quem vai na van e a barrinha do trajeto com a vanzinha andando do lugar de onde saíram até o destino. A chuva e a
 * neblina do clima passam por cima. O mestre comanda pelo painel da esquerda (clima, trocar a pintura, Chegamos).
 */
export class TelaDeViagem {
  readonly el = h('div', { class: 'tv hidden', 'aria-live': 'polite' });
  private cena = h('canvas', { class: 'tv-cena' }) as HTMLCanvasElement;
  private diorama = new DioramaViagem();
  private clima = h('canvas', { class: 'tv-clima' }) as HTMLCanvasElement;
  private titulo = h('b', { class: 'tv-destino' });
  private quem = h('div', { class: 'tv-quem' });
  private origemEl = h('div', { class: 'tv-ponto origem' });
  private destinoEl = h('div', { class: 'tv-ponto destino' });
  private van = h('div', { class: 'tv-van' }, vanDeLado());
  private mundo = new MundoViagem();
  private v: ViagemInfo | null = null;
  private desde = 0;
  private raf = 0;
  private sigQuem = '';
  private sigLugares = '';
  private pedido = false;

  constructor(private app: App) {
    const trajeto = h('div', { class: 'tv-trajeto' }, this.origemEl, h('div', { class: 'tv-estrada' }, this.van), this.destinoEl);
    this.el.append(this.cena, h('div', { class: 'tv-vinheta' }), this.clima, h('header', { class: 'tv-topo' }, h('small', null, 'EM VIAGEM'), this.titulo), h('footer', { class: 'tv-base' }, this.quem, trajeto));
    app.on('room', () => this.atualizar());
    app.on('lugares', () => this.lugares());
  }

  /** A cena mudou: mostra a tela se for a viagem, e esconde se não for. */
  atualizar() {
    const v = this.app.state.room?.viagem ?? null;
    const antes = this.v;
    this.v = v;
    this.el.classList.toggle('hidden', !v);
    if (!v) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.pedido = false;
      this.sigLugares = '';
      return;
    }
    if (!antes || antes.origem !== v.origem || antes.destinoId !== v.destinoId) this.desde = performance.now();
    this.titulo.textContent = v.destino ? `Rumo a ${v.destino}` : 'Na estrada';
    if (!this.app.state.lugares.length && !this.pedido) {
      this.pedido = true;
      this.app.net.send({ t: 'lugares' });
    }
    this.lugares();
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.quadro(t));
  }

  /** Os ícones da origem e do destino nas pontas do trajeto. */
  private lugares() {
    const v = this.v;
    if (!v) return;
    const ls = this.app.state.lugares;
    const origem = ls.find((l) => l.aqui) ?? null;
    const destino = ls.find((l) => l.entrada === v.destinoId) ?? null;
    const sig = `${origem?.id}|${destino?.id}|${ls.length}`;
    if (sig === this.sigLugares) return;
    this.sigLugares = sig;
    const ponto = (el: HTMLElement, l: LugarInfo | null, padrao: string) => {
      const ic = l ? spriteDoLugar(l.icone) : null;
      const c = ic ? (ic.cloneNode() as HTMLCanvasElement) : null;
      if (c && ic) c.getContext('2d')!.drawImage(ic, 0, 0);
      el.replaceChildren(...(c ? [c] : []), h('span', null, l?.nome ?? padrao));
    };
    ponto(this.origemEl, origem, 'Partida');
    ponto(this.destinoEl, destino, v.destino ?? 'Destino');
  }

  /** Quem vai na van: os retratos das peças da cena. */
  private agentes() {
    const us = [...(this.app.view?.users.values() ?? [])];
    const sig = us.map((u) => `${u.id}:${u.name}`).join('|');
    if (sig === this.sigQuem) return;
    this.sigQuem = sig;
    this.quem.replaceChildren(...us.map((u) => h('span', { class: 'tv-ag' }, h('span', { class: 'tv-ag-foto' }, portraitCanvas(u.look, 64, { dir: 2 })), h('small', null, u.name.split(' ')[0]))));
  }

  private quadro(now: number) {
    if (!this.v) return;
    this.raf = requestAnimationFrame((t) => this.quadro(t));
    if (Math.floor(now / 500) !== Math.floor((now - 17) / 500)) this.agentes();
    // a vanzinha anda pelo trajeto: depressa no começo e cada vez mais devagar, sem chegar (quem chega é o mestre)
    const t = (now - this.desde) / 1000;
    const p = 0.04 + 0.86 * (1 - Math.exp(-t / 70));
    const pulo = Math.abs(Math.sin(now / 160)) * 2;
    this.van.style.left = `${p * 100}%`;
    this.van.style.transform = `translate(-50%, ${-pulo}px)`;
    // o dioraminha, numa tela pequena que cresce com pixels grandes (uns 190 pixels de altura)
    const cena = this.cena;
    const escala = Math.max(2, Math.floor(cena.clientHeight / 190));
    const cw = Math.max(1, Math.ceil(cena.clientWidth / escala));
    const ch = Math.max(1, Math.ceil(cena.clientHeight / escala));
    if (cena.width !== cw || cena.height !== ch) {
      cena.width = cw;
      cena.height = ch;
    }
    this.diorama.desenhar(cena.getContext('2d')!, cw, ch, now, this.v);
    // a chuva e a neblina por cima
    const c = this.clima;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr);
    const hh = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== hh) {
      c.width = w;
      c.height = hh;
    }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, hh);
    this.mundo.clima(ctx, this.v, now, dpr);
  }
}
