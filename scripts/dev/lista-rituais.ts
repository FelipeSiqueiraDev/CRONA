// Lista os rituais do catálogo (id, nome, elemento, círculo) para o pedido de arte dos rituais.
//   npx tsx scripts/dev/lista-rituais.ts
import { regras } from '@crona/shared';

const lista = regras.catalogo.CATALOGO.rituais as unknown as { id: string; nome: string; elemento: string; circulo: number }[];
const porElemento = new Map<string, typeof lista>();
for (const r of lista) porElemento.set(r.elemento, [...(porElemento.get(r.elemento) ?? []), r]);
for (const [el, rs] of porElemento) {
  console.log(`\n## ${el} (${rs.length})`);
  for (const r of rs) console.log(`${r.id}\t${r.nome}\t${r.circulo}º`);
}
console.log(`\ntotal: ${lista.length}`);
