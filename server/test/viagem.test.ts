import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { BANCOS_VAN, type ClientMsg, type ServerMsg, type Session } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

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
const sessao = (): Session => {
  hotel.pushNow();
  return gm.last('session')!.session;
};
const peca = (nome: string) => sessao().characters.find((c) => c.name === nome)!;
/** o id da peça nas mensagens da viagem é o do PartyMember (o da peça na cena) */
const idDaPeca = (nome: string) => -peca(nome).id;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
});

describe('a Viagem: a van parada com o mundo passando', () => {
  test('iniciar leva cada agente para o banco escolhido, sentado, e o mestre entra na cena', () => {
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 0 }, { tokenId: idDaPeca('Catarina Albuquerque'), banco: 3 }], cenario: 'terra', hora: 'noite', destino: 'Rumo a Santo Berço' });
    assert.equal(gm.last('error'), undefined);
    const van = [...hotel.rooms.values()].find((r) => r.data.viagem)!;
    assert.ok(van, 'a cena da viagem existe');
    assert.equal(van.data.viagem?.cenario, 'terra');
    assert.equal(van.data.viagem?.destino, 'Rumo a Santo Berço');
    assert.equal(van.data.viagem?.origem, sala);
    assert.ok(van.data.darkness > 0.5, 'a noite escurece a cena');
    const nela = van.tokenList();
    assert.deepEqual(nela.map((t) => t.name).sort(), ['Catarina Albuquerque', 'D.Tepes']);
    const tepes = van.tokensLive().find((t) => t.name === 'D.Tepes')!;
    assert.deepEqual([tepes.token.tile.x, tepes.token.tile.y], [BANCOS_VAN[0].x, BANCOS_VAN[0].y]);
    // as peças saíram da cena de antes
    assert.ok(!hotel.rooms.get(sala)!.tokenList().some((t) => t.name === 'D.Tepes'));
    // o mestre foi junto
    assert.equal(gm.client.room, van);
  });

  test('ajustar muda o cenário, a hora e a velocidade; valor inválido não vale', () => {
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 0 }] });
    gm.send({ t: 'viagem', acao: 'ajustar', cenario: 'rodovia', hora: 'entardecer', velocidade: 2, destino: '  ' });
    const v = [...hotel.rooms.values()].find((r) => r.data.viagem)!.data.viagem!;
    assert.deepEqual([v.cenario, v.hora, v.velocidade, v.destino], ['rodovia', 'entardecer', 1, undefined]);
    gm.send({ t: 'viagem', acao: 'ajustar', cenario: 'lua', hora: 'meia-noite' });
    const w = [...hotel.rooms.values()].find((r) => r.data.viagem)!.data.viagem!;
    assert.deepEqual([w.cenario, w.hora], ['rodovia', 'entardecer']);
  });

  test('chegar leva todos para a cena escolhida e o mestre vai junto; a van fica para a próxima', () => {
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 0 }, { tokenId: idDaPeca('Catarina Albuquerque'), banco: 1 }] });
    const van = [...hotel.rooms.values()].find((r) => r.data.viagem)!;
    const outra = hotel.db.rooms.find((x) => x.id !== sala && x.name.startsWith('Mansão Alvarez'))!.id;
    gm.send({ t: 'viagem', acao: 'chegar', roomId: outra });
    assert.equal(van.tokenList().length, 0, 'a van esvaziou');
    const dest = hotel.rooms.get(outra)!;
    assert.deepEqual(dest.tokenList().map((t) => t.name).filter((n) => n === 'D.Tepes' || n === 'Catarina Albuquerque').sort(), ['Catarina Albuquerque', 'D.Tepes']);
    assert.equal(gm.client.room, dest);
    // a van continua lá: outra viagem na mesma campanha reaproveita a cena
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 2 }] });
    assert.equal([...hotel.rooms.values()].filter((r) => r.data.viagem).length, 1);
  });

  test('chegar em outra campanha: o grupo da viagem toma o lugar das peças de lá (sem Tepes repetido)', () => {
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 0 }, { tokenId: idDaPeca('Catarina Albuquerque'), banco: 1 }] });
    const bar = hotel.db.rooms.find((x) => x.name === 'Sede · Bar')!.id;
    const nomesNaSede = () => [...hotel.rooms.values()].filter((r) => r.data.name.startsWith('Sede ·')).flatMap((r) => r.tokenList().map((t) => t.name));
    assert.ok(nomesNaSede().includes('D.Tepes'), 'a Sede tem o Tepes dela antes');
    gm.send({ t: 'viagem', acao: 'chegar', roomId: bar });
    const sede = nomesNaSede();
    assert.equal(sede.filter((n) => n === 'D.Tepes').length, 1, 'um Tepes só na Sede');
    assert.equal(sede.filter((n) => n === 'Catarina Albuquerque').length, 1);
    assert.ok(hotel.rooms.get(bar)!.tokenList().some((t) => t.name === 'D.Tepes'), 'chegou no Bar');
  });

  test('banco repetido, peça repetida e banco que não existe são ignorados; sem ninguém, recusa', () => {
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 99 }] });
    assert.match(gm.last('error')!.msg, /Escolha quem vai/);
    gm.send({ t: 'viagem', acao: 'iniciar', bancos: [{ tokenId: idDaPeca('D.Tepes'), banco: 1 }, { tokenId: idDaPeca('Catarina Albuquerque'), banco: 1 }] });
    const van = [...hotel.rooms.values()].find((r) => r.data.viagem)!;
    assert.deepEqual(van.tokenList().map((t) => t.name), ['D.Tepes']);
  });
});
