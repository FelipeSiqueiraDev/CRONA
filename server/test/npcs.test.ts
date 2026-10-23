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
    assert.deepEqual(db.npcs.map((n) => n.id).sort(), ["agata", "alexander-albuquerque", "antonio-valenca", "arthur-albuquerque", "camarilla", "geraldo-ribeiro", "helena-duarte", "herman-arantes", "ivete", "lucia-moreira", "marina-ferraz", "miguel-albuquerque", "npc-cabelo-rosa", "npc-camisa-rosa", "npc-jaleco", "npc-ruivo", "roberto-salles", "samuel", "sara-ribeiro", "tiago-nobre"]);
  });

  test("os empregados e o Arthur Albuquerque entram no elenco, no grupo da mansão (21/10)", () => {
    const db = seedDb();
    upgradeDb(db);
    db.npcs = db.npcs!.filter((n) => n.id === "miguel-albuquerque");
    db.npcGrupos = ["Ordo Realitas"];
    delete db.npcsRev;
    upgradeDb(db);
    const mansao = db.npcs!.filter((n) => n.grupo === "Mansão Albuquerque").map((n) => n.id).sort();
    assert.deepEqual(mansao, ["alexander-albuquerque", "antonio-valenca", "arthur-albuquerque", "helena-duarte", "lucia-moreira", "marina-ferraz", "roberto-salles", "tiago-nobre"]);
    assert.ok(db.npcGrupos!.includes("Mansão Albuquerque"));
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

  test("a Camarilla: no elenco com a altura de cachorro, e no companheiro do Tepes com o nome e a foto", () => {
    const db = seedDb();
    upgradeDb(db);
    const c = db.npcs!.find((n) => n.id === "camarilla");
    assert.ok(c, "falta a Camarilla");
    assert.equal(c.altura, 0.8);
    assert.equal(lerNpc({ ...c })?.altura, 0.8, "a altura passa pela conferência");
    const tepes = (db.fichas ?? []).find((f) => /tepes/i.test(f.nome));
    if (tepes) {
      tepes.companheiro = { nome: "Cão de guarda", tipo: "Cão adestrado" };
      upgradeDb(db);
      assert.equal(tepes.companheiro.nome, "Camarilla");
      assert.equal(tepes.companheiro.imagem, "camarilla-rosto.jpg");
    }
  });

  test("todo NPC é único: o segundo é recusado, e o Elenco sabe quem está em campo", () => {
    const db = seedDb();
    upgradeDb(db);
    const hotel = new Hotel({ db, persist: false, timers: false });
    const caixa: { t: string; msg?: string; npcsEmCampo?: string[] }[] = [];
    const c = hotel.attach((m) => caixa.push(JSON.parse(JSON.stringify(m))), undefined, true);
    const look = db.npcs![0].look;
    hotel.receive(c, { t: "login", name: "Mestre", look, gmKey: hotel.gmKey });
    hotel.receive(c, { t: "join", roomId: db.rooms[0].id });
    const pecas = () => db.rooms.flatMap((r) => r.tokens ?? []).filter((t) => t.name.startsWith("Miguel"));
    hotel.receive(c, { t: "npcColocar", npcId: "miguel-albuquerque" });
    hotel.receive(c, { t: "npcColocar", npcId: "miguel-albuquerque" });
    assert.equal(pecas().length, 1);
    assert.ok(caixa.some((m) => m.t === "error" && /já está em cena/.test(m.msg ?? "")));
    hotel.receive(c, { t: "bestiario" });
    const ultimo = [...caixa].reverse().find((m) => m.t === "bestiario");
    assert.deepEqual(ultimo?.npcsEmCampo, ["miguel-albuquerque"]);
  });

  test("o nome escrito no Quem é dos NPCs novos vai para o nome", () => {
    const db = seedDb();
    upgradeDb(db);
    const p = db.npcs!.find((n) => n.id === "npc-camisa-rosa")!;
    const r = db.npcs!.find((n) => n.id === "npc-ruivo")!;
    Object.assign(p, { nome: "Camisa Rosa", nota: "Pedro Cavalcante" });
    Object.assign(r, { nome: "Ruivo", nota: "nome em aberto" });
    upgradeDb(db);
    assert.equal(p.nome, "Pedro Cavalcante");
    assert.equal(p.nota, undefined);
    assert.equal(r.nome, "Ruivo");
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

/** A outra forma do NPC (19/10): o clique duplo do mestre troca o NPC pela criatura e volta; os dois nunca ficam juntos. */
describe("a outra forma do NPC", () => {
  test("troca no mesmo lugar, guarda os PV de cada forma e recusa as duas em campo", () => {
    const db = seedDb();
    upgradeDb(db);
    const samuel = db.npcs!.find((n) => n.id === "samuel")!;
    samuel.forma = { livro: "minotauro" };
    assert.deepEqual(lerNpc({ ...samuel })?.forma, { livro: "minotauro" }, "a forma passa pela conferência");
    const hotel = new Hotel({ db, persist: false, timers: false });
    const caixa: { t: string; msg?: string }[] = [];
    const c = hotel.attach((m) => caixa.push(JSON.parse(JSON.stringify(m))), undefined, true);
    hotel.receive(c, { t: "login", name: "Mestre", look: samuel.look, gmKey: hotel.gmKey });
    const sala = db.rooms[0];
    hotel.receive(c, { t: "join", roomId: sala.id });
    hotel.receive(c, { t: "npcColocar", npcId: "samuel" });
    const peca = () => sala.tokens!.find((t) => t.name === "Samuel Norte" || t.name === "Minotauro")!;
    const antes = { ...peca() };
    hotel.receive(c, { t: "pecaForma", tokenId: antes.id });
    const virou = peca();
    assert.equal(virou.name, "Minotauro");
    assert.ok(virou.criatura, "a peça é a criatura");
    assert.deepEqual([virou.x, virou.y, virou.id], [antes.x, antes.y, antes.id], "no mesmo lugar, a mesma peça");
    // as duas em campo, não: nem o NPC de novo, nem outra criatura dessa forma
    hotel.receive(c, { t: "npcColocar", npcId: "samuel" });
    const cr = db.bestiario!.find((x) => x.ficha.livro === "minotauro")!;
    hotel.receive(c, { t: "criaturaColocar", criaturaId: cr.id });
    assert.equal(sala.tokens!.filter((t) => t.name.startsWith("Samuel") || t.name.startsWith("Minotauro")).length, 1);
    // os PV da criatura ficam guardados para a próxima vez
    virou.vitals = { ...virou.vitals!, pv: 10 };
    hotel.receive(c, { t: "join", roomId: sala.id });
    hotel.receive(c, { t: "pecaForma", tokenId: antes.id });
    assert.equal(peca().name, "Samuel Norte");
    assert.equal(peca().criatura, undefined);
    hotel.receive(c, { t: "npcColocar", npcId: "samuel" });
    assert.equal(sala.tokens!.filter((t) => t.name.startsWith("Samuel")).length, 1, "de volta, continua único");
    // NPC sem forma: o clique duplo não faz nada
    hotel.receive(c, { t: "npcColocar", npcId: "ivete" });
    const iv = sala.tokens!.find((t) => t.name.startsWith("Ivete"))!;
    hotel.receive(c, { t: "pecaForma", tokenId: iv.id });
    assert.equal(sala.tokens!.find((t) => t.id === iv.id)!.name, iv.name);
  });
});

describe("a outra forma pelo clique do tabuleiro", () => {
  test("o número da peça na tela (o negativo) também troca", () => {
    const db = seedDb();
    upgradeDb(db);
    db.npcs!.find((n) => n.id === "samuel")!.forma = { livro: "minotauro" };
    const hotel = new Hotel({ db, persist: false, timers: false });
    const c = hotel.attach(() => {}, undefined, true);
    hotel.receive(c, { t: "login", name: "Mestre", look: db.npcs![0].look, gmKey: hotel.gmKey });
    const sala = db.rooms[0];
    hotel.receive(c, { t: "join", roomId: sala.id });
    hotel.receive(c, { t: "npcColocar", npcId: "samuel" });
    const id = sala.tokens!.find((t) => t.name === "Samuel Norte")!.id;
    hotel.receive(c, { t: "pecaForma", tokenId: -id });
    assert.equal(sala.tokens!.find((t) => t.id === id)!.name, "Minotauro");
  });
});
