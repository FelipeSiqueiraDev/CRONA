import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { getFurni, getWallFurni, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';
import { SEDE } from '../src/seedSede';

class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(
    private hotel: Hotel,
    local = false,
  ) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, local);
  }
  send(m: ClientMsg) {
    this.hotel.receive(this.client, m);
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

let hotel: Hotel;
let gm: Peer;

/** Um cômodo da Sede com fontes de luz de chão (de dois estados) e um item de parede de dois estados. */
const salaComLuz = () => {
  for (const r of hotel.db.rooms) {
    if (!r.name.startsWith(SEDE)) continue;
    const sala = hotel.rooms.get(r.id)!;
    const chao = sala.map.allItems().filter((i) => getFurni(i.defId)?.category === 'iluminacao' && (getFurni(i.defId)?.states ?? 0) >= 2);
    const parede = sala.map.allWallItems().filter((i) => (getWallFurni(i.defId)?.states ?? 0) >= 2);
    if (chao.length && parede.length) return { sala, chao, parede };
  }
  assert.fail('nenhum cômodo da Sede com luz de chão e item de parede de dois estados');
};

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  gm = new Peer(hotel, true);
  gm.send({ t: 'login', name: 'Mestre', look });
});

describe('Apagar e acender as luzes do cômodo (☀ Clima da cena)', () => {
  test('o mestre muda o estado de várias fontes de uma vez, no chão e na parede', () => {
    const { sala, chao, parede } = salaComLuz();
    gm.send({ t: 'join', roomId: sala.data.id });
    const itens = [...chao.map((i) => ({ id: i.id, state: 1 })), { id: parede[0].id, state: 1 }];
    gm.send({ t: 'luzes', itens });
    for (const i of chao) assert.equal(sala.map.getItem(i.id)!.state, 1, `${i.defId} apagou`);
    assert.equal(sala.map.getWallItem(parede[0].id)!.state, 1, `${parede[0].defId} mudou`);
    gm.send({ t: 'luzes', itens: itens.map((i) => ({ ...i, state: 0 })) });
    for (const i of chao) assert.equal(sala.map.getItem(i.id)!.state, 0, `${i.defId} acendeu`);
  });

  test('estado fora do móvel, item de outro cômodo e quem não é mestre: nada muda', () => {
    const { sala, chao } = salaComLuz();
    gm.send({ t: 'join', roomId: sala.data.id });
    const antes = sala.map.getItem(chao[0].id)!.state;
    gm.send({ t: 'luzes', itens: [{ id: chao[0].id, state: 99 }, { id: 987654321, state: 1 }] });
    assert.equal(sala.map.getItem(chao[0].id)!.state, antes);
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: sala.data.id });
    mesa.send({ t: 'luzes', itens: [{ id: chao[0].id, state: (antes + 1) % 2 }] });
    assert.equal(sala.map.getItem(chao[0].id)!.state, antes, 'a mesa não apaga nada');
  });
});
