// Desenha em texto as casas de um cômodo da Sede: onde se anda, o que bloqueia, e quem está onde.
//   npx tsx scripts/dev/mapa-casas.ts Enfermaria
import { getFurni } from '@crona/shared';
import { Hotel } from '../../server/src/hotel';
import { seedDb, upgradeDb } from '../../server/src/seed';
import { SEDE } from '../../server/src/seedSede';

const nome = process.argv[2] ?? 'Enfermaria';
const db = seedDb();
upgradeDb(db);
const hotel = new Hotel({ db, persist: false, timers: false });
const r = hotel.db.rooms.find((x) => x.name === SEDE + nome);
if (!r) throw new Error(`sem o cômodo ${nome}`);
const room = hotel.rooms.get(r.id)!;
const map = (room as unknown as { map: import('@crona/shared').RoomMap }).map;
const linhas = r.heightmap.split(/\r?\n/);
const h = linhas.length;
const w = Math.max(...linhas.map((l) => l.length));
const letra = new Map<string, string>();
const usadas = new Set<string>();
const marca = (defId: string) => {
  if (letra.has(defId)) return letra.get(defId)!;
  const base = (getFurni(defId)?.name ?? defId).toUpperCase().replace(/[^A-Z]/g, '');
  let c = [...base].find((x) => !usadas.has(x)) ?? '?';
  usadas.add(c);
  letra.set(defId, c);
  return c;
};
console.log('    ' + [...Array(w).keys()].map((x) => String(x % 10)).join(''));
for (let y = 0; y < h; y++) {
  let s = '';
  for (let x = 0; x < w; x++) {
    const ws = map.walkState(x, y);
    if (map.floorHeight(x, y) === null) s += ' ';
    else if (ws === 'blocked') {
      const its = map.itemsAt(x, y).filter((it) => !getFurni(it.defId)?.walkable);
      s += its.length ? marca(its[its.length - 1].defId) : '#';
    } else s += ws === 'sit' ? 's' : '.';
  }
  console.log(String(y).padStart(3) + ' ' + s);
}
console.log([...letra].map(([d, c]) => `${c} = ${getFurni(d)?.name ?? d}`).join('\n'));
