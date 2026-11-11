/**
 * A requisição de equipamento: a janela grande de escolher os itens da ficha (o "Adicionar Item"
 * da FICHAS e o "+" da aba ITENS). As seções ficam do lado (armas, munição, proteções...), os
 * cartões com a arte pintada no meio e o item escolhido do outro lado, com o que acontece se ele
 * entrar na mochila: o limite da patente, a carga, a proficiência e a munição (as contas em
 * regras.opcoesDeItens). Em cima, as vagas da patente e a carga, que andam a cada item.
 *
 * A janela fica aberta: dá para pedir vários itens de uma vez. O mestre passa por cima dos limites
 * (com o aviso); o jogador, não. No celular, ela ocupa a tela e o item escolhido sobe de baixo.
 */
import { regras, type Tema } from '@crona/shared';
import { arteDoItem } from './arteItem';
import { h } from './dom';
import { janela } from './fichaModal';
import { infoItem, romano, textoRef } from './fichaRegras';
import { arteOu, ic } from './icons';
import { sfx } from './sfx';
import { vestirTema } from './temaUi';

const cat = regras.catalogo;

export interface Requisicao {
  /** a ficha que recebe os itens (o rascunho na FICHAS; uma cópia na aba ITENS) */
  ficha: regras.Ficha;
  nome: string;
  /** o tema do agente: veste a janela */
  tema?: Tema;
  /** o mestre passa por cima dos limites, com o aviso */
  mestre: boolean;
  /** cada item que entrou (já está em ficha.inventario) */
  aoAdicionar: (it: regras.ItemFicha) => void;
  aoFechar: () => void;
}

type Secao = regras.SecaoItem | 'todas';
type Ordem = 'categoria' | 'nome' | 'espacos';

const ICONE_SECAO: Record<Secao, string> = {
  todas: 'mochila',
  corpoACorpo: 'faca',
  disparo: 'mira',
  fogo: 'pistola',
  municao: 'municao',
  protecao: 'colete',
  explosivo: 'explosivo',
  acessorio: 'maleta',
  operacional: 'radio',
  medicamento: 'kitMedico',
  paranormal: 'olho',
  amaldicoado: 'caveiraItem',
  outro: 'caixa',
};
/** O ícone pintado de cada seção: o da categoria (kit do Códex, Parte 4) e, enquanto não chega, a arte de um item da seção. */
const PINTADO_SECAO: Record<Secao, string[]> = {
  todas: ['/arte/icones/titulo-inventario.png'],
  corpoACorpo: ['/arte/icones/cat-corpo-a-corpo.png', '/arte/itens/pintados/katana.png'],
  disparo: ['/arte/icones/cat-disparo.png', '/arte/itens/pintados/arco.png'],
  fogo: ['/arte/icones/cat-fogo.png', '/arte/itens/pintados/revolver.png'],
  municao: ['/arte/icones/cat-municao.png', '/arte/itens/pintados/balas-curtas.png'],
  protecao: ['/arte/icones/cat-protecao.png', '/arte/itens/pintados/protecao-leve.png'],
  explosivo: ['/arte/icones/cat-explosivo.png', '/arte/itens/pintados/granada-de-fragmentacao.png'],
  acessorio: ['/arte/icones/cat-acessorio.png', '/arte/itens/pintados/kit-de-ladrao.png'],
  operacional: ['/arte/icones/cat-utensilio.png', '/arte/itens/pintados/lanterna-tatica.png'],
  medicamento: ['/arte/icones/cat-medicamento.png', '/arte/itens/pintados/kit-de-medicina.png'],
  paranormal: ['/arte/icones/cat-paranormal.png', '/arte/itens/pintados/vela.png'],
  amaldicoado: ['/arte/icones/cat-amaldicoado.png', '/arte/itens/pintados/cranio-espiral.png'],
  outro: ['/arte/icones/cat-vestimenta.png', '/arte/itens/pintados/mochila-militar.png'],
};
const ALCANCE: Record<string, string> = { curto: 'curto', medio: 'médio', longo: 'longo', extremo: 'extremo' };
const PROFICIENCIA: Record<string, string> = { simples: 'simples', tatica: 'tática', pesada: 'pesada' };
const MAOS: Record<string, string> = { leve: 'leve', umaMao: 'uma mão', duasMaos: 'duas mãos' };
const TIPO_DANO: Record<string, string> = { balistico: 'balístico', corte: 'corte', impacto: 'impacto', perfuracao: 'perfuração', fogo: 'fogo', quimico: 'químico', eletricidade: 'eletricidade', frio: 'frio', mental: 'mental' };

/** sem acento e em minúsculas, para a busca */
const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Os números do item que cabem numa linha do cartão. */
function numerosDoItem(o: regras.OpcaoItem): string {
  if (o.tipo === 'arma') {
    const a = cat.arma(o.id);
    if (!a) return '';
    return [a.dano, `${a.critico.margem < 20 ? a.critico.margem : 20}/×${a.critico.multiplicador}`, a.alcance ? ALCANCE[a.alcance] ?? a.alcance : 'corpo a corpo'].join(' · ');
  }
  if (o.tipo === 'protecao') {
    const p = cat.protecao(o.id);
    return p ? `Defesa +${p.defesa}${p.resistencia ? ` · RD ${p.resistencia.valor}` : ''}` : '';
  }
  return infoItem({ id: o.id, tipo: o.tipo }, null).efeito.replace(/^—$/, '');
}

/** As etiquetas do cartão: mãos, proficiência, munição, usos. */
function etiquetas(o: regras.OpcaoItem): { texto: string; tom?: 'aviso' | 'perigo' }[] {
  const out: { texto: string; tom?: 'aviso' | 'perigo' }[] = [];
  if (o.tipo === 'arma') {
    const a = cat.arma(o.id);
    if (a) {
      out.push({ texto: MAOS[a.empunhadura] ?? a.empunhadura });
      if (a.proficiencia !== 'simples') out.push({ texto: PROFICIENCIA[a.proficiencia] });
    }
  }
  if (o.municao) out.push({ texto: o.municao.nome.toLowerCase(), tom: o.municao.tem ? undefined : 'aviso' });
  const e = o.tipo === 'equipamento' ? cat.equipamento(o.id) : null;
  if (e?.usos) out.push({ texto: `${e.usos} usos` });
  if (o.ref.fonte === 'SaH') out.push({ texto: 'SaH' });
  return out;
}

/** Abre a requisição para a ficha. */
export function abrirRequisicao(r: Requisicao) {
  const f = r.ficha;
  let secao: Secao = 'todas';
  let ordem: Ordem = 'categoria';
  let soPosso = false;
  let filtroCat: number | null = null;
  let sel: regras.OpcaoItem | null = null;
  let pedidos = 0;
  let opcoes: regras.OpcaoItem[] = [];
  let calc = regras.calcular(f);

  const j = janela('Requisição de equipamento', 'mochila', () => r.aoFechar(), 150);
  const caixa = j.el.querySelector('.fj') as HTMLElement;
  caixa.classList.add('rq');
  vestirTema(j.el, r.tema);

  // ---------- em cima: quem pede, as vagas da patente e a carga
  const topo = h('div', { class: 'rq-topo' });
  // ---------- as seções
  const secoes = h('nav', { class: 'rq-secoes', 'aria-label': 'Seções' });
  // ---------- a lista: busca, filtros e os cartões
  const busca = h('input', { class: 'rq-busca-campo', type: 'search', placeholder: 'Buscar item ou efeito…', 'aria-label': 'Procurar item' }) as HTMLInputElement;
  const filtros = h('div', { class: 'rq-filtros' });
  const grade = h('div', { class: 'rq-grade', role: 'list' });
  const lista = h('section', { class: 'rq-lista' }, h('div', { class: 'rq-busca' }, ic('lupa'), busca), filtros, grade);
  // ---------- o item escolhido
  const det = h('aside', { class: 'rq-det' });
  const meio = h('div', { class: 'rq-meio' }, secoes, lista, det);
  j.corpo.classList.add('rq-corpo');
  j.corpo.append(topo, meio);
  const contador = h('span', { class: 'rq-pedidos' });
  j.rodape.append(contador, h('span', { class: 'fj-esp' }), h('button', { class: 'fx-bt forte', type: 'button', onclick: () => j.fechar() }, ic('ok'), h('span', null, 'Pronto')));

  const recalcular = () => {
    calc = regras.calcular(f);
    opcoes = regras.opcoesDeItens(f, calc).filter((o) => r.mestre || !(o.tipo === 'equipamento' && regras.FAIXAS_DE_CARGA.has(o.id)));
    if (sel) sel = opcoes.find((o) => o.tipo === sel!.tipo && o.id === sel!.id) ?? null;
  };

  const visiveis = () => {
    // cada palavra da busca em qualquer ordem ("militar mochila"); o item cujo NOME tem as palavras vem antes do que só
    // as cita na descrição (28/10: "mochila" mostrava antes o Equipamento de sobrevivência, "mochila com saco de dormir")
    const palavras = plano(busca.value.trim()).split(/\s+/).filter(Boolean);
    const noNome = new Set<regras.OpcaoItem>();
    const lista = opcoes.filter((o) => {
      if (secao !== 'todas' && o.secao !== secao) return false;
      if (soPosso && !o.ok) return false;
      if (filtroCat !== null && o.categoria !== filtroCat) return false;
      if (!palavras.length) return true;
      const nome = plano(o.nome);
      if (palavras.every((p) => nome.includes(p))) return noNome.add(o), true;
      const base = regras.baseDoItem({ id: o.id, tipo: o.tipo }) as { resumo?: string } | undefined;
      const tudo = plano(`${o.nome} ${base?.resumo ?? ''} ${numerosDoItem(o)}`);
      return palavras.every((p) => tudo.includes(p));
    });
    const porNome = (a: regras.OpcaoItem, b: regras.OpcaoItem) => a.nome.localeCompare(b.nome, 'pt-BR');
    const pela = ordem === 'nome' ? porNome : ordem === 'espacos' ? (a: regras.OpcaoItem, b: regras.OpcaoItem) => a.espacos - b.espacos || porNome(a, b) : (a: regras.OpcaoItem, b: regras.OpcaoItem) => a.categoria - b.categoria || porNome(a, b);
    lista.sort((a, b) => Number(noNome.has(b)) - Number(noNome.has(a)) || pela(a, b));
    return lista;
  };

  const desenharTopo = () => {
    const vagas = calc.itens.map((l) =>
      h(
        'span',
        { class: `rq-vaga c${l.categoria}${l.limite === 0 ? ' fechada' : l.usados >= l.limite ? ' cheia' : ''}${l.usados > l.limite ? ' passou' : ''}`, title: l.limite === 0 ? `Categoria ${romano(l.categoria)}: a patente não leva.` : `Categoria ${romano(l.categoria)}: ${l.usados} de ${l.limite}.` },
        h('b', null, romano(l.categoria)),
        l.limite === 0 ? ic('cadeado') : `${l.usados}/${l.limite}`,
      ),
    );
    const k = calc.carga;
    const pct = Math.min(100, (k.usados / Math.max(1, k.maximo)) * 100);
    const meta = Math.min(100, (k.espacos / Math.max(1, k.maximo)) * 100);
    const extra = sel && sel.espacos > 0 ? Math.min(100 - pct, (sel.espacos / Math.max(1, k.maximo)) * 100) : 0;
    topo.replaceChildren(
      h('div', { class: 'rq-quem' }, h('b', null, r.nome), h('span', null, calc.patente ? `${calc.patente.nome} · crédito ${calc.patente.credito}` : 'NEX 0 · um item de categoria I')),
      h('div', { class: 'rq-vagas', title: 'Itens por categoria que a patente deixa levar (a categoria 0 é à vontade).' }, h('span', { class: 'rq-vaga c0' }, h('b', null, '0'), '∞'), ...vagas),
      h(
        'div',
        { class: `rq-carga${k.sobrecarregado ? ' passou' : ''}`, title: `Carga: ${k.espacos} espaços (5 por ponto de Força); dá para levar até ${k.maximo}, sobrecarregado.` },
        ic('mochila'),
        h('span', { class: 'rq-carga-barra' }, h('i', { class: 'rq-carga-cheia', style: `width:${pct}%` }), extra ? h('i', { class: 'rq-carga-mais', style: `left:${pct}%;width:${extra}%` }) : null, h('i', { class: 'rq-carga-meta', style: `left:${meta}%` })),
        h('span', { class: 'rq-carga-n' }, `${String(k.usados).replace('.', ',')} / ${k.espacos}`),
      ),
    );
  };

  const desenharSecoes = () => {
    const conta = (s: Secao) => opcoes.filter((o) => s === 'todas' || o.secao === s).length;
    const itens: Secao[] = ['todas', ...regras.SECOES_ITEM.map((s) => s.id)];
    secoes.replaceChildren(
      ...itens
        .filter((s) => conta(s) > 0)
        .map((s) =>
          h(
            'button',
            { class: `rq-secao${secao === s ? ' on' : ''}`, type: 'button', 'aria-pressed': String(secao === s), onclick: () => (sfx.click(), (secao = s), desenhar()) },
            arteOu(PINTADO_SECAO[s], ic(ICONE_SECAO[s])),
            h('span', null, s === 'todas' ? 'Tudo' : regras.SECOES_ITEM.find((x) => x.id === s)!.nome),
            h('small', null, String(conta(s))),
          ),
        ),
    );
  };

  const desenharFiltros = () => {
    const chip = (rotulo: string, on: boolean, fn: () => void, cls = '') => h('button', { class: `rq-chip${on ? ' on' : ''} ${cls}`, type: 'button', 'aria-pressed': String(on), onclick: () => (sfx.click(), fn(), desenhar()) }, rotulo);
    filtros.replaceChildren(
      chip('Só o que dá para levar', soPosso, () => (soPosso = !soPosso), 'rq-chip-posso'),
      h('span', { class: 'rq-filtro-sep' }),
      ...[0, 1, 2, 3, 4].map((n) => chip(n === 0 ? '0' : romano(n), filtroCat === n, () => (filtroCat = filtroCat === n ? null : n), `rq-chip-cat c${n}`)),
      h('span', { class: 'rq-filtro-sep' }),
      h(
        'select',
        { class: 'rq-ordem', 'aria-label': 'Ordem', onchange: (e: Event) => ((ordem = (e.target as HTMLSelectElement).value as Ordem), desenhar()) },
        ...(
          [
            ['categoria', 'Por categoria'],
            ['nome', 'Por nome'],
            ['espacos', 'Por espaço'],
          ] as [Ordem, string][]
        ).map(([v, t]) => h('option', { value: v, selected: ordem === v }, t)),
      ),
    );
  };

  const cartao = (o: regras.OpcaoItem) => {
    const on = !!sel && sel.tipo === o.tipo && sel.id === o.id;
    const inf = infoItem({ id: o.id, tipo: o.tipo }, null);
    const el = h(
      'button',
      {
        class: `rq-card${o.ok ? '' : ' travado'}${on ? ' on' : ''}`,
        type: 'button',
        role: 'listitem',
        'data-chave': `${o.tipo}:${o.id}`,
        'aria-pressed': String(on),
        'aria-label': `${o.nome}, categoria ${o.categoria === 0 ? '0' : romano(o.categoria)}${o.ok ? '' : `, travado: ${o.motivos[0]}`}`,
        // escolher só troca o destaque (sem refazer a grade: o clique duplo cai no mesmo cartão e pede direto)
        onclick: (e: Event) => selecionar(o, e.currentTarget as HTMLElement),
        ondblclick: () => adicionar(o, 1),
      },
      h('span', { class: `rq-cat c${o.categoria}` }, o.categoria === 0 ? '0' : romano(o.categoria)),
      o.naMochila ? h('span', { class: 'rq-tem', title: `${o.naMochila} na mochila` }, `×${o.naMochila}`) : null,
      h('span', { class: 'rq-arte' }, arteDoItem({ id: o.id, tipo: o.tipo }, inf.icone)),
      h('span', { class: 'rq-nome' }, o.nome),
      h('span', { class: 'rq-num' }, numerosDoItem(o) || inf.tipo),
      h('span', { class: 'rq-tags' }, h('i', { class: 'rq-esp' }, `${String(o.espacos).replace('.', ',')} esp.`), ...etiquetas(o).map((t) => h('i', { class: t.tom ?? '' }, t.texto))),
      o.ok ? null : h('span', { class: 'rq-motivo' }, ic('cadeado'), o.motivos[0].replace(/ \(LR p\. \d+\)\.?$/, '')),
    );
    return el;
  };

  const desenharGrade = () => {
    const vis = visiveis();
    grade.replaceChildren(...(vis.length ? vis.map(cartao) : [h('p', { class: 'rq-nada' }, 'Nada com esses filtros.')]));
  };

  const desenharDetalhe = () => {
    if (!sel) {
      det.replaceChildren(h('div', { class: 'rq-det-vazio' }, ic('mochila'), h('p', null, 'Escolha um item para ver o que ele faz e o que acontece se ele entrar na mochila.')));
      return;
    }
    const o = sel;
    const inf = infoItem({ id: o.id, tipo: o.tipo }, null);
    const base = regras.baseDoItem({ id: o.id, tipo: o.tipo }) as { resumo?: string; especial?: string[] } | undefined;
    // o que acontece se entrar: a vaga da patente, a carga, e os avisos e motivos das regras
    const checks: { tom: 'ok' | 'aviso' | 'erro'; texto: string }[] = [];
    if (o.categoria >= 1) {
      const l = calc.itens.find((x) => x.categoria === o.categoria);
      if (l && l.limite > 0 && l.usados + 1 <= l.limite) checks.push({ tom: 'ok', texto: `Cabe na patente: categoria ${romano(o.categoria)}, ${l.usados + 1} de ${l.limite}.` });
    } else checks.push({ tom: 'ok', texto: 'Categoria 0: a patente não limita.' });
    const k = calc.carga;
    const depois = k.usados + o.espacos;
    if (depois <= k.espacos) checks.push({ tom: 'ok', texto: `Carga: ${String(depois).replace('.', ',')} de ${k.espacos} espaços.` });
    for (const m of o.motivos) checks.push({ tom: 'erro', texto: m });
    for (const a of o.avisos) checks.push({ tom: 'aviso', texto: a });
    const icTom = { ok: 'ok', aviso: 'alerta', erro: 'cadeado' } as const;
    const pode = o.ok || r.mestre;
    const acoes: Node[] = [];
    if (pode) {
      acoes.push(h('button', { class: `fx-bt ${o.ok ? 'forte' : 'perigo'} rq-pedir`, type: 'button', onclick: () => adicionar(o, 1) }, ic('mais'), h('span', null, o.ok ? 'Adicionar à mochila' : 'Adicionar mesmo assim')));
      const m = o.municao;
      if (m && !m.tem) {
        const om = opcoes.find((x) => x.tipo === 'equipamento' && x.id === m.id);
        if (om && (om.ok || r.mestre)) acoes.push(h('button', { class: 'fx-bt rq-pedir-mun', type: 'button', onclick: () => (adicionar(o, 1, false), adicionar(om, 1)) }, h('span', { class: 'rq-mun-arte' }, arteDoItem({ id: om.id, tipo: om.tipo }, 'municao')), h('span', null, `Com ${m.nome}`)));
      }
    } else acoes.push(h('p', { class: 'rq-travado' }, ic('cadeado'), 'Fora do que a sua patente pode pedir. Fale com o mestre.'));
    const linhaNum = (rot: string, val: string) => h('div', null, h('dt', null, rot), h('dd', null, val));
    const nums: Node[] = [linhaNum('Categoria', o.categoria === 0 ? '0' : romano(o.categoria)), linhaNum('Espaços', String(o.espacos).replace('.', ','))];
    if (o.tipo === 'arma') {
      const a = cat.arma(o.id);
      if (a) {
        nums.push(linhaNum('Dano', a.dano), linhaNum('Crítico', `${a.critico.margem < 20 ? a.critico.margem : 20}/×${a.critico.multiplicador}`), linhaNum('Alcance', a.alcance ? ALCANCE[a.alcance] ?? a.alcance : 'corpo a corpo'), linhaNum('Tipo', a.tipoDano.map((t) => TIPO_DANO[t] ?? t).join(', ')), linhaNum('Uso', `${PROFICIENCIA[a.proficiencia]}, ${MAOS[a.empunhadura]}`));
      }
    } else if (o.tipo === 'protecao') {
      const p = cat.protecao(o.id);
      if (p) nums.push(linhaNum('Defesa', `+${p.defesa}`), ...(p.resistencia ? [linhaNum('RD', String(p.resistencia.valor))] : []));
    }
    const partes: (Node | null)[] = [
      h('button', { class: 'rq-det-voltar', type: 'button', 'aria-label': 'Voltar para a lista', onclick: () => fecharDetalhe() }, h('i')),
      h('button', { class: 'rq-det-fechar', type: 'button', title: 'Fechar', 'aria-label': 'Fechar o item', onclick: () => fecharDetalhe() }, ic('fechar')),
      h('div', { class: 'rq-det-arte' }, h('span', { class: `rq-cat c${o.categoria}` }, o.categoria === 0 ? '0' : romano(o.categoria)), arteDoItem({ id: o.id, tipo: o.tipo }, inf.icone)),
      h('h4', { class: 'rq-det-nome' }, o.nome),
      h('p', { class: 'rq-det-tipo' }, inf.tipo, ' · ', textoRef(o.ref)),
      h('dl', { class: 'rq-det-num' }, ...nums),
      base?.resumo ? h('p', { class: 'rq-det-resumo' }, base.resumo) : null,
      base?.especial?.length ? h('p', { class: 'rq-det-esp' }, base.especial.filter((x) => !/^\(/.test(x)).join(' · ')) : null,
      seletorDaEscolha(o),
      h('ul', { class: 'rq-checks' }, ...checks.map((c) => h('li', { class: c.tom }, ic(icTom[c.tom]), h('span', null, c.texto)))),
      o.naMochila ? h('p', { class: 'rq-det-tem' }, `Já tem ${o.naMochila} na mochila.`) : null,
      h('div', { class: 'rq-det-acoes' }, ...acoes),
    ];
    det.replaceChildren(...partes.filter((x): x is Node => !!x));
  };

  /** A perícia do utensílio ou o elemento das amarras: escolhido aqui, antes de pedir (LR p. 63 e 66). */
  const escolhas = new Map<string, string>();
  const seletorDaEscolha = (o: regras.OpcaoItem): HTMLElement | null => {
    const qual = regras.escolhaDoItem(o.tipo, o.id);
    if (!qual) return null;
    const chave = `${o.tipo}:${o.id}`;
    // o selo: os rituais do elemento dele, com o círculo (que é a categoria do selo)
    const elSelo = qual === 'ritual' ? (o.id.replace('selos-paranormais-', '') as regras.Elemento) : null;
    const lista =
      qual === 'pericia'
        ? regras.periciasDoItem(o.id)
        : qual === 'ritual'
          ? regras.catalogo.CATALOGO.rituais.filter((x) => x.elemento === elSelo).map((x) => ({ id: x.id, nome: `${x.nome} (${x.circulo}º círculo, categoria ${['0', 'I', 'II', 'III', 'IV'][x.circulo]})` }))
          : (['sangue', 'morte', 'conhecimento', 'energia'] as const).map((id) => ({ id, nome: regras.NOME_ELEMENTO[id] }));
    const vazio = qual === 'pericia' ? 'Escolha a perícia…' : qual === 'ritual' ? 'Escolha o ritual do selo…' : 'Escolha o elemento…';
    const sel = h('select', { class: 'fx-inp' }, h('option', { value: '' }, vazio), ...lista.map((x) => h('option', { value: x.id, selected: escolhas.get(chave) === x.id }, x.nome))) as HTMLSelectElement;
    sel.addEventListener('change', () => (sel.value ? escolhas.set(chave, sel.value) : escolhas.delete(chave)));
    return h('label', { class: 'fj-campo rq-escolha' }, h('span', null, qual === 'pericia' ? 'Perícia que ele melhora (fora Luta e Pontaria)' : qual === 'ritual' ? 'Ritual guardado no selo' : 'Elemento'), sel);
  };
  const selecionarPorId = (o: regras.OpcaoItem) => {
    const el = [...grade.querySelectorAll<HTMLElement>('.rq-card')].find((c) => c.dataset.chave === `${o.tipo}:${o.id}`);
    if (el && (sel?.tipo !== o.tipo || sel?.id !== o.id)) selecionar(o, el);
  };

  /** Fecha o item que subiu (no celular): o X, o puxador, ou um toque fora dele. */
  const fecharDetalhe = () => {
    if (!caixa.classList.contains('com-det')) return;
    sfx.paper();
    caixa.classList.remove('com-det');
    sel = null;
    for (const c of grade.querySelectorAll('.rq-card.on')) (c.classList.remove('on'), c.setAttribute('aria-pressed', 'false'));
    desenharTopo();
    desenharDetalhe();
  };
  lista.addEventListener('pointerdown', (e) => {
    if (caixa.classList.contains('com-det') && !(e.target as HTMLElement).closest('.rq-card')) fecharDetalhe();
  });

  const selecionar = (o: regras.OpcaoItem, el: HTMLElement) => {
    sfx.click();
    sel = o;
    for (const c of grade.querySelectorAll('.rq-card.on')) (c.classList.remove('on'), c.setAttribute('aria-pressed', 'false'));
    el.classList.add('on');
    el.setAttribute('aria-pressed', 'true');
    desenharTopo();
    desenharDetalhe();
    caixa.classList.add('com-det');
  };

  /** Põe o item na mochila (na ficha) e avisa quem abriu. */
  const adicionar = (o: regras.OpcaoItem, qtd: number, redesenhar = true) => {
    if (!o.ok && !r.mestre) {
      sfx.denied();
      return;
    }
    // o que se escolhe dentro do item: sem escolher, não entra
    const qual = regras.escolhaDoItem(o.tipo, o.id);
    const esc = escolhas.get(`${o.tipo}:${o.id}`);
    if (qual && !esc) {
      sfx.denied();
      selecionarPorId(o);
      det.querySelector<HTMLSelectElement>('.rq-escolha select')?.focus();
      return;
    }
    const municao = o.tipo === 'equipamento' && cat.equipamento(o.id)?.grupo === 'municao';
    for (let i = 0; i < qtd; i++) {
      const it: regras.ItemFicha = { id: o.id, tipo: o.tipo };
      if (qual === 'pericia') it.escolha = { pericia: esc as regras.PericiaId };
      if (qual === 'elemento') it.escolha = { elemento: esc as regras.Elemento };
      if (qual === 'ritual') it.escolha = { ritual: esc };
      // munição: mais um pacote na pilha que já está na mochila
      const pilha = municao ? f.inventario.find((x) => x.tipo === 'equipamento' && x.id === o.id && !x.achado && !x.modificacoes?.length) : undefined;
      if (pilha) pilha.qtd = (pilha.qtd ?? 1) + 1;
      else f.inventario.push(it);
      r.aoAdicionar(it);
    }
    pedidos += qtd;
    sfx.drop();
    if (!redesenhar) return;
    recalcular();
    desenhar();
    // o cartão pisca: entrou
    grade.querySelector('.rq-card.on')?.animate([{ boxShadow: '0 0 0 0.3rem rgba(246, 196, 74, 0.9)' }, { boxShadow: '0 0 0 0 rgba(246, 196, 74, 0)' }], { duration: 520, easing: 'ease-out' });
  };

  const desenhar = () => {
    desenharTopo();
    desenharSecoes();
    desenharFiltros();
    desenharGrade();
    desenharDetalhe();
    contador.textContent = pedidos ? `${pedidos} ${pedidos === 1 ? 'item pedido' : 'itens pedidos'} nesta requisição` : (matchMedia('(pointer: coarse)').matches ? 'Toque num item para ver o que ele faz e pedir.' : 'Clique duas vezes num cartão para pedir direto.');
  };

  let espera = 0;
  busca.addEventListener('input', () => {
    clearTimeout(espera);
    espera = window.setTimeout(desenharGrade, 90);
  });
  recalcular();
  desenhar();
  // no celular, o teclado não sobe sozinho
  if (matchMedia('(pointer: fine)').matches) busca.focus();
}
