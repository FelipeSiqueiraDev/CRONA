import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIRS, footprint, getFurni, getWallFurni, RoomMap, WALL_PX_PER_TILE, Z_PER_M, Z_PX } from '@crona/shared';
import { seedDb, upgradeDb } from '../src/seed';
import { eManchaNaParede } from '../src/paredes';

/**
 * Item de parede atrás de móvel (08/10, pedido do Felipe): a TV, o quadro ou o painel de monitores na mesma parede em
 * que um móvel alto está encostado, mais baixo que o topo dele, aparece "atrás" do móvel, como se estivesse dentro
 * dele. Um caso só se corrige subindo o item; muitas salas com o mesmo problema ficam difíceis de achar depois. Este
 * teste olha todas as salas montadas e reprova qualquer item de parede que caia atrás de um móvel encostado na
 * mesma parede.
 */
test('nenhum item de parede fica atrás de um móvel encostado na mesma parede', () => {
  const db = seedDb();
  upgradeDb(db);
  const erros: string[] = [];
  for (const room of db.rooms) {
    for (const w of room.wallItems) {
      const wd = getWallFurni(w.defId);
      if (!wd || eManchaNaParede(w.defId)) continue;
      // o pedaço da parede que o item ocupa (32 px por casa ao longo da parede) e a altura da base dele
      const meia = wd.w / 32 / 2;
      const a0 = w.pos - meia;
      const a1 = w.pos + meia;
      for (const it of room.items) {
        const d = getFurni(it.defId);
        if (!d || d.height <= 0 || d.flat || d.walkable) continue;
        // só o que está encostado nesta parede (a primeira fileira de casas dela)
        if ((w.wall === 'l' ? it.x : it.y) !== w.plane) continue;
        const { sx, sy } = footprint(d, it.rot);
        const [b0, b1] = w.wall === 'l' ? [it.y, it.y + sy] : [it.x, it.x + sx];
        if (Math.min(a1, b1) - Math.max(a0, b0) <= 0.05) continue;
        const topo = it.z + d.height;
        if (topo > w.z + 0.1)
          erros.push(`${room.name}: ${w.defId} (parede ${w.wall}, no ${w.pos}, base ${w.z}) atrás de ${it.defId} em (${it.x}, ${it.y}), que sobe até ${topo.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(erros, []);
});

/**
 * Janela em cima de porta (14/10, pedido do Felipe: "tem umas janelas que estão bugadas... procura isso em todos os
 * mapas, e evite repetir"). Nas fachadas de Santo Berço já foi corrigido; aqui é dentro das cenas: a janela, o quadro,
 * a prateleira (qualquer item de parede) que cai em cima do vão de uma porta. Vale para a porta de entrada da cena
 * (o trecho de parede com `door` em computeWalls) e para as passagens encostadas numa parede do fundo: a porta
 * 'portal' e a porteira (vão do chão até ~2,15 m), a escada que sobe para a parede e a escada de mão presa nela (a
 * parede inteira). A porta ocupa a casa toda ao longo da parede (0,65 m de vão + batente = 0,75 m = 1 casa). Passa o
 * que fica acima do vão (o relógio em cima da porta) e o que fica ao lado dele.
 *
 * As manchas pintadas na parede (a fuligem do incêndio) ficam de fora, como no teste de cima: a fuligem passa pela
 * parede inteira, porta incluída, como uma mancha de verdade.
 */
test('nenhum item de parede fica em cima de uma porta ou passagem', () => {
  const db = seedDb();
  upgradeDb(db);
  const ALTURA_PORTA = 2.15 * Z_PER_M;
  /** passagens que abrem a parede em que encostam: até onde vai o vão (null = a parede inteira) */
  const VAO_DA_PASSAGEM: Record<string, number | null> = { portal: ALTURA_PORTA, porteira: ALTURA_PORTA, stairs_up: null, escada_vertical: null, escada_nobre: null, escalada: null };
  /** o giro da peça diz em que parede ela encosta: 2 = costas para x (parede 'l'), 4 = costas para y (parede 'r') */
  const PAREDE_DO_GIRO: Record<number, 'l' | 'r'> = { 2: 'l', 4: 'r' };
  const erros: string[] = [];
  for (const room of db.rooms) {
    const map = new RoomMap(room.heightmap, room.door);
    const vaos: { wall: 'l' | 'r'; plane: number; at: number; z0: number; z1: number; oQue: string }[] = [];
    for (const s of map.walls.segs) {
      if (!s.door) continue;
      // com a escada que sobe na frente da porta, o vão vai até o topo da parede (como o cliente desenha)
      const [dx, dy] = DIRS[room.door.dir] ?? [0, 0];
      const escada = room.items.some((it) => it.defId === 'stairs_up' && it.x === room.door.x + dx && it.y === room.door.y + dy);
      vaos.push({ wall: s.wall, plane: s.plane, at: s.at, z0: s.base, z1: escada ? map.walls.top : s.base + ALTURA_PORTA, oQue: `da porta de entrada (${room.door.x}, ${room.door.y})` });
    }
    for (const it of room.items) {
      const d = getFurni(it.defId);
      const parede = PAREDE_DO_GIRO[it.rot];
      if (!d || !(d.kind in VAO_DA_PASSAGEM) || !parede) continue;
      for (const t of map.tilesFor(it.defId, it.x, it.y, it.rot)) {
        const [plane, at] = parede === 'l' ? [t.x, t.y] : [t.y, t.x];
        const s = map.walls.find(parede, plane, at);
        if (!s) continue;
        const alto = VAO_DA_PASSAGEM[d.kind];
        vaos.push({ wall: parede, plane, at, z0: s.base, z1: alto === null ? map.walls.top : s.base + alto, oQue: `da passagem ${it.defId} em (${it.x}, ${it.y})` });
      }
    }
    for (const w of room.wallItems) {
      const wd = getWallFurni(w.defId);
      if (!wd || eManchaNaParede(w.defId)) continue;
      const meia = wd.w / WALL_PX_PER_TILE / 2;
      const [a0, a1] = [w.pos - meia, w.pos + meia];
      const [z0, z1] = [w.z, w.z + wd.h / Z_PX];
      for (const v of vaos) {
        if (v.wall !== w.wall || v.plane !== w.plane) continue;
        if (Math.min(a1, v.at + 1) - Math.max(a0, v.at) <= 0.02) continue;
        if (Math.min(z1, v.z1) - Math.max(z0, v.z0) <= 0.02) continue;
        erros.push(
          `${room.name}: ${w.defId} (parede ${w.wall}${w.plane}, de ${a0.toFixed(2)} a ${a1.toFixed(2)}, altura ${z0.toFixed(2)} a ${z1.toFixed(2)}) ` +
            `em cima ${v.oQue} (vão de ${v.at} a ${v.at + 1}, até ${v.z1.toFixed(2)})`,
        );
      }
    }
  }
  assert.deepEqual(erros, []);
});
