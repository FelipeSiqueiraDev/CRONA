import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alturaDaCriatura, casasDaPegada, casasMaisPerto, criaturaDoLivro, desvioDoMeio, ladoDaCriatura, naPegada, pegadaDaPeca } from '@crona/shared';

// o tamanho dos seres pela Tab. 7.1 do livro (LR p. 179; 06/11)

test('a pegada: Médio 1 casa, Grande 2 × 2, Enorme 3 × 3, Colossal 6 × 6, em volta da casa da peça', () => {
  assert.deepEqual(casasDaPegada(pegadaDaPeca(5, 5, 1)), [{ x: 5, y: 5 }]);
  assert.equal(casasDaPegada(pegadaDaPeca(5, 5, 2)).length, 4);
  assert.deepEqual(pegadaDaPeca(5, 5, 3), { x0: 4, y0: 4, lado: 3 });
  assert.equal(casasDaPegada(pegadaDaPeca(5, 5, 6)).length, 36);
  assert.ok(naPegada(pegadaDaPeca(5, 5, 2), 6, 6));
  assert.ok(!naPegada(pegadaDaPeca(5, 5, 2), 4, 5));
  // o desenho fica no meio da pegada
  assert.equal(desvioDoMeio(1), 0);
  assert.equal(desvioDoMeio(2), 0.5);
  assert.equal(desvioDoMeio(3), 0);
});

test('a distância conta das casas mais perto das duas pegadas (a borda da criatura grande)', () => {
  const grande = pegadaDaPeca(10, 10, 3); // 9..11
  const [a, b] = casasMaisPerto(pegadaDaPeca(5, 10, 1), grande);
  assert.deepEqual(a, { x: 5, y: 10 });
  assert.deepEqual(b, { x: 9, y: 10 });
  const [c, d] = casasMaisPerto(pegadaDaPeca(13, 13, 1), grande);
  assert.deepEqual(d, { x: 11, y: 11 });
  assert.deepEqual(c, { x: 13, y: 13 });
});

test('a criatura do livro tem o lado e a altura da categoria; a Média fica como sempre', () => {
  const grande = criaturaDoLivro('enpap-x');
  assert.ok(grande);
  assert.equal(ladoDaCriatura(grande), 2);
  assert.equal(alturaDaCriatura(grande), 3);
  const media = criaturaDoLivro('anarquico');
  assert.equal(ladoDaCriatura(media), 1);
  assert.equal(alturaDaCriatura(media), 1.8);
  // a altura da criatura vale mais que a da categoria
  assert.equal(alturaDaCriatura({ ...grande!, altura: 2.4 }), 2.4);
});
