import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getFurni } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { SANTO_BERCO } from "../src/seedSantoBerco";

describe("Santo Berço", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(SANTO_BERCO));
  const porNome = (n: string) => salas.find((r) => r.name === SANTO_BERCO + n)!;

  test("o lugar existe: a vila e os interiores da primeira leva, numa campanha com o nome do lugar", () => {
    for (const n of ["Vila", "Torre do Porteiro", "Alto da Torre", "Taverna", "Ferraria", "Quarto do Ferreiro"]) assert.ok(porNome(n), `falta ${n}`);
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Santo Berço");
    assert.equal(salas[0].name, SANTO_BERCO + "Vila", "a entrada do lugar é a vila");
    assert.ok(porNome("Vila").aberto, "a vila é ao ar livre");
  });

  test("toda peça da montagem existe no catálogo", () => {
    for (const r of salas) for (const it of r.items) assert.ok(getFurni(it.defId), `${r.name}: ${it.defId} não existe`);
  });

  test("toda passagem leva a outra sala de Santo Berço, que tem a volta, e todas se alcançam a partir da vila", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      // a escotilha do Ferreiro dá no bunker, que vem numa próxima leva (trancada até lá)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal && i.defId !== "escotilha")) {
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

  test("a vila tem o labirinto de sebe, as cinco estátuas e os postes de cristal", () => {
    const vila = porNome("Vila");
    const conta = (id: string) => vila.items.filter((i) => i.defId === id).length;
    assert.ok(conta("sebe") > 30, "o labirinto ficou pequeno");
    assert.equal(conta("estatua_guardiao"), 5);
    assert.ok(conta("poste_cristal") >= 8);
  });
});
