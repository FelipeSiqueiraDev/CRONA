import type { regras } from '@crona/shared';
import type { Database } from './db';

/**
 * A evolução dos Marcados (21/10, o Felipe: "a evolução dos 25% pra geral e 30% pro Tepes"): Catarina, Cora e Alosi
 * sobem para NEX 25% e o D.Tepes para 30%. O que o livro dá sozinho entra pelo motor (PV, PE, SAN, habilidade de
 * trilha); o que o jogador precisa escolher vira aviso na ficha, para quando ele logar.
 *
 * Roda uma vez na subida do servidor (`db.fichasCris['evolucao-2110']`); depois disso a evolução é do mestre.
 */
const EVOLUIR: { nome: string; nex: number; aviso: string }[] = [
  { nome: 'D.Tepes', nex: 30, aviso: 'Evoluiu para NEX 30%: escolha o poder novo (na aba Evolução).' },
  { nome: 'Catarina Albuquerque', nex: 25, aviso: 'Evoluiu para NEX 25%: a habilidade de trilha nova entra sozinha; segue faltando escolher as duas perícias do Perito.' },
  { nome: 'Cora Falcão', nex: 25, aviso: 'Evoluiu para NEX 25%: a habilidade de trilha nova entra sozinha, nada a escolher.' },
  { nome: 'Alosi Walker', nex: 25, aviso: 'Evoluiu para NEX 25%: escolha o ritual novo e o do Saber Ampliado (na aba Evolução).' },
];

type DbCris = Database & { fichasCris?: Record<string, number> };

export function evolucaoMarcados2110(db: Database): boolean {
  const feitas = ((db as DbCris).fichasCris ??= {});
  if (feitas['evolucao-2110'] !== undefined) return false;
  let n = 0;
  for (const e of EVOLUIR) {
    const f = (db.fichas ?? []).find((x) => x.nome === e.nome && !x.npc);
    if (!f || f.ficha.nex >= e.nex) continue;
    f.ficha.nex = e.nex as regras.Nex;
    f.ficha.avisos = [...(f.ficha.avisos ?? []), e.aviso];
    f.atualizadaEm = new Date().toISOString();
    n++;
  }
  feitas['evolucao-2110'] = n;
  return n > 0;
}

/**
 * O aviso de "você evoluiu" passou a vir da própria ficha (`nexVisto`, o NEX que o jogador já viu): os quatro
 * ficam marcados no NEX de antes (20%) e os avisos de texto da primeira rodada saem (diziam errado que a Catarina e a
 * Cora ganhavam habilidade de trilha em 25%: o livro dá, nesse NEX, o Ataque Especial e o Perito mais fortes e,
 * ao ocultista, o 2º círculo). Uma vez só.
 */
export function avisoDeEvolucao2110(db: Database): boolean {
  const feitas = ((db as DbCris).fichasCris ??= {});
  if (feitas['evolucao-2110-aviso'] !== undefined) return false;
  let n = 0;
  for (const e of EVOLUIR) {
    const f = (db.fichas ?? []).find((x) => x.nome === e.nome && !x.npc);
    if (!f) continue;
    if (f.ficha.nexVisto === undefined) f.ficha.nexVisto = 20;
    // os avisos que mandavam procurar a escolha "na aba Evolução" saem: a janela de evolução já traz essas escolhas
    const sobra = (f.ficha.avisos ?? []).filter((t) => !t.startsWith('Evoluiu para NEX') && !t.includes('na aba Evolução'));
    if (sobra.length) f.ficha.avisos = sobra;
    else delete f.ficha.avisos;
    f.atualizadaEm = new Date().toISOString();
    n++;
  }
  feitas['evolucao-2110-aviso'] = n;
  return n > 0;
}
