import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { combate, regras } from '@crona/shared';

type Combate = combate.Combate;
type Acao = combate.AcaoCombate;

// as regras da casa de "Segredos do Outro Lado" (o PDF de 06/11), a munição contada (LR p. 174) e a Camarilla fora do combate

const PECAS: combate.PecaCombate[] = [
  { id: 1, nome: 'Cora', agente: true, naCena: true },
  { id: 2, nome: 'Tepes', agente: true, naCena: true },
  { id: 10, nome: 'Porco', agente: false, naCena: true },
  { id: 20, nome: 'Camarilla', agente: false, naCena: true, companheiroDe: 'Tepes' },
];
let relogio = 1000;
const ctx = (): combate.Contexto => ({ agora: relogio++, cena: 7, pecas: PECAS, vitais: () => ({ pv: 20, pvMax: 20, pe: 5, peMax: 5, san: 20, sanMax: 20 }) });
function aplicar(c: Combate | null, a: Acao): Combate {
  const r = combate.aplicar(c, a, ctx());
  if (!r.ok) throw new Error(r.motivo);
  return r.combate!;
}
function recusa(c: Combate | null, a: Acao): string {
  const r = combate.aplicar(c, a, ctx());
  assert.equal(r.ok, false, 'devia recusar');
  return (r as { ok: false; motivo: string }).motivo;
}
const vez = (c: Combate) => {
  const e = combate.entrada(c, c.vez);
  return e ? combate.nomeEntrada(c, e) : '—';
};
const ate = (c: Combate, nome: string) => {
  for (let i = 0; i < 10 && vez(c) !== nome; i++) c = aplicar(c, { tipo: 'passar' });
  return c;
};
function comecado(): Combate {
  let c = aplicar(null, { tipo: 'abrir' });
  c = aplicar(c, { tipo: 'participante', id: 1, iniciativa: 22 });
  c = aplicar(c, { tipo: 'participante', id: 2, iniciativa: 18 });
  c = aplicar(c, { tipo: 'iniciativaMestre', valor: 14 });
  return aplicar(c, { tipo: 'comecar' });
}
const ataque = (quem: number, alvo: number, extra: Partial<combate.AtaqueConfirmado> = {}): Acao => ({
  tipo: 'ataque',
  ataque: { quem, alvo, arma: 'Faca', qual: 'padrao', teste: { dados: 2, bonus: 5, d20: 15, total: 20, defesa: 12 }, situacoes: [], resultado: 'acerto', ...extra },
});

beforeEach(() => {
  relogio = 1000;
});

describe('regras da casa', () => {
  test('a Camarilla não participa de combates (abrir, incluir e pôr no combate recusam)', () => {
    const c = aplicar(null, { tipo: 'abrir' });
    assert.deepEqual(
      c.participantes.map((p) => p.nome),
      ['Cora', 'Tepes', 'Porco'],
    );
    assert.match(recusa(c, { tipo: 'participante', id: 20, incluir: true, iniciativa: 10 }), /não participa de combates/);
    const d = comecado();
    assert.match(recusa(d, { tipo: 'entrar', id: 20, lado: 'agente', iniciativa: 10 }), /não participa de combates/);
  });

  test('golpe de passagem: −1d20 e −5, gasta a padrão e a de movimento', () => {
    const s = combate.situacao('passagem');
    assert.equal(s.dados, -1);
    assert.equal(s.bonus, -5);
    let c = comecado();
    c = aplicar(c, ataque(1, 10, { passagem: true }));
    const ac = combate.acoesDe(c, 1);
    assert.equal(ac.padrao, true);
    assert.equal(ac.movimento, true);
    // com o movimento já gasto, recusa
    let d = comecado();
    d = aplicar(d, { tipo: 'declarar', qual: 'movimento', texto: 'anda', quem: 1 });
    assert.match(recusa(d, ataque(1, 10, { passagem: true })), /gasta também a ação de movimento/);
  });

  test('olho do predador: rodadas mirando somam até 2; mover encerra; o disparo gasta a mira', () => {
    let c = comecado();
    c = aplicar(c, { tipo: 'declarar', qual: 'completa', texto: 'olho do predador contra Porco', quem: 1, mirar: 10 });
    assert.deepEqual(combate.participante(c, 1)?.mira, { alvo: 10, rodadas: 1 });
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    c = aplicar(c, { tipo: 'declarar', qual: 'completa', texto: 'olho do predador contra Porco', quem: 1, mirar: 10 });
    assert.deepEqual(combate.participante(c, 1)?.mira, { alvo: 10, rodadas: 2 });
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    c = aplicar(c, ataque(1, 10, { arma: 'Fuzil de precisão', situacoes: ['olho do predador (2 rodadas)'] }));
    assert.equal(combate.participante(c, 1)?.mira, undefined);
    // mover encerra a preparação
    let d = comecado();
    d = aplicar(d, { tipo: 'declarar', qual: 'completa', texto: 'mira', quem: 1, mirar: 10 });
    d = ate(aplicar(d, { tipo: 'passar' }), 'Cora');
    d = aplicar(d, { tipo: 'declarar', qual: 'movimento', texto: 'anda', quem: 1 });
    assert.equal(combate.participante(d, 1)?.mira, undefined);
    assert.equal(combate.situacao('olhoPredador').bonus, 5);
    assert.equal(combate.situacao('disparoNaoLetal').so, 'distancia');
  });

  test('prisão com corrente: Atletismo DT 10, +5 a cada vez; falhou, o alvo se liberta', () => {
    let c = comecado();
    c = aplicar(c, {
      tipo: 'manobra',
      manobra: { quem: 1, alvo: 10, manobra: 'agarrar', qual: 'padrao', arma: 'Corrente', corrente: true, teste: { quem: { dados: 2, bonus: 5, d20: 15, total: 20 }, alvo: { dados: 1, bonus: 2, d20: 10, total: 12 } }, venceu: true, diferenca: 8, modificadores: [] },
    });
    assert.deepEqual(combate.participante(c, 1)?.corrente, { mantidas: 0, desde: 1 });
    // no mesmo turno, nada a testar
    assert.equal(c.correntes, undefined);
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    assert.deepEqual(c.correntes, [{ id: 1, dt: 10 }]);
    c = aplicar(c, { tipo: 'corrente', id: 1, passou: true });
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    assert.deepEqual(c.correntes, [{ id: 1, dt: 15 }]);
    c = aplicar(c, { tipo: 'corrente', id: 1, passou: false, arrastar: true });
    assert.equal(combate.participante(c, 1)?.agarra, undefined);
    assert.equal(combate.participante(c, 1)?.corrente, undefined);
    assert.equal(combate.participante(c, 10)?.condicoes, undefined);
  });
});

describe('munição contada (LR p. 174)', () => {
  const inv = (): regras.ItemFicha[] => [
    { id: 'revolver', tipo: 'arma', uid: 1, empunhado: true },
    { id: 'balas-curtas', tipo: 'equipamento', uid: 2, qtd: 2 },
    { id: 'arco', tipo: 'arma', uid: 3 },
    { id: 'flechas', tipo: 'equipamento', uid: 4 },
  ];

  test('a arma nova vem cheia; cada disparo gasta; vazia, não dispara; recarregar tira dos pacotes', () => {
    let i = inv();
    assert.equal(regras.estadoMunicao(i, i[0])?.naArma, 6);
    assert.equal(regras.estadoMunicao(i, i[0])?.naMochila, 40);
    for (let k = 0; k < 6; k++) {
      const d = regras.disparar(i, 1);
      assert.ok(d.ok);
      i = (d as { inventario: regras.ItemFicha[] }).inventario;
    }
    assert.equal(i[0].carregador, 0);
    const vazia = regras.disparar(i, 1);
    assert.equal(vazia.ok, false);
    assert.match((vazia as { motivo: string }).motivo, /recarregue/);
    const r = regras.recarregar(i, 1);
    assert.ok(r.ok);
    i = (r as { inventario: regras.ItemFicha[] }).inventario;
    assert.equal(i.find((x) => x.uid === 1)?.carregador, 6);
    // um pacote aberto (14 balas) e um fechado
    const pacotes = i.filter((x) => x.id === 'balas-curtas');
    assert.equal(pacotes.length, 2);
    assert.equal(regras.balasNaMochila(i, 'balas-curtas'), 34);
    assert.equal(pacotes.find((x) => x.balas !== undefined)?.balas, 14);
  });

  test('sem carregador (arco), tira direto do pacote; o pacote vazio sai da mochila', () => {
    let i = inv();
    for (let k = 0; k < 20; k++) i = (regras.disparar(i, 3) as { inventario: regras.ItemFicha[] }).inventario;
    assert.equal(i.some((x) => x.id === 'flechas'), false);
    assert.equal(regras.disparar(i, 3).ok, false);
  });

  test('a rajada gasta 10 balas', () => {
    const i: regras.ItemFicha[] = [{ id: 'submetralhadora', tipo: 'arma', uid: 1, empunhado: true }];
    const d = regras.disparar(i, 1, regras.BALAS_DA_RAJADA);
    assert.ok(d.ok);
    assert.equal((d as { inventario: regras.ItemFicha[] }).inventario[0].carregador, 10);
  });
});
