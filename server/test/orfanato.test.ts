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

  test("os doze quartinhos são quartos de verdade: a cama queimada ou o teto caído, e a porta para o corredor", () => {
    const ala = porNome("Ala dos Dormitórios");
    for (let i = 0; i < 6; i++) {
      const y0 = 5 + i * 4;
      for (const [x0, x1] of [[0, 3], [9, 12]]) {
        const dentro = ala.items.filter((it) => it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y < y0 + 3);
        assert.ok(dentro.some((it) => it.defId === "cama_queimada" || it.defId === "escombros"), `quartinho ${i} (x ${x0}) vazio`);
      }
      for (const x of [4, 8]) {
        const porta = ala.items.find((it) => it.x === x && it.y === y0 + 1);
        assert.ok(porta && getFurni(porta.defId)?.cela, `falta a porta em ${x},${y0 + 1}`);
        // a casa de dentro, logo depois da porta, fica livre para entrar
        const dentro = x === 4 ? 3 : 9;
        assert.ok(!ala.items.some((it) => it.x === dentro && it.y === y0 + 1 && !getFurni(it.defId)?.walkable), `a entrada do quarto em ${dentro},${y0 + 1} está tapada`);
      }
    }
  });

  test("o fim do corredor tem as frases escritas com sangue, com o texto inteiro na pista", () => {
    const ala = porNome("Ala dos Dormitórios");
    const escrita = ala.wallItems.find((w) => w.defId === "escrita_sangue");
    assert.ok(escrita, "falta a escrita de sangue");
    assert.match(escrita.hint?.text ?? "", /sofrimento é o idioma dos escolhidos/);
  });
});
