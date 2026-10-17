import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GRUPOS_NPC_PADRAO, grupoDoNpc, gruposDoElenco, lerNpc } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { Hotel } from "../src/hotel";

/** Os NPCs do mestre (16/10): o elenco começa com o Miguel, e o NPC da tela é conferido. */
describe("npcs", () => {
  test("o elenco começa com o Miguel Albuquerque, com a arte dele", () => {
    const db = seedDb();
    upgradeDb(db);
    const m = db.npcs?.find((n) => n.id === "miguel-albuquerque");
    assert.ok(m, "falta o Miguel");
    assert.equal(m.arte, "miguel-albuquerque");
    // e a gente da base que veio depois
    for (const id of ["agata", "ivete", "samuel", "geraldo-ribeiro", "herman-arantes"]) assert.ok(db.npcs?.some((n) => n.id === id), `falta ${id}`);
    // os quatro de 17/10, ainda sem nome, com a arte (8 direções, retrato e deitado)
    for (const id of ["npc-camisa-rosa", "npc-ruivo", "npc-cabelo-rosa", "npc-jaleco"]) assert.ok(db.npcs?.some((n) => n.id === id && n.arte === id), `falta ${id}`);
    // a arte vira personagem sozinha (a folha das 8 direções e as poses paradas)
    new Hotel({ db, persist: false, timers: false });
    const ch = db.characters.find((c) => c.sheet === "/arte/personagens/miguel-albuquerque/oito-direcoes.png");
    assert.ok(ch, "o personagem do Miguel");
    assert.equal(Object.keys(ch.poses?.desarmado ?? {}).length, 8, "as 8 direções paradas");
    for (const id of ["npc-camisa-rosa", "npc-ruivo", "npc-cabelo-rosa", "npc-jaleco"]) {
      const c = db.characters.find((x) => x.sheet === `/arte/personagens/${id}/oito-direcoes.png`);
      assert.ok(c, `o personagem de ${id}`);
      assert.equal(Object.keys(c.poses?.desarmado ?? {}).length, 8, `${id}: as 8 direções`);
      assert.ok(c.portraits?.desarmado?.open, `${id}: o retrato`);
      assert.ok(c.deitado?.dormindo && c.deitado?.caido, `${id}: dormindo e caído`);
    }
    // de novo não duplica
    const antes = db.characters.length;
    new Hotel({ db, persist: false, timers: false });
    assert.equal(db.characters.length, antes);
  });

  test("o banco de antes (só o Miguel) ganha os novos, uma vez", () => {
    const db = seedDb();
    upgradeDb(db);
    db.npcs = db.npcs!.filter((n) => n.id === "miguel-albuquerque");
    delete db.npcsRev;
    upgradeDb(db);
    assert.deepEqual(db.npcs.map((n) => n.id).sort(), ["agata", "geraldo-ribeiro", "herman-arantes", "ivete", "miguel-albuquerque", "npc-cabelo-rosa", "npc-camisa-rosa", "npc-jaleco", "npc-ruivo", "samuel"]);
  });

  test("os sobrenomes de 17/10 entram no banco que tem o nome antigo; o que o mestre mudou fica", () => {
    const db = seedDb();
    upgradeDb(db);
    const ag = db.npcs!.find((n) => n.id === "agata")!;
    const iv = db.npcs!.find((n) => n.id === "ivete")!;
    Object.assign(ag, { nome: "Ágata", nota: "a ocultista da base" });
    Object.assign(iv, { nome: "Ivete da Silva", nota: "armas e equipamentos; o bar de cima" });
    upgradeDb(db);
    assert.equal(ag.nome, "Agatha Volkomenn");
    assert.equal(ag.nota, "ocultista da Ordo Realitas");
    assert.equal(iv.nome, "Ivete da Silva");
    assert.equal(iv.nota, "responsável pelo arsenal da Ordem");
    assert.equal(db.npcs!.find((n) => n.id === "samuel")!.nome, "Samuel Norte");
  });

  test("os grupos do Elenco: os padrão guardados, a Sede da Ordem vira Ordo Realitas, a ordem guardada vale", () => {
    const db = seedDb();
    upgradeDb(db);
    assert.deepEqual(db.npcGrupos, GRUPOS_NPC_PADRAO);
    assert.equal(grupoDoNpc(db.npcs!.find((n) => n.id === "agata")!), "Ordo Realitas");
    assert.equal(grupoDoNpc(db.npcs!.find((n) => n.id === "herman-arantes")!), "Panacea");
    // o banco que já tinha o grupo antigo, na mão e na lista
    db.npcs!.find((n) => n.id === "ivete")!.grupo = "Sede da Ordem";
    db.npcGrupos = ["Sede da Ordem", "Lotus Branca"];
    upgradeDb(db);
    assert.equal(db.npcs!.find((n) => n.id === "ivete")!.grupo, "Ordo Realitas");
    assert.deepEqual(db.npcGrupos, ["Ordo Realitas", "Lotus Branca"]);
    // a ordem: os guardados, depois os usados que não estão guardados, e "Do mestre" no fim
    const ordem = gruposDoElenco(["Panacea", "Ordo Realitas"], [...db.npcs!, { id: "x", nome: "X", look: db.npcs![0].look }]);
    assert.deepEqual(ordem.slice(0, 2), ["Panacea", "Ordo Realitas"]);
    assert.equal(ordem.at(-1), "Do mestre");
  });

  test("apagar não traz de volta", () => {
    const db = seedDb();
    upgradeDb(db);
    db.npcs = [];
    upgradeDb(db);
    assert.equal(db.npcs.length, 0);
  });

  test("o NPC da tela: precisa de nome; o id sai do nome", () => {
    assert.equal(lerNpc({ nome: "" }), null);
    const n = lerNpc({ id: "", nome: "  Dona Zélia ", nota: "a dona da pensão", look: {} })!;
    assert.equal(n.id, "dona-zelia");
    assert.equal(n.nome, "Dona Zélia");
    assert.equal(n.nota, "a dona da pensão");
  });
});
