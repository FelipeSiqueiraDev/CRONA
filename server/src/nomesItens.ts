import type { Database } from './db';

/**
 * Nomes de itens salvos nas mochilas que não batem com o livro (conferência de itens de 03/11/2026): a jaqueta do
 * Veríssimo é "Jaqueta de Veríssimo" (LR p. 151), e a ficha dele guardava "Jaqueta do Veríssimo". Troca só o nome de
 * exibição; o id e o tipo ficam, para não mexer nas contas de categoria da mochila dele. Roda uma vez.
 */
const NOMES: [id: string, de: string, para: string][] = [['jaqueta-do-verissimo', 'Jaqueta do Veríssimo', 'Jaqueta de Veríssimo']];

export function nomesDeItens0311(db: Database): boolean {
  const d = db as Database & { nomesItens0311?: boolean };
  if (d.nomesItens0311) return false;
  d.nomesItens0311 = true;
  let mexeu = false;
  for (const f of db.fichas ?? [])
    for (const it of f.ficha.inventario ?? [])
      for (const [id, de, para] of NOMES)
        if (it.id === id && it.nome === de) {
          it.nome = para;
          f.atualizadaEm = new Date().toISOString();
          mexeu = true;
        }
  return mexeu;
}
