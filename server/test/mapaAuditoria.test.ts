import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { ClientMsg, ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

/** O MAPA (auditoria de 27/10, grupo D): guardar um móvel não apaga o que ele tinha; a mesa que recarrega continua escondida. */

type Msg<T extends ServerMsg['t']> = Extract<ServerMsg, { t: T }>;

class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(private hotel: Hotel) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, false);
  }
  send(m: ClientMsg) {
    this.hotel.receive(this.client, m);
  }
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Msg<T>;
    return undefined;
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

let hotel: Hotel;
let gm: Peer;
let sala: number;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
});

describe('guardar um móvel', () => {
  test('volta com os itens de dentro e a pista', () => {
    // um móvel no chão, sem nada em cima (para voltar ao mesmo lugar)
    const todos = gm.last('roomEnter')!.items;
    const it = todos.find((i) => i.z === 0 && !todos.some((o) => o !== i && o.z > 0 && Math.abs(o.x - i.x) <= 2 && Math.abs(o.y - i.y) <= 2))!;
    gm.send({ t: 'lootAdd', itemId: it.id, name: 'Chave enferrujada', espacos: 0, kind: 'key' } as ClientMsg);
    gm.send({ t: 'setHint', id: it.id, hint: { icon: 'inspect', title: 'Riscos', text: 'Alguém contou os dias.', visible: false } } as ClientMsg);
    gm.send({ t: 'pickup', id: it.id });
    const inv = gm.last('inventory')!.items.find((x) => x.id === it.id)!;
    assert.ok(inv.dados, 'o inventário guarda o que o móvel tinha');
    gm.send({ t: 'place', invId: it.id, x: it.x, y: it.y, rot: it.rot });
    assert.equal(gm.last('error')?.msg, undefined);
    const volta = gm.last('itemAdd')!.item;
    assert.equal(volta.id, it.id);
    assert.ok(volta.loot?.some((l) => l.name === 'Chave enferrujada'));
    assert.equal(volta.hint?.title, 'Riscos');
  });
});

describe('a tela escondida da mesa', () => {
  test('quem entra depois recebe que ela está escondida', () => {
    gm.send({ t: 'telaEscondida', on: true });
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: sala });
    assert.equal(mesa.last('telaEscondida')?.on, true);
  });
});

describe('objetivos', () => {
  test('o objetivo vazio é recusado com aviso', () => {
    gm.send({ t: 'objAdd', text: '   ' });
    assert.match(gm.last('error')?.msg ?? '', /objetivo/i);
  });
});
