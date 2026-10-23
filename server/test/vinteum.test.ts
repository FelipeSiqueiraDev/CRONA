import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bar } from '@crona/shared';

const V = bar.vinteum;
type P = bar.vinteum.Partida;

/** Joga uma lista de jogadas e confere que cada uma valeu. */
function jogar(p: P, ...js: [number, Record<string, unknown>][]): P {
  for (const [de, d] of js) {
    const q = V.jogar(p, de, d);
    assert.notEqual(q, p, `a jogada ${JSON.stringify(d)} de ${de} não valeu (fase ${p.fase})`);
    p = q;
  }
  return p;
}

/** Põe as cartas no topo do sapato (a última sai primeiro). */
function cartas(p: P, ...c: number[]): P {
  return { ...p, sapato: [...p.sapato, ...c.reverse()] };
}

describe('o 21 da Sala de Jogos', () => {
  test('o total conta o Ás como 11 enquanto não estoura', () => {
    assert.deepEqual(V.total([0, 12]), { valor: 21, mole: true });
    assert.deepEqual(V.total([0, 5, 9]), { valor: 17, mole: false });
    assert.deepEqual(V.total([0, 0, 8]), { valor: 21, mole: true });
    assert.equal(V.total([12, 11, 1]).valor, 22);
  });

  test('o primeiro lugar escolhe as fichas e começa; sem dealer, a casa é a banca', () => {
    let p = V.nova(2);
    assert.equal(V.jogar(p, 1, { tipo: 'comecar', fichas: 100, semente: 1 }), p, 'só o primeiro lugar começa');
    p = jogar(p, [0, { tipo: 'comecar', fichas: 100, semente: 1 }]);
    assert.equal(p.fase, 'apostas');
    assert.equal(p.dealer, null);
    assert.equal(p.banca, null);
    assert.deepEqual(p.lugares.map((l) => l.fichas), [100, 100]);
  });

  test('quem marca "Ser o dealer" fica com a banca (as fichas de todos os jogadores)', () => {
    let p = jogar(V.nova(3), [2, { tipo: 'quero', dealer: true }], [1, { tipo: 'quero', dealer: true }], [0, { tipo: 'comecar', fichas: 200, semente: 9 }]);
    assert.equal(p.dealer, 1, 'o primeiro lugar que marcou');
    assert.equal(p.banca, 400);
    assert.deepEqual(V.jogadores(p), [0, 2]);
    // sozinho na mesa não dá para ser dealer
    p = jogar(V.nova(1), [0, { tipo: 'quero', dealer: true }], [0, { tipo: 'comecar', fichas: 50, semente: 2 }]);
    assert.equal(p.dealer, null);
  });

  test('a casa distribui, compra até 17 e paga quem ganhou', () => {
    let p = jogar(V.nova(1), [0, { tipo: 'comecar', fichas: 100, semente: 5 }]);
    // jogador: 10 e 9 (19); casa: 6 e 10 (16), compra o 2 (18)
    p = cartas(p, 9, 5, 8, 9, 1);
    p = jogar(p, [0, { tipo: 'aposta', valor: 20 }]);
    assert.equal(p.fase, 'jogadores');
    assert.equal(V.total(p.lugares[0].maos[0].cartas).valor, 19);
    p = jogar(p, [0, { tipo: 'parar' }]);
    assert.equal(p.fase, 'fim');
    assert.equal(V.total(p.casa).valor, 18);
    assert.equal(p.resultados[0].como, 'ganhou');
    assert.equal(p.lugares[0].fichas, 120);
  });

  test('o blackjack de saída paga 3 para 2', () => {
    let p = jogar(V.nova(1), [0, { tipo: 'comecar', fichas: 100, semente: 5 }]);
    // jogador: Ás e K; casa: 9 e 7 (16, compra o 4 = 20)
    p = cartas(p, 0, 8, 12, 6, 3);
    p = jogar(p, [0, { tipo: 'aposta', valor: 10 }]);
    assert.equal(p.fase, 'fim');
    assert.equal(p.resultados[0].como, 'bj');
    assert.equal(p.lugares[0].fichas, 115);
  });

  test('estourar perde; dobrar dobra a aposta e recebe uma carta só', () => {
    let p = jogar(V.nova(2), [0, { tipo: 'comecar', fichas: 100, semente: 3 }]);
    // lugar 0: 10, 6; lugar 1: 5, 6; casa: 7, 10. Lugar 0 pede um K (estoura); lugar 1 dobra e tira um 10 (21)
    p = cartas(p, 9, 4, 6, 5, 5, 9, 12, 9);
    p = jogar(p, [0, { tipo: 'aposta', valor: 10 }], [1, { tipo: 'aposta', valor: 10 }]);
    p = jogar(p, [0, { tipo: 'pedir' }]);
    assert.equal(p.vez, 1);
    p = jogar(p, [1, { tipo: 'dobrar' }]);
    assert.equal(p.fase, 'fim');
    assert.equal(p.resultados.find((r) => r.lugar === 0)!.como, 'estourou');
    assert.equal(p.resultados.find((r) => r.lugar === 1)!.como, 'ganhou');
    assert.deepEqual(p.lugares.map((l) => l.fichas), [90, 120]);
  });

  test('dividir faz duas mãos com a aposta de cada uma', () => {
    let p = jogar(V.nova(1), [0, { tipo: 'comecar', fichas: 100, semente: 4 }]);
    // jogador: 8 e 8; casa: 10 e 7 (17). Mão 1: 8 + 3 = 11, pede 9 = 20; mão 2: 8 + 10 = 18
    p = cartas(p, 7, 9, 20, 6, 2, 9, 8);
    p = jogar(p, [0, { tipo: 'aposta', valor: 10 }], [0, { tipo: 'dividir' }]);
    assert.equal(p.lugares[0].maos.length, 2);
    assert.equal(p.lugares[0].fichas, 80);
    p = jogar(p, [0, { tipo: 'pedir' }], [0, { tipo: 'parar' }], [0, { tipo: 'parar' }]);
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.resultados.map((r) => r.como), ['ganhou', 'ganhou']);
    assert.equal(p.lugares[0].fichas, 120);
  });

  test('o dealer de gente distribui, vira e compra pela regra; a banca paga', () => {
    let p = jogar(V.nova(2), [1, { tipo: 'quero', dealer: true }], [0, { tipo: 'comecar', fichas: 100, semente: 8 }]);
    // jogador: 10 e 8 (18); casa: 5 e 10 (15), compra o 9 (24, estoura)
    p = cartas(p, 9, 4, 7, 9, 8);
    p = jogar(p, [0, { tipo: 'aposta', valor: 50 }]);
    assert.equal(p.fase, 'distribuir');
    assert.equal(V.jogar(p, 0, { tipo: 'distribuir' }), p, 'só o dealer distribui');
    p = jogar(p, [1, { tipo: 'distribuir' }], [0, { tipo: 'parar' }]);
    assert.equal(p.fase, 'dealer');
    assert.equal(V.jogar(p, 1, { tipo: 'comprar' }), p, 'vira antes de comprar');
    p = jogar(p, [1, { tipo: 'virar' }], [1, { tipo: 'comprar' }]);
    assert.equal(p.fase, 'fim');
    assert.equal(p.lugares[0].fichas, 150);
    assert.equal(p.banca, 50);
  });

  test('a banca de gente sem fichas quebra e a partida acaba', () => {
    let p = jogar(V.nova(2), [1, { tipo: 'quero', dealer: true }], [0, { tipo: 'comecar', fichas: 20, semente: 8 }]);
    // o jogador aposta tudo e faz blackjack; a banca (20) vira 18 e paga 30
    p = cartas(p, 0, 7, 12, 9);
    p = jogar(p, [0, { tipo: 'aposta', valor: 20 }], [1, { tipo: 'distribuir' }], [1, { tipo: 'virar' }]);
    assert.equal(p.fase, 'acabou');
    assert.match(p.fim, /banca quebrou/);
  });

  test('a mesma semente dá a mesma partida em todo celular', () => {
    const js: [number, Record<string, unknown>][] = [
      [0, { tipo: 'comecar', fichas: 500, semente: 12345 }],
      [0, { tipo: 'aposta', valor: 25 }],
      [1, { tipo: 'aposta', valor: 100 }],
    ];
    const a = js.reduce((p, [de, d]) => V.jogar(p, de, d), V.nova(2));
    // as apostas chegando na outra ordem
    const b = [js[0], js[2], js[1]].reduce((p, [de, d]) => V.jogar(p, de, d), V.nova(2));
    assert.deepEqual(a.lugares, b.lugares);
    assert.deepEqual(a.casa, b.casa);
  });
});
