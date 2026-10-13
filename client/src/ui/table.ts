import { TelaDeViagem } from './telaDeViagem';
import { combate as cb, type CampaignState } from '@crona/shared';
import { COR_LADO, marcasVazias } from '../render/combateMarcas';
import type { App } from './app';
import { h } from './dom';
import { reduced, typeInto } from './motion';

/**
 * Tela da mesa: só o tabuleiro, para o tablet que os jogadores veem. Segue a
 * cena que o mestre abrir, sem painéis e sem nada para tocar.
 */
export class TableScreen {
  readonly el: HTMLElement;
  private app: App;
  private stage: HTMLElement;
  private card: HTMLElement;
  private cardTitle: HTMLElement;
  private cardSub: HTMLElement;
  private campaign: CampaignState | null = null;
  private lastRoom: number | null = null;
  private cardTimer = 0;
  private canvas: HTMLCanvasElement | null = null;
  /** faixa do combate: rodada, de quem é a vez e a ordem (sem os números do mestre) */
  private combateEl: HTMLElement;
  private combateSig = '';
  private combate: cb.Combate | null = null;
  /** carimbo do último ataque (ERROU, ACERTO, CRÍTICO) */
  private carimboEl: HTMLElement;
  private ultimoEm = 0;
  /** até quando a linha do último ataque fica no tabuleiro */
  private linhaAte = 0;
  private linhaTimer = 0;

  /** notice = aviso para quem abriu sem querer (ex.: mestre sem a chave) */
  constructor(app: App, notice?: string) {
    this.app = app;
    this.cardTitle = h('div', { class: 'mesa-title' });
    this.cardSub = h('div', { class: 'mesa-sub' });
    this.card = h('div', { class: 'mesa-card', 'aria-live': 'polite' }, this.cardSub, this.cardTitle, h('i', { class: 'mesa-rule', 'aria-hidden': 'true' }));
    this.stage = h('div', { class: 'mesa-stage' }, h('div', { class: 'mesa-vignette', 'aria-hidden': 'true' }));
    const hint = h('div', { class: 'mesa-hint' }, 'Toque para tela cheia');
    this.combateEl = h('div', { class: 'mesa-combate hidden', 'aria-live': 'polite' });
    this.carimboEl = h('div', { class: 'mesa-carimbo', 'aria-live': 'polite' });
    this.el = h('div', { class: 'mesa hidden' }, this.stage, new TelaDeViagem(app).el, this.combateEl, this.carimboEl, this.card, hint);
    // PV que mudou (caveira de quem está morrendo) acompanha
    app.session.subscribe(() => this.marcas());
    if (notice) this.el.append(h('div', { class: 'mesa-notice' }, notice));

    // primeiro toque: tela cheia (o navegador só permite depois de um toque)
    const goFull = () => {
      const d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
      hint.classList.add('gone');
    };
    this.el.addEventListener('pointerdown', goFull);
    setTimeout(() => hint.classList.add('gone'), 9000);
  }

  /** O canvas do tabuleiro ocupa a tela toda. */
  mountCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.stage.prepend(canvas);
    this.app.view.watchOnly = true;
    this.app.view.setFrame(null);
  }

  show() {
    this.el.classList.remove('hidden');
  }

  setCampaign(s: CampaignState) {
    this.campaign = s;
  }

  /** O combate que a mesa pode ver: a rodada, a vez e a ordem de iniciativa. */
  setCombate(c: cb.Combate | null) {
    this.combate = c;
    const u = c?.ultimo;
    if (u && u.em !== this.ultimoEm) {
      const primeira = this.ultimoEm === 0;
      this.ultimoEm = u.em;
      // o ataque de antes de a mesa abrir não aparece
      if (!primeira) this.mostrarAtaque(u);
    } else if (!u) this.ultimoEm = -1;
    this.marcas();
    const andando = c?.fase === 'andamento';
    const ordem = c && andando ? cb.entradas(c) : [];
    const sig = JSON.stringify(c && [c.fase, c.rodada, c.vez, c.agiram, ordem.map((e) => [e.id, cb.nomeEntrada(c, e)])]);
    if (sig === this.combateSig) return;
    const vezMudou = !!c && JSON.parse(this.combateSig || 'null')?.[2] !== c.vez;
    this.combateSig = sig;
    const el = this.combateEl;
    if (!c || !andando) {
      el.classList.add('hidden');
      return;
    }
    const vez = cb.entrada(c, c.vez);
    const nome = (e: cb.Entrada) => (e.mestre ? 'Mestre' : cb.nomeEntrada(c, e).split(' ')[0]);
    el.replaceChildren(
      h('div', { class: 'mc-topo' }, h('span', { class: 'mc-rodada' }, `RODADA ${c.rodada}`), h('span', { class: 'mc-vez' }, vez ? (vez.mestre ? 'Turno do mestre' : `Vez de ${cb.nomeEntrada(c, vez)}`) : '—')),
      h('ol', { class: 'mc-ordem' }, ...ordem.map((e) => h('li', { class: `${e.id === c.vez ? 'on' : ''}${c.agiram.includes(e.id) && e.id !== c.vez ? ' agiu' : ''}` }, nome(e)))),
    );
    el.classList.remove('hidden');
    if (vezMudou && !reduced()) el.querySelector('.mc-vez')?.animate([{ opacity: 0, transform: 'translateY(0.6rem)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  /** O último ataque: a linha até o alvo e o carimbo, por alguns segundos. */
  private mostrarAtaque(u: cb.UltimoAtaque) {
    this.linhaAte = performance.now() + 5000;
    clearTimeout(this.linhaTimer);
    this.linhaTimer = window.setTimeout(() => this.marcas(), 5100);
    const texto = u.resultado === 'erro' ? 'ERROU' : u.resultado === 'critico' ? `ACERTO CRÍTICO ×${u.multiplicador ?? 2}` : 'ACERTO';
    const el = this.carimboEl;
    el.className = `mesa-carimbo on ${u.resultado}`;
    el.replaceChildren(h('span', null, texto));
    el.getAnimations().forEach((a) => a.cancel());
    if (!reduced()) el.animate([{ transform: 'translate(-50%, -50%) rotate(-8deg) scale(2)', opacity: 0 }, { transform: 'translate(-50%, -50%) rotate(-8deg) scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,1.5,.4,1)' });
    const saida = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 2600, fill: 'forwards' });
    saida.onfinish = () => {
      el.classList.remove('on');
      saida.cancel();
    };
  }

  /** Marcações públicas no tabuleiro: base na cor do lado, peças caídas, morrendo, ritual e a linha do último ataque. */
  private marcas() {
    const v = this.app.view;
    const c = this.combate;
    if (!v) return;
    if (!c || c.fase !== 'andamento') {
      v.combate = null;
      return;
    }
    const m = marcasVazias();
    for (const p of c.participantes) {
      if (p.fora) continue;
      m.bases.set(-p.id, COR_LADO[p.lado]);
      if (p.condicoes?.includes('caido') || p.condicoes?.includes('inconsciente')) m.deitadas.add(-p.id);
      if (p.sustenta) m.rituais.add(-p.id);
    }
    for (const id of cb.entrada(c, c.vez)?.participantes ?? []) m.vez.add(-id);
    for (const ch of this.app.session.session?.characters ?? []) {
      if (!ch.vitals || ch.vitals.pv > 0 || !m.bases.has(-ch.id)) continue;
      m.deitadas.add(-ch.id);
      m.caveiras.add(-ch.id);
    }
    const u = c.ultimo;
    if (u && performance.now() < this.linhaAte) {
      m.linha = { de: -u.quem, ate: -u.alvo, rotulo: u.resultado === 'erro' ? 'errou' : u.resultado === 'critico' ? 'crítico' : 'acertou', fora: u.resultado === 'erro' };
      m.mira = -u.alvo;
    }
    v.combate = m;
  }

  /** Entrou numa cena: dissolve o quadro antigo e mostra o nome da cena. */
  onRoom() {
    const r = this.app.state.room;
    if (!r) return;
    const first = this.lastRoom === null;
    if (r.id === this.lastRoom) return;
    this.lastRoom = r.id;
    if (!first) this.fade();
    this.showCard(r.name);
  }

  private fade() {
    const src = this.canvas;
    if (!src || reduced() || !src.width) return;
    const c = document.createElement('canvas');
    c.className = 'mesa-fade';
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    src.after(c);
    c.animate(
      [
        { opacity: 1, filter: 'blur(0px) brightness(1)' },
        { opacity: 0, filter: 'blur(8px) brightness(0.3)' },
      ],
      { duration: 1100, easing: 'cubic-bezier(.4,0,.2,1)' },
    ).onfinish = () => c.remove();
    src.animate([{ opacity: 0, filter: 'brightness(0.2)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 1300, easing: 'ease-out' });
  }

  /** Nome da cena, como título de filme: surge, fica um pouco e some. */
  private showCard(roomName: string) {
    const [place, scene] = roomName.includes('·') ? roomName.split('·').map((s) => s.trim()) : [this.campaign?.subtitle ?? '', roomName];
    clearTimeout(this.cardTimer);
    const card = this.card;
    card.getAnimations().forEach((a) => a.cancel());
    card.classList.add('on');
    this.cardSub.textContent = (place || '').toUpperCase();
    typeInto(this.cardTitle, scene.toUpperCase(), 700, false);
    if (!reduced()) {
      card.animate([{ opacity: 0, transform: 'translate(-50%, 1.2rem)', letterSpacing: '0.5em' }, { opacity: 1, transform: 'translate(-50%, 0)', letterSpacing: '0.18em' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' });
      card.querySelector('.mesa-rule')?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 300, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'backwards' });
    }
    this.cardTimer = window.setTimeout(() => {
      const out = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced() ? 0 : 900, easing: 'ease-in', fill: 'forwards' });
      out.onfinish = () => {
        card.classList.remove('on');
        out.cancel();
      };
    }, 3600);
  }
}
