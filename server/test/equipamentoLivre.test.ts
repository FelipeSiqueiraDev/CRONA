import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { regras, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { ajustesFichas0311 } from '../src/ajustesFichas0311';
import { seedDb, upgradeDb } from '../src/seed';

/**
 * 03/11, o Felipe: uma janela única para refazer a mochila (`equipamentoLivre`), dentro do livro. Aberta, o jogador pede
 * itens e mexe nas modificações em qualquer lugar; ao confirmar, fecha para sempre e vale a regra de sempre: só na base.
 * Mais a migração das decisões de 03/11 e a munição de calibre grosso (LR p. 60).
 */

type Msg<T extends ServerMsg['t']> = Extract<ServerMsg, { t: T }>;

class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(private hotel: Hotel) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, false);
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
const copia = <T>(x: T): T => structuredClone(x);

function fichaNova(nome: string, personagem: number): FichaSalva {
  const f = regras.novaFicha(nome);
  f.atributos = { agi: 2, for: 2, int: 1, pre: 1, vig: 3 };
  f.origem = 'militar';
  f.classe = 'combatente';
  f.pericias.grupos = ['luta', 'fortitude'];
  f.pericias.livres = ['atletismo', 'percepcao'];
  f.pp = 20; // Operador: 3 de categoria I, 1 de categoria II
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: f, criadaEm: agora, atualizadaEm: agora };
}

let hotel: Hotel;
let gm: Peer;
let jog: Peer;
const ficha = (nome: string) => hotel.db.fichas!.find((f) => f.nome === nome)!;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  const sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id; // fora da base
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
  hotel.pushNow();
  const charId = gm.last('session')!.session.characters.find((c) => c.name === 'Catarina Albuquerque')!.look.charId!;
  gm.send({ t: 'fichaSalvar', ficha: fichaNova('Catarina Albuquerque', charId) });
  gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'faca' });
  gm.send({ t: 'fichaLink', id: ficha('Catarina Albuquerque').id });
  jog = new Peer(hotel);
  jog.send({ t: 'login', name: 'Catarina', look, fichaKey: ficha('Catarina Albuquerque').chave! });
});

const minha = () => copia(jog.last('fichas')!.fichas[0]);

function abrirJanela() {
  const base = ficha('Catarina Albuquerque');
  gm.send({ t: 'fichaSalvar', ficha: { ...copia(base), ficha: { ...copia(base.ficha), equipamentoLivre: 'aberto' } } });
}

describe('a janela única de refazer a mochila', () => {
  test('fora da base e sem a janela: nem item novo nem modificação', () => {
    const f = minha();
    f.ficha.inventario.push({ tipo: 'equipamento', id: 'isqueiro' });
    jog.send({ t: 'fichaSalvar', ficha: f });
    assert.match(jog.last('error')?.msg ?? '', /só se pedem na base/);
    const uid = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.id === 'faca')!.uid!;
    jog.send({ t: 'mochilaMelhorias', fichaId: ficha('Catarina Albuquerque').id, uid, poe: [{ tipo: 'modificacao', id: 'certeira' }], tira: [] });
    assert.match(jog.last('error')?.msg ?? '', /só na base/);
    assert.equal(ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.uid === uid)?.modificacoes, undefined);
  });

  test('o jogador não abre a janela sozinho', () => {
    const f = minha();
    f.ficha.equipamentoLivre = 'aberto';
    jog.send({ t: 'fichaSalvar', ficha: f });
    assert.equal(ficha('Catarina Albuquerque').ficha.equipamentoLivre, undefined);
  });

  test('aberta: pede item e modifica fora da base, mas nunca passa do limite do livro', () => {
    abrirJanela();
    assert.equal(ficha('Catarina Albuquerque').ficha.equipamentoLivre, 'aberto');
    const f = minha();
    f.ficha.inventario.push({ tipo: 'equipamento', id: 'isqueiro' });
    jog.send({ t: 'fichaSalvar', ficha: f, base: minha() });
    assert.ok(ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.id === 'isqueiro'), jog.last('error')?.msg ?? '');
    const uid = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.id === 'faca')!.uid!;
    jog.send({ t: 'mochilaMelhorias', fichaId: ficha('Catarina Albuquerque').id, uid, poe: [{ tipo: 'modificacao', id: 'certeira' }], tira: [] });
    assert.deepEqual(ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.uid === uid)?.modificacoes, ['certeira'], jog.last('error')?.msg ?? '');
    // o limite da patente continua valendo na janela aberta: itens de categoria I demais num Operador (3) são recusados
    for (let k = 0; k < 4; k++) {
      const g = minha();
      g.ficha.inventario.push({ tipo: 'arma', id: 'pistola' });
      jog.send({ t: 'fichaSalvar', ficha: g, base: minha() });
    }
    assert.match(jog.last('error')?.msg ?? '', /Limite da patente/);
  });

  test('confirmar fecha para sempre: depois, só na base, e não reabre', () => {
    abrirJanela();
    const f = minha();
    f.ficha.equipamentoLivre = 'confirmado';
    jog.send({ t: 'fichaSalvar', ficha: f, base: minha() });
    assert.equal(ficha('Catarina Albuquerque').ficha.equipamentoLivre, 'confirmado');
    const g = minha();
    g.ficha.equipamentoLivre = 'aberto';
    g.ficha.inventario.push({ tipo: 'equipamento', id: 'isqueiro' });
    jog.send({ t: 'fichaSalvar', ficha: g });
    assert.match(jog.last('error')?.msg ?? '', /só se pedem na base/);
    assert.equal(ficha('Catarina Albuquerque').ficha.equipamentoLivre, 'confirmado');
    const uid = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.id === 'faca')!.uid!;
    jog.send({ t: 'mochilaMelhorias', fichaId: ficha('Catarina Albuquerque').id, uid, poe: [{ tipo: 'modificacao', id: 'certeira' }], tira: [] });
    assert.match(jog.last('error')?.msg ?? '', /só na base/);
  });
});

describe('as decisões de 03/11 (migração única)', () => {
  const gerar = (id: number, nome: string, npc?: string): FichaSalva => {
    const f = fichaNova(nome, 0);
    f.id = id;
    if (npc) f.npc = npc;
    f.ficha.inventario = [{ uid: id * 10, tipo: 'arma', id: 'faca' }];
    f.ficha.refazerEquipamento = true;
    f.atual = { pv: 1, pe: 1, san: 1 };
    return f;
  };
  const reiniciar = (db: ReturnType<typeof seedDb>) => delete (db as { ajustesFichas0311?: boolean }).ajustesFichas0311;

  test('Ômega e ??? ficam sem mochila; os quatro sobem ao máximo e ganham a janela; roda uma vez', () => {
    const db = seedDb();
    upgradeDb(db);
    db.fichas = [gerar(901, 'D.Tepes'), gerar(902, 'Catarina Albuquerque'), gerar(903, 'Alosi Walker'), gerar(904, 'Cora Falcão'), gerar(905, 'Ômega-99', 'omega-99'), gerar(906, '???', 'interrogacao'), gerar(907, 'Rosa', 'npc-cabelo-rosa')];
    reiniciar(db);
    assert.equal(ajustesFichas0311(db), true);
    for (const id of [905, 906]) assert.deepEqual(db.fichas.find((f) => f.id === id)!.ficha.inventario, []);
    assert.equal(db.fichas.find((f) => f.id === 907)!.ficha.inventario.length, 1, 'outros NPCs ficam como estavam');
    for (const id of [901, 902, 903, 904]) {
      const f: FichaSalva = db.fichas.find((x) => x.id === id)!;
      const c = regras.calcular(f.ficha);
      assert.deepEqual(f.atual, { pv: c.pv, pe: c.pe, san: c.san });
      assert.equal(f.ficha.equipamentoLivre, 'aberto');
      assert.equal(f.ficha.refazerEquipamento, undefined);
      assert.equal(f.ficha.inventario.length, 1, 'a mochila de agora é o ponto de partida');
    }
    assert.equal(ajustesFichas0311(db), false, 'só uma vez');
  });

  test('a arma de Calibre Grosso passa a usar o pacote de calibre grosso, sem perder a quantidade', () => {
    const db = seedDb();
    upgradeDb(db);
    const f = gerar(904, 'Cora Falcão');
    f.ficha.inventario = [
      { uid: 1, tipo: 'arma', id: 'fuzil-de-caca', modificacoes: ['calibre-grosso'] },
      { uid: 2, tipo: 'equipamento', id: 'balas-longas', nome: 'Balas longas', qtd: 3 },
      { uid: 3, tipo: 'equipamento', id: 'balas-curtas', nome: 'Balas curtas', qtd: 1 },
    ];
    db.fichas = [f];
    reiniciar(db);
    ajustesFichas0311(db);
    const inv = db.fichas[0].ficha.inventario;
    assert.equal(inv[1].id, 'balas-longas-calibre-grosso');
    assert.equal(inv[1].nome, 'Balas longas de calibre grosso');
    assert.equal(inv[1].qtd, 3);
    assert.equal(inv[2].id, 'balas-curtas', 'a de outro tipo não muda');
  });
});

describe('munição de calibre grosso (LR p. 60) e o Medidor', () => {
  const cat = regras.catalogo;

  test('a munição de calibre grosso tem a categoria e o espaço da normal, uma por munição das armas de fogo', () => {
    for (const id of ['balas-curtas', 'balas-longas', 'cartuchos', 'combustivel', 'foguete']) {
      const n = cat.equipamento(id)!;
      const g = cat.equipamento(`${id}-calibre-grosso`)!;
      assert.ok(g, id);
      assert.equal(g.categoria, n.categoria);
      assert.equal(g.espacos, n.espacos);
      assert.equal(g.grupo, 'municao');
      assert.equal(g.nome, `${n.nome} de calibre grosso`);
    }
    assert.equal(cat.equipamento('flechas-calibre-grosso'), undefined, 'flecha é de arma de disparo, que não leva a modificação');
  });

  test('a arma de Calibre Grosso só conta a munição de calibre grosso, e a normal não serve nela', () => {
    const f = regras.novaFicha('Cora');
    f.classe = 'combatente';
    f.nex = 25;
    f.pp = 20;
    f.inventario = [
      { uid: 1, tipo: 'arma', id: 'fuzil-de-caca', modificacoes: ['calibre-grosso'] },
      { uid: 2, tipo: 'equipamento', id: 'balas-longas', qtd: 3 },
    ];
    const ataque = () => regras.calcular(f).ataques.find((a) => a.item === 'fuzil-de-caca')!;
    assert.equal(ataque().municao?.id, 'balas-longas-calibre-grosso');
    assert.equal(ataque().municao?.tem, false, 'a normal não serve em arma de calibre grosso');
    f.inventario[1] = { uid: 2, tipo: 'equipamento', id: 'balas-longas-calibre-grosso', qtd: 3 };
    assert.equal(ataque().municao?.tem, true);
    f.inventario[0] = { uid: 1, tipo: 'arma', id: 'fuzil-de-caca' };
    assert.equal(ataque().municao?.id, 'balas-longas');
    assert.equal(ataque().municao?.tem, false, 'e a de calibre grosso não serve em arma comum');
  });

  test('as modificações de munição valem nas balas de calibre grosso, e o Calibre Grosso avisa da munição', () => {
    const f = regras.novaFicha('Cora');
    f.classe = 'combatente';
    f.nex = 25;
    f.pp = 20;
    f.inventario = [
      { uid: 1, tipo: 'arma', id: 'fuzil-de-caca' },
      { uid: 2, tipo: 'equipamento', id: 'balas-longas-calibre-grosso', qtd: 1 },
    ];
    const dd = regras.opcoesDeMelhoria(f, 1).find((o) => o.id === 'dum-dum')!;
    assert.equal(dd.motivos.length, 0, 'dum dum em balas longas de calibre grosso');
    const cg = regras.opcoesDeMelhoria(f, 0).find((o) => o.id === 'calibre-grosso')!;
    assert.ok(cg.avisos.some((a) => /calibre grosso/.test(a) && /a mochila tem/.test(a)), cg.avisos.join(' | '));
  });

  test('o Medidor de estabilidade da membrana é categoria II', () => {
    assert.equal(cat.equipamento('medidor-de-estabilidade-da-membrana')!.categoria, 2);
  });
});

describe('por que cada pendência existe (explicarPendencia)', () => {
  test('o poder de combatente cita a tabela de NEX; a alteração do Monstruoso cita o SaH p. 99', () => {
    const f = regras.novaFicha('Tepes');
    f.classe = 'combatente';
    const poder = regras.explicarPendencia(f, { nex: 30, tipo: 'poder', texto: 'NEX 30%: escolha um poder de combatente.' });
    assert.match(poder.porque, /combatente ganha um poder de classe nos NEX 15%, 30%, 45%, 60%, 75% e 90%/);
    assert.deepEqual(poder.ref, { fonte: 'LR', pagina: 23 });
    f.trilha = 'monstruoso';
    f.nex = 25;
    const alt = regras.explicarPendencia(f, { nex: 25, tipo: 'parametro', texto: 'Alteração de NEX 25%: escolha 1 perícia.', alvo: 'alteracao-nex-25' });
    assert.match(alt.porque, /Monstruoso/);
    assert.match(alt.porque, /Diplomacia, Enganação ou Intimidação/);
    assert.deepEqual(alt.ref, { fonte: 'SaH', pagina: 99 });
  });

  test('todo tipo de pendência tem uma explicação', () => {
    const f = regras.novaFicha('X');
    f.classe = 'ocultista';
    const tipos: regras.TipoPendencia[] = ['atributos', 'origem', 'classe', 'pericias', 'trilha', 'poder', 'paranormal', 'atributo', 'periciaIntelecto', 'grau', 'versatilidade', 'afinidade', 'ritual', 'parametro'];
    for (const tipo of tipos) assert.ok(regras.explicarPendencia(f, { nex: 50, tipo, texto: 'x' }).porque.length > 20, tipo);
  });
});
