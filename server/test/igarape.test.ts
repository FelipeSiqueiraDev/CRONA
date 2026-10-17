import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findPath, footprint, getFurni, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { IGARAPE, IGARAPE_RIO } from "../src/seedIgarape";

describe("Igarapé", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(IGARAPE));
  const porNome = (n: string) => salas.find((r) => r.name === IGARAPE + n)!;

  test("o lugar existe: a cidade e os interiores, numa campanha com o nome do lugar", () => {
    for (const n of ["Cidade", "Capela", "Casa de Palafita", "Palafita", "Venda", "Casa", "Casa dos Ribeiro", "Big Dog Hot Dogs - Lanches e Açaí"]) assert.ok(porNome(n), `falta ${n}`);
    assert.equal(salas.filter((r) => r.name === IGARAPE + "Casa").length, 6, "as casas comuns, sem nome próprio (a 7ª é a dos Ribeiro, a casa da Cora)");
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Igarapé");
    assert.equal(salas[0].name, IGARAPE + "Cidade", "a entrada do lugar é a cidade");
    assert.ok(porNome("Cidade").aberto, "a cidade é ao ar livre");
  });

  test("toda peça da montagem existe no catálogo e coube no lugar", () => {
    for (const r of salas) for (const it of r.items) assert.ok(getFurni(it.defId), `${r.name}: ${it.defId} não existe`);
    const cidade = porNome("Cidade");
    const conta = (id: string) => cidade.items.filter((i) => i.defId === id).length;
    assert.equal(conta("igarape_capela"), 1);
    assert.equal(conta("igarape_venda"), 1);
    assert.equal(conta("igarape_ponte"), 1);
    assert.equal(conta("igarape_palafita") + conta("igarape_palafita_b"), 2, "as duas palafitas (com a coluna por cima da água)");
    assert.equal(conta("igarape_casa"), 6);
    // os dois prediozinhos de três andares (o Felipe, 17/10): o amarelo, com o apartamento dos Ribeiro, e o verde
    assert.equal(conta("igarape_predio"), 2, "os dois prediozinhos");
    assert.ok(conta("igarape_ipe") >= 1, "o ipê amarelo");
    assert.ok(conta("igarape_canoa") >= 2, "as canoas");
    // cada prédio tem a entrada encostada (o seed não deixou nenhuma de fora)
    assert.equal(conta("lanchonete_predio"), 1, "a lanchonete do largo");
    assert.equal(conta("entrada"), 13);
  });

  test("toda passagem leva a outra sala de Igarapé, que tem a volta, e todas se alcançam a partir da cidade", () => {
    const ids = new Set(salas.map((r) => r.id));
    for (const r of salas)
      for (const it of r.items.filter((i) => getFurni(i.defId)?.portal)) {
        // a porta trancada de apartamento sem cena (a receita do prédio, predioApartamentos.ts) não leva a lugar nenhum
        if (it.link === undefined && it.trancado && it.defId === "portal") continue;
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

  test("o rio não é andável e a ponte é: da chegada da van se anda até a porta de cada prédio", () => {
    const cidade = porNome("Cidade");
    const map = new RoomMap(cidade.heightmap, cidade.door, cidade.items);
    const { naAgua, ponte } = IGARAPE_RIO;
    const terreno = (cidade.terreno ?? "").split("\n");
    let agua = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const debaixoDaPonte = x >= ponte.x && x < ponte.x + ponte.w && y >= ponte.y && y < ponte.y + ponte.h;
        if (!naAgua(x, y) || debaixoDaPonte || terreno[y][x] === "m") continue;
        agua++;
        assert.equal(terreno[y][x], "a", `(${x}, ${y}) devia ser água no terreno`);
        assert.equal(map.walkState(x, y), "blocked", `a água em (${x}, ${y}) está andável`);
      }
    assert.ok(agua > 100, "o rio ficou pequeno");
    // a ponte: pisável nas seis casas, por cima das quatro de água
    for (let y = ponte.y; y < ponte.y + ponte.h; y++)
      for (let x = ponte.x; x < ponte.x + ponte.w; x++) assert.equal(map.walkState(x, y), "walk", `a ponte em (${x}, ${y}) não é andável`);
    assert.ok(naAgua(ponte.x + 1, ponte.y) && naAgua(ponte.x + 4, ponte.y + 1), "a ponte não está por cima do rio");
    // da chegada (a estrada do leste) até a entrada de cada prédio, dos dois lados do rio: só se atravessa pela ponte
    const livre = () => false;
    const entradas = cidade.items.filter((i) => i.defId === "entrada");
    for (const e of entradas) {
      const caminho = findPath(map, { x: cidade.door.x, y: cidade.door.y }, { x: e.x, y: e.y }, livre);
      assert.ok(caminho, `não se chega na entrada em (${e.x}, ${e.y})`);
    }
    // a capela fica do outro lado do rio: o caminho até ela passa pela ponte
    const capela = cidade.items.find((i) => i.defId === "igarape_capela")!;
    const ent = entradas.find((e) => e.x === capela.x + 3 && e.y === capela.y + 8)!;
    const caminho = findPath(map, { x: cidade.door.x, y: cidade.door.y }, { x: ent.x, y: ent.y }, livre)!;
    assert.ok(caminho.some((p) => p.x > ponte.x && p.x < ponte.x + ponte.w - 1 && p.y >= ponte.y && p.y < ponte.y + ponte.h), "o caminho não passou pela ponte");
  });

  test("as palafitas ficam com a coluna de fora por cima da água, e a porta de dentro do mesmo lado da de fora", () => {
    const cidade = porNome("Cidade");
    const { naAgua } = IGARAPE_RIO;
    for (const p of cidade.items.filter((i) => /^igarape_palafita/.test(i.defId))) {
      // giro 4: a coluna da direita (x + 4); giro 0: a da esquerda (x)
      const xa = p.rot === 4 ? p.x + 4 : p.x;
      for (let dy = 0; dy < 5; dy++) assert.ok(naAgua(xa, p.y + dy), `a estaca de ${p.defId} em (${xa}, ${p.y + dy}) não está na água`);
    }
    // a porta de dentro: prédio virado para a frente (giro 4) tem a passagem na última fileira; para o fundo (giro 0), na primeira
    const lado: [string, string][] = [["igarape_capela", "Capela"], ["igarape_palafita", "Casa de Palafita"], ["igarape_palafita_b", "Palafita"], ["igarape_venda", "Venda"]];
    for (const [def, nome] of lado) {
      const predio = cidade.items.find((i) => i.defId === def)!;
      const sala = porNome(nome);
      const map = new RoomMap(sala.heightmap, sala.door);
      const passagem = sala.items.find((i) => i.defId === "portal")!;
      if (predio.rot === 4) assert.equal(passagem.y, map.height - 2, `${nome}: a porta de dentro devia ficar na parede da frente`);
      else assert.equal(passagem.y, 1, `${nome}: a porta de dentro devia ficar na parede do fundo`);
    }
  });

  test("a ponte: as cabeceiras mais baixas (a escadinha) e o meio mais alto, e dá para atravessar a pé", () => {
    const cidade = porNome("Cidade");
    const ponte = cidade.items.find((i) => i.defId === "igarape_ponte")!;
    const map = new RoomMap(cidade.heightmap, cidade.door, cidade.items);
    const fp = footprint(getFurni("igarape_ponte")!, ponte.rot);
    const ao = (dx: number) => map.standHeight(ponte.x + dx, ponte.y);
    assert.ok(ao(0) < ao(2) && ao(fp.sx - 1) < ao(3), "as cabeceiras mais baixas que o meio");
    assert.ok(ao(0) > (map.floorHeight(ponte.x - 1, ponte.y) ?? 0), "a cabeceira é um degrau acima da terra");
    // a pé, de uma margem à outra pela ponte
    const ini = [ponte.x - 1, ponte.y];
    const fim = [ponte.x + fp.sx, ponte.y];
    const vistos = new Set([ini.join(",")]);
    const fila = [ini];
    while (fila.length) {
      const [x, y] = fila.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (vistos.has(k) || map.walkState(x + dx, y + dy) !== "walk" || Math.abs(map.standHeight(x + dx, y + dy) - map.standHeight(x, y)) > 1.5) continue;
        vistos.add(k);
        fila.push([x + dx, y + dy]);
      }
    }
    assert.ok(vistos.has(fim.join(",")), "não dá para atravessar a ponte");
  });
});
