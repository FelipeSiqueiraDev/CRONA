/**
 * A requisição de equipamento: o que o agente pode levar para a missão, item por item, e por quê
 * (LR cap. 3). Cada item do catálogo vira uma opção com o que acontece se ele entrar na mochila:
 * o limite da patente por categoria (LR p. 52), a carga (LR p. 53), a proficiência (LR p. 29, 30 e
 * 62), a munição que a arma usa (LR p. 59) e os itens amaldiçoados (só de agente especial em diante).
 * A janela de escolha (client/src/ui/requisicao.ts) desenha isto; o mestre pode passar por cima.
 */
import { alvoModificacao, calcular, categoriaDoItem, proficiente, type Calculado } from './calcular';
import * as cat from './dados';
import { MALDICAO_PP_MINIMO } from './dados';
import type { Ficha, ItemFicha, TipoItemCatalogo } from './ficha';
import type { Categoria, Elemento, GrupoItem, PericiaId, Proficiencia, Ref } from './tipos';

/** As seções da requisição: como o agente procura o item. */
export type SecaoItem = 'corpoACorpo' | 'disparo' | 'fogo' | 'municao' | 'protecao' | 'explosivo' | 'acessorio' | 'operacional' | 'medicamento' | 'paranormal' | 'amaldicoado' | 'outro';

export const SECOES_ITEM: { id: SecaoItem; nome: string }[] = [
  { id: 'corpoACorpo', nome: 'Armas corpo a corpo' },
  { id: 'disparo', nome: 'Disparo e arremesso' },
  { id: 'fogo', nome: 'Armas de fogo' },
  { id: 'municao', nome: 'Munição' },
  { id: 'protecao', nome: 'Proteções' },
  { id: 'explosivo', nome: 'Explosivos' },
  { id: 'acessorio', nome: 'Acessórios e kits' },
  { id: 'operacional', nome: 'Operacional' },
  { id: 'medicamento', nome: 'Medicamentos' },
  { id: 'paranormal', nome: 'Paranormal' },
  { id: 'amaldicoado', nome: 'Amaldiçoados' },
  { id: 'outro', nome: 'Volumes e outros' },
];

const SECAO_DO_GRUPO: Record<GrupoItem, SecaoItem> = {
  municao: 'municao',
  explosivo: 'explosivo',
  acessorio: 'acessorio',
  kit: 'acessorio',
  utensilio: 'acessorio',
  vestimenta: 'acessorio',
  operacional: 'operacional',
  medicamento: 'medicamento',
  paranormal: 'paranormal',
  veiculo: 'outro',
  outro: 'outro',
};

/** As armas do catálogo que não são um item para levar: o golpe com a coronha e o ataque desarmado. */
const NAO_E_ITEM = new Set(['coronhada', 'ataque-desarmado']);

export interface OpcaoItem {
  tipo: TipoItemCatalogo;
  id: string;
  nome: string;
  ref: Ref;
  secao: SecaoItem;
  categoria: Categoria;
  espacos: number;
  /** pode entrar na mochila (o mestre passa por cima dos motivos) */
  ok: boolean;
  /** por que não pode: o limite da patente, a carga, o amaldiçoado antes de agente especial */
  motivos: string[];
  /** entra, mas com um custo: sem proficiência, sobrecarregado, sem a munição */
  avisos: string[];
  /** a munição que a arma usa e se a mochila já tem */
  municao?: { id: string; nome: string; tem: boolean };
  /** quantos iguais já estão na mochila */
  naMochila: number;
}

const romano = (n: number) => (n === 4 ? 'IV' : 'I'.repeat(n));
/** número com vírgula (1,5) */
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * Cada item do catálogo que a ficha pode pedir (os do Sobrevivendo ao Horror só com o livro ligado),
 * com o que acontece se UM deles entrar na mochila agora.
 */
export function opcoesDeItens(f: Ficha, c: Calculado = calcular(f)): OpcaoItem[] {
  const profs = new Set<Proficiencia>(c.proficiencias);
  const tem = (tipo: TipoItemCatalogo, id: string) => f.inventario.filter((it) => it.tipo === tipo && it.id === id).reduce((s, it) => s + (it.qtd ?? 1), 0);
  const quem = c.patente ? `a patente ${c.patente.nome.toLowerCase()}` : 'o agente em NEX 0';
  const out: OpcaoItem[] = [];
  const opcao = (tipo: TipoItemCatalogo, x: { id: string; nome: string; ref: Ref; categoria: Categoria; espacos: number }, secao: SecaoItem, extra: (o: OpcaoItem) => void = () => {}) => {
    const o: OpcaoItem = { tipo, id: x.id, nome: x.nome, ref: x.ref, secao, categoria: x.categoria, espacos: x.espacos, ok: true, motivos: [], avisos: [], naMochila: tem(tipo, x.id) };
    // o limite da patente: categoria 0 à vontade; I a IV pela patente (ou pelo NEX 0), com a Profissão
    if (x.categoria >= 1) {
      const lim = c.itens.find((l) => l.categoria === x.categoria);
      if (!lim || lim.limite === 0) o.motivos.push(`Categoria ${romano(x.categoria)}: ${quem} não leva (LR p. 52).`);
      else if (lim.usados + 1 > lim.limite) o.motivos.push(`Limite da patente: categoria ${romano(x.categoria)} já tem ${lim.usados} de ${lim.limite} (LR p. 52).`);
    }
    // a carga: até o dobro dá para levar, sobrecarregado; acima do dobro, não (LR p. 53)
    const depois = c.carga.usados + x.espacos;
    // acima do dobro o livro não deixa carregar (LR p. 53); na mesa do Felipe (19/10) entra com o aviso, e o mestre decide
    if (depois > c.carga.maximo) o.avisos.push(`Passa do máximo: ${num(depois)} espaços, o máximo é ${num(c.carga.maximo)} (LR p. 53). Sobrecarregado (−5 na Defesa e nas perícias de carga, −3 m) e, pelo livro, nem consegue carregar tudo: combine com o mestre.`);
    else if (x.espacos > 0 && depois > c.carga.espacos) o.avisos.push(`Fica sobrecarregado: ${num(depois)} de ${num(c.carga.espacos)} espaços (−5 na Defesa, −3 m; LR p. 53).`);
    extra(o);
    o.ok = o.motivos.length === 0;
    out.push(o);
  };
  for (const a of cat.CATALOGO.armas) {
    if (NAO_E_ITEM.has(a.id) || !cat.disponivel(a, f.regras)) continue;
    const secao: SecaoItem = a.tipo === 'fogo' ? 'fogo' : a.tipo === 'corpoACorpo' ? 'corpoACorpo' : 'disparo';
    opcao('arma', a, secao, (o) => {
      if (!proficiente(a, profs)) o.avisos.push('Sem proficiência: −2d20 nos ataques com ela.');
      if (a.municao) {
        const m = cat.equipamento(a.municao);
        const temM = tem('equipamento', a.municao) > 0;
        o.municao = { id: a.municao, nome: m?.nome ?? a.municao, tem: temM };
        if (!temM) o.avisos.push(`Usa ${m?.nome ?? a.municao}, e a mochila não tem (LR p. 59).`);
      }
    });
  }
  for (const p of cat.CATALOGO.protecoes) {
    if (!cat.disponivel(p, f.regras)) continue;
    opcao('protecao', p, 'protecao', (o) => {
      // o escudo conta como proteção pesada para a proficiência (LR p. 62)
      const prof: Proficiencia = p.tipo === 'leve' ? 'protecoesLeves' : 'protecoesPesadas';
      if (!profs.has(prof)) o.avisos.push('Sem proficiência: −2d20 nos testes de Força e Agilidade (LR p. 62).');
    });
  }
  for (const e of cat.CATALOGO.equipamentos) {
    if (!cat.disponivel(e, f.regras)) continue;
    opcao('equipamento', e, SECAO_DO_GRUPO[e.grupo]);
  }
  for (const x of cat.CATALOGO.amaldicoados) {
    if (!cat.disponivel(x, f.regras)) continue;
    opcao('amaldicoado', x, 'amaldicoado', (o) => {
      if (c.nex > 0 && f.pp < MALDICAO_PP_MINIMO) o.motivos.push(`Itens amaldiçoados: só a partir de agente especial (${MALDICAO_PP_MINIMO} PP).`);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// o que se escolhe dentro do item

/** O que se escolhe ao requisitar o item: a perícia (utensílio, vestimenta, manual) ou o elemento (LR p. 63 e 66). */
export function escolhaDoItem(tipo: TipoItemCatalogo, id: string): 'pericia' | 'elemento' | null {
  if (tipo !== 'equipamento') return null;
  const e = cat.equipamento(id);
  if (!e) return null;
  if (e.efeitos?.some((x) => (x.alvo === 'pericia' || x.alvo === 'treino') && x.pericia === 'escolhida')) return 'pericia';
  if (/\(Elemento\)/.test(e.nome) || e.especial?.some((s) => /elemento à escolha/.test(s))) return 'elemento';
  return null;
}

/** As perícias que um utensílio ou uma vestimenta podem melhorar (todas, fora Luta e Pontaria; LR p. 63). */
export function periciasDoItem(): { id: PericiaId; nome: string }[] {
  return cat.CATALOGO.pericias.filter((p) => p.id !== 'luta' && p.id !== 'pontaria').map((p) => ({ id: p.id, nome: p.nome }));
}

// ---------------------------------------------------------------------------
// modificações e maldições num item da mochila

export interface OpcaoMelhoria {
  tipo: 'modificacao' | 'maldicao';
  id: string;
  nome: string;
  ref: Ref;
  resumo?: string;
  elemento?: Elemento;
  /** o item já tem */
  tem: boolean;
  /** pode pôr (ou tirar, se já tem); o mestre passa por cima */
  ok: boolean;
  motivos: string[];
  avisos: string[];
  /** a categoria do item com ela */
  categoria: number;
}

/** Requisitos das modificações que vêm escritos (LR p. 60–64): os que o jogo sabe conferir; o resto, o mestre. */
function confereRequisito(texto: string, it: ItemFicha): boolean | null {
  if (texto === 'só em proteção pesada') return it.tipo === 'protecao' && cat.protecao(it.id)?.tipo === 'pesada';
  if (texto === 'só em proteção leve') return it.tipo === 'protecao' && cat.protecao(it.id)?.tipo === 'leve';
  if (texto === 'só em balas curtas ou balas longas') return it.tipo === 'equipamento' && (it.id === 'balas-curtas' || it.id === 'balas-longas');
  if (texto === 'só em arma automática') return it.tipo === 'arma' && !!cat.arma(it.id)?.automatica;
  return null;
}

/**
 * As modificações e as maldições que cabem no item `i` da mochila (as que não servem para ele nem
 * aparecem), cada uma com o que acontece se entrar: a categoria nova contra o limite da patente
 * (LR p. 52 e 60), os requisitos, as que não combinam, os elementos que se oprimem e a patente
 * mínima das maldições (LR p. 144). A conta é a do motor: a ficha com ela, comparada à de agora.
 */
export function opcoesDeMelhoria(f: Ficha, i: number): OpcaoMelhoria[] {
  const it = f.inventario[i];
  if (!it || it.tipo === 'cena' || it.tipo === 'amaldicoado') return [];
  const c0 = calcular(f);
  const erros0 = new Set(c0.problemas.filter((p) => p.severidade === 'erro').map((p) => p.texto));
  const alvo = alvoModificacao(it);
  const grupo = it.tipo === 'equipamento' ? cat.equipamento(it.id)?.grupo : undefined;
  const alvoMald = it.tipo === 'arma' ? 'arma' : it.tipo === 'protecao' ? 'protecao' : grupo && ['acessorio', 'utensilio', 'vestimenta'].includes(grupo) ? 'acessorio' : null;
  const out: OpcaoMelhoria[] = [];
  const simular = (o: OpcaoMelhoria, mudar: (x: ItemFicha) => void) => {
    const novo: ItemFicha = { ...it, modificacoes: [...(it.modificacoes ?? [])], maldicoes: [...(it.maldicoes ?? [])] };
    mudar(novo);
    const inv = [...f.inventario];
    inv[i] = novo;
    const c1 = calcular({ ...f, inventario: inv });
    o.categoria = categoriaDoItem(novo);
    // a categoria que o item de fato ocupa (a arma favorita vale uma a menos): a que ganhou vaga usada com a mudança
    const ganhou = c1.itens.filter((l) => l.usados > (c0.itens.find((x) => x.categoria === l.categoria)?.usados ?? 0));
    if (ganhou.length === 1) o.categoria = ganhou[0].categoria;
    else if (!ganhou.length && o.categoria >= 1) o.categoria = c1.itens.find((l) => l.usados < (c0.itens.find((x) => x.categoria === l.categoria)?.usados ?? 0))?.categoria ?? o.categoria;
    if (o.tem) return;
    for (const p of c1.problemas) if (p.severidade === 'erro' && !erros0.has(p.texto) && !(!it.achado && p.texto.startsWith('Itens de categoria'))) o.motivos.push(p.texto);
    // o limite da patente com a categoria nova (o achado na missão não conta)
    if (!it.achado)
      for (const l of c1.itens) {
        const antes = c0.itens.find((x) => x.categoria === l.categoria)?.usados ?? 0;
        if (l.usados > antes && l.usados > l.limite) o.motivos.push(`A patente leva ${l.limite} itens de categoria ${romano(l.categoria)} e você já tem ${antes}: com ela o item passa a ocupar uma vaga a mais (LR p. 52). Libere uma vaga antes.`);
      }
    const e0 = c0.carga.usados;
    if (c1.carga.usados !== e0) o.avisos.push(`Espaços: ${num(e0)} → ${num(c1.carga.usados)}.`);
  };
  for (const m of cat.CATALOGO.modificacoes) {
    if (!alvo || !m.para.includes(alvo) || !cat.disponivel(m, f.regras)) continue;
    const tem = !!it.modificacoes?.includes(m.id);
    const o: OpcaoMelhoria = { tipo: 'modificacao', id: m.id, nome: m.nome, ref: m.ref, resumo: m.resumo, tem, ok: true, motivos: [], avisos: [], categoria: 0 };
    for (const r of m.requisitos ?? []) {
      if (r.tipo !== 'texto') continue;
      const v = confereRequisito(r.texto, it);
      if (v === false) o.motivos.push(`Requisito: ${r.texto}.`);
      else if (v === null) o.avisos.push(`O mestre confere: ${r.texto}.`);
    }
    simular(o, (x) => (tem ? (x.modificacoes = x.modificacoes!.filter((y) => y !== m.id)) : x.modificacoes!.push(m.id)));
    o.ok = o.motivos.length === 0;
    out.push(o);
  }
  for (const m of cat.CATALOGO.maldicoes) {
    if (!alvoMald || !m.para.includes(alvoMald) || !cat.disponivel(m, f.regras)) continue;
    if (m.id === 'empuxo' && !(it.tipo === 'arma' && cat.arma(it.id)?.tipo === 'corpoACorpo')) continue;
    const tem = !!it.maldicoes?.includes(m.id);
    const o: OpcaoMelhoria = { tipo: 'maldicao', id: m.id, nome: m.nome, ref: m.ref, elemento: m.elemento, tem, ok: true, motivos: [], avisos: [], categoria: 0 };
    if (!tem && c0.nex > 0 && f.pp < MALDICAO_PP_MINIMO) o.motivos.push(`Maldições: só a partir de agente especial (${MALDICAO_PP_MINIMO} PP).`);
    simular(o, (x) => (tem ? (x.maldicoes = x.maldicoes!.filter((y) => y !== m.id)) : x.maldicoes!.push(m.id)));
    if (!tem) o.avisos.push(`Preço: −2 SAN ao falhar em teste de ${NOME_PRECO[m.elemento] ?? 'atributo do elemento'} (LR p. 145).`);
    o.ok = o.motivos.length === 0;
    out.push(o);
  }
  return out;
}

const NOME_PRECO: Partial<Record<Elemento, string>> = { conhecimento: 'Intelecto', energia: 'Agilidade', morte: 'Presença', sangue: 'Força ou Vigor' };
