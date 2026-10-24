import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, getWallFurni } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { JARDIM_FRITZ } from "../src/seedJardimFritz";

describe("Jardim do Fritz", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(JARDIM_FRITZ));
  const porNome = (n: string) => salas.find((r) => r.name === JARDIM_FRITZ + n)!;

  test("o lugar existe: o jardim de fora (a entrada) e o casarão nos três andares, numa campanha própria", () => {
    for (const n of ["Jardim", "Salão", "Hall da Escada", "Cozinha", "Sala de Música", "Galeria", "Terraço", "Quarto 1", "Banheiro 4", "Depósito do Subsolo", "Sala de Estudos", "Câmara do Subsolo"])
      assert.ok(porNome(n), `falta ${n}`);
    assert.equal(salas[0].name, JARDIM_FRITZ + "Jardim", "a entrada do lugar é o jardim");
    assert.ok(porNome("Jardim").aberto, "o jardim é ao ar livre");
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Jardim do Fritz");
  });

  test("toda peça existe no catálogo e fica no chão da sala; os prédios estão lá", () => {
    for (const r of salas) {
      const linhas = r.heightmap.replace(/\r/g, "").split("\n");
      const chao = (x: number, y: number) => y >= 0 && y < linhas.length && x >= 0 && x < linhas[y].length && linhas[y][x] !== "x";
      for (const it of r.items) {
        const def = getFurni(it.defId);
        assert.ok(def, `${r.name}: ${it.defId} não existe`);
        const fp = footprint(def!, it.rot);
        for (let dy = 0; dy < fp.sy; dy++) for (let dx = 0; dx < fp.sx; dx++) assert.ok(chao(it.x + dx, it.y + dy), `${r.name}: ${it.defId} em ${it.x},${it.y} sai do chão`);
      }
      for (const w of r.wallItems ?? []) assert.ok(getWallFurni(w.defId), `${r.name}: ${w.defId} (parede) não existe`);
    }
    const ids = porNome("Jardim").items.map((i) => i.defId);
    for (const id of ["casarao_fritz", "estufa_principal", "laboratorio_fritz", "alojamento_fritz", "oficina_fritz", "contencao_fritz", "gazebo_jardim", "pergolado", "fonte", "portao_mansao"])
      assert.ok(ids.includes(id), `falta ${id} no jardim`);
    assert.equal(ids.filter((i) => i === "estufa_auxiliar").length, 3);
  });

  test("toda passagem leva a outra sala do Jardim, que tem a volta, e todas se alcançam a partir do jardim", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal)) {
        assert.ok(it.link !== undefined && ids.has(it.link), `${r.name}: passagem ${it.defId} em ${it.x},${it.y} sem destino`);
        const volta = salas.find((s) => s.id === it.link)!;
        assert.ok(volta.items.some((i) => i.link === r.id), `${volta.name} não volta para ${r.name}`);
      }
    const vistos = new Set([salas[0].id]);
    const fila = [salas[0]];
    while (fila.length) {
      const r = fila.shift()!;
      for (const it of r.items) if (it.link !== undefined && !vistos.has(it.link)) {
        vistos.add(it.link);
        fila.push(salas.find((s) => s.id === it.link)!);
      }
    }
    for (const r of salas) assert.ok(vistos.has(r.id), `${r.name} não se alcança`);
  });
});
