import { combate } from '@crona/shared';
import type { Database } from './db';

/**
 * Os PV das criaturas do livro que passam de 999 (03/11, o Felipe: "a Magistrada não tem 999 de vida"): o teto dos
 * totais era 999 (`VITAL_LIMIT`), e a Magistrada (1200, LR p. 252) foi para o tabuleiro cortada em 999/999. Uma vez só
 * (`db.vidaAcima999`): a peça de criatura do livro com PV total exatamente 999 sobe ao PV do livro, e o PV atual
 * também, se estava cheio (999). Peça machucada, ou com outro total (o mestre mexeu), fica como está.
 */
const livro = (id: string) => combate.AMEACAS_LIVRO.find((a: combate.AmeacaLivro) => a.id === id) ?? combate.AMEACAS_LIVRO.find((a: combate.AmeacaLivro) => a.id === id.split('-')[0]);

export function vidaAcima999(db: Database): boolean {
  const d = db as Database & { vidaAcima999?: boolean };
  if (d.vidaAcima999) return false;
  d.vidaAcima999 = true;
  let mexeu = false;
  for (const r of db.rooms)
    for (const t of r.tokens ?? []) {
      const v = t.vitals;
      const pv = t.criatura ? livro(t.criatura.id)?.pv : undefined;
      if (!v || !pv || pv <= 999 || v.pvMax !== 999) continue;
      t.vitals = { ...v, pvMax: pv, pv: v.pv === 999 ? pv : v.pv };
      mexeu = true;
    }
  return mexeu;
}
