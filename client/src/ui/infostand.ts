import { anyFurniName, CATEGORY_NAMES, getFurni, getWallFurni, HINT_ICONS, giroQueCabe, nextRotation, type Hint, type HintIcon } from '@crona/shared';
import { drawHintGlyph } from '../render/hints';
import { thumbCopy } from '../render/thumbs';
import type { App } from './app';
import { clear, h, icon, toast, Win } from './dom';
import { AvatarPreview } from './lookEditor';

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

export class Infostand {
  readonly el: HTMLElement;
  private app: App;
  private preview: AvatarPreview | null = null;
  private hintEditor: HintEditor;
  private hintViewer: HintViewer;
  private onLook: () => void;

  constructor(app: App, onLook: () => void) {
    this.app = app;
    this.onLook = onLook;
    this.el = h('aside', { class: 'infostand hidden', 'aria-live': 'polite' });
    this.hintEditor = new HintEditor(app);
    this.hintViewer = new HintViewer(app);
    app.on('selection', () => this.render());
    app.on('items', () => this.render());
    app.on('room', () => this.render());
  }

  openHint(kind: 'floor' | 'wall', id: number) {
    this.hintViewer.open(kind, id);
  }

  editHint(kind: 'floor' | 'wall', id: number) {
    this.hintEditor.open(kind, id);
  }

  private render() {
    const sel = this.app.view.selection;
    this.preview?.destroy();
    this.preview = null;
    const el = clear(this.el);
    const map = this.app.view.map;
    if (!sel || !map) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const net = this.app.net;
    const canBuild = this.app.canBuild;
    const act = (name: string, label: string, fn: () => void) => h('button', { class: 'act', onclick: fn }, icon(name, 16), label);
    const closeBtn = h('button', { class: 'win-close', 'aria-label': 'Fechar', onclick: () => this.app.view.select(null) }, icon('close', 14));

    if (sel.kind === 'user') {
      const u = this.app.view.users.get(sel.id);
      if (!u) return el.classList.add('hidden');
      const me = u.id === this.app.view.myId;
      this.preview = new AvatarPreview(u.look, 96, 130);
      const actions = h('div', { class: 'acts' });
      if (me) {
        actions.append(
          act('wave', 'Acenar', () => net.send({ t: 'action', action: 'wave' })),
          act('music', 'Dançar', () => net.send({ t: 'action', action: 'dance' })),
          u.sit === 2 ? act('sit', 'Levantar', () => net.send({ t: 'action', action: 'stand' })) : act('sit', 'Sentar', () => net.send({ t: 'action', action: 'sit' })),
          act('user', 'Visual', this.onLook),
        );
      }
      el.append(h('div', { class: 'info-head' }, h('b', null, u.name), closeBtn), h('div', { class: 'info-body' }, this.preview.canvas, h('div', { class: 'info-meta' }, me ? 'Você' : 'Jogador', u.look.charId ? h('small', null, 'personagem com sprite') : h('small', null, 'avatar pixel'))), actions);
      return;
    }

    const floor = sel.kind === 'floor' ? map.getItem(sel.id) : undefined;
    const wall = sel.kind === 'wall' ? map.getWallItem(sel.id) : undefined;
    const item = floor ?? wall;
    if (!item) return el.classList.add('hidden');
    const fdef = floor ? getFurni(floor.defId) : undefined;
    const wdef = wall ? getWallFurni(wall.defId) : undefined;
    const states = fdef?.states ?? wdef?.states ?? 0;
    const actions = h('div', { class: 'acts' });
    if (states > 1) actions.append(act('power', 'Usar', () => net.send({ t: 'use', id: item.id })));
    if (item.hint && (item.hint.visible || canBuild)) actions.append(act('eye', 'Ver pista', () => this.hintViewer.open(sel.kind as 'floor' | 'wall', item.id)));
    if (canBuild) {
      if (floor && fdef && fdef.rotations.length > 1)
        actions.append(
          act('rotate', 'Girar', () => {
            const rot = giroQueCabe(fdef, floor.rot, (r) => map.canPlace(floor.defId, floor.x, floor.y, r, floor.id).ok);
            if (rot === null) return toast(map.canPlace(floor.defId, floor.x, floor.y, nextRotation(fdef, floor.rot), floor.id).reason ?? 'Não dá para girar aqui.', 'error');
            net.send({ t: 'moveItem', id: floor.id, x: floor.x, y: floor.y, rot });
          }),
        );
      actions.append(
        act('move', 'Mover', () => {
          if (floor) this.app.view.startPlacement({ kind: 'floor', defId: floor.defId, rot: floor.rot, moveId: floor.id });
          else if (wall) this.app.view.startPlacement({ kind: 'wall', defId: wall.defId, moveId: wall.id });
          this.app.emit('placement');
        }),
        act('pickup', 'Guardar', () => net.send({ t: 'pickup', id: item.id })),
        act('clue', item.hint ? 'Editar pista' : 'Criar pista', () => this.hintEditor.open(sel.kind as 'floor' | 'wall', item.id)),
      );
      const hint = item.hint;
      if (hint)
        actions.append(
          act('eye', hint.visible ? 'Ocultar pista' : 'Revelar pista', () =>
            net.send({ t: 'setHint', id: item.id, hint: { ...hint, visible: !hint.visible } }),
          ),
        );
    }
    const hintTag = item.hint
      ? h('div', { class: `hint-tag${item.hint.visible ? '' : ' hidden-hint'}` }, hintGlyph(item.hint.icon, 14), item.hint.visible ? 'Pista visível' : 'Pista oculta (só o mestre vê)')
      : null;
    const facts = fdef
      ? [CATEGORY_NAMES[fdef.category], `${fdef.width}×${fdef.depth}`, fdef.sit ? 'assento' : '', fdef.walkable ? 'pisável' : '', fdef.stackable ? 'empilhável' : '']
          .filter(Boolean)
          .join(' · ')
      : 'Mobi de parede';
    const desc = fdef?.desc ?? wdef?.desc;
    let portalBox: HTMLElement | null = null;
    if (floor && fdef?.portal) {
      const rooms = this.app.state.rooms.filter((r) => r.id !== this.app.state.room?.id);
      const target = rooms.find((r) => r.id === floor.link);
      if (canBuild) {
        const sel = h(
          'select',
          { class: 'input small portal-sel', 'aria-label': 'Destino da passagem' },
          h('option', { value: '' }, '— sem destino —'),
          ...rooms.map((r) => h('option', { value: String(r.id), selected: r.id === floor.link }, r.name)),
        );
        sel.addEventListener('change', () => net.send({ t: 'setLink', id: floor.id, roomId: sel.value ? Number(sel.value) : null }));
        portalBox = h('label', { class: 'portal-box' }, 'Leva para', sel);
      } else portalBox = h('div', { class: 'portal-box' }, target ? `Leva para: ${target.name}` : 'Passagem fechada');
    }
    el.append(
      h('div', { class: 'info-head' }, h('b', null, anyFurniName(item.defId)), closeBtn),
      h('div', { class: 'info-body' }, h('div', { class: 'info-thumb' }, thumbCopy(item.defId, 80)), h('div', { class: 'info-meta' }, facts, desc ? h('small', null, desc) : null, hintTag)),
      ...(portalBox ? [portalBox] : []),
      actions,
    );
  }
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
