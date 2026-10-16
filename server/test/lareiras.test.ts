import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, type FloorItem } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";

/**
 * As lareiras (16/10, o Felipe: "verifica se as lareiras estão todas encostadas na parede e se não tem nenhum objeto
 * diretamente na frente dela; pode ter uma poltrona a 1 quadrado de distância, mas não colado"): em todas as cenas
 * de todos os lugares, a lareira tem o fundo na parede (a casa atrás de cada casa dela é fora da sala) e a fileira
 * de casas logo na frente dela livre (tapete e o que é chato no chão podem).
 */
/** toda lareira, pelo tipo (a de pedra, a de cristal de Santo Berço e as que vierem) */
const ehLareira = (i: FloorItem) => getFurni(i.defId)?.kind === "lareira";

/** As casas do fundo (de fora, atrás) e da frente (dentro, colada) da peça, pelo giro (4: a frente para +y). */
function fundoEFrente(it: FloorItem) {
  const def = getFurni(it.defId)!;
  const fp = footprint(def, it.rot);
  const atras: [number, number][] = [];
  const frente: [number, number][] = [];
  if (it.rot === 4 || it.rot === 0) {
    for (let x = it.x; x < it.x + fp.sx; x++) {
      atras.push([x, it.rot === 4 ? it.y - 1 : it.y + fp.sy]);
      frente.push([x, it.rot === 4 ? it.y + fp.sy : it.y - 1]);
    }
  } else {
    for (let y = it.y; y < it.y + fp.sy; y++) {
      atras.push([it.rot === 2 ? it.x - 1 : it.x + fp.sx, y]);
      frente.push([it.rot === 2 ? it.x + fp.sx : it.x - 1, y]);
    }
  }
  return { atras, frente };
}

describe("lareiras", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.items.some((i) => ehLareira(i)));

  test("há lareiras para conferir", () => assert.ok(salas.length > 0));

  for (const r of salas) {
    const linhas = r.heightmap.replace(/\r/g, "").split("\n");
    const chao = (x: number, y: number) => y >= 0 && y < linhas.length && x >= 0 && x < linhas[y].length && linhas[y][x] !== "x";
    const ocupa = (x: number, y: number, fora: FloorItem) =>
      r.items.find((o) => {
        if (o === fora) return false;
        const d = getFurni(o.defId);
        if (!d || d.flat || d.portal || d.hidden) return false;
        const fp = footprint(d, o.rot);
        return x >= o.x && x < o.x + fp.sx && y >= o.y && y < o.y + fp.sy;
      });
    for (const it of r.items.filter((i) => ehLareira(i)))
      test(`${r.name}: ${it.defId} em ${it.x},${it.y} (giro ${it.rot})`, () => {
        const { atras, frente } = fundoEFrente(it);
        for (const [x, y] of atras) assert.ok(!chao(x, y), `não encosta na parede: a casa ${x},${y} atrás dela é chão`);
        for (const [x, y] of frente) {
          const o = ocupa(x, y, it);
          assert.ok(!o, `${o?.defId} colado na frente, em ${x},${y}`);
        }
      });
  }
});
