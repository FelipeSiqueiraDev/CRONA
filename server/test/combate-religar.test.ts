import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { combate } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

type Combate = combate.Combate;

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

test('o combate religa pelo nome a peça que foi recriada (o id mudou): retrato, PV e armas voltam', () => {
  const db = seedDb();
  upgradeDb(db);
  const hotel = new Hotel({ db, persist: false, timers: false });
  const sala = hotel.db.rooms.find((x) => x.name === 'Sede · Bar')!.id;
  const gm = hotel.attach(() => {}, undefined, false);
  hotel.receive(gm, { t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  hotel.receive(gm, { t: 'join', roomId: sala });
  const tepes = hotel.rooms.get(sala)!.tokensLive().find((p) => p.name === 'D.Tepes')!.token.id;
  const camp = hotel['campaignFor'](sala) as { combate?: Combate; ameacas?: Record<string, unknown> };
  // o combate de antes, com o id velho do Tepes (a peça foi recriada depois)
  camp.combate = {
    fase: 'andamento',
    cena: sala,
    rodada: 1,
    vez: 'p:999',
    agiram: ['p:999'],
    participantes: [{ id: 999, lado: 'agente', nome: 'D.Tepes', desde: 1, ciente: true, reacao: false, morrendo: 0, desempate: 0, iniciativa: 15, enlouquecendo: 0 }],
    mestre: { iniciativa: null, desempate: 0 },
    acoes: { '999': { padrao: true } },
    preparadas: [],
    registro: [],
    inicio: 0,
  } as unknown as Combate;
  camp.ameacas = { '999': { nome: 'teste' } };
  hotel.pushNow();
  const c = camp.combate!;
  assert.equal(c.participantes[0].id, tepes);
  assert.equal(c.vez, `p:${tepes}`);
  assert.deepEqual(c.agiram, [`p:${tepes}`]);
  assert.ok(c.acoes[String(tepes)], 'as ações da vez vão junto');
  assert.ok(camp.ameacas[String(tepes)] && !camp.ameacas['999'], 'a ficha da ameaça vai junto');
});
