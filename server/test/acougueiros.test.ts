import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acougueirosNoBestiario } from '../src/acougueiros';
import type { Database } from '../src/db';

describe('os Açougueiros no bestiário', () => {
  it('entram uma vez, com arte própria e o Existido continua', () => {
    const db = {} as Database;
    assert.ok(acougueirosNoBestiario(db));
    const ids = db.bestiario!.map((c) => c.id);
    assert.deepEqual(ids.filter((i) => i.endsWith('-acougueiro')), ['galo-acougueiro', 'touro-acougueiro', 'porco-acougueiro', 'ovelha-acougueiro']);
    assert.ok(ids.includes('existido'));
    for (const c of db.bestiario!.filter((x) => x.id.endsWith('-acougueiro'))) assert.equal(c.aparencias[0].arte, c.id);
    assert.equal(acougueirosNoBestiario(db), false);
    assert.equal(db.bestiario!.length, 5);
  });
  it('o que o mestre apagar depois não volta', () => {
    const db = {} as Database;
    acougueirosNoBestiario(db);
    db.bestiario = db.bestiario!.filter((c) => c.id !== 'galo-acougueiro');
    assert.equal(acougueirosNoBestiario(db), false);
    assert.ok(!db.bestiario.some((c) => c.id === 'galo-acougueiro'));
  });
});
