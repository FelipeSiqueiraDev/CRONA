import { footprint, getFurni, getWallFurni, RoomMap, WALL_PX_PER_TILE, Z_PX, type FloorItem, type WallItem } from '@crona/shared';
import type { RoomData } from './db';

/**
 * Item de parede atrás de móvel (08/10, pedido do Felipe): a TV, o quadro ou o painel de monitores na mesma parede em
 * que um móvel alto está encostado, mais baixo que o topo dele, aparecia "atrás" do móvel, como se estivesse dentro
 * dele (o painel de monitores do calabouço atrás dos racks). Um caso se corrige subindo o item um pouco; com muitas
 * salas, fica difícil achar depois. Isto acha os casos de uma sala e conserta: sobe o item um pouco (até 0,45 m), ou o
 * escorrega pela parede até um trecho livre (até 3 casas), ou sobe o quanto der. O teste paredes.test.ts garante que
 * nenhuma sala montada fica com o defeito.
 */

/** O pedaço da parede (ao longo dela, em casas) e a altura (base e topo) do item. */
function extensao(w: Pick<WallItem, 'defId' | 'pos' | 'z'>) {
  const d = getWallFurni(w.defId);
  if (!d) return null;
  const meia = d.w / WALL_PX_PER_TILE / 2;
  return { a0: w.pos - meia, a1: w.pos + meia, z0: w.z, z1: w.z + d.h / Z_PX };
}

/** O topo mais alto dos móveis encostados nesta parede que ficam na frente do item (0 = nenhum). */
export function topoNaFrente(items: FloorItem[], w: Pick<WallItem, 'defId' | 'wall' | 'plane' | 'pos' | 'z'>): number {
  const e = extensao(w);
  if (!e) return 0;
  let topo = 0;
  for (const it of items) {
    const d = getFurni(it.defId);
    if (!d || d.height <= 0 || d.flat || d.walkable) continue;
    if ((w.wall === 'l' ? it.x : it.y) !== w.plane) continue;
    const { sx, sy } = footprint(d, it.rot);
    const [b0, b1] = w.wall === 'l' ? [it.y, it.y + sy] : [it.x, it.x + sx];
    if (Math.min(e.a1, b1) - Math.max(e.a0, b0) <= 0.05) continue;
    const t = it.z + d.height;
    if (t > w.z + 0.1 && t > topo) topo = t;
  }
  return topo;
}

/** Outro item de parede no mesmo trecho e na mesma altura (não dá para pôr um em cima do outro). */
function bateEmOutro(room: RoomData, w: WallItem, pos: number, z: number) {
  const e = extensao({ defId: w.defId, pos, z });
  if (!e) return false;
  return room.wallItems.some((o) => {
    if (o === w || o.wall !== w.wall || o.plane !== w.plane) return false;
    const f = extensao(o);
    return !!f && Math.min(e.a1, f.a1) - Math.max(e.a0, f.a0) > 0.02 && Math.min(e.z1, f.z1) - Math.max(e.z0, f.z0) > 0.02;
  });
}

/** Conserta os itens de parede da sala que caíram atrás de móvel. Devolve o que mudou (para o log da montagem). */
export function desencostarItensDeParede(room: RoomData): string[] {
  const map = new RoomMap(room.heightmap, room.door);
  const feito: string[] = [];
  for (const w of room.wallItems) {
    const topo = topoNaFrente(room.items, w);
    if (!topo) continue;
    const livre = (pos: number, z: number) =>
      map.canPlaceWall(w.defId, w.wall, w.plane, pos, z).ok && !topoNaFrente(room.items, { ...w, pos, z }) && !bateEmOutro(room, w, pos, z);
    const subido = Math.round((topo + 0.12) * 100) / 100;
    let novo: { pos: number; z: number } | null = null;
    // 1) subir um pouco (até 0,45 m, ~0,7 unidade)
    if (subido - w.z <= 0.75 && livre(w.pos, subido)) novo = { pos: w.pos, z: subido };
    // 2) escorregar pela parede, na mesma altura, até 3 casas para cada lado (o mais perto primeiro)
    for (let k = 1; !novo && k <= 30; k++)
      for (const p of [w.pos - k / 10, w.pos + k / 10])
        if (livre(Math.round(p * 100) / 100, w.z)) {
          novo = { pos: Math.round(p * 100) / 100, z: w.z };
          break;
        }
    // 3) subir o quanto precisar, se couber na parede
    if (!novo && livre(w.pos, subido)) novo = { pos: w.pos, z: subido };
    if (!novo) {
      feito.push(`${room.name}: ${w.defId} (parede ${w.wall}, no ${w.pos}) continua atrás de um móvel: arrume à mão`);
      continue;
    }
    feito.push(`${room.name}: ${w.defId} ${novo.z !== w.z ? `subiu de ${w.z} para ${novo.z}` : `foi de ${w.pos} para ${novo.pos} na parede`}`);
    w.pos = novo.pos;
    w.z = novo.z;
  }
  return feito;
}
