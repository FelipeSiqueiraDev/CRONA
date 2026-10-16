import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { regras, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

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

/** Combatente de NEX 5% (Militar), pronto. */
function ficha(pp = 0): regras.Ficha {
  const f = regras.novaFicha('Teste');
  f.atributos = { agi: 2, for: 2, int: 1, pre: 1, vig: 3 };
  f.origem = 'militar';
  f.classe = 'combatente';
  f.pericias.grupos = ['luta', 'fortitude'];
  f.pericias.livres = ['atletismo', 'percepcao'];
  f.pp = pp;
  return f;
}

describe('requisição: o que se escolhe dentro do item', () => {
  test('o utensílio pede a perícia, e com ela dá +2 na mão', () => {
    assert.equal(regras.escolhaDoItem('equipamento', 'utensilio'), 'pericia');
    assert.equal(regras.escolhaDoItem('equipamento', 'amarras-de-elemento'), 'elemento');
    assert.equal(regras.escolhaDoItem('arma', 'faca'), null);
    assert.ok(!regras.periciasDoItem().some((p) => p.id === 'luta' || p.id === 'pontaria'));
    const f = ficha();
    const antes = regras.calcular(f).pericias.investigacao.bonus;
    f.inventario.push({ id: 'utensilio', tipo: 'equipamento', empunhado: true, escolha: { pericia: 'investigacao' } });
    assert.equal(regras.calcular(f).pericias.investigacao.bonus, antes + 2);
    assert.equal(regras.nomeDoItem({ id: 'amarras-de-elemento', tipo: 'equipamento', escolha: { elemento: 'sangue' } }), 'Amarras de Sangue');
  });
});

describe('requisição: modificações e maldições', () => {
  test('só aparece o que serve para o item; requisito de proteção pesada trava na leve', () => {
    const f = ficha();
    f.inventario.push({ id: 'protecao-leve', tipo: 'protecao' });
    const ops = regras.opcoesDeMelhoria(f, 0);
    assert.ok(ops.length);
    assert.ok(!ops.some((o) => o.id === 'certeira'), 'modificação de arma não aparece na proteção');
    const pesada = ops.find((o) => o.tipo === 'modificacao' && regras.catalogo.modificacao(o.id)?.requisitos?.some((r) => r.tipo === 'texto' && r.texto === 'só em proteção pesada'));
    assert.ok(pesada && !pesada.ok, 'a de proteção pesada fica travada');
  });

  test('maldição: só de agente especial em diante, e elementos que se oprimem não vão juntos', () => {
    const recruta = ficha(0);
    recruta.nex = 10;
    recruta.inventario.push({ id: 'faca', tipo: 'arma' });
    const r = regras.opcoesDeMelhoria(recruta, 0).find((o) => o.tipo === 'maldicao')!;
    assert.ok(!r.ok && r.motivos.some((m) => /agente especial/.test(m)));
    const especial = ficha(60);
    especial.inventario.push({ id: 'faca', tipo: 'arma', maldicoes: ['lancinante'] });
    // sangue oprime conhecimento: Senciente (conhecimento) não vai junto
    const senciente = regras.opcoesDeMelhoria(especial, 0).find((o) => o.id === 'senciente')!;
    assert.ok(!senciente.ok, 'conhecimento com sangue fica travado');
  });
});

describe('requisição no servidor', () => {
  let hotel: Hotel;
  let gm: Peer;
  let id: number;
  const salva = () => hotel.db.fichas!.find((x) => x.id === id)!;
  beforeEach(() => {
    const db = seedDb();
    upgradeDb(db);
    hotel = new Hotel({ db, persist: false, timers: false });
    gm = new Peer(hotel, true);
    gm.send({ t: 'login', name: 'Mestre', look });
    const agora = new Date().toISOString();
    gm.send({ t: 'fichaSalvar', ficha: { id: 0, nome: 'Teste', ficha: ficha(), criadaEm: agora, atualizadaEm: agora } as FichaSalva });
    id = gm.last('fichas')!.nova!;
  });

  test('munição empilha em pacotes; o utensílio guarda a perícia escolhida', () => {
    gm.send({ t: 'mochilaNova', fichaId: id, tipo: 'equipamento', id: 'balas-curtas' });
    gm.send({ t: 'mochilaNova', fichaId: id, tipo: 'equipamento', id: 'balas-curtas' });
    const balas = salva().ficha.inventario.filter((x) => x.id === 'balas-curtas');
    assert.equal(balas.length, 1);
    assert.equal(balas[0].qtd, 2);
    gm.send({ t: 'mochilaNova', fichaId: id, tipo: 'equipamento', id: 'utensilio', escolha: { pericia: 'investigacao' } });
    assert.equal(salva().ficha.inventario.find((x) => x.id === 'utensilio')?.escolha?.pericia, 'investigacao');
  });

  test('o mestre põe e tira uma modificação; o que não serve para o item é recusado', () => {
    gm.send({ t: 'mochilaNova', fichaId: id, tipo: 'arma', id: 'faca' });
    const uid = salva().ficha.inventario.find((x) => x.id === 'faca')!.uid!;
    gm.send({ t: 'mochilaMelhorar', fichaId: id, uid, tipo: 'modificacao', id: 'certeira', por: true });
    assert.deepEqual(salva().ficha.inventario.find((x) => x.uid === uid)?.modificacoes, ['certeira']);
    gm.send({ t: 'mochilaMelhorar', fichaId: id, uid, tipo: 'modificacao', id: 'certeira', por: false });
    assert.equal(salva().ficha.inventario.find((x) => x.uid === uid)?.modificacoes, undefined);
    gm.send({ t: 'mochilaMelhorar', fichaId: id, uid, tipo: 'modificacao', id: 'nao-existe', por: true });
    assert.match(gm.last('error')?.msg ?? '', /não vai/);
  });

  test('o jogador que salva a ficha passando do limite da patente é recusado', () => {
    gm.send({ t: 'fichaLink', id });
    const chave = salva().chave!;
    const jog = new Peer(hotel);
    jog.send({ t: 'login', name: 'Jogador', look, fichaKey: chave });
    const f = structuredClone(salva());
    // recruta: uma vaga de categoria I; pede três
    for (const x of ['submetralhadora', 'submetralhadora', 'submetralhadora']) f.ficha.inventario.push({ id: x, tipo: 'arma' });
    jog.send({ t: 'fichaSalvar', ficha: f });
    assert.match(jog.last('error')?.msg ?? '', /patente/);
    assert.ok(!salva().ficha.inventario.some((x) => x.id === 'submetralhadora'));
  });
});

describe('interlúdio (LR p. 92–93)', () => {
  test('as contas: dormir pelo limite de PE e o lugar, o prato, o relaxar em grupo e os bônus guardados', () => {
    const no = (id: number, acoes: regras.AcaoInterludio[], prato?: regras.Prato): regras.NoInterludio => ({
      id,
      limitePe: 4,
      vigor: 2,
      intelecto: 1,
      atual: { pv: 1, pe: 1, san: 1 },
      max: { pv: 40, pe: 40, san: 40 },
      bonus: { exercicio: 0, leitura: 1 },
      escolha: { acoes, prato },
    });
    const [a, b, c] = regras.resolverInterludio('confortavel', [no(1, ['dormir', 'alimentar'], 'nutritivo'), no(2, ['relaxar', 'ler']), no(3, ['relaxar', 'exercitar'])]);
    assert.deepEqual([a.pv, a.pe], [12, 8], 'confortável ×2; o prato nutritivo sobe o PV para ×3');
    assert.equal(b.san, 8 + 2, 'relaxar: 4 × 2, mais 1 por quem relaxou (2)');
    assert.equal(b.bonus.leitura, 1, 'leitura já no máximo (Intelecto 1)');
    assert.equal(c.bonus.exercicio, 1);
    assert.deepEqual(regras.errosDaEscolha({ acoes: ['dormir', 'dormir'] }).length, 1);
    assert.equal(regras.resolverInterludio('precario', [no(1, ['dormir'])])[0].pv, 2, 'precária: metade');
    // cada um no quarto dele (o hotel, a pousada): o quarto vale no lugar da condição do grupo
    const [bom, ruim, sem] = regras.resolverInterludio('normal', [{ ...no(1, ['dormir']), lugar: 'confortavel' }, { ...no(2, ['dormir']), lugar: 'precario' }, no(3, ['dormir'])]);
    assert.deepEqual([bom.pv, ruim.pv, sem.pv], [8, 2, 4], 'quarto bom ×2, quarto ruim ×0,5, sem quarto o do grupo');
  });

  test('o servidor aplica na ficha, guarda os bônus e gasta', () => {
    const db = seedDb();
    upgradeDb(db);
    const hotel = new Hotel({ db, persist: false, timers: false });
    const gm = new Peer(hotel, true);
    gm.send({ t: 'login', name: 'Mestre', look });
    const agora = new Date().toISOString();
    gm.send({ t: 'fichaSalvar', ficha: { id: 0, nome: 'Teste', ficha: ficha(), criadaEm: agora, atualizadaEm: agora, atual: { pv: 1, pe: 0, san: 3 } } as FichaSalva });
    const id = gm.last('fichas')!.nova!;
    gm.send({ t: 'interludio', lugar: 'normal', escolhas: [{ fichaId: id, acoes: ['dormir', 'exercitar'] }] });
    const f = hotel.db.fichas!.find((x) => x.id === id)!;
    const lim = regras.calcular(f.ficha).limitePe;
    assert.equal(f.atual?.pv, 1 + lim);
    assert.equal(f.atual?.pe, lim);
    assert.equal(f.bonus?.exercicio, 1);
    gm.send({ t: 'bonusInterludio', fichaId: id, tipo: 'exercicio', delta: -1 });
    assert.equal(hotel.db.fichas!.find((x) => x.id === id)!.bonus, undefined);
  });
});
