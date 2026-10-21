/**
 * Cola entre a tela FICHAS e o motor de regras (shared/src/regras): textos
 * prontos (dados, bônus, categorias), o que cada item da mochila mostra e,
 * principalmente, onde fica cada escolha da ficha. Uma escolha (pendente ou já
 * feita) vira um `Escolher`: as opções do motor, travadas com o motivo, o que
 * está escolhido e como gravar. A tela só mostra e chama `aplicar`.
 */
import { lootKindLabel, regras, type LootKind } from '@crona/shared';

type Ficha = regras.Ficha;
type Nex = regras.Nex;
type ValorEscolha = regras.ValorEscolha;
type Opcao = regras.Opcao;
type PericiaId = regras.PericiaId;
type Escolha = regras.Escolha;
type Habilidade = regras.Habilidade;
const cat = regras.catalogo;

export const NOME_ATR: Record<regras.AtributoId, string> = { agi: 'AGI', for: 'FOR', int: 'INT', pre: 'PRE', vig: 'VIG' };
export const NOME_ATR_LONGO = regras.NOME_ATRIBUTO;
export const NOME_ELEMENTO = regras.NOME_ELEMENTO;
export const NOME_GRAU: Record<regras.Grau, string> = { destreinado: '—', treinado: 'Treinado', veterano: 'Veterano', expert: 'Expert' };
export const GRAU_CURTO: Record<regras.Grau, string> = { destreinado: '—', treinado: 'Trein.', veterano: 'Vet.', expert: 'Exp.' };

/** "I", "II", "III", "IV" ("0" = sem categoria). */
export function romano(c: number): string {
  return ['0', 'I', 'II', 'III', 'IV'][c] ?? String(c);
}

/**
 * "3d20+5". `dados` = o atributo e os dados ganhos; `penalidade` = os perdidos.
 * Se a penalidade deixaria menos de 1 dado, rola como se ela fosse bônus e fica
 * o pior (LR p. 11); atributo 0 rola 2 e fica o pior (LR p. 75).
 */
export function textoTeste(dados: number, bonus: number, penalidade = 0): string {
  const b = bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';
  const r = regras.rolagem(dados, penalidade);
  return `${r.dados}d20${b}${r.fica === 'menor' ? ' (pior)' : ''}`;
}

export function sinal(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Página do livro para mostrar ("LR p. 26"). */
export function textoRef(r: regras.Ref | undefined): string {
  if (!r) return '';
  return `${r.fonte === 'LR' ? 'Livro de Regras' : 'Sobrevivendo ao Horror'}, p. ${r.pagina || '?'}`;
}

// ---------------------------------------------------------------- mochila

export interface InfoItem {
  nome: string;
  tipo: string;
  categoria: number;
  espacos: number;
  /** dano (armas) ou efeito */
  efeito: string;
  obs: string;
  icone: string;
  ref?: regras.Ref;
}

const TIPO_ARMA: Record<regras.TipoArma, string> = { corpoACorpo: 'Arma branca', arremesso: 'Arremesso', disparo: 'Disparo', fogo: 'Arma de fogo' };
const GRUPO: Record<regras.GrupoItem, string> = {
  acessorio: 'Acessório',
  kit: 'Kit',
  utensilio: 'Utilitário',
  vestimenta: 'Vestimenta',
  explosivo: 'Explosivo',
  operacional: 'Operacional',
  paranormal: 'Paranormal',
  municao: 'Munição',
  medicamento: 'Medicamento',
  veiculo: 'Veículo',
  outro: 'Outro',
};
const ICONE_GRUPO: Record<regras.GrupoItem, string> = {
  acessorio: 'maleta',
  kit: 'maleta',
  utensilio: 'lanterna',
  vestimenta: 'colete',
  explosivo: 'explosivo',
  operacional: 'radio',
  paranormal: 'olho',
  municao: 'municao',
  medicamento: 'kitMedico',
  veiculo: 'caixa',
  outro: 'caixa',
};

/** Ícone de linha pelo item (até a arte de cada tipo chegar). */
function iconeDoItem(it: regras.ItemFicha): string {
  const id = it.id;
  if (it.tipo === 'arma') {
    const a = cat.arma(id);
    if (!a) return 'faca';
    if (a.tipo === 'fogo') return 'pistola';
    if (a.tipo === 'disparo') return 'mira';
    if (a.tipo === 'arremesso') return 'explosivo';
    return a.empunhadura === 'leve' ? 'faca' : 'espada';
  }
  if (it.tipo === 'protecao') return 'colete';
  if (it.tipo === 'amaldicoado') return 'caveiraItem';
  if (/celular|smartphone/.test(id)) return 'celular';
  if (/lanterna/.test(id)) return 'lanterna';
  if (/radio|walkie/.test(id)) return 'radio';
  if (/corda/.test(id)) return 'corda';
  if (/medic|primeiros|coagulante|curativo|antidoto/.test(id)) return 'kitMedico';
  if (/livro|grimorio|diario/.test(id)) return 'livro';
  if (/cao|gato|animal/.test(id)) return 'pata';
  const e = cat.equipamento(id);
  return e ? ICONE_GRUPO[e.grupo] : 'caixa';
}

/** Ícone de linha do item achado no cenário, pelo tipo. */
const ICONE_CENA: Record<LootKind, string> = { weapon: 'faca', document: 'documento', key: 'cadeado', letter: 'email', potion: 'frasco', tape: 'pendrive', box: 'caixa', misc: 'caixa' };

/** O que a linha do item mostra (nome, tipo, dano ou efeito, observações). */
export function infoItem(it: regras.ItemFicha, calc: regras.Calculado | null): InfoItem {
  // achado no cenário (um documento, uma chave): o texto do mestre no lugar do efeito
  if (it.tipo === 'cena') {
    const kind = (it.tipoCena ?? 'misc') as LootKind;
    const obs = [(it.qtd ?? 1) > 1 ? `×${it.qtd}` : '', 'achado na missão'].filter(Boolean).join(' · ');
    return { nome: it.apelido || it.nome || it.id, tipo: lootKindLabel(kind), categoria: 0, espacos: it.espacos ?? 1, efeito: it.descricao || '—', obs, icone: ICONE_CENA[kind] ?? 'caixa' };
  }
  const info = infoDoCatalogo(it, calc);
  if (it.achado) info.obs = [info.obs, 'achado na missão'].filter(Boolean).join(' · ');
  return info;
}

function infoDoCatalogo(it: regras.ItemFicha, calc: regras.Calculado | null): InfoItem {
  const base = regras.baseDoItem(it);
  const nome = it.apelido || base?.nome || it.id;
  const categoria = regras.categoriaDoItem(it);
  const mods = (it.modificacoes ?? []).map((m) => cat.modificacao(m)?.nome ?? m);
  const mald = (it.maldicoes ?? []).map((m) => cat.maldicao(m)?.nome ?? m);
  const extra = [...mods, ...mald].join(', ');
  const icone = iconeDoItem(it);
  if (it.tipo === 'arma') {
    const a = cat.arma(it.id);
    const atq = calc?.ataques.find((x) => x.item === it.id && x.nome === nome);
    const teste = atq ? textoTeste(atq.dados, atq.bonus, atq.penalidadeDados) : '';
    const crit = atq ? `${atq.critico.margem < 20 ? `${atq.critico.margem}` : '20'}/x${atq.critico.multiplicador}` : a ? `${a.critico.margem}/x${a.critico.multiplicador}` : '';
    const obs = [teste && `${atq?.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${teste}`, crit, a?.alcance ? `alcance ${a.alcance}` : '', extra, ...(atq?.notas ?? [])].filter(Boolean).join(' · ');
    return { nome, tipo: a ? TIPO_ARMA[a.tipo] : 'Arma', categoria, espacos: base?.espacos ?? 0, efeito: atq?.dano ?? a?.dano ?? '—', obs, icone, ref: a?.ref };
  }
  if (it.tipo === 'protecao') {
    const p = cat.protecao(it.id);
    const def = p ? p.defesa : 0;
    const res = p?.resistencia ? ` · RD ${p.resistencia.valor}` : '';
    return { nome, tipo: p?.tipo === 'escudo' ? 'Escudo' : 'Proteção', categoria, espacos: base?.espacos ?? 0, efeito: `Defesa +${def}${res}`, obs: [it.vestido === false ? 'guardada' : 'vestida', extra].filter(Boolean).join(' · '), icone, ref: p?.ref };
  }
  if (it.tipo === 'amaldicoado') {
    const x = cat.amaldicoado(it.id);
    return { nome, tipo: `Amaldiçoado${x ? ` (${NOME_ELEMENTO[x.elemento]})` : ''}`, categoria, espacos: base?.espacos ?? 0, efeito: (x?.especial ?? []).slice(0, 1).join('') || '—', obs: extra, icone, ref: x?.ref };
  }
  const e = cat.equipamento(it.id);
  const efeitos = (e?.efeitos ?? []).filter((x) => !x.condicional).map((x) => regras.textoEfeito(x));
  const kit = e?.kitDe ? `kit de ${cat.pericia(e.kitDe).nome}` : '';
  return {
    nome,
    tipo: e ? GRUPO[e.grupo] : 'Equipamento',
    categoria,
    espacos: base?.espacos ?? 0,
    efeito: efeitos[0] ?? kit ?? '—',
    obs: [e?.usos ? `${e.usos} usos` : '', ...(e?.especial ?? []).slice(0, 1), extra, (it.qtd ?? 1) > 1 ? `×${it.qtd}` : ''].filter(Boolean).join(' · '),
    icone,
    ref: e?.ref,
  };
}

// ---------------------------------------------------------------- escolhas

/** Uma escolha da ficha, pronta para a janela de opções. */
export interface Escolher {
  titulo: string;
  /** texto curto acima da lista */
  dica?: string;
  /** quantas marcar (1 = escolha única) */
  /** pode gravar sem nada escolhido (as condições: tirar a última) */
  podeVazio?: boolean;
  qtd: number;
  opcoes: () => Opcao[];
  atual: () => string[];
  /** grava na ficha (o chamador salva e redesenha) */
  aplicar: (ids: string[]) => void;
  /** escolha livre em texto (a profissão, por exemplo) */
  texto?: { rotulo: string; valor: () => string; aplicar: (v: string) => void };
  /** depois de gravar, pode abrir a escolha seguinte (o parâmetro do poder) */
  depois?: () => Escolher | null;
}

const esc = (f: Ficha, nex: Nex) => regras.escolhasDe(f, nex);
const limpar = (f: Ficha) => {
  // tira NEX vazios da progressão (a ficha salva fica limpa)
  for (const k of Object.keys(f.progressao) as unknown as Nex[]) {
    const e = f.progressao[k];
    if (e && !Object.values(e).some((v) => v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && v && !Array.isArray(v) && !Object.keys(v).length))) delete f.progressao[k];
  }
};

function opcoesPericia(f: Ficha, nex: Nex, es: Extract<Escolha, { tipo: 'pericia' }>, atuais: PericiaId[]): Opcao[] {
  const st = regras.montarEstado(f, nex);
  return cat.CATALOGO.pericias.map((p) => {
    const motivos: string[] = [];
    if (es.de && !es.de.includes(p.id)) motivos.push('Não é uma das opções.');
    if (es.exceto?.includes(p.id)) motivos.push('Não vale para esta escolha.');
    if (es.treinada && st.graus[p.id] === 'destreinado' && !atuais.includes(p.id)) motivos.push('Precisa ser treinada.');
    return { id: p.id, nome: p.nome, ref: p.ref, ok: !motivos.length, motivos, avisos: [] };
  });
}

function opcoesElemento(es: Extract<Escolha, { tipo: 'elemento' }>): Opcao[] {
  const todos: regras.Elemento[] = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
  return todos.map((e) => {
    const ok = !es.de || es.de.includes(e);
    return { id: e, nome: NOME_ELEMENTO[e], ok, motivos: ok ? [] : ['Não é uma das opções.'], avisos: [] };
  });
}

function opcoesArma(f: Ficha): Opcao[] {
  return cat.CATALOGO.armas.filter((a) => cat.disponivel(a, f.regras)).map((a) => ({ id: a.id, nome: `${a.nome} (${romano(a.categoria)})`, ref: a.ref, ok: true, motivos: [], avisos: [] }));
}

/** Escolhas de um parâmetro (perícias, elemento, arma, rituais, texto...) guardado em `ler/gravar`. */
function escolherParametro(f: Ficha, nex: Nex, nome: string, es: Escolha, ler: () => ValorEscolha | undefined, gravar: (v: ValorEscolha | undefined) => void): Escolher | null {
  const titulo = `${nome}: ${regras.textoEscolha(es)}`;
  switch (es.tipo) {
    case 'pericia':
      return {
        titulo,
        qtd: es.qtd ?? 1,
        opcoes: () => opcoesPericia(f, nex, es, ler()?.pericias ?? []),
        atual: () => ler()?.pericias ?? [],
        aplicar: (ids) => gravar({ ...ler(), pericias: ids as PericiaId[] }),
      };
    case 'elemento':
      return { titulo, qtd: 1, opcoes: () => opcoesElemento(es), atual: () => (ler()?.elemento ? [ler()!.elemento!] : []), aplicar: (ids) => gravar({ ...ler(), elemento: ids[0] as regras.Elemento }) };
    case 'atributo':
      return {
        titulo,
        qtd: 1,
        opcoes: () => (es.de ?? regras.ATRIBUTOS).map((a) => ({ id: a, nome: NOME_ATR_LONGO[a], ok: true, motivos: [], avisos: [] })),
        atual: () => (ler()?.atributo ? [ler()!.atributo!] : []),
        aplicar: (ids) => gravar({ ...ler(), atributo: ids[0] as regras.AtributoId }),
      };
    case 'arma':
      return { titulo, qtd: 1, opcoes: () => opcoesArma(f), atual: () => (ler()?.arma ? [ler()!.arma!] : []), aplicar: (ids) => gravar({ ...ler(), arma: ids[0] }) };
    case 'ritual': {
      const max = es.circuloMax ?? regras.circuloMaximo(f.classe ?? 'mundano', nex);
      return {
        titulo,
        dica: `Até o ${max || 1}º círculo${es.elemento ? `, de ${NOME_ELEMENTO[es.elemento]}` : ''}.`,
        qtd: es.qtd ?? 1,
        opcoes: () => filtrarRituais(regras.opcoesRitual(f, nex, max || 1), ler()?.rituais ?? [], es.elemento),
        atual: () => ler()?.rituais ?? [],
        aplicar: (ids) => gravar({ ...ler(), rituais: ids }),
      };
    }
    case 'texto':
      return {
        titulo,
        qtd: 0,
        opcoes: () => [],
        atual: () => [],
        aplicar: () => {},
        texto: { rotulo: es.rotulo, valor: () => ler()?.texto ?? '', aplicar: (v) => gravar(v.trim() ? { ...ler(), texto: v.trim() } : undefined) },
      };
    case 'poderParanormal':
      return {
        titulo,
        qtd: 1,
        opcoes: () => regras.opcoesParanormal(f, nex),
        atual: () => (ler()?.poder ? [ler()!.poder!] : []),
        aplicar: (ids) => gravar({ poder: ids[0] }),
        depois: () => {
          const p = ler()?.poder ? cat.paranormal(ler()!.poder!) : undefined;
          if (!p?.escolha) return null;
          return escolherParametro(f, nex, p.nome, p.escolha, () => ler()?.sub, (v) => gravar({ ...ler(), sub: v }));
        },
      };
    case 'poderClasse':
      return {
        titulo,
        qtd: 1,
        opcoes: () =>
          cat.CATALOGO.poderes
            .filter((p) => cat.disponivel(p, f.regras) && !p.classes.includes('geral') && (!es.outraClasse || !p.classes.includes(f.classe!)))
            .map((p) => ({ id: p.id, nome: `${p.nome} (${p.classes.join(', ')})`, ref: p.ref, resumo: p.resumo, ok: true, motivos: [], avisos: [] })),
        atual: () => (ler()?.poder ? [ler()!.poder!] : []),
        aplicar: (ids) => gravar({ poder: ids[0] }),
        depois: () => {
          const p = ler()?.poder ? cat.poder(ler()!.poder!) : undefined;
          if (!p?.escolha) return null;
          return escolherParametro(f, nex, p.nome, p.escolha, () => ler()?.sub, (v) => gravar({ ...ler(), sub: v }));
        },
      };
  }
}

/** Rituais já escolhidos aqui continuam liberados (a lista de "já conhecidos" conta com eles). */
function filtrarRituais(ops: Opcao[], atuais: string[], elemento?: regras.Elemento): Opcao[] {
  return ops.map((o) => {
    let m = atuais.includes(o.id) ? o.motivos.filter((x) => x !== 'Já conhecido.') : o.motivos;
    if (elemento && cat.ritual(o.id)?.elemento !== elemento) m = [...m, `Só rituais de ${NOME_ELEMENTO[elemento]}.`];
    return { ...o, ok: !m.length, motivos: m };
  });
}

/** Habilidade (de classe, trilha ou origem) pelo id, para achar a escolha dela. */
function habilidadePorId(f: Ficha, id: string, nex: Nex): Habilidade | undefined {
  const cl = f.classe ? cat.classe(f.classe) : undefined;
  const h1 = cl?.habilidades.find((h) => h.id === id);
  if (h1) return h1;
  const tr = f.trilha ? cat.trilha(f.trilha) : undefined;
  const h2 = tr?.habilidades.find((h) => h.id === id);
  if (h2) return h2;
  const vt = f.progressao[nex]?.versatilidade?.trilha ?? f.progressao[50]?.versatilidade?.trilha;
  const h3 = vt ? cat.trilha(vt)?.habilidades.find((h) => h.id === id) : undefined;
  if (h3) return h3;
  const or = f.origem ? cat.origem(f.origem) : undefined;
  if (or?.poder.id === id) return or.poder;
  const mu = cat.classe('mundano').habilidades.find((h) => h.id === id);
  return mu;
}

/** Onde um parâmetro está guardado: no poder do NEX, na versatilidade ou nos parâmetros das habilidades. */
function localParametro(f: Ficha, nex: Nex, id: string): { nome: string; escolha: Escolha; ler: () => ValorEscolha | undefined; gravar: (v: ValorEscolha | undefined) => void } | null {
  const e = f.progressao[nex];
  // poder de classe do NEX (ou da versatilidade)
  for (const lugar of ['poder', 'versatilidade'] as const) {
    const ep = lugar === 'poder' ? e?.poder : e?.versatilidade?.poder;
    if (!ep) continue;
    const p = cat.poder(ep.id);
    if (ep.id === id && p?.escolha) {
      return {
        nome: p.nome,
        escolha: p.escolha,
        ler: () => (lugar === 'poder' ? esc(f, nex).poder?.escolha : esc(f, nex).versatilidade?.poder?.escolha),
        gravar: (v) => {
          const alvo = lugar === 'poder' ? esc(f, nex).poder : esc(f, nex).versatilidade?.poder;
          if (alvo) alvo.escolha = v;
        },
      };
    }
    // o poder paranormal do Transcender deste NEX
    if (ep.escolha?.poder === id) {
      const pp = cat.paranormal(id) ?? cat.poder(id);
      if (pp?.escolha)
        return {
          nome: pp.nome,
          escolha: pp.escolha,
          ler: () => (lugar === 'poder' ? esc(f, nex).poder : esc(f, nex).versatilidade?.poder)?.escolha?.sub,
          gravar: (v) => {
            const alvo = lugar === 'poder' ? esc(f, nex).poder : esc(f, nex).versatilidade?.poder;
            if (alvo) alvo.escolha = { ...alvo.escolha, sub: v };
          },
        };
    }
  }
  // habilidade fixa
  const h = habilidadePorId(f, id, nex);
  const escolha = h?.escolha ?? (h?.concedeRituais && !Array.isArray(h.concedeRituais) ? h.concedeRituais.escolha : undefined);
  if (h && escolha) {
    return {
      nome: h.nome,
      escolha,
      ler: () => f.progressao[nex]?.parametros?.[id],
      gravar: (v) => {
        const ex = esc(f, nex);
        ex.parametros ??= {};
        if (v) ex.parametros[id] = v;
        else delete ex.parametros[id];
        if (!Object.keys(ex.parametros).length) delete ex.parametros;
      },
    };
  }
  // poder paranormal que uma habilidade deu (Cultista Arrependido)
  for (const [hid, v] of Object.entries(e?.parametros ?? {})) {
    if (v?.poder !== id) continue;
    const pp = cat.paranormal(id);
    if (pp?.escolha)
      return {
        nome: pp.nome,
        escolha: pp.escolha,
        ler: () => f.progressao[nex]?.parametros?.[hid]?.sub,
        gravar: (nv) => {
          const ex = esc(f, nex);
          ex.parametros ??= {};
          ex.parametros[hid] = { ...ex.parametros[hid], sub: nv };
        },
      };
  }
  return null;
}

/**
 * Rituais de uma habilidade (Escolhido pelo Outro Lado, Saber Ampliado): quantos
 * e até que círculo. `exato`: o ritual do círculo novo tem de ser dele (LR p. 35).
 */
function ritualDaHabilidade(f: Ficha, nex: Nex, id: string): { qtd: number; circuloMax: number; exato?: number; nome: string } | null {
  const h = habilidadePorId(f, id, nex);
  if (!h) return null;
  const maxClasse = regras.circuloMaximo(f.classe ?? 'mundano', nex) || 1;
  if (h.concedeRituais && !Array.isArray(h.concedeRituais)) {
    const es = h.concedeRituais.escolha;
    return { nome: h.nome, qtd: es.tipo === 'ritual' ? (es.qtd ?? 1) : 1, circuloMax: es.tipo === 'ritual' ? (es.circuloMax ?? maxClasse) : maxClasse };
  }
  if (h.rituaisExtras) {
    // no NEX da própria habilidade: a quantidade dela, até o círculo dela
    if (h.nex === nex || (h.nex === undefined && nex === 5)) {
      const st = regras.montarEstado(f, nex);
      const qtd = typeof h.rituaisExtras.qtd === 'number' ? h.rituaisExtras.qtd : st.atributos[h.rituaisExtras.qtd];
      return { nome: h.nome, qtd, circuloMax: Math.min(h.rituaisExtras.circuloMax ?? 4, maxClasse) };
    }
    // nos círculos novos: 1, do círculo que acabou de liberar
    return { nome: h.nome, qtd: 1, circuloMax: maxClasse, exato: maxClasse };
  }
  return null;
}

/**
 * A escolha de uma pendência do motor. `null` = a escolha é feita no próprio
 * painel (pontos de atributo, perícias da criação).
 */
export function escolherPendencia(f: Ficha, p: regras.Pendencia): Escolher | null {
  const nex = p.nex;
  switch (p.tipo) {
    case 'origem':
      return escolherCampo(f, nex, 'origem');
    case 'classe':
      return escolherCampo(f, nex, 'classe');
    case 'trilha':
      return escolherCampo(f, nex, 'trilha');
    case 'poder':
      return escolherCampo(f, nex, 'poder');
    case 'versatilidade':
      return escolherCampo(f, nex, 'versatilidade');
    case 'atributo':
      return escolherCampo(f, nex, nex === 5 && f.comecouMundano ? 'atributoTreino' : 'atributo');
    case 'periciaIntelecto':
      return escolherCampo(f, nex, 'periciaIntelecto');
    case 'grau':
      return escolherCampo(f, nex, 'grau');
    case 'afinidade':
      return escolherCampo(f, nex, 'afinidade');
    case 'ritual':
      return p.alvo ? escolherCampo(f, nex, 'ritualHabilidade', p.alvo) : escolherCampo(f, nex, 'ritual');
    case 'paranormal': {
      const e = f.progressao[nex];
      if (e?.poder?.id && cat.poder(e.poder.id)?.escolha?.tipo === 'poderParanormal') return escolherParametro(f, nex, cat.poder(e.poder.id)!.nome, { tipo: 'poderParanormal' }, () => esc(f, nex).poder?.escolha, (v) => (esc(f, nex).poder!.escolha = v));
      if (e?.versatilidade?.poder?.id && cat.poder(e.versatilidade.poder.id)?.escolha?.tipo === 'poderParanormal')
        return escolherParametro(f, nex, 'Versatilidade', { tipo: 'poderParanormal' }, () => esc(f, nex).versatilidade?.poder?.escolha, (v) => (esc(f, nex).versatilidade!.poder!.escolha = v));
      // habilidade que dá poder paranormal (origem)
      const or = f.origem ? cat.origem(f.origem) : undefined;
      const hs = [or?.poder, ...(f.classe ? cat.classe(f.classe).habilidades : [])].filter((h): h is Habilidade => !!h && h.escolha?.tipo === 'poderParanormal');
      const h = hs[0];
      if (h) return escolherCampo(f, nex, 'parametro', h.id);
      return null;
    }
    case 'parametro':
      return p.alvo ? escolherCampo(f, nex, 'parametro', p.alvo) : null;
    // "Escolha mais N perícias treinadas": a perícia que repete a da classe ou da origem (LR p. 22) vira outra, à escolha
    case 'pericias':
      return /^Escolha mais/.test(p.texto) ? escolherCampo(f, nex, 'periciaLivre') : null;
    default:
      return null;
  }
}

export type Campo =
  | 'periciaLivre'
  | 'origem'
  | 'classe'
  | 'trilha'
  | 'poder'
  | 'versatilidade'
  | 'atributo'
  | 'atributoTreino'
  | 'periciaIntelecto'
  | 'grau'
  | 'afinidade'
  | 'ritual'
  | 'ritualHabilidade'
  | 'parametro';

/** A escolha de um campo da ficha num NEX (para escolher ou trocar). */
export function escolherCampo(f: Ficha, nex: Nex, campo: Campo, alvo?: string): Escolher | null {
  switch (campo) {
    case 'periciaLivre':
      return {
        titulo: 'Perícia treinada à escolha',
        dica: 'A que repetiu (classe e origem dão a mesma) vira outra, à sua escolha (LR p. 22). Vale uma perícia que você ainda não treina.',
        qtd: 1,
        opcoes: () => {
          const st = regras.montarEstado(f, f.nex);
          return cat.CATALOGO.pericias.map((x) => {
            const treinada = st.graus[x.id] !== 'destreinado';
            return { id: x.id, nome: x.nome, ref: x.ref, ok: !treinada, motivos: treinada ? ['Você já é treinado nela.'] : [], avisos: [] };
          });
        },
        atual: () => [],
        aplicar: (ids) => {
          for (const id of ids) if (!f.pericias.livres.includes(id as PericiaId)) f.pericias.livres.push(id as PericiaId);
        },
      };
    case 'origem':
      return {
        titulo: 'Origem',
        dica: 'De onde o agente veio: duas perícias treinadas e um poder.',
        qtd: 1,
        opcoes: () => regras.opcoesOrigem(f),
        atual: () => (f.origem ? [f.origem] : []),
        aplicar: (ids) => {
          f.origem = ids[0] ?? null;
          delete f.pericias.origem;
        },
        depois: () => {
          const o = f.origem ? cat.origem(f.origem) : undefined;
          return o?.poder.escolha ? escolherCampo(f, f.comecouMundano ? 0 : 5, 'parametro', o.poder.id) : null;
        },
      };
    case 'classe':
      return {
        titulo: 'Classe',
        qtd: 1,
        opcoes: () => regras.opcoesClasse(),
        atual: () => (f.classe ? [f.classe] : []),
        aplicar: (ids) => {
          const nova = (ids[0] ?? null) as regras.ClasseAgente | null;
          if (nova !== f.classe) {
            f.classe = nova;
            // perícias e trilha da classe antiga não valem mais
            f.pericias.grupos = [];
            f.trilha = null;
          }
        },
      };
    case 'trilha':
      return {
        titulo: 'Trilha (NEX 10%)',
        qtd: 1,
        opcoes: () => regras.opcoesTrilha(f),
        atual: () => (f.trilha ? [f.trilha] : []),
        aplicar: (ids) => {
          f.trilha = ids[0] ?? null;
        },
        depois: () => {
          const t = f.trilha ? cat.trilha(f.trilha) : undefined;
          const h = t?.habilidades.find((x) => x.nex === 10);
          return h?.escolha ? escolherCampo(f, 10, 'parametro', h.id) : null;
        },
      };
    case 'poder':
      return {
        titulo: `Poder de ${f.classe ? cat.classe(f.classe).nome.toLowerCase() : 'classe'} (NEX ${nex}%)`,
        qtd: 1,
        opcoes: () => regras.opcoesPoder(f, nex),
        atual: () => (f.progressao[nex]?.poder ? [f.progressao[nex]!.poder!.id] : []),
        aplicar: (ids) => {
          const e = esc(f, nex);
          if (ids[0]) e.poder = e.poder?.id === ids[0] ? e.poder : { id: ids[0] };
          else delete e.poder;
          limpar(f);
        },
        depois: () => {
          const id = f.progressao[nex]?.poder?.id;
          const p = id ? cat.poder(id) : undefined;
          if (!p?.escolha) return null;
          if (p.escolha.tipo === 'poderParanormal') return escolherParametro(f, nex, p.nome, p.escolha, () => esc(f, nex).poder?.escolha, (v) => (esc(f, nex).poder!.escolha = v));
          return escolherCampo(f, nex, 'parametro', p.id);
        },
      };
    case 'versatilidade':
      return {
        titulo: 'Versatilidade (NEX 50%)',
        dica: 'Um poder de classe, ou o primeiro poder de outra trilha da sua classe.',
        qtd: 1,
        opcoes: () => [
          ...regras.opcoesPoder(f, nex, 'versatilidade').map((o) => ({ ...o, id: `poder:${o.id}` })),
          ...regras.opcoesVersatilidadeTrilha(f).map((o) => ({ ...o, id: `trilha:${o.id}`, nome: `Trilha ${o.nome}` })),
        ],
        atual: () => {
          const v = f.progressao[nex]?.versatilidade;
          return v?.poder ? [`poder:${v.poder.id}`] : v?.trilha ? [`trilha:${v.trilha}`] : [];
        },
        aplicar: (ids) => {
          const e = esc(f, nex);
          const [tipo, id] = (ids[0] ?? '').split(':');
          if (tipo === 'poder') e.versatilidade = { poder: { id } };
          else if (tipo === 'trilha') e.versatilidade = { trilha: id };
          else delete e.versatilidade;
          limpar(f);
        },
        depois: () => {
          const v = f.progressao[nex]?.versatilidade;
          const p = v?.poder ? cat.poder(v.poder.id) : undefined;
          if (p?.escolha) return escolherCampo(f, nex, 'parametro', p.id);
          const h = v?.trilha ? cat.trilha(v.trilha)?.habilidades.find((x) => x.nex === 10) : undefined;
          return h?.escolha ? escolherCampo(f, nex, 'parametro', h.id) : null;
        },
      };
    case 'atributo':
    case 'atributoTreino':
      return {
        titulo: campo === 'atributo' ? `Aumento de atributo (NEX ${nex}%)` : 'Treinamento na Ordem: +1 ponto de atributo',
        dica: campo === 'atributo' ? 'Até 5.' : 'Sem passar de 3.',
        qtd: 1,
        opcoes: () => regras.opcoesAtributo(f, nex),
        atual: () => {
          const v = f.progressao[nex]?.[campo];
          return v ? [v] : [];
        },
        aplicar: (ids) => {
          const e = esc(f, nex);
          e[campo] = (ids[0] as regras.AtributoId) || undefined;
          if (!e[campo]) delete e[campo];
          limpar(f);
        },
        depois: () => (f.progressao[nex]?.[campo] === 'int' ? escolherCampo(f, nex, 'periciaIntelecto') : null),
      };
    case 'periciaIntelecto':
      return {
        titulo: `Perícia pelo Intelecto (NEX ${nex}%)`,
        qtd: 1,
        opcoes: () => regras.opcoesPericia(f, nex, f.progressao[nex]?.periciaIntelecto ? [f.progressao[nex]!.periciaIntelecto!] : []),
        atual: () => (f.progressao[nex]?.periciaIntelecto ? [f.progressao[nex]!.periciaIntelecto!] : []),
        aplicar: (ids) => {
          const e = esc(f, nex);
          if (ids[0]) e.periciaIntelecto = ids[0] as PericiaId;
          else delete e.periciaIntelecto;
          limpar(f);
        },
      };
    case 'grau': {
      const cl = f.classe ? cat.classe(f.classe) : undefined;
      const qtd = () => (cl ? cl.grauTreinamento + regras.montarEstado(f, nex).atributos.int : 0);
      return {
        titulo: `Grau de treinamento (NEX ${nex}%)`,
        dica: 'Perícias treinadas sobem um grau (veterano a partir de 35%, expert a partir de 70%).',
        qtd: qtd(),
        opcoes: () => {
          const ops = regras.opcoesGrau(f, nex);
          const atuais = f.progressao[nex]?.grau ?? [];
          return ops.map((o) => (atuais.includes(o.id as PericiaId) ? { ...o, ok: true, motivos: [] } : o));
        },
        atual: () => f.progressao[nex]?.grau ?? [],
        aplicar: (ids) => {
          const e = esc(f, nex);
          if (ids.length) e.grau = ids as PericiaId[];
          else delete e.grau;
          limpar(f);
        },
      };
    }
    case 'afinidade':
      return {
        titulo: 'Afinidade (NEX 50%)',
        dica: 'O elemento com que o agente tem afinidade. Firma no primeiro Transcender depois dela.',
        qtd: 1,
        opcoes: () => regras.opcoesAfinidade(),
        atual: () => (f.progressao[nex]?.afinidade ? [f.progressao[nex]!.afinidade!] : []),
        aplicar: (ids) => {
          const e = esc(f, nex);
          if (ids[0]) e.afinidade = ids[0] as regras.ElementoAfinidade;
          else delete e.afinidade;
          limpar(f);
        },
      };
    case 'ritual':
      return {
        titulo: `Ritual (NEX ${nex}%)`,
        dica: 'Um ritual novo por NEX, de círculo que já possa conjurar.',
        qtd: 1,
        opcoes: () => filtrarRituais(regras.opcoesRitual(f, nex), f.progressao[nex]?.rituais ?? []),
        atual: () => f.progressao[nex]?.rituais ?? [],
        aplicar: (ids) => {
          const e = esc(f, nex);
          if (ids.length) e.rituais = ids.slice(0, 1);
          else delete e.rituais;
          limpar(f);
        },
      };
    case 'ritualHabilidade': {
      const info = alvo ? ritualDaHabilidade(f, nex, alvo) : null;
      if (!info || !alvo) return null;
      const ler = () => f.progressao[nex]?.parametros?.[alvo]?.rituais ?? [];
      return {
        titulo: `${info.nome}: ${info.qtd} ritual${info.qtd > 1 ? 'is' : ''}`,
        dica: info.exato ? `Do ${info.exato}º círculo, o que acabou de liberar.` : `Até o ${info.circuloMax}º círculo.`,
        qtd: info.qtd,
        opcoes: () => filtrarRituais(regras.opcoesRitual(f, nex, info.circuloMax, info.exato), ler()),
        atual: ler,
        aplicar: (ids) => {
          const e = esc(f, nex);
          e.parametros ??= {};
          if (ids.length) e.parametros[alvo] = { ...e.parametros[alvo], rituais: ids };
          else delete e.parametros[alvo];
          if (!Object.keys(e.parametros).length) delete e.parametros;
          limpar(f);
        },
      };
    }
    case 'parametro': {
      if (!alvo) return null;
      const loc = localParametro(f, nex, alvo);
      if (!loc) return null;
      return escolherParametro(f, nex, loc.nome, loc.escolha, loc.ler, (v) => {
        loc.gravar(v);
        limpar(f);
      });
    }
  }
}

// ---------------------------------------------------------------- criação

/** Pontos de atributo da criação: gastos, total e o que falta. */
export function pontosAtributo(f: Ficha): { gastos: number; total: number } {
  const total = f.comecouMundano ? 3 : 4;
  const gastos = regras.ATRIBUTOS.reduce((s, k) => s + f.atributos[k] - 1, 0);
  return { gastos, total };
}

/** Pode subir/descer o atributo da criação? (0 a 3, só um em 0, pontos contados). */
export function podeMudarAtributo(f: Ficha, a: regras.AtributoId, delta: 1 | -1): boolean {
  const v = f.atributos[a] + delta;
  if (v < 0 || v > 3) return false;
  if (v === 0 && regras.ATRIBUTOS.some((k) => k !== a && f.atributos[k] === 0)) return false;
  const { gastos, total } = pontosAtributo(f);
  if (delta > 0 && gastos + 1 > total) return false;
  return true;
}

/** Perícias da criação: de onde vem cada treinada e quantas livres faltam. */
export interface PericiasCriacao {
  origem: PericiaId[];
  /** Amnésico e afins: quantas o mestre escolhe */
  origemEscolha: number;
  fixas: PericiaId[];
  grupos: PericiaId[][];
  livres: number;
}

export function periciasCriacao(f: Ficha): PericiasCriacao {
  const o = f.origem ? cat.origem(f.origem) : undefined;
  const origem = o ? (Array.isArray(o.pericias) ? o.pericias : (f.pericias.origem ?? [])) : [];
  const origemEscolha = o && !Array.isArray(o.pericias) ? o.pericias.escolha : 0;
  const cl = f.classe ? cat.classe(f.classe) : cat.classe('mundano');
  const fixas = cl.pericias.fixas;
  // perícia fixa que a origem já dá: vira uma livre a mais (LR p. 22)
  const repetidas = fixas.filter((p) => origem.includes(p)).length;
  const livres = cl.pericias.livres + f.atributos.int + repetidas;
  return { origem, origemEscolha, fixas, grupos: cl.pericias.grupos, livres };
}
