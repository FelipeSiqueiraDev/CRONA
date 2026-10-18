/**
 * As contas da plataforma (a tela de entrada): e-mail, senha e o papel de cada um.
 *
 * - A senha nunca é guardada: só o scrypt dela, com sal próprio (não dá para ler de volta).
 * - Cada aparelho que entra ganha uma sessão: um código aleatório que fica guardado no
 *   navegador e vai no login. No banco fica só o sha256 dela (vale 180 dias; até 10 por conta).
 * - A primeira conta, ou a criada no computador do servidor, é de mestre; as outras, de
 *   jogador. A do jogador se liga à ficha quando ele abre o link da ficha com a conta.
 *
 * As contas ficam no Database (`contas`), que o banco guarda na tabela `config`.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PapelConta } from '@crona/shared';

export interface Conta {
  id: number;
  nome: string;
  /** em minúsculas */
  email: string;
  /**
   * scrypt$N$r$p$sal$hash (base64). A conta trazida do C.R.I.S chega com o bcrypt de lá ($2b$...) e vira scrypt
   * no primeiro login certo (`senhaAntiga`).
   */
  senha: string;
  papel: PapelConta;
  /** a ficha do jogador, ligada quando ele abre o link dela com a conta */
  fichaId?: number;
  /** sha256 das sessões abertas e quando cada uma começou */
  sessoes: { h: string; em: number }[];
  criadaEm: number;
  /** a conta veio do C.R.I.S (o id do usuário lá; scripts/dev/importar-cris.mts) */
  crisId?: string;
}

const N = 16384;
const R = 8;
const P = 1;
const TAM = 64;
const VALIDADE = 180 * 24 * 3600 * 1000;
const MAX_SESSOES = 10;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SENHA_MIN = 6;

function scrypt(senha: string, sal: Buffer, tam: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, erro) =>
    crypto.scrypt(senha, sal, tam, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, chave) => (e ? erro(e) : ok(chave))),
  );
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = crypto.randomBytes(16);
  const h = await scrypt(senha, sal, TAM, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}

/** O hash é do C.R.I.S (bcrypt), e não o nosso: depois do login certo, a senha vira scrypt. */
export const senhaAntiga = (guardada: string) => /^\$2[aby]\$\d\d\$/.test(guardada);

export async function confereSenha(senha: string, guardada: string): Promise<boolean> {
  // a conta trazida do C.R.I.S: a senha de sempre, conferida com o bcrypt de lá
  if (senhaAntiga(guardada)) return bcrypt.compare(senha, guardada).catch(() => false);
  const [alg, n, r, p, sal, h] = guardada.split('$');
  if (alg !== 'scrypt' || !sal || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const obtido = await scrypt(senha, Buffer.from(sal, 'base64'), esperado.length, Number(n), Number(r), Number(p));
  return obtido.length === esperado.length && crypto.timingSafeEqual(obtido, esperado);
}

const hashSessao = (sessao: string) => crypto.createHash('sha256').update(sessao).digest('hex');
const valendo = (s: { em: number }, agora: number) => agora - s.em < VALIDADE;

/** Abre uma sessão nova para a conta e devolve o código (o aparelho guarda; o banco, só o hash). */
export function novaSessao(conta: Conta, agora = Date.now()): string {
  const sessao = crypto.randomBytes(32).toString('base64url');
  conta.sessoes = [...conta.sessoes.filter((s) => valendo(s, agora)), { h: hashSessao(sessao), em: agora }].slice(-MAX_SESSOES);
  return sessao;
}

/** A conta dona da sessão, se ela ainda vale. */
export function contaDaSessao(contas: Conta[] | undefined, sessao: string, agora = Date.now()): Conta | undefined {
  const h = hashSessao(sessao);
  return contas?.find((c) => c.sessoes.some((s) => s.h === h && valendo(s, agora)));
}

/** Fecha a sessão (sair). Devolve se ela existia. */
export function fecharSessao(contas: Conta[] | undefined, sessao: string): boolean {
  const h = hashSessao(sessao);
  let achou = false;
  for (const c of contas ?? []) {
    const antes = c.sessoes.length;
    c.sessoes = c.sessoes.filter((s) => s.h !== h);
    achou ||= c.sessoes.length !== antes;
  }
  return achou;
}
