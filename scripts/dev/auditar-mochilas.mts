/**
 * Confere as mochilas salvas contra o catálogo (03/11/2026): cada item existe, tem nome do livro, as modificações e
 * maldições existem e servem ao item, e a conta de categoria por patente (LR p. 52) bate com o que o motor diz.
 *
 *   npx tsx scripts/dev/auditar-mochilas.mts <fichas.json>
 */
import fs from 'node:fs';
import { regras } from '@crona/shared';

const C = regras.catalogo.CATALOGO as unknown as Record<string, { id: string; nome: string; categoria?: number }[]>;
const achar = (id: string) => ['armas', 'protecoes', 'equipamentos', 'amaldicoados'].map((g) => C[g].find((x) => x.id === id)).find(Boolean);
const mod = (id: string) => C.modificacoes.find((x) => x.id === id);
const mal = (id: string) => C.maldicoes.find((x) => x.id === id);
const fichas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as { id: number; nome: string; ficha: any }[];
for (const x of fichas) {
  const f = x.ficha;
  const k = regras.calcular(f);
  console.log(`\n#${x.id} ${x.nome} (NEX ${f.nex}%, patente ${f.patente ?? '?'}): ${(f.inventario ?? []).length} item(ns)`);
  for (const it of f.inventario ?? []) {
    const c = achar(it.id);
    const mods = (it.modificacoes ?? []).map((m: string) => (mod(m) ? mod(m)!.nome : `??${m}`));
    const mals = (it.maldicoes ?? []).map((m: string) => (mal(m) ? mal(m)!.nome : `??${m}`));
    const cat = regras.categoriaDoItem(it);
    console.log(`  - ${it.id}${c ? ` = "${c.nome}"` : ' ?? NÃO ESTÁ NO CATÁLOGO'} tipo=${it.tipo} cat=${cat}${mods.length ? ` mods[${mods.join(', ')}]` : ''}${mals.length ? ` maldições[${mals.join(', ')}]` : ''}${it.nome ? ` (nome salvo: ${it.nome})` : ''}`);
  }
  console.log('  limites: ' + k.itens.map((l: any) => `cat${l.categoria} ${l.usados}/${l.limite}`).join('  ') + `  carga ${k.carga?.usada ?? '?'}/${k.carga?.limite ?? '?'}`);
  for (const e of k.erros ?? []) if (/ite|carga|categoria|propor/i.test(e.mensagem ?? String(e))) console.log('  ERRO/AVISO: ' + (e.mensagem ?? e));
}
