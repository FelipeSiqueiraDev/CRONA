import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { regras } from '@crona/shared';

const ficha = (classe: regras.ClasseAgente, trilha: string, nex: number): regras.Ficha => ({ ...regras.novaFicha('Teste'), classe, trilha, nex: nex as regras.Nex });

describe('o aviso de evolução (o que o livro dá a cada NEX)', () => {
  it('NEX 25% do ocultista: o 2º círculo entra sozinho e há um ritual novo a escolher (LR p. 33)', () => {
    const [p] = regras.resumoEvolucao(ficha('ocultista', 'graduado', 25), 20);
    assert.equal(p.nex, 25);
    assert.ok(p.ganhos.some((g) => g.titulo === 'Ritual novo' && g.escolha));
    assert.ok(p.ganhos.some((g) => /Escolhido pelo Outro Lado/.test(g.titulo) && /2º círculo/.test(g.texto ?? '') && !g.escolha));
    assert.ok(p.pv.mais > 0 && p.pe.mais > 0 && p.san.mais > 0);
    assert.equal(p.limitePe, 5);
  });

  it('NEX 25% do combatente e do especialista: Ataque Especial e Perito crescem, sem escolha (Tab. 1.3 e 1.4)', () => {
    const [c] = regras.resumoEvolucao(ficha('combatente', 'aniquilador', 25), 20);
    assert.deepEqual(c.ganhos.map((g) => g.titulo), ['Ataque Especial cresce']);
    assert.match(c.ganhos[0].texto ?? '', /3 PE: \+10/);
    const [e] = regras.resumoEvolucao(ficha('especialista', 'infiltrador', 25), 20);
    assert.match(e.ganhos[0].texto ?? '', /3 PE: \+1d8/);
    assert.ok(!e.ganhos.some((g) => g.escolha));
  });

  it('de 20% para 30%: um passo por NEX, e o poder só no 30%', () => {
    const passos = regras.resumoEvolucao(ficha('combatente', 'monstruoso', 30), 20);
    assert.deepEqual(passos.map((p) => p.nex), [25, 30]);
    assert.ok(!passos[0].ganhos.some((g) => g.escolha));
    assert.ok(passos[1].ganhos.some((g) => g.titulo === 'Poder de classe' && g.escolha));
    // o Monstruoso tem a alteração de NEX 25% (SaH p. 99), com o mestre
    assert.ok(passos[0].ganhos.some((g) => g.titulo === 'Alteração do Monstruoso' && g.ref?.pagina === 99));
  });
});
