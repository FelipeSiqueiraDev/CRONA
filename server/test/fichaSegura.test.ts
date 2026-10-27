import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { mesclarFicha, regras, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

/**
 * A ficha mandada por cima (auditoria de 27/10): quem grava manda a cópia de onde partiu, e o servidor fica só com o
 * que mudou nela; o dano, o item entregue e a condição de enquanto isso não se perdem. Mais o que o jogador não pode
 * mudar pelo `fichaSalvar` e o que a mesa e o jogador não recebem da campanha.
 */

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

function fichaNova(nome: string, personagem: number): FichaSalva {
  const f = regras.novaFicha(nome);
  f.atributos = { agi: 2, for: 2, int: 1, pre: 1, vig: 3 };
  f.origem = 'militar';
  f.classe = 'combatente';
  f.pericias.grupos = ['luta', 'fortitude'];
  f.pericias.livres = ['atletismo', 'percepcao'];
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: f, criadaEm: agora, atualizadaEm: agora };
}

const copia = <T>(x: T): T => structuredClone(x);

let hotel: Hotel;
let gm: Peer;
let mesa: Peer;
let jog: Peer;
let sala: number;

const ficha = (nome: string) => hotel.db.fichas!.find((f) => f.nome === nome)!;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
  hotel.pushNow();
  for (const nome of ['D.Tepes', 'Catarina Albuquerque']) {
    const charId = gm.last('session')!.session.characters.find((c) => c.name === nome)!.look.charId!;
    gm.send({ t: 'fichaSalvar', ficha: fichaNova(nome, charId) });
  }
  mesa = new Peer(hotel);
  mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
  mesa.send({ t: 'join', roomId: sala });
  gm.send({ t: 'fichaLink', id: ficha('Catarina Albuquerque').id });
  jog = new Peer(hotel);
  jog.send({ t: 'login', name: 'Catarina', look, fichaKey: ficha('Catarina Albuquerque').chave! });
});

describe('mesclarFicha', () => {
  const base = (): FichaSalva => ({ ...fichaNova('X', 1), id: 7, atual: { pv: 20, pe: 5, san: 30 } });

  test('o que só um lado mudou vale', () => {
    const b = base();
    const minha = copia(b);
    minha.notas = { anotacoes: 'a porta do porão' };
    const atual = copia(b);
    atual.atual!.pv = 12;
    const r = mesclarFicha(b, minha, atual);
    assert.equal(r.atual!.pv, 12, 'o dano de enquanto isso fica');
    assert.equal(r.notas?.anotacoes, 'a porta do porão', 'a nota fica');
  });

  test('a mochila se junta item a item', () => {
    const b = base();
    b.ficha.inventario = [{ uid: 1, tipo: 'arma', id: 'faca' }, { uid: 2, tipo: 'arma', id: 'katana' }];
    const atual = copia(b);
    atual.ficha.inventario = [{ uid: 1, tipo: 'arma', id: 'faca' }, { uid: 3, tipo: 'equipamento', id: 'lanterna' }];
    const minha = copia(b);
    minha.ficha.inventario.push({ tipo: 'equipamento', id: 'corda' });
    minha.atual!.pe = 4;
    const r = mesclarFicha(b, minha, atual);
    assert.deepEqual(
      r.ficha.inventario.map((i) => i.id),
      ['faca', 'lanterna', 'corda'],
      'a katana entregue não volta; o que chegou e o que pedi ficam',
    );
    assert.equal(r.atual!.pe, 4);
  });
});

describe('fichaSalvar com a base', () => {
  test('o celular manda a cópia velha: o dano do mestre não some', () => {
    const velha = copia(jog.last('fichas')!.fichas[0]);
    const doMestre = copia(ficha('Catarina Albuquerque'));
    doMestre.atual = { ...(doMestre.atual ?? { pv: 0, pe: 0, san: 0 }), pv: 3 };
    gm.send({ t: 'fichaSalvar', ficha: doMestre });
    const minha = copia(velha);
    minha.notas = { anotacoes: 'lembrar do cofre' };
    jog.send({ t: 'fichaSalvar', ficha: minha, base: velha });
    assert.equal(ficha('Catarina Albuquerque').atual!.pv, 3);
    assert.equal(ficha('Catarina Albuquerque').notas?.anotacoes, 'lembrar do cofre');
  });

  test('entregar e logo depois gravar a ficha velha não duplica o item', () => {
    gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'katana' });
    const velha = copia(jog.last('fichas')!.fichas[0]);
    const katana = velha.ficha.inventario.find((x) => x.id === 'katana')!;
    jog.send({ t: 'mochila', fichaId: velha.id, uid: katana.uid!, acao: 'entregar', para: ficha('D.Tepes').id });
    const minha = copia(velha);
    minha.atual = { ...(minha.atual ?? { pv: 0, pe: 0, san: 0 }), pe: 0 };
    jog.send({ t: 'fichaSalvar', ficha: minha, base: velha });
    assert.ok(!ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.uid === katana.uid), 'não voltou para a Catarina');
    assert.ok(ficha('D.Tepes').ficha.inventario.some((x) => x.uid === katana.uid), 'continua com o Tepes');
  });

  test('a recusa devolve a ficha de verdade ao celular', () => {
    const minha = copia(jog.last('fichas')!.fichas[0]);
    const antes = jog.inbox.length;
    minha.ficha.inventario.push({ tipo: 'arma', id: 'fuzil-de-assalto' });
    jog.send({ t: 'fichaSalvar', ficha: minha });
    assert.ok(jog.last('error'));
    assert.ok(jog.inbox.slice(antes).some((m) => m.t === 'fichas'), 'a ficha voltou');
  });
});

describe('o que o jogador não muda pelo fichaSalvar', () => {
  test('condições, bônus do interlúdio, achado e melhorias ficam como o mestre deixou', () => {
    gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'katana' });
    const doMestre = copia(ficha('Catarina Albuquerque'));
    doMestre.condicoes = ['abalado'];
    gm.send({ t: 'fichaSalvar', ficha: doMestre });
    const minha = copia(jog.last('fichas')!.fichas[0]);
    delete minha.condicoes;
    minha.bonus = { exercicio: 10 };
    const k = minha.ficha.inventario.find((x) => x.id === 'katana')!;
    k.achado = true;
    k.modificacoes = ['certeira'];
    jog.send({ t: 'fichaSalvar', ficha: minha });
    const f = ficha('Catarina Albuquerque');
    assert.deepEqual(f.condicoes, ['abalado']);
    assert.equal(f.bonus, undefined);
    const kk = f.ficha.inventario.find((x) => x.id === 'katana')!;
    assert.ok(!kk.achado);
    assert.ok(!kk.modificacoes?.length);
  });

  test('fora da base, trocar um item por outro do catálogo é pedir', () => {
    gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'faca' });
    const minha = copia(jog.last('fichas')!.fichas[0]);
    minha.ficha.inventario = minha.ficha.inventario.filter((x) => x.id !== 'faca');
    minha.ficha.inventario.push({ tipo: 'arma', id: 'katana' });
    jog.send({ t: 'fichaSalvar', ficha: minha });
    assert.match(jog.last('error')?.msg ?? '', /base/);
    assert.ok(ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.id === 'faca'));
  });
});

describe('a campanha da mesa e do jogador', () => {
  test('só o nome: sem anotações, descrições, registro nem peças das outras salas', () => {
    hotel.pushNow();
    const doMestre = gm.last('campaign')!.state;
    const daMesa = mesa.last('campaign')!.state;
    assert.ok(doMestre.scenes.length > 0);
    assert.equal(daMesa.title, doMestre.title);
    assert.deepEqual([daMesa.scenes, daMesa.party, daMesa.log, daMesa.notas], [[], [], [], []]);
    assert.ok(mesa.last('session')!.session.scenes.every((s) => !s.description));
  });

  test('a lista de salas da mesa só tem a cena de agora', () => {
    mesa.send({ t: 'rooms' });
    assert.equal(mesa.last('roomList')!.rooms.length, 1);
    gm.send({ t: 'rooms' });
    assert.ok(gm.last('roomList')!.rooms.length > 1);
  });

  test('a mesa não espia outra cena', () => {
    const outra = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Biblioteca')!.id;
    mesa.send({ t: 'peek', roomId: outra });
    assert.equal(mesa.last('peek'), undefined);
  });
});
