import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { regras, type ClientMsg, type Documento, type FichaSalva, type ServerMsg, type Session } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

/**
 * A tela do jogador (celular) e as outras duas: o que o jogador muda chega ao mestre e à mesa, e o
 * que o combate desconta chega ao celular. Mais a mochila do jogador e os documentos.
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

/** Combatente de NEX 5%: PV 20+Vig... as contas vêm do motor. */
function fichaNova(nome: string, personagem: number): FichaSalva {
  const f = regras.novaFicha(nome);
  f.atributos = { agi: 2, for: 2, int: 1, pre: 1, vig: 3 };
  f.origem = 'militar';
  f.classe = 'combatente';
  f.pericias.grupos = ['luta', 'fortitude'];
  f.pericias.livres = ['atletismo', 'percepcao'];
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: f, criadaEm: agora, atualizadaEm: agora };
}

let hotel: Hotel;
let gm: Peer;
let mesa: Peer;
let jog: Peer;
let sala: number;

const sessao = (p: Peer): Session => {
  hotel.pushNow();
  return p.last('session')!.session;
};
const ficha = (nome: string) => hotel.db.fichas!.find((f) => f.nome === nome)!;
const vitaisNa = (p: Peer, nome: string) => sessao(p).characters.find((c) => c.name === nome)!.vitals!;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
  for (const nome of ['D.Tepes', 'Catarina Albuquerque']) {
    const charId = sessao(gm).characters.find((c) => c.name === nome)!.look.charId!;
    gm.send({ t: 'fichaSalvar', ficha: fichaNova(nome, charId) });
  }
  mesa = new Peer(hotel);
  mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
  mesa.send({ t: 'join', roomId: sala });
  // o celular da Catarina, pelo link dela
  gm.send({ t: 'fichaLink', id: ficha('Catarina Albuquerque').id });
  jog = new Peer(hotel);
  jog.send({ t: 'login', name: 'Catarina', look, fichaKey: ficha('Catarina Albuquerque').chave! });
});

describe('tela do jogador: as três telas juntas', () => {
  test('o jogador tira PV e gasta PE no celular: a peça (painel do mestre) e a mesa mostram na hora', () => {
    const minha = structuredClone(jog.last('fichas')!.fichas[0]);
    const calc = regras.calcular(minha.ficha);
    minha.atual = { pv: calc.pv - 4, pe: calc.pe - 1, san: calc.san };
    jog.send({ t: 'fichaSalvar', ficha: minha });
    for (const p of [gm, mesa]) {
      const v = vitaisNa(p, 'Catarina Albuquerque');
      assert.equal(v.pv, calc.pv - 4);
      assert.equal(v.pe, calc.pe - 1);
    }
    assert.equal(gm.last('fichas')!.fichas.find((f) => f.nome === 'Catarina Albuquerque')!.atual!.pv, calc.pv - 4, 'a FICHAS do mestre também');
  });

  test('o combate desconta PE (habilidade), PV (dano) e SAN: o celular recebe a ficha nova', () => {
    const cat = sessao(gm).characters.find((c) => c.name === 'Catarina Albuquerque')!.id;
    const tepes = sessao(gm).characters.find((c) => c.name === 'D.Tepes')!.id;
    const calc = regras.calcular(ficha('Catarina Albuquerque').ficha);
    const comb = (a: Extract<ClientMsg, { t: 'combate' }>['a']) => gm.send({ t: 'combate', a });
    comb({ tipo: 'abrir' });
    comb({ tipo: 'participante', id: cat, lado: 'agente', iniciativa: 15 });
    comb({ tipo: 'participante', id: tepes, lado: 'agente', iniciativa: 12 });
    comb({ tipo: 'iniciativaMestre', valor: 5 });
    comb({ tipo: 'comecar' });
    comb({ tipo: 'gastarPe', quem: cat, pe: 1, motivo: 'Ataque Especial' });
    comb({ tipo: 'vitais', id: cat, pv: calc.pv - 6, san: calc.san - 2, motivo: 'golpe e medo' });
    assert.equal(gm.last('denied')?.reason, undefined, 'nada recusado');
    const noCelular = jog.last('fichas')!.fichas[0].atual!;
    assert.equal(noCelular.pe, calc.pe - 1);
    assert.equal(noCelular.pv, calc.pv - 6);
    assert.equal(noCelular.san, calc.san - 2);
    const naMesa = vitaisNa(mesa, 'Catarina Albuquerque');
    assert.deepEqual([naMesa.pv, naMesa.pe, naMesa.san], [calc.pv - 6, calc.pe - 1, calc.san - 2]);
    // sem PE suficiente, recusa (e não desconta)
    comb({ tipo: 'gastarPe', quem: cat, pe: 99, motivo: 'x' });
    assert.ok(gm.last('denied')?.reason);
    assert.equal(ficha('Catarina Albuquerque').atual!.pe, calc.pe - 1);
  });

  test('a mochila: o jogador mexe na dele (empunhar, entregar), não na dos outros, e não larga no chão', () => {
    gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'katana' });
    const katana = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.id === 'katana')!;
    jog.send({ t: 'mochila', fichaId: ficha('Catarina Albuquerque').id, uid: katana.uid!, acao: 'empunhar' });
    assert.equal(regras.lugarDoItem(ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.uid === katana.uid)!), 'mao');
    assert.equal(sessao(mesa).characters.find((c) => c.name === 'Catarina Albuquerque')!.armed, true, 'a peça fica armada');
    gm.send({ t: 'mochilaNova', fichaId: ficha('D.Tepes').id, tipo: 'arma', id: 'faca' });
    const faca = ficha('D.Tepes').ficha.inventario.find((x) => x.id === 'faca')!;
    jog.send({ t: 'mochila', fichaId: ficha('D.Tepes').id, uid: faca.uid!, acao: 'empunhar' });
    assert.equal(regras.lugarDoItem(ficha('D.Tepes').ficha.inventario.find((x) => x.uid === faca.uid)!), 'mochila', 'a do outro não');
    jog.send({ t: 'mochila', fichaId: ficha('Catarina Albuquerque').id, uid: katana.uid!, acao: 'entregar', para: ficha('D.Tepes').id });
    assert.ok(ficha('D.Tepes').ficha.inventario.some((x) => x.uid === katana.uid), 'entregou');
    assert.deepEqual(jog.last('fichas')!.equipe?.map((x) => x.nome), ['D.Tepes']);
  });

  test('largar: o item sai da mochila e vai para o chão, na casa da peça; o mestre e a mesa veem a pilha', () => {
    gm.send({ t: 'mochilaNova', fichaId: ficha('Catarina Albuquerque').id, tipo: 'arma', id: 'faca' });
    const faca = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.id === 'faca')!;
    jog.send({ t: 'mochila', fichaId: ficha('Catarina Albuquerque').id, uid: faca.uid!, acao: 'largar' });
    assert.ok(!ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.uid === faca.uid), 'saiu da mochila');
    const pilha = hotel.rooms.get(sala)!.map.allItems().find((it) => it.loot?.some((l) => l.id === faca.uid));
    assert.ok(pilha, `está no chão (${jog.last('error')?.msg ?? ''})`);
    assert.equal(pilha!.loot!.find((l) => l.id === faca.uid)!.item?.id, 'faca', 'com o item (a arte sai dele)');
  });
});

describe('documentos', () => {
  const doc = (m: Partial<Documento>): Documento => ({ id: 0, titulo: 'Relatório 02', tipo: 'relatorio', grupo: 'documento', paginas: ['Texto.'], para: [], equipe: false, criadoEm: '', atualizadoEm: '', ...m });

  test('o mestre entrega a um agente: só ele vê; marcar é dele; passar para a equipe mostra a todos', () => {
    const cat = ficha('Catarina Albuquerque').id;
    gm.send({ t: 'docSalvar', doc: doc({ para: [cat] }) });
    gm.send({ t: 'docSalvar', doc: doc({ titulo: 'Do Tepes', para: [ficha('D.Tepes').id] }) });
    assert.equal(gm.last('docs')!.docs.length, 2);
    assert.deepEqual(jog.last('docs')!.docs.map((d) => d.titulo), ['Relatório 02']);
    const id = jog.last('docs')!.docs[0].id;
    jog.send({ t: 'docMarcar', id, marcado: true });
    assert.deepEqual(jog.last('docs')!.docs[0].marcadoPor, [cat]);
    // o jogador não cria nem apaga, e não mexe no documento que não é dele
    jog.send({ t: 'docSalvar', doc: doc({ titulo: 'Falso', para: [cat] }) });
    jog.send({ t: 'docApagar', id });
    assert.equal(hotel.db.documentos!.length, 2);
    const doTepes = hotel.db.documentos!.find((d) => d.titulo === 'Do Tepes')!.id;
    jog.send({ t: 'docEquipe', id: doTepes });
    assert.equal(hotel.db.documentos!.find((d) => d.id === doTepes)!.equipe, false);
    // passa para a equipe: o do Tepes continua só dele; o dela fica com todos
    jog.send({ t: 'docEquipe', id });
    assert.equal(hotel.db.documentos!.find((d) => d.id === id)!.equipe, true);
    // o mestre muda o texto: a marca do jogador fica
    gm.send({ t: 'docSalvar', doc: { ...hotel.db.documentos!.find((d) => d.id === id)!, paginas: ['Outro texto.'] } });
    assert.deepEqual(jog.last('docs')!.docs[0].paginas, ['Outro texto.']);
    assert.deepEqual(jog.last('docs')!.docs[0].marcadoPor, [cat]);
  });

  test('o jogador não passa por cima do livro: atributo além dos pontos é recusado', () => {
    const minha = structuredClone(jog.last('fichas')!.fichas[0]);
    minha.ficha.atributos.for += 2;
    jog.send({ t: 'fichaSalvar', ficha: minha });
    assert.match(jog.last('error')!.msg, /Atributos/);
    assert.equal(ficha('Catarina Albuquerque').ficha.atributos.for, 2, 'não mudou');
    // o mestre passa
    const doMestre = structuredClone(hotel.db.fichas!.find((f) => f.nome === 'Catarina Albuquerque')!);
    doMestre.ficha.atributos.for = 3;
    doMestre.ficha.atributos.vig = 2;
    gm.send({ t: 'fichaSalvar', ficha: doMestre });
    assert.equal(ficha('Catarina Albuquerque').ficha.atributos.for, 3);
  });

  test('notas e favoritos ficam na ficha; o que é estranho não entra', () => {
    const minha = structuredClone(jog.last('fichas')!.fichas[0]);
    minha.diario = [{ id: 'n1', titulo: 'Porta trancada', texto: 'Corredor norte.', fixada: true, em: new Date().toISOString() }, { id: '', titulo: 'sem id', texto: '', em: '' }];
    minha.favoritos = ['amaldicoar_arma', 'amaldicoar_arma'];
    jog.send({ t: 'fichaSalvar', ficha: minha });
    const salva = ficha('Catarina Albuquerque');
    assert.deepEqual(salva.diario?.map((n) => n.titulo), ['Porta trancada']);
    assert.deepEqual(salva.favoritos, ['amaldicoar_arma']);
  });
});

describe('1 vez por dia (19/10)', () => {
  test('o mestre marca o limite, o jogador gasta (sem mexer no limite) e passar o dia devolve', () => {
    const chave = regras.chaveDia.poder('ataque-especial');
    // o mestre: Ataque Especial vale 1 vez por dia
    const doMestre = structuredClone(ficha('Catarina Albuquerque'));
    regras.definirLimiteDia(doMestre.ficha, chave, 1);
    gm.send({ t: 'fichaSalvar', ficha: doMestre });
    assert.equal(regras.limiteDia(ficha('Catarina Albuquerque').ficha, chave), 1);
    // o jogador gasta e tenta subir o limite: o uso fica, o limite não
    const minha = structuredClone(jog.last('fichas')!.fichas[0]);
    regras.marcarUsosDia(minha.ficha, chave, 1);
    minha.ficha.limitesDia = { [chave]: 5 };
    jog.send({ t: 'fichaSalvar', ficha: minha });
    assert.equal(regras.limiteDia(ficha('Catarina Albuquerque').ficha, chave), 1, 'o limite é do mestre');
    assert.equal(regras.usosDia(ficha('Catarina Albuquerque').ficha, chave), 1, 'o uso de hoje ficou');
    // passa o dia: o uso volta, o limite fica
    gm.send({ t: 'diaPassar' });
    assert.equal(regras.usosDia(ficha('Catarina Albuquerque').ficha, chave), 0);
    assert.equal(regras.limiteDia(ficha('Catarina Albuquerque').ficha, chave), 1);
    assert.equal(jog.last('fichas')!.fichas[0].ficha.usosDia, undefined, 'o celular recebe o dia novo');
  });

  test('o uso nunca passa do limite, e o item que sai da mochila leva o limite junto', () => {
    const f = regras.novaFicha('X');
    const k = regras.chaveDia.ritual('decadencia');
    regras.marcarUsosDia(f, k, 3);
    assert.equal(regras.usosDia(f, k), 0, 'sem limite não marca');
    regras.definirLimiteDia(f, k, 2);
    regras.marcarUsosDia(f, k, 7);
    assert.equal(regras.usosDia(f, k), 2);
    regras.definirLimiteDia(f, k, 1);
    assert.equal(regras.usosDia(f, k), 1, 'baixar o limite corta o uso');
    const ki = regras.chaveDia.item(99);
    regras.definirLimiteDia(f, ki, 1);
    regras.limparPorDia(f);
    assert.equal(regras.limiteDia(f, ki), 0, 'item 99 não está na mochila');
    assert.equal(regras.limiteDia(f, k), 1);
  });
});
