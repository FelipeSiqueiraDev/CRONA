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
    for (const n of ["Pátio", "Enfermaria", "Salão", "Cozinha", "Depósito", "Quarto da Diretora", "Sanitários", "Banheiro", "Sala de Banho", "Ala dos Dormitórios", "Sala de Cirurgia"])
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

  test("os doze quartos são cenas: a porta do corredor leva a cada um, com a cama queimada, o teto caído ou a jaula", () => {
    const ala = porNome("Ala dos Dormitórios");
    for (let n = 1; n <= 12; n++) {
      const q = porNome(`Quarto ${n}`);
      assert.ok(q, `falta o Quarto ${n}`);
      assert.ok(ala.items.some((it) => it.defId === "portal" && it.link === q.id), `o corredor não leva ao Quarto ${n}`);
      assert.ok(q.items.some((it) => ["cama_queimada", "escombros", "colchao_chao"].includes(it.defId)), `Quarto ${n} vazio`);
    }
  });

  test("a área aberta onde o corredor termina (o salão) tem as frases escritas com sangue, com o texto inteiro na pista", () => {
    const salao = porNome("Salão");
    const escrita = salao.wallItems.find((w) => w.defId === "escrita_sangue");
    assert.ok(escrita, "falta a escrita de sangue");
    assert.match(escrita.hint?.text ?? "", /sofrimento é o idioma dos escolhidos/);
  });
});
