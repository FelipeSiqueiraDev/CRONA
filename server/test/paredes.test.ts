import assert from 'node:assert/strict';
import { test } from 'node:test';
import { footprint, getFurni, getWallFurni } from '@crona/shared';
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
