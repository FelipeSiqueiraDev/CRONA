import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFurni, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

/** O cachorro não senta (28/10, o Felipe: "deixa o cachorro de fora dos bancos então uai"). */

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

type Peca = { client: { id: number; look?: { charId?: number | null } }; sit: number; x: number; y: number };

test('o bicho de quatro patas mandado para a cadeira para do lado dela, de pé', () => {
  const db = seedDb();
  upgradeDb(db);
  const hotel = new Hotel({ db, persist: false, timers: false });
  const inbox: ServerMsg[] = [];
  const client = hotel.attach((m) => inbox.push(m as ServerMsg), undefined, true);
  const send = (m: ClientMsg) => hotel.receive(client, m);
  send({ t: 'login', name: 'Mestre', look });
  // uma cena com cadeira e uma peça com personagem
  const sala = [...hotel.rooms.values()].find((r) => r.data.items.some((it) => getFurni(it.defId)?.kind === 'office_chair') && r.tokenList().length)!;
  assert.ok(sala, 'tem cena com cadeira e peça');
  send({ t: 'join', roomId: sala.data.id });
  const users = (sala as unknown as { users: Map<unknown, Peca> }).users;
  const u = [...users.values()].find((x) => x.client.look?.charId != null)!;
  assert.ok(u, 'uma peça com personagem');
  // o personagem dela vira bicho (baixinho, como o cachorro)
  const def = hotel.db.characters.find((c) => c.id === u.client.look!.charId)!;
  def.height = 50;
  const cadeira = sala.data.items.find((it) => getFurni(it.defId)?.kind === 'office_chair')!;
  send({ t: 'tokenWalk', tokenId: u.client.id, x: cadeira.x, y: cadeira.y });
  for (let i = 0; i < 300; i++) sala.step();
  assert.equal(u.sit, 0, 'não senta');
  assert.ok(!sala.map.sitItem(u.x, u.y), `parou fora do assento (está em ${u.x},${u.y})`);
  assert.ok(Math.max(Math.abs(u.x - cadeira.x), Math.abs(u.y - cadeira.y)) <= 3, 'parou perto da cadeira');
  // a pessoa (altura de gente) senta normalmente
  def.height = 104;
  send({ t: 'tokenWalk', tokenId: u.client.id, x: cadeira.x, y: cadeira.y });
  for (let i = 0; i < 300; i++) sala.step();
  assert.equal(u.sit, 1, 'gente senta');
});
