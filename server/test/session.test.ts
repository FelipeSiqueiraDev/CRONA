import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, test } from 'node:test';
import { DIR_KEYS, DIR_TO_SHEET, distinctFacings, parseHeightmap, pointToTile, sheetDirFor, tileCenter, turnFacing, type ClientMsg, type DirKey, type ServerMsg, type Session, type SessionAction } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

type Msg<T extends ServerMsg['t']> = Extract<ServerMsg, { t: T }>;

/** Uma pessoa conectada (sem WebSocket): guarda tudo o que o servidor manda. */
class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  /** local = conexão do próprio computador do servidor */
  constructor(private hotel: Hotel, local = false) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, local);
  }
  send(m: ClientMsg) {
    this.hotel.receive(this.client, m);
  }
  act(a: SessionAction) {
    this.send({ t: 'act', a });
  }
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Msg<T>;
    return undefined;
  }
  all<T extends ServerMsg['t']>(t: T): Msg<T>[] {
    return this.inbox.filter((m) => m.t === t) as Msg<T>[];
  }
  session(): Session {
    const m = this.last('session');
    assert.ok(m, 'recebeu a sessão');
    return m.session;
  }
}

let hotel: Hotel;
let gm: Peer;
let player: Peer;
let scene: (name: string) => number;

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  scene = (name) => {
    const r = hotel.db.rooms.find((x) => x.name === `Mansão Alvarez · ${name}`);
    assert.ok(r, `cena ${name}`);
    return r.id;
  };
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: scene('Escritório') });
  player = new Peer(hotel);
  player.send({ t: 'login', name: 'Mesa', look });
  player.send({ t: 'join', roomId: scene('Hall de Entrada') });
  hotel.pushNow();
});

const office = () => hotel.rooms.get(scene('Escritório'))!;
const steps = (n: number) => {
  for (let i = 0; i < n; i++) for (const r of hotel.rooms.values()) r.step();
};

describe('papéis', () => {
  test('com a chave do link é mestre; sem ela, jogador', () => {
    assert.equal(gm.last('welcome')?.role, 'gm');
    assert.equal(player.last('welcome')?.role, 'player');
    assert.equal(gm.session().me.role, 'gm');
    assert.equal(player.session().me.role, 'player');
  });

  test('o computador do servidor é o mestre, sem chave', () => {
    const p = new Peer(hotel, true);
    p.send({ t: 'login', name: 'Felipe', look });
    assert.equal(p.last('welcome')?.role, 'gm');
  });

  test('a tela da mesa entra como jogador, mesmo neste computador ou com a chave', () => {
    const local = new Peer(hotel, true);
    local.send({ t: 'login', name: 'Mesa A1', look, mesa: true });
    assert.equal(local.last('welcome')?.role, 'player');
    const withKey = new Peer(hotel);
    withKey.send({ t: 'login', name: 'Mesa B2', look, gmKey: hotel.gmKey, mesa: true });
    assert.equal(withKey.last('welcome')?.role, 'player');
    // e não muda a cena da sessão ao entrar
    local.send({ t: 'join', roomId: scene('Jardim') });
    assert.equal(local.last('roomEnter')?.room.id, scene('Escritório'));
  });

  test('chave errada entra como jogador', () => {
    const p = new Peer(hotel);
    p.send({ t: 'login', name: 'Intruso', look, gmKey: 'chave-errada' });
    assert.equal(p.last('welcome')?.role, 'player');
  });

  test('jogador com o nome do mestre não derruba o mestre', () => {
    const p = new Peer(hotel);
    p.send({ t: 'login', name: 'Mestre', look });
    assert.equal(p.last('welcome'), undefined);
    assert.match(p.last('error')?.msg ?? '', /em uso/);
    assert.equal(gm.client.name, 'Mestre');
  });

  test('jogador não consegue agir', () => {
    const s = player.session();
    const knife = s.items.find((i) => i.name === 'Faca de Cozinha')!;
    const cora = s.characters.find((c) => c.name === 'Catarina Albuquerque')!;
    const arthur = s.characters.find((c) => c.name === 'D.Tepes')!;
    player.act({ type: 'scene.change', sceneId: scene('Cozinha') });
    player.act({ type: 'token.move', tokenId: arthur.id, to: { x: 0.5, y: 0.5 } });
    player.act({ type: 'item.give', itemId: knife.id, to: cora.id });
    player.act({ type: 'objective.set', id: s.objectives[1].id, done: true });
    const denied = player.all('denied');
    assert.deepEqual(
      denied.map((d) => d.action),
      ['scene.change', 'token.move', 'item.give', 'objective.set'],
    );
    assert.ok(denied.every((d) => /mestre/.test(d.reason)));
    // mensagens antigas também são recusadas
    player.send({ t: 'objToggle', id: s.objectives[1].id });
    assert.match(player.last('error')?.msg ?? '', /mestre/);
    steps(4);
    hotel.pushNow();
    const after = gm.session();
    assert.equal(after.currentSceneId, scene('Escritório'));
    assert.equal(after.items.find((i) => i.id === knife.id)?.holderId, null);
    assert.equal(after.objectives[1].done, false);
    assert.deepEqual(after.tokens.find((t) => t.id === arthur.id)?.tile, s.tokens.find((t) => t.id === arthur.id)?.tile);
  });
});

describe('cena da sessão', () => {
  test('jogador entra na cena que o mestre deixou aberta', () => {
    assert.equal(player.last('roomEnter')?.room.id, scene('Escritório'));
    assert.equal(player.session().currentSceneId, scene('Escritório'));
  });

  test('mestre troca a cena e o jogador vai junto, sem recarregar', () => {
    gm.act({ type: 'scene.change', sceneId: scene('Biblioteca') });
    assert.equal(player.last('roomEnter')?.room.id, scene('Biblioteca'));
    hotel.pushNow();
    assert.equal(gm.session().currentSceneId, scene('Biblioteca'));
    assert.equal(player.session().currentSceneId, scene('Biblioteca'));
    assert.equal(player.session().events.at(-1)?.text, 'Cena atual: Biblioteca.');
  });

  test('trocar pela lista antiga (join) também leva o jogador', () => {
    gm.send({ t: 'join', roomId: scene('Cozinha') });
    assert.equal(player.last('roomEnter')?.room.id, scene('Cozinha'));
  });

  test('jogador pedindo outra cena continua na do mestre', () => {
    player.inbox = [];
    player.send({ t: 'join', roomId: scene('Jardim') });
    assert.equal(player.last('roomEnter'), undefined);
    assert.match(player.last('notice')?.msg ?? '', /mestre/);
  });
});

describe('peças', () => {
  test('mover por ponto 0..1: anda até a casa livre mais perto, desviando dos móveis', () => {
    const s = gm.session();
    const desk = s.objects.find((o) => o.name === 'Escrivaninha')!;
    const arthur = s.characters.find((c) => c.name === 'D.Tepes')!;
    player.inbox = [];
    gm.act({ type: 'token.move', tokenId: arthur.id, to: desk.pos });
    assert.equal(gm.last('denied'), undefined);
    steps(40);
    hotel.pushNow();
    const t = gm.session().tokens.find((x) => x.id === arthur.id)!;
    const room = office();
    assert.notEqual(room.map.walkState(t.tile.x, t.tile.y), 'blocked');
    assert.ok(t.pos.x > 0 && t.pos.x < 1 && t.pos.y > 0 && t.pos.y < 1, 'posição dentro do quadro');
    // chegou perto da escrivaninha (no máximo a duas casas)
    const deskItem = room.map.getItem(desk.id)!;
    assert.ok(Math.abs(t.tile.x - deskItem.x) <= 3 && Math.abs(t.tile.y - deskItem.y) <= 2, `perto da mesa: ${JSON.stringify(t.tile)}`);
    // o jogador acompanhou passo a passo
    const moves = player.all('tokens').filter((m) => m.sceneId === scene('Escritório'));
    assert.ok(moves.length >= 2, 'recebeu os passos');
    assert.ok(moves.some((m) => m.tokens.some((x) => x.id === arthur.id && x.to)), 'passo com destino (to)');
  });

  test('place: coloca direto na casa pedida', () => {
    const s = gm.session();
    const miguel = s.characters.find((c) => c.name === 'Alosi Walker')!;
    player.inbox = [];
    gm.act({ type: 'token.move', tokenId: miguel.id, to: { tile: { x: 8, y: 7 } }, mode: 'place' });
    const moved = player.last('tokens')?.tokens.find((x) => x.id === miguel.id);
    assert.deepEqual(moved?.tile, { x: 8, y: 7 });
  });

  test('ponto fora do chão é recusado com o motivo', () => {
    const s = gm.session();
    const teps = s.characters.find((c) => c.name === 'Cora Falcão')!;
    gm.act({ type: 'token.move', tokenId: teps.id, to: { x: Number.NaN, y: 0.5 } });
    assert.equal(gm.last('denied')?.action, 'token.move');
  });
});

describe('itens', () => {
  test('entregar atualiza a carga e o registro para os dois; devolver desfaz', () => {
    const s = gm.session();
    const knife = s.items.find((i) => i.name === 'Faca de Cozinha')!;
    const cora = s.characters.find((c) => c.name === 'Catarina Albuquerque')!;
    assert.equal(knife.holderId, null);
    gm.act({ type: 'item.give', itemId: knife.id, to: cora.id });
    hotel.pushNow();
    for (const who of [gm, player]) {
      const now = who.session();
      assert.equal(now.items.find((i) => i.id === knife.id)?.holderId, cora.id);
      assert.equal(now.characters.find((c) => c.id === cora.id)?.load, cora.load + 2);
      assert.equal(now.events.at(-1)?.text, 'Mestre entregou Faca de Cozinha para Catarina Albuquerque.');
    }
    gm.act({ type: 'item.give', itemId: knife.id, to: null });
    hotel.pushNow();
    assert.equal(player.session().items.find((i) => i.id === knife.id)?.holderId, null);
    assert.equal(player.session().characters.find((c) => c.id === cora.id)?.load, cora.load);
  });

  test('personagem inexistente é recusado', () => {
    const knife = gm.session().items.find((i) => i.name === 'Faca de Cozinha')!;
    gm.act({ type: 'item.give', itemId: knife.id, to: 999999 });
    assert.equal(gm.last('denied')?.reason, 'Personagem não encontrado.');
  });

  test('jogador não recebe pista oculta nem item ainda não revelado', () => {
    const desk = gm.session().objects.find((o) => o.name === 'Escrivaninha')!;
    gm.send({ t: 'setHint', id: desk.id, hint: { icon: 'inspect', title: 'Fundo falso', text: 'Segredo.', visible: false } });
    gm.send({ t: 'lootAdd', itemId: desk.id, name: 'Bilhete', espacos: 0, kind: 'letter' });
    hotel.pushNow();
    const mine = gm.session();
    const theirs = player.session();
    assert.ok(mine.objects.some((o) => o.id === desk.id && o.hidden && o.name === 'Fundo falso'));
    assert.ok(mine.items.some((i) => i.name === 'Bilhete' && !i.revealed));
    const seen = theirs.objects.find((o) => o.id === desk.id)!;
    assert.equal(seen.hidden, false);
    assert.notEqual(seen.name, 'Fundo falso');
    assert.ok(!theirs.items.some((i) => i.name === 'Bilhete'));
  });
});

describe('objetivos', () => {
  test('criar, concluir e apagar', () => {
    gm.act({ type: 'objective.add', text: 'Achar a saída' });
    hotel.pushNow();
    const o = player.session().objectives.find((x) => x.text === 'Achar a saída')!;
    assert.equal(o.done, false);
    gm.act({ type: 'objective.set', id: o.id, done: true });
    hotel.pushNow();
    assert.equal(player.session().objectives.find((x) => x.id === o.id)?.done, true);
    assert.equal(player.session().events.at(-1)?.text, 'Objetivo concluído: Achar a saída.');
    gm.act({ type: 'objective.remove', id: o.id });
    hotel.pushNow();
    assert.ok(!player.session().objectives.some((x) => x.id === o.id));
  });
});

describe('casas e quadro 0..1', () => {
  test('centro de cada casa volta para a mesma casa', () => {
    const s = gm.session();
    for (const sc of s.scenes) {
      const hm = parseHeightmap(sc.heightmap);
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          const h = hm.tiles[y][x];
          if (h === null) continue;
          const p = tileCenter(sc.grid, { x, y }, h);
          assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, `${sc.name} ${x},${y} dentro do quadro`);
          assert.deepEqual(pointToTile(sc.grid, hm, p), { x, y }, `${sc.name} ${x},${y}`);
        }
    }
  });

  test('a posição das peças bate com o centro da casa', () => {
    const s = gm.session();
    for (const t of s.tokens) {
      const sc = s.scenes.find((x) => x.id === t.sceneId)!;
      const h = parseHeightmap(sc.heightmap).tiles[t.tile.y][t.tile.x] ?? 0;
      const c = tileCenter(sc.grid, t.tile, h);
      assert.ok(Math.abs(c.x - t.pos.x) < 1e-6 && Math.abs(c.y - t.pos.y) < 0.2, `${t.id}`);
    }
  });
});

describe('personagens', () => {
  test('a demonstração usa os nomes reais', () => {
    const names = gm.session().characters.map((c) => c.name).sort();
    assert.deepEqual(names, ['Alosi Walker', 'Catarina Albuquerque', 'Cora Falcão', 'D.Tepes']);
    const s = gm.session();
    const catarina = s.characters.find((c) => c.name === 'Catarina Albuquerque')!;
    assert.equal(s.items.find((i) => i.name === 'Diário Rasgado')?.holderId, catarina.id);
    assert.equal(catarina.load, 9);
  });

  test('renomear leva junto os itens que estão com o personagem', () => {
    const s = gm.session();
    const tepes = s.characters.find((c) => c.name === 'D.Tepes')!;
    const before = s.items.filter((i) => i.holderId === tepes.id).map((i) => i.id).sort();
    assert.ok(before.length > 0);
    gm.send({ t: 'tokenEdit', tokenId: -tepes.id, name: 'Dimitri Tepes' });
    hotel.pushNow();
    const now = player.session();
    const renamed = now.characters.find((c) => c.id === tepes.id)!;
    assert.equal(renamed.name, 'Dimitri Tepes');
    assert.equal(renamed.load, tepes.load);
    assert.deepEqual(now.items.filter((i) => i.holderId === tepes.id).map((i) => i.id).sort(), before);
    assert.ok(now.items.filter((i) => i.holderId === tepes.id).every((i) => i.holderName === 'Dimitri Tepes'));
  });

  test('nome repetido na sessão é recusado', () => {
    const s = gm.session();
    const alosi = s.characters.find((c) => c.name === 'Alosi Walker')!;
    gm.send({ t: 'tokenEdit', tokenId: -alosi.id, name: 'cora falcão' });
    assert.match(gm.last('error')?.msg ?? '', /Já existe/);
    gm.send({ t: 'tokenAdd', name: 'D.Tepes', look });
    assert.match(gm.last('error')?.msg ?? '', /Já existe/);
    hotel.pushNow();
    assert.equal(gm.session().characters.find((c) => c.id === alosi.id)?.name, 'Alosi Walker');
    assert.equal(gm.session().characters.length, 4);
  });

  test('nome com até 24 letras', () => {
    gm.send({ t: 'tokenAdd', name: 'Beatriz Figueiredo Lima', look });
    hotel.pushNow();
    assert.ok(gm.session().characters.some((c) => c.name === 'Beatriz Figueiredo Lima'));
  });
});

describe('direções da folha de sprite', () => {
  const four: DirKey[] = ['se', 'sw', 'nw', 'ne'];
  test('folha de 4: as retas usam a diagonal vizinha (como antes)', () => {
    const got = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => sheetDirFor(d, (k) => four.includes(k)));
    assert.deepEqual(got, ['ne', 'se', 'se', 'sw', 'sw', 'sw', 'nw', 'ne']);
  });
  test('folha de 8: cada direção tem a sua linha', () => {
    const got = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => sheetDirFor(d, () => true));
    assert.deepEqual(got, DIR_TO_SHEET);
    assert.equal(new Set(got).size, 8);
    assert.deepEqual([...DIR_KEYS].sort(), [...got].sort());
  });
  test('folha só com as retas também funciona', () => {
    const straight: DirKey[] = ['s', 'e', 'n', 'w'];
    const got = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => sheetDirFor(d, (k) => straight.includes(k)));
    assert.ok(got.every((k) => k && straight.includes(k)));
  });
});

describe('girar a peça', () => {
  test('folha de 4 direções: gira entre as 4 poses, nos dois sentidos', () => {
    const four: DirKey[] = ['se', 'sw', 'nw', 'ne'];
    const allowed = distinctFacings((k) => four.includes(k));
    assert.deepEqual(allowed, [0, 2, 4, 6]);
    assert.equal(turnFacing(2, true, allowed), 4);
    assert.equal(turnFacing(6, true, allowed), 0);
    assert.equal(turnFacing(0, false, allowed), 6);
    // parada numa direção reta (andou na diagonal da grade): vai para a pose seguinte
    assert.equal(turnFacing(1, true, allowed), 2);
    assert.equal(turnFacing(1, false, allowed), 0);
  });

  test('folha de 8 (ou avatar pixel): passa pelas 8', () => {
    const all = distinctFacings(() => true);
    assert.deepEqual(all, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(turnFacing(7, true, []), 0);
    assert.equal(turnFacing(0, false, []), 7);
  });

  test('mestre vira a peça e todo mundo vê na hora; jogador não', () => {
    const s = gm.session();
    const tepes = s.characters.find((c) => c.name === 'D.Tepes')!;
    player.inbox = [];
    gm.act({ type: 'token.face', tokenId: tepes.id, dir: 6 });
    assert.equal(gm.last('denied'), undefined);
    assert.equal(player.last('tokens')?.tokens.find((t) => t.id === tepes.id)?.dir, 6);
    player.act({ type: 'token.face', tokenId: tepes.id, dir: 2 });
    assert.equal(player.last('denied')?.action, 'token.face');
    hotel.pushNow();
    assert.equal(gm.session().tokens.find((t) => t.id === tepes.id)?.dir, 6);
    gm.act({ type: 'token.face', tokenId: tepes.id, dir: 9 });
    assert.match(gm.last('denied')?.reason ?? '', /Direção inválida/);
  });
});

describe('folhas de sprite do repositório', () => {
  const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public');
  test('os quatro investigadores usam as folhas de client/public/arte', () => {
    const byName = new Map(hotel.db.characters.map((c) => [c.name, c]));
    for (const name of ['D.Tepes', 'Catarina Albuquerque', 'Alosi Walker', 'Cora Falcão']) {
      const def = byName.get(name);
      assert.ok(def, `personagem ${name}`);
      assert.match(def.sheet, /^\/arte\/personagens\/[a-z-]+\/folha\.webp$/);
      assert.ok(fs.existsSync(path.join(PUBLIC, def.sheet)), `arquivo ${def.sheet}`);
      assert.deepEqual(def.dirs, ['se', 'sw', 'nw', 'ne']);
    }
    const s = gm.session();
    for (const ch of s.characters) assert.equal(ch.look.charId, byName.get(ch.name)?.id, `peça ${ch.name} usa a folha`);
  });

  test('o mestre ajusta um personagem do repositório', () => {
    const def = hotel.db.characters.find((c) => c.name === 'D.Tepes')!;
    gm.send({ t: 'charUpdate', id: def.id, patch: { height: 96 } });
    assert.equal(hotel.db.characters.find((c) => c.id === def.id)?.height, 96);
    player.send({ t: 'charUpdate', id: def.id, patch: { height: 50 } });
    assert.equal(hotel.db.characters.find((c) => c.id === def.id)?.height, 96);
  });
});
