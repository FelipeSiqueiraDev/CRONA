import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  findPath,
  getFurni,
  parseHeightmap,
  terrenoEm,
  type ClientMsg,
  type ServerMsg,
} from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";
import { FAZENDA, FAZENDA_REV, rebuildFazenda } from "../src/seedFazenda";

type Msg<T extends ServerMsg["t"]> = Extract<ServerMsg, { t: T }>;

class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(
    private hotel: Hotel,
    local = false,
  ) {
    this.client = hotel.attach(
      (m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg),
      undefined,
      local,
    );
  }
  send(m: ClientMsg) {
    this.hotel.receive(this.client, m);
  }
  last<T extends ServerMsg["t"]>(t: T): Msg<T> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--)
      if (this.inbox[i].t === t) return this.inbox[i] as Msg<T>;
    return undefined;
  }
}

const look = {
  skin: "#e8b98f",
  hair: "#3b2618",
  hairStyle: 0,
  top: "#2b2a30",
  pants: "#1c1b1f",
  shoes: "#3d3a40",
  outfit: 1,
  extra: 0,
  charId: null,
};

let hotel: Hotel;
let gm: Peer;
const cena = (name: string) => {
  const r = hotel.db.rooms.find((x) => x.name === FAZENDA + name);
  assert.ok(r, `cena ${name}`);
  return hotel.rooms.get(r.id)!;
};
const fazenda = () => hotel.db.rooms.filter((r) => r.name.startsWith(FAZENDA));
/** Anda com a peça até (x, y) e deixa o tempo correr até ela trocar de cena (ou parar). */
function andar(de: ReturnType<typeof cena>, id: number, x: number, y: number) {
  assert.equal(
    de.moveTokenTo(-id, { x, y }, true, "walk"),
    null,
    `caminho até ${x},${y}`,
  );
  for (let i = 0; i < 400 && de.hasToken(-id); i++) de.step();
}

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  gm = new Peer(hotel, true);
  gm.send({ t: "login", name: "Mestre", look });
  gm.send({ t: "join", roomId: cena("Olhos de Águia").data.id });
});

describe("Fazenda Olhos de Águia", () => {
  test("a fazenda, os arredores e os interiores numa campanha só, com a planta", () => {
    const cenas = fazenda();
    assert.equal(cenas.length, 21);
    const camp =
      hotel.db.campaigns?.[String(Math.min(...cenas.map((r) => r.id)))];
    assert.equal(camp?.title, "Fazenda Olhos de Águia");
    for (const r of cenas)
      assert.ok(camp?.layout[r.id], `${r.name} está na planta`);
    assert.deepEqual(
      [...new Set(cenas.map((r) => r.floor))],
      ["Fazenda", "Arredores", "Casarão", "Casarão 2º", "Galpões", "Calabouço"],
    );
    // a Sede continua sendo a campanha que abre
    assert.ok(!cenas.some((r) => r.id === hotel.db.home));
  });

  test("a fazenda e os arredores são ao ar livre, com o chão casa por casa", () => {
    for (const nome of ["Olhos de Águia", "Arredores"]) {
      const r = cena(nome).data;
      assert.equal(r.aberto, true);
      const hm = parseHeightmap(r.heightmap);
      const linhas = r.terreno!.split("\n");
      assert.equal(linhas.length, hm.height);
      for (const l of linhas) assert.equal(l.length, hm.width);
      // a água é casa vazia (ninguém pisa) e só ela
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++)
          assert.equal(
            hm.tiles[y][x] === null,
            terrenoEm(linhas, x, y) === "agua",
            `${nome} ${x},${y}`,
          );
    }
    const info = cena("Olhos de Águia").info(gm.client);
    assert.equal(info.aberto, true);
    assert.ok(info.terreno);
    // por dentro, as casas têm parede
    assert.ok(!cena("Hall do Casarão").data.aberto);
  });

  test("os prédios entram inteiros na fazenda, com uma entrada larga na frente de cada porta", () => {
    const itens = cena("Olhos de Águia").map.allItems();
    for (const id of ["casarao", "celeiro", "galpao", "porteira", "fonte"])
      assert.ok(
        itens.some((i) => i.defId === id),
        id,
      );
    assert.equal(
      itens.filter((i) => i.defId === "entrada_larga" && i.link).length,
      3,
    );
  });

  test("toda passagem tem volta e caminho a partir da porta", () => {
    for (const r of fazenda()) {
      const inst = hotel.rooms.get(r.id)!;
      for (const p of inst.portals()) {
        const back = hotel.rooms
          .get(p.link)!
          .portals()
          .find((q) => q.link === r.id);
        assert.ok(
          back,
          `${r.name} → ${hotel.rooms.get(p.link)!.data.name} tem volta`,
        );
        if (p.x === inst.map.door.x && p.y === inst.map.door.y) continue;
        // a passagem escondida (o alçapão embaixo do feno) só tem caminho depois de revelada
        if (
          inst.map
            .itemsAt(p.x, p.y)
            .some((i) => getFurni(i.defId)?.hidden && i.state !== 1)
        )
          continue;
        assert.ok(
          findPath(inst.map, inst.map.door, p, () => false),
          `${r.name}: caminho até ${p.x},${p.y}`,
        );
      }
    }
  });

  test("os quatro agentes começam na porteira, com as folhas", () => {
    const tokens = cena("Olhos de Águia").tokenList();
    assert.deepEqual(tokens.map((t) => t.name).sort(), [
      "Alosi Walker",
      "Catarina Albuquerque",
      "Cora Falcão",
      "D.Tepes",
    ]);
    for (const t of tokens) assert.ok(t.look.charId, `${t.name} tem folha`);
  });

  test("quem pisa na entrada do casarão vai para o hall; pela porta do hall, volta para fora", () => {
    const fora = cena("Olhos de Águia");
    const hall = cena("Hall do Casarão");
    const tk = fora.tokenList()[0];
    andar(fora, tk.id, 19, 18);
    assert.ok(hall.hasToken(-tk.id), "entrou no hall");
    const m = gm.last("tokenTravel");
    assert.equal(m?.roomId, hall.data.id);
    // chega na porta da frente do hall (embaixo), e sai por ela de volta para a frente da casa
    const t = hall.tokensLive().find((x) => x.name === tk.name)!;
    assert.equal(t.token.tile.y, 11);
    andar(hall, tk.id, 3, 10);
    andar(hall, tk.id, 3, 11);
    assert.ok(fora.hasToken(-tk.id), "voltou para fora");
    const v = fora.tokensLive().find((x) => x.name === tk.name)!;
    assert.ok(
      [19, 20].includes(v.token.tile.x) && v.token.tile.y === 18,
      "na entrada, na frente da varanda",
    );
  });

  test("a escada do hall sobe para o corredor de cima, e o vão da escada desce de volta", () => {
    const hall = cena("Hall do Casarão");
    const corredor = cena("Corredor de Cima");
    const tk = cena("Olhos de Águia").tokenList()[0];
    hotel.moveToken(cena("Olhos de Águia"), tk.id, hall.data.id);
    andar(hall, tk.id, 3, 2);
    assert.ok(corredor.hasToken(-tk.id), "subiu");
    // chega na frente do vão da escada, virado para o corredor
    const vao = corredor.map
      .allItems()
      .find((i) => i.defId === "escada_desce")!;
    const t = corredor.tokensLive().find((x) => x.name === tk.name)!;
    assert.deepEqual([t.token.tile.x, t.token.tile.y], [vao.x, vao.y + 2]);
    andar(corredor, tk.id, vao.x, vao.y + 1);
    assert.ok(hall.hasToken(-tk.id), "desceu");
    const h = hall.tokensLive().find((x) => x.name === tk.name)!;
    assert.deepEqual(
      [h.token.tile.x, h.token.tile.y],
      [3, 3],
      "no pé da escada do hall",
    );
  });

  test("o beliche: a peça fica na cama de baixo e a escalada leva para a de cima e de volta", () => {
    const fora = cena("Olhos de Águia");
    const quarto = cena("Quarto das Crianças");
    const tk = fora.tokenList()[0];
    hotel.moveToken(fora, tk.id, quarto.data.id);
    const beliche = quarto.map.allItems().find((i) => i.defId === "beliche")!;
    const [baixo, cima] = getFurni("beliche")!.leitos!;
    gm.send({ t: "join", roomId: quarto.data.id });
    andar(quarto, tk.id, beliche.x, beliche.y + 1);
    const eu = () =>
      (
        quarto as unknown as {
          users: Map<number, { z: number; meta?: { alto?: boolean } }>;
        }
      ).users.get(tk.id)!;
    assert.equal(eu().z, beliche.z + baixo, "na cama de baixo");
    gm.send({ t: "tokenEdit", tokenId: tk.id, alto: true });
    assert.equal(eu().meta?.alto, true);
    assert.equal(eu().z, beliche.z + cima, "subiu para a cama de cima");
    gm.send({ t: "tokenEdit", tokenId: tk.id, alto: false });
    assert.equal(eu().z, beliche.z + baixo, "desceu");
    // andando para longe, sai da cama de cima sozinha e pisa no chão
    gm.send({ t: "tokenEdit", tokenId: tk.id, alto: true });
    andar(quarto, tk.id, 2, 3);
    assert.notEqual(eu().meta?.alto, true);
    assert.equal(eu().z, quarto.map.standHeight(2, 3));
    // fora de um beliche, "Na cama de cima" não faz nada
    gm.send({ t: "tokenEdit", tokenId: tk.id, alto: true });
    assert.notEqual(eu().meta?.alto, true);
  });

  test("pela porteira aberta sai para os arredores; fechada, ninguém passa", () => {
    const fora = cena("Olhos de Águia");
    const arredores = cena("Arredores");
    const porteira = fora.map.allItems().find((i) => i.defId === "porteira")!;
    assert.equal(porteira.state, 1, "começa aberta");
    gm.send({ t: "use", id: porteira.id });
    assert.equal(fora.map.walkState(0, 19), "blocked", "fechada");
    gm.send({ t: "use", id: porteira.id });
    assert.equal(fora.map.walkState(0, 19), "walk", "aberta de novo");
    const tk = fora.tokenList()[0];
    andar(fora, tk.id, 0, 19);
    assert.ok(arredores.hasToken(-tk.id), "saiu pela porteira");
    // nos arredores, a porteira da fazenda leva de volta
    const volta = arredores.map.allItems().find((i) => i.defId === "porteira")!;
    andar(arredores, tk.id, volta.x - 1, volta.y + 1);
    andar(arredores, tk.id, volta.x, volta.y + 1);
    assert.ok(fora.hasToken(-tk.id), "voltou para a fazenda");
  });

  test("o feno do celeiro esconde o alçapão: empurrado, ele aparece e leva ao calabouço", () => {
    const fora = cena("Olhos de Águia");
    const celeiro = cena("Celeiro");
    const calabouco = cena("Calabouço");
    const alcapao = () =>
      celeiro.map.allItems().find((i) => i.defId === "alcapao")!;
    const feno = () => celeiro.map.allItems().find((i) => i.lock?.semSenha)!;
    assert.equal(alcapao().state, 0, "escondido");
    assert.deepEqual(
      [feno().x, feno().y],
      [alcapao().x, alcapao().y],
      "o feno em cima",
    );
    gm.send({ t: "join", roomId: celeiro.data.id });
    // o mestre empurra mesmo sem peça no celeiro, e empurra de volta
    gm.send({ t: "use", id: feno().id });
    assert.equal(alcapao().state, 1, "empurrado sem peça na sala");
    gm.send({ t: "use", id: feno().id });
    assert.equal(alcapao().state, 0, "coberto de novo");
    const tk = fora.tokenList()[0];
    hotel.moveToken(fora, tk.id, celeiro.data.id);
    gm.send({ t: "use", id: feno().id });
    assert.equal(feno().lock?.open, true, "empurrado");
    assert.equal(alcapao().state, 1, "o alçapão aparece");
    assert.notDeepEqual([feno().x, feno().y], [alcapao().x, alcapao().y]);
    // desce pelo alçapão e chega no pé da escada de mão do calabouço
    andar(celeiro, tk.id, alcapao().x, alcapao().y);
    assert.ok(calabouco.hasToken(-tk.id), "desceu");
    const escada = calabouco.map
      .allItems()
      .find((i) => i.defId === "escada_vertical")!;
    const t = calabouco.tokensLive().find((x) => x.name === tk.name)!;
    assert.deepEqual(
      [t.token.tile.x, t.token.tile.y],
      [escada.x, escada.y + 1],
      "no pé da escada",
    );
    // com o mestre olhando o celeiro, o alçapão continua aberto; ele sai da cena e o feno volta e cobre
    assert.equal(feno().lock?.open, true);
    gm.send({ t: "join", roomId: calabouco.data.id });
    assert.equal(feno().lock?.open, false);
    assert.equal(alcapao().state, 0);
    // subindo pela escada com a passagem fechada, ela abre por dentro, e a peça sai do lado do buraco
    andar(calabouco, tk.id, escada.x, escada.y);
    assert.ok(celeiro.hasToken(-tk.id), "subiu");
    assert.equal(alcapao().state, 1);
    const s = celeiro.tokensLive().find((x) => x.name === tk.name)!;
    assert.notDeepEqual(
      [s.token.tile.x, s.token.tile.y],
      [alcapao().x, alcapao().y],
      "fora do buraco",
    );
  });

  test("o calabouço: o altar no estrado, o corredor escuro e a sala de sangue", () => {
    const calabouco = cena("Calabouço");
    // o chão é plano; o estrado é um móvel pisável (0,61 m = 1 unidade) e a pedra do sacrifício fica em cima dele
    const estrado = calabouco.map.allItems().find((i) => i.defId === "estrado_altar")!;
    const altar = calabouco.map.allItems().find((i) => i.defId === "pedra_sacrificio")!;
    assert.equal(calabouco.map.floorHeight(9, 8), 0, "a planta não sobe");
    assert.ok(Math.abs(calabouco.map.standHeight(estrado.x + 2, estrado.y + 1) - 1) < 0.01, "quem pisa no estrado sobe 1 unidade");
    assert.equal(calabouco.map.standHeight(estrado.x, estrado.y), 0, "o canto da pegada (o estrado é redondo) fica no chão");
    assert.ok(Math.abs(altar.z - 1) < 0.01, "a pedra fica em cima do estrado");
    // as pistas do calabouço começam escondidas dos jogadores
    assert.equal(altar.hint?.visible, false);
    const corredor = cena("Corredor Escuro");
    const sangue = cena("Sala de Sangue");
    const liga = (a: typeof corredor, b: typeof corredor) =>
      a.portals().some((p) => p.link === b.data.id);
    assert.ok(liga(calabouco, corredor) && liga(corredor, calabouco));
    assert.ok(liga(corredor, sangue) && liga(sangue, corredor));
    assert.ok(
      sangue.map.allItems().filter((i) => i.defId === "blood_pool").length >=
        8,
      "cheia de sangue",
    );
  });

  test("a fazenda é refeita no lugar quando a montagem muda", () => {
    const db = seedDb();
    upgradeDb(db);
    const antes = db.rooms
      .filter((r) => r.name.startsWith(FAZENDA))
      .map((r) => r.id);
    db.fazendaRev = FAZENDA_REV - 1;
    assert.ok(rebuildFazenda(db));
    assert.deepEqual(
      db.rooms.filter((r) => r.name.startsWith(FAZENDA)).map((r) => r.id),
      antes,
    );
    assert.equal(rebuildFazenda(db), false);
  });
});
