import { combate, criaturaDoLivro, type AparenciaCriatura, type Criatura } from '@crona/shared';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { sfx } from './sfx';
import './bestiario.css';

/**
 * A janela CRIATURAS (10/10, o Felipe): o bestiário. Cada criatura tem UMA ficha (do livro ou adaptada) e várias
 * aparências; "Colocar em campo" põe N peças dela na cena, cada uma com os próprios PV e condições, todas atacando e
 * resistindo pela mesma ficha. A aparência de cada peça: uma escolhida, ou "variadas" (uma de cada, em roda), para a
 * cena não ter dez caras iguais. Editar a ficha de UMA peça continua no combate (vira uma cópia só dela).
 */
export function abrirBestiario(app: App) {
  let sel: string | null = app.state.bestiario[0]?.id ?? null;
  let aparencia = 'variadas';
  let quantidade = 3;
  const j = janela('CRIATURAS', 'caveira', () => app.off('bestiario', desenhar), 78);
  const lista = h('div', { class: 'bs-lista' });
  const detalhe = h('div', { class: 'bs-detalhe' });
  j.corpo.append(h('p', { class: 'vg-dica' }, 'Uma ficha por criatura, várias aparências. Cada peça em campo é única: os próprios PV e condições, os ataques da mesma ficha.'), h('div', { class: 'bs' }, lista, detalhe));

  const salvar = (c: Criatura) => app.net.send({ t: 'criaturaSalvar', criatura: c });
  const atual = () => app.state.bestiario.find((c) => c.id === sel) ?? null;

  const amostra = (a: AparenciaCriatura) => h('i', { class: 'bs-amostra', style: `--pele:${a.look.skin};--roupa:${a.look.top}`, 'aria-hidden': 'true' });

  const desenhar = () => {
    const cs = app.state.bestiario;
    if (!cs.some((c) => c.id === sel)) sel = cs[0]?.id ?? null;
    lista.replaceChildren(
      ...cs.map((c) =>
        h(
          'button',
          { class: `bs-item${c.id === sel ? ' on' : ''}`, type: 'button', onclick: () => ((sel = c.id), (aparencia = 'variadas'), sfx.click(), desenhar()) },
          h('b', null, c.nome),
          h('small', null, `VD ${c.ficha.vd ?? '?'} · PV ${c.pv} · ${c.aparencias.length} ${c.aparencias.length === 1 ? 'aparência' : 'aparências'}`),
        ),
      ),
      novaDoLivro(),
    );
    const c = atual();
    if (!c) {
      detalhe.replaceChildren(h('p', { class: 'bs-vazio' }, 'Nenhuma criatura. Crie uma a partir do livro, à esquerda.'));
      return;
    }
    if (aparencia !== 'variadas' && !c.aparencias.some((a) => a.id === aparencia)) aparencia = 'variadas';
    const f = c.ficha;
    detalhe.replaceChildren(
      h('header', { class: 'bs-cab' }, h('h4', null, c.nome), h('small', null, `${f.tipo}${f.livro ? ' · do livro' : ''}`)),
      h(
        'div',
        { class: 'bs-numeros' },
        campoNumero('PV de cada peça', c.pv, (v) => salvar({ ...c, pv: v })),
        h('span', null, h('small', null, 'Defesa'), h('b', null, String(f.defesa))),
        h('span', null, h('small', null, 'Ataques'), h('b', null, f.ataques.map((a) => a.nome).join(', ') || '—')),
        h(
          'label',
          { class: 'bs-flutua' },
          h('input', { type: 'checkbox', checked: !!c.flutua, onchange: (e: Event) => salvar({ ...c, flutua: (e.target as HTMLInputElement).checked || undefined }) }),
          h('span', null, 'Flutua (não toca o chão)'),
        ),
      ),
      h('h5', null, 'Aparências'),
      h(
        'div',
        { class: 'bs-aparencias' },
        ...c.aparencias.map((a) =>
          h(
            'div',
            { class: 'bs-ap' },
            amostra(a),
            h('input', { class: 'bs-ap-nome', value: a.nome, maxlength: '30', onchange: (e: Event) => trocar(c, a.id, { nome: (e.target as HTMLInputElement).value || a.nome }) }),
            h('label', { title: 'Cor da pele' }, h('input', { type: 'color', value: a.look.skin, onchange: (e: Event) => trocar(c, a.id, { look: { ...a.look, skin: (e.target as HTMLInputElement).value } }) })),
            h('label', { title: 'Cor da roupa' }, h('input', { type: 'color', value: a.look.top, onchange: (e: Event) => trocar(c, a.id, { look: { ...a.look, top: (e.target as HTMLInputElement).value, pants: (e.target as HTMLInputElement).value } }) })),
            h('small', { class: 'bs-ap-arte', title: 'A arte pintada, quando o Códex entregar' }, a.arte ? `arte: ${a.arte}` : 'sem arte'),
            c.aparencias.length > 1 ? h('button', { class: 'bs-x', type: 'button', title: 'Tirar esta aparência', onclick: () => salvar({ ...c, aparencias: c.aparencias.filter((x) => x.id !== a.id) }) }, '×') : null,
          ),
        ),
        botao('Nova aparência', 'mais', 'claro', () => {
          let n = c.aparencias.length + 1;
          while (c.aparencias.some((a) => a.id === `aparencia-${n}`)) n++;
          salvar({ ...c, aparencias: [...c.aparencias, { id: `aparencia-${n}`, nome: `Aparência ${n}`, look: { ...c.aparencias[0].look } }] });
        }),
      ),
      h('h5', null, 'Colocar em campo'),
      h(
        'div',
        { class: 'bs-campo' },
        h(
          'div',
          { class: 'bs-escolha', role: 'radiogroup', 'aria-label': 'Aparência das peças' },
          ...[{ id: 'variadas', nome: 'Variadas' }, ...c.aparencias].map((a) =>
            h('button', { class: `bs-chip${aparencia === a.id ? ' on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(aparencia === a.id), onclick: () => ((aparencia = a.id), sfx.click(), desenhar()) }, a.nome),
          ),
        ),
        h(
          'div',
          { class: 'bs-qtd' },
          h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => ((quantidade = Math.max(1, quantidade - 1)), desenhar()) }, '−'),
          h('b', null, String(quantidade)),
          h('button', { type: 'button', 'aria-label': 'Mais', onclick: () => ((quantidade = Math.min(20, quantidade + 1)), desenhar()) }, '+'),
        ),
        botao(`Colocar ${quantidade}`, 'caveira', 'forte', () => {
          app.net.send({ t: 'criaturaColocar', criaturaId: c.id, aparencia, quantidade });
          sfx.click();
        }),
      ),
      h('div', { class: 'bs-apagar' }, botao('Apagar criatura', 'lixo', 'perigo', () => confirm(`Apagar ${c.nome} do bestiário? As peças em campo ficam, mas sem a ficha.`) && app.net.send({ t: 'criaturaApagar', id: c.id }))),
    );
  };

  const trocar = (c: Criatura, id: string, muda: Partial<AparenciaCriatura>) => salvar({ ...c, aparencias: c.aparencias.map((a) => (a.id === id ? { ...a, ...muda } : a)) });

  const campoNumero = (rotulo: string, valor: number, mudou: (v: number) => void) =>
    h(
      'label',
      { class: 'bs-num' },
      h('small', null, rotulo),
      h('input', { type: 'number', min: '1', max: '9999', value: String(valor), onchange: (e: Event) => {
        const v = Math.round(Number((e.target as HTMLInputElement).value));
        if (v >= 1) mudou(v);
      } }),
    );

  const novaDoLivro = () => {
    const sel2 = h(
      'select',
      { class: 'bs-livro', 'aria-label': 'Ameaça do livro' },
      h('option', { value: '' }, '+ Nova, do livro…'),
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
  j.rodape.append(botao('Fechar', 'fechar', 'claro', () => j.fechar()));
  app.net.send({ t: 'bestiario' });
  desenhar();
}
