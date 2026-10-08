import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { regras, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';
import type { RoomInstance } from '../src/roomInstance';

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
  all<T extends ServerMsg['t']>(t: T): Msg<T>[] {
    return this.inbox.filter((m) => m.t === t) as Msg<T>[];
  }
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    return this.all(t).at(-1);
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

function fichaNova(nome: string, personagem: number): FichaSalva {
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: regras.novaFicha(nome), criadaEm: agora, atualizadaEm: agora };
}

let hotel: Hotel;
let gm: Peer;
let bar: RoomInstance;

/** A peça do bar com esse nome (o id é o que o mestre manda nos comandos). */
const peca = (nome: string) => [...bar['users'].values()].find((u) => u.client.name === nome)!;
const fliperama = () => bar.map.allItems().find((i) => i.defId === 'arcade')!;
const andar = () => {
  for (let i = 0; i < 40; i++) bar.step();
};

/** O celular do jogador, entrando pelo link da ficha. */
function celular(nome: string): Peer {
  const f = hotel.db.fichas!.find((x) => x.nome === nome)!;
  const p = new Peer(hotel);
  p.send({ t: 'login', name: `Agente ${nome}`, look, fichaKey: f.chave! });
  return p;
}

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  const id = hotel.db.rooms.find((x) => x.name === 'Sede · Bar')!.id;
  bar = hotel.rooms.get(id)!;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: id });
  const tepes = peca('D.Tepes');
  gm.send({ t: 'fichaSalvar', ficha: fichaNova('D.Tepes', tepes.client.look.charId!) });
  gm.send({ t: 'fichaLink', id: hotel.db.fichas!.find((x) => x.nome === 'D.Tepes')!.id });
});

describe('o fliperama do bar', () => {
  test('o mestre usa com o agente escolhido: a peça vai até a frente, vira para a tela, o fliperama liga e o jogo abre no celular', () => {
    const fone = celular('D.Tepes');
    const arc = fliperama();
    bar.map.updateItem({ ...arc, state: 1 });
    const tepes = peca('D.Tepes');
    gm.send({ t: 'fliperama', tokenId: tepes.client.id, itemId: arc.id });
    assert.deepEqual(fone.last('fliperama'), { t: 'fliperama', ligado: true, nome: 'D.Tepes' });
    assert.equal(bar.map.getItem(arc.id)!.state, 0, 'aceso');
    andar();
    // o fliperama do bar fica encostado na parede da esquerda, virado para +x
    assert.equal(arc.rot, 2);
    assert.deepEqual([tepes.x, tepes.y], [arc.x + 1, arc.y]);
    assert.equal(tepes.dir, 6, 'olhando para o fliperama');
    assert.match(gm.last('notice')!.msg, /foi jogar/);
  });

  test('usar de novo com o mesmo agente chama de volta', () => {
    const fone = celular('D.Tepes');
    const tepes = peca('D.Tepes');
    gm.send({ t: 'fliperama', tokenId: tepes.client.id, itemId: fliperama().id });
    gm.send({ t: 'fliperama', tokenId: tepes.client.id, itemId: fliperama().id });
    assert.deepEqual(fone.last('fliperama'), { t: 'fliperama', ligado: false });
    assert.match(gm.last('notice')!.msg, /largou/);
  });

  test('o celular que entra (ou reconecta) no meio do jogo abre o fliperama de novo', () => {
    gm.send({ t: 'fliperama', tokenId: peca('D.Tepes').client.id, itemId: fliperama().id });
    assert.match(gm.last('notice')!.msg, /não está conectado/);
    const fone = celular('D.Tepes');
    assert.deepEqual(fone.last('fliperama'), { t: 'fliperama', ligado: true, nome: 'D.Tepes' });
  });

  test('o jogador sai: o mestre fica sabendo do recorde, e o próximo Usar abre de novo', () => {
    const fone = celular('D.Tepes');
    const tepes = peca('D.Tepes');
    gm.send({ t: 'fliperama', tokenId: tepes.client.id, itemId: fliperama().id });
    fone.send({ t: 'fliperamaSair', recorde: { jogo: 'PULA-PULA', pontos: 71 } });
    assert.equal(gm.last('notice')!.msg, 'D.Tepes largou o fliperama (71 pontos no PULA-PULA).');
    gm.send({ t: 'fliperama', tokenId: tepes.client.id, itemId: fliperama().id });
    assert.equal(fone.last('fliperama')!.ligado, true);
  });

  test('só o mestre manda jogar; agente sem ficha e objeto que não é fliperama recusam', () => {
    const fone = celular('D.Tepes');
    fone.send({ t: 'fliperama', tokenId: peca('D.Tepes').client.id, itemId: fliperama().id });
    assert.equal(fone.last('fliperama'), undefined);
    assert.match(fone.last('error')!.msg, /Só o mestre/);
    gm.send({ t: 'fliperama', tokenId: peca('Cora Falcão').client.id, itemId: fliperama().id });
    assert.match(gm.last('notice')!.msg, /não tem ficha/);
    const outro = bar.map.allItems().find((i) => i.defId !== 'arcade')!;
    gm.send({ t: 'fliperama', tokenId: peca('D.Tepes').client.id, itemId: outro.id });
    assert.match(gm.last('error')!.msg, /não é um fliperama/);
  });
});
