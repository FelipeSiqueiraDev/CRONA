import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { bar, regras, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';
import type { RoomInstance } from '../src/roomInstance';

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
  all<T extends ServerMsg['t']>(t: T): Msg<T>[] {
    return this.inbox.filter((m) => m.t === t) as Msg<T>[];
  }
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    return this.all(t).at(-1);
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

function fichaNova(nome: string, personagem: number): FichaSalva {
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: regras.novaFicha(nome), criadaEm: agora, atualizadaEm: agora };
}

let hotel: Hotel;
let gm: Peer;
let salao: RoomInstance;

/** A peça do bar com esse nome (o id é o que o mestre manda nos comandos). */
const peca = (nome: string) => [...salao['users'].values()].find((u) => u.client.name === nome)!;
const movel = (defId: string) => salao.map.allItems().find((i) => i.defId === defId) ?? salao.map.allWallItems().find((i) => i.defId === defId)!;
const andar = () => {
  for (let i = 0; i < 60; i++) salao.step();
};
/** O mestre manda jogar, e a peça anda até o jogo (o jogo só abre quando ela chega). */
const jogar = (nome: string, defId: string) => {
  gm.send({ t: 'barJogar', tokenId: peca(nome).client.id, itemId: movel(defId).id });
  andar();
};

/** O celular do jogador, entrando pelo link da ficha. */
function celular(nome: string): Peer {
  const f = hotel.db.fichas!.find((x) => x.nome === nome)!;
  const p = new Peer(hotel);
  p.send({ t: 'login', name: `Agente ${f.id}`, look, fichaKey: f.chave! });
  return p;
}

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  const id = hotel.db.rooms.find((x) => x.name === 'Sede · Bar')!.id;
  salao = hotel.rooms.get(id)!;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: id });
  // Tepes e Catarina com ficha (jogadores); Alosi e Cora sem ficha (NPCs, o mestre joga por eles)
  for (const nome of ['D.Tepes', 'Catarina Albuquerque']) {
    gm.send({ t: 'fichaSalvar', ficha: fichaNova(nome, peca(nome).client.look.charId!) });
    gm.send({ t: 'fichaLink', id: hotel.db.fichas!.find((x) => x.nome === nome)!.id });
  }
});

describe('os jogos do bar: as mesas', () => {
  test('o 21: o jogador senta na cadeira da mesa; ao começar, o dealer levanta e fica em pé atrás do lado reto', () => {
    // a mesa de 21 num canto livre do bar, com uma cadeira na curva (embaixo) e outra na ponta
    let lugar: { x: number; y: number } | null = null;
    for (let y = 1; y < salao.map.height - 4 && !lugar; y++)
      for (let x = 1; x < salao.map.width - 4 && !lugar; x++) {
        const ok = salao.map.canPlace('mesa_21', x, y, 4).ok && salao.map.canPlace('cadeira_jantar_luxo', x + 1, y + 2, 0).ok && salao.map.canPlace('cadeira_jantar_luxo', x + 3, y + 1, 6).ok;
        // e o chão em volta todo livre (para o dealer dar a volta até trás da mesa)
        let volta = true;
        for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 4; dx++) if (salao.map.walkState(x + dx, y + dy) !== 'walk') volta = false;
        if (ok && volta) lugar = { x, y };
      }
    assert.ok(lugar, 'tem um canto livre');
    const { x, y } = lugar!;
    const add = (defId: string, cx: number, cy: number, rot: number) => salao.map.addItem({ id: hotel.nextItemId(), defId, x: cx, y: cy, z: salao.map.canPlace(defId, cx, cy, rot).z, rot, state: 0 });
    add('mesa_21', x, y, 4);
    add('cadeira_jantar_luxo', x + 1, y + 2, 0);
    add('cadeira_jantar_luxo', x + 3, y + 1, 6);
    const a = celular('D.Tepes');
    const b = celular('Catarina Albuquerque');
    jogar('D.Tepes', 'mesa_21');
    andar();
    jogar('Catarina Albuquerque', 'mesa_21');
    andar();
    const [t, c] = [peca('D.Tepes'), peca('Catarina Albuquerque')];
    const cadeiras = [`${x + 1},${y + 2}`, `${x + 3},${y + 1}`];
    assert.ok(cadeiras.includes(`${t.x},${t.y}`) && cadeiras.includes(`${c.x},${c.y}`), 'os dois sentados nas cadeiras');
    assert.equal(t.sit, 1);
    assert.deepEqual(b.last('bar')!.eu, [1]);
    // a Catarina quer ser o dealer; o Tepes começa
    const mesa = a.last('bar')!.mesa;
    b.send({ t: 'barJogo', mesa, dados: { tipo: 'quero', dealer: true }, registrar: true });
    a.send({ t: 'barJogo', mesa, dados: { tipo: 'comecar', fichas: 100, semente: 3 }, registrar: true });
    andar();
    assert.deepEqual([c.x, c.y], [x + 1, y - 1], 'a Catarina em pé atrás da mesa');
    assert.equal(c.sit, 0);
    assert.equal(a.last('barJogo')!.dados.tipo, 'quero', 'o começar não volta para quem mandou');
    assert.equal(b.last('barJogo')!.dados.tipo, 'comecar');
    // quem reconecta recebe a mesa inteira: o "quero" e o começar
    assert.deepEqual(celular('Catarina Albuquerque').last('bar')!.log.map((x) => (x.dados as { tipo: string }).tipo), ['quero', 'comecar']);
  });

  test('o fliperama: a peça vai até a frente, vira para a tela, o fliperama acende e o jogo abre no celular', () => {
    const fone = celular('D.Tepes');
    const arc = salao.map.allItems().find((i) => i.defId === 'arcade')!;
    salao.map.updateItem({ ...arc, state: 1 });
    jogar('D.Tepes', 'arcade');
    const m = fone.last('bar')!;
    assert.deepEqual({ tipo: m.tipo, jogadores: m.jogadores, npc: m.npc, eu: m.eu }, { tipo: 'fliperama', jogadores: ['D.Tepes'], npc: [false], eu: [0] });
    assert.equal(salao.map.getItem(arc.id)!.state, 0, 'aceso');
    andar();
    const tepes = peca('D.Tepes');
    assert.deepEqual([tepes.x, tepes.y], [arc.x + 1, arc.y]);
    assert.equal(tepes.dir, 6, 'olhando para o fliperama');
    assert.match(gm.last('notice')!.msg, /abriu no celular/);
  });

  test('a dupla: o segundo entra na mesma máquina, fica do lado, e as jogadas vão de um celular para o outro', () => {
    const a = celular('D.Tepes');
    const b = celular('Catarina Albuquerque');
    jogar('D.Tepes', 'arcade');
    andar();
    jogar('Catarina Albuquerque', 'arcade');
    andar();
    assert.deepEqual(a.last('bar')!.jogadores, ['D.Tepes', 'Catarina Albuquerque']);
    assert.deepEqual(b.last('bar')!.eu, [1]);
    const [t, c] = [peca('D.Tepes'), peca('Catarina Albuquerque')];
    assert.notDeepEqual([t.x, t.y], [c.x, c.y], 'lado a lado, não em cima');
    a.send({ t: 'barJogo', mesa: a.last('bar')!.mesa, dados: { tipo: 'convite', jogo: 0 } });
    assert.deepEqual(b.last('barJogo'), { t: 'barJogo', mesa: a.last('bar')!.mesa, de: 0, dados: { tipo: 'convite', jogo: 0 } });
    assert.equal(a.last('barJogo'), undefined, 'quem mandou não recebe de volta');
  });

  test('a peça sem ficha é um NPC: o mestre recebe a mesa com o lugar dele e joga por ele', () => {
    const fone = celular('D.Tepes');
    jogar('D.Tepes', 'dartboard');
    jogar('Alosi Walker', 'dartboard');
    assert.match(gm.last('notice')!.msg, /NPC/);
    const m = gm.last('bar')!;
    assert.deepEqual({ tipo: m.tipo, npc: m.npc, eu: m.eu }, { tipo: 'dardos', npc: [false, true], eu: [1] });
    gm.send({ t: 'barJogo', mesa: m.mesa, de: 1, dados: { tipo: 'dardo', x: 0, y: 0 }, registrar: true });
    assert.equal(fone.last('barJogo')!.de, 1);
    // o mestre não joga pelo lugar do jogador
    gm.send({ t: 'barJogo', mesa: m.mesa, de: 0, dados: { tipo: 'trapaca' } });
    assert.notEqual(fone.last('barJogo')!.dados.tipo, 'trapaca');
  });

  test('as jogadas guardadas: quem reconecta recebe a partida desde o começo', () => {
    const a = celular('D.Tepes');
    jogar('D.Tepes', 'pool_table');
    jogar('Catarina Albuquerque', 'pool_table');
    const mesa = a.last('bar')!.mesa;
    a.send({ t: 'barJogo', mesa, dados: { tipo: 'comecar', semente: 7 }, registrar: true });
    a.send({ t: 'barJogo', mesa, dados: { tipo: 'tacada', vx: 0, vy: -200 }, registrar: true });
    a.send({ t: 'barJogo', mesa, dados: { tipo: 'mira', x: 1 } });
    const b = celular('Catarina Albuquerque');
    assert.deepEqual(b.last('bar')!.log, [
      { de: 0, dados: { tipo: 'comecar', semente: 7 } },
      { de: 0, dados: { tipo: 'tacada', vx: 0, vy: -200 } },
    ]);
  });

  test('usar de novo chama de volta; Sair avisa o mestre com o recorde; mesa cheia recusa', () => {
    const a = celular('D.Tepes');
    const b = celular('Catarina Albuquerque');
    jogar('D.Tepes', 'arcade');
    jogar('D.Tepes', 'arcade');
    assert.deepEqual(a.last('barFechar'), { t: 'barFechar', mesa: movel('arcade').id, aviso: 'O mestre chamou de volta para a mesa.' });
    jogar('D.Tepes', 'arcade');
    jogar('Catarina Albuquerque', 'arcade');
    jogar('Cora Falcão', 'arcade');
    assert.match(gm.last('error')!.msg, /Já tem 2/);
    b.send({ t: 'barSair', mesa: movel('arcade').id, recorde: { jogo: 'PULA-PULA', pontos: 71 } });
    assert.equal(gm.last('notice')!.msg, 'Catarina Albuquerque largou o Feliperama (71 pontos no PULA-PULA).');
    assert.deepEqual(a.last('bar')!.jogadores, ['D.Tepes']);
  });

  test('a peça joga uma coisa por vez; só o mestre manda jogar; objeto que não é jogo recusa', () => {
    const a = celular('D.Tepes');
    jogar('D.Tepes', 'arcade');
    jogar('D.Tepes', 'pool_table');
    assert.equal(a.last('barFechar')!.mesa, movel('arcade').id);
    assert.equal(a.last('bar')!.tipo, 'sinuca');
    a.send({ t: 'barJogar', tokenId: peca('D.Tepes').client.id, itemId: movel('arcade').id });
    assert.match(a.last('error')!.msg, /Só o mestre/);
    gm.send({ t: 'barJogar', tokenId: peca('D.Tepes').client.id, itemId: salao.map.allItems().find((i) => !bar.jogoDoBar(i.defId))!.id });
    assert.match(gm.last('error')!.msg, /não é um jogo do bar/);
  });
});

describe('os dardos', () => {
  test('o alvo: centro, mosca, setores, triplo e duplo', () => {
    assert.equal(bar.dardos.pontuar(0, 0).valor, 50);
    assert.equal(bar.dardos.pontuar(0.06, 0).valor, 25);
    assert.equal(bar.dardos.pontuar(0, -0.4).valor, 20, 'em cima é o 20');
    assert.equal(bar.dardos.pontuar(0, -0.6).rotulo, 'T20');
    assert.equal(bar.dardos.pontuar(0.4, 0).valor, 6, 'à direita é o 6');
    assert.equal(bar.dardos.pontuar(0, 0.97).rotulo, 'D3', 'embaixo é o 3');
    assert.equal(bar.dardos.pontuar(0, 1.2).valor, 0);
  });

  test('o 301: três dardos por vez, estouro e quem zera vence', () => {
    const l = (valor: number) => ({ x: 0, y: 0, valor, mult: 1, rotulo: String(valor) });
    let p = bar.dardos.nova(2, 101);
    for (const v of [60, 20, 1]) p = bar.dardos.lancar(p, l(v));
    assert.deepEqual([p.restam, p.vez], [[20, 101], 1]);
    for (const v of [5, 5, 5]) p = bar.dardos.lancar(p, l(v));
    p = bar.dardos.lancar(p, l(25));
    assert.deepEqual([p.restam[0], p.vez, p.historico.at(-1)!.estourou], [20, 1, true], 'passou do zero: estourou');
    for (const v of [1, 1, 1]) p = bar.dardos.lancar(p, l(v));
    p = bar.dardos.lancar(p, l(20));
    assert.equal(p.vencedor, 0);
  });
});

describe('a sinuca', () => {
  test('o triângulo: 15 bolas, a 8 no meio, nenhuma encostando na outra', () => {
    const bs = bar.sinuca.arrumar(42);
    assert.equal(bs.length, 16);
    assert.deepEqual(new Set(bs.map((b) => b.n)).size, 16);
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) assert.ok(Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y) >= 2 * bar.sinuca.RAIO, 'sem sobrepor');
  });

  test('a tacada dá o mesmo resultado sempre (todo celular vê a mesma mesa) e as bolas param', () => {
    const fim = () => bar.sinuca.ateParar(bar.sinuca.tacar(bar.sinuca.arrumar(9), 3.7, -330)).bolas.map((b) => [b.x, b.y, b.fora]);
    assert.deepEqual(fim(), fim());
    const m = bar.sinuca.ateParar(bar.sinuca.tacar(bar.sinuca.arrumar(9), 3.7, -330));
    assert.ok(m.t < 40, 'parou');
    assert.notEqual(m.primeiroToque, null, 'a branca bateu no triângulo');
  });

  test('a branca reta na caçapa: falta, volta para a cabeça e passa a vez', () => {
    const e = bar.sinuca.novo(2, 1);
    // só a branca, perto da caçapa do canto de baixo à esquerda
    e.bolas = e.bolas.map((b) => (b.n === 0 ? { ...b, x: 12, y: 188 } : b));
    const m = bar.sinuca.ateParar(bar.sinuca.tacar(e.bolas, -100, 100));
    assert.ok(m.encacapadas.includes(0));
    const q = bar.sinuca.resolver(e, m);
    assert.equal(q.vez, 1);
    assert.match(q.aviso, /FALTA/);
    assert.equal(q.bolas.find((b) => b.n === 0)!.fora, false, 'a branca voltou');
  });
});
