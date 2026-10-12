import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { BATIDAS_DIAGONAL, BATIDAS_RETO, findPath, MEIO_PASSO_MS, RoomMap, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';
import { SEDE } from '../src/seedSede';

/**
 * O andar das peças (12/10): a diagonal leva mais tempo (a peça anda sempre na mesma velocidade) e,
 * entre caminhos do mesmo tamanho, fica o que vira menos (sem zigue-zague).
 */
const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

/** Quantas vezes o caminho muda de direção. */
function viradas(inicio: { x: number; y: number }, caminho: { x: number; y: number }[]) {
  let n = 0;
  let antes = '';
  let p = inicio;
  for (const q of caminho) {
    const d = `${q.x - p.x},${q.y - p.y}`;
    if (antes && d !== antes) n++;
    antes = d;
    p = q;
  }
  return n;
}

describe('caminho sem zigue-zague', () => {
  const sala = () => new RoomMap(Array.from({ length: 12 }, () => '000000000000').join('\n'), { x: 0, y: 0, dir: 4 }, []);

  test('do mesmo tamanho, vira uma vez só', () => {
    const m = sala();
    for (const [a, b] of [
      [{ x: 1, y: 8 }, { x: 9, y: 3 }],
      [{ x: 2, y: 2 }, { x: 10, y: 5 }],
      [{ x: 10, y: 10 }, { x: 1, y: 7 }],
    ]) {
      const c = findPath(m, a, b, () => false)!;
      assert.ok(c);
      assert.equal(c.length, Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)), 'o mais curto');
      assert.ok(viradas(a, c) <= 1, `${JSON.stringify(a)} → ${JSON.stringify(b)}: ${viradas(a, c)} viradas`);
    }
  });

  test('quem já vinha andando segue na mesma direção', () => {
    const m = sala();
    // de (2,2) a (6,4): dá para começar reto (+x) ou na diagonal; vindo para +x, começa reto
    const c = findPath(m, { x: 2, y: 2 }, { x: 6, y: 4 }, () => false, 2)!;
    assert.deepEqual(c[0], { x: 3, y: 2 });
    const d = findPath(m, { x: 2, y: 2 }, { x: 6, y: 4 }, () => false, 3)!;
    assert.deepEqual(d[0], { x: 3, y: 3 });
  });
});

describe('o tempo do passo', () => {
  let hotel: Hotel;
  let inbox: ServerMsg[];
  let client: ReturnType<Hotel['attach']>;
  const send = (m: ClientMsg) => hotel.receive(client, m);
  const bar = () => [...hotel.rooms.values()].find((r) => r.data.name === SEDE + 'Bar')!;

  beforeEach(() => {
    const db = seedDb();
    upgradeDb(db);
    hotel = new Hotel({ db, persist: false, timers: false });
    inbox = [];
    client = hotel.attach((m) => inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, true);
    send({ t: 'login', name: 'Mestre', look });
    send({ t: 'join', roomId: bar().data.id });
  });

  test('o reto leva 2 meios passos e a diagonal 3; o cliente recebe quanto o passo leva', () => {
    assert.equal(BATIDAS_RETO * MEIO_PASSO_MS, 500);
    assert.equal(BATIDAS_DIAGONAL * MEIO_PASSO_MS, 750);
    const r = bar();
    const [t] = r.tokenList();
    const p0 = r.userPositions().find((p) => p.id === t.id)!;
    // um passo na diagonal para uma casa livre
    const alvo = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]
      .map(([dx, dy]) => ({ x: p0.x + dx, y: p0.y + dy }))
      .find((c) => r.map.walkState(c.x, c.y) === 'walk' && r.map.walkState(c.x, p0.y) === 'walk' && r.map.walkState(p0.x, c.y) === 'walk' && !r.userPositions().some((p) => p.x === c.x && p.y === c.y))!;
    assert.ok(alvo, 'tem uma diagonal livre');
    send({ t: 'tokenWalk', tokenId: t.id, x: alvo.x, y: alvo.y });
    inbox = [];
    const pos = () => r.userPositions().find((p) => p.id === t.id)!;
    r.step(true); // sai andando
    const st = inbox.find((m) => m.t === 'status') as Extract<ServerMsg, { t: 'status' }> | undefined;
    const mv = st?.updates.find((u) => u.id === -t.id || u.mv)?.mv;
    assert.equal(mv?.ms, 750);
    r.step(true);
    r.step(true);
    assert.deepEqual([pos().x, pos().y], [p0.x, p0.y], 'ainda no meio do passo');
    r.step(true);
    assert.deepEqual([pos().x, pos().y], [alvo.x, alvo.y], 'chegou na terceira batida');
  });
});
