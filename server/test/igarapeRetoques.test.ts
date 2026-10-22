import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { seedDb, upgradeDb } from "../src/seed";
import { retoquesIgarape2210 } from "../src/retoquesIgarape";
import { IGARAPE } from "../src/seedIgarape";

const cidadeDe = (db: ReturnType<typeof seedDb>) => db.rooms.find((r) => r.name === IGARAPE + "Cidade")!;
const chao = (r: ReturnType<typeof cidadeDe>) => r.terreno!.split("\n");

describe("Igarapé: cerca, canoas e ipês (22/10)", () => {
  test("a cidade que sai do seed: canoas na margem, ipês de lados diferentes e a horta cercada", () => {
    const db = seedDb();
    upgradeDb(db);
    const r = cidadeDe(db);
    const t = chao(r);
    const canoas = r.items.filter((i) => i.defId === "igarape_canoa");
    assert.equal(canoas.length, 3);
    for (const c of canoas) {
      const casas = [0, 1, 2, 3].map((k) => t[c.y + k][c.x]);
      assert.ok(!casas.includes("a"), `canoa em ${c.x},${c.y} dentro da água`);
      assert.ok(casas.filter((k) => k === "d").length >= 2, `canoa em ${c.x},${c.y} longe do barro da margem: ${casas.join("")}`);
    }
    const ipes = r.items.filter((i) => i.defId === "igarape_ipe");
    assert.equal(ipes.length, 3);
    assert.ok(new Set(ipes.map((i) => i.rot)).size >= 3, "os três ipês não ficam iguais (cada um num giro)");
    // a horta: toda cerca encosta noutra cerca ou na casa; só um vão (o portão) na carreira de oeste
    const cercas = r.items.filter((i) => i.defId === "cerca");
    assert.equal(cercas.length, 7 + 7 + 4, "fundo, frente e a cerca de oeste com o portão");
    assert.ok(!cercas.some((c) => c.x === 2 && c.y === 33), "o portão");
    assert.ok(r.items.some((i) => i.defId === "arbusto" && i.x === 4 && i.y === 32), "a horta tem o que plantar");
  });

  test("a cidade que já está no banco é retocada uma vez, sem refazer a cena", () => {
    const db = seedDb();
    upgradeDb(db);
    const r = cidadeDe(db);
    // volta ao arranjo antigo: a cerca solta, as canoas longe da água, os ipês iguais
    r.items = r.items.filter((i) => !(i.defId === "cerca") && !(i.defId === "arbusto" && i.x >= 2 && i.x <= 8 && i.y >= 30 && i.y <= 36));
    r.items = r.items.filter((i) => !(i.defId === "igarape_cesto" && ((i.x === 7 && i.y === 33) || (i.x === 3 && i.y === 35))));
    for (let x = 3; x <= 9; x++) r.items.push({ id: db.nextItemId++, defId: "cerca", x, y: 30, z: 0, rot: 4, state: 0 });
    const antigas: [number, number][] = [[26, 36], [35, 23], [34, 34]];
    r.items.filter((i) => i.defId === "igarape_canoa").forEach((c, k) => Object.assign(c, { x: antigas[k][0], y: antigas[k][1] }));
    r.items.filter((i) => i.defId === "igarape_ipe").forEach((i) => (i.rot = 0));
    (db as unknown as { retoquesIgarape2210?: boolean }).retoquesIgarape2210 = false;

    assert.equal(retoquesIgarape2210(db), true);
    const t = chao(r);
    for (const c of r.items.filter((i) => i.defId === "igarape_canoa")) {
      const casas = [0, 1, 2, 3].map((k) => t[c.y + k][c.x]);
      assert.ok(!casas.includes("a") && casas.filter((k) => k === "d").length >= 2, `canoa em ${c.x},${c.y}`);
    }
    assert.ok(new Set(r.items.filter((i) => i.defId === "igarape_ipe").map((i) => i.rot)).size >= 3);
    assert.equal(r.items.filter((i) => i.defId === "cerca").length, 18);
    const tamanho = r.items.length;
    assert.equal(retoquesIgarape2210(db), false, "uma vez só");
    assert.equal(r.items.length, tamanho);
  });

  test("se o mestre já mexeu na cerca, a migração não a refaz por cima", () => {
    const db = seedDb();
    upgradeDb(db);
    const r = cidadeDe(db);
    r.items = r.items.filter((i) => i.defId !== "cerca");
    r.items.push({ id: db.nextItemId++, defId: "cerca", x: 3, y: 30, z: 0, rot: 4, state: 0 });
    (db as unknown as { retoquesIgarape2210?: boolean }).retoquesIgarape2210 = false;
    retoquesIgarape2210(db);
    assert.equal(r.items.filter((i) => i.defId === "cerca").length, 1);
  });
});
