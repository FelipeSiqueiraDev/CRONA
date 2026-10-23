import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bar } from '@crona/shared';

const L = bar.luta;
const B = L.B;

/** Avança `n` quadros com os comandos dados (os botões descem no primeiro quadro). */
function rodar(p: bar.luta.Luta, n: number, a = 0, b = 0, antes: [number, number] = [0, 0]) {
  const ev: bar.luta.Evento[] = [];
  let ant = antes;
  for (let k = 0; k < n; k++) {
    const ent: [number, number] = [a, b];
    ev.push(...L.passo(p, ent, ant));
    ant = ent;
  }
  return ev;
}

/** Os dois prontos e a apresentação passada: a luta valendo. */
function lutando() {
  const p = L.nova();
  L.passo(p, [B.soco, B.soco], [0, 0]);
  assert.equal(p.fase, 'apresenta');
  rodar(p, 120);
  assert.equal(p.fase, 'luta');
  return p;
}

/** Põe os dois frente a frente, a `d` pixels. */
function perto(p: bar.luta.Luta, d: number) {
  p.l[0].x = 90;
  p.l[1].x = 90 + d;
}

describe("o Felipe's Fight", () => {
  test('só começa com os dois prontos', () => {
    const p = L.nova();
    L.passo(p, [B.soco, 0], [0, 0]);
    assert.equal(p.fase, 'espera');
    assert.deepEqual(p.pronto, [true, false]);
    L.passo(p, [0, B.chute], [B.soco, 0]);
    assert.equal(p.fase, 'apresenta');
    assert.equal(p.round, 1);
  });

  test('o soco de perto acerta, tira vida e atordoa', () => {
    const p = lutando();
    perto(p, 14);
    const ev = rodar(p, 12, B.soco);
    assert.ok(ev.some((e) => e.tipo === 'acerto'));
    assert.equal(p.l[1].vida, L.VIDA - L.GOLPES.soco.dano);
    assert.ok(p.l[0].energia > 0);
  });

  test('de longe o soco não pega; segurando para baixo, defende', () => {
    let p = lutando();
    perto(p, 60);
    rodar(p, 14, B.soco);
    assert.equal(p.l[1].vida, L.VIDA);
    p = lutando();
    perto(p, 14);
    // o segundo segura a defesa antes do soco
    rodar(p, 2, 0, B.baixo);
    const ev = rodar(p, 12, B.soco, B.baixo, [0, B.baixo]);
    assert.ok(ev.some((e) => e.tipo === 'defesa'));
    assert.ok(p.l[1].vida > L.VIDA - L.GOLPES.soco.dano);
  });

  test('o especial sai com meia barra e a bola acerta de longe', () => {
    const p = lutando();
    perto(p, 70);
    rodar(p, 3, B.especial);
    assert.equal(p.l[0].estado, 'parado', 'sem energia não sai');
    p.l[0].energia = L.CUSTO_ESPECIAL;
    const ev = rodar(p, 60, B.especial);
    assert.ok(ev.some((e) => e.tipo === 'bola'));
    assert.ok(p.l[1].vida < L.VIDA);
    assert.ok(p.l[0].energia < L.CUSTO_ESPECIAL, 'gastou a meia barra (e ganhou um tico acertando)');
  });

  test('o nocaute fecha o round; dois rounds ganham a luta', () => {
    const p = lutando();
    p.l[1].vida = 3;
    perto(p, 14);
    rodar(p, 12, B.soco);
    assert.equal(p.fase, 'ko');
    assert.equal(p.l[0].rounds, 1);
    rodar(p, 150);
    assert.equal(p.fase, 'apresenta');
    assert.equal(p.round, 2);
    rodar(p, 120);
    p.l[1].vida = 3;
    perto(p, 14);
    rodar(p, 12, B.soco);
    rodar(p, 150);
    assert.equal(p.fase, 'fim');
    assert.equal(p.vencedor, 0);
  });

  test('o tempo acabando dá o round para quem tem mais vida', () => {
    const p = lutando();
    p.l[0].vida = 40;
    p.relogio = 2;
    const ev = rodar(p, 3);
    assert.ok(ev.some((e) => e.tipo === 'tempo'));
    assert.equal(p.levou, 1);
  });
});
