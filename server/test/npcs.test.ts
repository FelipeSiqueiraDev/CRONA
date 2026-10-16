import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lerNpc } from "@crona/shared";
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
    // a arte vira personagem sozinha (a folha das 8 direções e as poses paradas)
    new Hotel({ db, persist: false, timers: false });
    const ch = db.characters.find((c) => c.sheet === "/arte/personagens/miguel-albuquerque/oito-direcoes.png");
    assert.ok(ch, "o personagem do Miguel");
    assert.equal(Object.keys(ch.poses?.desarmado ?? {}).length, 8, "as 8 direções paradas");
    // de novo não duplica
    const antes = db.characters.length;
    new Hotel({ db, persist: false, timers: false });
    assert.equal(db.characters.length, antes);
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
