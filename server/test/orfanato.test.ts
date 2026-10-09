import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getFurni } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { ORFANATO } from "../src/seedOrfanato";

describe("Orfanato Filhos do Dragão", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(ORFANATO));
  const porNome = (n: string) => salas.find((r) => r.name === ORFANATO + n)!;

  test("o lugar existe: o pátio, o casarão e o anexo, numa campanha com o nome do lugar", () => {
    for (const n of ["Pátio", "Salão", "Refeitório", "Sala de Estudos", "Quarto da Diretora", "Banheiros", "Ala dos Dormitórios", "Anexo"])
      assert.ok(porNome(n), `falta ${n}`);
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Orfanato Filhos do Dragão");
    assert.equal(salas[0].name, ORFANATO + "Pátio", "a entrada do lugar é o pátio");
  });

  test("toda passagem leva a outra sala do orfanato, que tem a volta, e todas se alcançam a partir do pátio", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal && i.defId !== "porteira")) {
        assert.ok(it.link !== undefined && ids.has(it.link), `${r.name}: passagem em ${it.x},${it.y} sem destino`);
        const volta = salas.find((s) => s.id === it.link)!;
        assert.ok(volta.items.some((i) => i.link === r.id), `${volta.name} não volta para ${r.name}`);
      }
    const vistos = new Set([porNome("Pátio").id]);
    const fila = [porNome("Pátio")];
    while (fila.length) {
      const r = fila.shift()!;
      for (const it of r.items)
        if (it.link !== undefined && !vistos.has(it.link)) {
          vistos.add(it.link);
          fila.push(salas.find((s) => s.id === it.link)!);
        }
    }
    assert.equal(vistos.size, salas.length, "alguma sala ficou sem caminho");
  });

  test("os doze quartinhos: doze camas na ala, e o vão da porta de cada um livre para o corredor", () => {
    const ala = porNome("Ala dos Dormitórios");
    assert.equal(ala.items.filter((i) => i.defId === "cama_solteiro").length, 12);
    for (let i = 0; i < 6; i++) {
      const y = 2 + i * 4;
      for (const x of [4, 8]) assert.ok(!ala.items.some((it) => it.x === x && it.y === y), `a porta em ${x},${y} está tapada`);
    }
  });
});
