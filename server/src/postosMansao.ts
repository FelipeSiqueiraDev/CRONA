import { RoomMap } from '@crona/shared';
import type { Database, RoomData } from './db';
import { MANSAO } from './seedMansaoAlbuquerque';

/**
 * Os empregados e a família da Mansão Albuquerque nos postos (24/10, o Felipe: "era pra ter os empregados nos seus
 * postos"): as peças tinham entrado todas numa fileira no Salão Principal. Cada uma vai para o cômodo dela, na casa
 * livre mais perto do posto. Só mexe na peça que ainda está no Salão (a que o mestre já levou para outro lugar fica).
 * Roda uma vez (`db.postosMansao2410`).
 */
interface Posto {
  /** o nome da peça */
  nome: string;
  /** o cômodo, sem o "Mansão Albuquerque · " */
  sala: string;
  /** a casa do posto; sem ela, a porta do cômodo */
  x?: number;
  y?: number;
  /** pode ficar sentado (o trono do escritório) */
  sentado?: boolean;
}

const POSTOS: Posto[] = [
  { nome: 'Antônio Valença', sala: 'Salão Principal' }, // o mordomo, na entrada
  { nome: 'Helena Duarte', sala: 'Corredor dos Funcionários', x: 8, y: 1 }, // a governanta
  { nome: 'Lúcia Moreira', sala: 'Cozinha', x: 5, y: 3 }, // a cozinheira
  { nome: 'Roberto Salles', sala: 'Jardim', x: 22, y: 51 }, // a segurança, no portão
  { nome: 'Tiago Nobre', sala: 'Jardim', x: 9, y: 33 }, // o jardineiro, nos canteiros
  { nome: 'Alexander Albuquerque', sala: 'Escritório de Alexander', x: 4, y: 3, sentado: true },
  { nome: 'Arthur Albuquerque', sala: 'Biblioteca', x: 7, y: 6 },
  { nome: 'Marina Ferraz', sala: 'Biblioteca', x: 9, y: 6 }, // a secretária, junto do Arthur
];

/** A casa livre (de andar, ou de sentar) mais perto do posto, sem outra peça em cima. */
function casaPerto(r: RoomData, x: number, y: number, sentado: boolean): [number, number] | null {
  const map = new RoomMap(r.heightmap, r.door, r.items, r.wallItems);
  const ocupadas = new Set((r.tokens ?? []).map((t) => `${t.x},${t.y}`));
  let melhor: [number, number] | null = null;
  let dist = Infinity;
  for (let cy = 0; cy < map.height; cy++)
    for (let cx = 0; cx < map.width; cx++) {
      const w = map.walkState(cx, cy);
      if (w === 'blocked' || (w === 'sit' && !sentado) || ocupadas.has(`${cx},${cy}`)) continue;
      const d = Math.hypot(cx - x, cy - y);
      if (d < dist) [melhor, dist] = [[cx, cy], d];
    }
  return melhor;
}

export function postosMansao2410(db: Database): boolean {
  const d = db as Database & { postosMansao2410?: boolean };
  if (d.postosMansao2410) return false;
  d.postosMansao2410 = true;
  const salao = db.rooms.find((r) => r.name === MANSAO + 'Salão Principal');
  if (!salao?.tokens) return true;
  for (const p of POSTOS) {
    const t = salao.tokens.find((q) => q.name === p.nome);
    const r = db.rooms.find((q) => q.name === MANSAO + p.sala);
    if (!t || !r) continue;
    const casa = casaPerto(r, p.x ?? r.door.x, p.y ?? r.door.y, !!p.sentado);
    if (!casa) continue;
    salao.tokens.splice(salao.tokens.indexOf(t), 1);
    [t.x, t.y] = casa;
    (r.tokens ??= []).push(t);
  }
  return true;
}
