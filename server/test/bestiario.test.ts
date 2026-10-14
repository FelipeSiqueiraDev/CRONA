import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { aparenciaDaVez, criaturaDoLivro, existidoPadrao, lerCriatura, sanitizeVitals, vitalConditions } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

describe("bestiário: uma ficha, várias aparências", () => {
  test("o banco começa com o Existido, do livro (LR p. 238), masculino e feminino", () => {
    const db = seedDb();
    upgradeDb(db);
    const e = db.bestiario?.find((c) => c.id === "existido");
    assert.ok(e, "falta o Existido");
    assert.equal(e.pv, 36);
    assert.equal(e.ficha.livro, "existido");
    assert.deepEqual(
      e.aparencias.map((a) => a.id),
      ["masculino", "feminino"],
    );
  });

  test("apagar o Existido não traz ele de volta na próxima atualização", () => {
    const db = seedDb();
    upgradeDb(db);
    db.bestiario = [];
    upgradeDb(db);
    assert.equal(db.bestiario.length, 0);
  });

  test("variadas: as peças alternam as aparências; escolhida: todas iguais", () => {
    const e = existidoPadrao();
    assert.deepEqual(
      [0, 1, 2, 3].map((i) => aparenciaDaVez(e, "variadas", i).id),
      ["masculino", "feminino", "masculino", "feminino"],
    );
    assert.deepEqual(
      [0, 1, 2].map((i) => aparenciaDaVez(e, "feminino", i).id),
      ["feminino", "feminino", "feminino"],
    );
  });

  test("a criatura que vem da tela é conferida", () => {
    const boa = criaturaDoLivro("existido", "meu-existido")!;
    assert.ok(lerCriatura(boa));
    assert.equal(lerCriatura({ ...boa, nome: "" }), null);
    assert.equal(lerCriatura({ ...boa, aparencias: [] }), null);
    assert.equal(lerCriatura({ ...boa, pv: "muito" }), null);
    assert.equal(lerCriatura({ ...boa, pv: -3 })?.pv, 1);
  });
  test("a arte entregue do Existido vira personagem sozinha, com as poses do tabuleiro e o retrato", () => {
    const db = seedDb();
    upgradeDb(db);
    db.characters = db.characters.filter((c) => !c.sheet.includes("/existido-"));
    // uma peça já em campo, de antes da arte chegar, ganha a cara ao subir o servidor
    const sala = db.rooms[0];
    sala.tokens = [...(sala.tokens ?? []), { id: 9901, name: "Existido 1", look: { ...existidoPadrao().aparencias[1].look }, x: 1, y: 1, dir: 2, color: "#b3261e", criatura: { id: "existido", aparencia: "feminino" } } as never];
    new Hotel({ db, persist: false, timers: false });
    for (const g of ["masculino", "feminino"]) {
      const ch = db.characters.find((c) => c.sheet === `/arte/personagens/existido-${g}/oito-direcoes.png`);
      assert.ok(ch, `falta o personagem do Existido ${g}`);
      assert.equal(Object.keys(ch.poses?.desarmado ?? {}).length, 8, "as 8 direções paradas");
      assert.ok(ch.portraits?.desarmado, "o retrato");
    }
    const fem = db.characters.find((c) => c.sheet.includes("/existido-feminino/"))!;
    const peca = db.rooms[0].tokens!.find((t) => t.id === 9901)!;
    assert.equal(peca.look.charId, fem.id);
    // de novo não duplica
    const antes = db.characters.length;
    new Hotel({ db, persist: false, timers: false });
    assert.equal(db.characters.length, antes);
  });
  test("criatura sem PE nem SAN não fica Enlouquecendo nem Cansada", () => {
    const v = sanitizeVitals({ pv: 36, pvMax: 36, pe: 0, peMax: 0, san: 0, sanMax: 0 })!;
    assert.equal(v.sanMax, 0);
    assert.equal(v.peMax, 0);
    const c = vitalConditions(v);
    assert.equal(c.enlouquecendo, false);
    assert.equal(c.perturbado, false);
    assert.equal(c.cansado, false);
    // o PV continua com pelo menos 1 de máximo
    assert.equal(sanitizeVitals({ pv: 0, pvMax: 0 })!.pvMax, 1);
  });
});
