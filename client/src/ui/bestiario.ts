import { combate, criaturaDoLivro, type AparenciaCriatura, type Criatura } from '@crona/shared';
import { drawPixelAvatar } from '../render/avatarPixel';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { ic } from './icons';
import { sfx } from './sfx';
import './bestiario.css';

/**
 * A janela CRIATURAS (10/10, o Felipe): o bestiário. Cada criatura tem UMA ficha (do livro ou adaptada) e várias
 * aparências; "Colocar em campo" põe N peças dela na cena, cada uma com os próprios PV e condições, todas atacando e
 * resistindo pela mesma ficha. A aparência de cada peça: uma escolhida, ou "variadas" (uma de cada, em roda), para a
 * cena não ter dez caras iguais. Editar a ficha de UMA peça continua no combate (vira uma cópia só dela).
 *
 * No formato de cards verticais das referências do Felipe (os cards de loja: o pregador, o nome, o quadro, a
 * plaquinha e o rodapé), o mesmo dos cards de escolha do combate (`cards.css`).
 */
export function abrirBestiario(app: App) {
  let sel: string | null = app.state.bestiario[0]?.id ?? null;
  let aparencia = 'variadas';
  let quantidade = 3;
  const j = janela('CRIATURAS', 'caveira', () => (app.off('bestiario', desenhar), app.off('characters', desenhar)), 92);
  const topo = h('div', { class: 'bs-topo cards-v' });
  const detalhe = h('div', { class: 'bs-detalhe' });
  j.corpo.append(
    h('p', { class: 'vg-dica' }, 'Uma ficha por criatura, várias aparências. Cada peça em campo é única: os próprios PV e condições; os ataques saem da mesma ficha.'),
    topo,
    detalhe,
  );

  const salvar = (c: Criatura) => app.net.send({ t: 'criaturaSalvar', criatura: c });
  const atual = () => app.state.bestiario.find((c) => c.id === sel) ?? null;

  /** O retrato que o Códex entregou para a aparência (o personagem da pasta arte/personagens/<arte>/), se já chegou. */
  const retrato = (a: AparenciaCriatura) => (a.arte ? app.state.characters.find((ch) => ch.sheet.includes(`/personagens/${a.arte}/`))?.portraits?.desarmado?.open : undefined);

  /** O quadro da aparência: o retrato da arte; sem arte, o boneco de pixel. */
  const boneco = (a: AparenciaCriatura) => {
    const url = retrato(a);
    if (url) return h('img', { class: 'bs-retrato', src: url, alt: a.nome, decoding: 'async' });
    const cv = h('canvas', { class: 'bs-boneco', width: 90, height: 90 });
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.save();
    g.scale(0.78, 0.78);
    drawPixelAvatar(g, { ...a.look, charId: null }, 90 / 0.78 / 2, 90 / 0.78 - 4, 2, 2, { pose: 'stand', frame: 0, wave: false, dance: false, blink: false });
    g.restore();
    return cv;
  };

  const card = (o: { cls?: string; titulo: string; quadro: Node; placa: string; pe: string; onclick?: () => void; extra?: Node[] }) =>
    h(
      o.onclick ? 'button' : 'div',
      { class: `card-v ${o.cls ?? ''}`, ...(o.onclick ? { type: 'button', onclick: () => (sfx.click(), o.onclick!()) } : {}) },
      h('b', { class: 'card-tit' }, o.titulo),
      h('span', { class: 'card-quadro' }, o.quadro),
      h('small', { class: 'card-placa' }, o.placa),
      ...(o.extra ?? []),
      h('span', { class: 'card-pe' }, o.pe),
    );

  const desenhar = () => {
    const cs = app.state.bestiario;
    if (!cs.some((c) => c.id === sel)) sel = cs[0]?.id ?? null;
    // as criaturas, uma em cada card, e o card de criar outra a partir do livro
    topo.replaceChildren(
      ...cs.map((c) =>
        card({
          cls: `bs-cr${c.id === sel ? ' escolhido' : ''}`,
          titulo: c.nome,
          quadro: boneco(c.aparencias[0]),
          placa: `VD ${c.ficha.vd ?? '?'} · PV ${c.pv} · ${c.aparencias.length} ${c.aparencias.length === 1 ? 'cara' : 'caras'}`,
          pe: c.id === sel ? 'Escolhida' : 'Ver',
          onclick: () => ((sel = c.id), (aparencia = 'variadas'), desenhar()),
        }),
      ),
      card({ cls: 'bs-nova', titulo: 'Nova', quadro: ic('mais'), placa: 'uma ameaça do livro', pe: 'Do livro', extra: [novaDoLivro()] }),
    );
    const c = atual();
    if (!c) {
      detalhe.replaceChildren(h('p', { class: 'bs-vazio' }, 'Nenhuma criatura ainda: crie uma a partir do livro.'));
      return;
    }
    if (aparencia !== 'variadas' && !c.aparencias.some((a) => a.id === aparencia)) aparencia = 'variadas';
    const f = c.ficha;
    detalhe.replaceChildren(
      h(
        'div',
        { class: 'bs-ficha' },
        h('h4', null, c.nome),
        h('small', null, `${f.tipo}${f.livro ? ' · ficha do livro' : ''}`),
        campoNumero('PV de cada peça', c.pv, (v) => salvar({ ...c, pv: v })),
        h('span', { class: 'bs-dado' }, h('small', null, 'Defesa'), h('b', null, String(f.defesa))),
        h('span', { class: 'bs-dado' }, h('small', null, 'Ataques'), h('b', null, f.ataques.map((a) => a.nome).join(', ') || '—')),
        h(
          'label',
          { class: 'bs-flutua' },
          h('input', { type: 'checkbox', checked: !!c.flutua, onchange: (e: Event) => salvar({ ...c, flutua: (e.target as HTMLInputElement).checked || undefined }) }),
          h('span', null, 'Flutua (não toca o chão)'),
        ),
      ),
      h('h5', null, 'Escolha a aparência das peças'),
      h(
        'div',
        { class: 'cards-v bs-aps' },
        card({
          cls: `bs-ap${aparencia === 'variadas' ? ' escolhido' : ''}`,
          titulo: 'Variadas',
          quadro: h('span', { class: 'bs-varias' }, ...c.aparencias.slice(0, 3).map((a) => boneco(a))),
          placa: 'uma de cada, em roda',
          pe: aparencia === 'variadas' ? 'Escolhida' : 'Usar',
          onclick: () => ((aparencia = 'variadas'), desenhar()),
        }),
        ...c.aparencias.map((a) =>
          card({
            cls: `bs-ap${aparencia === a.id ? ' escolhido' : ''}`,
            titulo: a.nome,
            quadro: boneco(a),
            placa: retrato(a) ? 'arte do Códex' : a.arte ? 'arte a caminho' : 'boneco de pixel',
            pe: aparencia === a.id ? 'Escolhida' : 'Usar',
            onclick: () => ((aparencia = a.id), desenhar()),
            extra: [
              h(
                'span',
                { class: 'bs-ap-edita', onclick: (e: Event) => e.stopPropagation() },
                h('input', { class: 'bs-ap-nome', value: a.nome, maxlength: '30', title: 'O nome da aparência', onchange: (e: Event) => trocar(c, a.id, { nome: (e.target as HTMLInputElement).value || a.nome }) }),
                h('input', { type: 'color', value: a.look.skin, title: 'A pele', onchange: (e: Event) => trocar(c, a.id, { look: { ...a.look, skin: (e.target as HTMLInputElement).value } }) }),
                h('input', { type: 'color', value: a.look.top, title: 'A roupa', onchange: (e: Event) => trocar(c, a.id, { look: { ...a.look, top: (e.target as HTMLInputElement).value, pants: (e.target as HTMLInputElement).value } }) }),
                c.aparencias.length > 1 ? h('button', { class: 'bs-x', type: 'button', title: 'Tirar esta aparência', onclick: () => salvar({ ...c, aparencias: c.aparencias.filter((x) => x.id !== a.id) }) }, '×') : null,
              ),
            ],
          }),
        ),
        card({
          cls: 'bs-nova',
          titulo: 'Nova cara',
          quadro: ic('mais'),
          placa: 'outra aparência',
          pe: 'Criar',
          onclick: () => {
            let n = c.aparencias.length + 1;
            while (c.aparencias.some((a) => a.id === `aparencia-${n}`)) n++;
            salvar({ ...c, aparencias: [...c.aparencias, { id: `aparencia-${n}`, nome: `Aparência ${n}`, look: { ...c.aparencias[0].look } }] });
          },
        }),
      ),
      h(
        'div',
        { class: 'bs-campo' },
        h('span', { class: 'bs-campo-rot' }, 'Quantas em campo'),
        h(
          'div',
          { class: 'bs-qtd' },
          h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => ((quantidade = Math.max(1, quantidade - 1)), desenhar()) }, '−'),
          h('b', null, String(quantidade)),
          h('button', { type: 'button', 'aria-label': 'Mais', onclick: () => ((quantidade = Math.min(20, quantidade + 1)), desenhar()) }, '+'),
        ),
        botao(`Colocar ${quantidade} em campo`, 'caveira', 'forte', () => {
          app.net.send({ t: 'criaturaColocar', criaturaId: c.id, aparencia, quantidade });
          sfx.click();
        }),
        h('span', { class: 'bs-apagar' }, botao('Apagar criatura', 'lixo', 'perigo', () => confirm(`Apagar ${c.nome} do bestiário? As peças em campo ficam, mas sem a ficha.`) && app.net.send({ t: 'criaturaApagar', id: c.id }))),
      ),
    );
  };

  const trocar = (c: Criatura, id: string, muda: Partial<AparenciaCriatura>) => salvar({ ...c, aparencias: c.aparencias.map((a) => (a.id === id ? { ...a, ...muda } : a)) });

  const campoNumero = (rotulo: string, valor: number, mudou: (v: number) => void) =>
    h(
      'label',
      { class: 'bs-dado bs-num' },
      h('small', null, rotulo),
      h('input', {
        type: 'number',
        min: '1',
        max: '9999',
        value: String(valor),
        onchange: (e: Event) => {
          const v = Math.round(Number((e.target as HTMLInputElement).value));
          if (v >= 1) mudou(v);
        },
      }),
    );

  const novaDoLivro = () => {
    const sel2 = h(
      'select',
      { class: 'bs-livro', 'aria-label': 'Ameaça do livro' },
      h('option', { value: '' }, 'Escolher…'),
      ...combate.AMEACAS_LIVRO.map((a) => h('option', { value: a.id }, `${a.nome} (VD ${a.vd})`)),
    ) as HTMLSelectElement;
    sel2.onchange = () => {
      const id = sel2.value;
      if (!id) return;
      let uid = id;
      let k = 2;
      while (app.state.bestiario.some((c) => c.id === uid)) uid = `${id}-${k++}`;
      const c = criaturaDoLivro(id, uid);
      if (c) {
        sel = uid;
        salvar(c);
      }
    };
    return sel2;
  };

  app.on('bestiario', desenhar);
  // a arte que chega (o retrato da aparência) entra sem fechar a janela
  app.on('characters', desenhar);
  j.rodape.append(botao('Fechar', 'fechar', 'claro', () => j.fechar()));
  app.net.send({ t: 'bestiario' });
  desenhar();
}
