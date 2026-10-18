/**
 * Jogadas prontas: o jogador monta, uma vez, o que faz num ataque ("gasto 3 PE no Ataque
 * Especial para +10 no dano, com a katana") e dá um nome. O motor confere com a ficha e as
 * regras, e o mestre escolhe a jogada no COMBATE: o ataque já vem montado, e o PE sai junto.
 *
 * O que o livro dá em número (a escala do Ataque Especial, LR p. 24), o motor confere. O que a
 * habilidade só descreve, o jogador escreve o bônus e o motor marca "o mestre confere".
 */
import type { Calculado, Ataque } from './calcular';
import { ESCALAS_CLASSE } from './dados/classes';
import * as cat from './dados';
import type { Ficha } from './ficha';
import type { PoderObtido } from './estado';

/** Um poder ou habilidade gasto na jogada. */
export interface PassoJogada {
  /** id do poder/habilidade na ficha */
  poder: string;
  /** PE gastos nele */
  pe: number;
  /** o que soma no ataque e no dano */
  ataque?: number;
  dano?: number;
  /** dados a mais no dano ("1d6") */
  danoDados?: string;
  /** reduz a margem de ameaça (19 → 18) */
  margem?: number;
  /** soma no multiplicador do crítico */
  multiplicador?: number;
}

export interface Jogada {
  id: string;
  nome: string;
  /** o item da arma (uid); sem ele, o ataque desarmado */
  arma?: number;
  passos: PassoJogada[];
  /** o que o jogador quer lembrar ao mestre */
  nota?: string;
}

export const MAX_JOGADAS = 20;

/** Custo em PE de um poder ou habilidade da ficha (sem custo = passivo ou de graça). */
export function custoDoPoder(p: PoderObtido, f: Ficha): number | undefined {
  switch (p.tipo) {
    case 'classe':
      return cat.poder(p.id)?.custoPe;
    case 'paranormal':
      return cat.paranormal(p.id)?.custoPe;
    case 'trilha':
      return f.trilha ? cat.trilha(f.trilha)?.habilidades.find((x) => x.id === p.id)?.custoPe : undefined;
    case 'origem': {
      const o = f.origem ? cat.origem(f.origem) : undefined;
      return o?.poder.id === p.id ? o.poder.custoPe : undefined;
    }
    case 'habilidade':
      return f.classe ? cat.classe(f.classe).habilidades.find((x) => x.id === p.id)?.custoPe : undefined;
  }
  return undefined;
}

/** Os poderes que entram numa jogada (os que gastam PE), com a escala do livro quando tem. */
export function poderesDaJogada(f: Ficha, calc: Calculado): { poder: PoderObtido; custo: number; escala?: { pe: number; bonus: number }[] }[] {
  const out: { poder: PoderObtido; custo: number; escala?: { pe: number; bonus: number }[] }[] = [];
  for (const p of calc.poderes) {
    const custo = custoDoPoder(p, f);
    if (!custo) continue;
    const esc = p.id === 'ataque-especial' ? ESCALAS_CLASSE['ataque-especial'].filter((e) => e.nex <= f.nex).map((e) => ({ pe: e.custoPe ?? custo, bonus: Number(e.texto.replace('+', '')) })) : undefined;
    out.push({ poder: p, custo, ...(esc?.length ? { escala: esc } : {}) });
  }
  return out;
}

/**
 * As jogadas do livro, prontas sem o jogador montar nada (18/10, o Felipe: "os poderes que gastam PE têm que gastar sozinhos e
 * aplicar o efeito"): para cada arma na mão e o desarmado, o Ataque Especial (+5, +10… no ataque ou no dano, um degrau por NEX)
 * e o Ataque Furtivo (+Nd6 de dano). O combate confere cada uma (PE, limite do turno) e esconde as que não dão; o PE sai junto
 * com o ataque. O que depende da situação (furtivo só contra desprevenido ou flanqueado) vai como aviso para o mestre.
 */
export function jogadasDoLivro(f: Ficha, calc: Calculado): Jogada[] {
  const out: Jogada[] = [];
  const poderes = poderesDaJogada(f, calc);
  const armas = calc.ataques.filter((a) => a.naMao);
  const furtivo = poderes.find((x) => x.poder.id === 'ataque-furtivo');
  const dadosFurtivo = f.nex >= 99 ? '4d6' : f.nex >= 65 ? '3d6' : f.nex >= 40 ? '2d6' : '1d6';
  for (const a of armas) {
    const chave = a.uid === undefined ? 'desarmado' : String(a.uid);
    const arma = a.uid === undefined ? {} : { arma: a.uid };
    const esp = poderes.find((x) => x.poder.id === 'ataque-especial');
    for (const e of esp?.escala ?? []) {
      out.push({ id: `livro:ae:${chave}:${e.pe}:a`, nome: `Ataque Especial +${e.bonus} no ataque`, ...arma, passos: [{ poder: 'ataque-especial', pe: e.pe, ataque: e.bonus }] });
      out.push({ id: `livro:ae:${chave}:${e.pe}:d`, nome: `Ataque Especial +${e.bonus} no dano`, ...arma, passos: [{ poder: 'ataque-especial', pe: e.pe, dano: e.bonus }] });
    }
    if (furtivo && !(a.alcance && /longo|extremo/i.test(String(a.alcance))))
      out.push({ id: `livro:af:${chave}`, nome: `Ataque Furtivo +${dadosFurtivo}`, ...arma, passos: [{ poder: 'ataque-furtivo', pe: furtivo.custo, danoDados: dadosFurtivo }], nota: 'Só vale contra alvo desprevenido ou flanqueado, uma vez por rodada.' });
  }
  return out;
}

export interface JogadaConferida {
  ok: boolean;
  erros: string[];
  /** o que o motor não confere (o mestre olha) */
  avisos: string[];
  pe: number;
  /** o ataque já com tudo somado */
  ataque: (Omit<Ataque, 'dano' | 'critico'> & { dano: string; critico: { margem: number; multiplicador: number } }) | null;
  /** cada passo em uma linha, para o mestre ler */
  linhas: string[];
}

const DADOS_RE = /^\d{1,2}d\d{1,3}$/;

/**
 * Confere a jogada com a ficha e as regras. `peAtual` e `gastoTurno` (no combate) conferem o PE
 * que sobra e o limite do turno (LR p. 23).
 */
export function conferirJogada(f: Ficha, calc: Calculado, j: Jogada, o: { peAtual?: number; gastoTurno?: number } = {}): JogadaConferida {
  const erros: string[] = [];
  const avisos: string[] = [];
  const linhas: string[] = [];
  const base = j.arma !== undefined ? calc.ataques.find((a) => a.uid === j.arma) : calc.ataques.find((a) => a.uid === undefined);
  if (!base) erros.push(j.arma !== undefined ? 'A arma não está mais na mochila.' : 'Escolha a arma.');
  else if (!base.naMao) avisos.push(`${base.nome} está guardada: sacar antes gasta a ação de movimento (LR p. 87).`);
  const poderes = poderesDaJogada(f, calc);
  let pe = 0;
  let ataque = 0;
  let dano = 0;
  const dados: string[] = [];
  let margem = 0;
  let mult = 0;
  const vistos = new Set<string>();
  for (const passo of j.passos) {
    const p = poderes.find((x) => x.poder.id === passo.poder);
    if (!p) {
      erros.push('Um dos poderes não está mais na ficha (ou não gasta PE).');
      continue;
    }
    const nome = p.poder.nome;
    if (vistos.has(passo.poder)) erros.push(`${nome} aparece duas vezes: junte num passo só.`);
    vistos.add(passo.poder);
    const at = passo.ataque ?? 0;
    const dn = passo.dano ?? 0;
    if (!Number.isInteger(passo.pe) || passo.pe < p.custo) erros.push(`${nome} custa pelo menos ${p.custo} PE.`);
    if (p.escala) {
      // Ataque Especial: o PE de um degrau liberado pelo NEX e o bônus dele, dividido de 5 em 5 entre ataque e dano
      const degrau = p.escala.find((e) => e.pe === passo.pe);
      if (!degrau) erros.push(`${nome}: no NEX ${f.nex}% são ${p.escala.map((e) => `${e.pe} PE (+${e.bonus})`).join(', ')} (LR p. 24).`);
      else if (at + dn !== degrau.bonus || at % 5 || dn % 5) erros.push(`${nome} com ${passo.pe} PE dá +${degrau.bonus}, em partes de 5 no ataque ou no dano.`);
      if (passo.danoDados || passo.margem || passo.multiplicador) erros.push(`${nome} só soma no ataque ou no dano.`);
    } else if (at || dn || passo.danoDados || passo.margem || passo.multiplicador) avisos.push(`${nome}: o bônus foi escrito pelo jogador; o mestre confere com o livro.`);
    if (passo.danoDados && !DADOS_RE.test(passo.danoDados)) erros.push(`${nome}: os dados a mais são no formato 1d6.`);
    pe += passo.pe;
    ataque += at;
    dano += dn;
    if (passo.danoDados && DADOS_RE.test(passo.danoDados)) dados.push(passo.danoDados);
    margem += passo.margem ?? 0;
    mult += passo.multiplicador ?? 0;
    const partes = [at ? `+${at} no ataque` : '', dn ? `+${dn} no dano` : '', passo.danoDados ? `+${passo.danoDados} no dano` : '', passo.margem ? `margem −${passo.margem}` : '', passo.multiplicador ? `crítico +${passo.multiplicador}` : ''].filter(Boolean);
    linhas.push(`${nome}: ${passo.pe} PE${partes.length ? ` (${partes.join(', ')})` : ''}`);
  }
  // o limite de PE do turno (LR p. 23): passa só se for o custo mínimo de uma habilidade sozinha
  const limite = calc.limitePe;
  const gasto = o.gastoTurno ?? 0;
  if (pe + gasto > limite) {
    const unica = j.passos.length === 1 && poderes.find((x) => x.poder.id === j.passos[0].poder)?.custo === pe && !gasto;
    if (unica) avisos.push(`Passa do limite de ${limite} PE: vale porque é o custo mínimo de uma habilidade (LR p. 23).`);
    else erros.push(`São ${pe} PE${gasto ? ` (mais ${gasto} já gastos no turno)` : ''}; o limite é ${limite} por turno (LR p. 23).`);
  }
  if (o.peAtual !== undefined && pe > o.peAtual) erros.push(`Faltam PE: a jogada pede ${pe} e sobram ${o.peAtual}.`);
  let pronto: JogadaConferida['ataque'] = null;
  if (base) {
    const formula = [base.dano, dano ? `${dano > 0 ? '+' : ''}${dano}` : '', ...dados.map((d) => `+${d}`)].join('');
    pronto = { ...base, bonus: base.bonus + ataque, dano: formula, critico: { margem: Math.max(2, base.critico.margem - margem), multiplicador: base.critico.multiplicador + mult } };
    linhas.unshift(`${base.nome}: ${base.pericia === 'pontaria' ? 'Pontaria' : 'Luta'} ${pronto.dados}d20${pronto.bonus >= 0 ? '+' : ''}${pronto.bonus}, dano ${formula}, crítico ${pronto.critico.margem}/×${pronto.critico.multiplicador}`);
  }
  return { ok: !erros.length, erros, avisos, pe, ataque: pronto, linhas };
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const inteiro = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined);

/** A forma das jogadas vindas do cliente (a regra é o `conferirJogada`). */
export function sanitizarJogadas(raw: unknown): Jogada[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Jogada[] = [];
  for (const r of raw.slice(0, MAX_JOGADAS)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = texto(o.id, 40);
    const nome = texto(o.nome, 60)?.trim();
    if (!id || !nome) continue;
    const passos: PassoJogada[] = [];
    for (const p of Array.isArray(o.passos) ? o.passos.slice(0, 8) : []) {
      if (!p || typeof p !== 'object') continue;
      const q = p as Record<string, unknown>;
      const poder = texto(q.poder, 60);
      const pe = inteiro(q.pe, 0, 30);
      if (!poder || pe === undefined) continue;
      const passo: PassoJogada = { poder, pe };
      const at = inteiro(q.ataque, -50, 50);
      const dn = inteiro(q.dano, -50, 50);
      const dd = texto(q.danoDados, 10)?.trim();
      const mg = inteiro(q.margem, 0, 10);
      const ml = inteiro(q.multiplicador, 0, 5);
      if (at) passo.ataque = at;
      if (dn) passo.dano = dn;
      if (dd) passo.danoDados = dd;
      if (mg) passo.margem = mg;
      if (ml) passo.multiplicador = ml;
      passos.push(passo);
    }
    const j: Jogada = { id, nome, passos };
    const arma = inteiro(o.arma, 1, 1e12);
    if (arma) j.arma = arma;
    const nota = texto(o.nota, 300)?.trim();
    if (nota) j.nota = nota;
    out.push(j);
  }
  return out.length ? out : undefined;
}
