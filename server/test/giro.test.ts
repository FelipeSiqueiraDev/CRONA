import assert from "node:assert/strict";
import { test } from "node:test";
import { getFurni, giroQueCabe, RoomMap } from "@crona/shared";

test("girar: quando o giro de 90° não cabe, a peça inverte o lado (180°)", () => {
  // um corredor de 1 casa de largura e 4 de comprimento: a cama (1 × 3) cabe em pé, nunca deitada
  const map = new RoomMap("0000\n0000\n0000\n0000\n0000".replace(/0000/g, "0"), { x: 0, y: 0, dir: 4 }, []);
  const cama = getFurni("bed")!;
  const cabe = (r: number) => map.canPlace("bed", 0, 1, r).ok;
  assert.ok(cabe(4), "em pé cabe");
  assert.ok(!cabe(2) && !cabe(6), "deitada não cabe");
  assert.equal(giroQueCabe(cama, 4, cabe), 0, "pula o 6 e vai para o 0");
  assert.equal(giroQueCabe(cama, 0, cabe), 4);
  // num quarto onde nada além do giro atual cabe, não gira
  assert.equal(giroQueCabe(cama, 4, (r) => r === 4), null);
});
