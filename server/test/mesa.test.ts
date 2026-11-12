import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { casaVista, regras, sanitizeMarca, tamanhoDoMapa, type ClientMsg, type FichaSalva, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';
import { SEDE } from '../src/seedSede';

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
  all<T extends ServerMsg['t']>(t: T): Msg<T>[] {
    return this.inbox.filter((m) => m.t === t) as Msg<T>[];
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

function fichaDe(nome: string, personagem: number): FichaSalva {
  const f = regras.novaFicha(nome);
  const agora = new Date().toISOString();
  return { id: 0, nome, personagem, ficha: f, criadaEm: agora, atualizadaEm: agora };
}

let hotel: Hotel;
let gm: Peer;
let mesa: Peer;
const bar = () => [...hotel.rooms.values()].find((r) => r.data.name === SEDE + 'Bar')!;
const steps = (n: number) => {
  for (let i = 0; i < n; i++) for (const r of hotel.rooms.values()) r.step();
};

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  gm = new Peer(hotel, true);
  gm.send({ t: 'login', name: 'Mestre', look });
  gm.send({ t: 'join', roomId: bar().data.id });
  mesa = new Peer(hotel);
  mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
  mesa.send({ t: 'join', roomId: bar().data.id });
});

describe('ponto de atenção e desenho rápido', () => {
  test('o mestre marca e a mesa recebe; a mesa não marca', () => {
    gm.send({ t: 'marca', marca: { tipo: 'ponto', x: 3.5, y: 4.5 } });
    assert.deepEqual(mesa.last('marca')?.marca, { tipo: 'ponto', x: 3.5, y: 4.5 });
    gm.send({ t: 'marca', marca: { tipo: 'traco', forma: 'seta', cor: 'sangue', pts: [[1, 1], [4, 2]] } });
    assert.equal(mesa.last('marca')?.marca.tipo, 'traco');
    const antes = gm.all('marca').length;
    mesa.send({ t: 'marca', marca: { tipo: 'ponto', x: 1, y: 1 } });
    assert.equal(gm.all('marca').length, antes);
    assert.match(mesa.last('error')?.msg ?? '', /mestre/);
  });

  test('a marca é conferida: fora da planta é presa na borda, e forma errada não passa', () => {
    assert.deepEqual(sanitizeMarca({ tipo: 'ponto', x: -5, y: 999 }, 10, 8), { tipo: 'ponto', x: 0, y: 8 });
    assert.equal(sanitizeMarca({ tipo: 'traco', forma: 'seta', cor: 'giz', pts: [[1, 1]] }, 10, 8), null);
    assert.equal(sanitizeMarca({ tipo: 'traco', forma: 'estrela', cor: 'giz', pts: [[1, 1], [2, 2]] }, 10, 8), null);
    assert.equal(sanitizeMarca({ tipo: 'traco', forma: 'livre', cor: 'giz', pts: [[1, 1], ['a', 2]] }, 10, 8), null);
    assert.deepEqual(sanitizeMarca({ tipo: 'apagar' }, 10, 8), { tipo: 'apagar' });
  });
});

describe('névoa revelada aos poucos', () => {
  test('ligar cobre a cena; o pincel, mostrar tudo e esconder tudo; desligar tira', () => {
    const r = bar();
    const { width: w, height: h } = r.map;
    gm.send({ t: 'nevoa', acao: 'ligar' });
    let n = mesa.last('roomUpdate')!.room.nevoa!;
    assert.ok(n, 'a mesa recebe a névoa');
    assert.equal(n.vista, '0'.repeat(w * h));
    gm.send({ t: 'nevoa', acao: 'pintar', casas: [[2, 3], [4, 5]], vista: true });
    n = mesa.last('roomUpdate')!.room.nevoa!;
    assert.ok(casaVista(n, 2, 3) && casaVista(n, 4, 5));
    assert.ok(!casaVista(n, 3, 3));
    gm.send({ t: 'nevoa', acao: 'tudo' });
    assert.equal(mesa.last('roomUpdate')!.room.nevoa!.vista, '1'.repeat(w * h));
    gm.send({ t: 'nevoa', acao: 'nada' });
    assert.equal(mesa.last('roomUpdate')!.room.nevoa!.vista, '0'.repeat(w * h));
    // fica guardada na cena
    assert.equal(r.data.nevoa?.vista, '0'.repeat(w * h));
    gm.send({ t: 'nevoa', acao: 'desligar' });
    assert.equal(mesa.last('roomUpdate')!.room.nevoa, undefined);
    assert.equal(r.data.nevoa, undefined);
  });

  test('a mesa não mexe na névoa', () => {
    gm.send({ t: 'nevoa', acao: 'ligar' });
    mesa.send({ t: 'nevoa', acao: 'tudo' });
    assert.ok(!bar().data.nevoa!.vista.includes('1'));
  });

  test('abre sozinha em volta do agente (a peça com ficha) quando ele anda; a peça sem ficha não abre', () => {
    const r = bar();
    const [ag, outro] = r.tokenList();
    assert.ok(ag && outro, 'duas peças no Bar');
    gm.send({ t: 'fichaSalvar', ficha: fichaDe('Agente', ag.look.charId!) });
    gm.send({ t: 'nevoa', acao: 'ligar' });
    const pos = (id: number) => r.userPositions().find((p) => p.id === id)!;
    const a0 = pos(ag.id);
    let n = r.data.nevoa!;
    assert.ok(casaVista(n, a0.x, a0.y), 'em volta do agente já abre ao ligar');
    const o0 = pos(outro.id);
    assert.ok(!casaVista(n, o0.x, o0.y) || Math.hypot(o0.x - a0.x, o0.y - a0.y) <= 6, 'a peça sem ficha não abre');
    // o agente anda até longe: a névoa abre no caminho
    const destino = { x: 0, y: 0 };
    let melhor = -1;
    for (let y = 0; y < r.map.height; y++)
      for (let x = 0; x < r.map.width; x++) {
        if (r.map.walkState(x, y) !== 'walk') continue;
        const d = Math.hypot(x - a0.x, y - a0.y);
        if (d > melhor && !casaVista(n, x, y)) (melhor = d, destino.x = x, destino.y = y);
      }
    assert.ok(melhor > 6, 'tem uma casa escondida longe');
    gm.send({ t: 'tokenWalk', tokenId: ag.id, x: destino.x, y: destino.y });
    steps(80);
    n = r.data.nevoa!;
    const a1 = pos(ag.id);
    assert.ok(casaVista(n, a1.x, a1.y), 'abriu onde ele chegou');
    // esconder tudo com a abertura automática: a volta do agente continua à vista
    gm.send({ t: 'nevoa', acao: 'nada' });
    assert.ok(casaVista(r.data.nevoa!, a1.x, a1.y));
    // desligada a abertura automática, esconder tudo esconde tudo, e andar não abre mais
    gm.send({ t: 'nevoa', acao: 'auto', auto: false });
    gm.send({ t: 'nevoa', acao: 'nada' });
    gm.send({ t: 'tokenWalk', tokenId: ag.id, x: a0.x, y: a0.y });
    steps(80);
    assert.ok(!r.data.nevoa!.vista.includes('1'));
  });

  test('mudou a planta: a névoa começa de novo, do tamanho novo', () => {
    const r = bar();
    gm.send({ t: 'nevoa', acao: 'ligar' });
    gm.send({ t: 'nevoa', acao: 'tudo' });
    const hm = r.data.heightmap.split(/\r?\n/).map((l) => l + '0').join('\n');
    gm.send({ t: 'floorPlan', heightmap: hm, door: r.data.door });
    const n = mesa.last('roomEnter')?.room.nevoa;
    assert.ok(n);
    assert.equal(n.largura, r.map.width);
    assert.equal(n.vista.length, r.map.width * r.map.height);
  });
});

describe('mapa improvisado', () => {
  const url = '/uploads/0123456789abcdef0123.png';

  test('a imagem vira uma cena ao ar livre, ligada à de agora, e leva os agentes, o mestre e a mesa', () => {
    const r = bar();
    const [ag, outro] = r.tokenList();
    gm.send({ t: 'fichaSalvar', ficha: fichaDe('Agente', ag.look.charId!) });
    gm.send({ t: 'mapaImprovisado', nome: 'Beco atrás do bar', url, largura: 20, altura: 14, levar: true });
    const nova = [...hotel.rooms.values()].find((x) => x.data.mapa === url)!;
    assert.ok(nova, 'a cena nova existe');
    assert.equal(nova.data.name, 'Sede · Beco atrás do bar');
    assert.ok(nova.data.aberto && nova.data.tatico);
    assert.equal(nova.map.width, 20);
    assert.equal(nova.map.height, 14);
    // a Entrada leva de volta ao Bar (e deixa as duas cenas na mesma campanha)
    const entrada = nova.map.allItems().find((i) => i.defId === 'entrada');
    assert.equal(entrada?.link, r.data.id);
    hotel.pushNow();
    assert.ok(gm.last('campaign')!.state.scenes.some((s) => s.id === nova.data.id), 'a cena nova está na planta da campanha');
    // o agente foi; a peça sem ficha ficou
    assert.ok(nova.tokenList().some((t) => t.id === ag.id));
    assert.ok(r.tokenList().some((t) => t.id === outro.id));
    // o mestre e a mesa estão na cena nova, com a imagem
    assert.equal(gm.last('roomEnter')?.room.mapa, url);
    assert.equal(mesa.last('roomEnter')?.room.id, nova.data.id);
  });

  test('sem a imagem enviada, ou do tamanho errado, não cria; a mesa não cria', () => {
    const antes = hotel.rooms.size;
    gm.send({ t: 'mapaImprovisado', nome: 'X', url: '/arte/qualquer.png', largura: 20, altura: 14 });
    gm.send({ t: 'mapaImprovisado', nome: 'X', url, largura: 2, altura: 14 });
    gm.send({ t: 'mapaImprovisado', nome: 'X', url, largura: 150, altura: 150 });
    mesa.send({ t: 'mapaImprovisado', nome: 'X', url, largura: 20, altura: 14 });
    assert.equal(hotel.rooms.size, antes);
  });

  test('o tamanho sai dos quadrados de 1,5 m e da proporção da imagem', () => {
    assert.deepEqual(tamanhoDoMapa(15, 1500, 1000), { largura: 30, altura: 20 });
    assert.deepEqual(tamanhoDoMapa(1, 100, 100), { largura: 4, altura: 4 });
    const g = tamanhoDoMapa(80, 1000, 1000);
    assert.ok(g.largura * g.altura <= 9000);
  });
});

describe('a câmera do mestre (com o zoom da vista tática)', () => {
  test('o zoom tático vai para a mesa, e a mesa que entra depois já recebe o mesmo enquadramento', () => {
    gm.send({ t: 'camMestre', cx: 100, cy: 80, w: 300, h: 200, tk: 2.5, tx: -0.25, ty: 0.1 });
    const c = mesa.last('camMestre')!;
    assert.deepEqual([c.cx, c.cy, c.w, c.h, c.tk, c.tx, c.ty], [100, 80, 300, 200, 2.5, -0.25, 0.1]);
    // a mesa que caiu e voltou
    const volta = new Peer(hotel);
    volta.send({ t: 'login', name: 'Mesa2', look, mesa: true });
    volta.send({ t: 'join', roomId: bar().data.id });
    const v = volta.last('camMestre')!;
    assert.equal(v.tk, 2.5);
    assert.equal(v.tx, -0.25);
  });

  test('zoom fora de 1 a 5 não passa (fica só o enquadramento), e o de 1 volta ao normal', () => {
    gm.send({ t: 'camMestre', cx: 10, cy: 10, w: 100, h: 100, tk: 9, tx: 1, ty: 1 });
    assert.equal(mesa.last('camMestre')!.tk, undefined);
    gm.send({ t: 'camMestre', cx: 10, cy: 10, w: 100, h: 100, tk: 1, tx: 0, ty: 0 });
    assert.equal(mesa.last('camMestre')!.tk, 1);
  });
});
