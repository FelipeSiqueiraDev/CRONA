import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { getFurni, type ClientMsg, type FloorItem, type ServerMsg } from "@crona/shared";
import { Hotel } from "../src/hotel";
import type { RoomInstance } from "../src/roomInstance";
import { seedDb, upgradeDb } from "../src/seed";
import { SEDE } from "../src/seedSede";

const look = { skin: "#e8b98f", hair: "#3b2618", hairStyle: 0, top: "#2b2a30", pants: "#1c1b1f", shoes: "#3d3a40", outfit: 1, extra: 0, charId: null };

/**
 * A tranca (17/10, o Felipe): "mesmo a porta trancada eu quero que o personagem vai até lá. Afinal ele tem que ir abrir
 * pra descobrir que tá fechada". A peça anda até a coisa trancada, tenta abrir e ela trava (o `trancado` com o id, que
 * as telas mexem e tocam a maçaneta), sem abrir.
 */
describe("a coisa trancada: a peça vai até lá e tenta abrir", () => {
  let hotel: Hotel;
  let inbox: ServerMsg[];
  let send: (m: ClientMsg) => void;
  let salao: RoomInstance;
  let tokenId: number;
  const forcou = (id: number) => inbox.some((m) => m.t === "trancado" && m.id === id);
  const pos = () => salao.userPositions().find((q) => q.id === tokenId)!;

  beforeEach(() => {
    const db = seedDb();
    upgradeDb(db);
    hotel = new Hotel({ db, persist: false, timers: false });
    inbox = [];
    const client = hotel.attach((m) => inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, true);
    send = (m) => hotel.receive(client, m);
    send({ t: "login", name: "Mestre", look });
    const origem = [...hotel.rooms.values()].find((r) => r.tokenList().length)!;
    tokenId = origem.tokenList()[0].id;
    salao = [...hotel.rooms.values()].find((r) => r.data.name === SEDE + "Salão Principal")!;
    send({ t: "join", roomId: origem.data.id });
    send({ t: "tokenScene", tokenId, roomId: salao.data.id });
    send({ t: "join", roomId: salao.data.id });
    assert.ok(salao.tokenList().some((x) => x.id === tokenId), "a peça está no Salão");
  });

  test("clicar na porta trancada: a peça chega na frente, a porta trava e continua fechada", () => {
    const porta = salao.map.allItems().find((i) => i.defId === "portal" && i.x === 16 && i.y === 0)!;
    send({ t: "trancar", id: porta.id });
    assert.ok(salao.map.getItem(porta.id)!.trancado);
    inbox = [];
    send({ t: "tokenWalk", tokenId, x: porta.x, y: porta.y });
    assert.ok(!inbox.some((m) => m.t === "error"), "não recusa: a peça vai até lá");
    assert.ok(!forcou(porta.id), "ainda não chegou");
    for (let i = 0; i < 400 && !forcou(porta.id); i++) salao.step();
    assert.ok(forcou(porta.id), "chegou e tentou abrir: a porta travou");
    const p = pos();
    assert.equal(Math.abs(p.x - porta.x) + Math.abs(p.y - porta.y), 1, `na casa da frente da porta (está em ${p.x},${p.y})`);
    assert.equal(salao.map.getItem(porta.id)!.state, 1, "continua fechada");
    for (let i = 0; i < 20; i++) salao.step();
    assert.ok(salao.tokenList().some((x) => x.id === tokenId), "não atravessou para a outra cena");
  });

  test("o clique duplo num armário trancado: com a peça comandada, ela vai até ele; sem peça, ele só trava", () => {
    const armario = salao.map
      .allItems()
      .find((i) => {
        const d = getFurni(i.defId);
        return !!d && (d.states ?? 0) > 1 && d.openState === undefined && !d.portal && !i.lock;
      }) as FloorItem;
    assert.ok(armario, "tem um móvel que abre e fecha no Salão");
    send({ t: "trancar", id: armario.id });
    const estado = salao.map.getItem(armario.id)!.state;
    inbox = [];
    send({ t: "use", id: armario.id });
    assert.ok(forcou(armario.id), "sem peça: trava na hora");
    assert.equal(salao.map.getItem(armario.id)!.state, estado, "não abre");
    inbox = [];
    const antes = pos();
    send({ t: "use", id: armario.id, tokenId });
    for (let i = 0; i < 400 && !forcou(armario.id); i++) salao.step();
    assert.ok(forcou(armario.id), "a peça chegou e tentou abrir");
    assert.notDeepEqual([pos().x, pos().y], [antes.x, antes.y], "a peça andou até lá");
    assert.equal(salao.map.getItem(armario.id)!.state, estado, "continua fechado");
  });
});
