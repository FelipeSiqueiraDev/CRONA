import assert from "node:assert/strict";
import { test } from "node:test";
import { footprint, getFurni, Z_PER_M, type FloorItem } from "@crona/shared";
import { mesasMaisAltas, seedDb, upgradeDb } from "../src/seed";

/**
 * A altura de verdade das mesas, cadeiras e banquetas (17/10, o Felipe: "Mesa alta né menino?! Catarina quase sumiu
 * atrás dela"): o `aumento` cresce só a largura e o fundo; o tampo fica a 0,76 m e o assento a 0,45 m.
 */
const metros = (defId: string) => (getFurni(defId)?.height ?? 0) / Z_PER_M;

test("mesa, cadeira e banqueta na altura de verdade", () => {
  for (const id of ["mesa_cozinha", "mesa_jantar", "desk_wood", "desk_metal", "table_work", "table_round", "table_meeting"])
    assert.ok(Math.abs(metros(id) - 0.76) < 0.01, `${id}: ${metros(id).toFixed(2)} m`);
  for (const id of ["chair_wood", "chair_bar", "chair_red", "stool"]) assert.ok(Math.abs(metros(id) - 0.45) < 0.01, `${id}: ${metros(id).toFixed(2)} m`);
  for (const id of ["mesa_vidro_lab", "mesa_contencao", "mesa_arsenal", "gun_table"]) assert.ok(Math.abs(metros(id) - 0.9) < 0.01, `${id}: ${metros(id).toFixed(2)} m`);
  // a cadeira continua cabendo embaixo da mesa (encaixa) e a banqueta de balcão fica abaixo do balcão
  assert.ok(metros("chair_wood") < metros("mesa_cozinha"));
  assert.ok(metros("stool_bar") < metros("bar_counter") - 0.3);
});

/** O que está em cima de cada mesa com `aumento`, e onde devia estar apoiado. */
function emCima(items: FloorItem[]) {
  const out: { mesa: FloorItem; it: FloorItem }[] = [];
  for (const mesa of items) {
    const def = getFurni(mesa.defId);
    if (!def?.aumento || def.aumento === 1) continue;
    const fp = footprint(def, mesa.rot);
    for (const it of items)
      if (it !== mesa && it.x >= mesa.x && it.y >= mesa.y && it.x < mesa.x + fp.sx && it.y < mesa.y + fp.sy && it.z > mesa.z + 0.05) out.push({ mesa, it });
  }
  return out;
}

test("o que a montagem põe em cima das mesas fica no tampo novo (nada flutua)", () => {
  const db = seedDb();
  upgradeDb(db);
  const soltos: string[] = [];
  let vistos = 0;
  for (const r of db.rooms)
    for (const { it } of emCima(r.items)) {
      vistos++;
      // apoiado: em cima de alguma peça da mesma casa (a mesa ou o que está nela)
      const apoio = r.items.some((o) => {
        if (o === it) return false;
        const d = getFurni(o.defId);
        if (!d) return false;
        const fp = footprint(d, o.rot);
        return it.x >= o.x && it.y >= o.y && it.x < o.x + fp.sx && it.y < o.y + fp.sy && Math.abs(o.z + d.height - it.z) < 0.03;
      });
      if (!apoio) soltos.push(`${r.name}: ${it.defId} em ${it.x},${it.y} z ${it.z}`);
    }
  assert.ok(vistos > 10, `só ${vistos} itens em cima de mesas`);
  assert.deepEqual(soltos, []);
});

test("num banco de 12/10 a 17/10, o que estava no tampo aumentado desce junto", () => {
  const db = seedDb();
  upgradeDb(db);
  const r = db.rooms.find((s) => emCima(s.items).some(({ mesa }) => mesa.defId === "mesa_cozinha"))!;
  assert.ok(r, "alguma cena com coisa em cima da mesa da cozinha");
  const lista = emCima(r.items).filter(({ mesa }) => mesa.defId === "mesa_cozinha");
  const certo = new Map(lista.map(({ it }) => [it.id, it.z]));
  // como estava: o tampo a 0,94 m
  for (const { it } of lista) it.z = Math.round((it.z + (0.94 - 0.76) * Z_PER_M) * 1000) / 1000;
  delete db.mesasReais;
  assert.equal(mesasMaisAltas(db), true);
  for (const { it } of lista) assert.ok(Math.abs(it.z - certo.get(it.id)!) < 0.01, `${it.defId}: ${it.z} (devia ${certo.get(it.id)})`);
  assert.equal(mesasMaisAltas(db), false, "uma vez só");
});
