/**
 * Janelas da tela FICHAS (no estilo das referências): escolher entre as
 * opções do motor de regras (liberadas ou travadas, com o motivo), escrever
 * um texto e confirmar. Tudo por cima da tela, com Esc para fechar.
 */
import type { regras } from '@crona/shared';
import { h } from './dom';
import type { Escolher } from './fichaRegras';
import { textoRef } from './fichaRegras';
import { ic, type NomeIcone } from './icons';
import { paperize } from './paperArt';

interface Janela {
  el: HTMLElement;
  corpo: HTMLElement;
  rodape: HTMLElement;
  fechar: () => void;
}

const abertas: Janela[] = [];
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !abertas.length) return;
  e.stopPropagation();
  abertas[abertas.length - 1].fechar();
});

/** Quem espera todas as janelas fecharem (a edição direta da FICHAS grava nessa hora). */
const aoFecharTodas: (() => void)[] = [];
/** Roda `fn` uma vez, quando não sobrar janela aberta (a que abre logo em seguida conta: espera um instante). */
export function quandoFecharTodas(fn: () => void): void {
  aoFecharTodas.push(fn);
}
function conferirFechadas() {
  setTimeout(() => {
    if (abertas.length) return;
    for (const fn of aoFecharTodas.splice(0)) fn();
  }, 60);
}

/** Alguma janela aberta (os atalhos do tabuleiro ficam quietos enquanto isso). */
export function janelaAberta(): boolean {
  return abertas.length > 0;
}

/** Janela de papel no meio da tela. `aoFechar` roda uma vez. */
export function janela(titulo: string, icone: NomeIcone, aoFechar: () => void, largura = 62): Janela {
  const corpo = h('div', { class: 'fj-corpo' });
  const rodape = h('div', { class: 'fj-rodape' });
  const fecharBt = h('button', { class: 'fj-x', type: 'button', title: 'Fechar', 'aria-label': 'Fechar' }, ic('fechar'));
  const caixa = h('section', { class: 'fj', role: 'dialog', 'aria-label': titulo, style: `width:min(${largura}rem, 94vw)` }, h('header', { class: 'fx-tit' }, h('span', { class: 'fx-tit-ic' }, ic(icone)), h('h3', null, titulo), fecharBt), corpo, rodape);
  paperize(caixa, { seed: 71 + titulo.length, tone: '#d8c7a6', burn: 1, torn: 1.4, stains: 1, creases: 0.4, pad: 26 });
  const fundo = h('div', { class: 'fj-fundo' }, caixa);
  let fechada = false;
  const j: Janela = {
    el: fundo,
    corpo,
    rodape,
    fechar: () => {
      if (fechada) return;
      fechada = true;
      const i = abertas.indexOf(j);
      if (i >= 0) abertas.splice(i, 1);
      fundo.classList.add('saindo');
      setTimeout(() => fundo.remove(), 160);
      aoFechar();
      if (!abertas.length) conferirFechadas();
    },
  };
  fecharBt.addEventListener('click', () => j.fechar());
  fundo.addEventListener('pointerdown', (e) => {
    if (e.target === fundo) j.fechar();
  });
  document.body.append(fundo);
  abertas.push(j);
  return j;
}

/** Botão do rodapé das janelas de papel. */
export function botao(rotulo: string, icone: NomeIcone | null, cls: string, onclick: () => void): HTMLButtonElement {
  return h('button', { class: `fx-bt ${cls}`, type: 'button', onclick }, icone ? ic(icone) : null, h('span', null, rotulo));
}

/** Linha de uma opção: nome, página, resumo, requisitos, motivo do bloqueio. */
function linhaOpcao(o: regras.Opcao, marcado: boolean, multi: boolean, onclick: () => void): HTMLElement {
  const motivos = o.motivos.length ? h('div', { class: 'fo-motivos' }, ic('cadeado'), o.motivos.join(' ')) : null;
  const avisos = o.avisos.length ? h('div', { class: 'fo-avisos' }, ic('alerta'), o.avisos.join(' ')) : null;
  const reqs = o.requisitos?.length ? h('div', { class: 'fo-reqs' }, ...o.requisitos.map((r) => h('span', null, r))) : null;
  const el = h(
    'button',
    { class: `fo${o.ok ? '' : ' travada'}${marcado ? ' on' : ''}`, type: 'button', 'aria-pressed': String(marcado), disabled: !o.ok && !marcado, onclick },
    h('span', { class: `fo-marca${multi ? ' multi' : ''}` }, marcado ? ic('ok') : null),
    h('span', { class: 'fo-txt' }, h('span', { class: 'fo-nome' }, o.nome, o.ref ? h('small', null, textoRef(o.ref)) : null), o.resumo ? h('span', { class: 'fo-resumo' }, o.resumo) : null, reqs, motivos, avisos),
  );
  return el;
}

/**
 * Abre a escolha. Resolve `true` quando algo foi gravado (e já abre a escolha
 * seguinte, se houver: o parâmetro do poder recém-escolhido).
 */
export function escolher(e: Escolher, aoGravar: () => void): Promise<boolean> {
  return new Promise((res) => {
    let gravou = false;
    const j = janela(e.titulo, 'estrela', () => res(gravou), 70);
    if (e.dica) j.corpo.append(h('p', { class: 'fj-dica' }, e.dica));
    if (e.texto) {
      const inp = h('input', { class: 'fx-inp', value: e.texto.valor(), maxlength: 60, placeholder: e.texto.rotulo }) as HTMLInputElement;
      j.corpo.append(h('label', { class: 'fj-campo' }, h('span', null, e.texto.rotulo), inp));
      const ok = () => {
        e.texto!.aplicar(inp.value);
        gravou = true;
        aoGravar();
        j.fechar();
      };
      inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && ok());
      j.rodape.append(botao('Cancelar', 'fechar', '', () => j.fechar()), botao('Gravar', 'ok', 'forte', ok));
      setTimeout(() => inp.focus(), 30);
      return;
    }
    const escolhidos = new Set(e.atual());
    const busca = h('input', { class: 'fx-inp fj-busca', type: 'search', placeholder: 'Procurar…' }) as HTMLInputElement;
    const soLivres = h('input', { type: 'checkbox' }) as HTMLInputElement;
    const cont = h('span', { class: 'fj-cont' });
    const aviso = h('p', { class: 'fj-dica fj-aviso-erro' });
    const lista = h('div', { class: 'fj-lista' });
    const ops = e.opcoes();
    const multi = e.qtd > 1;
    j.corpo.append(h('div', { class: 'fj-filtros' }, busca, h('label', { class: 'fj-check' }, soLivres, 'só as liberadas'), cont), aviso, lista);
    const desenhar = () => {
      const q = busca.value.trim().toLowerCase();
      lista.replaceChildren();
      const vis = ops.filter((o) => (!q || o.nome.toLowerCase().includes(q)) && (!soLivres.checked || o.ok || escolhidos.has(o.id)));
      // liberadas primeiro, na ordem do catálogo
      vis.sort((a, b) => Number(b.ok) - Number(a.ok));
      for (const o of vis)
        lista.append(
          linhaOpcao(o, escolhidos.has(o.id), multi, () => {
            aviso.replaceChildren();
            if (escolhidos.has(o.id)) escolhidos.delete(o.id);
            else {
              if (!multi) escolhidos.clear();
              else if (escolhidos.size >= e.qtd) return;
              escolhidos.add(o.id);
            }
            desenhar();
          }),
        );
      if (!vis.length) lista.append(h('p', { class: 'fj-vazio' }, 'Nada com esse nome.'));
      cont.textContent = multi ? `${escolhidos.size} de ${e.qtd}` : '';
      gravar.disabled = multi ? escolhidos.size === 0 && !e.podeVazio : escolhidos.size !== 1 && !e.atual().length;
    };
    const gravar = botao('Gravar', 'ok', 'forte', () => {
      const motivo = e.validar?.([...escolhidos]);
      if (motivo) return void aviso.replaceChildren(motivo);
      e.aplicar([...escolhidos]);
      gravou = true;
      aoGravar();
      j.fechar();
      const prox = e.depois?.();
      if (prox) void escolher(prox, aoGravar);
    });
    const limpar = botao('Tirar a escolha', 'lixo', '', () => {
      e.aplicar([]);
      gravou = true;
      aoGravar();
      j.fechar();
    });
    j.rodape.append(e.atual().length ? limpar : h('span'), h('span', { class: 'fj-esp' }), botao('Cancelar', 'fechar', '', () => j.fechar()), gravar);
    busca.addEventListener('input', desenhar);
    soLivres.addEventListener('change', desenhar);
    desenhar();
    setTimeout(() => busca.focus(), 30);
  });
}

/** Pergunta um texto (nome, idade, apelido...). */
export function perguntarTexto(titulo: string, rotulo: string, valor: string, max = 60): Promise<string | null> {
  return new Promise((res) => {
    let saida: string | null = null;
    const j = janela(titulo, 'lapis', () => res(saida), 46);
    const inp = h('input', { class: 'fx-inp', value: valor, maxlength: max }) as HTMLInputElement;
    j.corpo.append(h('label', { class: 'fj-campo' }, h('span', null, rotulo), inp));
    const ok = () => {
      saida = inp.value;
      j.fechar();
    };
    inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && ok());
    j.rodape.append(h('span', { class: 'fj-esp' }), botao('Cancelar', 'fechar', '', () => j.fechar()), botao('Gravar', 'ok', 'forte', ok));
    setTimeout(() => (inp.focus(), inp.select()), 30);
  });
}

/** Confirmação (apagar, trocar a classe...). */
export function confirmar(titulo: string, texto: string, sim = 'Confirmar', perigo = false): Promise<boolean> {
  return new Promise((res) => {
    let ok = false;
    const j = janela(titulo, perigo ? 'alerta' : 'ok', () => res(ok), 46);
    j.corpo.append(h('p', { class: 'fj-texto' }, texto));
    j.rodape.append(
      h('span', { class: 'fj-esp' }),
      botao('Cancelar', 'fechar', '', () => j.fechar()),
      botao(sim, perigo ? 'lixo' : 'ok', perigo ? 'perigo' : 'forte', () => {
        ok = true;
        j.fechar();
      }),
    );
  });
}

/** Janela só de leitura (lista de pendências, avisos, link do jogador). */
export function mostrar(titulo: string, icone: NomeIcone, conteudo: Node[], largura = 60): Janela {
  const j = janela(titulo, icone, () => {}, largura);
  j.corpo.append(...conteudo);
  j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'fechar', '', () => j.fechar()));
  return j;
}
