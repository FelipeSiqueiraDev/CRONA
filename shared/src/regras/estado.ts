/**
 * Monta o estado de uma ficha NEX a NEX: aplica as escolhas de cada patamar
 * na ordem, confere cada uma com as regras no NEX em que foi feita e junta o
 * que falta escolher (pendências) e o que está errado (problemas).
 *
 * Dentro de um mesmo NEX, primeiro entram o aumento de atributo e o grau de
 * treinamento; depois os poderes. Assim um poder pode ser escolhido no mesmo
 * NEX em que o pré-requisito é cumprido (LR p. 22).
 */
import * as cat from './dados';
import type { EscolhaPoder, Ficha, ValorEscolha } from './ficha';
import { ganhosDoNex, nexAte, type Ganho } from './nex';
import { atende, NOME_ATRIBUTO, type Contexto } from './requisitos';
import type {
  AtributoId,
  ClasseId,
  Efeito,
  Elemento,
  ElementoAfinidade,
  Grau,
  Habilidade,
  Nex,
  PericiaId,
  Proficiencia,
  Requisito,
} from './tipos';
import { ATRIBUTOS, GRAUS } from './tipos';

export type Severidade = 'erro' | 'aviso';

/** Algo errado ou a conferir numa escolha. */
export interface Problema {
  nex: Nex;
  onde: string;
  texto: string;
  severidade: Severidade;
}

export type TipoPendencia =
  | 'atributos'
  | 'origem'
  | 'classe'
  | 'pericias'
  | 'trilha'
  | 'poder'
  | 'paranormal'
  | 'atributo'
  | 'periciaIntelecto'
  | 'grau'
  | 'versatilidade'
  | 'afinidade'
  | 'ritual'
  | 'parametro';

/** Uma escolha que ainda falta. */
export interface Pendencia {
  nex: Nex;
  tipo: TipoPendencia;
  texto: string;
  /** id da habilidade, quando é o parâmetro de uma habilidade */
  alvo?: string;
}

export type OrigemPoder = 'classe' | 'paranormal' | 'trilha' | 'origem' | 'habilidade';

/** Poder ou habilidade que a ficha tem. */
export interface PoderObtido {
  id: string;
  nome: string;
  tipo: OrigemPoder;
  nex: Nex;
  escolha?: ValorEscolha;
  elemento?: Elemento;
  efeitos: Efeito[];
  /** como veio (versatilidade, transcender...) */
  via?: string;
}

export interface RitualObtido {
  id: string;
  nex: Nex;
  via: 'classe' | 'poder' | 'trilha';
}

export interface Estado {
  nex: Nex;
  classe: ClasseId;
  atributos: Record<AtributoId, number>;
  /**
   * os atributos como estavam ao fim de cada NEX (19/10, regra da mesa do Felipe: o aumento de atributo só conta dali
   * para a frente; os PV e PE de cada NEX usam o Vigor e a Presença daquele NEX)
   */
  atributosNoNex: Partial<Record<Nex, Record<AtributoId, number>>>;
  graus: Record<PericiaId, Grau>;
  /** bônus de perícia por treino repetido ("se já for treinado, +2") */
  bonusTreino: Partial<Record<PericiaId, number>>;
  /** elemento escolhido numa habilidade da trilha (Monstruoso: Ser Amaldiçoado) */
  elementoTrilha: Elemento | null;
  poderes: PoderObtido[];
  rituais: RitualObtido[];
  afinidade: ElementoAfinidade | null;
  afinidadeAtiva: boolean;
  /** NEX em que usou Transcender (não ganha SAN nesses) */
  transcender: Nex[];
  proficiencias: Set<Proficiencia>;
  pendencias: Pendencia[];
  problemas: Problema[];
}

/** Uma escolha a deixar de fora da conferência (para listar as opções daquele lugar). */
export interface Exclusao {
  nex: Nex;
  lugar: 'poder' | 'versatilidade' | 'paranormal' | 'atributo' | 'grau' | 'ritual' | 'trilha' | 'origem' | 'classe' | 'afinidade';
}

const PERICIAS_IDS = cat.CATALOGO.pericias.map((p) => p.id);
const grauIdx = (g: Grau) => GRAUS.indexOf(g);

/** Círculo máximo de ritual que a classe conjura neste NEX (0 = nenhum). */
export function circuloMaximo(classe: ClasseId, nex: Nex): 0 | 1 | 2 | 3 | 4 {
  const c = cat.classe(classe);
  if (c.rituais) {
    let max: 0 | 1 | 2 | 3 | 4 = 0;
    for (const k of [1, 2, 3, 4] as const) if (nex >= c.rituais.circulos[k]) max = k;
    return max;
  }
  return circuloAprenderRitual(nex);
}

/**
 * Quem não é ocultista e aprende rituais pelo poder Aprender Ritual: 1º círculo
 * sempre, 2º a partir de NEX 45% e 3º a partir de 75%; nunca o 4º (LR p. 114).
 */
export function circuloAprenderRitual(nex: Nex): 0 | 1 | 2 | 3 {
  if (nex >= 75) return 3;
  if (nex >= 45) return 2;
  return 1;
}

function vazio(nex: Nex): Estado {
  const graus = {} as Record<PericiaId, Grau>;
  for (const p of PERICIAS_IDS) graus[p] = 'destreinado';
  return {
    nex,
    classe: 'mundano',
    atributos: { agi: 1, for: 1, int: 1, pre: 1, vig: 1 },
    atributosNoNex: {},
    graus,
    bonusTreino: {},
    elementoTrilha: null,
    poderes: [],
    rituais: [],
    afinidade: null,
    afinidadeAtiva: false,
    transcender: [],
    proficiencias: new Set(),
    pendencias: [],
    problemas: [],
  };
}

/** Ordem de aplicação dentro de um NEX. */
const ORDEM: Ganho['tipo'][] = ['pessoaComum', 'criacao', 'treinamento', 'atributo', 'grau', 'trilha', 'habilidadeTrilha', 'afinidade', 'poder', 'versatilidade', 'ritual'];

/**
 * Estado da ficha até o NEX `ate` (padrão: o NEX da ficha). `excluir` deixa
 * uma escolha de fora (para listar as opções daquele lugar sem ela contar).
 */
export function montarEstado(f: Ficha, ate: Nex = f.nex, excluir?: Exclusao): Estado {
  const inicio: Nex = f.comecouMundano ? 0 : 5;
  const st = vazio(ate);
  const erro = (nex: Nex, onde: string, texto: string) => st.problemas.push({ nex, onde, texto, severidade: 'erro' });
  const aviso = (nex: Nex, onde: string, texto: string) => st.problemas.push({ nex, onde, texto, severidade: 'aviso' });
  const falta = (nex: Nex, tipo: TipoPendencia, texto: string, alvo?: string) => st.pendencias.push({ nex, tipo, texto, alvo });
  const fora = (nex: Nex, lugar: Exclusao['lugar']) => excluir?.nex === nex && excluir.lugar === lugar;

  const origemCat = f.origem ? cat.origem(f.origem) : undefined;
  const classeAgente = f.classe ? cat.classe(f.classe) : undefined;

  // ---------- ajudantes ----------
  const subirGrau = (p: PericiaId, nex: Nex, onde: string): boolean => {
    const g = st.graus[p];
    const alvo = GRAUS[grauIdx(g) + 1];
    if (!alvo) {
      erro(nex, onde, `${cat.pericia(p).nome} já é expert.`);
      return false;
    }
    if (alvo === 'veterano' && nex < 35) {
      erro(nex, onde, `${cat.pericia(p).nome}: veterano só a partir de NEX 35%.`);
      return false;
    }
    if (alvo === 'expert' && nex < 70) {
      erro(nex, onde, `${cat.pericia(p).nome}: expert só a partir de NEX 70%.`);
      return false;
    }
    st.graus[p] = alvo;
    return true;
  };

  const treinar = (p: PericiaId, nex: Nex, onde: string) => {
    if (st.graus[p] !== 'destreinado') {
      erro(nex, onde, `${cat.pericia(p).nome} já é treinada: escolha outra.`);
      return;
    }
    st.graus[p] = 'treinado';
  };

  /** Aplica os efeitos que mudam o estado (treino, atributo, proficiência). Os números ficam para calcular(). */
  const aplicarEfeitos = (efeitos: Efeito[] | undefined, nex: Nex, escolha: ValorEscolha | undefined, onde: string) => {
    for (const e of efeitos ?? []) {
      if (e.condicional) continue;
      if (e.soElemento && e.soElemento !== (escolha?.elemento ?? st.elementoTrilha ?? st.afinidade)) continue;
      if (e.alvo === 'treino') {
        const lista: PericiaId[] = e.pericia === 'escolhida' ? (escolha?.pericias ?? []) : [e.pericia];
        if (e.pericia === 'escolhida' && !lista.length) continue;
        for (const p of lista) {
          const alvo = e.grau ?? 'treinado';
          if (grauIdx(st.graus[p]) < grauIdx(alvo)) st.graus[p] = alvo;
          else if (e.seJa) st.bonusTreino[p] = (st.bonusTreino[p] ?? 0) + e.seJa;
          else aviso(nex, onde, `${cat.pericia(p).nome} já era treinada.`);
        }
      } else if (e.alvo === 'atributo') st.atributos[e.atributo] += e.valor;
      else if (e.alvo === 'proficiencia') st.proficiencias.add(e.proficiencia);
    }
  };

  const ctx = (nex: Nex, escolha?: ValorEscolha, elemento?: Elemento, proprio?: string): Contexto => ({ estado: st, ficha: f, nex, escolha, elemento, proprio });

  const conferir = (reqs: Requisito[] | undefined, c: Contexto, onde: string): boolean => {
    let ok = true;
    for (const r of reqs ?? []) {
      const res = atende(r, c);
      if (!res.ok) {
        ok = false;
        for (const m of res.motivos) erro(c.nex, onde, m);
      } else for (const m of res.avisos) aviso(c.nex, onde, m);
    }
    return ok;
  };

  /** Confere a escolha pedida por uma habilidade (perícias, elemento...). */
  const conferirParametro = (h: { id: string; nome: string; escolha?: Habilidade['escolha'] }, v: ValorEscolha | undefined, nex: Nex, onde: string): boolean => {
    const es = h.escolha;
    if (!es) return true;
    if (!v) {
      falta(nex, 'parametro', `${h.nome}: ${textoEscolha(es)}.`, h.id);
      return false;
    }
    if (es.tipo === 'pericia') {
      const qtd = es.qtd ?? 1;
      const ps = v.pericias ?? [];
      if (ps.length !== qtd) {
        erro(nex, onde, `${h.nome}: escolha ${qtd} perícia${qtd > 1 ? 's' : ''}.`);
        return false;
      }
      if (new Set(ps).size !== ps.length) erro(nex, onde, `${h.nome}: perícias repetidas.`);
      for (const p of ps) {
        if (es.de && !es.de.includes(p)) erro(nex, onde, `${h.nome}: ${cat.pericia(p).nome} não é uma das opções.`);
        if (es.exceto?.includes(p)) erro(nex, onde, `${h.nome}: não vale ${cat.pericia(p).nome}.`);
        if (es.treinada && st.graus[p] === 'destreinado') erro(nex, onde, `${h.nome}: ${cat.pericia(p).nome} precisa ser treinada.`);
      }
    } else if (es.tipo === 'elemento') {
      if (!v.elemento) falta(nex, 'parametro', `${h.nome}: escolha o elemento.`, h.id);
      else if (es.de && !es.de.includes(v.elemento)) erro(nex, onde, `${h.nome}: elemento fora das opções.`);
    } else if (es.tipo === 'atributo') {
      if (!v.atributo) falta(nex, 'parametro', `${h.nome}: escolha o atributo.`, h.id);
    } else if (es.tipo === 'arma') {
      if (!v.arma) falta(nex, 'parametro', `${h.nome}: escolha a arma.`, h.id);
      else if (!cat.arma(v.arma)) erro(nex, onde, `${h.nome}: arma desconhecida.`);
    } else if (es.tipo === 'ritual') {
      const qtd = es.qtd ?? 1;
      const rs = v.rituais ?? [];
      if (rs.length !== qtd) falta(nex, 'parametro', `${h.nome}: escolha ${qtd} ritual${qtd > 1 ? 'is' : ''}.`, h.id);
      for (const id of rs) {
        const r = cat.ritual(id);
        if (!r) erro(nex, onde, `${h.nome}: ritual desconhecido.`);
        else if (es.circuloMax && r.circulo > es.circuloMax) erro(nex, onde, `${h.nome}: ${r.nome} é de ${r.circulo}º círculo.`);
        else if (es.elemento && r.elemento !== es.elemento) erro(nex, onde, `${h.nome}: ${r.nome} é de outro elemento.`);
      }
    } else if (es.tipo === 'texto') {
      if (!v.texto) falta(nex, 'parametro', `${h.nome}: ${es.rotulo}.`, h.id);
    }
    return true;
  };

  /** Recebe uma habilidade fixa (classe, trilha, origem). */
  const receberHabilidade = (h: Habilidade, tipo: OrigemPoder, nex: Nex, via?: string) => {
    const v = f.progressao[nex]?.parametros?.[h.id];
    if (tipo === 'trilha' && h.escolha?.tipo === 'elemento' && v?.elemento) st.elementoTrilha = v.elemento;
    st.poderes.push({ id: h.id, nome: h.nome, tipo, nex, escolha: v, efeitos: h.efeitos ?? [], via });
    // habilidade que dá um poder paranormal (Cultista Arrependido, NEX 5%)
    if (h.escolha?.tipo === 'poderParanormal') receberParanormal(v?.poder, v?.sub, nex, h.nome, h.id);
    else conferirParametro(h, v, nex, h.nome);
    aplicarEfeitos(h.efeitos, nex, v, h.nome);
    if (h.rituaisExtras) {
      extras.push(h);
      const qtd = typeof h.rituaisExtras.qtd === 'number' ? h.rituaisExtras.qtd : st.atributos[h.rituaisExtras.qtd];
      pedirRituais(h, nex, qtd, Math.min(h.rituaisExtras.circuloMax ?? 4, circuloMaximo(st.classe, nex)));
    }
    if (h.concedeRituais) {
      if (Array.isArray(h.concedeRituais)) for (const id of h.concedeRituais) st.rituais.push({ id, nex, via: tipo === 'trilha' ? 'trilha' : 'classe' });
      else {
        // rituais à escolha, guardados nos parâmetros da habilidade (Escolhido pelo Outro Lado: 3 de 1º círculo)
        const rs = v?.rituais ?? [];
        const es = h.concedeRituais.escolha;
        const qtd = es.tipo === 'ritual' ? (es.qtd ?? 1) : 1;
        if (rs.length < qtd) falta(nex, 'ritual', `${h.nome}: escolha ${qtd - rs.length} ritual${qtd - rs.length > 1 ? 'is' : ''}.`, h.id);
        if (rs.length > qtd) erro(nex, h.nome, `${h.nome}: são só ${qtd} rituais.`);
        for (const id of rs) aprenderRitual(id, nex, es.tipo === 'ritual' ? es.circuloMax : undefined, h.nome, tipo === 'trilha' ? 'trilha' : 'classe');
      }
    }
  };

  /** Habilidades com rituais a mais por círculo novo (Saber Ampliado, Grimório). */
  const extras: Habilidade[] = [];
  /**
   * Pede `qtd` rituais escolhidos nos parâmetros da habilidade, neste NEX. Com
   * `exato`, o ritual tem de ser desse círculo (o do círculo novo, LR p. 35).
   */
  const pedirRituais = (h: Habilidade, nex: Nex, qtd: number, circuloMax: number, exato?: number) => {
    const rs = f.progressao[nex]?.parametros?.[h.id]?.rituais ?? [];
    if (rs.length < qtd) falta(nex, 'ritual', `${h.nome}: escolha ${qtd - rs.length} ritual${qtd - rs.length > 1 ? 'is' : ''}.`, h.id);
    if (rs.length > qtd) erro(nex, h.nome, `${h.nome}: são ${qtd} rituais aqui.`);
    for (const id of rs) aprenderRitual(id, nex, circuloMax, h.nome, 'trilha', exato);
  };

  const aprenderRitual = (id: string, nex: Nex, circuloMax: number | undefined, onde: string, via: RitualObtido['via'], exato?: number) => {
    const r = cat.ritual(id);
    if (!r) {
      erro(nex, onde, `Ritual desconhecido: ${id}.`);
      return;
    }
    if (!cat.disponivel(r, f.regras)) erro(nex, onde, `${r.nome} é do Sobrevivendo ao Horror, que esta campanha não usa.`);
    const max = circuloMax ?? circuloMaximo(st.classe, nex);
    if (r.circulo > max) erro(nex, onde, `${r.nome} é de ${r.circulo}º círculo; em NEX ${nex}% só até o ${max}º.`);
    else if (exato && r.circulo !== exato) erro(nex, onde, `${r.nome} é de ${r.circulo}º círculo; o ritual do círculo novo tem de ser do ${exato}º (LR p. 35).`);
    if (r.concedidoPor && via !== 'trilha') erro(nex, onde, `${r.nome} só vem de ${r.concedidoPor}.`);
    if (st.rituais.some((x) => x.id === id)) erro(nex, onde, `${r.nome} já é conhecido.`);
    st.rituais.push({ id, nex, via });
  };

  /** Recebe um poder paranormal (Transcender, origem, Especialista Diletante...). */
  const receberParanormal = (id: string | undefined, sub: ValorEscolha | undefined, nex: Nex, onde: string, via: string) => {
    if (!id) {
      falta(nex, 'paranormal', `${onde}: escolha o poder paranormal.`);
      return;
    }
    const p = cat.paranormal(id);
    if (!p) {
      erro(nex, onde, `Poder paranormal desconhecido: ${id}.`);
      return;
    }
    if (!cat.disponivel(p, f.regras)) erro(nex, onde, `${p.nome} é do Sobrevivendo ao Horror, que esta campanha não usa.`);
    const elemento = elementoEfetivo(p, sub);
    // com elemento escolhido, "de novo" é o mesmo poder no mesmo elemento
    const vezes = st.poderes.filter((x) => x.id === id && x.tipo === 'paranormal' && (!p.elementoDaEscolha || x.elemento === elemento)).length;
    if (vezes >= 1 && !p.repetivel) {
      if (!p.afinidade) erro(nex, onde, `${p.nome} já foi escolhido.`);
      else if (vezes >= 2) erro(nex, onde, `${p.nome} já foi escolhido com afinidade.`);
      else if (!(st.afinidade === elemento && st.afinidadeAtiva)) erro(nex, onde, `${p.nome} só pode ser escolhido de novo com afinidade em ${elemento}.`);
    }
    conferir(p.requisitos, ctx(nex, sub, elemento, id), p.nome);
    conferirParametro({ id: p.id, nome: p.nome, escolha: p.escolha }, sub, nex, p.nome);
    st.poderes.push({ id, nome: p.nome, tipo: 'paranormal', nex, escolha: sub, elemento, efeitos: p.efeitos ?? [], via });
    aplicarEfeitos(p.efeitos, nex, sub, p.nome);
    // Aprender Ritual: o ritual escolhido entra nos conhecidos
    if (p.escolha?.tipo === 'ritual') for (const r of sub?.rituais ?? []) aprenderRitual(r, nex, circuloAprenderRitual(nex), p.nome, 'poder');
  };

  /** Recebe um poder de classe (ou geral) escolhido num NEX. */
  const receberPoder = (esc: EscolhaPoder | undefined, nex: Nex, onde: string, via?: string) => {
    if (!esc) {
      falta(nex, 'poder', `NEX ${nex}%: escolha um poder de ${cat.classe(st.classe).nome.toLowerCase()}.`);
      return;
    }
    const p = cat.poder(esc.id);
    if (!p) {
      erro(nex, onde, `Poder desconhecido: ${esc.id}.`);
      return;
    }
    if (!cat.disponivel(p, f.regras)) erro(nex, onde, `${p.nome} é do Sobrevivendo ao Horror, que esta campanha não usa.`);
    const daClasse = st.classe !== 'mundano' && p.classes.includes(st.classe);
    const geral = p.classes.includes('geral');
    if (!daClasse && !geral) erro(nex, onde, `${p.nome} não é poder de ${cat.classe(st.classe).nome.toLowerCase()}.`);
    if (!p.repetivel && st.poderes.some((x) => x.id === p.id)) erro(nex, onde, `${p.nome} já foi escolhido.`);
    conferir(p.requisitos, ctx(nex, esc.escolha, undefined, p.id), p.nome);
    if (p.escolha?.tipo === 'poderParanormal') {
      st.poderes.push({ id: p.id, nome: p.nome, tipo: 'classe', nex, escolha: esc.escolha, efeitos: p.efeitos ?? [], via });
      if (p.id === 'transcender') {
        st.transcender.push(nex);
        // a afinidade escolhida em NEX 50% se firma no primeiro Transcender depois dela (LR p. 114)
        if (st.afinidade && nex >= 50) st.afinidadeAtiva = true;
      }
      if (!fora(nex, 'paranormal')) receberParanormal(esc.escolha?.poder, esc.escolha?.sub, nex, p.nome, 'transcender');
      return;
    }
    if (p.escolha?.tipo === 'poderClasse') {
      // Especialista Diletante e afins: um poder de outra classe, cumprindo os pré-requisitos
      const alvo = esc.escolha?.poder ? cat.poder(esc.escolha.poder) : undefined;
      if (!alvo) falta(nex, 'parametro', `${p.nome}: escolha o poder.`, p.id);
      else {
        if (p.escolha.outraClasse && st.classe !== 'mundano' && alvo.classes.includes(st.classe)) erro(nex, onde, `${p.nome}: escolha um poder de outra classe.`);
        conferir(alvo.requisitos, ctx(nex, esc.escolha?.sub, undefined, alvo.id), alvo.nome);
        st.poderes.push({ id: alvo.id, nome: alvo.nome, tipo: 'classe', nex, escolha: esc.escolha?.sub, efeitos: alvo.efeitos ?? [], via: p.id });
        aplicarEfeitos(alvo.efeitos, nex, esc.escolha?.sub, alvo.nome);
      }
      st.poderes.push({ id: p.id, nome: p.nome, tipo: 'classe', nex, escolha: esc.escolha, efeitos: p.efeitos ?? [], via });
      return;
    }
    conferirParametro({ id: p.id, nome: p.nome, escolha: p.escolha }, esc.escolha, nex, p.nome);
    // Treinamento em Perícia: cada perícia escolhida sobe um grau (LR p. 26)
    if (p.id === 'treinamento-em-pericia') for (const per of esc.escolha?.pericias ?? []) subirGrau(per, nex, p.nome);
    st.poderes.push({ id: p.id, nome: p.nome, tipo: 'classe', nex, escolha: esc.escolha, efeitos: p.efeitos ?? [], via });
    aplicarEfeitos(p.efeitos, nex, esc.escolha, p.nome);
  };

  const conferirAtributosIniciais = (nex: Nex, pontos: number) => {
    const a = f.atributos;
    let zeros = 0;
    for (const k of ATRIBUTOS) {
      if (a[k] < 0 || a[k] > 3) erro(nex, 'Atributos', `${NOME_ATRIBUTO[k]} começa entre 0 e 3.`);
      if (a[k] === 0) zeros++;
    }
    if (zeros > 1) erro(nex, 'Atributos', 'Só um atributo pode ser reduzido a 0.');
    const gastos = ATRIBUTOS.reduce((s, k) => s + a[k] - 1, 0);
    if (gastos < pontos) falta(nex, 'atributos', `Distribua ${pontos - gastos} ponto${pontos - gastos > 1 ? 's' : ''} de atributo.`);
    if (gastos > pontos) erro(nex, 'Atributos', `São só ${pontos} pontos (${zeros ? 'com o ponto do atributo em 0' : 'mais 1 se reduzir um atributo a 0'}).`);
  };

  const aplicarOrigem = (nex: Nex) => {
    if (!origemCat) {
      if (f.origem) erro(nex, 'Origem', `Origem desconhecida: ${f.origem}.`);
      else if (!fora(nex, 'origem')) falta(nex, 'origem', 'Escolha a origem.');
      return;
    }
    if (!cat.disponivel(origemCat, f.regras)) erro(nex, 'Origem', `${origemCat.nome} é do Sobrevivendo ao Horror, que esta campanha não usa.`);
    const ps = Array.isArray(origemCat.pericias) ? origemCat.pericias : (f.pericias.origem ?? []);
    if (!Array.isArray(origemCat.pericias)) {
      const q = origemCat.pericias.escolha;
      if (ps.length !== q) falta(nex, 'pericias', `${origemCat.nome}: ${q} perícia${q > 1 ? 's' : ''} (${origemCat.pericias.texto ?? 'à escolha'}).`);
    }
    for (const p of ps) treinar(p, nex, `Origem ${origemCat.nome}`);
    receberHabilidade(origemCat.poder, 'origem', nex);
  };

  /** Perícias da classe: fixas, uma de cada grupo e as livres (classe + Intelecto). */
  const aplicarPericiasDaClasse = (nex: Nex, livresEsperadas: number) => {
    if (!classeAgente) return;
    // perícia fixa da classe que a origem já deu: escolhe outra no lugar (LR p. 22)
    let repetidas = 0;
    for (const p of classeAgente.pericias.fixas) {
      if (st.graus[p] !== 'destreinado') {
        repetidas++;
        aviso(nex, 'Perícias', `${cat.pericia(p).nome} vem da classe e da origem: escolha outra perícia no lugar (LR p. 22).`);
      } else st.graus[p] = 'treinado';
    }
    livresEsperadas += repetidas;
    const grupos = classeAgente.pericias.grupos;
    const escolhidas = f.pericias.grupos;
    grupos.forEach((g, i) => {
      const p = escolhidas.find((x) => g.includes(x));
      if (!p) falta(nex, 'pericias', `Escolha ${g.map((x) => cat.pericia(x).nome).join(' ou ')}.`);
      else treinar(p, nex, 'Perícias da classe');
      void i;
    });
    for (const p of escolhidas) if (!grupos.some((g) => g.includes(p))) erro(nex, 'Perícias', `${cat.pericia(p).nome} não é opção dos grupos da classe.`);
    aplicarLivres(nex, livresEsperadas);
  };

  const aplicarLivres = (nex: Nex, esperadas: number) => {
    const livres = f.pericias.livres;
    for (const p of livres) treinar(p, nex, 'Perícias à escolha');
    if (livres.length < esperadas) falta(nex, 'pericias', `Escolha mais ${esperadas - livres.length} perícia${esperadas - livres.length > 1 ? 's' : ''} treinada${esperadas - livres.length > 1 ? 's' : ''}.`);
    if (livres.length > esperadas) erro(nex, 'Perícias', `São ${esperadas} perícias à escolha (${livres.length} marcadas).`);
  };

  const receberClasse = (nex: Nex) => {
    if (!classeAgente) {
      if (!fora(nex, 'classe')) falta(nex, 'classe', 'Escolha a classe.');
      return;
    }
    st.classe = classeAgente.id;
    for (const pr of classeAgente.proficiencias) st.proficiencias.add(pr);
    for (const h of classeAgente.habilidades) if ((h.nex ?? 5) <= nex) receberHabilidade(h, 'habilidade', nex);
  };

  // ---------- NEX a NEX ----------
  let circuloAntes = 0;
  let nexAnterior: Nex | null = null;
  for (const nex of nexAte(ate, inicio)) {
    if (nexAnterior !== null) st.atributosNoNex[nexAnterior] = { ...st.atributos };
    nexAnterior = nex;
    st.nex = nex;
    const circuloAgora = f.classe ? circuloMaximo(f.classe, nex) : 0;
    if (circuloAgora > circuloAntes && circuloAntes > 0)
      for (const h of extras) if (h.rituaisExtras?.porCirculoNovo) pedirRituais(h, nex, 1, circuloAgora, circuloAgora);
    circuloAntes = circuloAgora;
    const e = f.progressao[nex] ?? {};
    const ganhos = ganhosDoNex(f.classe, nex, f.comecouMundano).sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo));
    // habilidades fixas da classe que chegam depois do 5% (Engenhosidade)
    if (nex > 5 && classeAgente) for (const h of classeAgente.habilidades) if (h.nex === nex) receberHabilidade(h, 'habilidade', nex);

    for (const g of ganhos) {
      switch (g.tipo) {
        case 'pessoaComum': {
          conferirAtributosIniciais(nex, 3);
          const m = cat.classe('mundano');
          for (const pr of m.proficiencias) st.proficiencias.add(pr);
          st.atributos = { ...f.atributos };
          aplicarOrigem(nex);
          // as livres da pessoa comum (1 + Int); as da classe entram no treinamento
          if (!f.classe) aplicarLivres(nex, m.pericias.livres + f.atributos.int);
          for (const h of m.habilidades) receberHabilidade(h, 'habilidade', nex);
          break;
        }
        case 'criacao': {
          conferirAtributosIniciais(nex, 4);
          st.atributos = { ...f.atributos };
          aplicarOrigem(nex);
          // as perícias da classe antes das habilidades: o Perito escolhe entre as treinadas, as livres também (LR p. 28)
          if (classeAgente) aplicarPericiasDaClasse(nex, classeAgente.pericias.livres + f.atributos.int);
          receberClasse(nex);
          break;
        }
        case 'treinamento': {
          // pessoa comum que vira agente: +1 ponto de atributo (sem passar de 3)
          const a = e.atributoTreino;
          if (!a) falta(nex, 'atributo', 'Treinamento na Ordem: +1 ponto de atributo (até 3).');
          else {
            if (st.atributos[a] + 1 > 3) erro(nex, 'Treinamento', `O ponto do treinamento não pode deixar ${NOME_ATRIBUTO[a]} acima de 3.`);
            st.atributos[a] += 1;
            if (a === 'int') periciaPorIntelecto(nex);
          }
          if (classeAgente) aplicarPericiasDaClasse(nex, classeAgente.pericias.livres + f.atributos.int);
          receberClasse(nex);
          break;
        }
        case 'atributo': {
          if (fora(nex, 'atributo')) break;
          const a = e.atributo;
          if (!a) {
            falta(nex, 'atributo', `NEX ${nex}%: aumente um atributo em +1.`);
            break;
          }
          if (st.atributos[a] + 1 > 5) erro(nex, 'Aumento de atributo', `${NOME_ATRIBUTO[a]} não passa de 5 pelo aumento de atributo.`);
          st.atributos[a] += 1;
          if (a === 'int') periciaPorIntelecto(nex);
          break;
        }
        case 'grau': {
          if (fora(nex, 'grau') || !classeAgente) break;
          const qtd = classeAgente.grauTreinamento + st.atributos.int;
          const ps = e.grau ?? [];
          if (ps.length < qtd) falta(nex, 'grau', `NEX ${nex}%: suba o grau de ${qtd - ps.length} perícia${qtd - ps.length > 1 ? 's' : ''} treinada${qtd - ps.length > 1 ? 's' : ''}.`);
          if (ps.length > qtd) erro(nex, 'Grau de treinamento', `São ${qtd} perícias (${classeAgente.grauTreinamento} + Intelecto).`);
          if (new Set(ps).size !== ps.length) erro(nex, 'Grau de treinamento', 'Perícias repetidas.');
          for (const p of ps) {
            if (st.graus[p] === 'destreinado') erro(nex, 'Grau de treinamento', `${cat.pericia(p).nome} precisa ser treinada.`);
            else subirGrau(p, nex, 'Grau de treinamento');
          }
          break;
        }
        case 'trilha': {
          if (fora(nex, 'trilha') || !classeAgente) break;
          if (!f.trilha) {
            falta(nex, 'trilha', 'NEX 10%: escolha a trilha.');
            break;
          }
          const t = cat.trilha(f.trilha);
          if (!t) {
            erro(nex, 'Trilha', `Trilha desconhecida: ${f.trilha}.`);
            break;
          }
          if (t.classe !== classeAgente.id) erro(nex, 'Trilha', `${t.nome} é trilha de ${cat.classe(t.classe).nome.toLowerCase()}.`);
          if (!cat.disponivel(t, f.regras)) erro(nex, 'Trilha', `${t.nome} é do Sobrevivendo ao Horror, que esta campanha não usa.`);
          conferir(t.requisitos, ctx(nex, undefined, undefined, t.id), t.nome);
          for (const h of t.habilidades) if (h.nex === 10) receberHabilidade(h, 'trilha', nex);
          break;
        }
        case 'habilidadeTrilha': {
          const t = f.trilha ? cat.trilha(f.trilha) : undefined;
          if (!t) break;
          for (const h of t.habilidades) if (h.nex === nex) receberHabilidade(h, 'trilha', nex);
          break;
        }
        case 'poder': {
          if (fora(nex, 'poder')) break;
          receberPoder(e.poder, nex, `Poder (NEX ${nex}%)`);
          break;
        }
        case 'versatilidade': {
          if (fora(nex, 'versatilidade') || !classeAgente) break;
          const v = e.versatilidade;
          if (!v || (!v.poder && !v.trilha)) {
            falta(nex, 'versatilidade', 'NEX 50%: versatilidade — um poder de classe ou o 1º poder de outra trilha.');
            break;
          }
          if (v.poder) receberPoder(v.poder, nex, 'Versatilidade', 'versatilidade');
          else if (v.trilha) {
            const t = cat.trilha(v.trilha);
            if (!t) erro(nex, 'Versatilidade', `Trilha desconhecida: ${v.trilha}.`);
            else if (t.classe !== classeAgente.id) erro(nex, 'Versatilidade', `${t.nome} não é trilha de ${classeAgente.nome.toLowerCase()}.`);
            else if (t.id === f.trilha) erro(nex, 'Versatilidade', 'Escolha uma trilha que não seja a sua.');
            else {
              const h = t.habilidades.find((x) => x.nex === 10);
              if (h) receberHabilidade(h, 'trilha', nex, 'versatilidade');
            }
          }
          break;
        }
        case 'afinidade': {
          if (fora(nex, 'afinidade')) break;
          if (!e.afinidade) falta(nex, 'afinidade', 'NEX 50%: escolha o elemento de afinidade.');
          else st.afinidade = e.afinidade;
          break;
        }
        case 'ritual': {
          if (fora(nex, 'ritual')) break;
          const rs = e.rituais ?? [];
          if (!rs.length) falta(nex, 'ritual', `NEX ${nex}%: aprenda um ritual de círculo que já possa lançar.`);
          if (rs.length > 1) erro(nex, 'Rituais', 'É um ritual por NEX.');
          for (const id of rs) aprenderRitual(id, nex, undefined, `Ritual (NEX ${nex}%)`, 'classe');
          break;
        }
      }
    }
  }

  function periciaPorIntelecto(nex: Nex) {
    const e = f.progressao[nex];
    const p = e?.periciaIntelecto;
    if (!p) falta(nex, 'periciaIntelecto', `NEX ${nex}%: o Intelecto subiu — escolha uma perícia para treinar.`);
    else treinar(p, nex, 'Perícia do Intelecto');
  }

  if (nexAnterior !== null) st.atributosNoNex[nexAnterior] = { ...st.atributos };
  return st;
}

/**
 * Elemento de um poder paranormal para contar "Elemento N" e a afinidade: o
 * próprio, ou o da escolha (Resistir a <Elemento>: o escolhido; Aprender
 * Ritual: o do ritual aprendido, LR p. 114).
 */
export function elementoEfetivo(p: { elemento: Elemento; elementoDaEscolha?: boolean }, sub?: ValorEscolha): Elemento {
  if (!p.elementoDaEscolha) return p.elemento;
  if (sub?.elemento) return sub.elemento;
  const r = sub?.rituais?.[0] ? cat.ritual(sub.rituais[0]) : undefined;
  return r?.elemento ?? p.elemento;
}

/** Texto curto do que uma escolha pede. */
export function textoEscolha(es: NonNullable<Habilidade['escolha']>): string {
  switch (es.tipo) {
    case 'pericia': {
      const q = es.qtd ?? 1;
      return `escolha ${q} perícia${q > 1 ? 's' : ''}${es.treinada ? ' treinada' + (q > 1 ? 's' : '') : ''}`;
    }
    case 'elemento':
      return 'escolha o elemento';
    case 'atributo':
      return 'escolha o atributo';
    case 'ritual':
      return `escolha ${es.qtd ?? 1} ritual${(es.qtd ?? 1) > 1 ? 'is' : ''}`;
    case 'arma':
      return 'escolha a arma';
    case 'poderParanormal':
      return 'escolha o poder paranormal';
    case 'poderClasse':
      return 'escolha o poder';
    case 'texto':
      return es.rotulo;
  }
}
