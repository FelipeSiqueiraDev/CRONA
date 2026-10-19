import { NOME_TEMA, regras, type FichaSalva } from '@crona/shared';
import { h } from './dom';
import { escolherCampo, escolherPendencia, pontosAtributo, podeMudarAtributo, textoRef, type Escolher } from './fichaRegras';
import { janela } from './fichaModal';
import { ic, type NomeIcone } from './icons';
import { sfx } from './sfx';

/**
 * A criação passo a passo (docs/CRIACAO-DE-PERSONAGEM.md), que é também o caminho do Editar: começo,
 * atributos, origem, classe, perícias, evolução NEX a NEX, mochila, toques finais e a revisão. Tudo
 * no rascunho da FICHAS (que fica atrás, mudando junto); Salvar grava, Cancelar descarta. Cada passo
 * mostra se falta alguma coisa, e a coluna da direita os números ao vivo.
 */

type Ficha = regras.Ficha;
type Nex = regras.Nex;
type Passo = 'comeco' | 'atributos' | 'origem' | 'classe' | 'pericias' | 'evolucao' | 'mochila' | 'final' | 'revisao';

const PASSOS: { id: Passo; nome: string; icone: NomeIcone }[] = [
  { id: 'comeco', nome: 'Começo', icone: 'ficha' },
  { id: 'atributos', nome: 'Atributos', icone: 'pulso' },
  { id: 'origem', nome: 'Origem', icone: 'livro' },
  { id: 'classe', nome: 'Classe', icone: 'escudo' },
  { id: 'pericias', nome: 'Perícias', icone: 'dados' },
  { id: 'evolucao', nome: 'Evolução (NEX)', icone: 'linhaTempo' },
  { id: 'mochila', nome: 'Mochila', icone: 'mochila' },
  { id: 'final', nome: 'Toques finais', icone: 'pena' },
  { id: 'revisao', nome: 'Revisão', icone: 'ok' },
];

/**
 * O que fazer em cada passo, em uma ou duas frases (19/10, o Felipe: "dá pra entender nada de como usar isso"): fica
 * logo embaixo do título, num quadro, antes do que se mexe.
 */
const GUIA: Record<Passo, string> = {
  comeco: 'O nome do agente e quem joga. O mestre também acerta aqui o NEX (subir abre as escolhas novas no passo Evolução) e os pontos de prestígio (a patente).',
  atributos: 'Distribua os pontos com o − e o +. Todos começam em 1; dá para baixar um para 0 e ganhar 1 ponto; na criação nada passa de 3. Ao lado, o que cada atributo muda.',
  origem: 'Escolha de onde o agente veio. A origem dá duas perícias treinadas e um poder. Toque num cartão para escolher; os travados dizem o motivo.',
  classe: 'Combatente, Especialista ou Ocultista. A classe define PV, PE, SAN, as perícias da classe e os poderes que vêm em cada NEX.',
  pericias: 'Marque as perícias treinadas: uma de cada grupo da classe e as livres (as da classe mais uma por ponto de Intelecto). As da origem já vêm marcadas.',
  evolucao: 'Cada NEX até o de agora: o que ele deu e o que falta escolher. Toque em "Escolher" em cada pendência, de cima para baixo, até não sobrar nenhuma.',
  mochila: 'O equipamento. "Requisitar equipamento" abre a lista da Ordem (a patente limita as categorias). Toque num item para mudar o apelido, a mão e as modificações.',
  final: 'A idade, a aparência, a personalidade, o histórico e o objetivo do agente (tudo opcional), e o tema da interface dele.',
  revisao: 'Confira cada parte. Um cartão com aviso tem coisa pendente: toque nele para ir ao passo. Quando estiver tudo certo, "Salvar ficha".',
};

const ATRIB: { id: regras.AtributoId; nome: string; muda: string }[] = [
  { id: 'agi', nome: 'Agilidade', muda: 'Defesa e iniciativa; perícias de Agilidade.' },
  { id: 'for', nome: 'Força', muda: 'Carga (5 espaços por ponto; Força 0 dá 2) e dano corpo a corpo.' },
  { id: 'int', nome: 'Intelecto', muda: 'Uma perícia treinada a mais por ponto.' },
  { id: 'pre', nome: 'Presença', muda: 'PE e a DT dos rituais.' },
  { id: 'vig', nome: 'Vigor', muda: 'PV.' },
];

/** O que a tela da FICHAS empresta ao assistente (os editores que ela já tem). */
export interface ContextoCriacao {
  /** o rascunho que está sendo criado ou editado */
  fs: () => FichaSalva | null;
  gm: boolean;
  nova: boolean;
  /** as perícias da criação pintadas dentro do elemento */
  pericias: (alvo: HTMLElement) => void;
  /** abre uma escolha no rascunho */
  escolha: (e: Escolher | null) => void;
  /** a janela de um item da mochila (apelido, mão, modificações) */
  item: (i: number) => void;
  requisicao: () => void;
  tema: () => void;
  /** a FICHAS de trás redesenha */
  render: () => void;
  salvar: () => void;
  cancelar: () => void;
  /** a janela fechou (salvando, cancelando ou indo editar na ficha) */
  fechou: () => void;
}

export interface Assistente {
  /** algo mudou no rascunho: redesenha o passo e os números */
  atualizar: () => void;
  fechar: () => void;
}

export function abrirCriacao(ctx: ContextoCriacao): Assistente {
  let passo: Passo = ctx.nova ? 'comeco' : 'revisao';
  let busca = '';
  let ate: Nex = 5;
  let saindo = false;
  const j = janela(ctx.nova ? 'Novo agente' : 'Editar agente', 'ficha', () => {
    ctx.fechou();
    if (!saindo) ctx.cancelar();
  }, 150);
  j.el.classList.add('cr-janela');
  const lado = h('nav', { class: 'cr-passos', 'aria-label': 'Passos' });
  const conteudo = h('div', { class: 'cr-conteudo' });
  const numeros = h('aside', { class: 'cr-numeros', 'aria-live': 'polite' });
  j.corpo.append(h('div', { class: 'cr' }, lado, conteudo, numeros));
  const voltar = h('button', { class: 'fx-bt', type: 'button', onclick: () => ir(-1) }, ic('esquerda'), h('span', null, 'Voltar'));
  const proximo = h('button', { class: 'fx-bt', type: 'button', onclick: () => ir(1) }, h('span', null, 'Próximo'), ic('direita'));
  const salvar = h('button', { class: 'fx-bt forte', type: 'button', onclick: () => ((saindo = true), ctx.salvar(), j.fechar()) }, ic('salvar'), h('span', null, 'Salvar ficha'));
  const naFicha = h('button', { class: 'fx-bt', type: 'button', title: 'Fecha os passos e continua editando direto na ficha', onclick: () => ((saindo = true), j.fechar()) }, ic('lapis'), h('span', null, 'Editar na ficha'));
  j.rodape.append(voltar, h('span', { class: 'fj-esp' }), naFicha, proximo, salvar);
  // qualquer clique dentro pode ter mudado o rascunho: os números acompanham
  j.el.addEventListener('click', () => queueMicrotask(pintarLados));

  const ir = (d: 1 | -1) => {
    const i = PASSOS.findIndex((p) => p.id === passo) + d;
    if (i < 0 || i >= PASSOS.length) return;
    passo = PASSOS[i].id;
    sfx.click();
    pintar();
  };

  /** O que falta em cada passo (as pendências e os problemas do motor). */
  const faltas = (f: Ficha, c: regras.Calculado): Record<Passo, number> => {
    const out = Object.fromEntries(PASSOS.map((p) => [p.id, 0])) as Record<Passo, number>;
    for (const p of c.pendencias) {
      const alvo: Passo = p.tipo === 'atributos' ? 'atributos' : p.tipo === 'origem' ? 'origem' : p.tipo === 'classe' ? 'classe' : p.tipo === 'pericias' ? 'pericias' : 'evolucao';
      out[alvo]++;
    }
    for (const p of c.problemas) if (p.severidade === 'erro') out[p.onde === 'Mochila' ? 'mochila' : 'revisao']++;
    if (!f.nome.trim() || f.nome === 'Novo agente') out.comeco++;
    return out;
  };

  const pintarLados = () => {
    const fs = ctx.fs();
    if (!fs) return;
    const f = fs.ficha;
    const c = regras.calcular(f);
    const fal = faltas(f, c);
    lado.replaceChildren(
      ...PASSOS.map((p, i) =>
        h(
          'button',
          { class: `cr-passo${p.id === passo ? ' on' : ''}${fal[p.id] ? ' falta' : ' pronto'}`, type: 'button', 'aria-current': p.id === passo ? 'step' : undefined, onclick: () => ((passo = p.id), sfx.click(), pintar()) },
          h('span', { class: 'cr-n' }, String(i + 1)),
          h('span', { class: 'cr-nome' }, p.nome),
          fal[p.id] ? h('span', { class: 'cr-falta', title: `${fal[p.id]} pendente(s)` }, String(fal[p.id])) : ic('ok'),
        ),
      ),
    );
    const linha = (rot: string, val: string | number) => h('div', { class: 'cr-num' }, h('span', null, rot), h('b', null, String(val)));
    numeros.replaceChildren(
      h('h4', null, f.nome || 'Sem nome'),
      h('p', { class: 'cr-sub' }, [f.classe ? regras.catalogo.classe(f.classe).nome : 'Pessoa comum', f.origem ? regras.catalogo.origem(f.origem)?.nome : null, `NEX ${f.nex}%`].filter(Boolean).join(' · ')),
      linha('PV', c.pv),
      linha('PE', c.pe),
      linha('SAN', c.san),
      linha('Defesa', c.defesa),
      linha('Limite de PE', `${c.limitePe}/turno`),
      linha('Carga', `${String(c.carga.usados).replace('.', ',')} / ${c.carga.espacos}`),
      linha('Patente', c.patente?.nome ?? '—'),
      c.pendencias.length ? h('p', { class: 'cr-aviso' }, ic('alerta'), `${c.pendencias.length} escolha(s) pendente(s)`) : h('p', { class: 'cr-ok' }, ic('ok'), 'Nada pendente'),
    );
    proximo.classList.toggle('hidden', passo === 'revisao');
    voltar.disabled = passo === 'comeco';
  };

  /** Um cartão de opção do motor (origem, classe): o nome, o resumo, a página e o motivo da trava. */
  const cartao = (o: regras.Opcao, on: boolean, escolher: () => void) =>
    h(
      'button',
      { class: `cr-carta${on ? ' on' : ''}${o.ok ? '' : ' travada'}`, type: 'button', 'aria-pressed': String(on), disabled: !o.ok && !on, onclick: () => (sfx.click(), escolher()) },
      h('b', null, o.nome),
      o.ref ? h('small', null, textoRef(o.ref)) : null,
      o.resumo ? h('span', { class: 'cr-resumo' }, o.resumo) : null,
      o.requisitos?.length ? h('span', { class: 'cr-req' }, o.requisitos.join(' · ')) : null,
      o.motivos.length ? h('span', { class: 'cr-motivo' }, ic('cadeado'), o.motivos[0]) : null,
    );

  const nexBase = (f: Ficha): Nex => (f.comecouMundano ? 0 : 5);
  const aplicarCampo = (f: Ficha, nex: Nex, campo: Parameters<typeof escolherCampo>[2], id: string) => {
    const e = escolherCampo(f, nex, campo);
    if (!e) return;
    e.aplicar([id]);
    // o poder escolhido pode pedir um parâmetro (o elemento, a perícia): abre em seguida
    const prox = e.depois?.();
    if (prox) ctx.escolha(prox);
    ctx.render();
    pintar();
  };

  const pintar = () => {
    const fs = ctx.fs();
    if (!fs) return j.fechar();
    const f = fs.ficha;
    const c = regras.calcular(f);
    const tit = PASSOS.find((p) => p.id === passo)!;
    const corpo: (Node | null)[] = [h('h3', { class: 'cr-tit' }, ic(tit.icone), tit.nome), h('p', { class: 'cr-guia' }, ic('dica'), GUIA[passo])];
    const campo = (rot: string, el: HTMLElement, dica?: string) => h('label', { class: 'fj-campo' }, h('span', null, rot), el, dica ? h('small', { class: 'cr-dica' }, dica) : null);
    switch (passo) {
      case 'comeco': {
        const nome = h('input', { class: 'fx-inp', value: f.nome === 'Novo agente' ? '' : f.nome, maxlength: 60, placeholder: 'Nome do agente' }) as HTMLInputElement;
        nome.addEventListener('input', () => ((f.nome = fs.nome = nome.value.trim() || 'Novo agente'), pintarLados()));
        const jogador = h('input', { class: 'fx-inp', value: f.jogador ?? '', maxlength: 60, placeholder: 'Quem joga' }) as HTMLInputElement;
        jogador.addEventListener('input', () => (f.jogador = jogador.value.trim() || undefined));
        corpo.push(h('div', { class: 'cr-dupla' }, campo('Nome', nome), campo('Jogador', jogador)));
        if (ctx.nova) {
          const tipo = (mundano: boolean, titulo: string, texto: string) =>
            h(
              'button',
              {
                class: `cr-carta${f.comecouMundano === mundano ? ' on' : ''}`,
                type: 'button',
                onclick: () => {
                  if (f.comecouMundano === mundano) return;
                  const novo = regras.novaFicha(f.nome, { comecouMundano: mundano, regras: f.regras });
                  Object.assign(f, novo);
                  ctx.render();
                  pintar();
                },
              },
              h('b', null, titulo),
              h('span', { class: 'cr-resumo' }, texto),
            );
          corpo.push(h('h4', { class: 'fj-sub' }, 'Começa como'), h('div', { class: 'cr-cartas dois' }, tipo(false, 'Agente (NEX 5%)', 'Já entra na Ordem: atributos com 4 pontos, origem, classe e perícias.'), tipo(true, 'Pessoa comum (NEX 0%)', 'Regra opcional (LR p. 171): 3 pontos e origem; a classe vem no NEX 5%.')));
        }
        if (ctx.gm) {
          const nex = h('select', { class: 'fx-inp' }, ...regras.NEX_LISTA.filter((n) => n > 0 || f.comecouMundano).map((n) => h('option', { value: String(n), selected: n === f.nex }, `NEX ${n}%`))) as HTMLSelectElement;
          nex.addEventListener('change', () => ((f.nex = Number(nex.value) as Nex), (ate = f.nex), ctx.render(), pintar()));
          const pp = h('input', { class: 'fx-inp', type: 'number', min: 0, max: 9999, value: String(f.pp) }) as HTMLInputElement;
          pp.addEventListener('input', () => ((f.pp = Math.max(0, Math.min(9999, Math.round(Number(pp.value) || 0)))), ctx.render(), pintarLados()));
          const sah = h('input', { type: 'checkbox', checked: !!f.regras.sah }) as HTMLInputElement;
          sah.addEventListener('change', () => ((f.regras = { ...f.regras, sah: sah.checked }), ctx.render(), pintar()));
          corpo.push(
            h('div', { class: 'cr-dupla' }, campo('NEX', nex, 'Subir abre as escolhas de cada patamar no passo Evolução.'), campo('Pontos de prestígio', pp, `Patente: ${c.patente?.nome ?? '—'}`)),
            h('label', { class: 'fj-check' }, sah, 'Usar o Sobrevivendo ao Horror (origens, poderes e itens a mais)'),
          );
        }
        break;
      }
      case 'atributos': {
        const { gastos, total } = pontosAtributo(f);
        corpo.push(h('p', { class: 'cr-contador' }, `Pontos: ${gastos} de ${total}`, h('small', null, ' · todos começam em 1; um pode ir a 0 para ganhar 1 ponto; máximo 3 na criação')));
        for (const a of ATRIB) {
          const v = f.atributos[a.id];
          const mudar = (d: 1 | -1) => {
            if (!podeMudarAtributo(f, a.id, d)) return sfx.denied();
            f.atributos[a.id] += d;
            sfx.click();
            ctx.render();
            pintar();
          };
          corpo.push(
            h(
              'div',
              { class: 'cr-atr' },
              h('b', null, a.nome),
              h('button', { class: 'cr-mm', type: 'button', 'aria-label': `Baixar ${a.nome}`, disabled: !podeMudarAtributo(f, a.id, -1), onclick: () => mudar(-1) }, ic('menos')),
              h('span', { class: 'cr-v' }, String(v)),
              h('button', { class: 'cr-mm', type: 'button', 'aria-label': `Subir ${a.nome}`, disabled: !podeMudarAtributo(f, a.id, 1), onclick: () => mudar(1) }, ic('mais')),
              h('span', { class: 'cr-muda' }, a.muda, v === 0 ? ' Com 0, rola dois d20 e fica com o pior.' : ''),
            ),
          );
        }
        break;
      }
      case 'origem': {
        const q = h('input', { class: 'fx-inp fj-busca', type: 'search', value: busca, placeholder: 'Procurar pelo nome ou pela perícia…' }) as HTMLInputElement;
        const grade = h('div', { class: 'cr-cartas' });
        const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        const desenhar = () => {
          const ops = regras.opcoesOrigem(f).filter((o) => !busca || plano(`${o.nome} ${o.resumo ?? ''} ${(o.requisitos ?? []).join(' ')}`).includes(plano(busca)));
          grade.replaceChildren(...ops.map((o) => cartao(o, f.origem === o.id, () => aplicarCampo(f, nexBase(f), 'origem', o.id))));
        };
        q.addEventListener('input', () => ((busca = q.value), desenhar()));
        desenhar();
        corpo.push(q, grade);
        break;
      }
      case 'classe': {
        if (f.comecouMundano && f.nex < 5) {
          corpo.push(h('p', { class: 'cr-texto' }, 'A pessoa comum escolhe a classe ao chegar em NEX 5% (o treinamento na Ordem). Suba o NEX no Começo para escolher.'));
          break;
        }
        corpo.push(h('div', { class: 'cr-cartas tres' }, ...regras.opcoesClasse().map((o) => cartao(o, f.classe === o.id, () => aplicarCampo(f, 5, 'classe', o.id)))));
        break;
      }
      case 'pericias': {
        const alvo = h('div', { class: 'cr-pericias' });
        ctx.pericias(alvo);
        corpo.push(alvo);
        break;
      }
      case 'evolucao': {
        if (ctx.gm) {
          const sel = h('select', { class: 'fx-inp cr-ate' }, ...regras.NEX_LISTA.filter((n) => n > 0 || f.comecouMundano).map((n) => h('option', { value: String(n), selected: n === f.nex }, `NEX ${n}%`))) as HTMLSelectElement;
          sel.addEventListener('change', () => ((f.nex = Number(sel.value) as Nex), ctx.render(), pintar()));
          corpo.push(h('div', { class: 'cr-linha' }, h('span', null, 'O agente está em'), sel, h('small', { class: 'cr-dica' }, 'Cada patamar até lá mostra o que ganhou e o que falta escolher.')));
        }
        for (const n of regras.NEX_LISTA.filter((x) => x <= f.nex && (x > 0 || f.comecouMundano))) {
          const itens: Node[] = [];
          for (const g of regras.ganhosDoNex(f.classe, n, f.comecouMundano)) itens.push(h('span', { class: 'cr-ganho' }, NOME_GANHO[g.tipo]));
          for (const p of c.pendencias.filter((x) => x.nex === n)) {
            const e = escolherPendencia(f, p);
            const leva: Passo | null = p.tipo === 'atributos' ? 'atributos' : p.tipo === 'origem' ? 'origem' : p.tipo === 'classe' ? 'classe' : p.tipo === 'pericias' ? 'pericias' : null;
            itens.push(
              h(
                'div',
                { class: 'cr-pend' },
                ic('alerta'),
                h('span', null, p.texto),
                e
                  ? h('button', { class: 'fx-bt mini forte', type: 'button', onclick: () => ctx.escolha(e) }, 'Escolher')
                  : leva
                    ? h('button', { class: 'fx-bt mini', type: 'button', onclick: () => ((passo = leva), pintar()) }, 'Ir ao passo')
                    : null,
              ),
            );
          }
          for (const p of c.problemas.filter((x) => x.nex === n)) itens.push(h('div', { class: `cr-prob ${p.severidade}` }, ic(p.severidade === 'erro' ? 'fechar' : 'alerta'), h('span', null, `${p.onde}: ${p.texto}`)));
          const pend = c.pendencias.some((x) => x.nex === n);
          corpo.push(h('section', { class: `cr-nex${pend ? ' falta' : ''}` }, h('h4', null, `NEX ${n}%`, pend ? null : ic('ok')), ...itens));
        }
        break;
      }
      case 'mochila': {
        const lim = c.itens.filter((l) => l.limite > 0).map((l) => `${'I'.repeat(l.categoria === 4 ? 0 : l.categoria) || 'IV'}: ${l.usados}/${l.limite}`);
        corpo.push(
          h('p', { class: 'cr-contador' }, `Carga ${String(c.carga.usados).replace('.', ',')} de ${c.carga.espacos} espaços`, lim.length ? h('small', null, ` · categorias ${lim.join(' · ')}`) : null),
          h('div', { class: 'cr-linha' }, h('button', { class: 'fx-bt forte', type: 'button', onclick: () => ctx.requisicao() }, ic('mais'), h('span', null, 'Requisitar equipamento'))),
          h(
            'div',
            { class: 'cr-itens' },
            ...(f.inventario.length
              ? f.inventario.map((it, i) => h('button', { class: 'cr-item', type: 'button', title: 'Abrir o item (apelido, mão, modificações)', onclick: () => ctx.item(i) }, h('b', null, regras.nomeDoItem(it)), it.qtd && it.qtd > 1 ? h('small', null, ` ×${it.qtd}`) : null, h('span', null, `categoria ${regras.categoriaDoItem(it)}`)))
              : [h('p', { class: 'cr-texto' }, 'A mochila está vazia.')]),
          ),
        );
        for (const p of c.problemas.filter((x) => x.onde === 'Mochila')) corpo.push(h('div', { class: `cr-prob ${p.severidade}` }, ic(p.severidade === 'erro' ? 'fechar' : 'alerta'), h('span', null, p.texto)));
        break;
      }
      case 'final': {
        const textos: { k: keyof NonNullable<Ficha['textos']>; nome: string; area?: boolean }[] = [
          { k: 'idade', nome: 'Idade' },
          { k: 'aparencia', nome: 'Aparência', area: true },
          { k: 'personalidade', nome: 'Personalidade', area: true },
          { k: 'historico', nome: 'Histórico', area: true },
          { k: 'objetivo', nome: 'Objetivo', area: true },
        ];
        for (const t of textos) {
          const el = h(t.area ? 'textarea' : 'input', { class: 'fx-inp', maxlength: t.area ? 2000 : 30, rows: 2 }) as HTMLInputElement;
          el.value = f.textos?.[t.k] ?? '';
          el.addEventListener('input', () => ((f.textos ??= {}), (f.textos[t.k] = el.value || undefined)));
          corpo.push(campo(t.nome, el));
        }
        corpo.push(h('div', { class: 'cr-linha' }, h('span', null, `Tema da interface: ${NOME_TEMA[fs.tema ?? 'ordem']}`), h('button', { class: 'fx-bt mini', type: 'button', onclick: () => ctx.tema() }, 'Trocar')));
        break;
      }
      case 'revisao': {
        const erros = c.problemas.filter((p) => p.severidade === 'erro');
        const fal = faltas(f, c);
        corpo.push(
          h('p', { class: `cr-estado${c.pendencias.length || erros.length ? ' falta' : ' ok'}` }, ic(c.pendencias.length || erros.length ? 'alerta' : 'ok'), c.pendencias.length || erros.length ? `Faltam ${c.pendencias.length + erros.length} coisa(s). Dá para salvar assim: o que falta fica como pendência na ficha.` : 'Tudo escolhido. Pode salvar.'),
          // os passos em cartões grandes: o que foi escolhido em cada um, e o aviso de quem tem pendência (toque leva ao passo)
          h(
            'div',
            { class: 'cr-revs' },
            ...PASSOS.filter((p) => p.id !== 'revisao').map((p) =>
              h(
                'button',
                { class: `cr-rev-card${fal[p.id] ? ' falta' : ''}`, type: 'button', title: `Ir ao passo ${p.nome}`, onclick: () => ((passo = p.id), sfx.click(), pintar()) },
                h('span', { class: 'cr-rev-ic' }, ic(p.icone)),
                h('span', { class: 'cr-rev-txt' }, h('b', null, p.nome), h('span', null, resumoPasso(p.id, fs, c))),
                fal[p.id] ? h('span', { class: 'cr-falta' }, `${fal[p.id]} pendente(s)`) : h('span', { class: 'cr-rev-ok' }, ic('ok')),
              ),
            ),
          ),
          ...erros.map((p) => h('div', { class: 'cr-prob erro' }, ic('fechar'), h('span', null, `${p.onde}: ${p.texto}`))),
        );
        break;
      }
    }
    conteudo.replaceChildren(...corpo.filter((x): x is Node => !!x));
    pintarLados();
  };

  pintar();
  return {
    atualizar: () => {
      // o campo de texto em foco não perde o que está sendo digitado
      if (conteudo.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement!.tagName)) return pintarLados();
      pintar();
    },
    fechar: () => ((saindo = true), j.fechar()),
  };
}

const NOME_GANHO: Record<regras.Ganho['tipo'], string> = {
  pessoaComum: 'Pessoa comum',
  treinamento: 'Treinamento na Ordem',
  criacao: 'Criação do agente',
  trilha: 'Trilha',
  habilidadeTrilha: 'Habilidade de trilha',
  poder: 'Poder de classe',
  atributo: '+1 atributo',
  grau: 'Grau de treinamento',
  versatilidade: 'Versatilidade',
  afinidade: 'Afinidade',
  ritual: 'Ritual',
};

/** Uma linha do que já foi escolhido em cada passo (a revisão). */
function resumoPasso(p: Passo, fs: FichaSalva, c: regras.Calculado): string {
  const f = fs.ficha;
  const cat = regras.catalogo;
  switch (p) {
    case 'comeco':
      return `${f.nome}${f.jogador ? ` (${f.jogador})` : ''} · NEX ${f.nex}% · ${c.patente?.nome ?? '—'}`;
    case 'atributos':
      return regras.ATRIBUTOS.map((k) => `${k.toUpperCase()} ${c.atributos[k]}`).join(' · ');
    case 'origem':
      return f.origem ? (cat.origem(f.origem)?.nome ?? f.origem) : 'falta escolher';
    case 'classe':
      return f.classe ? `${cat.classe(f.classe).nome}${f.trilha ? ` · ${cat.trilha(f.trilha)?.nome ?? f.trilha}` : ''}` : 'falta escolher';
    case 'pericias':
      return `${Object.values(c.pericias).filter((x) => x.grau !== 'destreinado').length} treinadas`;
    case 'evolucao':
      return c.pendencias.length ? `${c.pendencias.length} pendente(s)` : 'completa';
    case 'mochila':
      return `${f.inventario.length} itens · ${String(c.carga.usados).replace('.', ',')} de ${c.carga.espacos} espaços`;
    case 'final':
      return [f.textos?.idade && `${f.textos.idade} anos`, NOME_TEMA[fs.tema ?? 'ordem']].filter(Boolean).join(' · ');
    default:
      return '';
  }
}
