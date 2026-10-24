// bancada provisória (23/10): as salas de um lugar, montadas pelo seed em memória, no formato do RoomView.enter
import { writeFileSync } from 'node:fs';
import { seedDb, upgradeDb } from '../../server/src/seed';

const prefixo = process.argv[2] ?? '';
const db = seedDb();
upgradeDb(db);
const salas = db.rooms
  .filter((r) => r.name.startsWith(prefixo))
  .map((r) => ({
    nome: r.name,
    info: {
      id: r.id, name: r.name, description: r.description, owner: r.owner, heightmap: r.heightmap, door: r.door,
      darkness: r.darkness, lightMode: r.lightMode ?? 'normal', fog: r.fog ?? 0, publicBuild: r.publicBuild, floor: r.floor,
      area: r.area, floorStyle: r.floorStyle, aberto: r.aberto, terreno: r.terreno, ambient: r.ambient, particles: r.particles,
      particleLevel: r.particleLevel, canBuild: false, isOwner: false,
    },
    items: r.items,
    walls: r.wallItems ?? [],
  }));
writeFileSync('client/bancada-salas.json', JSON.stringify(salas));
console.log(salas.map((s) => s.nome).join('\n'));
