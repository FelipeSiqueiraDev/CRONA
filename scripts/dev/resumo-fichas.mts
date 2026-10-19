// Um resumo de combate de cada ficha (lida de um JSON com a lista de fichas salvas), pelo motor.
//   npx tsx scripts/dev/resumo-fichas.mts <fichas.json>
import fs from 'node:fs';
import { regras } from '@crona/shared';

const fichas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as { nome: string; ficha: regras.Ficha }[];
for (const f of fichas) {
  const k = regras.calcular(f.ficha);
  const a = k.atributos;
  const per = Object.entries(k.pericias)
    .filter(([, v]) => v.grau && v.grau !== 'destreinado')
    .map(([p, v]) => `${p}(${v.grau[0]}${v.bonus ? '+' + v.bonus : ''})`)
    .join(' ');
  console.log(`\n=== ${f.nome}: ${f.ficha.classe ?? 'mundano'}/${f.ficha.trilha ?? '-'} NEX ${f.ficha.nex}% origem ${f.ficha.origem}`);
  console.log(`  AGI ${a.agi} FOR ${a.for} INT ${a.int} PRE ${a.pre} VIG ${a.vig} | PV ${k.pv} PE ${k.pe} SAN ${k.san} | Def ${k.defesa} desl ${k.deslocamento} | limPE ${k.limitePe} DTrit ${k.dtRituais}`);
  console.log(`  reações: esquiva ${k.reacoes.esquiva ?? '-'} bloqueio ${k.reacoes.bloqueio ?? '-'} contra ${k.reacoes.contraAtaque} | RD ${JSON.stringify(k.resistencias)}`);
  console.log(`  perícias: ${per}`);
  console.log(`  ataques: ${k.ataques.map((x: any) => `${x.nome} [${x.dados ?? ''}d20+${x.bonus ?? 0} | ${x.dano} ${x.tipo ?? ''}]`).join(' · ')}`);
  console.log(`  poderes: ${k.poderes.map((p: any) => p.nome).join(' · ')}`);
  console.log(`  rituais (${k.rituais.length}): ${k.rituais.map((r: any) => r.nome ?? r.id).join(' · ')}`);
  console.log(`  itens: ${(f.ficha.inventario ?? []).map((i: any) => i.apelido ?? i.nome ?? i.id).join(' · ')}`);
}
