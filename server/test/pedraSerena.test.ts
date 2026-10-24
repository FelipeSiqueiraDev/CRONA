import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { PEDRA_SERENA } from "../src/seedPedraSerena";

describe("Pedra Serena (o Galpão do Fritz)", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(PEDRA_SERENA));
  const porNome = (n: string) => salas.find((r) => r.name === PEDRA_SERENA + n)!;

  test("o lugar existe: a cidade (a entrada), o galpão e o escritório, numa campanha com o nome da cidade", () => {
    assert.ok(porNome("Galpão do Fritz"), "falta o galpão");
    assert.ok(porNome("Escritório do Galpão"), "falta o escritório");
    assert.equal(salas[0].name, PEDRA_SERENA + "Cidade", "a entrada do lugar é a cidade");
    assert.ok(porNome("Cidade").aberto, "a cidade é ao ar livre");
    assert.ok(porNome("Cidade").items.some((i) => i.defId === "galpao_fritz"), "o galpão aparece na cidade");
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Pedra Serena");
  });

  test("o galpão está vazio (só os pilares e as portas), o escritório tem só a estante, a mesa e a cadeira, e nenhuma luz", () => {
    const ids = (n: string) => porNome(n).items.map((i) => i.defId).sort();
    assert.deepEqual(ids("Galpão do Fritz"), ["pillar", "pillar", "pillar", "portal", "portal"]);
    assert.deepEqual(ids("Escritório do Galpão"), ["chair_office", "estante_vazia", "mesa_vazia", "portal"]);
    for (const r of salas.filter((s) => !s.aberto)) {
      assert.ok(r.items.every((i) => getFurni(i.defId)?.category !== "iluminacao"), `${r.name}: tem luz`);
      assert.ok((r.darkness ?? 0) >= 0.8, `${r.name}: não está escuro`);
    }
  });

  test("toda peça fica no chão da sala, e o galpão e o escritório se ligam pela porta", () => {
    for (const r of salas) {
      const linhas = r.heightmap.replace(/\r/g, "").split("\n");
      const chao = (x: number, y: number) => y >= 0 && y < linhas.length && x >= 0 && x < linhas[y].length && linhas[y][x] !== "x";
      for (const it of r.items) {
        const fp = footprint(getFurni(it.defId)!, it.rot);
        for (let dy = 0; dy < fp.sy; dy++) for (let dx = 0; dx < fp.sx; dx++) assert.ok(chao(it.x + dx, it.y + dy), `${r.name}: ${it.defId} em ${it.x},${it.y} sai do chão`);
      }
    }
    const galpao = porNome("Galpão do Fritz");
    const esc = porNome("Escritório do Galpão");
    assert.ok(galpao.items.some((i) => i.link === esc.id), "o galpão não leva ao escritório");
    assert.ok(esc.items.some((i) => i.link === galpao.id), "o escritório não volta ao galpão");
    const cidade = porNome("Cidade");
    assert.ok(cidade.items.some((i) => i.link === galpao.id), "a cidade não leva ao galpão");
    assert.ok(galpao.items.some((i) => i.link === cidade.id), "o galpão não volta à cidade");
    // dá para andar do portão até a porta do escritório
    const map = new RoomMap(galpao.heightmap, galpao.door, galpao.items);
    assert.equal(map.walkState(7, 8), "walk");
  });
});
