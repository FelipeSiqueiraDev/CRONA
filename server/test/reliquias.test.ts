import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { combate, criaturaDoLivro, type ServerMsg } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

const look = { skin: "#e8b98f", hair: "#3b2618", hairStyle: 0, top: "#2b2a30", pants: "#1c1b1f", shoes: "#3d3a40", outfit: 1, extra: 0, charId: null };

/** Os portadores de relíquia (17/10, o Felipe: "só existe um deles"): únicos na campanha. */
describe("portadores de relíquia: únicos", () => {
  const montar = () => {
    const db = seedDb();
    upgradeDb(db);
    const hotel = new Hotel({ db, persist: false, timers: false });
    const caixa: ServerMsg[] = [];
    const c = hotel.attach((m) => caixa.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, true);
    hotel.receive(c, { t: "login", name: "Mestre", look, gmKey: hotel.gmKey });
    const sala = db.rooms[0];
    hotel.receive(c, { t: "join", roomId: sala.id });
    const pecas = () => db.rooms.flatMap((r) => r.tokens ?? []);
    const doLivro = (livro: string) => {
      const cr = criaturaDoLivro(livro, livro)!;
      hotel.receive(c, { t: "criaturaSalvar", criatura: cr });
      return cr;
    };
    return { hotel, c, caixa, pecas, doLivro };
  };

  test("a lista: o Diabo, o Deus da Morte, a Magistrada e o Anfitrião com as variações", () => {
    for (const id of ["o-diabo", "o-deus-da-morte", "mascara-do-desespero", "anfitriao", "anfitriao-liber"]) assert.ok(combate.ehPortadorDeReliquia(id), id);
    assert.ok(!combate.ehPortadorDeReliquia("existido"));
    assert.equal(combate.AMEACAS_LIVRO.find((a) => a.id === "mascara-do-desespero")?.nome, "Magistrada");
  });

  test("entra um só (mesmo pedindo três), com o nome sem número; o segundo é recusado", () => {
    const { hotel, c, caixa, pecas, doLivro } = montar();
    const diabo = doLivro("o-diabo");
    hotel.receive(c, { t: "criaturaColocar", criaturaId: diabo.id, aparencia: "variadas", quantidade: 3 });
    const deles = () => pecas().filter((t) => t.criatura?.id === diabo.id);
    assert.equal(deles().length, 1);
    assert.equal(deles()[0].name, diabo.nome);
    hotel.receive(c, { t: "criaturaColocar", criaturaId: diabo.id, aparencia: "variadas", quantidade: 1 });
    assert.equal(deles().length, 1);
    assert.ok(caixa.some((m) => m.t === "error" && /único/.test(m.msg)), "avisa que é único");
  });

  test("as variações do Anfitrião entram juntas, uma de cada; criatura comum continua em quantidade", () => {
    const { hotel, c, pecas, doLivro } = montar();
    const a = doLivro("anfitriao-aeneas");
    const b = doLivro("anfitriao-liber");
    const z = doLivro("zumbi-de-sangue");
    hotel.receive(c, { t: "criaturaColocar", criaturaId: a.id, aparencia: "variadas", quantidade: 1 });
    hotel.receive(c, { t: "criaturaColocar", criaturaId: b.id, aparencia: "variadas", quantidade: 1 });
    hotel.receive(c, { t: "criaturaColocar", criaturaId: z.id, aparencia: "variadas", quantidade: 3 });
    assert.equal(pecas().filter((t) => t.criatura?.id === a.id).length, 1);
    assert.equal(pecas().filter((t) => t.criatura?.id === b.id).length, 1);
    assert.equal(pecas().filter((t) => t.criatura?.id === z.id).length, 3);
  });
});
