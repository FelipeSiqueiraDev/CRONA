import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getFurni } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";
import { TIRADENTES } from "../src/seedTiradentes";

describe("Tiradentes", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => r.name.startsWith(TIRADENTES));
  const porNome = (n: string) => salas.find((r) => r.name === TIRADENTES + n)!;

  test("o lugar existe: a cidade e os interiores, numa campanha com o nome do lugar", () => {
    for (const n of ["Cidade", "Igreja Matriz", "Sacristia", "Pousada", "Sala do Café", "Corredor da Pousada", "Quarto da Pousada", "Quarto 2 da Pousada", "Quarto 3 da Pousada", "Quarto 4 da Pousada", "Venda", "Boteco", "Casa"]) assert.ok(porNome(n), `falta ${n}`);
    const camp = db.campaigns?.[String(Math.min(...salas.map((r) => r.id)))];
    assert.equal(camp?.title, "Tiradentes");
    assert.equal(salas[0].name, TIRADENTES + "Cidade", "a entrada do lugar é a cidade");
    assert.ok(porNome("Cidade").aberto, "a cidade é ao ar livre");
    assert.equal(db.tiradentesRev !== undefined, true);
  });

  test("toda peça da montagem existe no catálogo, e a montagem não perdeu nenhuma", () => {
    for (const r of salas) for (const it of r.items) assert.ok(getFurni(it.defId), `${r.name}: ${it.defId} não existe`);
    const cidade = porNome("Cidade");
    const conta = (id: string) => cidade.items.filter((i) => i.defId === id).length;
    assert.equal(conta("igreja_barroca"), 1);
    assert.equal(conta("casa_colonial"), 9, "as nove casas do casario");
    for (const id of ["pousada_predio", "venda_predio", "boteco_predio", "chafariz", "coreto", "cruzeiro"]) assert.equal(conta(id), 1, id);
    assert.ok(conta("poste_ferro") >= 10, "os postes de ferro");
    assert.ok(conta("lajeado") > 30, "o lajeado do largo");
  });

  test("toda passagem leva a outra sala de Tiradentes, que tem a volta, e todas se alcançam a partir da cidade", () => {
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

  test("a porta de dentro fica do mesmo lado da de fora (giro 4: na frente; giro 0: no fundo)", () => {
    const cidade = porNome("Cidade");
    for (const p of cidade.items.filter((i) => getFurni(i.defId)?.kind === "predio_vila")) {
      const entrada = cidade.items.find((i) => i.defId === "entrada" && i.link !== undefined && i.y === (p.rot === 4 ? p.y + getFurni(p.defId)!.depth : p.y - 1) && i.x >= p.x && i.x < p.x + getFurni(p.defId)!.width);
      assert.ok(entrada, `${p.defId} em ${p.x},${p.y} sem entrada na porta`);
      const dentro = salas.find((s) => s.id === entrada!.link)!;
      const volta = dentro.items.find((i) => i.link === cidade.id)!;
      const linhas = dentro.heightmap.replace(/\r/g, "").split("\n");
      // a porta da frente (giro 4) fica na última fileira da sala; a do fundo (giro 0), na primeira
      const fileira = p.rot === 4 ? linhas.length - 2 : 1;
      assert.equal(volta.y, fileira, `${dentro.name}: a porta de dentro não está do lado da de fora`);
    }
  });

  // as casas são de cidade histórica, não de roça (17/10): o fogão a gás, a geladeira, a TV e o banheiro
  test("as luzes começam acesas e a casa tem fogão a gás, geladeira, TV e banheiro", () => {
    const casa = porNome("Casa");
    for (const id of ["fogao_gas", "geladeira", "rack_tv"]) assert.ok(casa.items.some((i) => i.defId === id), id);
    assert.ok(!casa.items.some((i) => i.defId === "fogao_lenha"), "sem fogão a lenha");
    assert.ok(salas.some((r) => r.name === TIRADENTES + "Banheiro"), "o banheiro");
    for (const r of salas) for (const it of r.items) if (it.defId === "ceiling_lamp" || it.defId === "poste_ferro") assert.equal(it.state, 0, `${r.name}: ${it.defId} apagado`);
  });
});

describe("hospedagem: pelo menos 4 quartos, cada um com a condição do descanso", () => {
  const db = seedDb();
  upgradeDb(db);
  for (const [lugar, prefixo] of [["a Pousada de Tiradentes", TIRADENTES], ["o Hotel de Santo Berço", "Santo Berço · "]] as const)
    test(lugar, () => {
      const quartos = db.rooms.filter((r) => r.name.startsWith(prefixo) && /Quarto/.test(r.name) && (r.floor ?? "").includes("2º") && r.descanso);
      assert.ok(quartos.length >= 4, `${lugar}: ${quartos.length} quartos`);
      assert.ok(new Set(quartos.map((q) => q.descanso)).size >= 2, `${lugar}: os quartos variam (bom, médio, ruim)`);
    });
});
