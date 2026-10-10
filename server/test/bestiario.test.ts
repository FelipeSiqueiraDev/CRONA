import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { aparenciaDaVez, criaturaDoLivro, existidoPadrao, lerCriatura } from "@crona/shared";
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
});
