import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gravarAssento, lerAssentos } from '../src/assentos';

/** O ajuste de quem senta em cada tipo de assento (28/10): grava, lê de volta e o 0, 0 tira. */
test('o ajuste do assento grava por móvel e direção e volta ao da conta com 0, 0', () => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crona-')), 'sentar.json');
  let mapa = gravarAssento({}, 'poltrona_preta', 'ne', 3, -6, arquivo);
  mapa = gravarAssento(mapa, 'bench', 'nw', -2.3, 1, arquivo);
  assert.deepEqual(lerAssentos(arquivo), { 'bench:nw': [-2.5, 1], 'poltrona_preta:ne': [3, -6] });
  // o que não é móvel nem direção não entra
  mapa = gravarAssento(mapa, '../x', 'ne', 5, 5, arquivo);
  assert.equal(Object.keys(lerAssentos(arquivo)).length, 2);
  mapa = gravarAssento(mapa, 'poltrona_preta', 'ne', 0, 0, arquivo);
  mapa = gravarAssento(mapa, 'bench', 'nw', 0, 0, arquivo);
  assert.deepEqual(mapa, {});
  assert.equal(fs.existsSync(arquivo), false, 'sem ajuste nenhum, o arquivo sai');
});
