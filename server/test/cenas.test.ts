import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { lerCena, semNotas, urlDeCena, type CenaAoVivo, type CenaMomento, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

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
  /** a última cena ao vivo que chegou (undefined = nenhuma mensagem ainda; null = fechada) */
  aoVivo(): CenaAoVivo | null | undefined {
    const ms = this.inbox.filter((m): m is Extract<ServerMsg, { t: 'cenaAoVivo' }> => m.t === 'cenaAoVivo');
    return ms.length ? ms[ms.length - 1].cena : undefined;
  }
  lista(): CenaMomento[] | undefined {
    const ms = this.inbox.filter((m): m is Extract<ServerMsg, { t: 'cenas' }> => m.t === 'cenas');
    return ms.length ? ms[ms.length - 1].cenas : undefined;
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };
const cela: CenaMomento = {
  id: 'cela',
  titulo: 'A cela do pai da Cora',
  musica: '/uploads/abc123.mp3',
  musicaNome: 'tema.mp3',
  quadros: [
    { imagem: '/uploads/aaa.png', legenda: 'Chegamos.', nota: 'Passarinho?!' },
    { imagem: '/uploads/bbb.webp', nota: 'A mão dele segura a grade.' },
    { imagem: '/arte/viagem/ilustracoes/chegada-sede-da-ordem-1.png' },
  ],
};

let hotel: Hotel;
let gm: Peer;
let mesa: Peer;

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  gm = new Peer(hotel, true);
  gm.send({ t: 'login', name: 'Mestre', look });
  mesa = new Peer(hotel);
  mesa.send({ t: 'login', name: 'Mesa', look });
});

describe('Cenas de momento: o que vale', () => {
  test('só arquivo do próprio jogo: nada de endereço de fora, nada de ..', () => {
    assert.equal(urlDeCena('/uploads/x1.png', 'imagem'), '/uploads/x1.png');
    assert.equal(urlDeCena('/arte/a/b.webp', 'imagem'), '/arte/a/b.webp');
    assert.equal(urlDeCena('https://site.com/x.png', 'imagem'), null);
    assert.equal(urlDeCena('//site.com/x.png', 'imagem'), null);
    assert.equal(urlDeCena('/uploads/../segredo.png', 'imagem'), null);
    assert.equal(urlDeCena('/uploads/x.mp3', 'imagem'), null);
    assert.equal(urlDeCena('/uploads/x.mp3', 'audio'), '/uploads/x.mp3');
    assert.equal(urlDeCena('/uploads/x.png', 'audio'), null);
  });

  test('lerCena exige título e pelo menos um quadro com imagem; descarta o quadro torto e limita a 12', () => {
    assert.equal(lerCena({ titulo: '', quadros: [{ imagem: '/uploads/a.png' }] }, () => 'n'), null);
    assert.equal(lerCena({ titulo: 'x', quadros: [{ imagem: 'http://fora/a.png' }] }, () => 'n'), null);
    const c = lerCena({ titulo: ' Cena ', quadros: [{ imagem: '/uploads/a.png', legenda: ' oi ' }, { imagem: 'lixo' }, null, { imagem: '/uploads/b.jpg' }], musica: 'http://fora/m.mp3' }, () => 'novo');
    assert.ok(c);
    assert.equal(c.id, 'novo');
    assert.equal(c.titulo, 'Cena');
    assert.equal(c.quadros.length, 2);
    assert.equal(c.quadros[0].legenda, 'oi');
    assert.equal(c.musica, undefined);
    const muitos = lerCena({ titulo: 'x', quadros: Array.from({ length: 30 }, (_, i) => ({ imagem: `/uploads/q${i}.png` })) }, () => 'n');
    assert.equal(muitos?.quadros.length, 12);
  });

  test('semNotas tira a fala do mestre e deixa a legenda', () => {
    const v = semNotas({ id: 'c', titulo: 'c', quadro: 0, quadros: cela.quadros });
    assert.equal(v.quadros[0].legenda, 'Chegamos.');
    assert.ok(v.quadros.every((q) => !('nota' in q)));
  });
});

describe('Cenas de momento: o servidor', () => {
  test('o mestre guarda a cena e recebe a lista; a mesa não recebe a lista', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    assert.equal(gm.lista()?.length, 1);
    assert.equal(gm.lista()?.[0].titulo, 'A cela do pai da Cora');
    assert.equal(hotel.db.cenasMomento?.length, 1);
    assert.equal(mesa.lista(), undefined);
  });

  test('guardar de novo a mesma cena troca (não duplica); cena inválida é recusada', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaSalvar', cena: { ...cela, titulo: 'Outro nome' } });
    assert.equal(hotel.db.cenasMomento?.length, 1);
    assert.equal(hotel.db.cenasMomento?.[0].titulo, 'Outro nome');
    gm.inbox.length = 0;
    gm.send({ t: 'cenaSalvar', cena: { id: 'x', titulo: 'sem quadro', quadros: [] } });
    assert.ok(gm.inbox.some((m) => m.t === 'error'));
    assert.equal(hotel.db.cenasMomento?.length, 1);
  });

  test('soltar a cena: o mestre vê as falas, a mesa só a imagem e a legenda', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaTocar', id: 'cela' });
    const g = gm.aoVivo();
    const m = mesa.aoVivo();
    assert.equal(g?.quadro, 0);
    assert.equal(g?.quadros[0].nota, 'Passarinho?!');
    assert.equal(g?.musica, '/uploads/abc123.mp3');
    assert.equal(m?.quadros[0].legenda, 'Chegamos.');
    assert.ok(m?.quadros.every((q) => !('nota' in q)), 'a mesa não recebe a fala do mestre');
    assert.equal(m?.musica, '/uploads/abc123.mp3');
  });

  test('avançar, voltar (limitado ao primeiro e ao último) e fechar chegam em todos', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaTocar', id: 'cela' });
    gm.send({ t: 'cenaQuadro', quadro: 1 });
    assert.equal(mesa.aoVivo()?.quadro, 1);
    gm.send({ t: 'cenaQuadro', quadro: 99 });
    assert.equal(mesa.aoVivo()?.quadro, 2);
    gm.send({ t: 'cenaQuadro', quadro: -5 });
    assert.equal(mesa.aoVivo()?.quadro, 0);
    gm.send({ t: 'cenaFechar' });
    assert.equal(mesa.aoVivo(), null);
    assert.equal(gm.aoVivo(), null);
  });

  test('quem não é mestre não guarda, não solta, não avança e não fecha', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaTocar', id: 'cela' });
    mesa.send({ t: 'cenaSalvar', cena: { ...cela, id: 'intruso', titulo: 'Intruso' } });
    mesa.send({ t: 'cenaQuadro', quadro: 2 });
    mesa.send({ t: 'cenaApagar', id: 'cela' });
    mesa.send({ t: 'cenaFechar' });
    assert.equal(hotel.db.cenasMomento?.length, 1);
    assert.equal(gm.aoVivo()?.quadro, 0);
    assert.equal(gm.aoVivo()?.id, 'cela');
  });

  test('quem entra no meio da cena recebe o quadro de agora, sem as falas', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaTocar', id: 'cela' });
    gm.send({ t: 'cenaQuadro', quadro: 1 });
    const novo = new Peer(hotel);
    novo.send({ t: 'login', name: 'Jogadora', look });
    novo.send({ t: 'cenasPedir' });
    assert.equal(novo.aoVivo()?.quadro, 1);
    assert.ok(novo.aoVivo()?.quadros.every((q) => !('nota' in q)));
    assert.equal(novo.lista(), undefined);
  });

  test('apagar a cena que está na tela fecha a cena', () => {
    gm.send({ t: 'cenaSalvar', cena: cela });
    gm.send({ t: 'cenaTocar', id: 'cela' });
    gm.send({ t: 'cenaApagar', id: 'cela' });
    assert.equal(hotel.db.cenasMomento?.length, 0);
    assert.equal(mesa.aoVivo(), null);
  });

  test('soltar uma cena que não existe: erro, nada na tela', () => {
    gm.inbox.length = 0;
    gm.send({ t: 'cenaTocar', id: 'nao-existe' });
    assert.ok(gm.inbox.some((m) => m.t === 'error'));
    assert.equal(mesa.aoVivo(), undefined);
  });
});

describe('Cenas de momento: câmera, camadas, tempo e salas', () => {
  test('lerCena guarda a câmera, as camadas, o tempo, o som, o cinema e as salas; descarta o torto', () => {
    const c = lerCena(
      {
        titulo: 'Cela',
        cinema: true,
        salas: [12, 12.5, -3, 'x', 40],
        quadros: [
          {
            imagem: '/uploads/a.png',
            movimento: 'tremor',
            transicao: 'flash',
            duracao: 6.26,
            som: '/uploads/pancada.mp3',
            camera: { de: { x: -10, y: 50, zoom: 9 }, para: { x: 30, y: 120, zoom: 0.1 } },
            camadas: [
              { imagem: '/uploads/mao.png', entrada: 'esquerda', atraso: 1.5, duracao: 5, prof: 2 },
              { imagem: 'http://fora/x.png' },
              { imagem: '/uploads/rosto.png', entrada: 'inexistente', atraso: -2, prof: 99 },
            ],
          },
        ],
      },
      () => 'n',
    );
    assert.ok(c);
    assert.equal(c.cinema, true);
    assert.deepEqual(c.salas, [12, 40]);
    const q = c.quadros[0];
    assert.equal(q.movimento, 'tremor');
    assert.equal(q.transicao, 'flash');
    assert.equal(q.duracao, 6.3);
    assert.equal(q.som, '/uploads/pancada.mp3');
    assert.deepEqual(q.camera, { de: { x: 0, y: 50, zoom: 4 }, para: { x: 30, y: 100, zoom: 0.3 } });
    assert.equal(q.camadas?.length, 2);
    assert.deepEqual(q.camadas?.[0], { imagem: '/uploads/mao.png', entrada: 'esquerda', atraso: 1.5, duracao: 5, prof: 2 });
    assert.deepEqual(q.camadas?.[1], { imagem: '/uploads/rosto.png', prof: 3 });
  });

  test('os padrões não ficam gravados (zoom, dissolver, sem atraso), e câmera pela metade é descartada', () => {
    const c = lerCena({ titulo: 'x', quadros: [{ imagem: '/uploads/a.png', movimento: 'zoom', transicao: 'fade', duracao: 0, camera: { de: { x: 1, y: 1, zoom: 1 } } }] }, () => 'n');
    assert.deepEqual(c?.quadros[0], { imagem: '/uploads/a.png' });
  });

  test('a passagem sozinha: o relógio avança o quadro e fecha depois do último; a pausa para', () => {
    const cena: CenaMomento = { id: 'auto', titulo: 'Auto', quadros: [{ imagem: '/uploads/a.png', duracao: 5 }, { imagem: '/uploads/b.png', duracao: 5 }, { imagem: '/uploads/c.png' }] };
    gm.send({ t: 'cenaSalvar', cena });
    gm.send({ t: 'cenaTocar', id: 'auto' });
    assert.equal(mesa.aoVivo()?.quadro, 0);
    hotel.cenaPasso();
    assert.equal(mesa.aoVivo()?.quadro, 1);
    gm.send({ t: 'cenaPausa', pausada: true });
    assert.equal(mesa.aoVivo()?.pausada, true);
    gm.send({ t: 'cenaPausa', pausada: false });
    assert.equal(mesa.aoVivo()?.pausada, false);
    hotel.cenaPasso();
    assert.equal(mesa.aoVivo()?.quadro, 2);
    hotel.cenaPasso();
    assert.equal(mesa.aoVivo(), null);
    assert.equal(gm.aoVivo(), null);
  });

  test('o cinema vai junto na cena ao vivo; quem não é mestre não pausa', () => {
    gm.send({ t: 'cenaSalvar', cena: { ...cela, id: 'cin', cinema: true } });
    gm.send({ t: 'cenaTocar', id: 'cin' });
    assert.equal(mesa.aoVivo()?.cinema, true);
    mesa.send({ t: 'cenaPausa', pausada: true });
    assert.notEqual(gm.aoVivo()?.pausada, true);
  });
});

