import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { MANSAO } from "../src/seedMansaoAlbuquerque";
import { SANTA_AMALIA } from "../src/seedSantaAmalia";

describe("Mansão Albuquerque: cada um no seu posto", () => {
  const db = seedDb();
  upgradeDb(db);
  upgradeDb(db); // a segunda passada é a do servidor que sobe com o banco já na versão
  const ondeEsta = (nome: string) => db.rooms.find((r) => r.tokens?.some((t) => t.name === nome));

  test("os empregados e a família saem do Salão para o cômodo deles", () => {
    const esperado: [string, string][] = [
      ["Helena Duarte", "Corredor dos Funcionários"],
      ["Lúcia Moreira", "Cozinha"],
      ["Roberto Salles", "Jardim"],
      ["Tiago Nobre", "Jardim"],
      ["Alexander Albuquerque", "Escritório de Alexander"],
      ["Arthur Albuquerque", "Biblioteca"],
      ["Marina Ferraz", "Biblioteca"],
      ["Antônio Valença", "Salão Principal"],
    ];
    for (const [nome, sala] of esperado) {
      const r = ondeEsta(nome);
      if (!r) continue; // a peça ainda não existe neste banco
      assert.equal(r.name, MANSAO + sala, `${nome} devia estar em ${sala}`);
    }
  });

  test("ninguém fica em cima de móvel nem de outra peça; o Alexander senta no trono", () => {
    for (const r of db.rooms.filter((q) => q.name.startsWith(MANSAO))) {
      const map = new RoomMap(r.heightmap, r.door, r.items, r.wallItems);
      const casas = new Set<string>();
      for (const t of r.tokens ?? []) {
        assert.notEqual(map.walkState(t.x, t.y), "blocked", `${t.name} em casa tapada em ${r.name}`);
        assert.ok(!casas.has(`${t.x},${t.y}`), `${t.name} em cima de outra peça`);
        casas.add(`${t.x},${t.y}`);
      }
    }
    const esc = db.rooms.find((r) => r.name === MANSAO + "Escritório de Alexander")!;
    const alex = esc.tokens?.find((t) => t.name === "Alexander Albuquerque");
    if (alex) assert.ok(esc.items.some((i) => i.defId === "trono_alexander" && i.x === alex.x && i.y === alex.y), "o Alexander no trono");
  });
});

describe("Santa Amália: a gente no tabuleiro", () => {
  const db = seedDb();
  upgradeDb(db);
  upgradeDb(db); // a segunda passada é a do servidor que sobe com o banco já na versão
  test("cada um no cômodo dele, numa casa livre", () => {
    const esperado: [string, string][] = [
      ["Augusto Valença", "Sala dos Valença"],
      ["Francine Valença", "Sala dos Valença"],
      ["Ana Valença", "Quarto da Filha"],
      ["Sônia Nogueira", "Recepção do Posto"],
      ["Herman Arantes", "Consultório"],
      ["Lívia Monteiro", "Atendimento do Cartório"],
    ];
    for (const [nome, sala] of esperado) {
      const r = db.rooms.find((q) => q.tokens?.some((t) => t.name === nome));
      assert.equal(r?.name, SANTA_AMALIA + sala, `${nome} devia estar em ${sala}`);
      const t = r!.tokens!.find((q) => q.name === nome)!;
      const map = new RoomMap(r!.heightmap, r!.door, r!.items, r!.wallItems);
      assert.equal(map.walkState(t.x, t.y), "walk", `${nome} em casa tapada`);
    }
  });
});
