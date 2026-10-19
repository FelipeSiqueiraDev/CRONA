import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "node:test";
import { regras, type FichaSalva } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";
import { aplicarFichasCris, FICHAS_CRIS } from "../src/seedFichasCris";

/** As fichas do C.R.I.S no CRONA (18/10): cada uma calcula os números do C.R.I.S, ou difere só pelo motivo anotado. */
const cris = JSON.parse(fs.readFileSync(new URL("../../docs/fichas-cris/fichas-do-cris.json", import.meta.url), "utf8")) as {
  agent_sheets: { character_name: string; pv_max: number; pe_max: number; san_max: number; defesa: number; agi: number; forca: number; intel: number; pre: number; vig: number; dt_rituais: number; pp: number }[];
};
const doCris = (nome: string) => cris.agent_sheets.find((s) => s.character_name === nome)!;

/** O que o CRONA calcula quando é diferente do C.R.I.S (e por quê), por ficha: [campo, valor do CRONA]. */
const DIFERENCAS: Record<string, Record<string, number>> = {
  // regra da mesa (19/10): o aumento de Vigor e de Presença só vale do NEX dele em diante; o C.R.I.S soma em todos
  miguel: { pe: 57 },
  agatha: { pe: 109 },
  // o C.R.I.S tem 6 Transcender; o livro dá 5 até NEX 65% (a Expansão de Conhecimento ficou de fora): +5 de SAN;
  // e o Vigor de cada aumento só do NEX dele em diante
  nico: { pv: 53, san: 68 },
  // o 100 do C.R.I.S não soma Calejado (+14) nem Casca Grossa (+14); o +2 do Tanque de Guerra é condicional; e o
  // Vigor de cada aumento só do NEX dele em diante
  verissimo: { pv: 119, defesa: 22 },
  // o bônus de Reflexos Defensivos é condicional; o Vigor de cada aumento só do NEX dele em diante
  interrogacao: { pv: 98, defesa: 12 },
  // sobrecarregado pelas contas do livro (19 de 15 espaços): −5 na Defesa; o Vigor e a Presença de cada aumento só do
  // NEX dele em diante
  omega: { pv: 77, pe: 131, defesa: 25 },
};

describe("fichas do C.R.I.S", () => {
  test("PV, PE, SAN, Defesa e atributos batem com o C.R.I.S (ou diferem só pelo motivo anotado)", () => {
    assert.equal(FICHAS_CRIS.length, 8);
    for (const e of FICHAS_CRIS) {
      const s = doCris(e.nomeCris);
      assert.ok(s, `${e.nomeCris} não está no C.R.I.S`);
      const c = regras.calcular(e.ficha);
      const dif = DIFERENCAS[e.chave] ?? {};
      assert.equal(c.pv, dif.pv ?? s.pv_max, `${e.chave}: PV`);
      assert.equal(c.pe, dif.pe ?? s.pe_max, `${e.chave}: PE`);
      assert.equal(c.san, dif.san ?? s.san_max, `${e.chave}: SAN`);
      assert.equal(c.defesa, dif.defesa ?? s.defesa, `${e.chave}: Defesa`);
      assert.deepEqual([c.atributos.agi, c.atributos.for, c.atributos.int, c.atributos.pre, c.atributos.vig], [s.agi, s.forca, s.intel, s.pre, s.vig], `${e.chave}: atributos`);
      assert.equal(e.ficha.pp, s.pp, `${e.chave}: PP`);
      assert.equal(e.ficha.nome, e.chave === "verissimo" ? "Veríssimo" : e.nomeCris, `${e.chave}: nome`);
      // nada de item, poder, ritual ou trilha que o catálogo não conhece
      assert.deepEqual(
        c.problemas.filter((p) => /desconhecid/i.test(p.texto)),
        [],
        `${e.chave}: algo fora do catálogo`,
      );
    }
  });

  test("os rituais do Nico e do Ômega-99 são os do C.R.I.S", () => {
    const nome = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rit = (chave: string, cr: string) => {
      const c = regras.calcular(FICHAS_CRIS.find((e) => e.chave === chave)!.ficha);
      const sheet = (cris as unknown as { agent_sheets: { character_name: string; rituais_json: { name: string }[] }[] }).agent_sheets.find((x) => x.character_name === cr)!;
      return { crona: new Set(c.rituais.map((r) => r.id)), cris: sheet.rituais_json.map((r) => nome(r.name)) };
    };
    for (const [chave, cr] of [["nico", "Nico Delagnore"], ["omega", "Ômega-99"]] as const) {
      const r = rit(chave, cr);
      for (const id of r.cris) assert.ok(r.crona.has(id), `${chave}: falta o ritual ${id}`);
    }
  });

  test("as que o C.R.I.S deixou em branco ficam como pendência do mestre, sem escolha inventada", () => {
    for (const chave of ["ivete", "marcela"]) {
      const f = FICHAS_CRIS.find((e) => e.chave === chave)!.ficha;
      assert.equal(f.origem, null);
      assert.equal(f.trilha, null);
      assert.deepEqual(f.pericias, { grupos: [], livres: [] });
      assert.deepEqual(f.progressao, {});
      assert.ok(regras.calcular(f).pendencias.length > 5);
    }
    // a Agatha: só o que o C.R.I.S tinha (um aumento de atributo, nenhum poder, nenhum ritual)
    const a = FICHAS_CRIS.find((e) => e.chave === "agatha")!.ficha;
    assert.deepEqual(Object.keys(a.progressao), ["20"]);
    assert.equal(a.inventario.length, 0);
  });

  const NOVOS = ["marcela-geleerd", "nico-delagnore", "sr-verissimo", "omega-99", "interrogacao"];
  /** Um banco com o Elenco e os personagens das artes (como o do jogo), sem as fichas do C.R.I.S. */
  function banco() {
    const db = seedDb();
    db.gmKey = "teste"; // um banco já usado (o do jogo)
    upgradeDb(db);
    assert.ok(db.npcs, "o Elenco padrão");
    // o hotel cria o personagem de cada arte (e, de passagem, já aplica as fichas: o teste recomeça sem elas)
    new Hotel({ db, persist: false, timers: false });
    db.fichas = [];
    delete (db as { fichasCris?: unknown }).fichasCris;
    db.npcs = db.npcs.filter((n) => !NOVOS.includes(n.id));
    return db;
  }

  test("cria as fichas ligadas aos NPCs do Elenco, e as avulsas entram no Elenco sem peça", () => {
    const db = banco();
    assert.equal(aplicarFichasCris(db), true);
    const fichas = db.fichas as FichaSalva[];
    assert.equal(fichas.length, 8);
    for (const id of ["miguel-albuquerque", "agata", "ivete"]) {
      const f = fichas.find((x) => x.npc === id)!;
      assert.ok(f, `falta a ficha do NPC ${id}`);
      const arte = db.npcs!.find((n) => n.id === id)!.arte!;
      const ch = db.characters.find((c) => c.sheet.includes(`/personagens/${arte}/`));
      assert.ok(ch, `o personagem de ${id}`);
      assert.equal(f.personagem, ch.id, `${id} ligada ao personagem`);
    }
    // a Agatha do CRONA é a Agatha Volkomenn do C.R.I.S
    assert.equal(fichas.find((x) => x.npc === "agata")!.nome, "Agatha Volkomenn");
    // as avulsas: NPC novo no Elenco, sem arte, e a ficha sem peça (sem personagem)
    for (const id of ["marcela-geleerd", "nico-delagnore", "sr-verissimo", "omega-99", "interrogacao"]) {
      const n = db.npcs!.find((x) => x.id === id);
      assert.ok(n, `falta ${id} no Elenco`);
      assert.equal(n.arte, undefined);
      const f = fichas.find((x) => x.npc === id)!;
      assert.ok(f, `falta a ficha de ${id}`);
      assert.equal(f.personagem, undefined);
    }
    // os ids das fichas são únicos e o contador anda
    assert.equal(new Set(fichas.map((f) => f.id)).size, 8);
    assert.ok((db.nextFichaId ?? 0) > Math.max(...fichas.map((f) => f.id)));
    // cada ficha guarda a nota do que veio e do que difere
    for (const f of fichas) assert.match(f.notas?.anotacoes ?? "", /C\.R\.I\.S/);
  });

  test("é idempotente e o que o mestre apagou não volta", () => {
    const db = banco();
    aplicarFichasCris(db);
    const antes = JSON.stringify(db.fichas);
    const npcs = db.npcs!.length;
    assert.equal(aplicarFichasCris(db), false, "de novo não muda nada");
    assert.equal(JSON.stringify(db.fichas), antes);
    assert.equal(db.npcs!.length, npcs);
    // o mestre apaga a ficha do Miguel e o NPC Nico: não voltam
    db.fichas = db.fichas!.filter((f) => f.npc !== "miguel-albuquerque");
    db.npcs = db.npcs!.filter((n) => n.id !== "nico-delagnore");
    aplicarFichasCris(db);
    assert.equal(db.fichas.some((f) => f.npc === "miguel-albuquerque"), false);
    assert.equal(db.npcs.some((n) => n.id === "nico-delagnore"), false);
  });

  test("nunca sobrescreve uma ficha que o mestre já tem para o NPC", () => {
    const db = banco();
    const minha = regras.novaFicha("Miguel (do mestre)");
    minha.nex = 25;
    db.fichas!.push({ id: 7, nome: "Miguel (do mestre)", npc: "miguel-albuquerque", ficha: minha, criadaEm: "2026-10-17T00:00:00.000Z", atualizadaEm: "2026-10-17T00:00:00.000Z" });
    db.nextFichaId = 8;
    aplicarFichasCris(db);
    const lista = db.fichas!.filter((f) => f.npc === "miguel-albuquerque");
    assert.equal(lista.length, 1);
    assert.equal(lista[0].nome, "Miguel (do mestre)");
    assert.equal(lista[0].ficha.nex, 25);
    assert.equal(lista[0].notas, undefined);
    // só ganhou o link com o personagem; as outras 7 foram criadas
    assert.ok(lista[0].personagem);
    assert.equal(db.fichas!.length, 8);
  });

  test("não rouba o personagem de uma ficha que já o tem (as dos Marcados)", () => {
    const db = banco();
    const ch = db.characters.find((c) => c.sheet.includes("/personagens/agata/"))!;
    const outra = regras.novaFicha("Outra");
    db.fichas!.push({ id: 3, nome: "Outra", personagem: ch.id, ficha: outra, criadaEm: "2026-10-17T00:00:00.000Z", atualizadaEm: "2026-10-17T00:00:00.000Z" });
    db.nextFichaId = 4;
    aplicarFichasCris(db);
    assert.equal(db.fichas!.find((f) => f.npc === "agata")!.personagem, undefined);
    assert.equal(db.fichas!.find((f) => f.id === 3)!.personagem, ch.id);
  });

  test("banco novo (sem a chave do mestre) ou sem Elenco fica como está, e não atrapalha o Elenco padrão", () => {
    const db = seedDb();
    assert.equal(aplicarFichasCris(db), false);
    assert.equal(db.fichas, undefined);
    // banco usado, mas ainda sem Elenco: espera a subida seguinte
    delete db.npcs;
    db.gmKey = "teste";
    assert.equal(aplicarFichasCris(db), false);
    assert.equal(db.npcs, undefined);
    upgradeDb(db);
    const elenco = db.npcs as { id: string }[] | undefined;
    assert.ok(elenco?.some((n) => n.id === "miguel-albuquerque"), "o Miguel do Elenco padrão");
    // um banco novo no hotel não ganha as fichas
    const novo = seedDb();
    new Hotel({ db: novo, persist: false, timers: false });
    assert.equal(novo.fichas?.length ?? 0, 0);
  });

  test("o jogo sobe com as fichas dos NPCs e as peças pegam os números", () => {
    const db = banco();
    const h = new Hotel({ db, persist: false, timers: false });
    upgradeDb(db);
    assert.ok(h);
    assert.equal(db.fichas!.length, 8);
    // os números de uma delas saem do motor sem erro
    for (const f of db.fichas!) assert.doesNotThrow(() => regras.calcular(f.ficha), f.nome);
  });
});
