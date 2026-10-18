/**
 * As fichas dos Marcados no CRONA ao lado das do C.R.I.S (18/10, o Felipe: "as fichas dos marcados têm que estar
 * iguais às do C.R.I.S, tudinho"). Só lê: o JSON do C.R.I.S (agent_sheets, exportado à parte) e as fichas do banco.
 *
 *   npx tsx scripts/dev/comparar-cris.mts <cris.json> <crona-fichas.json>
 */
import fs from 'node:fs';
import { regras } from '@crona/shared';

const [crisArq, cronaArq] = process.argv.slice(2);
const cris = JSON.parse(fs.readFileSync(crisArq, 'utf8')) as Record<string, any>[];
const crona = JSON.parse(fs.readFileSync(cronaArq, 'utf8')) as { id: number; nome: string; atual: Record<string, number>; ficha: any }[];

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const ATR: Record<string, string> = { agi: 'agi', forca: 'for', intel: 'int', pre: 'pre', vig: 'vig' };

for (const c of cris) {
  const nome = c.character_name as string;
  const x = crona.find((f) => sem(f.nome).replace('d', '') === sem(nome).replace('d', '') || sem(f.nome) === sem(nome));
  console.log(`\n================ ${nome} (CRONA: ${x?.nome ?? 'NÃO ACHEI'})`);
  if (!x) continue;
  const k = regras.calcular(x.ficha);
  const linha = (rot: string, a: unknown, b: unknown) => console.log(`${a === b ? '  ' : '≠ '}${rot.padEnd(22)} C.R.I.S ${String(a).padEnd(14)} CRONA ${String(b)}`);
  for (const [a, b] of Object.entries(ATR)) linha(`atributo ${b}`, c[a], k.atributos[b as 'agi']);
  linha('PV máx', c.pv_max, k.pv);
  linha('PE máx', c.pe_max, k.pe);
  linha('SAN máx', c.san_max, k.san);
  linha('PV atual', c.pv, x.atual?.pv);
  linha('PE atual', c.pe, x.atual?.pe);
  linha('SAN atual', c.san, x.atual?.san);
  linha('limite PE', c.pe_por_rodada, k.limitePe);
  linha('Defesa', c.defesa, k.defesa);
  linha('deslocamento', c.deslocamento, k.deslocamento);
  linha('DT rituais', c.dt_rituais, k.dtRituais);
  linha('esquiva', c.tem_esquiva ? c.esquiva : '-', k.reacoes.esquiva ?? '-');
  linha('bloqueio', c.tem_bloqueio ? c.bloqueio : '-', k.reacoes.bloqueio ?? '-');
  linha('contra-ataque', c.tem_contra_ataque, k.reacoes.contraAtaque);
  linha('patente', c.patente, k.patente?.nome);
  linha('resistências', JSON.stringify(JSON.parse(c.res_elementos_json || '{}')), JSON.stringify(k.resistencias));
  linha('carga', '', `${k.carga.usados}/${k.carga.maximo}`);
  const pc = Object.entries(JSON.parse(c.pericias_json) as Record<string, string>).filter(([, v]) => v).map(([p, v]) => `${sem(p)}:${v}`).sort();
  const pk = Object.entries(k.pericias).filter(([, v]: any) => v.grau && v.grau !== 'destreinado').map(([p, v]: any) => `${sem(p)}:${v.grau}`).sort();
  console.log('  perícias C.R.I.S:', pc.join(' '));
  console.log('  perícias CRONA  :', pk.join(' '));
  console.log('  ≠ só no C.R.I.S:', pc.filter((p) => !pk.some((q) => q.split(':')[0] === p.split(':')[0])).join(' '));
  console.log('  ≠ só no CRONA  :', pk.filter((p) => !pc.some((q) => q.split(':')[0] === p.split(':')[0])).join(' '));
  console.log('  poderes C.R.I.S:', (JSON.parse(c.habilidades_json) as { name: string }[]).map((h) => h.name).join(' · '));
  console.log('  poderes CRONA  :', k.poderes.map((p: any) => p.nome ?? p.id).join(' · '));
  console.log('  rituais C.R.I.S:', (JSON.parse(c.rituais_json) as { name: string }[]).map((h) => h.name).join(' · '));
  console.log('  rituais CRONA  :', k.rituais.map((p: any) => p.nome ?? p.id).join(' · '));
  console.log('  ataques C.R.I.S:', (JSON.parse(c.ataques_json) as any[]).map((a) => `${a.arma} [${a.teste} | ${a.dano} | ${a.critico}]`).join(' · '));
  console.log('  ataques CRONA  :', k.ataques.map((a: any) => `${a.nome} [${JSON.stringify(a.teste ?? a.dados ?? '')} | ${a.dano} | ${a.critico ?? a.margem ?? ''}]`).join(' · '));
  console.log('  itens C.R.I.S:', (JSON.parse(c.inventario_json) as any[]).map((i) => `${i.item}(${i.espacos}${i.mods?.length ? ' ' + i.mods.join('+') : ''})`).join(' · '));
  console.log('  itens CRONA  :', (x.ficha.inventario as any[]).map((i) => `${i.apelido ?? i.nome ?? i.id}${i.modificacoes?.length ? ' ' + i.modificacoes.join('+') : ''}${i.tipo === 'cena' ? ' [achado]' : ''}`).join(' · '));
  if (k.problemas.length) console.log('  problemas do motor:', k.problemas.map((p: any) => p.texto ?? JSON.stringify(p)).join(' | '));
  if (k.pendencias.length) console.log('  pendências:', k.pendencias.map((p: any) => p.texto ?? p.tipo ?? JSON.stringify(p)).join(' | '));
}
