import assert from "node:assert/strict";
import { test } from "node:test";
import { getFurni, type ClientMsg, type ServerMsg } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

const look = { skin: "#e8b98f", hair: "#3b2618", hairStyle: 0, top: "#2b2a30", pants: "#1c1b1f", shoes: "#3d3a40", outfit: 1, extra: 0, charId: null };

test("toda cama é de deitar (o Felipe, 14/10: 'mando o personagem ir pra cama e nada acontece')", () => {
  for (const id of ["bed", "cama_casal", "cama_solteiro", "cama_palha", "cama_queimada", "catre", "hospital_bed", "beliche"]) {
    const d = getFurni(id);
    assert.ok(d?.sit && d.deita, `${id} deita`);
  }
  assert.ok(!getFurni("sofa")?.deita, "sofá continua de sentar");
});

test("a peça mandada para a cama anda até ela e fica nela (deitada)", () => {
  const db = seedDb();
  upgradeDb(db);
  const hotel = new Hotel({ db, persist: false, timers: false });
  const inbox: ServerMsg[] = [];
  const client = hotel.attach((m) => inbox.push(m as ServerMsg), undefined, true);
  const send = (m: ClientMsg) => hotel.receive(client, m);
  send({ t: "login", name: "Mestre", look });
  // uma peça qualquer, levada para uma cena com cama (como o mestre faz)
  const origem = [...hotel.rooms.values()].find((r) => r.tokenList().length)!;
  const [t] = origem.tokenList();
  // o Quarto Principal da Fazenda: a cama de casal encostada na parede (a casa da cabeceira não tem caminho)
  const sala = [...hotel.rooms.values()].find((r) => r.data.name.endsWith("Quarto Principal") && r.data.items.some((it) => it.defId === "cama_casal"))!;
  assert.ok(sala, "tem o quarto com a cama de casal");
  send({ t: "join", roomId: origem.data.id });
  send({ t: "tokenScene", tokenId: t.id, roomId: sala.data.id });
  send({ t: "join", roomId: sala.data.id });
  assert.ok(sala.tokenList().some((x) => x.id === t.id), "a peça chegou na cena da cama");
  const cama = sala.data.items.find((it) => it.defId === "cama_casal")!;
  const casas = sala.map.tilesFor(cama.defId, cama.x, cama.y, cama.rot);
  // clica na casa da cabeceira (a da quina, cercada pela cama e pela parede)
  send({ t: "tokenWalk", tokenId: t.id, x: cama.x, y: cama.y });
  for (let i = 0; i < 300; i++) sala.step();
  const p = sala.userPositions().find((q) => q.id === t.id)!;
  assert.ok(casas.some((c) => c.x === p.x && c.y === p.y), `chegou numa casa da cama (está em ${p.x},${p.y})`);
  const u = [...(sala as unknown as { users: Map<unknown, { client: { id: number }; sit: number }> }).users.values()].find((x) => x.client.id === t.id)!;
  assert.equal(u.sit, 1, "fica na cama (o cliente desenha deitada)");
});
