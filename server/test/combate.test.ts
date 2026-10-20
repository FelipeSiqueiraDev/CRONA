import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { combate, type ClientMsg, type ServerMsg } from '@crona/shared';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

type Combate = combate.Combate;
type Acao = combate.AcaoCombate;

// ---------------------------------------------------------------- regras puras

/** Peças de teste: três agentes e dois inimigos na cena, e um agente em outra cena. */
const PECAS: combate.PecaCombate[] = [
  { id: 1, nome: 'Cora', agente: true, naCena: true },
  { id: 2, nome: 'Tepes', agente: true, naCena: true },
  { id: 3, nome: 'Catarina', agente: true, naCena: true },
  { id: 10, nome: 'Ocultista', agente: false, naCena: true },
  { id: 11, nome: 'Acólito', agente: false, naCena: true },
  { id: 4, nome: 'Alosi', agente: true, naCena: false },
];

let vitais: Map<number, Partial<combate.Vitais>>;
let relogio = 1000;
const ctx = (): combate.Contexto => ({ agora: relogio++, cena: 7, pecas: PECAS, vitais: (id) => ({ pv: 20, pvMax: 20, pe: 5, peMax: 5, san: 20, sanMax: 20, ...vitais.get(id) }) });

function aplicar(c: Combate | null, a: Acao): Combate {
  const r = combate.aplicar(c, a, ctx());
  if (!r.ok) throw new Error(r.motivo);
  assert.ok(r.combate, 'combate existe');
  return r.combate;
}
function recusa(c: Combate | null, a: Acao): string {
  const r = combate.aplicar(c, a, ctx());
  assert.equal(r.ok, false, 'devia recusar');
  return (r as { ok: false; motivo: string }).motivo;
}
/** Nome de quem está na vez. */
function vez(c: Combate): string {
  const e = combate.entrada(c, c.vez);
  return e ? combate.nomeEntrada(c, e) : '—';
}

/** Combate montado: Cora 22, Tepes 18, mestre 14, Catarina 12. */
function montado(): Combate {
  let c = aplicar(null, { tipo: 'abrir' });
  c = aplicar(c, { tipo: 'participante', id: 1, iniciativa: 22 });
  c = aplicar(c, { tipo: 'participante', id: 2, iniciativa: 18 });
  c = aplicar(c, { tipo: 'participante', id: 3, iniciativa: 12 });
  return aplicar(c, { tipo: 'iniciativaMestre', valor: 14 });
}

beforeEach(() => {
  vitais = new Map();
});

describe('combate: montagem e iniciativa', () => {
  test('abre com as peças da cena; agente com ficha tem turno próprio, o resto é do mestre', () => {
    const c = aplicar(null, { tipo: 'abrir' });
    assert.equal(c.fase, 'montando');
    assert.equal(c.cena, 7);
    assert.deepEqual(
      c.participantes.map((p) => `${p.nome}:${p.lado}`),
      ['Cora:agente', 'Tepes:agente', 'Catarina:agente', 'Ocultista:inimigo', 'Acólito:inimigo'],
    );
    assert.equal(recusa(c, { tipo: 'abrir' }), 'Já existe um combate aberto nesta campanha.');
  });

  test('só começa com a Iniciativa de todos os agentes e a do grupo do mestre', () => {
    let c = aplicar(null, { tipo: 'abrir' });
    assert.match(recusa(c, { tipo: 'comecar' }), /Falta a Iniciativa de Cora, Tepes, Catarina/);
    c = aplicar(c, { tipo: 'participante', id: 1, iniciativa: 22 });
    c = aplicar(c, { tipo: 'participante', id: 2, iniciativa: 18 });
    c = aplicar(c, { tipo: 'participante', id: 3, iniciativa: 12 });
    assert.equal(recusa(c, { tipo: 'comecar' }), 'Falta a Iniciativa do grupo do mestre.');
  });

  test('ordem do maior para o menor, com um turno só para todos os seres do mestre (LR p. 83, 169)', () => {
    const c = aplicar(montado(), { tipo: 'comecar' });
    assert.deepEqual(
      combate.entradas(c).map((e) => `${combate.nomeEntrada(c, e)} ${e.valor}`),
      ['Cora 22', 'Tepes 18', 'Turno do mestre 14', 'Catarina 12'],
    );
    const m = combate.entrada(c, combate.ID_MESTRE)!;
    assert.deepEqual(m.participantes, [10, 11]);
    assert.equal(c.rodada, 1);
    assert.equal(vez(c), 'Cora');
  });

  test('empate: aponta os empatados; o desempate decide', () => {
    let c = montado();
    c = aplicar(c, { tipo: 'participante', id: 2, iniciativa: 22 });
    assert.deepEqual(
      combate.empates(c).map((g) => g.map((e) => combate.nomeEntrada(c, e))),
      [['Cora', 'Tepes']],
    );
    c = aplicar(c, { tipo: 'participante', id: 2, desempate: 1 });
    assert.deepEqual(combate.empates(c), []);
    assert.equal(combate.nomeEntrada(c, combate.entradas(c)[0]), 'Tepes');
  });

  test('tirar da montagem e incluir peça de outra cena da campanha', () => {
    let c = aplicar(null, { tipo: 'abrir' });
    c = aplicar(c, { tipo: 'participante', id: 11, incluir: false });
    c = aplicar(c, { tipo: 'participante', id: 4, lado: 'agente', iniciativa: 9 });
    assert.deepEqual(
      c.participantes.map((p) => p.nome),
      ['Cora', 'Tepes', 'Catarina', 'Ocultista', 'Alosi'],
    );
    assert.equal(recusa(c, { tipo: 'participante', id: 99 }), 'Peça não encontrada.');
  });
});

describe('combate: rodadas e turnos', () => {
  test('passar percorre a ordem e vira a rodada', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    const vistos = [vez(c)];
    for (let i = 0; i < 4; i++) {
      c = aplicar(c, { tipo: 'passar' });
      vistos.push(vez(c));
    }
    assert.deepEqual(vistos, ['Cora', 'Tepes', 'Turno do mestre', 'Catarina', 'Cora']);
    assert.equal(c.rodada, 2);
    assert.ok(c.registro.some((l) => l.tipo === 'rodada' && l.texto === 'Rodada 2.'));
  });

  test('surpreendido não tem turno na rodada 1 e age na 2 (LR p. 83–84)', () => {
    let c = montado();
    c = aplicar(c, { tipo: 'participante', id: 3, ciente: false });
    c = aplicar(c, { tipo: 'comecar' });
    assert.ok(c.registro.some((l) => /Surpreendidos na rodada 1.*Catarina/.test(l.texto)));
    const ordem = [vez(c)];
    for (let i = 0; i < 3; i++) {
      c = aplicar(c, { tipo: 'passar' });
      ordem.push(vez(c));
    }
    // rodada 1 sem a Catarina; na 2 ela entra na vez dela
    assert.deepEqual(ordem, ['Cora', 'Tepes', 'Turno do mestre', 'Cora']);
    c = aplicar(aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(vez(c), 'Catarina');
    assert.equal(c.rodada, 2);
  });

  test('o turno do mestre pula a rodada 1 se todos os seres dele foram surpreendidos', () => {
    let c = montado();
    c = aplicar(c, { tipo: 'participante', id: 10, ciente: false });
    c = aplicar(c, { tipo: 'participante', id: 11, ciente: false });
    c = aplicar(aplicar(aplicar(c, { tipo: 'comecar' }), { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(vez(c), 'Catarina');
  });

  test('atrasar: age mais tarde na mesma rodada, e a Iniciativa nova fica (LR p. 87)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(recusa(c, { tipo: 'atrasar', valor: 22 }), 'Para atrasar, a Iniciativa nova precisa ser menor que 22.');
    assert.equal(recusa(c, { tipo: 'atrasar', valor: 20 }), 'Para agir depois de Tepes, a Iniciativa nova precisa ser 18 ou menos.');
    c = aplicar(c, { tipo: 'atrasar', valor: 13 });
    assert.equal(vez(c), 'Tepes');
    const ordem = [vez(c)];
    for (let i = 0; i < 3; i++) {
      c = aplicar(c, { tipo: 'passar' });
      ordem.push(vez(c));
    }
    assert.deepEqual(ordem, ['Tepes', 'Turno do mestre', 'Cora', 'Catarina']);
    assert.equal(combate.participante(c, 1)?.iniciativa, 13);
  });

  test('atrasar para a mesma Iniciativa de quem vem depois: fica logo depois dele', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'atrasar', valor: 18 });
    assert.equal(vez(c), 'Tepes');
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Cora');
  });

  test('o último da rodada não tem como atrasar', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    for (let i = 0; i < 3; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Catarina');
    assert.equal(recusa(c, { tipo: 'atrasar', valor: 5 }), 'Ninguém mais age nesta rodada: não há como atrasar.');
  });

  test('preparar: a ação acontece como reação e a Iniciativa passa para logo acima (LR p. 86)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'preparar', texto: 'atirar no primeiro que passar pela porta' });
    assert.equal(vez(c), 'Tepes');
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Turno do mestre');
    c = aplicar(c, { tipo: 'usarPreparada', entrada: combate.idAgente(1) });
    assert.equal(combate.participante(c, 1)?.iniciativa, 14);
    // fica logo acima do mestre na ordem, e não age de novo nesta rodada
    assert.deepEqual(
      combate.entradas(c).map((e) => combate.nomeEntrada(c, e)),
      ['Tepes', 'Cora', 'Turno do mestre', 'Catarina'],
    );
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(c.rodada, 2);
    assert.equal(vez(c), 'Tepes');
  });

  test('ação preparada não usada se perde no começo do próximo turno', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'preparar', texto: 'esperar' });
    for (let i = 0; i < 3; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Cora');
    assert.deepEqual(c.preparadas, []);
    assert.ok(c.registro.some((l) => l.texto === 'Cora não usou a ação preparada (esperar).'));
  });

  test('quem chega no meio age a partir da rodada seguinte (LR p. 83)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(recusa(c, { tipo: 'entrar', id: 4, lado: 'agente' }), 'Diga a Iniciativa de quem chega.');
    c = aplicar(c, { tipo: 'entrar', id: 4, lado: 'agente', iniciativa: 30 });
    assert.equal(combate.participante(c, 4)?.desde, 2);
    for (let i = 0; i < 3; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Catarina');
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(c.rodada, 2);
    assert.equal(vez(c), 'Alosi');
  });
});

describe('combate: ações do turno', () => {
  test('padrão e movimento; a segunda de movimento gasta a padrão; a completa pede o turno livre (LR p. 84)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'declarar', qual: 'movimento', texto: 'Movimentar-se' });
    c = aplicar(c, { tipo: 'declarar', qual: 'movimento', texto: 'Levantar-se' });
    assert.deepEqual(combate.acoesDe(c, 1), { padrao: true, movimento: true, completa: false, pe: 0 });
    assert.equal(recusa(c, { tipo: 'declarar', qual: 'movimento', texto: 'Sacar' }), 'Não sobra ação de movimento neste turno.');
    assert.equal(recusa(c, { tipo: 'declarar', qual: 'padrao', texto: 'Agredir' }), 'A ação padrão já foi usada neste turno.');
    assert.equal(recusa(c, { tipo: 'declarar', qual: 'completa', texto: 'Investida' }), 'A ação completa precisa do turno inteiro livre.');
    c = aplicar(c, { tipo: 'declarar', qual: 'livre', texto: 'Falar' });
    assert.ok(c.registro.some((l) => l.texto === 'Cora: Levantar-se (ação de movimento, no lugar da padrão).'));
    // o próximo turno começa com tudo livre
    c = aplicar(c, { tipo: 'passar' });
    assert.deepEqual(combate.acoesDe(c, 2), { padrao: false, movimento: false, completa: false, pe: 0 });
  });

  test('no turno do mestre, cada ser tem as próprias ações', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(vez(c), 'Turno do mestre');
    c = aplicar(c, { tipo: 'declarar', qual: 'padrao', texto: 'Agredir', quem: 10 });
    c = aplicar(c, { tipo: 'declarar', qual: 'padrao', texto: 'Agredir', quem: 11 });
    assert.equal(combate.acoesDe(c, 10).padrao, true);
    assert.equal(combate.acoesDe(c, 11).padrao, true);
    assert.equal(recusa(c, { tipo: 'declarar', qual: 'padrao', texto: 'Agredir', quem: 1 }), 'Esse ser não está na vez.');
  });

  test('defesa especial: uma por rodada, volta no começo do próprio turno (LR p. 88)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'declarar', qual: 'reacao', texto: 'Esquiva', quem: 2, especial: true });
    assert.equal(recusa(c, { tipo: 'declarar', qual: 'reacao', texto: 'Bloqueio', quem: 2, especial: true }), 'Tepes já usou a defesa especial desta rodada.');
    // reação comum não tem limite (LR p. 85)
    c = aplicar(c, { tipo: 'declarar', qual: 'reacao', texto: 'Teste de Reflexos', quem: 2 });
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Tepes');
    assert.equal(combate.participante(c, 2)?.reacao, false);
  });
});

describe('combate: morrendo e enlouquecendo', () => {
  test('agente a 0 PV conta os turnos começados morrendo; no 3º morre e a vez passa (LR p. 88)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    vitais.set(2, { pv: 0, san: 20 });
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(combate.participante(c, 2)?.morrendo, 1);
    assert.ok(c.registro.some((l) => l.texto === 'Tepes começa o turno morrendo (1/3).'));
    for (let rodada = 0; rodada < 2; rodada++) for (let i = 0; i < 4; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(combate.participante(c, 2)?.fora, 'morto');
    assert.ok(c.registro.some((l) => /Tepes começou o 3º turno morrendo nesta cena e morreu/.test(l.texto)));
    // a vez pulou para o próximo
    assert.equal(vez(c), 'Turno do mestre');
  });

  test('SAN 0: enlouquecendo; no 3º turno fica insano', () => {
    // a Cora é a primeira: o turno dela da rodada 1 começa junto com o combate
    vitais.set(1, { pv: 20, san: 0 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(combate.participante(c, 1)?.enlouquecendo, 1);
    for (let rodada = 0; rodada < 2; rodada++) for (let i = 0; i < 4; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(combate.participante(c, 1)?.enlouquecendo, 3);
    assert.equal(combate.participante(c, 1)?.fora, 'insano');
  });

  test('ameaça a 0 PV não conta morrendo (o mestre tira do combate)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    vitais.set(10, { pv: 0, san: 0 });
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(combate.participante(c, 10)?.morrendo, 0);
    c = aplicar(c, { tipo: 'sair', id: 10, motivo: 'morto' });
    assert.equal(vez(c), 'Turno do mestre');
    c = aplicar(c, { tipo: 'sair', id: 11 });
    // sem ninguém no turno do mestre, a vez passa
    assert.equal(vez(c), 'Catarina');
  });
});

describe('combate: fim', () => {
  test('encerrar guarda o resumo; fechar tira o combate; na montagem, encerrar cancela', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(recusa(c, { tipo: 'fechar' }), 'Encerre o combate antes de fechar.');
    c = aplicar(c, { tipo: 'encerrar' });
    assert.equal(c.fase, 'encerrado');
    assert.ok(c.registro.some((l) => l.texto === 'Combate encerrado na rodada 1.'));
    const r = combate.aplicar(c, { tipo: 'fechar' }, ctx());
    assert.ok(r.ok && r.combate === null);
    const cancelado = combate.aplicar(montado(), { tipo: 'encerrar' }, ctx());
    assert.ok(cancelado.ok && cancelado.combate === null);
  });

  test('a mesa não recebe o registro nem o texto das ações preparadas', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'preparar', texto: 'segredo' });
    const m = combate.visaoMesa(c)!;
    assert.deepEqual(m.registro, []);
    assert.equal(m.preparadas[0].texto, '');
    assert.equal(m.vez, c.vez);
  });

  test('ação com forma errada é recusada antes das regras', () => {
    assert.equal(combate.lerAcao({ tipo: 'bagunça' }), null);
    assert.equal(combate.lerAcao('passar'), null);
    assert.deepEqual(combate.lerAcao({ tipo: 'passar' }), { tipo: 'passar' });
  });
});

// ---------------------------------------------------------------- servidor

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
  combate(a: Acao) {
    this.send({ t: 'combate', a });
  }
  last<T extends ServerMsg['t']>(t: T): Msg<T> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Msg<T>;
    return undefined;
  }
}

const look = { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: null };

describe('combate no servidor', () => {
  let hotel: Hotel;
  let gm: Peer;
  let mesa: Peer;
  let escritorio: number;

  beforeEach(() => {
    const db = seedDb();
    upgradeDb(db);
    hotel = new Hotel({ db, persist: false, timers: false });
    escritorio = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
    gm = new Peer(hotel);
    gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
    gm.send({ t: 'join', roomId: escritorio });
    mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: escritorio });
    hotel.pushNow();
  });

  const doMestre = () => gm.last('combate')!;
  const pecas = () => gm.last('session')!.session.characters;

  test('sem combate, todos recebem null', () => {
    assert.equal(doMestre().combate, null);
    assert.equal(mesa.last('combate')?.combate, null);
  });

  test('o mestre abre e monta; a mesa acompanha sem o registro; o jogador não mexe', () => {
    gm.combate({ tipo: 'abrir' });
    hotel.pushNow();
    const aberto = doMestre().combate!;
    assert.equal(aberto.fase, 'montando');
    assert.equal(aberto.cena, escritorio);
    const [a, b] = pecas();
    gm.combate({ tipo: 'participante', id: a.id, lado: 'agente', iniciativa: 15 });
    gm.combate({ tipo: 'participante', id: b.id, lado: 'inimigo' });
    gm.combate({ tipo: 'iniciativaMestre', valor: 10 });
    gm.combate({ tipo: 'comecar' });
    hotel.pushNow();
    const c = doMestre().combate!;
    assert.equal(c.fase, 'andamento');
    assert.equal(c.vez, combate.idAgente(a.id));
    assert.ok(c.registro.length > 0);
    const m = mesa.last('combate')!;
    assert.equal(m.combate?.vez, c.vez);
    assert.deepEqual(m.combate?.registro, []);
    assert.equal(m.podeDesfazer, undefined);
    // a mesa não manda no combate
    mesa.combate({ tipo: 'passar' });
    assert.match(mesa.last('error')?.msg ?? '', /mestre/);
    // o começo vai para o registro da sessão
    assert.ok(gm.last('campaign')!.state.log.some((e) => e.text === 'Combate começou.'));
  });

  test('recusa volta como aviso para o mestre', () => {
    gm.combate({ tipo: 'passar' });
    assert.equal(gm.last('denied')?.reason, 'Não há combate aberto.');
  });

  test('desfazer volta um passo de cada vez', () => {
    gm.combate({ tipo: 'abrir' });
    const [a] = pecas();
    gm.combate({ tipo: 'participante', id: a.id, lado: 'agente', iniciativa: 15 });
    hotel.pushNow();
    assert.equal(doMestre().podeDesfazer, true);
    assert.equal(doMestre().combate?.participantes.find((p) => p.id === a.id)?.iniciativa, 15);
    gm.combate({ tipo: 'desfazer' });
    hotel.pushNow();
    assert.equal(doMestre().combate?.participantes.find((p) => p.id === a.id)?.iniciativa ?? null, null);
    gm.combate({ tipo: 'desfazer' });
    hotel.pushNow();
    assert.equal(doMestre().combate, null);
    gm.combate({ tipo: 'desfazer' });
    assert.equal(gm.last('denied')?.reason, 'Nada para desfazer.');
  });
});

// ---------------------------------------------------------------- ataque (regras puras)

describe('ataque: medidas e situações', () => {
  test('alcance da arma, faixa da distância e adjacência (COMBATE.md 7.2)', () => {
    assert.equal(combate.faixaArma('médio'), 'medio');
    assert.equal(combate.faixaArma('Curto'), 'curto');
    assert.equal(combate.faixaArma(undefined), null);
    assert.equal(combate.faixaDaDistancia(7.5), 'curto');
    assert.equal(combate.faixaDaDistancia(9), 'curto');
    assert.equal(combate.faixaDaDistancia(9.2), 'medio');
    assert.equal(combate.faixaDaDistancia(120), null);
    assert.equal(combate.textoMetros(combate.metrosDe(10)), '7,5 m');
    assert.equal(combate.textoMetros(9), '9 m');
    assert.ok(combate.adjacente({ x: 0, y: 0 }, { x: 2, y: 2 }));
    assert.ok(!combate.adjacente({ x: 0, y: 0 }, { x: 3, y: 0 }));
  });

  test('situações: cobertura soma; desprevenido e vulnerável não somam; caído depende da distância; falha até 75%', () => {
    const t = combate.montarTeste({ dados: 3, bonus: 5, defesaBase: 15, distancia: true, situacoes: ['cobertura', 'alvoDesprevenido', 'alvoVulneravel', 'emCorpoACorpo', 'flanqueando'] });
    // flanquear só vale no corpo a corpo; alvo em corpo a corpo só à distância
    assert.equal(t.dados, 3);
    assert.equal(t.bonus, 0);
    assert.equal(t.defesa, 15);
    assert.equal(combate.textoDefesa(t, 15), '15 (15 + 5 − 5)');
    const caidoPerto = combate.montarTeste({ dados: 2, bonus: 0, defesaBase: 12, distancia: false, situacoes: ['alvoCaido', 'flanqueando'] });
    assert.equal(caidoPerto.defesa, 7);
    assert.equal(caidoPerto.dados, 3);
    assert.equal(combate.montarTeste({ dados: 2, bonus: 0, defesaBase: 12, distancia: true, situacoes: ['alvoCaido'] }).defesa, 17);
    assert.equal(combate.montarTeste({ dados: 1, bonus: 0, defesaBase: 10, distancia: true, situacoes: ['camuflagemTotal', 'atacanteCego'] }).falha, 75);
  });

  test('o texto da rolagem (DC-1: menos de 1 dado rola 2 − n e fica o menor)', () => {
    assert.equal(combate.textoRolagem(3, 5), 'Role 3d20, fique com o maior, +5');
    assert.equal(combate.textoRolagem(1, -2), 'Role 1d20, -2');
    assert.equal(combate.textoRolagem(0, 3), 'Role 2d20, fique com o menor, +3');
  });

  test('resultado: 20 natural acerta; crítico só acertando na margem; a camuflagem falha no d10 (LR p. 82, 85, 89)', () => {
    assert.equal(combate.resolver({ d20: 20, bonus: 0, defesa: 40, margem: 20, falha: 0 }).resultado, 'critico');
    assert.equal(combate.resolver({ d20: 18, bonus: 5, defesa: 20, margem: 17, falha: 0 }).resultado, 'critico');
    assert.equal(combate.resolver({ d20: 18, bonus: 1, defesa: 20, margem: 17, falha: 0 }).resultado, 'erro');
    assert.equal(combate.resolver({ d20: 12, bonus: 8, defesa: 20, margem: 20, falha: 0 }).resultado, 'acerto');
    assert.equal(combate.resolver({ d20: 12, bonus: 8, defesa: 20, margem: 20, falha: 20, d10: 2 }).resultado, 'erro');
    assert.equal(combate.resolver({ d20: 12, bonus: 8, defesa: 20, margem: 20, falha: 20, d10: 3 }).resultado, 'acerto');
  });

  test('dano: o crítico multiplica só os dados da arma; RD, imunidade e vulnerabilidade (LR p. 82, 312–313)', () => {
    assert.equal(combate.textoDano('3d8+5', 3), 'Role 9d8 (crítico ×3) e some +5');
    assert.equal(combate.textoDano('1d8+1d6+2', 2), 'Role 2d8 + 1d6 (crítico ×2) e some +2');
    assert.equal(combate.textoDano('2d6'), 'Role 2d6');
    const c = combate.contaDano({ soma: 41, fixo: 5, tipo: 'balistico', rd: { balistico: 10 } });
    assert.deepEqual(c, { total: 46, final: 36, conta: '46 − RD balístico 10 = 36' });
    assert.equal(combate.contaDano({ soma: 7, fixo: 2, tipo: 'corte', rd: { fisico: 2 } }).final, 7);
    assert.equal(combate.contaDano({ soma: 7, fixo: 2, tipo: 'fogo', imunidades: ['fogo'] }).final, 0);
    assert.equal(combate.contaDano({ soma: 5, fixo: 1, tipo: 'energia', vulnerabilidades: ['energia'] }).final, 12);
  });

  test('consequência: machucado, 0 PV e dano massivo (LR p. 88)', () => {
    assert.deepEqual(combate.consequencia({ pv: 42, pvMax: 42 }, 36), { pv: 6, machucado: true, zerou: false, desmaiou: false, massivo: 21 });
    assert.deepEqual(combate.consequencia({ pv: 18, pvMax: 18 }, 21), { pv: 0, machucado: false, zerou: true, desmaiou: false, massivo: null });
    assert.equal(combate.consequencia({ pv: 30, pvMax: 40 }, 8).massivo, null);
  });
});

describe('combate: ataque, PE, condições e ritual', () => {
  const golpe = (quem: number, alvo: number, extra: Partial<combate.AtaqueConfirmado> = {}): Acao => ({
    tipo: 'ataque',
    ataque: {
      quem,
      alvo,
      arma: 'Faca',
      qual: 'padrao',
      teste: { dados: 2, bonus: 5, d20: 15, total: 20, defesa: 14 },
      situacoes: [],
      resultado: 'acerto',
      dano: { formula: '1d4+2', soma: 3, total: 5, tipo: 'corte', conta: '5', final: 5 },
      ...extra,
    },
  });

  test('o ataque gasta a padrão, escreve o teste e o dano e devolve os PV novos do alvo', () => {
    vitais.set(10, { pv: 12, pvMax: 12 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    const r = combate.aplicar(c, golpe(1, 10), ctx());
    assert.ok(r.ok);
    c = r.combate!;
    assert.deepEqual(r.vitais, [{ id: 10, pv: 7 }]);
    assert.equal(combate.acoesDe(c, 1).padrao, true);
    const linhas = c.registro.slice(-2);
    assert.equal(linhas[0].texto, 'Cora ataca Ocultista com Faca: d20 15, total 20 contra Defesa 14 — acertou.');
    assert.deepEqual(linhas[0].destaque, ['acertou']);
    assert.equal(linhas[1].texto, 'Dano 1d4+2: 5. Ocultista: PV 12 → 7.');
    assert.equal(c.ultimo?.resultado, 'acerto');
    assert.equal(recusa(c, golpe(1, 11)), 'A ação padrão já foi usada neste turno.');
  });

  test('crítico que zera: o alvo deita; o agente fica morrendo; o dano massivo pede Fortitude', () => {
    vitais.set(3, { pv: 18, pvMax: 18 });
    vitais.set(11, { pv: 40, pvMax: 40 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, golpe(1, 3, { resultado: 'critico', multiplicador: 3, dano: { formula: '6d6', soma: 21, total: 21, tipo: 'balistico', conta: '21', final: 21 } }));
    assert.ok(c.registro.some((l) => l.texto === 'Catarina cai inconsciente e morrendo (LR p. 88).'));
    assert.deepEqual(combate.participante(c, 3)?.condicoes, ['caido']);
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    // turno do mestre: um ser dele acerta o outro com dano massivo
    c = aplicar(c, golpe(10, 11, { dano: { formula: '4d8', soma: 20, total: 20, tipo: 'impacto', conta: '20', final: 20 } }));
    assert.ok(c.registro.some((l) => l.texto === 'Dano massivo: Acólito faz Fortitude DT 19; se falhar, vai a 0 PV (LR p. 88).'));
    // o teste fica pendente até o mestre dizer o resultado (20/10)
    assert.deepEqual(c.massivos, [{ alvo: 11, dt: 19, dano: 20 }]);
    // passou da DT: nada muda e a pendência some; empatar com a DT é falhar (o empate favorece o ataque, 20/10)
    const empatou = combate.aplicar(c, { tipo: 'massivo', alvo: 11, total: 19 }, ctx());
    assert.ok(empatou.ok);
    assert.match(empatou.combate!.registro.at(-1)!.texto, /total 19 contra DT 19 — falhou/);
    const passou = combate.aplicar(c, { tipo: 'massivo', alvo: 11, total: 20 }, ctx());
    assert.ok(passou.ok);
    assert.equal(passou.combate!.massivos, undefined);
    assert.deepEqual(passou.vitais ?? [], []);
    assert.equal(passou.combate!.registro.at(-1)!.texto, 'Acólito resiste ao dano massivo: Fortitude total 20 contra DT 19 — passou.');
    // falhou: vai a 0 PV e deita
    vitais.set(11, { pv: 20, pvMax: 40 });
    const falhou = combate.aplicar(c, { tipo: 'massivo', alvo: 11, total: 12, d20: 7 }, ctx());
    assert.ok(falhou.ok);
    assert.deepEqual(falhou.vitais, [{ id: 11, pv: 0 }]);
    assert.ok(combate.participante(falhou.combate!, 11)?.condicoes?.includes('caido'));
    assert.match(falhou.combate!.registro.at(-1)!.texto, /^Acólito não resiste ao dano massivo: Fortitude d20 7, total 12 contra DT 19 — falhou\. Vai a 0 PV/);
    assert.equal(recusa(falhou.combate!, { tipo: 'massivo', alvo: 11, total: 30 }), 'Não há teste de dano massivo pendente para esse ser.');
  });

  test('defesa especial: só agentes, uma por rodada; erro no corpo a corpo lembra o contra-ataque', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(recusa(c, golpe(1, 10, { reacao: 'esquiva' })), 'Ameaças não usam defesas especiais (LR p. 179).');
    c = aplicar(c, golpe(1, 2, { reacao: 'esquiva', resultado: 'erro', dano: undefined, contraAtaque: true }));
    assert.equal(combate.participante(c, 2)?.reacao, true);
    assert.ok(c.registro.some((l) => l.texto.startsWith('Tepes pode contra-atacar')));
  });

  test('PE: gasta, conta no turno e recusa quando não tem', () => {
    vitais.set(1, { pe: 3, peMax: 5 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    const r = combate.aplicar(c, { tipo: 'gastarPe', quem: 1, pe: 2, motivo: 'Ataque Especial' }, ctx());
    assert.ok(r.ok);
    c = r.combate!;
    assert.deepEqual(r.vitais, [{ id: 1, pe: 1 }]);
    assert.equal(combate.acoesDe(c, 1).pe, 2);
    assert.equal(recusa(c, { tipo: 'gastarPe', quem: 1, pe: 4, motivo: 'x' }), 'Cora só tem 3 PE.');
  });

  test('condições e ritual sustentado entram no começo do turno', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'condicao', id: 2, condicao: 'em-chamas', ativa: true });
    c = aplicar(c, { tipo: 'sustentar', id: 2, ritual: 'Amaldiçoar Arma' });
    assert.equal(recusa(c, { tipo: 'condicao', id: 2, condicao: 'voando', ativa: true }), 'Condição desconhecida.');
    c = aplicar(c, { tipo: 'passar' });
    const doTurno = c.registro.slice(-3).map((l) => l.texto);
    assert.deepEqual(doTurno, ['Vez de Tepes.', 'Tepes sustenta Amaldiçoar Arma: paga 1 PE agora ou o ritual acaba (LR p. 120).', 'Tepes está em chamas: sofre 1d6 de fogo (LR p. 310).']);
    c = aplicar(c, { tipo: 'condicao', id: 2, condicao: 'em-chamas', ativa: false });
    c = aplicar(c, { tipo: 'sustentar', id: 2, ritual: null });
    assert.equal(combate.participante(c, 2)?.condicoes, undefined);
    assert.equal(combate.participante(c, 2)?.sustenta, undefined);
  });

  test('PV, PE e SAN com motivo (socorro, cura): até o máximo', () => {
    vitais.set(3, { pv: 0, pvMax: 18 });
    const c = aplicar(montado(), { tipo: 'comecar' });
    const r = combate.aplicar(c, { tipo: 'vitais', id: 3, pv: 1, motivo: 'primeiros socorros' }, ctx());
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 3, pv: 1 }]);
    assert.equal(r.combate!.registro.at(-1)?.texto, 'Catarina: PV 0 → 1 (primeiros socorros).');
  });
});

describe('manobras: regras puras', () => {
  test('teste oposto: o maior vence; o empate favorece quem ataca (20/10); só um 20 natural vence (LR p. 75)', () => {
    assert.deepEqual(combate.resolverOposto({ d20: 12, bonus: 5 }, { d20: 9, bonus: 4 }), { totalA: 17, totalB: 13, vencedor: 'a', diferenca: 4 });
    assert.equal(combate.resolverOposto({ d20: 10, bonus: 2 }, { d20: 8, bonus: 4 }).vencedor, 'a');
    // 20 natural contra total maior
    assert.equal(combate.resolverOposto({ d20: 20, bonus: 0 }, { d20: 15, bonus: 10 }).vencedor, 'a');
    assert.equal(combate.resolverOposto({ d20: 20, bonus: 0 }, { d20: 20, bonus: 3 }).vencedor, 'b');
  });

  test('empurrão em casas (1,5 m + 1,5 m a cada 5); tamanho; dano no objeto (LR p. 85, 90, 179)', () => {
    assert.deepEqual([0, 4, 5, 9, 12].map(combate.casasEmpurrao), [2, 2, 4, 4, 6]);
    assert.equal(combate.empurraUmQuadrado(4), false);
    assert.equal(combate.empurraUmQuadrado(5), true);
    assert.equal(combate.MOD_TAMANHO.grande, 2);
    assert.equal(combate.MOD_TAMANHO.minusculo, -5);
    const porta = combate.objeto('porta-madeira')!;
    assert.deepEqual(combate.danoNoObjeto(12, porta), { final: 7, quebrou: false, conta: '12 − RD 5 = 7 contra 20 PV' });
    assert.equal(combate.danoNoObjeto(30, porta).quebrou, true);
  });
});

describe('combate: manobras', () => {
  const man = (quem: number, alvo: number, manobra: combate.ManobraId, extra: Partial<combate.ManobraConfirmada> = {}): Acao => ({
    tipo: 'manobra',
    manobra: {
      quem,
      alvo,
      manobra,
      qual: 'padrao',
      teste: { quem: { dados: 2, bonus: 5, d20: 15, total: 20 }, alvo: { dados: 1, bonus: 2, d20: 10, total: 12 } },
      venceu: true,
      diferenca: 8,
      modificadores: [],
      ...extra,
    },
  });
  /** passa a vez até chegar em quem (nome) */
  const ate = (c: Combate, nome: string) => {
    for (let i = 0; i < 10 && vez(c) !== nome; i++) c = aplicar(c, { tipo: 'passar' });
    return c;
  };

  test('agarrar: gasta a padrão, o alvo fica agarrado e o turno lembra; soltar-se desfaz (LR p. 85)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, man(1, 10, 'agarrar'));
    assert.equal(combate.acoesDe(c, 1).padrao, true);
    assert.equal(combate.participante(c, 1)?.agarra, 10);
    assert.deepEqual(combate.participante(c, 10)?.condicoes, ['agarrado']);
    const [teste, efeito] = c.registro.slice(-2);
    assert.equal(teste.texto, 'Cora tenta agarrar Ocultista: teste de manobra d20 15, total 20 contra d20 10, total 12 — venceu por 8.');
    assert.deepEqual(teste.destaque, ['venceu por 8']);
    assert.match(efeito.texto, /^Ocultista fica agarrado por Cora: desprevenido e imóvel/);
    assert.equal(recusa(c, man(1, 11, 'derrubar')), 'A ação padrão já foi usada neste turno.');
    c = ate(c, 'Turno do mestre');
    assert.ok(c.registro.some((l) => l.texto === 'Ocultista está agarrado por Cora: soltar-se é ação padrão com teste de manobra (LR p. 85).'));
    assert.match(recusa(c, man(11, 1, 'soltarse')), /Cora não está agarrando Acólito/);
    c = aplicar(c, man(10, 1, 'soltarse'));
    assert.equal(combate.participante(c, 1)?.agarra, undefined);
    assert.equal(combate.participante(c, 10)?.condicoes, undefined);
    assert.equal(c.registro.at(-1)?.texto, 'Ocultista se solta de Cora.');
  });

  test('esmagar só com o alvo agarrado: dano de impacto do desarmado; soltar é ação livre', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.match(recusa(c, man(1, 10, 'esmagar')), /Cora não está agarrando Ocultista/);
    c = aplicar(c, man(1, 10, 'agarrar'));
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    const r = combate.aplicar(c, man(1, 10, 'esmagar', { dano: { formula: '1d3+2', soma: 2, total: 4, tipo: 'impacto', conta: '4', final: 4, naoLetal: true } }), ctx());
    assert.ok(r.ok);
    // o não letal não tira PV: fica à parte e soma para desmaiar (LR p. 88)
    assert.deepEqual(r.vitais, []);
    c = r.combate!;
    assert.equal(combate.participante(c, 10)?.naoLetal, 4);
    assert.equal(c.registro.at(-1)?.texto, 'Dano não letal 1d3+2: 4. Ocultista: não letal 0 → 4 (PV 20).');
    c = aplicar(c, { tipo: 'soltar', id: 1 });
    assert.equal(combate.participante(c, 10)?.condicoes, undefined);
    assert.equal(c.registro.at(-1)?.texto, 'Cora solta Ocultista (ação livre, LR p. 85).');
    assert.equal(recusa(c, { tipo: 'soltar', id: 1 }), 'Esse ser não está agarrando ninguém.');
  });

  test('derrubar deixa caído; empurrar diz a distância; empate é recusado; quem resiste não sofre nada', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    const empate = { quem: { dados: 1, bonus: 0, d20: 10, total: 10 }, alvo: { dados: 1, bonus: 0, d20: 10, total: 10 } };
    assert.equal(recusa(c, man(1, 10, 'derrubar', { teste: empate, venceu: false, diferenca: 0 })), 'Empate: os dois rolam de novo (LR p. 75).');
    c = aplicar(c, man(1, 10, 'derrubar', { diferenca: 6 }));
    assert.deepEqual(combate.participante(c, 10)?.condicoes, ['caido']);
    assert.match(c.registro.at(-1)!.texto, /^Ocultista cai e é empurrado 1 quadrado/);
    c = aplicar(c, { tipo: 'passar' });
    c = aplicar(c, man(2, 11, 'empurrar', { diferenca: 11, empurrao: 6 }));
    assert.equal(c.registro.at(-1)?.texto, 'Acólito é empurrado 4,5 m; Tepes pode gastar uma ação de movimento para ir junto (LR p. 85).');
    c = aplicar(c, { tipo: 'passar' });
    // no turno do mestre, o Acólito tenta desarmar Catarina e perde
    c = aplicar(c, man(11, 3, 'desarmar', { venceu: false, diferenca: 3 }));
    assert.equal(c.registro.at(-1)?.texto, 'Acólito tenta desarmar Catarina: teste de manobra d20 15, total 20 contra d20 10, total 12 — Catarina venceu.');
  });

  test('atropelar na investida é livre; perdendo, o alvo impede o avanço (LR p. 86)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, man(1, 10, 'atropelar', { qual: 'livre' }));
    assert.equal(combate.acoesDe(c, 1).padrao, false);
    assert.deepEqual(combate.participante(c, 10)?.condicoes, ['caido']);
    c = aplicar(c, man(1, 11, 'atropelar', { qual: 'livre', venceu: false }));
    assert.equal(c.registro.at(-1)?.texto, 'Acólito fica de pé e impede o avanço de Cora (LR p. 86).');
  });

  test('quem sai do combate larga e é largado; tirar o agarrado à mão também solta', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, man(1, 10, 'agarrar'));
    c = aplicar(c, { tipo: 'condicao', id: 10, condicao: 'agarrado', ativa: false });
    assert.equal(combate.participante(c, 1)?.agarra, undefined);
    c = ate(aplicar(c, { tipo: 'passar' }), 'Cora');
    c = aplicar(c, man(1, 10, 'agarrar'));
    c = aplicar(c, { tipo: 'sair', id: 1, motivo: 'saiu' });
    assert.equal(combate.participante(c, 10)?.condicoes, undefined);
  });
});

describe('ameaças do livro (LR p. 182–289)', () => {
  test('o catálogo inteiro vira ficha rápida sem perder número', () => {
    const ids = new Set<string>();
    for (const a of combate.AMEACAS_LIVRO) {
      assert.ok(!ids.has(a.id), `id repetido: ${a.id}`);
      ids.add(a.id);
      assert.ok(a.pagina >= 182 && a.pagina <= 289, `${a.id}: página ${a.pagina}`);
      assert.ok(a.pv > 0 && a.defesa > 0, a.id);
      const f = combate.fichaDoLivro(a);
      assert.deepEqual(combate.lerFichaAmeaca(f), f, `${a.id}: a ficha passa pela leitura igual`);
      for (const x of a.ataques) assert.match(x.dano, /\d/, `${a.id}: dano de ${x.nome}`);
    }
    assert.ok(combate.AMEACAS_LIVRO.length >= 70);
    assert.equal(combate.GRUPOS_LIVRO.reduce((t, g) => t + g.ameacas.length, 0), combate.AMEACAS_LIVRO.length);
  });

  test('a ficha do livro: tipo com o elemento, tamanho, ataque ×2, presença e página', () => {
    const f = combate.fichaDoLivro(combate.ameacaLivro('aberracao-de-carne')!);
    assert.equal(f.tipo, 'Criatura de Sangue');
    assert.equal(f.vd, 40);
    assert.equal(f.tamanho, 'grande');
    assert.equal(f.elemento, 'sangue');
    assert.deepEqual(f.presenca, { nex: 25, dt: 15, dano: '3d6' });
    assert.equal(f.ataques[0].vezes, 2);
    assert.deepEqual(f.vulnerabilidades, ['morte']);
    assert.equal(f.livro, 'aberracao-de-carne');
    assert.match(f.notas ?? '', /^LR p\. 182/);
    // pessoa: sem elemento, tipo como no livro
    const p = combate.fichaDoLivro(combate.ameacaLivro('capanga')!);
    assert.equal(p.tipo, 'Pessoa');
    assert.equal(p.elemento, undefined);
  });

  test('imune a dano = a todo dano; imune a físico = aos quatro das armas (LR p. 180, 312)', () => {
    assert.deepEqual(combate.contaDano({ soma: 20, fixo: 5, tipo: 'fogo', imunidades: ['todos'] }), { total: 25, final: 0, conta: 'imune a todo dano: 0' });
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'balistico', imunidades: ['fisico'] }).final, 0);
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'fogo', imunidades: ['fisico'] }).final, 20);
    // as criaturas de Medo com enigma ficam imunes a todo dano
    const diabo = combate.ameacaLivro('o-diabo')!;
    assert.ok(diabo.enigma);
    assert.ok(diabo.imunidades.includes('todos'));
  });

  test('ataque ×2: dois ataques na mesma ação padrão; o terceiro é recusado (LR p. 179)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    const golpe = (): Acao => ({
      tipo: 'ataque',
      ataque: { quem: 10, alvo: 1, arma: 'Pancada', qual: 'padrao', vezes: 2, teste: { dados: 3, bonus: 10, d20: 12, total: 22, defesa: 15 }, situacoes: [], resultado: 'erro' },
    });
    c = aplicar(c, golpe());
    assert.equal(combate.acoesDe(c, 10).golpes, 1);
    c = aplicar(c, golpe());
    assert.equal(c.registro.at(-1)?.texto, 'Ocultista ataca Cora com Pancada (outro ataque da mesma ação): d20 12, total 22 contra Defesa 15 — errou.');
    assert.equal(recusa(c, golpe()), 'A ação padrão já foi usada neste turno.');
  });

  test('presença perturbadora: lembrete ao começar; com várias, a de maior VD e +1d6 por criatura a mais', () => {
    const fichas = new Map<number, combate.FichaAmeaca>([
      [10, { ...combate.fichaDoLivro(combate.ameacaLivro('zumbi-de-sangue')!) }],
      [11, { ...combate.fichaDoLivro(combate.ameacaLivro('aberracao-de-carne')!) }],
    ]);
    const r = combate.aplicar(montado(), { tipo: 'comecar' }, { ...ctx(), ameaca: (id) => fichas.get(id) ?? null });
    assert.ok(r.ok);
    const linha = r.combate!.registro.find((l) => l.texto.startsWith('Presença perturbadora'));
    assert.equal(linha?.texto, 'Presença perturbadora (2 criaturas; vale a de Acólito): quem a vê faz Vontade DT 15; falhou, 3d6+1d6 de dano mental; passou, metade. NEX 25% ou mais é imune (LR p. 180; uma vez por cena, DC-15).');
  });
});

describe('ritual: regras puras (LR p. 117–121)', () => {
  const r = { elemento: 'sangue' as const, discente: { custoExtra: 2, circulo: 2 as const }, verdadeiro: { custoExtra: 5, circulo: 3 as const, afinidade: true } };

  test('forma: custo e requisitos (círculo e afinidade)', () => {
    assert.deepEqual((['basica', 'discente', 'verdadeira'] as const).map((f) => combate.custoDaForma(3, r, f)), [3, 5, 8]);
    assert.equal(combate.formaLiberada(r, 'discente', 1, null), 'Pede conjurar rituais de 2º círculo.');
    assert.equal(combate.formaLiberada(r, 'verdadeira', 3, 'morte'), 'Pede afinidade com o elemento do ritual.');
    assert.equal(combate.formaLiberada(r, 'verdadeira', 3, 'sangue'), null);
    assert.equal(combate.formaLiberada({ elemento: 'medo' }, 'discente', 4, null), 'O ritual não tem a forma discente.');
  });

  test('resistência do cabeçalho; 20 natural passa', () => {
    assert.deepEqual(combate.lerResistencia('Vontade parcial'), { teste: 'vontade', efeito: 'parcial' });
    assert.deepEqual(combate.lerResistencia('Fortitude reduz à metade'), { teste: 'fortitude', efeito: 'metade' });
    assert.deepEqual(combate.lerResistencia('Vontade anula (veja texto)'), { teste: 'vontade', efeito: 'anula' });
    assert.deepEqual(combate.lerResistencia('Vontade parcial, Fortitude parcial'), { teste: 'vontade', efeito: 'parcial' });
    assert.equal(combate.lerResistencia('veja texto'), null);
    assert.equal(combate.passouResistencia(20, 5, 30), true);
    assert.equal(combate.passouResistencia(10, 15, 16), false);
  });

  test('elemento contra a criatura: vence = −2d20 e vulnerável; o mesmo = +2d20; Medo é neutro (LR p. 118)', () => {
    assert.deepEqual(combate.elementoContra('sangue', 'conhecimento'), { dados: -2, vulneravel: true, texto: 'o elemento do ritual vence o dela: −2d20 e vulnerável' });
    assert.equal(combate.elementoContra('morte', 'sangue')?.vulneravel, true);
    assert.equal(combate.elementoContra('morte', 'morte')?.dados, 2);
    assert.equal(combate.elementoContra('sangue', 'energia'), null);
    assert.equal(combate.elementoContra('medo', 'sangue'), null);
  });

  test('concentração pela condição; Custo do Paranormal (LR p. 120–121)', () => {
    assert.deepEqual(combate.dtConcentracao(['caido'], 3), { dt: 18, motivo: 'condição ruim (caido)' });
    assert.equal(combate.dtConcentracao(['caido', 'agarrado'], 3)?.dt, 23);
    assert.equal(combate.dtConcentracao([], 3), null);
    assert.deepEqual(combate.custoParanormal(6, true, 'discente'), { medo: true, mental: 6, sanPermanente: 2 });
    assert.deepEqual(combate.custoParanormal(6, false, 'basica'), { medo: false, dt: 21 });
    assert.deepEqual(combate.resultadoCusto(3, 10, 16), { passou: false, mental: 3, sanPermanente: 0 });
    assert.deepEqual(combate.resultadoCusto(3, 5, 12), { passou: false, mental: 3, sanPermanente: 1 });
    assert.equal(combate.resultadoCusto(3, 20, 5).passou, true);
  });
});

describe('combate: ritual', () => {
  const rit = (quem: number, extra: Partial<combate.RitualConfirmado> = {}): Acao => ({ tipo: 'ritual', ritual: { quem, ritual: 'Decadência', forma: 'basica', qual: 'padrao', pe: 3, dt: 16, alvos: [], ...extra } });
  const naVezDeTepes = () => aplicar(aplicar(montado(), { tipo: 'comecar' }), { tipo: 'passar' });

  test('gasta a execução e o PE; resistência e dano em cada alvo; o Custo do Paranormal tira SAN', () => {
    const c0 = naVezDeTepes();
    const r = combate.aplicar(
      c0,
      rit(2, {
        alvos: [{ id: 10, teste: { nome: 'vontade', dados: 1, bonus: 2, d20: 8, total: 10, passou: false }, dano: { formula: '2d8+2', soma: 8, total: 10, tipo: 'morte', conta: '10', final: 10 } }],
        custo: { dt: 18, d20: 5, total: 12, passou: false },
        mental: 3,
        sanPermanente: 1,
      }),
      ctx(),
    );
    assert.ok(r.ok);
    const c = r.combate!;
    assert.deepEqual(r.vitais, [{ id: 10, pv: 10 }, { id: 2, pe: 2, san: 17 }]);
    assert.deepEqual(combate.acoesDe(c, 2), { padrao: true, movimento: false, completa: false, pe: 3 });
    assert.deepEqual(
      c.registro.slice(-6).map((l) => l.texto),
      [
        'Tepes conjura Decadência (básica, 3 PE, DT 16).',
        'Ocultista: Vontade d20 8, total 10 contra DT 16 — falhou.',
        'Dano 2d8+2: 10. Ocultista: PV 20 → 10.',
        'Dano massivo: Ocultista faz Fortitude DT 17; se falhar, vai a 0 PV (LR p. 88).',
        'Custo do Paranormal: Ocultismo d20 5, total 12 contra DT 18 — falhou.',
        'Tepes sofre 3 de dano mental e perde 1 de SAN para sempre: ajuste o máximo na ficha (LR p. 121).',
      ],
    );
    assert.equal(recusa(c, rit(2)), 'A ação padrão já foi usada neste turno.');
  });

  test('concentração que falha: o ritual não sai e os PE se perdem', () => {
    const r = combate.aplicar(naVezDeTepes(), rit(2, { concentracao: { dt: 18, d20: 3, total: 6, passou: false }, alvos: [{ id: 10, dano: { formula: '2d8', soma: 9, total: 9, tipo: 'morte', conta: '9', final: 9 } }] }), ctx());
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 2, pe: 2 }]);
    assert.equal(r.combate!.registro.at(-1)?.texto, 'O ritual não sai, e os PE se perdem (LR p. 120).');
  });

  test('Medo: dano mental e SAN para sempre sem teste; execução livre não gasta ação; sustentado; sem PE, recusa', () => {
    let c = naVezDeTepes();
    const r = combate.aplicar(c, rit(2, { ritual: 'Cinerária', qual: 'livre', pe: 1, medo: true, mental: 1, sanPermanente: 1, sustentado: true }), ctx());
    assert.ok(r.ok);
    c = r.combate!;
    assert.deepEqual(r.vitais, [{ id: 2, pe: 4, san: 19 }]);
    assert.equal(combate.acoesDe(c, 2).padrao, false);
    assert.equal(combate.participante(c, 2)?.sustenta, 'Cinerária');
    assert.ok(c.registro.some((l) => l.texto === 'Ritual de Medo: Tepes sofre 1 de dano mental e perde 1 de SAN para sempre (LR p. 121).'));
    vitais.set(2, { pe: 1 });
    assert.equal(recusa(c, rit(2)), 'Tepes só tem 1 PE.');
  });
});

describe('ataque no servidor', () => {
  let hotel: Hotel;
  let gm: Peer;
  let mesa: Peer;

  beforeEach(() => {
    const db = seedDb();
    upgradeDb(db);
    hotel = new Hotel({ db, persist: false, timers: false });
    const escritorio = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
    gm = new Peer(hotel);
    gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
    gm.send({ t: 'join', roomId: escritorio });
    mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: escritorio });
    hotel.pushNow();
  });

  const pecas = () => gm.last('session')!.session.characters;

  test('o dano vai para a peça e o desfazer devolve os PV', () => {
    const [a, b] = pecas();
    gm.send({ t: 'vitals', tokenId: -b.id, key: 'pv', max: 30 });
    gm.send({ t: 'vitals', tokenId: -b.id, key: 'pv', value: 30 });
    gm.combate({ tipo: 'abrir' });
    gm.combate({ tipo: 'participante', id: a.id, lado: 'agente', iniciativa: 15 });
    gm.combate({ tipo: 'participante', id: b.id, lado: 'inimigo' });
    gm.combate({ tipo: 'iniciativaMestre', valor: 10 });
    gm.combate({ tipo: 'comecar' });
    gm.combate({
      tipo: 'ataque',
      ataque: {
        quem: a.id,
        alvo: b.id,
        arma: 'Revólver',
        qual: 'padrao',
        teste: { dados: 2, bonus: 3, d20: 19, total: 22, defesa: 15 },
        situacoes: [],
        resultado: 'critico',
        multiplicador: 3,
        dano: { formula: '6d6', soma: 20, total: 20, tipo: 'balistico', conta: '20', final: 20 },
      },
    });
    hotel.pushNow();
    const pv = () => pecas().find((p) => p.id === b.id)!.vitals!.pv;
    assert.equal(pv(), 10);
    assert.equal(gm.last('combate')!.combate!.ultimo?.resultado, 'critico');
    assert.equal(mesa.last('combate')!.combate!.ultimo?.resultado, 'critico');
    gm.combate({ tipo: 'desfazer' });
    hotel.pushNow();
    assert.equal(pv(), 30);
    assert.equal(gm.last('combate')!.combate!.ultimo, undefined);
  });

  test('a ficha da ameaça fica na campanha e só o mestre recebe', () => {
    const [, b] = pecas();
    gm.send({ t: 'ameaca', tokenId: b.id, ficha: { ...combate.fichaAmeacaVazia(), tipo: 'Pessoa', vd: 40, defesa: 15, rd: { balistico: 10, voar: 3 } } as unknown as combate.FichaAmeaca });
    hotel.pushNow();
    const f = gm.last('combate')!.ameacas?.[String(b.id)];
    assert.equal(f?.defesa, 15);
    assert.deepEqual(f?.rd, { balistico: 10 });
    assert.equal(mesa.last('combate')!.ameacas, undefined);
    mesa.send({ t: 'ameaca', tokenId: b.id, ficha: null });
    assert.match(mesa.last('error')?.msg ?? '', /mestre/);
    gm.send({ t: 'ameaca', tokenId: b.id, ficha: null });
    hotel.pushNow();
    assert.equal(gm.last('combate')!.ameacas?.[String(b.id)], undefined);
  });
});

describe('MAPA: anotações na planta e área da cena', () => {
  test('o mestre cria, move, muda e apaga a anotação; a mesa não mexe; a área vai para o cartão da sala', () => {
    const db = seedDb();
    upgradeDb(db);
    const hotel = new Hotel({ db, persist: false, timers: false });
    const sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
    const gm = new Peer(hotel);
    gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
    gm.send({ t: 'join', roomId: sala });
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'join', roomId: sala });
    const notas = () => {
      hotel.pushNow();
      return gm.last('campaign')!.state.notas ?? [];
    };
    gm.send({ t: 'planNota', andar: '', texto: '  Acesso Restrito  ', x: 3.25, y: 4 });
    let n = notas();
    assert.equal(n.length, 1);
    assert.deepEqual({ ...n[0], id: 0 }, { id: 0, andar: '', texto: 'Acesso Restrito', x: 3.3, y: 4 });
    gm.send({ t: 'planNota', id: n[0].id, x: 10, y: 11 });
    gm.send({ t: 'planNota', id: n[0].id, texto: 'Instalações Técnicas' });
    n = notas();
    assert.deepEqual([n[0].texto, n[0].x, n[0].y], ['Instalações Técnicas', 10, 11]);
    mesa.send({ t: 'planNota', id: n[0].id, apagar: true });
    assert.equal(notas().length, 1, 'a mesa não mexe');
    gm.send({ t: 'planNota', id: n[0].id, texto: '' });
    assert.equal(notas().length, 0, 'texto vazio apaga');
    // a área da cena, pela configuração
    const r = hotel.db.rooms.find((x) => x.id === sala)!;
    gm.send({ t: 'roomSettings', name: r.name, description: r.description, darkness: r.darkness, publicBuild: r.publicBuild, area: 'Área técnica' });
    assert.equal(gm.last('roomUpdate')?.room.area, 'Área técnica');
    gm.send({ t: 'roomSettings', name: r.name, description: r.description, darkness: r.darkness, publicBuild: r.publicBuild, area: '' });
    assert.equal(gm.last('roomUpdate')?.room.area, undefined);
  });
});

describe('correções da conferência de 01/10 (Veríssimo): o combate', () => {
  const dano = (final: number, tipo = 'impacto', extra: Partial<combate.DanoConfirmado> = {}): combate.DanoConfirmado => ({ formula: '1d6', soma: final, total: final, tipo, conta: String(final), final, ...extra });
  const golpe = (quem: number, alvo: number, d: combate.DanoConfirmado | undefined, extra: Partial<combate.AtaqueConfirmado> = {}): Acao => ({
    tipo: 'ataque',
    ataque: { quem, alvo, arma: 'Golpe', qual: 'padrao', teste: { dados: 1, bonus: 5, d20: 15, total: 20, defesa: 10 }, situacoes: [], resultado: 'acerto', ...(d ? { dano: d } : {}), ...extra },
  });
  const criatura = (): combate.FichaAmeaca => ({ ...combate.fichaAmeacaVazia(), tipo: 'Criatura de Sangue', elemento: 'sangue' });
  const comAmeaca = (fichas: Record<number, combate.FichaAmeaca>): combate.Contexto => ({ ...ctx(), ameaca: (id) => fichas[id] ?? null });
  const texto = (c: Combate) => c.registro.map((l) => l.texto);

  test('V-1: dano mental tira SAN, não PV; a SAN 0, enlouquecendo (LR p. 82, 88)', () => {
    vitais.set(2, { san: 6, sanMax: 20 });
    const c = aplicar(montado(), { tipo: 'comecar' });
    const r = combate.aplicar(c, golpe(1, 2, dano(7, 'mental')), ctx());
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 2, san: 0 }]);
    assert.ok(texto(r.combate!).includes('Dano mental 1d6: 7. Tepes: SAN 6 → 0 (enlouquecendo).'));
    assert.ok(texto(r.combate!).some((t) => t.startsWith('Tepes fica enlouquecendo')));
  });

  test('V-2: não letal fica à parte dos PV, desmaia sem morrendo e o mestre tira na cura (LR p. 88)', () => {
    vitais.set(3, { pv: 10, pvMax: 20 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, golpe(1, 3, dano(6, 'impacto', { naoLetal: true })));
    assert.equal(combate.participante(c, 3)?.naoLetal, 6);
    assert.equal(combate.participante(c, 3)?.condicoes, undefined);
    c = aplicar(aplicar(c, { tipo: 'passar' }), golpe(2, 3, dano(5, 'impacto', { naoLetal: true })));
    assert.equal(combate.participante(c, 3)?.naoLetal, 11);
    assert.deepEqual(combate.participante(c, 3)?.condicoes, ['inconsciente', 'caido']);
    assert.ok(texto(c).includes('Catarina cai inconsciente: o dano não letal passou dos PV, sem morrendo (LR p. 88).'));
    // o turno dela começa sem contar morrendo: os PV continuam 10
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(vez(c), 'Catarina');
    assert.equal(combate.participante(c, 3)?.morrendo, 0);
    // a cura tira primeiro o não letal: o mestre ajusta, e ela acorda
    c = aplicar(c, { tipo: 'naoLetal', id: 3, valor: 4, motivo: 'cura' });
    assert.equal(combate.participante(c, 3)?.naoLetal, 4);
    assert.deepEqual(combate.participante(c, 3)?.condicoes, ['caido']);
    assert.ok(texto(c).includes('Catarina acorda (continua caído).'));
    c = aplicar(c, { tipo: 'encerrar' });
    assert.ok(texto(c).some((t) => t.startsWith('Dano não letal que fica até a cura: Catarina 4')));
  });

  test('V-2: o letal com o não letal acumulado desmaia sem morrendo; o massivo do não letal não deixa morrendo', () => {
    assert.deepEqual(combate.consequencia({ pv: 10, pvMax: 20 }, 5, 6), { pv: 5, machucado: true, zerou: false, desmaiou: true, massivo: null });
    assert.deepEqual(combate.consequenciaNaoLetal({ pv: 20, pvMax: 20 }, 0, 10), { naoLetal: 10, desmaiou: false, massivo: 17 });
    assert.equal(combate.previaDano({ pv: 20, pvMax: 20, san: 20, sanMax: 20 }, 6, { tipo: 'mental' })?.texto, 'SAN 20 → 14');
  });

  test('V-3: quem atrasa não começa o turno de novo; quem já agiu não atrasa (LR p. 87–88)', () => {
    vitais.set(1, { pv: 0 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    assert.equal(combate.participante(c, 1)?.morrendo, 1);
    c = aplicar(c, { tipo: 'atrasar', valor: 17 });
    assert.equal(vez(c), 'Tepes');
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Cora');
    assert.equal(combate.participante(c, 1)?.morrendo, 1, 'o turno já tinha começado nesta rodada');
    assert.equal(c.registro.at(-1)?.texto, 'Cora age agora (tinha atrasado a vez).');
    // na rodada seguinte, conta de novo (a Iniciativa dela ficou em 17, depois do Tepes)
    for (let i = 0; i < 4; i++) c = aplicar(c, { tipo: 'passar' });
    assert.equal(c.rodada, 2);
    assert.equal(vez(c), 'Cora');
    assert.equal(combate.participante(c, 1)?.morrendo, 2);
    vitais.clear();
    let d = aplicar(montado(), { tipo: 'comecar' });
    d = aplicar(d, { tipo: 'declarar', qual: 'padrao', texto: 'abre a porta', quem: 1 });
    assert.match(recusa(d, { tipo: 'atrasar', valor: 17 }), /atrasar é agir mais tarde/);
  });

  test('V-4: a falha soma até 75%, que é 1 a 3 no d4 (LR p. 89, 313)', () => {
    assert.deepEqual(combate.dadoDaFalha(20), { faces: 10, ate: 2 });
    assert.deepEqual(combate.dadoDaFalha(70), { faces: 10, ate: 7 });
    assert.deepEqual(combate.dadoDaFalha(75), { faces: 4, ate: 3 });
    const r = (d10: number) => combate.resolver({ d20: 15, bonus: 5, defesa: 10, margem: 20, falha: 75, d10 });
    assert.equal(r(3).falhou, true);
    assert.equal(r(4).falhou, false);
    const c = aplicar(aplicar(montado(), { tipo: 'comecar' }), golpe(1, 10, undefined, { resultado: 'erro', falha: { chance: 75, d10: 2, falhou: true } }));
    assert.ok(texto(c).some((t) => t.includes('falha 75%: d4 2, falhou')));
  });

  test('V-5: RD e imunidade paranormal valem nos cinco elementos; o mental fica de fora (LR p. 82)', () => {
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'sangue', rd: { paranormal: 10 } }).final, 10);
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'medo', rd: { paranormal: 10 } }).final, 10);
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'mental', rd: { paranormal: 10 } }).final, 20);
    assert.equal(combate.contaDano({ soma: 20, fixo: 0, tipo: 'morte', imunidades: ['paranormal'] }).final, 0);
  });

  test('V-7: a criatura é imune a dano mental, a condições mentais e de medo e a rituais de Medo (LR p. 180)', () => {
    assert.deepEqual(combate.imunidadesDaAmeaca(criatura()), ['mental']);
    assert.deepEqual(combate.imunidadesDaAmeaca(combate.fichaAmeacaVazia()), []);
    const fichas = { 10: criatura() };
    let c = aplicar(montado(), { tipo: 'comecar' });
    const r = combate.aplicar(c, { tipo: 'condicao', id: 10, condicao: 'abalado', ativa: true }, comAmeaca(fichas));
    assert.equal(r.ok, false);
    assert.match((r as { motivo: string }).motivo, /imune a condições de medo/);
    assert.ok(combate.aplicar(c, { tipo: 'condicao', id: 11, condicao: 'abalado', ativa: true }, comAmeaca(fichas)).ok, 'a pessoa fica abalada');
    c = aplicar(c, { tipo: 'passar' });
    const rit = combate.aplicar(
      c,
      { tipo: 'ritual', ritual: { quem: 2, ritual: 'Lâmina do Medo', elemento: 'medo', forma: 'basica', qual: 'padrao', pe: 1, alvos: [{ id: 10, dano: dano(30, 'medo') }, { id: 11, dano: dano(8, 'medo') }] } },
      comAmeaca(fichas),
    );
    assert.ok(rit.ok);
    assert.deepEqual(rit.vitais, [{ id: 11, pv: 12 }, { id: 2, pe: 4 }]);
    assert.ok(texto(rit.combate!).includes('Ocultista é criatura: imune a rituais de Medo (LR p. 180).'));
  });

  test('V-9, V-10, V-11: as ameaças do livro', () => {
    const a = (id: string) => combate.ameacaLivro(id)!;
    // "–2O" é atributo 0: 2d20, fica o pior (LR p. 75)
    assert.equal(a('anarquico').fortitude.dados, 0);
    assert.equal(a('parasita-de-culpa').iniciativa?.dados, 0);
    assert.equal(combate.lerFichaAmeaca({ ...combate.fichaAmeacaVazia(), vontade: { dados: -2, bonus: 0 } })!.vontade.dados, 0);
    // Aracnasita: imune a dano até o enigma; o fogo tira a imunidade (LR p. 209)
    const ar = combate.fichaDoLivro(a('aracnasita'));
    assert.ok(ar.imunidades.includes('todos'));
    assert.ok(ar.imunidades.includes('mental'));
    assert.match(ar.notas ?? '', /fogo/);
    // Múmia Xipófaga: Vomitar Lodo dá 3d6 de Morte e 1d8 mental (LR p. 221)
    assert.deepEqual(a('mumia-xipofaga').ataques.find((x) => x.nome === 'Vomitar Lodo')?.extra, { dano: '1d8', tipo: 'mental' });
  });

  test('V-11: o dano a mais de outro tipo vai junto: Morte nos PV, mental na SAN', () => {
    vitais.set(1, { pv: 30, pvMax: 30, san: 15, sanMax: 15 });
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(aplicar(c, { tipo: 'passar' }), { tipo: 'passar' });
    assert.equal(vez(c), 'Turno do mestre');
    const r = combate.aplicar(c, golpe(10, 1, dano(9, 'morte'), { danoExtra: dano(5, 'mental') }), ctx());
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 1, pv: 21, san: 10 }]);
  });

  test('V-21: o mínimo de 1 PE vale depois da forma (Mestre em Elemento e Arma Atroz discente: 2, LR p. 78, 121)', () => {
    const r = { discente: { custoExtra: 2 } };
    assert.equal(combate.custoDaForma(1, r, 'discente', -1), 2);
    assert.equal(combate.custoDaForma(1, r, 'basica', -1), 1);
  });

  test('V-114: desmaiar pelo não letal não tira o dano massivo do golpe letal (LR p. 88)', () => {
    assert.deepEqual(combate.consequencia({ pv: 12, pvMax: 20 }, 10, 6), { pv: 2, machucado: true, zerou: false, desmaiou: true, massivo: 17 });
  });

  test('V-116: quem conjura na própria área sofre o dano mental do ritual e o Custo do Paranormal (LR p. 121)', () => {
    const c = aplicar(aplicar(montado(), { tipo: 'comecar' }), { tipo: 'passar' });
    const r = combate.aplicar(
      c,
      { tipo: 'ritual', ritual: { quem: 2, ritual: 'Presença do Medo', elemento: 'medo', forma: 'basica', qual: 'padrao', pe: 2, alvos: [{ id: 2, dano: dano(4, 'mental') }], medo: true, mental: 3, sanPermanente: 1 } },
      ctx(),
    );
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 2, san: 13, pe: 3 }]);
  });

  test('V-117: pagar o sustentado não impede atrasar; o PE gasto volta junto com a vez (LR p. 87, 120)', () => {
    let c = aplicar(montado(), { tipo: 'comecar' });
    c = aplicar(c, { tipo: 'gastarPe', quem: 1, pe: 1, motivo: 'sustentar Decadência' });
    c = aplicar(c, { tipo: 'atrasar', valor: 17 });
    assert.equal(combate.acoesDe(c, 2).pe ?? 0, 0, 'o Tepes começa com o turno livre');
    c = aplicar(c, { tipo: 'passar' });
    assert.equal(vez(c), 'Cora');
    assert.equal(combate.acoesDe(c, 1).pe, 1, 'o PE do sustentado conta no mesmo turno');
  });

  test('ritual com dois danos: o mental vai para a SAN e o de Medo para os PV (Presença do Medo, LR p. 139)', () => {
    const c = aplicar(aplicar(montado(), { tipo: 'comecar' }), { tipo: 'passar' });
    const r = combate.aplicar(
      c,
      { tipo: 'ritual', ritual: { quem: 2, ritual: 'Presença do Medo', elemento: 'medo', forma: 'basica', qual: 'padrao', pe: 2, alvos: [{ id: 11, dano: dano(5, 'mental'), danoExtra: dano(6, 'medo') }] } },
      ctx(),
    );
    assert.ok(r.ok);
    assert.deepEqual(r.vitais, [{ id: 11, san: 15, pv: 14 }, { id: 2, pe: 3 }]);
  });

  test('V-22: o teste do ataque guarda os dados perdidos à parte (LR p. 11)', () => {
    // Agi 2 caída (−2d20): rola 4d20 e fica o pior
    const t = combate.montarTeste({ dados: 2, bonus: 5, defesaBase: 12, distancia: false, situacoes: ['atacanteCaido'] });
    assert.deepEqual({ dados: t.dados, penalidade: t.penalidade }, { dados: 2, penalidade: -2 });
    assert.equal(combate.textoRolagem(t.dados, t.bonus, t.penalidade), 'Role 4d20, fique com o menor, +5');
    assert.equal(combate.textoRolagem(3, 0, -1), 'Role 2d20, fique com o maior');
  });
});

describe('combate: soma dos dados digitada', () => {
  test('avisa quando a soma não cabe nos dados e cala quando cabe', () => {
    const d4 = combate.lerDano('1d4');
    assert.equal(combate.avisoSomaDeDados(d4, 13)?.startsWith('13 não cabe'), true);
    assert.equal(combate.avisoSomaDeDados(d4, 0)?.includes('de 1 a 4'), true);
    assert.equal(combate.avisoSomaDeDados(d4, 3), null);
    assert.equal(combate.avisoSomaDeDados(combate.lerDano('2d10+8'), 14), null);
    assert.equal(combate.avisoSomaDeDados(combate.lerDano('2d10+8'), 21)?.includes('2d10'), true);
    assert.equal(combate.avisoSomaDeDados(d4, null), null);
  });
});

describe('ataque do jeito da mesa (20/10)', () => {
  test('de passagem, combate defensivo e o ajuste do mestre somam na rolagem; a arremessada sem alcance leva −5', () => {
    const t = combate.montarTeste({ dados: 2, bonus: 5, defesaBase: 15, distancia: false, situacoes: ['passagem', 'combateDefensivo'], ajuste: { dados: -1, bonus: 2 } });
    assert.equal(t.dados, 2);
    assert.equal(t.penalidade, -3, '−1d20 da passagem, −1d20 do defensivo e −1d20 do ajuste');
    assert.equal(t.bonus, 7);
    const a = combate.montarTeste({ dados: 1, bonus: 3, defesaBase: 12, distancia: true, situacoes: ['arremessoSemAlcance', 'passagem'] });
    assert.equal(a.bonus, -2, 'o −5 do arremesso; a passagem é só do corpo a corpo');
    assert.equal(a.penalidade, 0);
    assert.deepEqual(combate.DEFESA_ATE_O_TURNO, { investida: -5, combateDefensivo: 5 });
  });
});

describe('metade e empate (20/10)', () => {
  test('a metade dos PV arredonda para baixo: com 21 PV, 10 de dano já é massivo', () => {
    assert.equal(combate.metadeDe(21), 10);
    assert.equal(combate.consequencia({ pv: 21, pvMax: 21 }, 10).massivo, 17);
    assert.equal(combate.consequencia({ pv: 21, pvMax: 21 }, 9).massivo, null);
    // machucado: abaixo da metade (10), então 10 PV ainda não, 9 sim
    assert.equal(combate.consequencia({ pv: 21, pvMax: 21 }, 11).machucado, false);
    assert.equal(combate.consequencia({ pv: 21, pvMax: 21 }, 12).machucado, true);
  });
  test('o empate favorece o ataque: a resistência ao ritual precisa passar da DT', () => {
    assert.equal(combate.resisteAoAtaque(10, 15, 15), false);
    assert.equal(combate.resisteAoAtaque(10, 16, 15), true);
    assert.equal(combate.resisteAoAtaque(20, 5, 15), true);
  });
});
