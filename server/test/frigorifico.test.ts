import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getFurni, montarLocais } from '@crona/shared';
import { seedDb, upgradeDb } from '../src/seed';
import { NOMES, montarFrigorifico } from '../src/seedFrigorifico';

const banco = () => {
  const db = seedDb();
  upgradeDb(db);
  return db;
};
type Banco = ReturnType<typeof banco>;
const cena = (db: Banco, nome: string) => db.rooms.find((r) => r.name === nome);
const todas = (db: Banco) => Object.values(NOMES).map((n) => cena(db, n));

describe('o Frigorífico Albuquerque', () => {
  test('a migração cria as sete cenas (cada cômodo é uma cena) e rodar de novo não duplica nada', () => {
    const db = banco();
    const cenas = todas(db);
    assert.equal(cenas.filter(Boolean).length, 7, 'rua, salão, área gelada, escritório, caldeira, currais e doca');
    assert.ok(cenas.every((c) => !c?.mapa), 'nenhuma é o mapa improvisado com imagem de fundo');
    const antes = db.rooms.length;
    const itens = db.rooms.map((r) => r.items.length).join(',');
    assert.equal(montarFrigorifico(db), false);
    assert.equal(db.rooms.length, antes);
    assert.equal(db.rooms.map((r) => r.items.length).join(','), itens);
  });

  test('as passagens se ligam nos dois sentidos (o salão com a rua, os cômodos e a escada da área gelada)', () => {
    const db = banco();
    const [rua, salao, gelada, escritorio, caldeira, currais, doca] = todas(db) as NonNullable<ReturnType<typeof cena>>[];
    const liga = (a: typeof rua, b: typeof rua) => a.items.some((i) => i.link === b.id && getFurni(i.defId)?.portal);
    for (const [a, b] of [[rua, salao], [salao, escritorio], [salao, caldeira], [salao, currais], [salao, doca], [salao, gelada], [rua, doca]] as const) {
      assert.ok(liga(a, b) && liga(b, a), `${a.name} ↔ ${b.name}`);
    }
    // a escada que desce fica no canto de baixo à esquerda do salão
    const desce = salao.items.find((i) => getFurni(i.defId)?.kind === 'escada_simples')!;
    const largura = salao.heightmap.split('\n')[0].length;
    assert.ok(desce.x === 0 && desce.y === 0, 'na quina (duas paredes), rente a elas');
    // sem nada em volta da escada (corrimão, lâmpada, caixote)
    assert.deepEqual(salao.items.filter((i) => i !== desce && Math.abs(i.x - desce.x) <= 2 && Math.abs(i.y - desce.y) <= 2 && getFurni(i.defId)?.portal !== true).map((i) => i.defId), []);
    // a Entrada do Jardim leva à rua e a rua volta ao Jardim
    const jardim = cena(db, 'Mansão Albuquerque · Jardim')!;
    assert.ok(jardim.items.some((i) => i.defId === 'entrada' && i.link === rua.id));
    assert.ok(rua.items.some((i) => i.defId === 'entrada' && i.link === jardim.id));
  });

  test('o minimapa vê o prédio com os andares (Térreo e Subsolo)', () => {
    const db = banco();
    const portais = (r: Banco['rooms'][number]) => r.items.filter((i) => i.link !== undefined && getFurni(i.defId)?.portal).map((i) => ({ x: i.x, y: i.y, link: i.link! }));
    const locais = montarLocais(db.rooms.map((r) => ({ id: r.id, name: r.name, floor: r.floor, aberto: r.aberto, portals: portais(r), marcos: undefined })));
    const salao = cena(db, NOMES.salao)!;
    const predio = locais.predios.find((p) => p.cenas.includes(salao.id));
    assert.ok(predio, 'há um prédio com o Salão de Abate');
    for (const k of ['gelada', 'escritorio', 'caldeira', 'currais', 'doca'] as const) assert.ok(predio.cenas.includes(cena(db, NOMES[k])!.id), k);
    assert.ok(predio.andares.some((a) => a.rotulo === 'Térreo') && predio.andares.some((a) => a.rotulo === 'Subsolo'));
  });

  test('a Área Gelada é só varais de porcos (nada de geladeira, mesa, cerveja ou caixote)', () => {
    const db = banco();
    const fria = cena(db, NOMES.gelada)!;
    const proibidos = ['fridge_drinks', 'beer_fridge', 'geladeira', 'beer_crate', 'crate_wood', 'keg', 'barril_madeira', 'bancada_lab_ilha', 'desk_metal', 'shelf_metal', 'floor_lamp'];
    assert.deepEqual(fria.items.map((i) => i.defId).filter((d) => proibidos.includes(d)), []);
    assert.ok(fria.items.filter((i) => i.defId === 'porco_pendurado').length >= 16 && fria.items.filter((i) => i.defId === 'porco_pendurado').length <= 24, 'os varais cheios');
    assert.equal(fria.ambient?.toLowerCase(), '#1c4c9c');
    assert.ok(fria.darkness >= 0.4 && fria.darkness <= 0.55, 'escura e azulada');
  });

  test('a migração tira o mapa com imagem da primeira montagem', () => {
    const db = banco();
    const jardim = cena(db, 'Mansão Albuquerque · Jardim')!;
    db.frigorificoRev = 1;
    db.rooms.push({ ...cena(db, NOMES.rua)!, id: db.nextRoomId++, name: 'Frigorífico Albuquerque', mapa: '/arte/mapas/frigorifico-albuquerque.jpg', items: [{ id: db.nextItemId++, defId: 'entrada', x: 1, y: 1, z: 0, rot: 0, state: 0, link: jardim.id }] });
    assert.equal(montarFrigorifico(db), true);
    assert.equal(cena(db, 'Frigorífico Albuquerque'), undefined);
  });

  test('a Entrada do Jardim volta se a Mansão for refeita sem ela', () => {
    const db = banco();
    const jardim = cena(db, 'Mansão Albuquerque · Jardim')!;
    const rua = cena(db, NOMES.rua)!;
    jardim.items = jardim.items.filter((i) => !(i.defId === 'entrada' && i.link === rua.id));
    assert.equal(montarFrigorifico(db), true);
    assert.ok(jardim.items.some((i) => i.defId === 'entrada' && i.link === rua.id));
    assert.equal(montarFrigorifico(db), false);
  });
});
