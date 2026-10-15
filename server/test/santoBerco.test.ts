import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, RoomMap } from "@crona/shared";
import type { RoomData } from "../src/db";
import { seedDb, upgradeDb } from "../src/seed";
import { SANTO_BERCO } from "../src/seedSantoBerco";

/** as casas de uma cena que se alcançam a pé a partir de (x, y), andando só pelo que é chão livre */
function alcance(r: RoomData, x0: number, y0: number): Set<string> {
  const map = new RoomMap(r.heightmap, r.door, r.items);
  const vistos = new Set([`${x0},${y0}`]);
  const fila: [number, number][] = [[x0, y0]];
  while (fila.length) {
    const [x, y] = fila.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, ny] = [x + dx, y + dy];
      const k = `${nx},${ny}`;
      if (vistos.has(k)) continue;
      // a casa de destino entra no alcance (a passagem, a porta), mas só se continua andando pelo chão livre
      vistos.add(k);
      if (map.walkState(nx, ny) === "walk") fila.push([nx, ny]);
    }
  }
  return vistos;
}

/** as casas de uma peça na cena */
const casas = (it: RoomData["items"][number]) => {
  const { sx, sy } = footprint(getFurni(it.defId)!, it.rot);
  const out: string[] = [];
  for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) out.push(`${it.x + dx},${it.y + dy}`);
  return out;
};

describe("Santo Berço", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(SANTO_BERCO));
  const porNome = (n: string) => salas.find((r) => r.name === SANTO_BERCO + n)!;
  const portais = (r: RoomData) => r.items.filter((i) => getFurni(i.defId)?.portal);

  test("o lugar existe: a vila e todos os interiores, numa campanha com o nome do lugar", () => {
    const todas = [
      "Vila", "Torre do Porteiro", "Alto da Torre", "Taverna", "Ferraria", "Quarto do Ferreiro",
      "Hotel", "Corredor do Hotel", "Quarto 1 do Hotel", "Quarto 2 do Hotel", "Quarto 3 do Hotel",
      "Casa do Doutor", "Consultório do Doutor", "Quarto do Doutor",
      "Fazenda", "Celeiro da Fazendeira", "Celeiro Velho", "Casa da Fazendeira", "Bosque da Provação",
      "Boca das Minas", "Galeria Verde", "Galeria Vermelha", "Galeria Azul", "Câmara dos Cristais Pretos",
      "Bunker dos Guardiões", "Labirinto Infinito", "Caverna", "Fundo da Caverna",
    ];
    for (const n of todas) assert.ok(porNome(n), `falta ${n}`);
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Santo Berço");
    assert.equal(salas[0].name, SANTO_BERCO + "Vila", "a entrada do lugar é a vila");
    for (const n of ["Vila", "Fazenda", "Bosque da Provação", "Labirinto Infinito"]) assert.ok(porNome(n).aberto, `${n} é ao ar livre`);
    // as casinhas comuns não têm nome
    assert.equal(salas.filter((r) => r.name === SANTO_BERCO + "Casa").length, 4);
  });

  test("toda peça da montagem existe no catálogo, e nenhuma ficou de fora", () => {
    for (const r of salas) for (const it of r.items) assert.ok(getFurni(it.defId), `${r.name}: ${it.defId} não existe`);
    // as cenas novas montam inteiras (o seed descarta em silêncio o que não cabe): a conta das peças-chave
    const conta = (n: string, id: string) => porNome(n).items.filter((i) => i.defId === id).length;
    assert.equal(porNome("Hotel").wallItems.filter((w) => w.defId === "quadro_hoteleiro").length, 4, "os quatro Hoteleiros");
    assert.equal(conta("Hotel", "balcao_hotel"), 1);
    assert.equal(conta("Consultório do Doutor", "maca_doutor"), 1);
    assert.equal(conta("Consultório do Doutor", "armario_boticario"), 1);
    assert.equal(conta("Consultório do Doutor", "mesa_doutor"), 1);
    assert.equal(conta("Consultório do Doutor", "cristal_verde"), 1);
    assert.equal(conta("Fazenda", "celeiro"), 2, "os dois celeiros");
    assert.equal(conta("Fazenda", "casa_fazendeira"), 1);
    assert.ok(conta("Celeiro Velho", "olhos_escuro") >= 2, "os bichos escondidos");
    assert.ok(conta("Bosque da Provação", "toco_morador") >= 12, "um toco por morador");
    for (const [n, cor] of [["Galeria Verde", "verde"], ["Galeria Vermelha", "vermelho"], ["Galeria Azul", "azul"], ["Câmara dos Cristais Pretos", "preto"]])
      assert.ok(conta(n, `cristal_grande_${cor}`) >= 3, `${n}: os cristais grandes`);
    for (const n of ["Boca das Minas", "Galeria Verde", "Galeria Vermelha", "Galeria Azul"]) assert.ok(conta(n, "trilho_mina") >= 10, `${n}: o trilho`);
    assert.ok(conta("Galeria Verde", "toca_toupeira") >= 3, "as tocas das Toupeiras de Lodo");
    assert.ok(porNome("Galeria Vermelha").wallItems.some((w) => w.defId === "morcegosas"), "as Morcegosas");
    assert.equal(conta("Caverna", "porta_cela_branca"), 3, "as três celas brancas");
    assert.equal(conta("Fundo da Caverna", "ninho_parasita"), 1, "o lugar do Parasita");
    assert.equal(conta("Labirinto Infinito", "neblina_densa"), 1);
    assert.ok(conta("Labirinto Infinito", "sebe") > 150, "o labirinto ficou pequeno");
  });

  test("toda passagem leva a outra sala de Santo Berço, que tem a volta, e todas se alcançam a partir da vila", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of portais(r)) {
        assert.ok(it.link !== undefined && ids.has(it.link), `${r.name}: passagem ${it.defId} em ${it.x},${it.y} sem destino`);
        const volta = salas.find((s) => s.id === it.link)!;
        assert.ok(volta.items.some((i) => i.link === r.id), `${volta.name} não volta para ${r.name}`);
      }
    const vistos = new Set([porNome("Vila").id]);
    const fila = [porNome("Vila")];
    while (fila.length) {
      const r = fila.shift()!;
      for (const it of r.items)
        if (it.link !== undefined && !vistos.has(it.link)) {
          vistos.add(it.link);
          fila.push(salas.find((s) => s.id === it.link)!);
        }
    }
    assert.equal(vistos.size, salas.length, "alguma sala ficou sem caminho");
  });

  test("dentro de cada cena, a pé, toda passagem se alcança a partir da primeira (nada fechado no meio)", () => {
    for (const r of salas) {
      const ps = portais(r);
      if (ps.length < 2) continue;
      const [x0, y0] = casas(ps[0]).map((k) => k.split(",").map(Number) as [number, number]).find(([x, y]) => new RoomMap(r.heightmap, r.door, r.items).walkState(x, y) === "walk") ?? [ps[0].x, ps[0].y];
      const viu = alcance(r, x0, y0);
      for (const p of ps.slice(1)) assert.ok(casas(p).some((k) => viu.has(k)), `${r.name}: não se chega a pé em ${p.defId} (${p.x}, ${p.y})`);
    }
  });

  test("a porta de dentro fica do mesmo lado da de fora (o Felipe, 05/10 e 14/10)", () => {
    const vila = porNome("Vila");
    for (const ent of vila.items.filter((i) => i.defId === "entrada" && i.link !== undefined)) {
      const dentro = salas.find((s) => s.id === ent.link)!;
      if (dentro.aberto) continue; // as quatro entradas do labirinto
      const volta = dentro.items.find((i) => i.link === vila.id && getFurni(i.defId)?.portal)!;
      // a entrada tem o giro do prédio (a frente dele): a porta de dentro olha para o lado contrário (para dentro da sala)
      assert.equal(volta.rot, (ent.rot + 4) % 8, `${dentro.name}: a porta de dentro (giro ${volta.rot}) não está do lado da de fora (giro ${ent.rot})`);
    }
  });

  test("a escotilha do Ferreiro dá no Bunker, que liga também o fundo das minas", () => {
    const quarto = porNome("Quarto do Ferreiro");
    const bunker = porNome("Bunker dos Guardiões");
    const esc = quarto.items.find((i) => i.defId === "escotilha")!;
    assert.equal(esc.link, bunker.id);
    assert.equal(esc.state, 2, "a escotilha começa trancada (só abre por baixo)");
    assert.equal(bunker.items.find((i) => i.defId === "escada_vertical")?.link, quarto.id);
    assert.ok(bunker.items.some((i) => i.link === porNome("Câmara dos Cristais Pretos").id));
  });

  test("o labirinto: as quatro entradas da vila e, de cada uma, a pé até a boca da caverna no miolo", () => {
    const vila = porNome("Vila");
    const lab = porNome("Labirinto Infinito");
    const conta = (id: string) => vila.items.filter((i) => i.defId === id).length;
    assert.ok(conta("sebe") > 30, "o labirinto da vila ficou pequeno");
    assert.equal(conta("estatua_guardiao"), 4);
    assert.ok(conta("poste_cristal") >= 8);
    assert.equal(vila.items.filter((i) => i.link === lab.id).length, 4, "as quatro entradas na vila");
    const entradas = lab.items.filter((i) => i.link === vila.id);
    assert.equal(entradas.length, 4, "as quatro entradas no labirinto");
    const boca = lab.items.find((i) => i.defId === "boca_caverna")!;
    for (const e of entradas) assert.ok(casas(boca).some((k) => alcance(lab, e.x, e.y).has(k)), `da entrada ${e.x},${e.y} não se chega ao miolo`);
  });

  test("os móveis de abrir começam fechados e cada túmulo fica embaixo de uma árvore", () => {
    const DE_ABRIR = new Set(["bau_madeira", "armario_boticario", "comoda", "nightstand", "guarda_roupa"]);
    for (const r of salas) for (const it of r.items) if (DE_ABRIR.has(it.defId)) assert.equal(it.state, 0, `${r.name}: ${it.defId} em ${it.x},${it.y} começa aberto`);
    const bosque = porNome("Bosque da Provação");
    for (const t of bosque.items.filter((i) => i.defId === "tumulo"))
      assert.ok(bosque.items.some((a) => a.defId === "arvore_retorcida" && a.x === t.x && a.y === t.y - 1), `túmulo em ${t.x},${t.y} sem a árvore`);
  });
});
