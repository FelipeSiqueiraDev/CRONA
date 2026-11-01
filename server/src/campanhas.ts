import { randomInt } from 'node:crypto';
import { MAX_NOME_CAMPANHA, ehSistema, lerConvite, novoConvite, type Campanha, type PapelConta, type ResumoCampanha } from '@crona/shared';
import type { Conta } from './contas';
import type { Database } from './db';

/**
 * As campanhas das contas (29/10; os tipos em shared/src/campanhas.ts). Funções puras sobre o banco: o hotel chama e
 * grava. A campanha principal é a do tabuleiro de hoje, e o papel nela continua sendo o `papel` da conta (o login, a
 * ficha e a mesa seguem iguais): quem vira mestre ou jogador dela tem a conta acertada junto.
 */

/** sorteio do código de convite (criptográfico: o código é a chave de entrada) */
const sorte = () => randomInt(0, 1_000_000) / 1_000_000;

/**
 * A primeira vez: a história de hoje vira a campanha principal, com as contas que já existem — as de mestre como
 * mestres, e as de jogador com ficha ligada como jogadores. Devolve se mudou o banco.
 */
export function migrarCampanhas(db: Database, nome: string, agora = Date.now()): boolean {
  if (db.campanhasJogo) return false;
  const membros = (db.contas ?? [])
    .filter((c) => c.papel === 'mestre' || c.fichaId)
    .map((c) => ({ contaId: c.id, papel: c.papel, desde: agora }));
  db.campanhasJogo = [{ id: 1, nome, sistema: 'ordem-paranormal', membros, criadaEm: agora, principal: true }];
  db.nextCampanhaJogoId = 2;
  return true;
}

export function campanhaPrincipal(db: Database): Campanha | undefined {
  return db.campanhasJogo?.find((c) => c.principal);
}

export function papelEm(camp: Campanha, contaId: number): PapelConta | null {
  return camp.membros.find((m) => m.contaId === contaId)?.papel ?? null;
}

/**
 * Põe a conta na campanha (ou sobe para mestre; mestre nunca desce a jogador por aqui). Na principal, o papel da conta
 * acompanha. Devolve se mudou.
 */
export function porNaCampanha(camp: Campanha, conta: Conta, papel: PapelConta, agora = Date.now()): boolean {
  const m = camp.membros.find((x) => x.contaId === conta.id);
  let mudou = false;
  if (!m) {
    camp.membros.push({ contaId: conta.id, papel, desde: agora });
    mudou = true;
  } else if (m.papel === 'jogador' && papel === 'mestre') {
    m.papel = 'mestre';
    mudou = true;
  }
  if (camp.principal) {
    const p = papelEm(camp, conta.id)!;
    if (conta.papel !== p) (conta.papel = p), (mudou = true);
  }
  return mudou;
}

export function listaDaConta(db: Database, conta: Conta): ResumoCampanha[] {
  const nomeDe = new Map((db.contas ?? []).map((c) => [c.id, c.nome]));
  const lista: ResumoCampanha[] = [];
  for (const camp of db.campanhasJogo ?? []) {
    const papel = papelEm(camp, conta.id);
    if (!papel) continue;
    lista.push({
      id: camp.id,
      nome: camp.nome,
      sistema: camp.sistema,
      papel,
      mestres: camp.membros.filter((m) => m.papel === 'mestre').map((m) => nomeDe.get(m.contaId) ?? '?'),
      jogadores: camp.membros.filter((m) => m.papel === 'jogador').length,
      principal: !!camp.principal,
      ...(papel === 'mestre' && camp.convite ? { convite: camp.convite } : {}),
      ...(papel === 'mestre' ? { membros: camp.membros.map((m) => ({ contaId: m.contaId, nome: nomeDe.get(m.contaId) ?? '?', papel: m.papel })) } : {}),
    });
  }
  // a principal primeiro, depois a mais nova
  return lista.sort((a, b) => Number(b.principal) - Number(a.principal) || b.id - a.id);
}

const limparNome = (bruto: unknown) => (typeof bruto === 'string' ? bruto.trim().replace(/\s+/g, ' ') : '');
const nomeRuim = (nome: string) => (nome.length < 2 || nome.length > MAX_NOME_CAMPANHA ? `O nome da campanha precisa de 2 a ${MAX_NOME_CAMPANHA} letras.` : null);

export function criarCampanha(db: Database, conta: Conta, nomeBruto: unknown, sistema: unknown, agora = Date.now()): Campanha | string {
  const nome = limparNome(nomeBruto);
  if (nomeRuim(nome)) return nomeRuim(nome)!;
  if (!ehSistema(sistema)) return 'Escolha o sistema da campanha.';
  const minhas = (db.campanhasJogo ?? []).filter((c) => papelEm(c, conta.id) === 'mestre');
  if (minhas.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) return 'Você já mestra uma campanha com esse nome.';
  if (minhas.length >= 20) return 'Você já mestra 20 campanhas.';
  const camp: Campanha = { id: (db.nextCampanhaJogoId ??= 1), nome, sistema, membros: [{ contaId: conta.id, papel: 'mestre', desde: agora }], criadaEm: agora };
  db.nextCampanhaJogoId++;
  (db.campanhasJogo ??= []).push(camp);
  return camp;
}

/** Entra pelo código de convite como jogador. Quem já está nela continua com o papel que tem. */
export function entrarComCodigo(db: Database, conta: Conta, texto: unknown, agora = Date.now()): Campanha | string {
  const codigo = typeof texto === 'string' ? lerConvite(texto) : null;
  if (!codigo) return 'O código tem 6 letras e números (como K7Q-M2P).';
  const camp = (db.campanhasJogo ?? []).find((c) => c.convite === codigo);
  if (!camp) return 'Nenhuma campanha com esse código. Confira com o mestre.';
  porNaCampanha(camp, conta, 'jogador', agora);
  return camp;
}

/** O mestre gera um código novo (o antigo deixa de valer) ou desliga o convite. */
export function mudarConvite(db: Database, conta: Conta, id: unknown, acao: unknown): Campanha | string {
  const camp = (db.campanhasJogo ?? []).find((c) => c.id === id);
  if (!camp || papelEm(camp, conta.id) !== 'mestre') return 'Só o mestre da campanha mexe no convite.';
  if (acao === 'desligar') delete camp.convite;
  else if (acao === 'gerar') {
    const usados = new Set((db.campanhasJogo ?? []).map((c) => c.convite));
    let codigo = novoConvite(sorte);
    while (usados.has(codigo)) codigo = novoConvite(sorte);
    camp.convite = codigo;
  } else return 'Ação de convite inválida.';
  return camp;
}

/** O que mudou ao mexer na campanha: a conta que saiu do tabuleiro (o hotel desconecta) e o código de nova senha. */
export interface Mudanca {
  saiuDoTabuleiro?: Conta;
  senha?: { conta: Conta; codigo: string };
}

/**
 * Mexer na campanha (01/11): o mestre renomeia, apaga (a principal não), tira um jogador e gera o código de nova senha
 * de um jogador dela; qualquer um sai (o último mestre não). Quem sai da principal perde a ficha ligada à conta; o
 * mestre que sai dela vira jogador.
 */
export function mudarCampanha(db: Database, conta: Conta, id: unknown, acao: unknown, extra: { nome?: unknown; contaId?: unknown }): Mudanca | string {
  const camp = (db.campanhasJogo ?? []).find((c) => c.id === id);
  const meu = camp ? papelEm(camp, conta.id) : null;
  if (!camp || !meu) return 'Essa campanha não está na sua lista.';
  const mestres = camp.membros.filter((m) => m.papel === 'mestre').length;
  const tirar = (alvo: Conta): Mudanca => {
    camp.membros = camp.membros.filter((m) => m.contaId !== alvo.id);
    if (!camp.principal) return {};
    delete alvo.fichaId;
    alvo.papel = 'jogador';
    return { saiuDoTabuleiro: alvo };
  };
  if (acao === 'sair') {
    if (meu === 'mestre' && mestres <= 1) return camp.principal ? 'Você é o único mestre do tabuleiro: ele não fica sem mestre.' : 'Você é o único mestre: passe a campanha a outro mestre ou apague-a.';
    return tirar(conta);
  }
  if (meu !== 'mestre') return 'Só o mestre da campanha faz isso.';
  if (acao === 'renomear') {
    const nome = limparNome(extra.nome);
    if (nomeRuim(nome)) return nomeRuim(nome)!;
    if (nome === camp.nome) return {};
    const minhas = (db.campanhasJogo ?? []).filter((c) => c !== camp && papelEm(c, conta.id) === 'mestre');
    if (minhas.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) return 'Você já mestra uma campanha com esse nome.';
    camp.nome = nome;
    if (camp.principal) db.nomeCampanha = nome;
    return {};
  }
  if (acao === 'apagar') {
    if (camp.principal) return 'A campanha do tabuleiro não se apaga.';
    db.campanhasJogo = (db.campanhasJogo ?? []).filter((c) => c !== camp);
    return {};
  }
  if (acao === 'tirar' || acao === 'senha') {
    const alvo = (db.contas ?? []).find((c) => c.id === extra.contaId);
    const papel = alvo ? papelEm(camp, alvo.id) : null;
    if (!alvo || !papel) return 'Essa pessoa não está na campanha.';
    if (alvo.id === conta.id) return acao === 'tirar' ? 'Para sair, use "Sair da campanha".' : 'A sua senha você troca em Minha conta.';
    if (papel === 'mestre') return acao === 'tirar' ? 'Outro mestre sai sozinho; você não tira um mestre.' : 'O código de nova senha é só para jogadores.';
    if (acao === 'tirar') return tirar(alvo);
    return { senha: { conta: alvo, codigo: novoConvite(sorte) } };
  }
  return 'Ação inválida.';
}
