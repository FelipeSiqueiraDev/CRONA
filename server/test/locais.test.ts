import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  montarLocais,
  nomeCurto,
  regras,
  rotuloDoAndar,
  type ClientMsg,
  type ServerMsg,
} from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";
import { FAZENDA } from "../src/seedFazenda";

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
let inbox: ServerMsg[];
let client: ReturnType<Hotel["attach"]>;
const send = (m: ClientMsg) => hotel.receive(client, m);
/** As cenas da campanha que o mestre recebe (a do cômodo aberto). */
function cenasDa(roomId: number) {
  send({ t: "join", roomId });
  hotel.pushNow();
  for (let i = inbox.length - 1; i >= 0; i--) {
    const m = inbox[i];
    if (m.t === "campaign" && m.state.scenes.some((s) => s.id === roomId))
      return m.state.scenes;
  }
  throw new Error("sem campanha");
}
const idDe = (nome: string) => {
  const r = hotel.db.rooms.find((x) => x.name === nome);
  assert.ok(r, nome);
  return r.id;
};

beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
  inbox = [];
  client = hotel.attach(
    (m) => inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg),
    undefined,
    true,
  );
  send({ t: "login", name: "Mestre", look });
});

describe("Locais do minimapa", () => {
  test("os rótulos dos andares", () => {
    assert.equal(rotuloDoAndar("Casarão", "Casarão", true), "Térreo");
    assert.equal(rotuloDoAndar("Casarão 2º", "Casarão", false), "2º andar");
    assert.equal(rotuloDoAndar("Galpões", "Celeiro", true), "Térreo");
    assert.equal(rotuloDoAndar("Calabouço", "Celeiro", false), "Calabouço");
    assert.equal(rotuloDoAndar("Subsolo", "", false), "Subsolo");
  });

  test("a fazenda: terreno, prédios com os andares e os cômodos", () => {
    const cenas = cenasDa(idDe(FAZENDA + "Olhos de Águia"));
    const fora = cenas.find((s) => s.name === FAZENDA + "Olhos de Águia")!;
    // o servidor diz que cena cada prédio abre e manda o que tem no chão
    assert.ok(fora.marcos?.every((m) => m.entra !== undefined && m.kind));
    assert.ok(fora.simbolos?.some(([k]) => k === "arvore"));
    const l = montarLocais(cenas);
    assert.deepEqual(
      l.terrenos.map((t) => t.nome),
      ["Olhos de Águia", "Arredores"],
    );
    const t = l.terrenos[0];
    assert.deepEqual(
      t.predios.map((id) => l.predios.find((p) => p.id === id)!.nome).sort(),
      ["Casa de Mantimentos", "Casarão", "Celeiro"],
    );
    assert.deepEqual(
      t.saidas.map((s) => s.para),
      [idDe(FAZENDA + "Arredores")],
    );
    const predio = (nome: string) => l.predios.find((p) => p.nome === nome)!;
    const casarao = predio("Casarão");
    assert.equal(casarao.entrada, idDe(FAZENDA + "Hall do Casarão"));
    assert.deepEqual(
      casarao.andares.map((a) => a.rotulo),
      ["2º andar", "Térreo"],
    );
    assert.equal(casarao.cenas.length, 12);
    // o calabouço é o subsolo do celeiro, e a casa de mantimentos é outro prédio
    assert.deepEqual(
      predio("Celeiro").andares.map((a) => a.rotulo),
      ["Térreo", "Calabouço"],
    );
    assert.deepEqual(
      predio("Celeiro").andares[1].cenas.map((id) =>
        nomeCurto(cenas.find((s) => s.id === id)!.name),
      ),
      ["Calabouço", "Corredor Escuro", "Sala de Sangue"],
    );
    assert.equal(predio("Casa de Mantimentos").cenas.length, 1);
    // toda cena tem um lugar
    for (const s of cenas) assert.ok(l.onde.has(s.id), s.name);
    assert.equal(
      l.onde.get(idDe(FAZENDA + "Quarto 1"))?.predio,
      casarao.id,
    );
  });

  test("a Sede, sem terreno: um prédio só com o térreo e o subsolo", () => {
    const cenas = cenasDa(hotel.db.home!);
    const l = montarLocais(cenas);
    assert.equal(l.terrenos.length, 0);
    assert.equal(l.predios.length, 1);
    assert.equal(l.predios[0].nome, "");
    assert.deepEqual(
      l.predios[0].andares.map((a) => a.rotulo),
      ["Térreo", "Subsolo"],
    );
    assert.equal(l.predios[0].cenas.length, cenas.length);
  });

  test("levar o grupo: os agentes de todas as cenas vão para a escolhida, e o mestre também", () => {
    const fora = hotel.rooms.get(idDe(FAZENDA + "Olhos de Águia"))!;
    const quarto = hotel.rooms.get(idDe(FAZENDA + "Quarto 1"))!;
    // agente = peça de personagem com ficha (as do grupo da fazenda ganham uma)
    const agora = new Date().toISOString();
    for (const t of fora.tokenList())
      send({
        t: "fichaSalvar",
        ficha: { id: 0, nome: t.name, personagem: t.look!.charId!, ficha: regras.novaFicha(t.name), criadaEm: agora, atualizadaEm: agora },
      });
    const agentes = fora
      .tokenList()
      .filter((t) => hotel.ehAgente(t.look?.charId));
    assert.ok(agentes.length >= 4, "os agentes começam no terreno");
    send({ t: "join", roomId: fora.data.id });
    send({ t: "grupoPara", roomId: quarto.data.id });
    const chegaram = new Set(quarto.tokenList().map((t) => t.id));
    for (const t of agentes) assert.ok(chegaram.has(t.id), `${t.name} chegou`);
    assert.equal(
      fora.tokenList().filter((t) => hotel.ehAgente(t.look?.charId)).length,
      0,
    );
    // o mestre (e a mesa) abrem a cena, e a campanha mostra o grupo lá
    assert.equal(client.room, quarto);
    const cenas = cenasDa(quarto.data.id);
    assert.equal(
      cenas.find((s) => s.id === quarto.data.id)?.users.length,
      agentes.length,
    );
  });

  test("grupo dividido: só as peças escolhidas vão, e sem entrar a cena fica", () => {
    const fora = hotel.rooms.get(idDe(FAZENDA + "Olhos de Águia"))!;
    const celeiro = hotel.rooms.get(idDe(FAZENDA + "Celeiro"))!;
    send({ t: "join", roomId: fora.data.id });
    const [um, dois, ...resto] = fora.tokenList();
    send({ t: "grupoPara", roomId: celeiro.data.id, tokens: [um.id, dois.id], entrar: false });
    assert.deepEqual(
      celeiro.tokenList().map((t) => t.id).sort(),
      [um.id, dois.id].sort(),
    );
    assert.equal(fora.tokenList().length, resto.length);
    // o mestre continua onde estava
    assert.equal(client.room, fora);
  });

  test("visitadas: a cena com agente vira visitada; o mestre marca e limpa", () => {
    const fora = hotel.rooms.get(idDe(FAZENDA + "Olhos de Águia"))!;
    const hall = idDe(FAZENDA + "Hall do Casarão");
    const agora = new Date().toISOString();
    for (const t of fora.tokenList())
      send({
        t: "fichaSalvar",
        ficha: { id: 0, nome: t.name, personagem: t.look!.charId!, ficha: regras.novaFicha(t.name), criadaEm: agora, atualizadaEm: agora },
      });
    send({ t: "join", roomId: fora.data.id });
    const camp = () => {
      hotel.pushNow();
      for (let i = inbox.length - 1; i >= 0; i--) {
        const m = inbox[i];
        if (m.t === "campaign" && m.state.scenes.some((s) => s.id === fora.data.id)) return m.state;
      }
      throw new Error("sem campanha");
    };
    assert.deepEqual(camp().visitadas, [fora.data.id]);
    send({ t: "visitada", roomId: hall, visitada: true });
    assert.deepEqual(camp().visitadas, [fora.data.id, hall].sort((a, b) => a - b));
    send({ t: "visitada", campanha: fora.data.id, visitada: false });
    // limpar tira tudo, mas onde o grupo está volta a ser visitada na hora
    assert.deepEqual(camp().visitadas, [fora.data.id]);
    send({ t: "visitada", campanha: fora.data.id, visitada: true });
    assert.equal(camp().visitadas?.length, camp().scenes.length);
  });
});
