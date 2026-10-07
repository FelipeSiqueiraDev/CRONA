import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getFurni, ocupa, RoomMap, type FloorItem } from '@crona/shared';

// a peça com casas vazias por dentro: a mesa em U (o meio livre) e a cortina do leito (o leito dentro)
describe('peças com o meio vazio', () => {
  const sala = () => Array.from({ length: 8 }, () => '0'.repeat(8)).join('\n');
  const porta = { x: 0, y: 7, dir: 4 };

  test('a mesa em U ocupa só o fundo e os lados, em todos os giros', () => {
    const u = getFurni('desk_u')!;
    // giro 4 (frente para +y): o fundo é a primeira linha, os lados as colunas das pontas
    assert.equal(ocupa(u, 4, 2, 0), true);
    assert.equal(ocupa(u, 4, 0, 3), true);
    assert.equal(ocupa(u, 4, 5, 3), true);
    assert.equal(ocupa(u, 4, 2, 2), false);
    // giro 0 (frente para -y): o fundo vai para a última linha
    assert.equal(ocupa(u, 0, 2, 3), true);
    assert.equal(ocupa(u, 0, 2, 0), false);
    // giro 2 (frente para +x): a pegada é 4 × 6 e o fundo é a primeira coluna
    assert.equal(ocupa(u, 2, 0, 3), true);
    assert.equal(ocupa(u, 2, 2, 3), false);
    assert.equal(ocupa(u, 6, 3, 3), true);
    assert.equal(ocupa(u, 6, 1, 3), false);
  });

  test('dentro do U se anda e se põe a cadeira; nas bordas, não', () => {
    const mesa: FloorItem = { id: 1, defId: 'desk_u', x: 1, y: 0, z: 0, rot: 4, state: 0 };
    const map = new RoomMap(sala(), porta, [mesa]);
    assert.equal(map.walkState(3, 2), 'walk');
    assert.equal(map.walkState(3, 0), 'blocked');
    assert.equal(map.walkState(1, 2), 'blocked');
    assert.equal(map.canPlace('chair_office', 3, 1, 0).ok, true);
    assert.equal(map.canPlace('chair_office', 3, 0, 0).ok, false);
    assert.equal(map.tilesFor('desk_u', 1, 0, 4).length, 24 - 12);
  });

  test('a cortina do leito: o leito cabe dentro, dá para andar em volta; a frente fechada não passa, aberta passa', () => {
    const cortina: FloorItem = { id: 1, defId: 'bed_curtain', x: 0, y: 0, z: 0, rot: 4, state: 0 };
    const map = new RoomMap(sala(), porta, [cortina]);
    assert.equal(map.canPlace('hospital_bed', 1, 0, 4).ok, true);
    for (const [x, y] of [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]) assert.equal(map.walkState(x, y), 'walk');
    assert.equal(map.walkState(1, 3), 'blocked');
    const aberta = new RoomMap(sala(), porta, [{ ...cortina, state: 1 }]);
    assert.equal(aberta.walkState(1, 3), 'walk');
  });
});
