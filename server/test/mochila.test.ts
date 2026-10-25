import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { PILHA_CHAO, regras, type ClientMsg, type FichaSalva, type Loot, type ServerMsg, type Session } from '@crona/shared';
import type { Database } from '../src/db';
import { Hotel } from '../src/hotel';
import { seedDb, upgradeDb } from '../src/seed';

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

/** Combatente de NEX 5% com Força 2: 10 espaços (LR p. 53). */
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
let sala: number;

const sessao = (): Session => {
  hotel.pushNow();
  return gm.last('session')!.session;
};
const personagem = (nome: string) => sessao().characters.find((c) => c.name === nome)!;
const ficha = (nome: string) => hotel.db.fichas!.find((f) => f.nome === nome)!;
const escrivaninha = () => sessao().objects.find((o) => o.name === 'Escrivaninha')!;
const lootDe = (objId: number): Loot[] => {
  const r = hotel.rooms.get(sala)!;
  return (r.map.getItem(objId)?.loot ?? r.map.getWallItem(objId)?.loot ?? []) as Loot[];
};
/** Põe um item na escrivaninha e entrega para a peça. */
const dar = (para: string, m: Partial<Extract<ClientMsg, { t: 'lootAdd' }>>) => {
  const obj = escrivaninha().id;
  gm.send({ t: 'lootAdd', itemId: obj, name: '', espacos: 1, kind: 'misc', ...m });
  const l = lootDe(obj).at(-1)!;
  gm.send({ t: 'lootGive', itemId: obj, lootId: l.id, to: para });
  return l;
};

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  sala = hotel.db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!.id;
  gm = new Peer(hotel);
  gm.send({ t: 'login', name: 'Mestre', look, gmKey: hotel.gmKey });
  gm.send({ t: 'join', roomId: sala });
  for (const nome of ['D.Tepes', 'Catarina Albuquerque']) gm.send({ t: 'fichaSalvar', ficha: fichaNova(nome, personagem(nome).look.charId!) });
});

describe('mochila: um inventário só', () => {
  test('pegar do cenário leva para a mochila, achado na missão e com o mesmo número; a carga vem da ficha', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    assert.ok(!lootDe(escrivaninha().id).some((l) => l.id === faca.id), 'saiu da escrivaninha');
    const it = ficha('D.Tepes').ficha.inventario.find((x) => x.uid === faca.id)!;
    assert.deepEqual({ id: it.id, tipo: it.tipo, achado: it.achado }, { id: 'faca', tipo: 'arma', achado: true });
    assert.equal(faca.name, 'Faca', 'sem nome, fica o do livro');
    const pista = dar('D.Tepes', { name: 'Pendrive', espacos: 0.5, kind: 'tape', descricao: 'Arquivos do Projeto Fulgor.' });
    const p = ficha('D.Tepes').ficha.inventario.find((x) => x.uid === pista.id)!;
    assert.deepEqual([p.tipo, p.nome, p.espacos, p.tipoCena, p.descricao], ['cena', 'Pendrive', 0.5, 'tape', 'Arquivos do Projeto Fulgor.']);
    const t = personagem('D.Tepes');
    assert.deepEqual([t.load, t.capacity], [1.5, 10], 'faca (1) + pendrive (0,5) de 10 espaços (Força 2)');
    assert.ok(gm.last('campaign')!.state.log.some((e) => e.text === 'Mestre entregou Faca para D.Tepes.'));
  });

  test('a arma na mão deixa a peça armada; o Armado da peça empunha ou guarda a arma da ficha', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    const id = ficha('D.Tepes').id;
    gm.send({ t: 'mochila', fichaId: id, uid: faca.id, acao: 'empunhar' });
    assert.equal(personagem('D.Tepes').armed, true);
    gm.send({ t: 'mochila', fichaId: id, uid: faca.id, acao: 'guardar' });
    assert.equal(personagem('D.Tepes').armed, false);
    const tokenId = personagem('D.Tepes').id;
    gm.send({ t: 'tokenEdit', tokenId: -tokenId, armed: true });
    assert.equal(regras.lugarDoItem(ficha('D.Tepes').ficha.inventario.find((x) => x.uid === faca.id)!), 'mao');
    assert.equal(personagem('D.Tepes').armed, true);
    gm.send({ t: 'tokenEdit', tokenId: -tokenId, armed: false });
    assert.equal(personagem('D.Tepes').armed, false);
    // sem arma, o Armado avisa
    gm.send({ t: 'tokenEdit', tokenId: -personagem('Catarina Albuquerque').id, armed: true });
    assert.equal(gm.last('error')?.msg, 'Catarina Albuquerque não tem arma na mochila.');
    // a mesa não mexe na mochila
    const mesa = new Peer(hotel);
    mesa.send({ t: 'login', name: 'Mesa', look, mesa: true });
    mesa.send({ t: 'mochila', fichaId: id, uid: faca.id, acao: 'empunhar' });
    assert.equal(personagem('D.Tepes').armed, false);
  });

  test('entregar a outra ficha; largar faz uma pilha no chão, que some quando pegam o último item', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    gm.send({ t: 'mochila', fichaId: ficha('D.Tepes').id, uid: faca.id, acao: 'empunhar' });
    gm.send({ t: 'mochila', fichaId: ficha('D.Tepes').id, uid: faca.id, acao: 'entregar', para: ficha('Catarina Albuquerque').id });
    assert.ok(!ficha('D.Tepes').ficha.inventario.some((x) => x.uid === faca.id));
    const naCatarina = ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.uid === faca.id)!;
    assert.equal(regras.lugarDoItem(naCatarina), 'mochila', 'quem recebe guarda');
    assert.equal(personagem('D.Tepes').armed, false);
    gm.send({ t: 'mochila', fichaId: ficha('Catarina Albuquerque').id, uid: faca.id, acao: 'largar' });
    const room = hotel.rooms.get(sala)!;
    const pilha = room.map.allItems().find((it) => it.defId === PILHA_CHAO)!;
    assert.ok(pilha, 'a pilha apareceu');
    assert.deepEqual(pilha.loot?.map((l) => [l.id, l.name, l.revealed, l.item?.id]), [[faca.id, 'Faca', true, 'faca']]);
    assert.ok(sessao().objects.some((o) => o.id === pilha.id && o.name === 'Itens no Chão'));
    gm.send({ t: 'lootGive', itemId: pilha.id, lootId: faca.id, to: 'D.Tepes' });
    assert.ok(!room.map.allItems().some((it) => it.defId === PILHA_CHAO), 'a pilha sumiu');
    assert.equal(gm.last('itemRemove')?.id, pilha.id);
    assert.ok(ficha('D.Tepes').ficha.inventario.some((x) => x.uid === faca.id && x.achado));
  });

  test('largar vale para a cena onde o personagem está, mesmo com o mestre olhando outra', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    const outra = hotel.db.rooms.find((x) => x.id !== sala && hotel.rooms.get(x.id) && x.name.startsWith('Mansão Alvarez'))!.id;
    const tokenId = personagem('D.Tepes').id;
    hotel.moveToken(hotel.rooms.get(sala)!, -tokenId, outra);
    gm.send({ t: 'mochila', fichaId: ficha('D.Tepes').id, uid: faca.id, acao: 'largar' });
    assert.ok(!hotel.rooms.get(sala)!.map.allItems().some((it) => it.defId === PILHA_CHAO), 'não largou na cena do mestre');
    assert.ok(hotel.rooms.get(outra)!.map.allItems().some((it) => it.defId === PILHA_CHAO), `largou onde o Tepes está (erro: ${gm.last('error')?.msg})`);
  });

  test('não passa do dobro da carga (LR p. 53); usar gasta o consumível', () => {
    dar('D.Tepes', { name: 'Caixote', espacos: 10 });
    dar('D.Tepes', { name: 'Outro caixote', espacos: 10 });
    assert.ok(personagem('D.Tepes').load === 20);
    dar('D.Tepes', { name: 'Pedra', espacos: 1 });
    assert.match(gm.last('error')!.msg, /^D\.Tepes não aguenta Pedra: seriam 21 espaços, e o máximo é 20/);
    assert.ok(lootDe(escrivaninha().id).some((l) => l.name === 'Pedra'), 'a pedra ficou na escrivaninha');
    const g = dar('Catarina Albuquerque', { item: { tipo: 'equipamento', id: 'granada-de-fumaca' }, qtd: 2 });
    const id = ficha('Catarina Albuquerque').id;
    gm.send({ t: 'mochila', fichaId: id, uid: g.id, acao: 'usar' });
    assert.equal(ficha('Catarina Albuquerque').ficha.inventario.find((x) => x.uid === g.id)?.qtd, undefined, 'sobra 1 (sem qtd)');
    hotel.pushNow();
    assert.ok(gm.last('campaign')!.state.log.some((e) => e.text === 'Catarina Albuquerque usou Granada de fumaça (sobra 1).'));
    gm.send({ t: 'mochila', fichaId: id, uid: g.id, acao: 'usar' });
    assert.ok(!ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.uid === g.id));
  });

  test('na subida: o que estava com uma peça de ficha vai para a mochila, e o peso antigo vira espaços', () => {
    const db: Database = seedDb();
    upgradeDb(db);
    const r = db.rooms.find((x) => x.name === 'Mansão Alvarez · Escritório')!;
    const tepes = r.tokens!.find((t) => t.name === 'D.Tepes')!;
    const mesa = r.items.find((it) => (it.loot ?? []).length)!;
    const velho = { id: 9001, name: 'Chave da Escrivaninha', weight: 0.2, kind: 'key', holder: 'D.Tepes', revealed: true } as unknown as Loot;
    mesa.loot = [...(mesa.loot ?? []), velho];
    db.seedVersion = 14;
    upgradeDb(db);
    assert.equal(velho.espacos, 0);
    assert.equal((velho as unknown as { weight?: number }).weight, undefined);
    db.fichas = [{ ...fichaNova('D.Tepes', tepes.look.charId!), id: 1 }];
    const h = new Hotel({ db, persist: false, timers: false });
    const inv = h.db.fichas![0].ficha.inventario;
    assert.ok(inv.some((x) => x.uid === 9001 && x.tipo === 'cena' && x.nome === 'Chave da Escrivaninha' && x.achado));
    assert.ok(!h.db.rooms.find((x) => x.id === r.id)!.items.some((it) => it.loot?.some((l) => l.id === 9001)));
  });
});

describe('mochila no combate', () => {
  const comb = (a: Extract<ClientMsg, { t: 'combate' }>['a']) => gm.send({ t: 'combate', a });
  const naMao = (nome: string, uid: number) => regras.lugarDoItem(ficha(nome).ficha.inventario.find((x) => x.uid === uid)!) === 'mao';

  test('sacar gasta a ação de movimento e põe a arma na mão; desarmar faz a arma cair no chão; o Desfazer volta tudo', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    const katana = dar('Catarina Albuquerque', { item: { tipo: 'arma', id: 'katana' } });
    gm.send({ t: 'mochila', fichaId: ficha('Catarina Albuquerque').id, uid: katana.id, acao: 'empunhar' });
    const tepes = personagem('D.Tepes').id;
    const cat = personagem('Catarina Albuquerque').id;
    comb({ tipo: 'abrir' });
    comb({ tipo: 'participante', id: tepes, lado: 'agente', iniciativa: 20 });
    comb({ tipo: 'participante', id: cat, lado: 'agente', iniciativa: 10 });
    comb({ tipo: 'iniciativaMestre', valor: 5 });
    comb({ tipo: 'comecar' });
    hotel.pushNow();
    assert.equal(gm.last('combate')!.combate!.fase, 'andamento', gm.last('denied')?.reason ?? '');
    // sacar a faca: ação de movimento, e ela vai para a mão
    comb({ tipo: 'declarar', qual: 'movimento', texto: 'sacou Faca', quem: tepes, sacar: faca.id });
    assert.equal(gm.last('denied')?.reason, undefined, 'não recusou');
    assert.equal(naMao('D.Tepes', faca.id), true);
    assert.equal(personagem('D.Tepes').armed, true);
    hotel.pushNow();
    assert.equal(gm.last('combate')!.combate!.acoes?.[String(tepes)]?.movimento, true, 'gastou o movimento');
    comb({ tipo: 'desfazer' });
    assert.equal(naMao('D.Tepes', faca.id), false, 'desfazer guarda de novo');
    // sem a arma na mochila, não saca
    comb({ tipo: 'declarar', qual: 'movimento', texto: 'sacou', quem: tepes, sacar: 999999 });
    assert.equal(gm.last('denied')?.reason, 'Item não encontrado.');
    // desarmar: a katana cai na casa da Catarina
    comb({ tipo: 'manobra', manobra: { quem: tepes, alvo: cat, manobra: 'desarmar', qual: 'padrao', teste: { quem: { dados: 2, bonus: 5, d20: 15, total: 20 }, alvo: { dados: 1, bonus: 2, d20: 10, total: 12 } }, venceu: true, diferenca: 8, modificadores: [] } });
    const room = hotel.rooms.get(sala)!;
    const pilha = room.map.allItems().find((it) => it.defId === PILHA_CHAO);
    assert.ok(pilha?.loot?.some((l) => l.id === katana.id), 'a katana está no chão');
    assert.ok(!ficha('Catarina Albuquerque').ficha.inventario.some((x) => x.uid === katana.id));
    assert.equal(personagem('Catarina Albuquerque').armed, false);
    comb({ tipo: 'desfazer' });
    assert.equal(naMao('Catarina Albuquerque', katana.id), true, 'volta para a mão');
    assert.ok(!room.map.allItems().some((it) => it.defId === PILHA_CHAO), 'e sai do chão');
    assert.equal(personagem('Catarina Albuquerque').armed, true);
  });
});

describe('combate do jeito da mesa (20/10)', () => {
  const comb = (a: Extract<ClientMsg, { t: 'combate' }>['a']) => gm.send({ t: 'combate', a });

  test('a faca arremessada cai na casa do alvo (o Desfazer devolve); com o fio, volta para a mão; a Defesa do combate defensivo dura até o turno', () => {
    const faca = dar('D.Tepes', { item: { tipo: 'arma', id: 'faca' } });
    gm.send({ t: 'mochila', fichaId: ficha('D.Tepes').id, uid: faca.id, acao: 'empunhar' });
    const tepes = personagem('D.Tepes').id;
    const cat = personagem('Catarina Albuquerque').id;
    comb({ tipo: 'abrir' });
    comb({ tipo: 'participante', id: tepes, lado: 'agente', iniciativa: 20 });
    comb({ tipo: 'participante', id: cat, lado: 'agente', iniciativa: 10 });
    comb({ tipo: 'iniciativaMestre', valor: 5 });
    comb({ tipo: 'comecar' });
    const ataque = (extra: Partial<regras.Ficha> & Record<string, unknown>) =>
      comb({ tipo: 'ataque', ataque: { quem: tepes, alvo: cat, arma: 'Faca', qual: 'padrao', teste: { dados: 2, bonus: 5, d20: 3, total: 8, defesa: 15 }, situacoes: [], resultado: 'erro', ...extra } as never });
    // arremessou sem o fio: a faca sai da mochila e cai na casa da Catarina
    ataque({ arremesso: { uid: faca.id, volta: false }, ajuste: { dados: -1, bonus: 0 } });
    assert.equal(gm.last('denied')?.reason, undefined, 'não recusou');
    const room = hotel.rooms.get(sala)!;
    const casaCat = room.casaDaPeca(cat)!;
    const pilha = room.map.allItems().find((it) => it.defId === PILHA_CHAO);
    assert.ok(pilha?.loot?.some((l) => l.id === faca.id), 'a faca está no chão');
    assert.deepEqual([pilha!.x, pilha!.y], [casaCat.x, casaCat.y], 'na casa do alvo');
    assert.ok(!ficha('D.Tepes').ficha.inventario.some((x) => x.uid === faca.id));
    hotel.pushNow();
    const reg = gm.last('combate')!.combate!.registro.at(-1)!.texto;
    assert.match(reg, /ajuste do mestre −1d20/);
    assert.match(reg, /arremessou \(a arma fica perto do alvo\)/);
    comb({ tipo: 'desfazer' });
    assert.ok(ficha('D.Tepes').ficha.inventario.some((x) => x.uid === faca.id), 'o Desfazer devolve a faca');
    assert.ok(!room.map.allItems().some((it) => it.defId === PILHA_CHAO), 'e tira do chão');
    // com o fio: a faca continua com ele; e o combate defensivo dá +5 na Defesa até o próximo turno dele
    ataque({ arremesso: { uid: faca.id, volta: true }, defesaAteTurno: [{ nome: 'Combate defensivo', valor: 5 }] });
    assert.ok(ficha('D.Tepes').ficha.inventario.some((x) => x.uid === faca.id), 'puxou de volta');
    hotel.pushNow();
    const c = gm.last('combate')!.combate!;
    assert.deepEqual(c.participantes.find((p) => p.id === tepes)!.defesaTurno, [{ nome: 'Combate defensivo', valor: 5 }]);
    // passa a vez (Catarina) e o turno do mestre; na vez do Tepes de novo, a Defesa volta ao normal
    // (cada ser do mestre tem o próprio turno: passa até a vez voltar ao Tepes)
    comb({ tipo: 'passar' });
    hotel.pushNow();
    for (let i = 0; i < 12 && gm.last('combate')!.combate!.vez !== `p:${tepes}`; i++) {
      comb({ tipo: 'passar' });
      hotel.pushNow();
    }
    hotel.pushNow();
    const c2 = gm.last('combate')!.combate!;
    assert.equal(c2.vez, `p:${tepes}`, 'a vez voltou para o Tepes');
    assert.equal(c2.participantes.find((p) => p.id === tepes)!.defesaTurno, undefined, 'o +5 acabou no começo do turno dele');
  });
});
