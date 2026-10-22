/**
 * Auditoria das fichas (22/10/2026, o Felipe: "as escolhas que eles fizeram e as que têm pra fazer: TEM que estar TUDO
 * de acordo com as regras"). Só lê: o JSON das fichas salvas (jsonb_agg da tabela `fichas`) e o motor de regras.
 *
 *   npx tsx scripts/dev/auditar-fichas.mts <fichas.json>
 *
 * Para cada ficha: o que foi escolhido em cada NEX, o que falta (pendências), os erros e avisos do motor, as contas
 * de PV/PE/SAN refeitas à parte pelas tabelas do livro (LR p. 24, 27 e 31; decisão do Felipe de 19/10: o aumento de
 * Vigor/Presença só vale do NEX do aumento em diante) e a contagem de escolhas por NEX contra o que o livro dá.
 */
import fs from 'node:fs';
import { regras } from '@crona/shared';

const { calcular, ganhosDoNex, nexAte, patamar } = regras;
type Ficha = regras.Ficha;
type Nex = regras.Nex;

const fichas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as { id: number; nome: string; npc?: string; ficha: Ficha }[];

/** (base no NEX 5%, ganho por NEX seguinte) por classe, do livro. */
const TAB: Record<string, { pv: [number, number]; pe: [number, number]; san: [number, number] }> = {
  combatente: { pv: [20, 4], pe: [2, 2], san: [12, 3] },
  especialista: { pv: [16, 3], pe: [3, 3], san: [16, 4] },
  ocultista: { pv: [12, 2], pe: [4, 4], san: [20, 5] },
};

const totais: string[] = [];
for (const x of fichas) {
  const f = x.ficha;
  const k = calcular(f);
  const ate = nexAte(f.nex, f.comecouMundano ? 0 : 5);
  console.log(`\n=================== #${x.id} ${x.nome}${x.npc ? ` (npc ${x.npc})` : ''}: ${f.classe ?? 'mundano'}/${f.trilha ?? '-'} NEX ${f.nex}% origem ${f.origem}`);
  console.log(`atributos de criação ${JSON.stringify(f.atributos)} | no fim ${JSON.stringify(k.atributos)} | pp ${f.pp} patente ${k.patente?.nome}`);
  console.log(`perícias: origem ${JSON.stringify(f.pericias.origem ?? [])} grupos ${JSON.stringify(f.pericias.grupos)} livres ${JSON.stringify(f.pericias.livres)}`);
  for (const n of ate) {
    const e = f.progressao[n];
    if (e && Object.keys(e).length) console.log(`  NEX ${n}: ${JSON.stringify(e)}`);
  }
  const alem = Object.keys(f.progressao).map(Number).filter((n) => n > f.nex);
  if (alem.length) console.log(`  !! escolhas em NEX acima do da ficha: ${alem.join(', ')}`);
  console.log(`PV ${k.pv} PE ${k.pe} SAN ${k.san} | Def ${k.defesa} (prot ${k.protecao}) desl ${k.deslocamento} | limPE ${k.limitePe} | DT rit ${k.dtRituais} | carga ${k.carga.usados}/${k.carga.maximo}${k.carga.sobrecarregado ? ' SOBRECARREGADO' : ''}`);

  // ---- PV/PE/SAN refeitos pelo livro
  const t = f.classe ? TAB[f.classe] : undefined;
  if (t) {
    const atrEm = (n: Nex, a: 'vig' | 'pre') => {
      let v = f.atributos[a];
      for (const m of nexAte(n, 5)) {
        if (f.progressao[m]?.atributo === a) v += 1;
        if (f.progressao[m]?.atributoTreino === a) v += 1;
      }
      return v;
    };
    let pv = t.pv[0] + atrEm(5, 'vig');
    let pe = t.pe[0] + atrEm(5, 'pre');
    let san = t.san[0];
    for (const n of nexAte(f.nex, 10)) {
      pv += t.pv[1] + atrEm(n, 'vig');
      pe += t.pe[1] + atrEm(n, 'pre');
      san += t.san[1];
    }
    console.log(`  livro (aumento só do NEX em diante): PV ${pv} PE ${pe} SAN ${san}  | motor: PV ${k.pv} PE ${k.pe} SAN ${k.san}  | ajustes ${JSON.stringify(f.ajustes ?? {})}`);
    if (pv !== k.pv || pe !== k.pe || san !== k.san) console.log(`  >> DIFERENÇA PV ${k.pv - pv} PE ${k.pe - pe} SAN ${k.san - san} (poderes/origem/itens podem explicar)`);
  }

  // ---- contagem do que o livro dá em cada NEX x o que a ficha tem
  const esperado: string[] = [];
  for (const n of ate) for (const g of ganhosDoNex(f.classe, n, f.comecouMundano)) esperado.push(`${n}:${g.tipo}`);
  console.log(`  ganhos esperados: ${esperado.join(' ')}`);

  console.log(`  poderes: ${k.poderes.map((p) => `${p.nome}[${p.tipo}@${p.nex}]`).join(' · ')}`);
  console.log(`  rituais (${k.rituais.length}): ${k.rituais.map((r) => `${r.id}@${r.nex}`).join(' · ')}`);
  console.log(`  perícias: ${Object.entries(k.pericias).filter(([, v]) => v.grau !== 'destreinado').map(([p, v]) => `${p}:${v.grau[0]}`).join(' ')}`);
  console.log(`  itens: ${f.inventario.map((i) => `${i.apelido ?? i.id}${i.modificacoes?.length ? '+' + i.modificacoes.join('+') : ''}${i.achado ? '(achado)' : ''}`).join(' · ') || '(vazia)'}`);
  console.log(`  limites de itens: ${k.itens.map((l) => `cat${l.categoria} ${l.usados}/${l.limite}`).join(' ')}`);
  console.log(`  PENDÊNCIAS (${k.pendencias.length}):`);
  for (const p of k.pendencias) console.log(`    - NEX ${p.nex} [${p.tipo}] ${p.texto}`);
  console.log(`  PROBLEMAS (${k.problemas.length}):`);
  for (const p of k.problemas) console.log(`    - ${p.severidade.toUpperCase()} NEX ${p.nex} ${p.onde}: ${p.texto}`);
  if (f.avisos?.length) console.log(`  AVISOS DO MESTRE: ${f.avisos.map((a) => a.slice(0, 90)).join(' || ')}`);
  totais.push(`${x.nome}: ${k.pendencias.length} pend, ${k.problemas.filter((p) => p.severidade === 'erro').length} erros, ${k.problemas.filter((p) => p.severidade === 'aviso').length} avisos`);
}
console.log('\n---- TOTAIS\n' + totais.join('\n'));
void patamar;
