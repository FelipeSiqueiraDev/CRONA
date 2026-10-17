import { DEFAULT_PARTICLE_LEVEL, type LightMode } from '@crona/shared';
import { fontesDeLuz } from '../room/fontesDeLuz';
import type { App } from './app';
import { clear, h, Win } from './dom';

const MODES: [LightMode, string, string][] = [
  ['normal', 'Normal', 'Luzes funcionando'],
  ['flicker', 'Piscando', 'Energia falhando em rajadas'],
  ['blackout', 'Apagão', 'Só velas, janelas e emergência'],
];

/** Controles de clima ao vivo para o mestre: luz, névoa, escuridão e partículas. */
export class FxWin {
  readonly win: Win;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.win = new Win('Clima da cena', { width: 330, aoVivo: true });
    app.on('room', () => this.win.isOpen && this.render());
  }

  toggle() {
    if (this.win.isOpen) this.win.close();
    else {
      this.render();
      this.win.open();
    }
  }

  private render() {
    const r = this.app.state.room;
    const b = clear(this.win.body);
    if (!r) return;
    const send = (p: { lightMode?: LightMode; fog?: number; darkness?: number; particleLevel?: number }) => this.app.net.send({ t: 'roomFx', ...p });
    const modes = h('div', { class: 'fx-modes' });
    for (const [id, label, desc] of MODES)
      modes.append(
        h('button', { class: `fx-mode ${id}${r.lightMode === id ? ' on' : ''}`, onclick: () => send({ lightMode: id }) }, h('b', null, label), h('small', null, desc)),
      );
    const slider = (label: string, value: number, max: number, onDone: (v: number) => void, onLive: (v: number) => void) => {
      const i = h('input', { type: 'range', min: '0', max: String(max), value: String(Math.round(value * 100)) });
      const v = h('span', { class: 'muted' }, `${i.value}%`);
      i.addEventListener('input', () => {
        v.textContent = `${i.value}%`;
        onLive(Number(i.value) / 100);
      });
      i.addEventListener('change', () => onDone(Number(i.value) / 100));
      return h('div', null, h('label', { class: 'field-label' }, label), h('div', { class: 'row' }, i, v));
    };
    const info = this.app.view.info;
    // as fontes de luz do cômodo (17/10): apagar todas como no clique duplo, sem escurecer tudo nem fechar as janelas
    const map = this.app.view.map;
    const fontes = map ? fontesDeLuz(map) : [];
    const acesas = fontes.filter((f) => f.acesa).length;
    const trocar = (acender: boolean) => {
      const itens = fontes.filter((f) => f.acesa !== acender).map((f) => ({ id: f.id, state: acender ? f.acender : f.apagada }));
      if (itens.length) this.app.net.send({ t: 'luzes', itens });
      window.setTimeout(() => this.win.isOpen && this.render(), 400);
    };
    const luzes = fontes.length
      ? h(
          'div',
          null,
          h('label', { class: 'field-label' }, `Fontes de luz: ${acesas} de ${fontes.length} acesas`),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn', disabled: !acesas, title: 'Apaga lâmpadas, velas, lareiras e telas do cômodo (as janelas continuam)', onclick: () => trocar(false) }, 'Apagar as luzes'),
            h('button', { class: 'btn', disabled: acesas === fontes.length, title: 'Acende de novo todas as fontes de luz do cômodo', onclick: () => trocar(true) }, 'Acender tudo'),
          ),
        )
      : null;
    b.append(
      h('label', { class: 'field-label' }, 'Luz ambiente'),
      modes,
      ...(luzes ? [luzes] : []),
      slider('Névoa', r.fog, 100, (v) => send({ fog: v }), (v) => info && (info.fog = v)),
      slider('Escuridão', r.darkness, 90, (v) => send({ darkness: v }), (v) => info && (info.darkness = v)),
      slider('Partículas', r.particleLevel ?? DEFAULT_PARTICLE_LEVEL, 100, (v) => send({ particleLevel: v }), (v) => info && (info.particleLevel = v)),
      h('p', { class: 'muted' }, (r.particles ?? []).length ? 'Muda na hora para todos na cena.' : 'Muda na hora para todos na cena. Esta cena não tem partículas: ligue em Configurar cena.'),
    );
  }
}
