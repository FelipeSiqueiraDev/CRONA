/**
 * Os números da ficha: PV, PE e SAN máximos, Defesa, deslocamento, carga,
 * perícias, DTs, resistências, reações, ataques e limites de itens. Tudo sai
 * das escolhas (montarEstado) mais a mochila.
 */
import * as cat from './dados';
import { BONUS_GRAU, CREDITOS, ELEMENTO_OPRIME, ITENS_NEX_ZERO, PENALIDADE_CARGA, PRECO_MALDICAO, patentePorPP } from './dados';
import { montarEstado, type Estado, type PoderObtido, type Problema, type Pendencia, type RitualObtido } from './estado';
import type { Ficha, ItemFicha } from './ficha';
import { lugarDoItem, maosDoItem, maosOcupadas, MAOS, vestivel } from './mochila';
import { limitePeDoNex, patamar } from './nex';
import { NOME_ATRIBUTO } from './requisitos';
import type { AlvoModificacao, Arma, AtributoId, Categoria, ClasseId, Efeito, Elemento, Escopo, Grau, Nex, PericiaId, Proficiencia, TipoDano, Valor } from './tipos';
import { ATRIBUTOS, NEX_LISTA } from './tipos';

export interface PericiaCalculada {
  grau: Grau;
  /** atributo usado (o maior, quando um poder deixa trocar) */
  atributo: AtributoId;
  /** quantos d20 rola: o atributo e os dados ganhos (0 = rola 2 e fica o menor) */
  dados: number;
  /** d20 perdidos (0 ou negativo); a conta com os dois está em rolagem.ts (LR p. 11) */
  penalidadeDados: number;
  /** bônus total somado ao d20 */
  bonus: number;
  somenteTreinada: boolean;
  /** pode usar (as de "só treinada" pedem treino) */
  podeUsar: boolean;
}

export interface Ataque {
  item: string;
  nome: string;
  pericia: PericiaId;
  dados: number;
  bonus: number;
  /** penalidade em d20 (ex.: sem proficiência, −2) */
  penalidadeDados: number;
  dano: string;
  critico: { margem: number; multiplicador: number };
  alcance?: string;
  tipoDano: TipoDano[];
  notas: string[];
  /** a arma está na mão (o desarmado, sempre): só assim ataca */
  naMao: boolean;
  /** o item da mochila (sem ele, o ataque desarmado) */
  uid?: number;
}

export interface LimiteItens {
  categoria: 1 | 2 | 3 | 4;
  usados: number;
  limite: number;
}

export interface Calculado {
  nex: Nex;
  patamar: number;
  classe: ClasseId;
  patente: { id: string; nome: string; credito: string } | null;
  atributos: Record<AtributoId, number>;
  pv: number;
  pe: number;
  san: number;
  limitePe: number;
  /** limite de PE só para conjurar rituais */
  limitePeRituais: number;
  defesa: number;
  /** Defesa que vem da proteção vestida e do escudo */
  protecao: number;
  /** em metros */
  deslocamento: number;
  carga: { espacos: number; usados: number; maximo: number; sobrecarregado: boolean };
  pericias: Record<PericiaId, PericiaCalculada>;
  /** DT das habilidades por atributo-chave (10 + limite de PE + atributo) */
  dtHabilidades: Record<AtributoId, number>;
  dtRituais: number;
  resistencias: Partial<Record<TipoDano, number>>;
  reacoes: { esquiva: number | null; bloqueio: number | null; contraAtaque: boolean };
  proficiencias: Proficiencia[];
  poderes: PoderObtido[];
  rituais: RitualObtido[];
  /** rituais aprendidos por Aprender Ritual e o limite (Intelecto) */
  rituaisPorPoder: { usados: number; limite: number };
  /**
   * Custo em PE (forma básica) e DT de cada ritual conhecido, com os poderes
   * que mudam. `base` é o custo do círculo e `ajuste`, o que os poderes somam
   * (negativo = reduz): a forma avançada soma antes do mínimo de 1 PE (LR p. 78, 121).
   */
  custoRituais: Record<string, { pe: number; dt: number; base: number; ajuste: number }>;
  itens: LimiteItens[];
  ataques: Ataque[];
  /** efeitos que só valem numa situação (para mostrar) */
  condicionais: { origem: string; texto: string }[];
  pendencias: Pendencia[];
  problemas: Problema[];
}

const ESCOPO_FISICO: TipoDano[] = ['balistico', 'corte', 'impacto', 'perfuracao'];
/** O dano paranormal tem sempre o subtipo de um elemento (LR p. 82). */
const ESCOPO_PARANORMAL: TipoDano[] = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
/** Os tipos que uma RD ou imunidade cobre: "físico" e "paranormal" são grupos. */
export function tiposDoDano(dano: TipoDano): TipoDano[] {
  return dano === 'fisico' ? ESCOPO_FISICO : dano === 'paranormal' ? ESCOPO_PARANORMAL : [dano];
}

/** Efeito que veio de um item da mochila (`mochila:<posição>`): itens diferentes não somam entre si (LR p. 312–313). */
const deItem = (x: { origem: PoderObtido }) => x.origem.id.startsWith('mochila:');

/** Soma todos os efeitos ativos (sem condição e, os de afinidade, só com o poder escolhido com afinidade). */
function efeitosAtivos(st: Estado): { efeito: Efeito; origem: PoderObtido }[] {
  const out: { efeito: Efeito; origem: PoderObtido }[] = [];
  // quantas vezes cada poder foi escolhido, no mesmo elemento (Resistir a Sangue e a Morte são dois)
  const chaveVezes = (p: PoderObtido) => (p.tipo === 'paranormal' ? `${p.id}:${p.elemento ?? ''}` : p.id);
  const vezes = new Map<string, number>();
  for (const p of st.poderes) vezes.set(chaveVezes(p), (vezes.get(chaveVezes(p)) ?? 0) + 1);
  const vistos = new Set<string>();
  for (const p of st.poderes) {
    // o mesmo poder nunca soma duas vezes (repetíveis têm escolhas diferentes); a mesma
    // habilidade vinda de lugares diferentes (origem e trilha) conta nos dois
    const chave = `${p.tipo}:${p.id}:${JSON.stringify(p.escolha ?? null)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    for (const e of p.efeitos) {
      if (e.afinidade && !((vezes.get(chaveVezes(p)) ?? 0) >= 2 && st.afinidadeAtiva && st.afinidade === p.elemento)) continue;
      // efeito de um elemento só: o da escolha do poder, senão o da trilha, senão o da afinidade
      if (e.soElemento && e.soElemento !== (p.escolha?.elemento ?? st.elementoTrilha ?? st.afinidade)) continue;
      out.push({ efeito: e, origem: p });
    }
  }
  return out;
}

function valor(v: Valor | undefined, atr: Record<AtributoId, number>): number {
  if (v === undefined) return 0;
  return typeof v === 'number' ? v : atr[v];
}

/** Valor de um efeito de PV/PE/SAN com as escalas por NEX. */
function escala(e: { fixo?: number; porNex?: number; porDezNex?: number; porNexImpar?: number; valor?: AtributoId }, pat: number, atr: Record<AtributoId, number>): number {
  let v = e.fixo ?? 0;
  if (e.porNex) v += e.porNex * pat;
  if (e.porDezNex) v += e.porDezNex * Math.floor(pat / 2);
  if (e.porNexImpar) v += e.porNexImpar * Math.max(0, Math.floor((pat - 1) / 2));
  if (e.valor) v += atr[e.valor];
  return v;
}

function vale(escopo: Escopo, a: Arma, favorita?: string): boolean {
  switch (escopo) {
    case 'todos':
      return true;
    case 'corpoACorpo':
      return a.tipo === 'corpoACorpo';
    case 'armasCorpoACorpo':
      // efeitos que falam de armas não valem no ataque desarmado (LR p. 57)
      return a.tipo === 'corpoACorpo' && a.id !== 'ataque-desarmado';
    case 'distancia':
      return a.tipo !== 'corpoACorpo';
    case 'disparo':
      return a.tipo === 'disparo' || a.tipo === 'fogo';
    case 'fogo':
      return a.tipo === 'fogo';
    case 'arremesso':
      return a.tipo === 'arremesso';
    case 'desarmado':
      return a.id === 'ataque-desarmado';
    case 'favorita':
      return !!favorita && a.id === favorita;
    case 'taticaCorpoACorpo':
      return a.proficiencia === 'tatica' && a.tipo === 'corpoACorpo';
    case 'taticaFogo':
      return a.proficiencia === 'tatica' && a.tipo === 'fogo';
    case 'balasLongas':
      return a.tipo === 'fogo' && a.municao === 'balas-longas';
    case 'ritual':
      return false;
  }
}

/** Sabe usar a arma? Proficiência geral ou a parcial que cobre a arma (LR p. 29 e 30). */
export function proficiente(a: Arma, tem: Set<Proficiencia>): boolean {
  if (a.proficiencia === 'simples') return tem.has('armasSimples');
  if (a.tipo === 'fogo' && a.municao === 'balas-longas' && tem.has('armasFogoBalasLongas')) return true;
  if (a.proficiencia === 'pesada') return tem.has('armasPesadas');
  if (tem.has('armasTaticas')) return true;
  if (a.tipo === 'corpoACorpo') return tem.has('armasTaticasCorpoACorpo');
  if (a.tipo === 'fogo') return tem.has('armasTaticasFogo');
  return false;
}

/** Categoria de um item na mochila: base + modificações + maldições − reduções (LR p. 60 e 144). */
export function categoriaDoItem(it: ItemFicha, reducao = 0): number {
  const base = baseDoItem(it)?.categoria ?? 0;
  const mods = (it.modificacoes ?? []).length;
  const mald = (it.maldicoes ?? []).length;
  // a primeira maldição sobe a categoria em II, as seguintes em I (LR p. 144)
  const porMaldicao = mald ? 2 + (mald - 1) : 0;
  return Math.max(0, base + mods + porMaldicao - reducao);
}

export function baseDoItem(it: ItemFicha): { nome: string; categoria: Categoria; espacos: number } | undefined {
  switch (it.tipo) {
    case 'cena':
      // achado no cenário: fora do catálogo, sem categoria
      return { nome: it.nome || it.id, categoria: 0, espacos: it.espacos ?? 1 };
    case 'arma':
      return cat.arma(it.id);
    case 'protecao':
      return cat.protecao(it.id);
    case 'equipamento':
      return cat.equipamento(it.id);
    case 'amaldicoado':
      return cat.amaldicoado(it.id);
  }
}

/**
 * Efeitos que vêm da mochila enquanto o item está em uso: itens amaldiçoados,
 * maldições (a mesma maldição em dois itens não soma, LR p. 145) e as
 * modificações de proteção fora a Defesa (que tem conta própria). Confere
 * também onde cada maldição pode ir e os elementos que se oprimem (LR p. 144).
 */
function efeitosDaMochila(f: Ficha, nex: Nex, problemas: Problema[], st: Estado) {
  const efeitos: { efeito: Efeito; origem: PoderObtido }[] = [];
  const atributos: Partial<Record<AtributoId, number>> = {};
  const vistos = new Set<string>();
  const erro = (texto: string) => problemas.push({ nex, onde: 'Mochila', texto, severidade: 'erro' });
  // a origem guarda o item (`mochila:<posição>`): o que vem do mesmo item soma, de itens diferentes não
  const por = (chave: string, nome: string, lista: Efeito[] | undefined) => {
    const origem: PoderObtido = { id: chave, nome, tipo: 'habilidade', nex, efeitos: [] };
    for (const e of lista ?? []) {
      if (e.alvo === 'atributo' && !e.condicional) atributos[e.atributo] = (atributos[e.atributo] ?? 0) + e.valor;
      else efeitos.push({ efeito: e, origem });
    }
  };
  const oprime = ELEMENTO_OPRIME as Partial<Record<Elemento, Elemento>>;
  for (const [i, it] of f.inventario.entries()) {
    const base = baseDoItem(it);
    if (!base) continue;
    const chave = `mochila:${i}`;
    // em uso: o que se empunha, na mão; o que se veste, vestido; o resto, na mochila
    const lugar = lugarDoItem(it);
    const emUso = maosDoItem(it) ? lugar === 'mao' : vestivel(it) ? lugar === 'vestido' : true;
    if (it.tipo === 'amaldicoado') {
      const a = cat.amaldicoado(it.id);
      if (a && emUso && !vistos.has(a.id)) {
        vistos.add(a.id);
        por(chave, a.nome, a.efeitos);
      }
    }
    // equipamento em uso: os efeitos dele (perícias e espaços têm conta própria)
    if (it.tipo === 'equipamento' && emUso && !vistos.has(`eq:${it.id}`)) {
      const e = cat.equipamento(it.id);
      if (e && (!e.exigeTreino || st.graus[e.exigeTreino] !== 'destreinado')) {
        vistos.add(`eq:${it.id}`);
        por(chave, it.apelido || e.nome, e.efeitos?.filter((x) => (x.alvo !== 'pericia' && x.alvo !== 'espacos') || x.condicional));
      }
    }
    const grupo = it.tipo === 'equipamento' ? cat.equipamento(it.id)?.grupo : undefined;
    const alvo = it.tipo === 'arma' ? 'arma' : it.tipo === 'protecao' ? 'protecao' : grupo && ['acessorio', 'utensilio', 'vestimenta'].includes(grupo) ? 'acessorio' : null;
    const elementos: Elemento[] = [];
    const naMesma = new Set<string>();
    for (const mId of it.maldicoes ?? []) {
      const m = cat.maldicao(mId);
      if (!m) {
        erro(`Maldição desconhecida: ${mId}.`);
        continue;
      }
      if (!alvo || !m.para.includes(alvo)) erro(`${m.nome} não vai em ${base.nome}.`);
      if (m.id === 'empuxo' && !(it.tipo === 'arma' && cat.arma(it.id)?.tipo === 'corpoACorpo')) erro('Empuxo: só armas corpo a corpo.');
      if (naMesma.has(m.id)) erro(`${base.nome}: ${m.nome} duas vezes.`);
      naMesma.add(m.id);
      for (const o of elementos) if (oprime[m.elemento] === o || oprime[o] === m.elemento) erro(`${base.nome}: maldições de elementos que se oprimem (${m.elemento} e ${o}).`);
      elementos.push(m.elemento);
      if (!emUso || vistos.has(m.id)) continue;
      vistos.add(m.id);
      por(chave, `${base.nome} (${m.nome})`, m.efeitos);
      // Cinética: RD 2 na proteção leve, 5 na pesada (LR p. 147)
      if (m.id === 'cinetica') por(chave, `${base.nome} (${m.nome})`, [{ alvo: 'resistencia', dano: 'fisico', valor: cat.protecao(it.id)?.tipo === 'pesada' ? 5 : 2 }]);
    }
    if (it.tipo === 'protecao' && emUso)
      for (const mId of it.modificacoes ?? []) {
        const m = cat.modificacao(mId);
        if (m) por(chave, `${base.nome} (${m.nome})`, m.efeitos?.filter((e) => e.alvo !== 'defesa'));
      }
  }
  return { efeitos, atributos };
}

export function calcular(f: Ficha): Calculado {
  const st = montarEstado(f);
  const nex = f.nex;
  const pat = patamar(nex);
  const problemas = [...st.problemas];
  const pendencias = [...st.pendencias];
  const mochila = efeitosDaMochila(f, nex, problemas, st);
  // atributos com os itens (Pujança, Destreza...); os PE usam a Presença sem itens: Carisma não dá PE (LR p. 147)
  const atr = { ...st.atributos };
  for (const k of ATRIBUTOS) atr[k] += mochila.atributos[k] ?? 0;
  // a etapa ritualística do dia (Ser Amaldiçoado): o efeito do elemento só com ela cumprida; a fome e a sede, sem
  const efeitos = [...efeitosAtivos(st), ...mochila.efeitos].filter((x) => !x.efeito.etapa || (x.efeito.etapa === 'com') === !!f.etapaCumprida);
  const condicionais: Calculado['condicionais'] = [];
  const doTipo = <A extends Efeito['alvo']>(alvo: A) => efeitos.filter((x) => x.efeito.alvo === alvo && !x.efeito.condicional) as { efeito: Extract<Efeito, { alvo: A }>; origem: PoderObtido }[];
  for (const x of efeitos) if (x.efeito.condicional) condicionais.push({ origem: x.origem.nome, texto: textoEfeito(x.efeito) + ` (${x.efeito.condicional})` });
  for (const x of efeitos) if (x.efeito.alvo === 'nota') condicionais.push({ origem: x.origem.nome, texto: x.efeito.texto });

  const classe = cat.classe(st.classe);
  const agente = st.classe !== 'mundano';
  const passos = agente ? Math.max(0, pat - 1) : 0;

  // ---------- PV, PE, SAN ----------
  // regra da mesa (19/10, o Felipe: "o vigor só vale dali pra frente; antes era 1, soma-se como 1; upou e aumentou, aí
  // soma-se como 2"): cada NEX soma o Vigor e a Presença daquele NEX; o aumento não volta para os NEX de antes. O livro
  // não diz (AUDITORIA-REGRAS.md, D1). Os itens (Pujança...) valem em todos, enquanto estão com a pessoa.
  const nexDoAgente = agente ? NEX_LISTA.filter((n) => n >= 5 && n <= nex) : [];
  const noNex = (n: Nex, a: AtributoId) => (st.atributosNoNex[n] ?? st.atributos)[a];
  const somaPorNex = (porNex: number, valor: (n: Nex) => number) => nexDoAgente.slice(1).reduce<number>((t, n) => t + porNex + valor(n), 0);
  const vigNoNex = (n: Nex) => noNex(n, 'vig') + (mochila.atributos.vig ?? 0);
  let pv = agente && nexDoAgente.length ? classe.pv.inicial + vigNoNex(nexDoAgente[0]) + somaPorNex(classe.pv.porNex, vigNoNex) : classe.pv.inicial + atr.vig + passos * (classe.pv.porNex + atr.vig);
  for (const x of doTipo('pv')) pv += escala(x.efeito, pat, atr);
  pv += f.ajustes?.pv ?? 0;

  let atrPe: number = st.atributos.pre;
  for (const x of doTipo('atributoPe')) atrPe = Math.max(atrPe, st.atributos[x.efeito.atributo]);
  const pePorNex = (n: Nex) => {
    let v = noNex(n, 'pre');
    for (const x of doTipo('atributoPe')) v = Math.max(v, noNex(n, x.efeito.atributo));
    return v;
  };
  let pe = agente && nexDoAgente.length ? classe.pe.inicial + pePorNex(nexDoAgente[0]) + somaPorNex(classe.pe.porNex, pePorNex) : classe.pe.inicial + atrPe + passos * (classe.pe.porNex + atrPe);
  for (const x of doTipo('pe')) {
    pe += escala(x.efeito, pat, atr);
    // o atributo escolhido na própria habilidade (Alteração do Monstruoso, NEX 35%)
    if ((x.efeito as { atributoEscolhido?: boolean }).atributoEscolhido && x.origem.escolha?.atributo) pe += atr[x.origem.escolha.atributo];
  }
  pe += (f.ajustes?.pe ?? 0) - (f.perdas?.pe ?? 0);

  let fatorSan = 1;
  for (const x of doTipo('sanInicial')) fatorSan = Math.min(fatorSan, x.efeito.fator);
  const semSan = st.transcender.length;
  let san = Math.floor(classe.san.inicial * fatorSan) + Math.max(0, passos - semSan) * classe.san.porNex;
  for (const x of doTipo('san')) san += escala(x.efeito, pat, atr);
  san += (f.ajustes?.san ?? 0) - (f.perdas?.san ?? 0);

  // ---------- limite de PE e DTs ----------
  let limitePe = limitePeDoNex(nex);
  for (const x of doTipo('limitePe')) limitePe += valor(x.efeito.valor, atr);
  limitePe += f.ajustes?.limitePe ?? 0;
  let limitePeRituais = limitePe;
  for (const x of doTipo('limitePeRituais')) limitePeRituais += valor(x.efeito.valor, atr);

  // ---------- mochila ----------
  const favorita = st.poderes.find((p) => p.escolha?.arma)?.escolha?.arma;
  let reducaoFavorita = 0;
  for (const x of doTipo('categoria')) if (x.efeito.item === 'favorita') reducaoFavorita = Math.max(reducaoFavorita, x.efeito.valor);

  // proteção vestida; o escudo vale na mão (LR p. 62)
  let protDef = 0;
  let escudoDef = 0;
  let pesada = false;
  /** RD de cada item em uso: a da proteção, a das modificações e a das maldições dele somam; entre itens, vale a maior (LR p. 144, 312–313) */
  const rdItens = new Map<string, Partial<Record<TipoDano, number>>>();
  const somarRd = (chave: string, t: TipoDano, v: number) => {
    const rd = rdItens.get(chave) ?? {};
    rd[t] = (rd[t] ?? 0) + v;
    rdItens.set(chave, rd);
  };
  /** proteções em uso sem a proficiência: −2d20 nos testes de Força e Agilidade (LR p. 62) */
  const semProficiencia: string[] = [];
  for (const [i, it] of f.inventario.entries()) {
    if (it.tipo !== 'protecao' || lugarDoItem(it) === 'mochila') continue;
    const p = cat.protecao(it.id);
    if (!p) continue;
    let d = p.defesa;
    for (const m of it.modificacoes ?? []) for (const e of cat.modificacao(m)?.efeitos ?? []) if (e.alvo === 'defesa' && !e.condicional) d += valor(e.valor, atr);
    if (p.tipo === 'escudo') escudoDef = Math.max(escudoDef, d);
    else {
      protDef = Math.max(protDef, d);
      if (p.tipo === 'pesada') pesada = true;
      if (p.resistencia) for (const t of p.resistencia.dano) somarRd(`mochila:${i}`, t, p.resistencia.valor);
    }
    // o escudo conta como proteção pesada para a proficiência (LR p. 62)
    const prof: Proficiencia = p.tipo === 'leve' ? 'protecoesLeves' : 'protecoesPesadas';
    if (!st.proficiencias.has(prof)) {
      semProficiencia.push(p.nome);
      problemas.push({ nex, onde: 'Mochila', texto: `Sem proficiência com ${p.nome}: −2d20 nos testes de Força e Agilidade, ataques incluídos (LR p. 62).`, severidade: 'aviso' });
    }
  }
  const penalidadeProtecao = semProficiencia.length ? -2 : 0;

  // carga
  let espacos = atr.for > 0 ? 5 * atr.for : 2;
  for (const x of doTipo('cargaAtributos')) espacos = Math.max(espacos, 5 * x.efeito.atributos.reduce((s, a) => s + atr[a], 0));
  for (const x of doTipo('espacos')) espacos += valor(x.efeito.valor, atr);
  let usados = 0;
  for (const it of f.inventario) {
    const b = baseDoItem(it);
    if (!b) {
      problemas.push({ nex, onde: 'Mochila', texto: `Item desconhecido: ${it.id}.`, severidade: 'erro' });
      continue;
    }
    usados += espacosDoItem(it, b.espacos) * (it.qtd ?? 1);
  }
  // espaços a mais dos itens (mochila militar): o mesmo item não soma duas vezes (uma mochila nas costas)
  const somaEspacos = new Set<string>();
  for (const it of f.inventario) {
    if (it.tipo !== 'equipamento' || somaEspacos.has(it.id)) continue;
    somaEspacos.add(it.id);
    for (const e of cat.equipamento(it.id)?.efeitos ?? []) if (e.alvo === 'espacos' && !e.condicional) espacos += valor(e.valor, atr);
  }
  const sobrecarregado = usados > espacos;
  if (usados > espacos * 2) problemas.push({ nex, onde: 'Mochila', texto: `Carga acima do máximo (${usados} de ${espacos * 2} espaços).`, severidade: 'erro' });
  else if (sobrecarregado) problemas.push({ nex, onde: 'Mochila', texto: `Sobrecarregado (${usados} de ${espacos} espaços): −5 na Defesa e nas perícias de carga, −3 m de deslocamento (LR p. 53).`, severidade: 'aviso' });
  // modificações: onde vão, repetidas e as que não combinam
  for (const it of f.inventario) {
    const mods = it.modificacoes ?? [];
    if (!mods.length) continue;
    const b = baseDoItem(it);
    const alvo = alvoModificacao(it);
    for (const [i, mId] of mods.entries()) {
      const m = cat.modificacao(mId);
      if (!m) {
        problemas.push({ nex, onde: 'Mochila', texto: `Modificação desconhecida: ${mId}.`, severidade: 'erro' });
        continue;
      }
      if (alvo && !m.para.includes(alvo)) problemas.push({ nex, onde: 'Mochila', texto: `${b?.nome ?? it.id}: ${m.nome} não serve para este item.`, severidade: 'erro' });
      if (mods.indexOf(mId) !== i) problemas.push({ nex, onde: 'Mochila', texto: `${b?.nome ?? it.id}: ${m.nome} duas vezes.`, severidade: 'erro' });
      for (const x of m.incompativel ?? []) if (mods.includes(x) && mods.indexOf(x) > i) problemas.push({ nex, onde: 'Mochila', texto: `${b?.nome ?? it.id}: ${m.nome} não combina com ${cat.modificacao(x)?.nome ?? x}.`, severidade: 'erro' });
    }
  }
  // mãos: no máximo dois itens empunhados; a arma de duas mãos ocupa as duas (LR p. 53)
  const naMao = maosOcupadas(f.inventario);
  if (naMao > MAOS) problemas.push({ nex, onde: 'Mochila', texto: `Mãos: ${naMao} ocupadas, o máximo é ${MAOS} (LR p. 53).`, severidade: 'erro' });
  // vestimentas: só duas dão bônus ao mesmo tempo (LR p. 63)
  let maxVest = 2;
  for (const x of doTipo('vestimentas')) maxVest += x.efeito.valor;
  const vestidas = f.inventario.filter((it) => it.tipo === 'equipamento' && cat.equipamento(it.id)?.grupo === 'vestimenta' && lugarDoItem(it) === 'vestido').length;
  if (vestidas > maxVest) problemas.push({ nex, onde: 'Mochila', texto: `${vestidas} vestimentas: só ${maxVest} dão bônus ao mesmo tempo (LR p. 63).`, severidade: 'aviso' });
  // o preço das maldições: falhar num teste do atributo do elemento custa 2 de Sanidade por
  // maldição dele nos itens, somando; o item especial conta como uma (LR p. 145, 148)
  const maldicoesPor = new Map<Elemento, number>();
  for (const it of f.inventario) {
    const els: Elemento[] = [];
    if (it.tipo === 'amaldicoado') {
      const a = cat.amaldicoado(it.id);
      if (a) els.push(a.elemento);
    }
    for (const mId of it.maldicoes ?? []) {
      const m = cat.maldicao(mId);
      if (m) els.push(m.elemento);
    }
    for (const el of els) if (el !== 'medo') maldicoesPor.set(el, (maldicoesPor.get(el) ?? 0) + 1);
  }
  for (const [el, n] of maldicoesPor) {
    const atrs = PRECO_MALDICAO.atributos[el as Exclude<Elemento, 'medo'>].map((a) => NOME_ATRIBUTO[a]).join(' ou ');
    const vezes = n > 1 ? ` (${n} maldições de ${el})` : '';
    condicionais.push({ origem: `Preço de ${el}`, texto: `falhar num teste de ${atrs} custa ${PRECO_MALDICAO.san * n} de Sanidade${vezes} (item amaldiçoado, LR p. 145)` });
  }

  // limites por patente
  const patenteAtual = nex === 0 ? null : patentePorPP(f.pp);
  const base = nex === 0 ? ITENS_NEX_ZERO : patenteAtual!.itens;
  const limites: Record<1 | 2 | 3 | 4, number> = { 1: base[1], 2: base[2], 3: base[3], 4: base[4] };
  for (const x of doTipo('itens')) if (x.efeito.categoria >= 1) limites[x.efeito.categoria as 1 | 2 | 3 | 4] += x.efeito.valor;
  // treinado em Profissão: um item a mais por missão, de categoria I, II ou III pelo grau (LR p. 48)
  const gProf = st.graus.profissao;
  if (nex > 0 && gProf !== 'destreinado') limites[gProf === 'treinado' ? 1 : gProf === 'veterano' ? 2 : 3] += 1;
  const usadosCat: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const it of f.inventario) {
    const b = baseDoItem(it);
    // o achado na missão não foi fornecido pela Ordem: não ocupa vaga da patente (LR p. 53)
    if (!b || it.achado) continue;
    const c = categoriaDoItem(it, it.tipo === 'arma' && it.id === favorita ? reducaoFavorita : 0);
    if (c > 4) problemas.push({ nex, onde: 'Mochila', texto: `${b.nome}: categoria acima de IV.`, severidade: 'erro' });
    else if (c >= 1) usadosCat[c as 1 | 2 | 3 | 4] += it.qtd ?? 1;
  }
  const itens: LimiteItens[] = ([1, 2, 3, 4] as const).map((k) => ({ categoria: k, usados: usadosCat[k], limite: limites[k] }));
  for (const l of itens) if (l.usados > l.limite) problemas.push({ nex, onde: 'Mochila', texto: `Itens de categoria ${'I'.repeat(l.categoria).replace('IIII', 'IV')}: ${l.usados} de ${l.limite}.`, severidade: 'erro' });
  if (nex > 0) {
    const temAmaldicoado = f.inventario.some((it) => !it.achado && (it.tipo === 'amaldicoado' || (it.maldicoes ?? []).length));
    if (temAmaldicoado && f.pp < 50) problemas.push({ nex, onde: 'Mochila', texto: 'Itens amaldiçoados só a partir de agente especial (50 PP).', severidade: 'aviso' });
  }

  // ---------- Defesa e deslocamento ----------
  let defesa = 10 + atr.agi + protDef + escudoDef;
  for (const x of doTipo('defesa')) defesa += valor(x.efeito.valor, atr);
  if (sobrecarregado) defesa -= 5;
  defesa += f.ajustes?.defesa ?? 0;
  let deslocamento = 9;
  for (const x of doTipo('deslocamento')) deslocamento += x.efeito.valor;
  if (sobrecarregado) deslocamento -= 3;

  // ---------- perícias ----------
  const pericias = {} as Record<PericiaId, PericiaCalculada>;
  // bônus de itens nas perícias: os de um mesmo item somam (o item, as modificações e as
  // maldições dele); entre itens, vale o maior em cada perícia (LR p. 63, 144, 312–313)
  const porItem = new Map<string, Partial<Record<PericiaId, number>>>();
  const somarItem = (chave: string, p: PericiaId, v: number) => {
    const m = porItem.get(chave) ?? {};
    m[p] = (m[p] ?? 0) + v;
    porItem.set(chave, m);
  };
  for (const [i, it] of f.inventario.entries()) {
    if (it.tipo !== 'equipamento') continue;
    // guardado (nem vestido nem empunhado): não ajuda (LR p. 63)
    if (it.vestido === false && !it.empunhado) continue;
    const eq = cat.equipamento(it.id);
    if (eq?.exigeTreino && st.graus[eq.exigeTreino] === 'destreinado') continue;
    // o bônus do item mais o das modificações dele (Aprimorado: +2 → +5)
    const doItem: Partial<Record<PericiaId, number>> = {};
    for (const e of eq?.efeitos ?? []) {
      if (e.alvo !== 'pericia' || e.condicional || e.pericia === 'todas') continue;
      // a perícia escolhida ao requisitar (utensílio, vestimenta); sem ela, ainda não ajuda
      const p = e.pericia === 'escolhida' ? it.escolha?.pericia : e.pericia;
      if (p) doItem[p] = (doItem[p] ?? 0) + valor(e.valor, atr);
    }
    const principal = Object.keys(doItem)[0] as PericiaId | undefined;
    for (const m of it.modificacoes ?? [])
      for (const e of cat.modificacao(m)?.efeitos ?? []) {
        if (e.alvo !== 'pericia' || e.condicional || e.pericia === 'todas') continue;
        const alvo = e.pericia === 'escolhida' ? principal : e.pericia;
        if (alvo) doItem[alvo] = (doItem[alvo] ?? 0) + valor(e.valor, atr);
      }
    for (const [p, v] of Object.entries(doItem) as [PericiaId, number][]) somarItem(`mochila:${i}`, p, v);
  }
  // os itens amaldiçoados e as maldições (Sombria) entram na conta do item em que estão
  for (const x of doTipo('pericia')) {
    if (!deItem(x) || !x.efeito.valor) continue;
    const alvos = x.efeito.pericia === 'todas' ? cat.CATALOGO.pericias.map((p) => p.id) : x.efeito.pericia === 'escolhida' ? (x.origem.escolha?.pericias ?? []) : [x.efeito.pericia];
    for (const p of alvos) somarItem(x.origem.id, p, valor(x.efeito.valor, atr));
  }
  const deItens: Partial<Record<PericiaId, number>> = {};
  for (const m of porItem.values()) for (const [p, v] of Object.entries(m) as [PericiaId, number][]) deItens[p] = Math.max(deItens[p] ?? 0, v);
  // "+N em testes de resistência" vale em Fortitude, Reflexos e Vontade (Precognição, LR p. 114)
  let resistBonus = 0;
  let resistDados = 0;
  for (const x of doTipo('resistenciaTeste')) {
    resistBonus += valor(x.efeito.valor, atr);
    resistDados += x.efeito.dados ?? 0;
  }
  const RESISTENCIAS: PericiaId[] = ['fortitude', 'reflexos', 'vontade'];
  for (const p of cat.CATALOGO.pericias) {
    const grau = st.graus[p.id];
    let atributo = p.atributo;
    for (const x of doTipo('atributoPericia')) if (x.efeito.pericia === p.id && atr[x.efeito.atributo] > atr[atributo]) atributo = x.efeito.atributo;
    let bonus = BONUS_GRAU[grau] + (st.bonusTreino[p.id] ?? 0) + (deItens[p.id] ?? 0);
    // dados ganhos e perdidos ficam separados: a conta de "menos de 1 dado" usa os dois (LR p. 11)
    let ganhos = 0;
    let perdidos = 0;
    const somaDados = (d: number) => (d > 0 ? (ganhos += d) : (perdidos += d));
    for (const x of doTipo('pericia')) {
      const alvo = x.efeito.pericia === 'escolhida' ? x.origem.escolha?.pericias ?? [] : [x.efeito.pericia];
      if (alvo.includes(p.id) || x.efeito.pericia === 'todas') {
        if (!deItem(x)) bonus += valor(x.efeito.valor, atr);
        somaDados(x.efeito.dados ?? 0);
      }
    }
    if (RESISTENCIAS.includes(p.id)) {
      bonus += resistBonus;
      somaDados(resistDados);
    }
    // proteção sem proficiência: −2d20 nos testes de Força e Agilidade (LR p. 62)
    if (atributo === 'for' || atributo === 'agi') somaDados(penalidadeProtecao);
    // Sombria: Furtividade ignora a penalidade de carga (LR p. 147)
    const sombria = p.id === 'furtividade' && f.inventario.some((it) => it.tipo === 'protecao' && it.vestido !== false && it.maldicoes?.includes('sombria'));
    if (p.carga && !sombria) {
      if (sobrecarregado) bonus += PENALIDADE_CARGA;
      if (pesada) bonus += PENALIDADE_CARGA;
    }
    pericias[p.id] = { grau, atributo, dados: atr[atributo] + ganhos, penalidadeDados: perdidos, bonus, somenteTreinada: p.somenteTreinada, podeUsar: !p.somenteTreinada || grau !== 'destreinado' };
  }

  // ---------- DTs, resistências, reações ----------
  const dtHabilidades = {} as Record<AtributoId, number>;
  for (const a of ATRIBUTOS) dtHabilidades[a] = 10 + limitePe + atr[a];
  let dtRituais = 10 + limitePe + atr.pre;
  for (const x of doTipo('dtRituais')) if (!x.efeito.elemento) dtRituais += x.efeito.valor;

  // RD: "físico" vale nos quatro tipos das armas e "paranormal" nos cinco elementos (LR p. 82).
  // Fontes diferentes somam; itens diferentes não: vale a maior RD de item em cada tipo (LR p. 312–313)
  const resistencias: Partial<Record<TipoDano, number>> = {};
  for (const x of doTipo('resistencia')) {
    const dano = x.efeito.dano === 'escolhido' ? x.origem.escolha?.elemento ?? x.origem.elemento : x.efeito.dano;
    if (!dano) continue;
    const v = valor(x.efeito.valor, atr);
    for (const t of tiposDoDano(dano)) {
      if (deItem(x)) somarRd(x.origem.id, t, v);
      else resistencias[t] = (resistencias[t] ?? 0) + v;
    }
  }
  const rdDeItens: Partial<Record<TipoDano, number>> = {};
  for (const rd of rdItens.values()) for (const [t, v] of Object.entries(rd) as [TipoDano, number][]) rdDeItens[t] = Math.max(rdDeItens[t] ?? 0, v);
  for (const [t, v] of Object.entries(rdDeItens) as [TipoDano, number][]) resistencias[t] = (resistencias[t] ?? 0) + v;

  const treinada = (p: PericiaId) => st.graus[p] !== 'destreinado';
  // a esquiva e o bloqueio usam o bônus da perícia; o "+N em testes de resistência" vale só no teste (LR p. 88, 114)
  const reacoes = {
    esquiva: treinada('reflexos') ? defesa + pericias.reflexos.bonus - resistBonus : null,
    bloqueio: treinada('fortitude') ? pericias.fortitude.bonus - resistBonus : null,
    contraAtaque: treinada('luta'),
  };

  // ---------- ataques ----------
  const ataques: Ataque[] = [];
  // o ataque desarmado está sempre lá (LR p. 57), com a soqueira se estiver na mão
  const armas: ItemFicha[] = f.inventario.filter((it) => it.tipo === 'arma');
  if (!armas.some((it) => it.id === 'ataque-desarmado')) armas.push({ id: 'ataque-desarmado', tipo: 'arma' });
  for (const it of armas) {
    const a = cat.arma(it.id);
    if (!a) continue;
    const corpo = a.tipo === 'corpoACorpo';
    const per: PericiaId = corpo ? 'luta' : 'pontaria';
    let atrAtaque: AtributoId = corpo ? 'for' : 'agi';
    if (a.agil && atr.agi > atr[atrAtaque]) atrAtaque = 'agi';
    let bonus = pericias[per].bonus;
    let dadosExtra = 0;
    // efeitos das modificações desta arma valem só nela (escopo 'todos' = esta arma)
    const daArma = (it.modificacoes ?? []).flatMap((m) => cat.modificacao(m)?.efeitos ?? []).filter((e) => !e.condicional);
    const deArma = <A extends Efeito['alvo']>(alvo: A) => [...doTipo(alvo).filter((x) => vale((x.efeito as { escopo: Escopo }).escopo, a, favorita)).map((x) => x.efeito), ...daArma.filter((e) => e.alvo === alvo)] as Extract<Efeito, { alvo: A }>[];
    const notas: string[] = [];
    let penalidade = 0;
    for (const e of deArma('ataque')) {
      bonus += valor(e.valor, atr);
      // dados ganhos e perdidos separados (LR p. 11)
      if ((e.dados ?? 0) > 0) dadosExtra += e.dados!;
      else penalidade += e.dados ?? 0;
    }
    if (!proficiente(a, st.proficiencias)) {
      penalidade -= 2;
      notas.push('sem proficiência: −2d20');
    }
    if (a.penalidadeAtaque) {
      penalidade += a.penalidadeAtaque;
      notas.push(`${a.nome.toLowerCase()}: ${a.penalidadeAtaque}d20${a.id === 'pistola-pesada' ? ' (com as duas mãos, sem a penalidade)' : ''}`);
    }
    // o ataque é teste de Força ou Agilidade: a proteção sem proficiência pesa (LR p. 62)
    if (penalidadeProtecao) {
      penalidade += penalidadeProtecao;
      notas.push(`${semProficiencia.join(' e ')} sem proficiência: −2d20`);
    }
    if (a.bonusAtaque) {
      bonus += a.bonusAtaque;
      notas.push(`${a.nome.toLowerCase()}: ${a.bonusAtaque} no ataque`);
    }
    if (a.forcaMinima && atr.for < a.forcaMinima.forca) {
      bonus += a.forcaMinima.bonus;
      notas.push(`Força abaixo de ${a.forcaMinima.forca}: ${a.forcaMinima.bonus} (${a.forcaMinima.nota})`);
    }
    let danoFixo = 0;
    // corpo a corpo e arremesso somam a Força; disparo e fogo não, fora o arco composto e o estilingue (LR p. 54, 58; SaH p. 37)
    if (corpo || a.tipo === 'arremesso' || a.somaForca) danoFixo += a.agil && atrAtaque === 'agi' ? atr.agi : atr.for;
    let dadosDano = 0;
    for (const e of deArma('dano')) {
      danoFixo += valor(e.valor, atr);
      dadosDano += e.dadoExtra ?? 0;
    }
    let margem = a.critico.margem;
    // Predadora: a margem de ameaça duplica antes de qualquer aumento (LR p. 146): 19 → 17
    if (it.maldicoes?.includes('predadora')) margem = 21 - 2 * (21 - margem);
    for (const mId of it.maldicoes ?? []) for (const e of cat.maldicao(mId)?.efeitos ?? []) if (e.alvo === 'nota') notas.push(e.texto.replace(/^arma: /, ''));
    let mult = a.critico.multiplicador;
    for (const e of deArma('margem')) margem -= e.valor;
    for (const e of deArma('multiplicador')) mult += e.valor;
    ataques.push({
      item: a.id,
      nome: it.apelido ?? a.nome,
      pericia: per,
      dados: atr[atrAtaque] + dadosExtra,
      bonus,
      penalidadeDados: penalidade,
      dano: somarDados(a.dano, dadosDano) + (danoFixo ? (danoFixo > 0 ? `+${danoFixo}` : `${danoFixo}`) : ''),
      critico: { margem: Math.max(2, margem), multiplicador: mult },
      alcance: a.alcance,
      tipoDano: a.tipoDano,
      notas,
      naMao: it.id === 'ataque-desarmado' || lugarDoItem(it) === 'mao',
      uid: it.uid,
    });
  }

  // rituais por Aprender Ritual: no máximo o Intelecto (LR p. 119)
  const porPoder = st.rituais.filter((r) => r.via === 'poder').length;
  if (porPoder > atr.int) problemas.push({ nex, onde: 'Rituais', texto: `Aprender Ritual: ${porPoder} rituais, o limite é o Intelecto (${atr.int}).`, severidade: 'erro' });

  if (pv < 1) problemas.push({ nex, onde: 'PV', texto: 'PV máximo abaixo de 1.', severidade: 'erro' });

  // custo em PE de cada ritual (1, 3, 6 e 10 pelo círculo, LR p. 119) e a DT, com os poderes que mudam
  const custoRituais: Calculado['custoRituais'] = {};
  for (const r of st.rituais) {
    const rit = cat.ritual(r.id);
    if (!rit) continue;
    const base = CUSTO_CIRCULO[rit.circulo];
    let ajuste = 0;
    let dt = dtRituais;
    for (const x of doTipo('custoRitual')) {
      const el = x.efeito.elemento === 'escolhido' ? x.origem.escolha?.elemento : x.efeito.elemento;
      if (!x.efeito.elemento || el === rit.elemento) ajuste += x.efeito.valor;
    }
    for (const x of doTipo('dtRituais')) {
      if (!x.efeito.elemento) continue;
      const el = x.efeito.elemento === 'escolhido' ? x.origem.escolha?.elemento : x.efeito.elemento;
      if (el === rit.elemento) dt += x.efeito.valor;
    }
    // o mínimo de 1 PE vale para o custo final, já com a forma avançada (LR p. 78, 121)
    custoRituais[r.id] = { pe: Math.max(1, base + ajuste), dt, base, ajuste };
  }

  return {
    nex,
    patamar: pat,
    classe: st.classe,
    patente: patenteAtual ? { id: patenteAtual.id, nome: patenteAtual.nome, credito: creditoCom(patenteAtual.credito, doTipo('credito').reduce((s, x) => s + x.efeito.valor, 0)) } : null,
    atributos: atr,
    pv: Math.max(1, pv),
    pe: Math.max(0, pe),
    san: Math.max(0, san),
    limitePe,
    limitePeRituais,
    defesa,
    protecao: protDef + escudoDef,
    deslocamento: Math.max(0, deslocamento),
    carga: { espacos, usados, maximo: espacos * 2, sobrecarregado },
    pericias,
    dtHabilidades,
    dtRituais,
    resistencias,
    reacoes,
    proficiencias: [...st.proficiencias],
    poderes: st.poderes,
    rituais: st.rituais,
    rituaisPorPoder: { usados: porPoder, limite: atr.int },
    custoRituais,
    itens,
    ataques,
    condicionais,
    pendencias,
    problemas,
  };
}

/** Custo em PE da forma básica de um ritual, pelo círculo (LR p. 119). */
const CUSTO_CIRCULO: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 3, 3: 6, 4: 10 };

/** Nível de crédito da patente subido (ou descido) por poderes (Magnata). */
function creditoCom(base: string, passos: number): string {
  const i = CREDITOS.indexOf(base as (typeof CREDITOS)[number]);
  if (i < 0 || !passos) return base;
  return CREDITOS[Math.max(0, Math.min(CREDITOS.length - 1, i + passos))];
}

/** A que tipo de modificação o item aceita (LR p. 60). */
export function alvoModificacao(it: ItemFicha): AlvoModificacao | null {
  if (it.tipo === 'protecao') return 'protecao';
  if (it.tipo === 'arma') {
    const a = cat.arma(it.id);
    if (!a) return null;
    return a.tipo === 'fogo' ? 'armaFogo' : a.tipo === 'corpoACorpo' ? 'armaCorpoACorpo' : 'armaDisparo';
  }
  if (it.tipo === 'equipamento') {
    const e = cat.equipamento(it.id);
    if (e?.grupo === 'municao') return 'municao';
    if (e && ['acessorio', 'utensilio', 'vestimenta', 'kit'].includes(e.grupo)) return 'acessorio';
    // a soqueira aceita modificações de armas corpo a corpo (LR p. 66)
    if (it.id === 'soqueira') return 'armaCorpoACorpo';
  }
  return null;
}

/** Espaço do item com as modificações ("espaços −1" / "espaços +1" em `especial`). */
function espacosDoItem(it: ItemFicha, base: number): number {
  let e = base;
  for (const m of it.modificacoes ?? [])
    for (const tag of cat.modificacao(m)?.especial ?? []) {
      const r = tag.match(/^espaços ([+−-])(\d+)$/);
      if (r) e += (r[1] === '+' ? 1 : -1) * Number(r[2]);
    }
  return Math.max(0, e);
}

/** "1d8" + 1 dado = "2d8". */
function somarDados(dano: string, extra: number): string {
  if (!extra) return dano;
  const m = dano.match(/^(\d+)d(\d+)(.*)$/);
  return m ? `${Number(m[1]) + extra}d${m[2]}${m[3]}` : dano;
}

/** Texto curto de um efeito (para os avisos). */
export function textoEfeito(e: Efeito): string {
  const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const v = (x: Valor | undefined) => (x === undefined ? '' : typeof x === 'number' ? sinal(x) : `+${NOME_ATRIBUTO[x]}`);
  switch (e.alvo) {
    case 'pv':
    case 'pe':
      return [e.alvo.toUpperCase(), e.fixo ? sinal(e.fixo) : '', e.porNex ? `${sinal(e.porNex)} por NEX` : '', e.atributoEscolhido ? '+ o atributo escolhido' : ''].filter(Boolean).join(' ');
    case 'defesa':
      return `Defesa ${v(e.valor)}`;
    case 'deslocamento':
      return `deslocamento ${sinal(e.valor)} m`;
    case 'espacos':
      return `carga ${v(e.valor)} espaços`;
    case 'pericia':
      return `${e.pericia === 'todas' ? 'testes de perícia' : e.pericia === 'escolhida' ? 'perícia escolhida' : cat.pericia(e.pericia).nome} ${v(e.valor)}${e.dados ? ` ${sinal(e.dados)}d20` : ''}`.replace(/\s+/g, ' ').trim();
    case 'resistenciaTeste':
      return `testes de resistência ${v(e.valor)}${e.dados ? ` ${sinal(e.dados)}d20` : ''}`.replace(/\s+/g, ' ').trim();
    case 'resistencia':
      return `resistência a ${e.dano} ${v(e.valor)}`;
    case 'ataque':
      return `ataque ${v(e.valor)}${e.dados ? ` ${sinal(e.dados)}d20` : ''}`.replace(/\s+/g, ' ').trim();
    case 'dano':
      return `dano ${v(e.valor)}${e.dadoExtra ? ` +${e.dadoExtra} dado` : ''}`;
    case 'margem':
      return `margem de ameaça +${e.valor}`;
    case 'multiplicador':
      return `multiplicador de crítico +${e.valor}`;
    case 'nota':
      return e.texto;
    default:
      return e.alvo;
  }
}
