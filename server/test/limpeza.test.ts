import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { limparSalasDeExemplo, seedDb, upgradeDb } from "../src/seed";
import { FAZENDA } from "../src/seedFazenda";
import { ORFANATO } from "../src/seedOrfanato";
import { SEDE } from "../src/seedSede";

const AGENTES = ["D.Tepes", "Catarina Albuquerque", "Alosi Walker", "Cora Falcão"];

/** O banco do jogo como está: as salas de exemplo antigas, a Sede e a Fazenda. */
function bancoComTudo() {
  const db = seedDb();
  upgradeDb(db);
  return db;
}

describe("limpeza das salas de exemplo", () => {
  test("ficam só a Sede, a Fazenda e o Orfanato, com as campanhas deles", () => {
    const db = bancoComTudo();
    const antes = db.rooms.length;
    assert.ok(db.rooms.some((r) => r.name.startsWith("Mansão Alvarez")), "o banco de exemplo tem a Mansão");
    assert.equal(limparSalasDeExemplo(db), true);
    assert.ok(db.rooms.length < antes);
    for (const r of db.rooms) assert.ok(r.name.startsWith(SEDE) || r.name.startsWith(FAZENDA) || r.name.startsWith(ORFANATO), `sobrou ${r.name}`);
    // as campanhas que sobram são as das salas que sobram
    const ids = new Set(db.rooms.map((r) => r.id));
    for (const k of Object.keys(db.campaigns ?? {})) assert.ok(ids.has(Number(k)), `campanha ${k} sem sala`);
    const titulos = Object.values(db.campaigns ?? {}).map((c) => c.title);
    assert.ok(titulos.some((t) => /Sede/.test(t)));
    assert.ok(titulos.some((t) => /Fazenda/.test(t)));
    assert.ok(titulos.some((t) => /Orfanato/.test(t)));
    assert.ok(db.home === undefined || ids.has(db.home));
  });

  test("os quatro agentes voltam para o bar e para a porteira se a limpeza os levou", () => {
    const db = bancoComTudo();
    // tira os agentes da Sede e da Fazenda (como quando ficam presos numa cena que some)
    for (const r of db.rooms) if (r.name.startsWith(SEDE) || r.name.startsWith(FAZENDA)) r.tokens = [];
    limparSalasDeExemplo(db);
    const nomes = (prefixo: string) => db.rooms.filter((r) => r.name.startsWith(prefixo)).flatMap((r) => (r.tokens ?? []).map((t) => t.name));
    for (const n of AGENTES) {
      assert.ok(nomes(SEDE).includes(n), `${n} sem lugar na Sede`);
      assert.ok(nomes(FAZENDA).includes(n), `${n} sem lugar na Fazenda`);
    }
    const bar = db.rooms.find((r) => r.name === SEDE + "Bar")!;
    assert.equal(bar.tokens?.length, 4);
  });

  test("não duplica agente que já está na Sede nem mexe nas fichas; roda uma vez só", () => {
    const db = bancoComTudo();
    const fichas = JSON.stringify(db.fichas ?? []);
    const contar = () => db.rooms.filter((r) => r.name.startsWith(SEDE)).flatMap((r) => r.tokens ?? []).length;
    const antes = contar();
    limparSalasDeExemplo(db);
    assert.equal(contar(), antes, "não repõe quem já estava");
    assert.equal(JSON.stringify(db.fichas ?? []), fichas, "as fichas ficam como estão");
    assert.equal(db.limpezaExemplos, true);
    const salas = db.rooms.length;
    assert.equal(limparSalasDeExemplo(db), false, "a segunda vez não faz nada");
    assert.equal(db.rooms.length, salas);
  });
});
