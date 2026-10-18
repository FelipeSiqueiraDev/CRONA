/**
 * As contas dos jogadores que vêm do C.R.I.S (18/10): o nome de usuário, o e-mail e o bcrypt da senha de lá,
 * para eles entrarem no CRONA com a mesma senha de sempre, e cada conta já ligada à ficha do personagem dela.
 *
 * O script `scripts/dev/importar-cris.mts` lê o banco do C.R.I.S (só leitura) e chama `importarContasCris`. Rodar
 * de novo não duplica nada: a conta trazida guarda o id de lá (`crisId`). A senha nunca é vista nem impressa: o
 * hash vai direto para a conta e, no primeiro login certo, vira scrypt (contas.ts, `confereSenha`).
 */
import crypto from 'node:crypto';
import { MAX_NAME } from '@crona/shared';
import { EMAIL_RE, senhaAntiga, type Conta } from './contas';
import type { Database } from './db';

/** Um jogador do C.R.I.S, ligado a um personagem da campanha (campaign_members → agent_sheets). */
export interface UsuarioCris {
  id: string;
  username: string;
  /** o nome que aparece (pode ser vazio) */
  nome: string;
  email: string | null;
  /** o bcrypt de lá ($2b$...) */
  hash: string;
  /** o nome do personagem no C.R.I.S ("D. Tepes") */
  personagem: string;
}

export interface ResultadoImportacao {
  nome: string;
  personagem: string;
  fichaId?: number;
  /** nova, atualizada ou o motivo de ter ficado de fora */
  feito: 'nova' | 'atualizada' | 'sem ficha' | 'nome ocupado' | 'senha estranha';
}

const NAME_RE = /^[\p{L}\p{N}_\-. ]+$/u;
const nomeValido = (n: string) => n.length >= 2 && n.length <= MAX_NAME && NAME_RE.test(n);
/** "D. Tepes" e "D.Tepes", "Cora Falcão" e "cora falcao": o mesmo personagem */
export const chaveNome = (n: string) =>
  n
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Traz as contas para o `db` (muda o db; quem chama grava). Cada usuário vira uma conta de jogador ligada à ficha
 * do mesmo personagem; a ficha sem link de jogador ganha um (a conta abre a ficha por ele).
 */
export function importarContasCris(db: Database, usuarios: UsuarioCris[], agora = Date.now()): ResultadoImportacao[] {
  const contas = (db.contas ??= []);
  const fichas = (db.fichas ?? []).filter((f) => !f.npc);
  const feitos: ResultadoImportacao[] = [];
  for (const u of usuarios) {
    const nome = [u.username, u.nome, u.personagem.split(/\s+/)[0]].map((n) => n.trim().replace(/\s+/g, ' ')).find(nomeValido) ?? '';
    const r: ResultadoImportacao = { nome: nome || u.username, personagem: u.personagem, feito: 'nova' };
    feitos.push(r);
    if (!senhaAntiga(u.hash)) {
      r.feito = 'senha estranha';
      continue;
    }
    const ficha = fichas.find((f) => chaveNome(f.nome) === chaveNome(u.personagem));
    if (!ficha) {
      r.feito = 'sem ficha';
      continue;
    }
    r.fichaId = ficha.id;
    ficha.chave ??= crypto.randomBytes(9).toString('base64url');
    const ja = contas.find((c) => c.crisId === u.id);
    if (ja) {
      r.nome = ja.nome;
      r.feito = 'atualizada';
      ja.fichaId = ficha.id;
      ja.papel = 'jogador';
      // a senha que ainda não virou scrypt acompanha a de lá (se ele trocou no C.R.I.S)
      if (senhaAntiga(ja.senha)) ja.senha = u.hash;
      continue;
    }
    const email = [u.email, u.username].map((e) => (e ?? '').trim().toLowerCase()).find((e) => e.length <= 120 && EMAIL_RE.test(e)) ?? `${chaveNome(nome) || 'agente'}@cris.local`;
    const ocupado = !nome || contas.some((c) => c.nome.toLowerCase() === nome.toLowerCase() || c.email === email);
    if (ocupado) {
      r.feito = 'nome ocupado';
      continue;
    }
    db.nextContaId ??= 1;
    const conta: Conta = { id: db.nextContaId++, nome, email, senha: u.hash, papel: 'jogador', fichaId: ficha.id, sessoes: [], criadaEm: agora, crisId: u.id };
    contas.push(conta);
  }
  return feitos;
}
