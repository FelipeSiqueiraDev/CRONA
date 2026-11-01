import { anyFurniName, HINT_ICONS, type Hint, type HintIcon } from '@crona/shared';
import { drawHintGlyph } from '../render/hints';
import { thumbCopy } from '../render/thumbs';
import type { App } from './app';
import { clear, h, icon, Win } from './dom';

const ICON_NAMES: Record<HintIcon, string> = {
  inspect: 'Inspecionar',
  interact: 'Interagir',
  document: 'Documento',
  gear: 'Mecanismo',
  alert: 'Alerta',
};

export function hintGlyph(iconName: HintIcon, size = 22): HTMLCanvasElement {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const c = h('canvas', { width: size * dpr, height: size * dpr, style: `width:${size}px;height:${size}px` });
  const ctx = c.getContext('2d')!;
  ctx.setTransform((dpr * size) / 16, 0, 0, (dpr * size) / 16, (size * dpr) / 2, (size * dpr) / 2);
  drawHintGlyph(ctx, iconName, '#e9dfcf');
  return c;
}

export class HintEditor {
  private win: Win;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.win = new Win('Pista', { width: 380, x: innerWidth - 420, y: 120 });
  }

  open(kind: 'floor' | 'wall', id: number) {
    const map = this.app.view.map;
    const item = kind === 'floor' ? map?.getItem(id) : map?.getWallItem(id);
    if (!item) return;
    const cur: Hint = item.hint ?? { icon: 'inspect', title: anyFurniName(item.defId), text: '', visible: true };
    let chosen: HintIcon = cur.icon;
    const icons = h('div', { class: 'hint-icons' });
    for (const ic of HINT_ICONS) {
      const b = h(
        'button',
        {
          type: 'button',
          class: `hint-icon${ic === chosen ? ' on' : ''}`,
          title: ICON_NAMES[ic],
          'aria-label': ICON_NAMES[ic],
          onclick: () => {
            chosen = ic;
            icons.querySelectorAll('.hint-icon').forEach((e) => e.classList.remove('on'));
            b.classList.add('on');
          },
        },
        hintGlyph(ic),
        h('span', null, ICON_NAMES[ic]),
      );
      icons.append(b);
    }
    const title = h('input', { class: 'input', maxlength: 60, value: cur.title, placeholder: 'Título' });
    const text = h('textarea', { class: 'input', rows: 6, maxlength: 1200, placeholder: 'O que o jogador descobre ao inspecionar…' });
    text.value = cur.text;
    const visible = h('input', { type: 'checkbox', checked: cur.visible });
    const b = clear(this.win.body);
    b.append(
      h(
        'form',
        {
          class: 'form',
          onsubmit: (e: Event) => {
            e.preventDefault();
            this.app.net.send({ t: 'setHint', id, hint: { icon: chosen, title: title.value, text: text.value, visible: visible.checked } });
            this.win.close();
          },
        },
        h('label', { class: 'field-label' }, 'Ícone'),
        icons,
        h('label', { class: 'field-label' }, 'Título'),
        title,
        h('label', { class: 'field-label' }, 'Descrição'),
        text,
        h('label', { class: 'check' }, visible, 'Visível para os jogadores (desmarque para revelar depois)'),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn primary', type: 'submit' }, 'Salvar pista'),
          item.hint
            ? h(
                'button',
                {
                  class: 'btn danger',
                  type: 'button',
                  onclick: () => {
                    this.app.net.send({ t: 'setHint', id, hint: null });
                    this.win.close();
                  },
                },
                'Remover',
              )
            : null,
        ),
      ),
    );
    this.win.setTitle(`Pista · ${anyFurniName(item.defId)}`);
    this.win.open();
    title.focus();
  }
}

export class HintViewer {
  private win: Win;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.win = new Win('Inspeção', { width: 420, cls: 'dossier' });
  }

  open(kind: 'floor' | 'wall', id: number) {
    const map = this.app.view.map;
    const item = kind === 'floor' ? map?.getItem(id) : map?.getWallItem(id);
    if (!item?.hint) return;
    const hint = item.hint;
    const b = clear(this.win.body);
    b.append(
      h('div', { class: 'dossier-head' }, h('div', { class: 'dossier-icon' }, hintGlyph(hint.icon, 26)), h('div', null, h('small', null, ICON_NAMES[hint.icon].toUpperCase()), h('h3', null, hint.title || anyFurniName(item.defId)))),
      h('div', { class: 'dossier-thumb' }, thumbCopy(item.defId, 96)),
      h('p', { class: 'dossier-text' }, hint.text || 'Nada de especial por aqui… por enquanto.'),
    );
    if (!hint.visible) b.append(h('p', { class: 'hidden-hint' }, 'Pista oculta: só você (mestre) está vendo.'));
    this.win.setTitle(hint.title || 'Inspeção');
    this.win.open();
  }

  /** Um item (documento lido, item inspecionado), no mesmo papel da inspeção. */
  abrirItem(o: { titulo: string; rotulo: string; icone: Element; texto: string; linhas?: Node[] }) {
    const b = clear(this.win.body);
    b.append(
      h('div', { class: 'dossier-head' }, h('div', { class: 'dossier-icon' }, o.icone), h('div', null, h('small', null, o.rotulo.toUpperCase()), h('h3', null, o.titulo))),
      h('p', { class: 'dossier-text' }, o.texto || 'Nada escrito.'),
      ...(o.linhas ?? []),
    );
    this.win.setTitle(o.titulo);
    this.win.open();
  }
}
