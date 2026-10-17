import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findPath, getFurni, parseHeightmap, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { FAZENDA } from "../src/seedFazenda";

/**
 * A decoração da fazenda (15/10, a "densidade" do Códex): objetinhos em cima dos tampos, conjuntos médios nos cantos,
 * sem tapar a passagem. Aqui: nada de objeto pequeno no chão (embaixo de mesa), o chão andável continua com folga e
 * nenhuma casa que dava para alcançar da porta deixou de dar.
 */

const db = seedDb();
upgradeDb(db);
const cenas = db.rooms.filter((r) => r.name.startsWith(FAZENDA));

/**
 * Os bolsos fechados (casas "x,y" no desenho final): nenhum desde 17/10, quando os três que sobravam (atrás do beliche,
 * da cama e da mesa) foram abertos pela regra do caminho livre (moveisNaParede.test.ts).
 */
const BOLSOS: Record<string, string[]> = {};
/** Ao ar livre, as roças dos vizinhos são cercadas e ninguém entra nelas pela estrada. */
const ROCAS_FECHADAS = new Set(["Arredores"]);

/** Peças pequenas, de cima de tampo: se uma fica no chão, está embaixo de mesa ou largada no meio. */
const PEQUENAS = new Set([
  "mug",
  "jarra_canecas",
  "cesta_pao",
  "food_tray",
  "beer_glass",
  "microscope",
  "med_tray",
]);

describe("decoração da fazenda", () => {
  test("os objetos pequenos ficam em cima de um tampo, nunca no chão", () => {
    const erros: string[] = [];
    for (const r of cenas) {
      const map = new RoomMap(r.heightmap, r.door, r.items);
      for (const it of r.items) {
        if (!PEQUENAS.has(it.defId)) continue;
        // o apoio: uma peça da mesma casa (a mesa pega várias) cujo topo é onde a peça pequena está
        const apoio = map.itemsAt(it.x, it.y).some((o) => {
          const d = getFurni(o.defId);
          return o !== it && !!d && !d.flat && d.height > 0.3 && Math.abs(o.z + d.height - it.z) < 0.05;
        });
        if (!apoio) erros.push(`${r.name}: ${it.defId} em ${it.x},${it.y} sem tampo embaixo`);
      }
    }
    assert.deepEqual(erros, []);
  });

  test("cada cena mantém o chão andável com folga e tudo que era alcançável continua", () => {
    for (const r of cenas) {
      const nome = r.name.slice(FAZENDA.length);
      const hm = parseHeightmap(r.heightmap);
      const map = new RoomMap(r.heightmap, r.door, r.items);
      let andaveis = 0;
      let livres = 0;
      const presos: string[] = [];
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          if (hm.tiles[y][x] === null || map.walkState(x, y) !== "walk") continue;
          andaveis++;
          if (!r.items.some((i) => i.x === x && i.y === y)) livres++;
          if (!findPath(map, r.door, { x, y }, () => false)) presos.push(`${x},${y}`);
        }
      // a Sala de Sangue já é só corpo, mesa e mancha (decalque conta como peça aqui): não entra na conta
      if (nome !== "Sala de Sangue") assert.ok(livres / andaveis >= 0.6, `${nome}: só ${Math.round((100 * livres) / andaveis)}% do chão andável livre`);
      if (ROCAS_FECHADAS.has(nome)) continue;
      assert.deepEqual(presos, BOLSOS[nome] ?? [], `${nome}: casas que não se alcançam da porta`);
    }
  });
});
