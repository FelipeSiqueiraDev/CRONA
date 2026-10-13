import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findPath, getFurni, RoomMap, type FloorItem } from "@crona/shared";
import type { Database } from "../src/db";
import { mesasMaisAltas } from "../src/seed";

/** Sala 7×5 de chão liso, a porta na parede de cima. */
function sala(items: FloorItem[] = []) {
  const hm = Array.from({ length: 5 }, () => "0000000").join("\n");
  return new RoomMap(hm, { x: 3, y: 0, dir: 4 }, items);
}
let id = 1;
const item = (defId: string, x: number, y: number, rot = 0, z = 0): FloorItem => ({ id: id++, defId, x, y, z, rot, state: 0 });

describe("Mesas com vão (12/10)", () => {
  test("as mesas são maiores que a pegada e têm a altura junto", () => {
    for (const m of ["desk_wood", "table_work", "table_bar", "mesa_jantar"]) {
      const d = getFurni(m)!;
      assert.ok((d.aumento ?? 1) > 1, `${m} cresce`);
      assert.ok(d.vao, `${m} tem vão`);
      assert.ok(d.height >= 0.9, `${m} na altura nova`);
    }
    assert.equal(getFurni("table_work")!.vao, "vazada");
    assert.equal(getFurni("desk_wood")!.vao, "fundo");
  });

  test("a cadeira encaixa embaixo da mesa, no chão; o que vai para a mesa fica em cima", () => {
    const m = sala([item("table_work", 2, 2, 0)]);
    const c = m.canPlace("chair_wood", 3, 2, 0);
    assert.ok(c.ok, c.reason ?? '');
    assert.equal(c.z, 0);
    m.addItem(item("chair_wood", 3, 2, 0, c.z));
    // a segunda cadeira na mesma casa: já tem algo embaixo
    assert.equal(m.canPlace("chair_office", 3, 2, 0).ok, false);
    // a caneca vai para o tampo, mesmo com a cadeira embaixo
    const p = m.canPlace("mug", 3, 2, 0);
    assert.ok(p.ok, p.reason ?? '');
    assert.equal(p.z, getFurni("table_work")!.height);
    // a mesa posta em cima de uma cadeira que já estava lá
    const m2 = sala([item("chair_wood", 1, 1, 0)]);
    const t = m2.canPlace("desk_wood", 1, 1, 0);
    assert.ok(t.ok, t.reason ?? '');
    assert.equal(t.z, 0);
  });

  test("embaixo da mesa vazada se passa, abaixado; a com fundo bloqueia", () => {
    const vazada = sala([item("table_work", 2, 2, 0)]);
    assert.equal(vazada.walkState(3, 2), "walk");
    assert.equal(vazada.standHeight(3, 2), 0);
    assert.ok(vazada.sobMesa(3, 2));
    // com uma caneca em cima, embaixo continua livre
    vazada.addItem(item("mug", 3, 2, 0, getFurni("table_work")!.height));
    assert.equal(vazada.walkState(3, 2), "walk");
    assert.equal(vazada.standHeight(3, 2), 0);
    const fundo = sala([item("desk_wood", 2, 2, 0)]);
    assert.equal(fundo.walkState(2, 2), "blocked");
    assert.equal(fundo.sobMesa(2, 2), false);
  });

  test("o caminho só passa por baixo quando precisa", () => {
    // a mesa de 3 casas tapa o meio; dá para contornar pela ponta
    const m = sala([item("table_work", 1, 2, 0)]);
    const livre = () => false;
    const rodeia = findPath(m, { x: 2, y: 1 }, { x: 2, y: 4 }, livre)!;
    assert.ok(rodeia);
    assert.ok(!rodeia.some((p) => m.sobMesa(p.x, p.y)), "contorna a mesa");
    // e a peça pode parar embaixo dela, escondida
    const esconde = findPath(m, { x: 2, y: 0 }, { x: 2, y: 2 }, livre)!;
    assert.deepEqual(esconde.at(-1), { x: 2, y: 2 });
  });

  test("no banco antigo, o que estava em cima da mesa sobe com ela (uma vez só)", () => {
    const desk = getFurni("desk_wood")!;
    const antiga = desk.height / desk.aumento!;
    const db = {
      rooms: [
        {
          id: 1,
          items: [
            item("desk_wood", 1, 1, 0),
            item("desk_lamp", 2, 1, 0, antiga),
            item("chair_wood", 3, 3, 0),
            item("mug", 1, 1, 0, desk.height),
          ],
        },
      ],
    } as unknown as Database;
    assert.equal(mesasMaisAltas(db), true);
    const [, lampada, cadeira, caneca] = db.rooms[0].items;
    assert.ok(Math.abs(lampada.z - desk.height) < 0.002, "a luminária subiu para o tampo novo");
    assert.equal(cadeira.z, 0);
    assert.equal(caneca.z, desk.height, "o que já estava no tampo novo fica");
    assert.equal(mesasMaisAltas(db), false, "uma vez só");
  });
});
