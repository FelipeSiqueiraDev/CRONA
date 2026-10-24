import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { escuroDaHora, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

function montar() {
  const db = seedDb();
  upgradeDb(db);
  const hotel = new Hotel({ db, persist: false, timers: false });
  const inbox: ServerMsg[] = [];
  const c = hotel.attach((m) => inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, false);
  const send = (m: ClientMsg) => hotel.receive(c, m);
  send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey } as ClientMsg);
  const sala = (nome: string) => hotel.db.rooms.find((x) => x.name === nome)!.id;
  return { hotel, inbox, send, sala };
}

describe('a hora do dia', () => {
  test('o mestre muda a hora numa cena e ela vale para a campanha inteira (e só para ela)', () => {
    const { hotel, inbox, send, sala } = montar();
    const bar = sala('Sede · Bar');
    send({ t: 'join', roomId: bar } as ClientMsg);
    assert.equal(hotel.horaDaCena(bar), undefined, 'começa de dia');
    send({ t: 'roomFx', hora: 'noite' } as ClientMsg);
    const info = inbox.filter((m) => m.t === 'roomUpdate').at(-1) as Extract<ServerMsg, { t: 'roomUpdate' }>;
    assert.equal(info.room.hora, 'noite');
    // outra cena da Sede: a mesma noite; a fazenda (outra campanha): continua de dia
    const outra = hotel.db.rooms.find((r) => r.name.startsWith('Sede ·') && r.id !== bar && hotel.horaDaCena(r.id) === 'noite');
    assert.ok(outra, 'outra cena da Sede também anoiteceu');
    const fazenda = hotel.db.rooms.find((r) => r.name.startsWith('Fazenda ·'))!;
    assert.equal(hotel.horaDaCena(fazenda.id), undefined, 'a fazenda continua de dia');
    // voltando para o dia, a campanha fica sem hora guardada
    send({ t: 'roomFx', hora: 'dia' } as ClientMsg);
    assert.equal(hotel.horaDaCena(bar), undefined);
  });

  test('a hora que não existe é ignorada', () => {
    const { hotel, send, sala } = montar();
    const bar = sala('Sede · Bar');
    send({ t: 'join', roomId: bar } as ClientMsg);
    send({ t: 'roomFx', hora: 'meio-dia' } as unknown as ClientMsg);
    assert.equal(hotel.horaDaCena(bar), undefined);
  });

  test('a escuridão da hora: o dia não muda nada, a noite escurece mais ao ar livre', () => {
    assert.equal(escuroDaHora(0.2, 'dia', false), 0.2);
    assert.equal(escuroDaHora(0.2, undefined, true), 0.2);
    assert.ok(escuroDaHora(0.2, 'noite', true) > escuroDaHora(0.2, 'noite', false));
    assert.ok(escuroDaHora(0.8, 'noite', true) <= 0.92, 'com teto');
    assert.ok(escuroDaHora(0, 'amanhecer', false) < escuroDaHora(0, 'anoitecer', false));
  });
});
