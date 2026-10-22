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
    assert.ok(!passos[0].ganhos.some((g) => g.titulo === 'Poder de classe'));
    assert.ok(passos[1].ganhos.some((g) => g.titulo === 'Poder de classe' && g.escolha));
    // o Monstruoso tem a alteração de NEX 25% (SaH p. 99): entra nas contas e pede a perícia do −5
    assert.ok(passos[0].ganhos.some((g) => g.titulo === 'Alteração do Monstruoso' && g.ref?.pagina === 99 && g.escolha && !g.mestre));
  });
});

describe('a Progressão de NEX do Monstruoso (SaH p. 17 e 99), nas contas', () => {
  const tepes = (nex: regras.Nex, alteracoes: Partial<Record<regras.Nex, regras.EscolhasNex>> = {}): regras.Ficha => ({
    ...regras.novaFicha('Tepes'),
    classe: 'combatente',
    trilha: 'monstruoso',
    origem: 'policial',
    nex,
    atributos: { agi: 1, for: 2, int: 2, pre: 1, vig: 3 },
    pericias: { grupos: ['luta', 'fortitude'], livres: ['adestramento', 'investigacao', 'vontade'] },
    progressao: {
      10: { parametros: { 'ser-amaldicoado': { elemento: 'sangue' } } },
      15: { poder: { id: 'combate-defensivo' } },
      20: { atributo: 'vig' },
      ...alteracoes,
    },
  });

  it('em NEX 25% falta a perícia do −5; antes de 25% não falta nada', () => {
    const k20 = regras.calcular(tepes(20));
    assert.ok(!k20.pendencias.some((p) => p.alvo === 'alteracao-nex-25'));
    const k25 = regras.calcular(tepes(25));
    const p = k25.pendencias.find((x) => x.alvo === 'alteracao-nex-25');
    assert.ok(p, 'a alteração de 25% é pendência');
    assert.equal(p!.tipo, 'parametro');
  });

  it('NEX 25%: Ocultismo +2 (treinado pela trilha) e −5 na perícia escolhida entre Diplomacia, Enganação e Intimidação', () => {
    const sem = regras.calcular(tepes(25));
    const com = regras.calcular(tepes(25, { 25: { parametros: { 'alteracao-nex-25': { pericias: ['intimidacao'] } } } }));
    assert.equal(com.pendencias.some((p) => p.alvo === 'alteracao-nex-25'), false);
    assert.equal(com.pericias.ocultismo.bonus, sem.pericias.ocultismo.bonus, 'o +2 já valia antes de escolher');
    assert.equal(com.pericias.ocultismo.bonus - regras.calcular(tepes(20)).pericias.ocultismo.bonus, 2);
    assert.equal(com.pericias.intimidacao.bonus - sem.pericias.intimidacao.bonus, -5);
    assert.equal(com.pericias.diplomacia.bonus, sem.pericias.diplomacia.bonus);
  });

  it('a escolha fora de Diplomacia, Enganação e Intimidação é erro', () => {
    const k = regras.calcular(tepes(25, { 25: { parametros: { 'alteracao-nex-25': { pericias: ['luta'] } } } }));
    assert.ok(k.problemas.some((p) => p.severidade === 'erro' && /Alteração de NEX 25%/.test(p.texto)));
  });

  it('NEX 35%: soma o atributo escolhido nos PE e tira −5 de Atletismo, Fortitude ou Reflexos', () => {
    const base = tepes(35, { 25: { parametros: { 'alteracao-nex-25': { pericias: ['diplomacia'] } } }, 30: { poder: { id: 'golpe-pesado' } }, 35: { grau: ['luta', 'fortitude', 'pontaria'] } });
    const sem = regras.calcular(base);
    assert.ok(sem.pendencias.some((p) => p.alvo === 'alteracao-nex-35-pe'));
    assert.ok(sem.pendencias.some((p) => p.alvo === 'alteracao-nex-35-pericia'));
    const f = tepes(35, {
      25: { parametros: { 'alteracao-nex-25': { pericias: ['diplomacia'] } } },
      30: { poder: { id: 'golpe-pesado' } },
      35: { grau: ['luta', 'fortitude', 'pontaria'], parametros: { 'alteracao-nex-35-pe': { atributo: 'vig' }, 'alteracao-nex-35-pericia': { pericias: ['atletismo'] } } },
    });
    const com = regras.calcular(f);
    assert.equal(com.pe - sem.pe, com.atributos.vig);
    assert.equal(com.pericias.atletismo.bonus - sem.pericias.atletismo.bonus, -5);
    assert.equal(com.pendencias.filter((p) => /alteracao-nex-35/.test(p.alvo ?? '')).length, 0);
  });

  it('Presença não vale na alteração de NEX 35%: é erro', () => {
    const k = regras.calcular(tepes(35, { 35: { parametros: { 'alteracao-nex-35-pe': { atributo: 'pre' } } } }));
    assert.ok(k.problemas.some((p) => p.severidade === 'erro' && /Presença não é uma das opções/.test(p.texto)));
  });

  it('quem não é Monstruoso não recebe a alteração', () => {
    const f: regras.Ficha = { ...tepes(30), trilha: 'aniquilador', progressao: { 10: { parametros: { 'a-favorita': { arma: 'katana' } } }, 15: { poder: { id: 'combate-defensivo' } }, 20: { atributo: 'vig' } } };
    assert.ok(!regras.calcular(f).pendencias.some((p) => /alteracao/.test(p.alvo ?? '')));
  });
});
