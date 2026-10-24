/**
 * O que está no desenho de reserva (23/10): os móveis e os itens de parede do catálogo sem arte no `moveis.json`, e as
 * cenas que usam cada um (no banco do jogo, lido por um JSON das cenas: `select jsonb_agg(...)`). Também as pastas de arte
 * de móvel que nenhum item do catálogo usa. Só lê.
 *
 *   npx tsx scripts/dev/arte-faltando.mts <moveis-por-cena.json>
 */
import fs from 'node:fs';
import { FURNI_LIST, WALL_FURNI_LIST } from '../../shared/src/furni';

const moveis = JSON.parse(fs.readFileSync('client/public/arte/mobiliario/moveis.json', 'utf8')) as Record<string, unknown>;
const usados = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as { def: string; n: number; cenas: string[] }[];
const uso = new Map(usados.map((u) => [u.def, u]));
const comArte = (id: string) => id in moveis || Object.keys(moveis).some((k) => k.split('~')[0] === id);
const falta = [...FURNI_LIST.map((d) => ({ id: d.id, nome: d.name, parede: false })), ...WALL_FURNI_LIST.map((d) => ({ id: d.id, nome: d.name, parede: true }))]
  .filter((d) => !comArte(d.id))
  .map((d) => ({ ...d, n: uso.get(d.id)?.n ?? 0, cenas: uso.get(d.id)?.cenas ?? [] }))
  .sort((a, b) => b.n - a.n);
const emUso = falta.filter((d) => d.n > 0);
console.log(`SEM ARTE E EM USO NO JOGO (${emUso.length}):`);
for (const d of emUso) console.log(`  ${d.parede ? '[parede] ' : ''}${d.id} (${d.nome}): ${d.n}× em ${d.cenas.slice(0, 4).join(', ')}${d.cenas.length > 4 ? ` +${d.cenas.length - 4}` : ''}`);
console.log(`\nSEM ARTE E SEM USO (${falta.length - emUso.length}): ${falta.filter((d) => !d.n).map((d) => d.id).join(', ')}`);
const ids = new Set([...FURNI_LIST, ...WALL_FURNI_LIST].map((d) => d.id));
const orfas = Object.keys(moveis).filter((k) => !ids.has(k.split('~')[0]));
console.log(`\nARTE PRONTA SEM ITEM NO CATÁLOGO (${orfas.length}): ${orfas.join(', ')}`);
