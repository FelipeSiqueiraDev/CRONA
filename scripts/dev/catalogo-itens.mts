/**
 * Lista o catálogo de itens (armas, proteções, equipamentos, modificações, amaldiçoados) em linhas simples, para
 * conferir nome, categoria, espaços e números contra as tabelas do livro (03/11/2026, o Felipe: "se os nomes batem
 * com o do livro"). Só lê.
 *
 *   npx tsx scripts/dev/catalogo-itens.mts [armas|protecoes|equipamentos|modificacoes|amaldicoados|maldicoes]
 */
import { regras } from '@crona/shared';

const C = regras.catalogo.CATALOGO as unknown as Record<string, any[]>;
const so = process.argv[2];
const linha = (grupo: string, x: any): string => {
  const p: (string | number | undefined)[] = [grupo, x.id, x.nome, `${x.ref?.fonte ?? '?'} ${x.ref?.pagina ?? '?'}`, `cat ${x.categoria ?? '-'}`, `esp ${x.espacos ?? '-'}`];
  if (x.dano) p.push(`dano ${x.dano}`);
  if (x.critico) p.push(`crit ${x.critico.margem}/x${x.critico.multiplicador}`);
  if (x.alcance) p.push(`alc ${x.alcance}`);
  if (x.tipoDano) p.push(`tipo ${[].concat(x.tipoDano).join(',')}`);
  if (x.defesa !== undefined) p.push(`def ${x.defesa}`);
  return p.join(' | ');
};
for (const g of ['armas', 'protecoes', 'equipamentos', 'modificacoes', 'amaldicoados', 'maldicoes']) {
  if (so && so !== g) continue;
  for (const x of C[g] ?? []) console.log(linha(g, x));
}
