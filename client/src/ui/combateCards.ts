/**
 * A tela de COMBATE em cards (21/10, pedido do Felipe): a batalha é nas miniaturas, então a aba deixa o mapa de lado e
 * vira cards. À esquerda o cardzão de QUEM AGE; no meio o menu da vez (e a lista de alvos); à direita o cardzão do ALVO,
 * com o que importa para a defesa. Este arquivo só monta os pedaços (sem falar com o servidor): o `combate.ts` junta os
 * números e entrega aqui. O visual é o do jogo (cb-foto, cb-rec, cb-caixa, cb-barra, cb-cond; ver combateCards.css).
 */
import { h } from './dom';
import { ic, type NomeIcone } from './icons';

export type LadoCard = 'agente' | 'inimigo' | 'neutro';

export interface LinhaAtaque {
  nome: string;
  /** "Luta 2d20+5" */
  teste: string;
  dano: string;
  /** crítico, alcance e notas */
  resto: string;
  /** na mochila: aparece apagado */
  naMao: boolean;
  /** abre a abinha "O que é isso?" */
  info?: () => void;
}

export interface LinhaPoder {
  nome: string;
  /** custo em PE (null = sem custo) */
  pe: number | null;
  resumo?: string;
  /** o que mais vai na etiqueta ("DT 15", "3º círculo") */
  etiqueta?: string;
  info?: () => void;
}

/** Tudo o que um cardzão mostra (o de quem age e o do alvo usam o mesmo, com partes a mais ou a menos). */
export interface PerfilCombate {
  papel: 'ator' | 'alvo';
  nome: string;
  sub: string;
  lado: LadoCard;
  ladoNome: string;
  foto: HTMLElement;
  /** etiquetas pequenas ao lado do nome: "em Fazenda · Casarão", "fora do combate" */
  etiquetas: { texto: string; cls?: string }[];
  /** PV, PE e SAN prontos (com o data-vid que acerta os números no lugar) */
  barras?: HTMLElement | null;
  /** o PV do alvo, com a marca de machucado, e o dano não letal logo abaixo */
  pv?: HTMLElement | null;
  naoLetal?: HTMLElement | null;
  /** os números grandes: Defesa, deslocamento, esquiva, bloqueio */
  caixas: HTMLElement[];
  /** "10 base + Agi 3 + proteção 2" e o que mexe nela até o próximo turno */
  defesaConta?: string;
  defesaAjustes?: string[];
  /** Fortitude, Reflexos e Vontade */
  resistencias?: { rotulo: string; valor: string }[];
  /** RD, imunidades, vulnerabilidades, presença... */
  linhas?: { rotulo: string; valor: string; cls?: string }[];
  condicoes?: HTMLElement | null;
  /** as ações do turno e o limite de PE (só de quem age) */
  turno?: HTMLElement | null;
  ataques?: LinhaAtaque[];
  poderes?: LinhaPoder[];
  rituais?: LinhaPoder[];
  /** quantos poderes passivos ficaram de fora da lista */
  passivos?: number;
  notas?: string[];
  avisos?: HTMLElement[];
  /** desenha o cardzão de novo (a paginação das listas) */
  refazer?: () => void;
}

const paginasDe = new Map<string, number>();

/**
 * Sem rolagem (21/10, o Felipe): quando há mais itens do que cabem, mostra uma página por vez, com ‹ n/N ›.
 * Devolve os itens da página e, se houver mais de uma, a barrinha da paginação; `refazer` desenha a tela de novo.
 */
export function paginar(chave: string, itens: HTMLElement[], porPagina: number, refazer: () => void): { itens: HTMLElement[]; pager: HTMLElement | null } {
  const n = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(paginasDe.get(chave) ?? 0, n - 1);
  const ir = (i: number) => () => (paginasDe.set(chave, Math.max(0, Math.min(n - 1, i))), refazer());
  const pager =
    n > 1
      ? h(
          'div',
          { class: 'cc-pager' },
          h('button', { type: 'button', title: 'Página anterior', 'aria-label': 'Página anterior', disabled: atual === 0, onclick: ir(atual - 1) }, ic('esquerda')),
          h('span', null, `${atual + 1} de ${n}`),
          h('button', { type: 'button', title: 'Próxima página', 'aria-label': 'Próxima página', disabled: atual === n - 1, onclick: ir(atual + 1) }, ic('direita')),
        )
      : null;
  return { itens: itens.slice(atual * porPagina, (atual + 1) * porPagina), pager };
}

/** Quais seções o mestre abriu ou fechou (guardado entre as trocas da tela: o cardzão se refaz a cada turno). */
const abertas = new Map<string, boolean>();
let papelDaSecao = 'ator';

/** Uma seção que abre e fecha (PV, PE, SAN e Defesa ficam sempre à mostra; o resto é seção). */
const secao = (titulo: string, padrao: boolean, ...filhos: (Node | null | false)[]) => {
  const chave = `${papelDaSecao}:${titulo}`;
  const el = h('details', { class: 'cc-sec' }, h('summary', { class: 'cc-sec-tit' }, h('span', null, titulo), h('i', { 'aria-hidden': 'true' }, ic('direita'))), h('div', { class: 'cc-sec-corpo' }, ...filhos)) as HTMLDetailsElement;
  el.open = abertas.get(chave) ?? padrao;
  el.addEventListener('toggle', () => {
    abertas.set(chave, el.open);
    // uma seção aberta por vez: o cardzão não passa da altura (sem rolagem)
    if (el.open) for (const o of el.parentElement?.querySelectorAll<HTMLDetailsElement>('details.cc-sec[open]') ?? []) if (o !== el) o.open = false;
  });
  return el;
};

/** O botão redondo "i" que abre a abinha "O que é isso?" (não escolhe o cartão onde está). */
export function botaoInfo(fn: () => void, rotulo = 'O que é isso?'): HTMLElement {
  return h(
    'span',
    {
      class: 'cc-info',
      role: 'button',
      tabindex: '0',
      title: rotulo,
      'aria-label': rotulo,
      onclick: (e: Event) => (e.stopPropagation(), e.preventDefault(), fn()),
      onkeydown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.stopPropagation(), e.preventDefault(), fn()),
    },
    'i',
  );
}

export interface BlocoInfo {
  titulo: string;
  icone: NomeIcone;
  textos?: string[];
}
export interface VMInfo {
  titulo: string;
  meta: string;
  selo?: { texto: string; pe?: boolean };
  icone: HTMLElement;
  /** os números de uma olhada: custo, alcance, DT, dano... */
  campos?: [string, string][];
  blocos: BlocoInfo[];
}

/** A abinha "O que é isso?", no padrão do detalhe da tela do jogador (jg-det): nome, custo, números e o texto do livro. */
export function abinhaInfo(v: VMInfo, fechar: () => void): HTMLElement {
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && (document.removeEventListener('keydown', esc), fechar());
  document.addEventListener('keydown', esc);
  const fundo = h(
    'div',
    {
      class: 'cc-abinha-fundo',
      onclick: (e: Event) => e.target === fundo && (document.removeEventListener('keydown', esc), fechar()),
    },
    h(
      'article',
      { class: 'cc-abinha jg-det jg-det-poder', role: 'dialog', 'aria-label': v.titulo },
      h(
        'div',
        { class: 'jg-det-cab' },
        h('span', { class: 'cc-abinha-ic' }, v.icone),
        h('div', null, h('h3', null, v.titulo), h('p', { class: 'jg-det-meta' }, v.meta)),
        v.selo ? h('em', { class: `jg-selo grande${v.selo.pe ? ' pe' : ''}` }, v.selo.texto) : null,
        h('button', { class: 'cc-abinha-x', type: 'button', title: 'Fechar', 'aria-label': 'Fechar', onclick: () => (document.removeEventListener('keydown', esc), fechar()) }, ic('fechar')),
      ),
      v.campos?.length ? h('div', { class: 'cc-abinha-campos' }, ...v.campos.map(([r, x]) => h('span', { class: 'cc-abinha-campo' }, h('small', null, r), h('b', null, x)))) : null,
      h(
        'div',
        { class: 'jg-blocos' },
        ...v.blocos
          .filter((b) => b.textos?.length)
          .map((b) => h('div', { class: 'jg-bloco' }, h('h4', null, ic(b.icone), b.titulo), ...b.textos!.map((t) => h('p', null, t)))),
      ),
    ),
  );
  return fundo;
}

/** O cardzão: o retrato grande e o nome, as barras, a Defesa, as condições, o turno, os ataques e os poderes. */
export function cardPerfil(p: PerfilCombate): HTMLElement {
  papelDaSecao = p.papel;
  const refazer = p.refazer ?? (() => undefined);
  const partes: (Node | null | false | undefined)[] = [];
  partes.push(
    h(
      'div',
      { class: 'cc-id' },
      h('span', { class: 'cb-foto cc-foto' }, p.foto),
      h(
        'div',
        { class: 'cc-id-txt' },
        h('b', { class: 'cc-nome' }, p.nome),
        h('span', { class: 'cc-sub' }, p.sub),
        h('span', { class: 'cc-etqs' }, h('span', { class: `cc-etq lado-${p.lado}` }, p.ladoNome), ...p.etiquetas.map((e) => h('span', { class: `cc-etq ${e.cls ?? ''}` }, e.texto))),
      ),
    ),
  );
  // o alvo mostra o PV primeiro (é o que o ataque mexe); quem age, as três barras
  partes.push(...(p.papel === 'alvo' ? [p.pv, p.naoLetal, p.barras] : [p.barras, p.pv, p.naoLetal]));
  if (p.caixas.length) partes.push(h('div', { class: 'cc-caixas' }, ...p.caixas));
  if (p.defesaConta) partes.push(h('p', { class: 'cc-conta' }, p.defesaConta, ...(p.defesaAjustes ?? []).map((a) => h('em', null, ` · ${a}`))));
  // o que fica sempre à vista: PV, PE, SAN, Defesa e as condições. O resto são seções, uma aberta por vez
  const sCond = p.condicoes ? h('section', { class: 'cc-sec fixa' }, p.condicoes) : null;
  const sTurno = p.turno ? secao('Neste turno', true, p.turno) : null;
  const linhasDef = (p.linhas ?? []).map((l) => h('p', { class: `cc-linha ${l.cls ?? ''}` }, h('b', null, `${l.rotulo} `), l.valor));
  const sRes = p.resistencias?.length
    ? secao('Resistências', p.papel === 'alvo', h('div', { class: 'cc-testes' }, ...p.resistencias.map((r) => h('span', { class: 'cc-teste' }, h('small', null, r.rotulo), h('b', null, r.valor)))), ...linhasDef)
    : linhasDef.length
      ? secao('Defesas', p.papel === 'alvo', ...linhasDef)
      : null;
  const lista = (chave: string, itens: HTMLElement[]) => {
    const pg = paginar(chave, itens, 2, refazer);
    return [h('ul', { class: 'cc-lista' }, ...pg.itens), pg.pager];
  };
  const sAtq = p.ataques
    ? secao(
        'Ataques',
        false,
        ...(p.ataques.length
          ? lista(
              `${p.papel}:ataques`,
              p.ataques.map((a) => h('li', { class: `cc-atq${a.naMao ? '' : ' fora'}${a.info ? ' com-info' : ''}`, onclick: a.info }, h('b', null, a.nome), h('span', { class: 'cc-atq-teste' }, a.teste), h('small', null, `dano ${a.dano}${a.resto ? ` · ${a.resto}` : ''}`), a.info ? botaoInfo(a.info) : null)),
            )
          : [h('p', { class: 'cc-vazio-txt' }, 'Sem ataques na ficha.')]),
      )
    : null;
  let sPod: HTMLElement | null = null;
  if (p.poderes?.length || p.rituais?.length || p.passivos) {
    const li = (x: LinhaPoder) =>
      h('li', { class: `cc-pod${x.info ? ' com-info' : ''}`, onclick: x.info }, h('b', null, x.nome), x.pe !== null ? h('em', null, `${x.pe} PE`) : null, x.etiqueta ? h('i', null, x.etiqueta) : null, x.info ? botaoInfo(x.info) : null);
    const todos = [...(p.poderes ?? []), ...(p.rituais ?? [])].map(li);
    sPod = secao(
      'Poderes e rituais (gastam PE)',
      false,
      ...(todos.length ? lista(`${p.papel}:poderes`, todos) : []),
      p.passivos ? h('p', { class: 'cc-vazio-txt' }, `${p.passivos} poder${p.passivos > 1 ? 'es' : ''} sempre ativo${p.passivos > 1 ? 's' : ''} (na ficha).`) : null,
    );
  }
  // quem age: o turno e as armas primeiro; o alvo: o que protege primeiro
  partes.push(sCond, ...(p.papel === 'ator' ? [sTurno, sAtq, sPod, sRes] : [sRes, sAtq, sPod, sTurno]));
  for (const n of p.notas ?? []) partes.push(h('p', { class: 'cc-nota' }, n));
  for (const a of p.avisos ?? []) partes.push(a);
  return h('div', { class: `cc-perfil cc-${p.papel}` }, ...partes);
}

/** Quando ninguém age (ou não há alvo): o convite no lugar do cardzão. */
export function cardConvite(titulo: string, texto: string, icone: 'mira' | 'pessoa' = 'mira'): HTMLElement {
  return h('div', { class: 'cc-convite' }, h('span', { class: 'cc-convite-ic' }, ic(icone)), h('b', null, titulo), h('small', null, texto));
}

export interface CartaoAlvo {
  id: number;
  nome: string;
  lado: LadoCard;
  foto: HTMLElement;
  /** "22/30" */
  pv: string;
  pvPct: number;
  defesa: string;
  estado: string | null;
  escolhido: boolean;
  /** na área do ritual: caixa de marcar em vez de escolher um só */
  caixa: boolean;
  aoClicar: () => void;
  /** o mouse entra ou sai (o cardzão da direita mostra quem está em cima) */
  aoPassar?: (dentro: boolean) => void;
}

/** Um cartão da lista "Contra quem?": o retrato, o nome, o PV e a Defesa (baixinho e comprido, como as cartas da ordem). */
export function cartaoDeAlvo(a: CartaoAlvo): HTMLElement {
  return h(
    'button',
    {
      class: `cc-alvo-card lado-${a.lado}${a.escolhido ? ' on' : ''}`,
      type: 'button',
      'data-vid': String(a.id),
      'aria-pressed': String(a.escolhido),
      title: a.caixa ? (a.escolhido ? `${a.nome} está na área: tocar tira` : `Pôr ${a.nome} na área`) : a.escolhido ? `${a.nome} é o alvo` : `Escolher ${a.nome} como alvo`,
      onclick: a.aoClicar,
      onmouseenter: () => a.aoPassar?.(true),
      onmouseleave: () => a.aoPassar?.(false),
      onfocus: () => a.aoPassar?.(true),
      onblur: () => a.aoPassar?.(false),
    },
    a.caixa ? h('span', { class: `cc-alvo-marca${a.escolhido ? ' on' : ''}`, 'aria-hidden': 'true' }, a.escolhido ? '✓' : '') : null,
    h('span', { class: 'cc-mira', 'aria-hidden': 'true' }),
    h('span', { class: 'cb-foto cc-alvo-foto' }, a.foto),
    h(
      'span',
      { class: 'cc-alvo-txt' },
      h('b', null, a.nome),
      h('span', { class: 'cc-alvo-nums' }, h('span', { class: 'cc-alvo-pv' }, `PV ${a.pv}`), h('span', null, `Def ${a.defesa}`)),
      h('span', { class: 'cc-alvo-barra', style: `--p:${a.pvPct}` }, h('i')),
      a.estado ? h('span', { class: 'cc-alvo-estado' }, a.estado) : null,
    ),
    a.escolhido && !a.caixa ? h('span', { class: 'cc-alvo-selo' }, 'ALVO') : null,
  );
}
