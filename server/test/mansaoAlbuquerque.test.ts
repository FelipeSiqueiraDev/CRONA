import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, getWallFurni, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { MANSAO, MANSAO_REV } from "../src/seedMansaoAlbuquerque";

describe("Mansão Albuquerque", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(MANSAO));
  const porNome = (n: string) => salas.find((r) => r.name === MANSAO + n)!;

  test("o lugar existe (a planta de 23/10): o jardim, o térreo, o 2º andar, o mezanino e o anexo, numa campanha com o nome do lugar", () => {
    const nomes = [
      "Jardim", "Salão Principal", "Biblioteca", "Escritório de Alexander", "Sala de Jantar", "Cozinha", "Despensa", "Lavanderia",
      "Corredor dos Funcionários", ...[1, 2, 3, 4, 5, 6].map((i) => `Quarto de Funcionário ${i}`),
      "Hall Superior", "Suíte do Casal", "Banheiro do Casal", "Sala de Jogos", "Quarto do Miguel", "Banheiro do Miguel",
      "Quarto da Catarina", "Banheiro da Catarina", "Quarto de Hóspedes", "Banheiro dos Hóspedes", "Mezanino da Catarina", "Anexo",
    ];
    for (const n of nomes) assert.ok(porNome(n), `falta ${n}`);
    assert.equal(salas.length, nomes.length, "sobrou cena da mansão antiga");
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Mansão Albuquerque");
    assert.equal(salas[0].name, MANSAO + "Jardim", "a entrada do lugar é o jardim");
    assert.ok(porNome("Jardim").aberto, "o jardim é ao ar livre");
    assert.equal(db.mansaoRev, MANSAO_REV);
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
    const jardim = porNome("Jardim");
    for (const id of ["mansao_central", "mansao_ala_oeste", "mansao_ala_leste", "mansao_portico", "anexo_mansao", "portao_mansao", "fonte"])
      assert.equal(jardim.items.filter((i) => i.defId === id).length, 1, id);
  });

  test("toda passagem leva a outra sala da mansão, que tem a volta, e todas se alcançam a partir do jardim", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal)) {
        assert.ok(it.link !== undefined && ids.has(it.link), `${r.name}: passagem ${it.defId} em ${it.x},${it.y} sem destino`);
        const volta = salas.find((s) => s.id === it.link)!;
        assert.ok(volta.items.some((i) => i.link === r.id), `${volta.name} não volta para ${r.name}`);
      }
    const vistos = new Set([porNome("Jardim").id]);
    const fila = [porNome("Jardim")];
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

  test("as escadas ligam os andares: as duas escadarias do Salão sobem ao Hall Superior, a parede de escalada leva ao mezanino", () => {
    const liga = (de: string, defId: string, para: string) => {
      const it = porNome(de).items.find((i) => i.defId === defId && i.link === porNome(para).id);
      assert.ok(it, `${de} não tem ${defId} para ${para}`);
    };
    liga("Salão Principal", "escada_nobre", "Hall Superior");
    liga("Hall Superior", "escada_nobre_desce", "Salão Principal");
    assert.equal(porNome("Salão Principal").items.filter((i) => i.defId === "escada_nobre").length, 2, "as duas escadarias");
    liga("Quarto da Catarina", "parede_escalada", "Mezanino da Catarina");
    liga("Mezanino da Catarina", "parede_escalada", "Quarto da Catarina");
    const andares = new Set(salas.map((r) => r.floor));
    for (const a of ["Mansão Albuquerque", "Mansão Albuquerque 2º", "Mansão Albuquerque Mezanino", "Jardim da Mansão", "Anexo"]) assert.ok(andares.has(a), `falta o andar ${a}`);
  });

  test("dentro de cada sala, a pé, a primeira passagem alcança todas as outras", () => {
    const erros: string[] = [];
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
      for (const p of portas.slice(1)) if (!vistos.has(`${p.x},${p.y}`)) erros.push(`${r.name}: a passagem em ${p.x},${p.y} não se alcança a pé`);
    }
    assert.deepEqual(erros, []);
  });

  test("a porta de dentro fica do mesmo lado da de fora: a entrada principal e o anexo têm a porta na frente", () => {
    const jardim = porNome("Jardim");
    for (const [def, sala] of [["mansao_portico", "Salão Principal"], ["anexo_mansao", "Anexo"]] as const) {
      const p = jardim.items.find((i) => i.defId === def)!;
      const d = getFurni(def)!;
      const entrada = jardim.items.find((i) => i.defId === "entrada" && i.link === porNome(sala).id && i.y === p.y + d.depth);
      assert.ok(entrada, `${def} sem entrada na porta da frente`);
      const dentro = porNome(sala);
      const volta = dentro.items.find((i) => i.link === jardim.id)!;
      const linhas = dentro.heightmap.replace(/\r/g, "").split("\n");
      assert.equal(volta.y, linhas.length - 2, `${sala}: a porta de dentro não está na parede da frente`);
    }
  });

  test("o quarto da Catarina tem o que o áudio descreve, e o mezanino o cantinho dela", () => {
    const q = porNome("Quarto da Catarina");
    const ids = q.items.map((i) => i.defId);
    for (const id of ["cama_catarina", "tv_gamer", "rack_esgrima", "parede_escalada", "estante_trofeus"]) assert.ok(ids.includes(id), `falta ${id}`);
    assert.equal(q.items.filter((i) => i.defId === "vitrine_trofeus").length, 2, "as duas vitrines de troféus");
    const m = porNome("Mezanino da Catarina");
    for (const id of ["setup_gamer", "cadeira_gamer", "puff_gamer", "parede_escalada"]) assert.ok(m.items.some((i) => i.defId === id), `mezanino sem ${id}`);
    assert.ok(m.darkness >= 0.6, "o mezanino é escuro");
    const pai = porNome("Escritório de Alexander");
    for (const id of ["mesa_ceo", "cadeira_ceo", "cofre", "bar_escritorio", "touro_bronze"]) assert.ok(pai.items.some((i) => i.defId === id), `escritório sem ${id}`);
  });

  test("a mesa do pai é virada para a cadeira, e nada fica embaixo dela", () => {
    const pai = porNome("Escritório de Alexander");
    const mesa = pai.items.find((i) => i.defId === "mesa_ceo")!;
    const fp = footprint(getFurni("mesa_ceo")!, mesa.rot);
    const cadeira = pai.items.find((i) => i.defId === "cadeira_ceo")!;
    // a cadeira fica numa casa colada na mesa, do lado da frente dela (giro 0 aqui: olhando para a mesa)
    assert.ok(cadeira.x >= mesa.x && cadeira.x < mesa.x + fp.sx, "a cadeira fica na largura da mesa");
    assert.equal(cadeira.y, mesa.y + fp.sy, "a cadeira fica na frente da mesa");
    assert.equal(cadeira.rot, 0, "a cadeira olha para a mesa");
    for (const it of pai.items) {
      if (it === mesa || it === cadeira) continue;
      const d = getFurni(it.defId)!;
      // o que fica em cima da mesa (os papéis, a luminária, as fotos) não conta: é embaixo dela que não pode haver nada
      if (["decor", "papers", "books", "lamp", "desk_lamp", "candles", "mug"].includes(d.kind) || d.height <= 0.25) continue;
      const f = footprint(d, it.rot);
      const bate = it.x < mesa.x + fp.sx && it.x + f.sx > mesa.x && it.y < mesa.y + fp.sy && it.y + f.sy > mesa.y;
      assert.ok(!bate || d.flat || d.walkable, `${it.defId} embaixo da mesa`);
    }
  });
});
