import type { ViagemInfo } from '@crona/shared';
import { DioramaViagem } from '../render/dioramaViagem';
import { quadroDoBoneco, type SpriteFrame } from '../render/sprites';
import type { App } from './app';
import { h } from './dom';

/**
 * A tela da viagem (07/10, pedido do Felipe): a viagem é um "carregando" bonito, sem tabuleiro. Enquanto a cena aberta
 * é a viagem, esta tela cobre o tabuleiro (do mestre e da mesa) com o dioraminha em pixel art: a ilha flutuando, a
 * estrada, a van aberta com os agentes sentados e o mundo passando, no momento do dia e no clima que o mestre escolheu
 * (render/dioramaViagem.ts). Em cima, só "Rumo a …". O mestre comanda pelo painel da esquerda (hora, clima, estrada,
 * Chegamos).
 */
export class TelaDeViagem {
  readonly el = h('div', { class: 'tv hidden', 'aria-live': 'polite' });
  private cena = h('canvas', { class: 'tv-cena' }) as HTMLCanvasElement;
  private titulo = h('b', { class: 'tv-destino' });
  private diorama = new DioramaViagem();
  private v: ViagemInfo | null = null;
  private raf = 0;
  /** o boneco de cada peça da viagem (sentado dentro da van) */
  private figuras: (SpriteFrame | null)[] = [];

  constructor(private app: App) {
    this.el.append(this.cena, h('div', { class: 'tv-vinheta' }), h('header', { class: 'tv-topo' }, h('small', null, 'EM VIAGEM'), this.titulo));
    app.on('room', () => this.atualizar());
  }

  /** A cena mudou: mostra a tela se for a viagem, e esconde se não for. */
  atualizar() {
    const v = this.app.state.room?.viagem ?? null;
    this.v = v;
    this.el.classList.toggle('hidden', !v);
    if (!v) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.titulo.textContent = v.destino ? `Rumo a ${v.destino}` : 'Na estrada';
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.quadro(t));
  }

  /** Quem vai na van: o boneco de cada peça da cena. */
  private agentes() {
    const us = [...(this.app.view?.users.values() ?? [])];
    this.figuras = us.map((u) => quadroDoBoneco(u.look.charId ?? null, 2));
  }

  private quadro(now: number) {
    if (!this.v) return;
    this.raf = requestAnimationFrame((t) => this.quadro(t));
    if (Math.floor(now / 500) !== Math.floor((now - 17) / 500) || !this.figuras.some(Boolean)) this.agentes();
    // o dioraminha, numa tela pequena que cresce com pixels grandes (uns 160 pixels de altura)
    const cena = this.cena;
    const escala = Math.max(2, Math.floor(cena.clientHeight / 160));
    const cw = Math.max(1, Math.ceil(cena.clientWidth / escala));
    const ch = Math.max(1, Math.ceil(cena.clientHeight / escala));
    if (cena.width !== cw || cena.height !== ch) {
      cena.width = cw;
      cena.height = ch;
    }
    this.diorama.desenhar(cena.getContext('2d')!, cw, ch, now, this.v, this.figuras);
  }
}
