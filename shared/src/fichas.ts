/**
 * Ficha guardada no banco: as escolhas do personagem (o motor de regras
 * calcula o resto) e o estado em jogo (PV/PE/SAN atuais, condições, notas).
 * Quando a ficha está ligada a um personagem do tabuleiro (`personagem` = id
 * da folha de sprite), os PV/PE/SAN da ficha e os da peça andam juntos.
 */
import type { Ficha } from './regras/ficha';
import { NEX_LISTA } from './regras/tipos';
import { sanitizarJogadas, type Jogada } from './regras/jogadas';

export interface Companheiro {
  nome: string;
  /** ex.: "Cão de serviço" */
  tipo: string;
  pv?: number;
  pvMax?: number;
  funcao?: string;
  tracos?: string[];
  /** arte em /arte/companheiros/<imagem> */
  imagem?: string;
}

/**
 * O tema da interface do agente (PROMPT-INTERFACE-GAME): escolhido na criação, veste a FICHAS dele,
 * a requisição e o celular. Ordem é o neutro, o padrão; as telas do mestre e a mesa ficam nele.
 */
export const TEMAS = ['ordem', 'sangue', 'morte', 'conhecimento', 'energia'] as const;
export type Tema = (typeof TEMAS)[number];
export const NOME_TEMA: Record<Tema, string> = { ordem: 'Ordem', sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia' };

export interface EstadoFicha {
  pv: number;
  pe: number;
  san: number;
  pvTemp?: number;
  peTemp?: number;
  sanTemp?: number;
}

export interface FichaSalva {
  id: number;
  nome: string;
  /** campanha onde a ficha é usada */
  campanha?: number;
  /** personagem do tabuleiro (folha de sprite e retratos) ligado à ficha */
  personagem?: number;
  /** a ficha de um NPC do Elenco (o id dele): fica na aba NPCs da FICHAS, não na dos agentes (17/10) */
  npc?: string;
  ficha: Ficha;
  /** em jogo: PV/PE/SAN atuais e temporários (sem valor = cheios) */
  atual?: EstadoFicha;
  /** condições marcadas pelo mestre (ids do catálogo); as da ficha saem sozinhas */
  condicoes?: string[];
  /** anotações, documentos e pistas do agente */
  notas?: { anotacoes?: string; documentos?: string; pistas?: string };
  /** as notas do jogador no celular (aba Notas): uma por assunto, as fixadas em cima */
  diario?: NotaDiario[];
  /** os rituais marcados com estrela no celular (ids do catálogo) */
  favoritos?: string[];
  /** as jogadas prontas do jogador (regras/jogadas.ts) */
  jogadas?: Jogada[];
  companheiro?: Companheiro;
  /** o tema da interface do agente (sem tema = Ordem) */
  tema?: Tema;
  /** os +1d6 guardados no interlúdio até o fim da missão: exercício (Agi, For, Vig) e leitura (Int, Pre); LR p. 92 */
  bonus?: { exercicio?: number; leitura?: number };
  /** chave do link do jogador (`?ficha=CHAVE`); só o mestre vê e gera */
  chave?: string;
  criadaEm: string;
  atualizadaEm: string;
}

/** Uma nota do jogador (aba Notas do celular). */
export interface NotaDiario {
  id: string;
  titulo: string;
  texto: string;
  fixada?: boolean;
  /** quando mudou por último (ISO) */
  em: string;
}

const MAX_TEXTO = 8000;
export const MAX_NOTAS_DIARIO = 200;
const texto = (v: unknown, max = MAX_TEXTO) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const inteiro = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined);
const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : undefined);

/**
 * Confere a forma de uma ficha vinda de fora (cliente ou arquivo). Não confere
 * regra: isso é o motor (`calcular`), que aponta pendências e problemas.
 */
export function sanitizarFicha(raw: unknown): FichaSalva | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const f = o.ficha as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object' || f.versao !== 1) return null;
  if (!NEX_LISTA.includes(f.nex as never)) return null;
  const at = f.atributos as Record<string, unknown> | undefined;
  if (!at || !['agi', 'for', 'int', 'pre', 'vig'].every((k) => typeof at[k] === 'number' && Number.isFinite(at[k]))) return null;
  if (JSON.stringify(raw).length > 300_000) return null;
  const nome = (texto(o.nome, 60) ?? texto(f.nome, 60) ?? '').trim();
  const a = o.atual as Record<string, unknown> | undefined;
  const c = o.companheiro as Record<string, unknown> | undefined;
  const n = o.notas as Record<string, unknown> | undefined;
  const out: FichaSalva = {
    id: inteiro(o.id, 0, 1e9) ?? 0,
    nome: nome || 'Sem nome',
    ficha: { ...(f as unknown as Ficha), nome: nome || 'Sem nome' },
    criadaEm: texto(o.criadaEm, 40) ?? new Date().toISOString(),
    atualizadaEm: new Date().toISOString(),
  };
  const b = o.bonus as Record<string, unknown> | undefined;
  if (b && typeof b === 'object') {
    const ex = inteiro(b.exercicio, 0, 10);
    const le = inteiro(b.leitura, 0, 10);
    if (ex || le) out.bonus = { ...(ex ? { exercicio: ex } : {}), ...(le ? { leitura: le } : {}) };
  }
  const campanha = inteiro(o.campanha, 0, 1e9);
  if (campanha) out.campanha = campanha;
  const personagem = inteiro(o.personagem, 0, 1e9);
  if (personagem) out.personagem = personagem;
  const npc = texto(o.npc, 60);
  if (npc) out.npc = npc;
  if (a && typeof a === 'object') {
    out.atual = { pv: inteiro(a.pv, -999, 999) ?? 0, pe: inteiro(a.pe, 0, 999) ?? 0, san: inteiro(a.san, 0, 999) ?? 0 };
    for (const k of ['pvTemp', 'peTemp', 'sanTemp'] as const) {
      const v = inteiro(a[k], 0, 999);
      if (v) out.atual[k] = v;
    }
  }
  if (TEMAS.includes(o.tema as Tema) && o.tema !== 'ordem') out.tema = o.tema as Tema;
  const cond = lista(o.condicoes, 40);
  if (cond?.length) out.condicoes = cond;
  if (Array.isArray(o.diario)) {
    const diario: NotaDiario[] = [];
    for (const raw of o.diario.slice(0, MAX_NOTAS_DIARIO)) {
      if (!raw || typeof raw !== 'object') continue;
      const d = raw as Record<string, unknown>;
      const id = texto(d.id, 40);
      if (!id) continue;
      diario.push({ id, titulo: texto(d.titulo, 80) ?? '', texto: texto(d.texto, 4000) ?? '', ...(d.fixada === true ? { fixada: true } : {}), em: texto(d.em, 40) ?? new Date().toISOString() });
    }
    if (diario.length) out.diario = diario;
  }
  const jogadas = sanitizarJogadas(o.jogadas);
  if (jogadas) out.jogadas = jogadas;
  const fav = lista(o.favoritos, 60);
  if (fav?.length) out.favoritos = [...new Set(fav.map((x) => x.slice(0, 60)))];
  if (n && typeof n === 'object') out.notas = { anotacoes: texto(n.anotacoes), documentos: texto(n.documentos), pistas: texto(n.pistas) };
  if (c && typeof c === 'object' && texto(c.nome, 40)) {
    out.companheiro = {
      nome: texto(c.nome, 40)!,
      tipo: texto(c.tipo, 60) ?? '',
      pv: inteiro(c.pv, 0, 999),
      pvMax: inteiro(c.pvMax, 1, 999),
      funcao: texto(c.funcao, 120),
      tracos: lista(c.tracos, 8),
      imagem: texto(c.imagem, 120),
    };
  }
  return out;
}
