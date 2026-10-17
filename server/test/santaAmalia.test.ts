import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, getWallFurni, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { SANTA_AMALIA } from "../src/seedSantaAmalia";

describe("Santa Amália", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(SANTA_AMALIA));
  const porNome = (n: string) => salas.find((r) => r.name === SANTA_AMALIA + n)!;

  test("o lugar existe: a cidade e os três prédios da história, cômodo por cômodo, numa campanha com o nome do lugar", () => {
    const nomes = [
      "Cidade",
      "Sala dos Valença", "Cozinha dos Valença", "Área de Serviço dos Valença", "Banheiro dos Valença", "Quarto do Casal", "Quarto da Filha",
      "Recepção do Posto", "Consultório", "Sala de Procedimentos", "Triagem", "Farmácia do Posto", "Banheiro do Posto", "Administração do Posto",
      "Atendimento do Cartório", "Sala do Oficial", "Arquivo do Cartório", "Depósito do Cartório", "Banheiro do Cartório", "Copa do Cartório",
      "Casa",
    ];
    for (const n of nomes) assert.ok(porNome(n), `falta ${n}`);
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Santa Amália");
    assert.equal(salas[0].name, SANTA_AMALIA + "Cidade", "a entrada do lugar é a cidade");
    assert.ok(porNome("Cidade").aberto, "a cidade é ao ar livre");
  });

  test("toda peça existe no catálogo e fica dentro do chão da sala", () => {
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
    const cidade = porNome("Cidade");
    const conta = (id: string) => cidade.items.filter((i) => i.defId === id).length;
    for (const id of ["casa_valenca", "posto_saude", "cartorio_predio", "prefeitura_predio", "coreto"]) assert.equal(conta(id), 1, id);
  });

  test("toda passagem leva a outra sala de Santa Amália, que tem a volta, e todas se alcançam a partir da cidade", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal)) {
        assert.ok(it.link !== undefined && ids.has(it.link), `${r.name}: passagem ${it.defId} em ${it.x},${it.y} sem destino`);
        const volta = salas.find((s) => s.id === it.link)!;
        assert.ok(volta.items.some((i) => i.link === r.id), `${volta.name} não volta para ${r.name}`);
      }
    const vistos = new Set([porNome("Cidade").id]);
    const fila = [porNome("Cidade")];
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

  test("dentro de cada sala, a pé, a porta de entrada alcança todas as passagens", () => {
    for (const r of salas) {
      const map = new RoomMap(r.heightmap, r.door, r.items);
      const portas = r.items.filter((i) => getFurni(i.defId)?.portal && i.link !== undefined);
      if (!portas.length) continue;
      const [x0, y0] = [portas[0].x, portas[0].y];
      const vistos = new Set([`${x0},${y0}`]);
      const fila: [number, number][] = [[x0, y0]];
      while (fila.length) {
        const [x, y] = fila.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`;
          if (vistos.has(k)) continue;
          vistos.add(k);
          if (map.walkState(x + dx, y + dy) === "walk") fila.push([x + dx, y + dy]);
        }
      }
      for (const p of portas.slice(1)) assert.ok(vistos.has(`${p.x},${p.y}`), `${r.name}: a passagem em ${p.x},${p.y} não se alcança a pé`);
    }
  });

  test("a porta de dentro fica do mesmo lado da de fora (giro 4: na frente; giro 0: no fundo)", () => {
    const cidade = porNome("Cidade");
    for (const p of cidade.items.filter((i) => getFurni(i.defId)?.kind === "predio_vila" && i.defId !== "prefeitura_predio")) {
      const entrada = cidade.items.find((i) => i.defId === "entrada" && i.link !== undefined && i.y === (p.rot === 4 ? p.y + getFurni(p.defId)!.depth : p.y - 1) && i.x >= p.x && i.x < p.x + getFurni(p.defId)!.width);
      assert.ok(entrada, `${p.defId} em ${p.x},${p.y} sem entrada na porta`);
      const dentro = salas.find((s) => s.id === entrada!.link)!;
      const volta = dentro.items.find((i) => i.link === cidade.id)!;
      const linhas = dentro.heightmap.replace(/\r/g, "").split("\n");
      const fileira = p.rot === 4 ? linhas.length - 2 : 1;
      assert.equal(volta.y, fileira, `${dentro.name}: a porta de dentro não está do lado da de fora`);
    }
  });

  test("o prédio de fora tem o tamanho dos cômodos de dentro, e cada cômodo tem um tamanho plausível (em m²)", () => {
    const m2 = (n: string) => {
      const chao = porNome(n).heightmap.replace(/\r/g, "").split("").filter((c) => c === "0").length - 1;
      return chao * 0.75 * 0.75;
    };
    const predios: [string, string[]][] = [
      ["casa_valenca", ["Sala dos Valença", "Cozinha dos Valença", "Área de Serviço dos Valença", "Banheiro dos Valença", "Quarto do Casal", "Quarto da Filha"]],
      ["posto_saude", ["Recepção do Posto", "Consultório", "Sala de Procedimentos", "Triagem", "Farmácia do Posto", "Banheiro do Posto", "Administração do Posto"]],
      ["cartorio_predio", ["Atendimento do Cartório", "Sala do Oficial", "Arquivo do Cartório", "Depósito do Cartório", "Banheiro do Cartório", "Copa do Cartório"]],
    ];
    for (const [id, comodos] of predios) {
      const def = getFurni(id)!;
      const fora = def.width * def.depth * 0.75 * 0.75;
      const dentro = comodos.reduce((t, n) => t + m2(n), 0);
      assert.ok(dentro <= fora && dentro >= fora * 0.8, `${id}: ${dentro.toFixed(1)} m² dentro, ${fora.toFixed(1)} m² fora`);
    }
    // uma sala de espera de uns 15 lugares: nem um corredor, nem um galpão
    for (const n of ["Recepção do Posto", "Atendimento do Cartório"]) assert.ok(m2(n) >= 40 && m2(n) <= 60, `${n}: ${m2(n)} m²`);
    for (const n of ["Consultório", "Sala de Procedimentos", "Triagem", "Farmácia do Posto", "Quarto do Casal", "Quarto da Filha", "Cozinha dos Valença", "Sala do Oficial"])
      assert.ok(m2(n) >= 9 && m2(n) <= 20, `${n}: ${m2(n)} m²`);
    for (const n of ["Banheiro dos Valença", "Banheiro do Posto", "Banheiro do Cartório"]) assert.ok(m2(n) >= 4 && m2(n) <= 8, `${n}: ${m2(n)} m²`);
  });

  test("sem fogo aceso dentro de casa (a cidade tem luz elétrica): nem fogão a lenha, nem vela", () => {
    for (const r of salas) for (const it of r.items) assert.ok(!/fogao_lenha|candles|candelabra|fogueira|lareira/.test(it.defId), `${r.name}: ${it.defId}`);
  });
});
