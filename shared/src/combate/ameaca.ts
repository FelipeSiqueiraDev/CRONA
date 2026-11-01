/**
 * Ficha rápida de ameaça: os números que o combate usa (LR p. 178–181;
 * COMBATE.md, seção 17). O mestre escolhe uma ameaça do livro
 * (ameacasLivro.ts) ou preenche à mão.
 */
import type { Elemento, TipoDano } from '../regras/tipos';
import { AMEACAS_LIVRO, type AmeacaLivro } from './ameacasLivro';
import { lerTamanho } from './manobra';
import type { AtaqueAmeaca, FichaAmeaca, PresencaAmeaca, TesteAmeaca } from './tipos';

export const TIPOS_DANO: TipoDano[] = ['balistico', 'corte', 'impacto', 'perfuracao', 'fisico', 'eletricidade', 'fogo', 'frio', 'quimico', 'mental', 'sangue', 'morte', 'conhecimento', 'energia', 'medo', 'paranormal', 'todos'];

export function fichaAmeacaVazia(): FichaAmeaca {
  return {
    tipo: 'Pessoa',
    defesa: 10,
    fortitude: { dados: 1, bonus: 0 },
    reflexos: { dados: 1, bonus: 0 },
    vontade: { dados: 1, bonus: 0 },
    rd: {},
    imunidades: [],
    vulnerabilidades: [],
    ataques: [],
  };
}

const int = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : padrao);
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const tipoDano = (v: unknown): TipoDano | null => (typeof v === 'string' && (TIPOS_DANO as string[]).includes(v) ? (v as TipoDano) : null);
const ELEMENTOS: Elemento[] = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
const elemento = (v: unknown): Elemento | null => (typeof v === 'string' && (ELEMENTOS as string[]).includes(v) ? (v as Elemento) : null);

/**
 * d20 de um teste da ficha. O livro imprime "–2O" no lugar do teste quando o
 * atributo é 0: rola 2d20 e fica o pior (LR p. 75). Aqui isso é `dados: 0`; um
 * número negativo (copiado do livro) vira 0.
 */
const dadosDoTeste = (v: unknown, padrao: number) => int(v, 0, 10, padrao);

function teste(v: unknown): TesteAmeaca {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { dados: dadosDoTeste(o.dados, 1), bonus: int(o.bonus, -20, 60, 0) };
}

function ataque(v: unknown): AtaqueAmeaca | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const nome = txt(o.nome, 40);
  const dano = txt(o.dano, 30).replace(/[^0-9dD+\-−\s]/g, '');
  if (!nome || !/\d/.test(dano)) return null;
  const alcance = txt(o.alcance, 12);
  const ex = o.extra && typeof o.extra === 'object' ? (o.extra as Record<string, unknown>) : null;
  const exDano = ex ? txt(ex.dano, 20).replace(/[^0-9dD+\-−\s]/g, '') : '';
  const exTipo = ex ? tipoDano(ex.tipo) : null;
  // a sequência da ação completa: o bônus de cada golpe (de 2 a 6 golpes)
  const golpes = Array.isArray(o.golpes) ? o.golpes.slice(0, 6).map((g) => int(g, -20, 60, 0)) : [];
  const defesaDepois = int(o.defesaDepois, -20, 20, 0);
  const nota = txt(o.nota, 120);
  return {
    nome,
    pericia: o.pericia === 'pontaria' ? 'pontaria' : 'luta',
    dados: dadosDoTeste(o.dados, 1),
    bonus: int(o.bonus, -20, 60, 0),
    dano,
    tipo: tipoDano(o.tipo) ?? 'impacto',
    margem: int(o.margem, 2, 20, 20),
    multiplicador: int(o.multiplicador, 2, 6, 2),
    ...(alcance ? { alcance } : {}),
    ...(golpes.length < 2 && int(o.vezes, 1, 6, 1) > 1 ? { vezes: int(o.vezes, 1, 6, 1) } : {}),
    ...(/\d/.test(exDano) && exTipo ? { extra: { dano: exDano, tipo: exTipo } } : {}),
    ...(golpes.length > 1 ? { golpes, completa: true } : o.completa === true ? { completa: true } : {}),
    ...(defesaDepois ? { defesaDepois } : {}),
    ...(nota ? { nota } : {}),
  };
}

/** Imunidades a dano para a conta: as da ficha e, na criatura, o dano mental (LR p. 180). */
export function imunidadesDaAmeaca(f: Pick<FichaAmeaca, 'imunidades' | 'elemento'>): TipoDano[] {
  return f.elemento && !f.imunidades.includes('mental') ? [...f.imunidades, 'mental'] : f.imunidades;
}

function presenca(v: unknown): PresencaAmeaca | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const dano = txt(o.dano, 20).replace(/[^0-9dD+\s]/g, '');
  if (!/\d/.test(dano)) return null;
  return { nex: int(o.nex, 0, 100, 0), dt: int(o.dt, 1, 60, 10), dano };
}

/** Confere a ficha que veio da rede (ou do banco). */
export function lerFichaAmeaca(raw: unknown): FichaAmeaca | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rd: Partial<Record<TipoDano, number>> = {};
  if (o.rd && typeof o.rd === 'object')
    for (const [k, n] of Object.entries(o.rd as Record<string, unknown>)) {
      const t = tipoDano(k);
      const v = int(n, 0, 99, 0);
      if (t && v > 0) rd[t] = v;
    }
  const lista = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(tipoDano).filter((t): t is TipoDano => !!t))] : []);
  const vd = int(o.vd, 0, 999, -1);
  const notas = txt(o.notas, 300);
  const tamanho = lerTamanho(o.tamanho);
  const el = elemento(o.elemento);
  const pres = presenca(o.presenca);
  const livro = typeof o.livro === 'string' && LIVRO.has(o.livro) ? o.livro : '';
  return {
    tipo: txt(o.tipo, 40) || 'Pessoa',
    ...(vd >= 0 ? { vd } : {}),
    defesa: int(o.defesa, 0, 80, 10),
    fortitude: teste(o.fortitude),
    reflexos: teste(o.reflexos),
    vontade: teste(o.vontade),
    rd,
    imunidades: lista(o.imunidades),
    vulnerabilidades: lista(o.vulnerabilidades),
    ataques: (Array.isArray(o.ataques) ? o.ataques : []).slice(0, 8).map(ataque).filter((a): a is AtaqueAmeaca => !!a),
    ...(tamanho && tamanho !== 'medio' ? { tamanho } : {}),
    ...(o.luta && typeof o.luta === 'object' ? { luta: teste(o.luta) } : {}),
    ...(el ? { elemento: el } : {}),
    ...(pres ? { presenca: pres } : {}),
    ...(livro ? { livro } : {}),
    ...(notas ? { notas } : {}),
  };
}

// ------------------------------------------------------------------ livro

const LIVRO = new Map(AMEACAS_LIVRO.map((a) => [a.id, a]));
export const ameacaLivro = (id: string): AmeacaLivro | undefined => LIVRO.get(id);

export const NOME_ELEMENTO: Record<Elemento, string> = { sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia', medo: 'Medo' };

/** O seletor do livro: as criaturas por elemento, e a realidade (animais e pessoas). */
export const GRUPOS_LIVRO: { nome: string; ameacas: AmeacaLivro[] }[] = [
  ...(['sangue', 'morte', 'conhecimento', 'energia', 'medo'] as Elemento[]).map((e) => ({ nome: `Criaturas de ${NOME_ELEMENTO[e]}`, ameacas: AMEACAS_LIVRO.filter((a) => a.elemento === e) })),
  { nome: 'Animais', ameacas: AMEACAS_LIVRO.filter((a) => !a.elemento && /animal/i.test(a.tipo)) },
  { nome: 'Pessoas e outros', ameacas: AMEACAS_LIVRO.filter((a) => !a.elemento && !/animal/i.test(a.tipo)) },
].filter((g) => g.ameacas.length);

/**
 * A ficha rápida do combate a partir da ficha do livro (os PV vão para a
 * peça). As notas guardam a página e o que muda com o enigma. A criatura já
 * sai imune a dano mental (LR p. 180).
 */
export function fichaDoLivro(a: AmeacaLivro): FichaAmeaca {
  const enigma = a.enigma ? `imune a todo dano até resolver o enigma de medo${a.notaEnigma ? `; ${a.notaEnigma}` : ''}` : '';
  const criatura = a.elemento ? 'criatura: imune a dano mental, a condições mentais e de medo e a rituais de Medo' : '';
  const notas = [`LR p. ${a.pagina}`, enigma, criatura, a.duvida ?? ''].filter(Boolean).join(' · ');
  const f: FichaAmeaca = {
    tipo: a.elemento && a.tipo === 'Criatura' ? `Criatura de ${NOME_ELEMENTO[a.elemento]}` : a.tipo,
    ...(a.vd !== undefined ? { vd: a.vd } : {}),
    defesa: a.defesa,
    fortitude: { ...a.fortitude },
    reflexos: { ...a.reflexos },
    vontade: { ...a.vontade },
    rd: { ...a.rd },
    imunidades: a.elemento ? imunidadesDaAmeaca({ imunidades: [...a.imunidades], elemento: a.elemento }) : [...a.imunidades],
    vulnerabilidades: [...a.vulnerabilidades],
    ataques: a.ataques.map((x) => ({ ...x })),
    ...(a.tamanho !== 'medio' ? { tamanho: a.tamanho } : {}),
    ...(a.elemento ? { elemento: a.elemento } : {}),
    ...(a.presenca ? { presenca: { ...a.presenca } } : {}),
    livro: a.id,
    notas: notas.slice(0, 300),
  };
  return lerFichaAmeaca(f) ?? f;
}
