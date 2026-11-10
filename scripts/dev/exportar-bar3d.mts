// Exporta a cena do Bar da Ordem (a cópia crona_visual, só leitura) para o protótipo 3D: client/public/prototipo3d/bar.json.
//   npx tsx scripts/dev/exportar-bar3d.mts [id da cena]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FURNI, WALL_FURNI, Z_PER_M, M_POR_CASA } from '@crona/shared';

const id = Number(process.argv[2] ?? 33);
const psql = (sql: string) => execFileSync('docker', ['exec', 'crona-postgres', 'psql', '-U', 'crona', '-d', 'crona_visual', '-At', '-c', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const cena = JSON.parse(psql(`select dados::text from cenas where id=${id}`));
const mobis = psql(`select dados::text from mobis where cena_id=${id} order by ordem`).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const parede = psql(`select dados::text from mobis_parede where cena_id=${id} order by ordem`).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const defs: Record<string, unknown> = {};
for (const m of mobis) {
  const d = FURNI[m.defId];
  if (!d || defs[m.defId]) continue;
  defs[m.defId] = { id: d.id, name: d.name, kind: d.kind, category: d.category, width: d.width, depth: d.depth, alturaM: Math.round((d.height / Z_PER_M) * 1000) / 1000, walkable: !!d.walkable, sit: !!d.sit, flat: !!d.flat, states: d.states ?? 1, vazio: d.vazio ?? null, vao: d.vao ?? null, colors: d.colors, aumento: d.aumento ?? 1 };
}
const defsParede: Record<string, unknown> = {};
for (const m of parede) {
  const d = WALL_FURNI[m.defId];
  if (d && !defsParede[m.defId]) defsParede[m.defId] = { id: d.id, name: d.name, kind: d.kind, w: d.w, h: d.h, colors: d.colors };
}
const out = { cena: { id: cena.id, nome: cena.name, descricao: cena.description, heightmap: cena.heightmap, door: cena.door, ambient: cena.ambient, darkness: cena.darkness, fog: cena.fog, floorStyle: cena.floorStyle, particles: cena.particles }, mobis, parede, defs, defsParede, M_POR_CASA, Z_PER_M };
const dest = path.resolve('client/public/prototipo3d/bar.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('gravado', dest, mobis.length, 'mobis', parede.length, 'de parede', Object.keys(defs).length, 'tipos');
