import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RoomMap, type FloorItem } from '@crona/shared';
import { cobertura } from '../../client/src/room/combateGeo';

// a cobertura pela altura (DC-24): o corpo tem 1,8 m em pé e 1,0 m agachado; o móvel com 44% do corpo
// ou mais dá cobertura (+5); com o corpo inteiro ou mais, tapa tudo
describe('cobertura pela altura do móvel e da postura', () => {
  const sala = () => Array.from({ length: 9 }, () => '0'.repeat(9)).join('\n');
  const porta = { x: 0, y: 8, dir: 4 };
  const entre = (defId: string, agachado: boolean) => {
    const it: FloorItem = { id: 1, defId, x: 4, y: 4, z: 0, rot: 4, state: 0 };
    return cobertura(new RoomMap(sala(), porta, [it]), { x: 1, y: 4 }, { x: 7, y: 4 }, [], agachado);
  };

  test('sem nada no meio, não há cobertura', () => {
    assert.equal(cobertura(new RoomMap(sala(), porta, []), { x: 1, y: 4 }, { x: 7, y: 4 }, []).tipo, 'nenhuma');
  });

  test('a mesinha de 0,55 m só cobre quem está agachado', () => {
    assert.equal(entre('table_small', false).tipo, 'nenhuma');
    assert.equal(entre('table_small', true).tipo, 'cobertura');
  });

  test('o balcão de 0,9 m dá cobertura em pé e agachado; o arquivo de 1,35 m tapa quem se agacha', () => {
    const emPe = entre('counter_wood', false);
    assert.equal(emPe.tipo, 'cobertura');
    assert.ok(emPe.nome?.includes('0,9 m'), String(emPe.nome));
    assert.equal(entre('counter_wood', true).tipo, 'cobertura');
    assert.equal(entre('cabinet_file', false).tipo, 'cobertura');
    assert.equal(entre('cabinet_file', true).tipo, 'total');
  });

  test('a estante de 2,2 m tapa o corpo todo, em pé ou agachado', () => {
    assert.equal(entre('bookshelf', false).tipo, 'total');
    assert.equal(entre('bookshelf', true).tipo, 'total');
  });
});
