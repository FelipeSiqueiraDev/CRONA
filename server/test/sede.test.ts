import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { applyVital, DEFAULT_VITALS, findPath, getFurni, vitalConditions, Z_PER_M, type ClientMsg, type FloorItem, type ServerMsg } from '@crona/shared';
import type { RoomData } from '../src/db';
import { Hotel } from '../src/hotel';
import { findAnim, findBoneco, findPassos, findPortraits, findPoses, refreshPortraits } from '../src/portraits';
import { restackRoom, seedDb, upgradeDb } from '../src/seed';
import { rebuildSede, SEDE, SEDE_CODE } from '../src/seedSede';

type Msg<T extends ServerMsg['t']> = Extract<ServerMsg, { t: T }>;

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
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Msg<T>;
    return undefined;
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

let hotel: Hotel;
let gm: Peer;
const room = (name: string) => {
  const r = hotel.db.rooms.find((x) => x.name === SEDE + name);
  assert.ok(r, `cômodo ${name}`);
  return hotel.rooms.get(r.id)!;
};
const fridge = () => room('Bar').map.allItems().find((i) => i.lock) as FloorItem;
const stairs = () => room('Bar').map.allItems().find((i) => i.defId === 'stairs_down') as FloorItem;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  gm = new Peer(hotel, true);
  gm.send({ t: 'login', name: 'Mestre', look });
  gm.send({ t: 'join', roomId: room('Bar').data.id });
});

describe('Sede da Ordem', () => {
  test('bar no térreo e onze cômodos no subsolo, numa campanha só', () => {
    assert.ok(room('Prisão'));
    assert.ok(room('Sala de Tecnologia'));
    assert.equal(room('Bar').map.allItems().filter((i) => i.defId === 'beer_fridge').length, 1);
    const sede = hotel.db.rooms.filter((r) => r.name.startsWith(SEDE));
    assert.equal(sede.length, 12);
    assert.deepEqual(
      sede.filter((r) => r.floor === 'Térreo').map((r) => r.name),
      [SEDE + 'Bar'],
    );
    const camp = hotel.db.campaigns?.[String(Math.min(...sede.map((r) => r.id)))];
    assert.equal(camp?.title, 'Sede da Ordem');
    for (const r of sede) assert.ok(camp?.layout[r.id], `${r.name} está na planta`);
    assert.equal(hotel.db.home, room('Bar').data.id);
  });

  test('toda passagem tem volta', () => {
    const sede = hotel.db.rooms.filter((r) => r.name.startsWith(SEDE));
    for (const r of sede)
      for (const p of hotel.rooms.get(r.id)!.portals()) {
        const back = hotel.rooms.get(p.link)!.portals().find((q) => q.link === r.id);
        assert.ok(back, `${r.name} → ${hotel.rooms.get(p.link)!.data.name} tem volta`);
      }
  });

  test('dá para andar da porta até todas as passagens de cada cômodo', () => {
    for (const r of hotel.db.rooms.filter((x) => x.name.startsWith(SEDE))) {
      const inst = hotel.rooms.get(r.id)!;
      const map = inst.map;
      for (const p of inst.portals()) {
        // a escada escondida só é alcançável com a geladeira aberta
        if (map.walkState(p.x, p.y) === 'blocked') continue;
        const path = findPath(map, map.door, p, () => false);
        assert.ok(path, `${r.name}: caminho da porta até a passagem em ${p.x},${p.y}`);
      }
    }
  });

  test('os quatro agentes começam no bar, com as folhas', () => {
    const tokens = room('Bar').tokenList();
    assert.deepEqual(tokens.map((t) => t.name).sort(), ['Alosi Walker', 'Catarina Albuquerque', 'Cora Falcão', 'D.Tepes']);
    for (const t of tokens) assert.ok(t.look.charId, `${t.name} tem folha`);
  });
});

describe('passagem secreta (geladeira)', () => {
  test('a escada começa escondida embaixo da geladeira', () => {
    const f = fridge();
    const s = stairs();
    assert.deepEqual([f.x, f.y], [20, 0]);
    assert.deepEqual([s.x, s.y], [20, 0]);
    assert.equal(s.state, 0);
    assert.ok(getFurni(s.defId)?.hidden);
    assert.equal(room('Bar').map.walkState(20, 0), 'blocked');
  });

  test('senha errada não abre; certa: a geladeira desliza e a escada aparece', () => {
    const id = fridge().id;
    gm.send({ t: 'unlock', id, code: '1234' });
    assert.equal(gm.last('lockResult')?.ok, false);
    assert.equal(fridge().x, 20);
    gm.send({ t: 'unlock', id, code: SEDE_CODE });
    assert.equal(gm.last('lockResult')?.ok, true);
    assert.deepEqual([fridge().x, fridge().y], [19, 0]);
    assert.equal(fridge().lock?.open, true);
    assert.equal(stairs().state, 1);
    assert.equal(room('Bar').map.walkState(20, 0), 'walk');
    const camp = hotel.db.campaigns![String(room('Bar').data.id)];
    assert.ok(camp.log.some((l) => l.text.startsWith('Senha certa')));
  });

  test('a mesa não recebe a senha nem consegue abrir', () => {
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: room('Bar').data.id });
    const f = mesa.last('roomEnter')!.items.find((i) => i.lock);
    assert.ok(f);
    assert.equal(f.lock!.code, undefined);
    mesa.send({ t: 'unlock', id: f.id, code: SEDE_CODE });
    assert.equal(fridge().lock?.open, false);
  });

  test('fechar devolve a geladeira para cima da escada', () => {
    const id = fridge().id;
    gm.send({ t: 'unlock', id, code: SEDE_CODE });
    gm.send({ t: 'relock', id });
    assert.deepEqual([fridge().x, fridge().y], [20, 0]);
    assert.equal(stairs().state, 0);
  });

  test('arrastar a geladeira aberta de volta para cima da escada fecha a passagem (a senha volta a abrir)', () => {
    const id = fridge().id;
    gm.send({ t: 'unlock', id, code: SEDE_CODE });
    assert.deepEqual([fridge().x, fridge().y], [19, 0]);
    gm.send({ t: 'moveItem', id, x: 20, y: 0, rot: 4 });
    assert.deepEqual([fridge().x, fridge().y], [20, 0]);
    assert.equal(fridge().lock?.open, false);
    assert.equal(stairs().state, 0);
    gm.send({ t: 'unlock', id, code: SEDE_CODE });
    assert.deepEqual([fridge().x, fridge().y], [19, 0]);
    assert.equal(stairs().state, 1);
    gm.send({ t: 'relock', id });
    assert.deepEqual([fridge().x, fridge().y], [20, 0]);
  });

  test('girar a geladeira no lugar mantém a passagem fechada', () => {
    const id = fridge().id;
    gm.send({ t: 'moveItem', id, x: 20, y: 0, rot: 2 });
    assert.equal(fridge().rot, 2);
    assert.equal(fridge().lock?.open, false);
    assert.equal(stairs().state, 0);
    gm.send({ t: 'moveItem', id, x: 20, y: 0, rot: 4 });
  });

  test('quem sobe pela escada com a passagem fechada abre por dentro', () => {
    const bar = room('Bar');
    const salao = room('Salão Principal');
    const tk = bar.tokenList()[0];
    hotel.moveToken(bar, tk.id, salao.data.id);
    assert.ok(salao.hasToken(-tk.id));
    hotel.moveToken(salao, tk.id, bar.data.id);
    assert.equal(fridge().lock?.open, true);
    const t = bar.tokensLive().find((x) => x.name === tk.name)!;
    assert.deepEqual([t.token.tile.x, t.token.tile.y], [20, 0]);
  });

  test('quem desce do bar chega no pé da escada do salão, virado para a sala', () => {
    const bar = room('Bar');
    const salao = room('Salão Principal');
    const tk = bar.tokenList()[0];
    hotel.moveToken(bar, tk.id, salao.data.id);
    const escada = salao.map.allItems().find((i) => i.defId === 'stairs_up')!;
    const t = salao.tokensLive().find((x) => x.name === tk.name)!;
    // a escada (giro 2) sobe para a parede da esquerda: o pé fica na frente dela, em +x
    assert.equal(escada.rot, 2);
    assert.deepEqual([t.token.tile.x, t.token.tile.y], [escada.x + 2, escada.y]);
    assert.equal(t.token.dir, 2);
  });

  test('porta: clique duplo abre e fecha; Ctrl + clique tranca (fecha, não abre, e não aparece no desenho)', () => {
    const salao = room('Salão Principal');
    gm.send({ t: 'join', roomId: salao.data.id });
    const porta = salao.map.allItems().find((i) => i.defId === 'portal' && i.x === 16 && i.y === 0)!;
    assert.equal(salao.map.walkState(16, 0), 'walk');
    gm.send({ t: 'use', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.state, 1, 'fechada');
    assert.equal(salao.map.walkState(16, 0), 'blocked');
    gm.send({ t: 'use', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.state, 0, 'aberta de novo (só dois estados)');
    // trancar com a porta aberta: ela fecha e tranca
    gm.send({ t: 'trancar', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.state, 1, 'trancar fecha a porta');
    assert.equal(salao.map.getItem(porta.id)!.trancado, true, 'trancada');
    assert.equal(salao.map.walkState(16, 0), 'blocked');
    // trancada, o clique duplo não abre (só faz o barulho)
    gm.send({ t: 'use', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.state, 1, 'trancada não abre');
    // destrancar: continua fechada, e aí abre
    gm.send({ t: 'trancar', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.trancado, undefined, 'destrancada');
    gm.send({ t: 'use', id: porta.id });
    assert.equal(salao.map.getItem(porta.id)!.state, 0, 'aberta');
    assert.equal(salao.map.walkState(16, 0), 'walk');
  });

  test('peça salva em cima de uma passagem não troca de cena ao reiniciar', () => {
    const db = seedDb();
    upgradeDb(db);
    const bar = db.rooms.find((r) => r.name === SEDE + 'Bar')!;
    const salao = db.rooms.find((r) => r.name === SEDE + 'Salão Principal')!;
    const porta = salao.items.find((i) => i.link && getFurni(i.defId)?.portal && !getFurni(i.defId)?.hidden)!;
    // uma peça que ficou salva em cima da porta do salão
    const peca = bar.tokens!.shift()!;
    salao.tokens = [...(salao.tokens ?? []), { ...peca, x: porta.x, y: porta.y }];
    const h = new Hotel({ db, persist: false, timers: false });
    for (let i = 0; i < 4; i++) for (const r of h.rooms.values()) r.step();
    // TokenData.id é o id positivo da peça (o da conexão é o negativo)
    assert.ok(h.rooms.get(salao.id)!.hasToken(peca.id), 'continua no salão');
  });

  test('a peça que atravessa uma passagem avisa a cena nova (quem comanda vai junto)', () => {
    const bar = room('Bar');
    const salao = room('Salão Principal');
    gm.send({ t: 'unlock', id: fridge().id, code: SEDE_CODE });
    const tk = bar.tokenList()[0];
    assert.equal(bar.moveTokenTo(-tk.id, { x: 20, y: 0 }, true, 'walk'), null);
    for (let i = 0; i < 120 && bar.hasToken(-tk.id); i++) bar.step();
    const m = gm.last('tokenTravel');
    assert.ok(m, 'o mestre recebe o aviso');
    assert.equal(m.tokenId, tk.id);
    assert.equal(m.roomId, salao.data.id);
    assert.ok(salao.hasToken(-tk.id), 'a peça está no salão');
  });

  test('sem ninguém no bar (nenhuma peça e o mestre fora da cena), a passagem se fecha sozinha', () => {
    const bar = room('Bar');
    const salao = room('Salão Principal');
    gm.send({ t: 'unlock', id: fridge().id, code: SEDE_CODE });
    const tokens = bar.tokenList();
    // enquanto sobra alguém, continua aberta
    for (const tk of tokens.slice(0, -1)) hotel.moveToken(bar, tk.id, salao.data.id);
    assert.equal(fridge().lock?.open, true);
    // o último desce: com o mestre olhando o bar, ela continua aberta
    hotel.moveToken(bar, tokens[tokens.length - 1].id, salao.data.id);
    assert.equal(bar.tokenList().length, 0);
    assert.equal(fridge().lock?.open, true);
    // o mestre sai da cena: a geladeira volta para cima da escada
    gm.send({ t: 'join', roomId: salao.data.id });
    assert.equal(fridge().lock?.open, false);
    assert.deepEqual([fridge().x, fridge().y], [20, 0]);
    assert.equal(stairs().state, 0);
    const camp = hotel.db.campaigns![String(bar.data.id)];
    assert.ok(camp.log.some((l) => l.text.startsWith('Sem ninguém na sala')));
    // quem volta pela escada abre de novo por dentro
    hotel.moveToken(salao, tokens[0].id, bar.data.id);
    assert.equal(fridge().lock?.open, true);
  });

  test('com o bar vazio, o mestre abre mesmo assim; quando ele sai da cena, ela se fecha', () => {
    const bar = room('Bar');
    const salao = room('Salão Principal');
    for (const tk of bar.tokenList()) hotel.moveToken(bar, tk.id, salao.data.id);
    gm.send({ t: 'unlock', id: fridge().id, code: SEDE_CODE });
    assert.equal(gm.last('lockResult')?.ok, true);
    assert.equal(fridge().lock?.open, true);
    assert.deepEqual([fridge().x, fridge().y], [19, 0]);
    gm.send({ t: 'join', roomId: salao.data.id });
    assert.equal(fridge().lock?.open, false);
    assert.deepEqual([fridge().x, fridge().y], [20, 0]);
  });

  test('regra absoluta: carregou com a passagem aberta e o bar vazio, ela se fecha', () => {
    const db = seedDb();
    upgradeDb(db);
    const bar = db.rooms.find((r) => r.name === SEDE + 'Bar')!;
    const g = bar.items.find((i) => i.lock)!;
    g.lock = { ...g.lock!, open: true };
    g.x = 19;
    bar.items.find((i) => i.defId === 'stairs_down')!.state = 1;
    bar.tokens = [];
    const h = new Hotel({ db, persist: false, timers: false });
    const r = h.rooms.get(bar.id)!;
    const f = r.map.allItems().find((i) => i.lock)!;
    assert.equal(f.lock?.open, false);
    assert.deepEqual([f.x, f.y], [20, 0]);
    assert.equal(r.map.allItems().find((i) => i.defId === 'stairs_down')!.state, 0);
  });
});

describe('clima: quantidade de partículas', () => {
  test('mestre ajusta de 0 a 100% e todos recebem; a mesa não mexe', () => {
    const bar = room('Bar');
    gm.send({ t: 'roomFx', particleLevel: 1.7 });
    assert.equal(bar.data.particleLevel, 1);
    gm.send({ t: 'roomFx', particleLevel: 0.2 });
    assert.equal(bar.data.particleLevel, 0.2);
    assert.equal(gm.last('roomUpdate')?.room.particleLevel, 0.2);
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: bar.data.id });
    assert.equal(mesa.last('roomEnter')?.room.particleLevel, 0.2);
    mesa.send({ t: 'roomFx', particleLevel: 1 });
    assert.equal(bar.data.particleLevel, 0.2);
  });
});

describe('montagem nova da Sede', () => {
  test('refaz no lugar: mesmos cômodos, peças e registro', () => {
    const db = seedDb();
    upgradeDb(db);
    const bar = db.rooms.find((r) => r.name === SEDE + 'Bar')!;
    const ids = db.rooms.filter((r) => r.name.startsWith(SEDE)).map((r) => r.id);
    const camp = db.campaigns![String(bar.id)];
    camp.log.push({ at: 1, icon: 'scene', text: 'teste' });
    const tk = bar.tokens![0];
    // simula a montagem antiga do bar; a do salão não mudou e fica como o mestre deixou
    db.sedeRev = 1;
    bar.montagem = 'antiga';
    bar.items = bar.items.filter((i) => i.defId !== 'dirt');
    const salao = db.rooms.find((r) => r.name === SEDE + 'Salão Principal')!;
    salao.items = salao.items.slice(1);
    const noSalao = salao.items.length;
    assert.ok(rebuildSede(db));
    assert.equal(salao.items.length, noSalao);
    assert.deepEqual(db.rooms.filter((r) => r.name.startsWith(SEDE)).map((r) => r.id), ids);
    assert.ok(bar.items.some((i) => i.defId === 'dirt'));
    assert.ok(bar.tokens!.some((t) => t.id === tk.id && t.x === tk.x && t.y === tk.y));
    assert.ok(camp.log.some((l) => l.text === 'teste'));
    assert.equal(rebuildSede(db), false);
  });

  test('cômodo de antes do resumo: fica como está e ganha só as peças novas da parede', () => {
    const db = seedDb();
    upgradeDb(db);
    const bar = db.rooms.find((r) => r.name === SEDE + 'Bar')!;
    db.sedeRev = 1;
    delete bar.montagem;
    bar.wallItems = bar.wallItems.filter((w) => w.defId !== 'dartboard');
    bar.items = bar.items.filter((i) => i.defId !== 'dirt');
    assert.ok(rebuildSede(db));
    assert.ok(!bar.items.some((i) => i.defId === 'dirt'));
    assert.equal(bar.wallItems.filter((w) => w.defId === 'dartboard').length, 1);
    assert.ok(bar.montagem);
  });
});

describe('ficha: PV, PE e SAN', () => {
  test('limites e condições do livro', () => {
    let v = { ...DEFAULT_VITALS };
    v = applyVital(v, 'pv', { delta: -11 });
    assert.equal(v.pv, 9);
    assert.equal(vitalConditions(v).machucado, true);
    v = applyVital(v, 'pv', { delta: -50 });
    assert.equal(v.pv, 0);
    assert.equal(vitalConditions(v).morrendo, true);
    v = applyVital(v, 'san', { max: 12, value: 99 });
    assert.equal(v.san, 12);
    assert.equal(vitalConditions(v).perturbado, false);
    v = applyVital(v, 'pe', { delta: -3 });
    assert.equal(vitalConditions(v).cansado, true);
  });

  test('mestre muda a ficha e a carta recebe; mesa não muda', () => {
    const bar = room('Bar');
    const tk = bar.tokenList()[0];
    gm.send({ t: 'vitals', tokenId: tk.id, key: 'pv', delta: -12 });
    hotel.pushNow();
    const p = gm.last('campaign')!.state.party.find((x) => x.name === tk.name)!;
    assert.equal(p.vitals?.pv, 8);
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: bar.data.id });
    mesa.send({ t: 'vitals', tokenId: tk.id, key: 'pv', delta: 10 });
    hotel.pushNow();
    assert.equal(gm.last('campaign')!.state.party.find((x) => x.name === tk.name)!.vitals?.pv, 8);
  });
});

describe('mesa acompanha o mestre', () => {
  test('mestre abre outra campanha e a mesa vai junto', () => {
    const mansao = hotel.db.rooms.find((r) => r.name === 'Mansão Alvarez · Escritório')!;
    gm.send({ t: 'join', roomId: mansao.id });
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: mansao.id });
    assert.equal(mesa.last('roomEnter')?.room.id, mansao.id);
    gm.send({ t: 'join', roomId: room('Bar').data.id });
    assert.equal(mesa.last('roomEnter')?.room.id, room('Bar').data.id);
  });
});

describe('proporção dos móveis', () => {
  test('o que estava em cima da mesa continua em cima (mesa mais alta)', () => {
    const r: RoomData = {
      id: 99,
      name: 'teste',
      description: '',
      owner: 'x',
      heightmap: 'x000\n0000\nx000',
      door: { x: 0, y: 1, dir: 2 },
      items: [
        { id: 1, defId: 'desk_wood', x: 1, y: 0, z: 0, rot: 0, state: 0 },
        { id: 2, defId: 'desk_lamp', x: 1, y: 0, z: 0.8, rot: 0, state: 0 },
        { id: 3, defId: 'chair_wood', x: 3, y: 2, z: 0, rot: 0, state: 0 },
      ],
      wallItems: [],
      publicBuild: true,
      darkness: 0.5,
    };
    // a luminária na altura antiga do tampo, em metros (a escala de antes era 1 unidade = 1 m)
    r.items[1].z = getFurni('desk_wood')!.height / Z_PER_M;
    restackRoom(r);
    const desk = getFurni('desk_wood')!;
    assert.equal(r.items[1].z, desk.height);
    // a escrivaninha na altura de verdade (17/10): o `aumento` cresce só a largura e o fundo
    assert.ok(Math.abs(desk.height - 0.76 * Z_PER_M) < 0.01);
    assert.equal(r.items[2].z, 0);
  });
});

describe('retratos por estado', () => {
  test('acha os retratos (e os de olhos fechados) na pasta do personagem', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crona-'));
    fs.mkdirSync(path.join(dir, 'tepes'));
    for (const f of ['retrato-desarmado.png', 'retrato-desarmado-olhos-fechados.png', 'retrato-armado-machucado.webp', 'folha.webp']) fs.writeFileSync(path.join(dir, 'tepes', f), '');
    const p = findPortraits('/arte/personagens/tepes/folha.webp', dir);
    assert.deepEqual(p, {
      desarmado: { open: '/arte/personagens/tepes/retrato-desarmado.png', closed: '/arte/personagens/tepes/retrato-desarmado-olhos-fechados.png' },
      'armado-machucado': { open: '/arte/personagens/tepes/retrato-armado-machucado.webp' },
    });
    assert.equal(findPortraits('/uploads/abc.png', dir), undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('poses do tabuleiro (32 bits)', () => {
  test('acha as poses por estado e direção; sem a direção no nome, é a frente para a direita (se)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crona-'));
    const pasta = path.join(dir, 'tepes', 'tabuleiro-32bits');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tepes', 'folha.webp'), '');
    for (const f of ['idle-desarmado.png', 'idle-desarmado-ne.png', 'idle-armado-machucado.webp', 'idle-armado-machucado-sw.png', 'leia.txt']) fs.writeFileSync(path.join(pasta, f), '');
    const url = (f: string) => `/arte/personagens/tepes/tabuleiro-32bits/${f}`;
    assert.deepEqual(findPoses('/arte/personagens/tepes/folha.webp', dir), {
      desarmado: { se: url('idle-desarmado.png'), ne: url('idle-desarmado-ne.png') },
      'armado-machucado': { sw: url('idle-armado-machucado-sw.png'), se: url('idle-armado-machucado.webp') },
    });
    // a imagem com a direção no nome vale mais que a sem direção
    fs.writeFileSync(path.join(pasta, 'idle-desarmado-se.png'), '');
    assert.equal(findPoses('/arte/personagens/tepes/folha.webp', dir)?.desarmado?.se, url('idle-desarmado-se.png'));
    assert.equal(findPoses('/uploads/abc.png', dir), undefined);
    assert.equal(findPoses('/arte/personagens/alosi/folha.webp', dir), undefined, 'sem a pasta, sem poses');
    // o personagem ganha as poses (e perde quando a pasta some)
    const def = { id: 1, name: 'D.Tepes', owner: '', sheet: '/arte/personagens/tepes/folha.webp', cols: 4, rows: 4, dirs: [], height: 104, fps: 4, sequence: [], removeBg: false } as Parameters<typeof refreshPortraits>[0][number];
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.poses?.desarmado?.ne, url('idle-desarmado-ne.png'));
    assert.equal(refreshPortraits([def], dir), false, 'nada mudou');
    fs.rmSync(pasta, { recursive: true, force: true });
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.poses, undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('acha os quadros de andar por estado e direção, em ordem, e para no primeiro que falta', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crona-'));
    const pasta = path.join(dir, 'alosi', 'tabuleiro-32bits');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(dir, 'alosi', 'folha.webp'), '');
    for (const f of ['idle-desarmado-se.png', 'andar-desarmado-se-2.png', 'andar-desarmado-se-1.png', 'andar-desarmado-se-4.png', 'andar-armado-n-1.webp', 'andar-desarmado-x-1.png']) fs.writeFileSync(path.join(pasta, f), '');
    const url = (f: string) => `/arte/personagens/alosi/tabuleiro-32bits/${f}`;
    assert.deepEqual(findPassos('/arte/personagens/alosi/folha.webp', dir), {
      desarmado: { se: [url('andar-desarmado-se-1.png'), url('andar-desarmado-se-2.png')] },
      armado: { n: [url('andar-armado-n-1.webp')] },
    });
    assert.equal(findPassos('/uploads/abc.png', dir), undefined);
    // o personagem ganha os passos junto com as poses
    const def = { id: 3, name: 'Alosi Walker', owner: '', sheet: '/arte/personagens/alosi/folha.webp', cols: 4, rows: 4, dirs: [], height: 104, fps: 4, sequence: [], removeBg: false } as Parameters<typeof refreshPortraits>[0][number];
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.passos?.desarmado?.se?.length, 2);
    assert.equal(def.poses?.desarmado?.se, url('idle-desarmado-se.png'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('acha o boneco filmado em 3D (tabuleiro-3d/anim.json, versão 2): cada animação com a sua tira', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crona-'));
    const pasta = path.join(dir, 'alosi', 'tabuleiro-3d');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(dir, 'alosi', 'folha.webp'), '');
    const clipe = (arquivo: string, extra: Record<string, unknown> = {}) => ({ arquivo, quadros: 16, w: 90, h: 220, ax: 45, ay: 210, laco: true, pes: [[[-6, 2, 0], [6, -2, 0]]], ...extra });
    const anim = {
      versao: 2,
      escala: 0.5,
      estados: {
        desarmado: {
          s: { andar: clipe('andar-desarmado-s.png', { casasPorCiclo: 1.91 }), parado: clipe('parado-desarmado-s.png', { ms: 125 }), pegar: clipe('pegar-desarmado-s.png', { laco: false }) },
          n: { andar: clipe('andar-desarmado-n.png'), 'Nome Ruim': clipe('x.png') },
        },
      },
    };
    fs.writeFileSync(path.join(pasta, 'anim.json'), JSON.stringify(anim));
    // falta a tira do pegar: a animação sai; a de nome ruim também
    for (const f of ['andar-desarmado-s.png', 'parado-desarmado-s.png', 'andar-desarmado-n.png', 'x.png']) fs.writeFileSync(path.join(pasta, f), '');
    const url = (f: string) => `/arte/personagens/alosi/tabuleiro-3d/${f}`;
    const b = findBoneco('/arte/personagens/alosi/folha.webp', dir);
    assert.equal(b?.escala, 0.5);
    assert.deepEqual(Object.keys(b?.estados.desarmado?.s ?? {}).sort(), ['andar', 'parado']);
    assert.equal(b?.estados.desarmado?.s?.andar.url, url('andar-desarmado-s.png'));
    assert.equal(b?.estados.desarmado?.s?.andar.casasPorCiclo, 1.91);
    assert.equal(b?.estados.desarmado?.s?.parado.ms, 125);
    assert.deepEqual(Object.keys(b?.estados.desarmado?.n ?? {}), ['andar']);
    assert.equal(findBoneco('/uploads/abc.png', dir), undefined);
    // o personagem ganha o boneco; com outra versão, perde
    const def = { id: 3, name: 'Alosi Walker', owner: '', sheet: '/arte/personagens/alosi/folha.webp', cols: 4, rows: 4, dirs: [], height: 104, fps: 4, sequence: [], removeBg: false } as Parameters<typeof refreshPortraits>[0][number];
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.boneco?.estados.desarmado?.s?.parado.url, url('parado-desarmado-s.png'));
    fs.writeFileSync(path.join(pasta, 'anim.json'), JSON.stringify({ ...anim, versao: 3 }));
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.boneco, undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('acha o boneco animado (anim.json): as tiras viram endereços e a direção sem tira sai', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crona-'));
    const pasta = path.join(dir, 'alosi', 'tabuleiro-32bits');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(dir, 'alosi', 'folha.webp'), '');
    const direcao = (d: string) => ({
      w: 57,
      h: 111,
      ax: 30,
      ay: 101,
      olhos: d !== 'n',
      parado: { arquivo: `parado-desarmado-${d}.png`, quadros: 24 },
      andar: { arquivo: `andar-desarmado-${d}.png`, quadros: 16 },
      pesParado: [[[-11, 0, 0], [11, -1, 0]]],
      pesAndar: [[[-11, 4.5, 0], [11, -4.7, 0]]],
    });
    const anim = { versao: 1, msParado: 150, faseAndar: 0.25, estados: { desarmado: { s: direcao('s'), n: direcao('n'), e: direcao('e') } } };
    fs.writeFileSync(path.join(pasta, 'anim.json'), JSON.stringify(anim));
    // a direção e só tem a tira parada: sai
    for (const f of ['parado-desarmado-s.png', 'andar-desarmado-s.png', 'parado-desarmado-n.png', 'andar-desarmado-n.png', 'parado-desarmado-e.png']) fs.writeFileSync(path.join(pasta, f), '');
    const url = (f: string) => `/arte/personagens/alosi/tabuleiro-32bits/${f}`;
    const a = findAnim('/arte/personagens/alosi/folha.webp', dir);
    assert.equal(a?.msParado, 150);
    assert.equal(a?.faseAndar, 0.25);
    assert.deepEqual(Object.keys(a?.estados.desarmado ?? {}).sort(), ['n', 's']);
    assert.equal(a?.estados.desarmado?.s?.andar.url, url('andar-desarmado-s.png'));
    assert.equal(a?.estados.desarmado?.s?.andar.quadros, 16);
    assert.equal(a?.estados.desarmado?.s?.olhos, true);
    assert.equal(a?.estados.desarmado?.n?.olhos, false);
    assert.deepEqual(a?.estados.desarmado?.s?.pesAndar[0], [[-11, 4.5, 0], [11, -4.7, 0]]);
    assert.equal(findAnim('/uploads/abc.png', dir), undefined);
    // o personagem ganha o boneco; sem o anim.json (ou com outra versão), perde
    const def = { id: 3, name: 'Alosi Walker', owner: '', sheet: '/arte/personagens/alosi/folha.webp', cols: 4, rows: 4, dirs: [], height: 104, fps: 4, sequence: [], removeBg: false } as Parameters<typeof refreshPortraits>[0][number];
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.anim?.estados.desarmado?.s?.parado.url, url('parado-desarmado-s.png'));
    fs.writeFileSync(path.join(pasta, 'anim.json'), JSON.stringify({ ...anim, versao: 2 }));
    assert.equal(refreshPortraits([def], dir), true);
    assert.equal(def.anim, undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
