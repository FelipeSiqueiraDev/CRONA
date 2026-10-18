import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { criaturaDoLivro, ehSombra, escuridaoNoPonto, fasePasso, lerSombras, PASSO_SOMBRAS, type ServerMsg } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

const look = { skin: "#e8b98f", hair: "#3b2618", hairStyle: 0, top: "#2b2a30", pants: "#1c1b1f", shoes: "#3d3a40", outfit: 1, extra: 0, charId: null };

/** O passo pelas sombras da Magistrada (Onipresença, LR p. 252): quem pode, para onde e a animação para todos. */
describe("passo pelas sombras", () => {
  const montar = () => {
    const db = seedDb();
    upgradeDb(db);
    const hotel = new Hotel({ db, persist: false, timers: false });
    const caixa: ServerMsg[] = [];
    const c = hotel.attach((m) => caixa.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, true);
    hotel.receive(c, { t: "login", name: "Mestre", look, gmKey: hotel.gmKey });
    const sala = db.rooms[0];
    hotel.receive(c, { t: "join", roomId: sala.id });
    const colocar = (livro: string, quantidade = 1) => {
      const cr = criaturaDoLivro(livro, livro)!;
      hotel.receive(c, { t: "criaturaSalvar", criatura: cr });
      hotel.receive(c, { t: "criaturaColocar", criaturaId: cr.id, aparencia: "padrao", quantidade });
      return hotel.rooms.get(sala.id)!.tokenList().filter((t) => t.criatura?.id === cr.id);
    };
    const viva = (id = sala.id) => hotel.rooms.get(id)!;
    const onde = (tokenId: number) => viva().userPositions().find((q) => q.id === tokenId);
    return { db, hotel, c, caixa, sala, colocar, viva, onde };
  };

  /** uma casa de chão livre e vazia da sala, diferente de `evitar` */
  const casaLivre = (sala: ReturnType<typeof montar>["sala"], ocupadas: { x: number; y: number }[]) => {
    const linhas = sala.heightmap.split("\n");
    for (let y = 0; y < linhas.length; y++)
      for (let x = 0; x < linhas[y].length; x++) {
        if (linhas[y][x] === "x" || linhas[y][x] === "X") continue;
        if (sala.items.some((it) => it.x === x && it.y === y)) continue;
        if (ocupadas.some((o) => o.x === x && o.y === y)) continue;
        return { x, y };
      }
    throw new Error("sala sem casa livre");
  };

  test("só a criatura marcada com a habilidade tem o passo (dado do bestiário, não if solto)", () => {
    const { db } = montar();
    assert.equal(criaturaDoLivro("mascara-do-desespero")?.passoSombras, true);
    assert.equal(criaturaDoLivro("existido")?.passoSombras, undefined);
    // o banco antigo, com a Magistrada sem o campo, ganha na atualização
    db.bestiario = [{ ...criaturaDoLivro("mascara-do-desespero")!, passoSombras: undefined }];
    upgradeDb(db);
    assert.equal(db.bestiario[0].passoSombras, true);
  });

  test("a Magistrada vai para uma casa livre da mesma cena: a posição muda e a animação vai para todos", () => {
    const { c, caixa, sala, colocar, hotel, onde } = montar();
    const [mag] = colocar("mascara-do-desespero");
    assert.ok(mag, "a Magistrada entrou em campo");
    const de = { x: onde(mag.id)!.x, y: onde(mag.id)!.y };
    const para = casaLivre(sala, [de]);
    caixa.length = 0;
    hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: para.x, y: para.y });
    const anim = caixa.find((m) => m.t === "passoSombras");
    assert.ok(anim && anim.t === "passoSombras");
    assert.deepEqual(anim.de, de);
    assert.deepEqual(anim.para, para);
    assert.equal(anim.tokenId, mag.id);
    const antesDoStatus = caixa.findIndex((m) => m.t === "passoSombras") < caixa.findIndex((m) => m.t === "status");
    assert.ok(antesDoStatus, "a animação sai antes da posição nova");
    const agora = onde(mag.id)!;
    assert.deepEqual({ x: agora.x, y: agora.y }, para);
  });

  test("recusa: peça sem a habilidade, casa ocupada, casa que não existe, casa de parede/móvel", () => {
    const { c, caixa, sala, colocar, hotel, onde } = montar();
    const [mag] = colocar("mascara-do-desespero");
    const [zumbi] = colocar("zumbi-de-sangue");
    const livre = casaLivre(sala, [{ x: onde(mag.id)!.x, y: onde(mag.id)!.y }, { x: onde(zumbi.id)!.x, y: onde(zumbi.id)!.y }]);

    // quem não tem a habilidade
    caixa.length = 0;
    const zx = onde(zumbi.id)!.x;
    const zy = onde(zumbi.id)!.y;
    hotel.receive(c, { t: "passoSombras", tokenId: zumbi.id, x: livre.x, y: livre.y });
    assert.ok(caixa.some((m) => m.t === "error" && /sombras/.test(m.msg)));
    assert.deepEqual({ x: onde(zumbi.id)!.x, y: onde(zumbi.id)!.y }, { x: zx, y: zy });
    assert.ok(!caixa.some((m) => m.t === "passoSombras"));

    // casa ocupada por outra peça
    caixa.length = 0;
    const mx = onde(mag.id)!.x;
    const my = onde(mag.id)!.y;
    hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: onde(zumbi.id)!.x, y: onde(zumbi.id)!.y });
    assert.ok(caixa.some((m) => m.t === "error" && /alguém/.test(m.msg)));
    assert.deepEqual({ x: onde(mag.id)!.x, y: onde(mag.id)!.y }, { x: mx, y: my });

    // fora da planta
    caixa.length = 0;
    hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: 999, y: 999 });
    assert.ok(caixa.some((m) => m.t === "error" && /não existe/.test(m.msg)));
    hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: -1, y: 0 });
    assert.deepEqual({ x: onde(mag.id)!.x, y: onde(mag.id)!.y }, { x: mx, y: my });

    // casa de móvel que bloqueia
    const movel = sala.items.find((it) => hotel.rooms.get(sala.id)!.map.walkState(it.x, it.y) === "blocked" && hotel.rooms.get(sala.id)!.map.floorHeight(it.x, it.y) !== null);
    assert.ok(movel, "a sala tem um móvel que tapa a casa");
    {
      caixa.length = 0;
      hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: movel!.x, y: movel!.y });
      assert.deepEqual({ x: onde(mag.id)!.x, y: onde(mag.id)!.y }, { x: mx, y: my }, "não pisa em cima de móvel");
    }

    // peça que não existe
    caixa.length = 0;
    hotel.receive(c, { t: "passoSombras", tokenId: 987654, x: livre.x, y: livre.y });
    assert.ok(caixa.some((m) => m.t === "error" && /cena/.test(m.msg)));
  });

  test("peça de outra cena não anda pelas sombras daqui", () => {
    const { db, c, caixa, sala, colocar, hotel, viva } = montar();
    const [mag] = colocar("mascara-do-desespero");
    const outra = db.rooms.find((r) => r.id !== sala.id && r.heightmap.split("\n").length > 1)!;
    hotel.receive(c, { t: "tokenScene", tokenId: mag.id, roomId: outra.id });
    assert.ok(!viva(sala.id).userPositions().some((q) => q.id === mag.id), "a peça saiu da cena");
    caixa.length = 0;
    const livre = casaLivre(sala, []);
    hotel.receive(c, { t: "passoSombras", tokenId: mag.id, x: livre.x, y: livre.y });
    assert.ok(!caixa.some((m) => m.t === "passoSombras"), "não animou");
    assert.ok(caixa.some((m) => m.t === "error"));
  });

  test("jogador não faz o passo pelas sombras", () => {
    const { hotel, sala, colocar, onde } = montar();
    const [mag] = colocar("mascara-do-desespero");
    const caixa: ServerMsg[] = [];
    const j = hotel.attach((m) => caixa.push(JSON.parse(JSON.stringify(m)) as ServerMsg));
    hotel.receive(j, { t: "login", name: "Jogador", look });
    hotel.receive(j, { t: "join", roomId: sala.id });
    caixa.length = 0;
    const antes = { x: onde(mag.id)!.x, y: onde(mag.id)!.y };
    const livre = casaLivre(sala, [antes]);
    hotel.receive(j, { t: "passoSombras", tokenId: mag.id, x: livre.x, y: livre.y });
    assert.deepEqual({ x: onde(mag.id)!.x, y: onde(mag.id)!.y }, antes);
    assert.ok(!caixa.some((m) => m.t === "passoSombras"));
  });

  test("o mestre marca e desmarca sombras à mão; ficam na cena e vão no roomUpdate", () => {
    const { c, caixa, sala, hotel } = montar();
    const k = casaLivre(sala, []);
    hotel.receive(c, { t: "sombraMarcar", x: k.x, y: k.y, marcada: true });
    assert.deepEqual(sala.sombras, [k]);
    hotel.receive(c, { t: "sombraMarcar", x: k.x, y: k.y, marcada: true });
    assert.equal(sala.sombras?.length, 1, "marcar de novo não repete");
    const up = [...caixa].reverse().find((m) => m.t === "roomUpdate");
    assert.ok(up && up.t === "roomUpdate" && up.room.sombras?.length === 1);
    hotel.receive(c, { t: "sombraMarcar", x: 999, y: 999, marcada: true });
    assert.equal(sala.sombras?.length, 1, "casa fora da planta é recusada");
    hotel.receive(c, { t: "sombraMarcar", x: k.x, y: k.y, marcada: false });
    assert.equal(sala.sombras, undefined);
  });
});

describe("sombra de luz: o que vale como casa escura", () => {
  const vela = { x: 100, y: 100, radius: 80, intensity: 1 };

  test("perto da luz é claro; longe dela, com o cômodo escuro, é sombra", () => {
    assert.ok(!ehSombra(escuridaoNoPonto([vela], 0.8, 100, 100)), "no pé da vela");
    assert.ok(ehSombra(escuridaoNoPonto([vela], 0.8, 400, 400)), "longe da vela");
  });

  test("sem escuridão no cômodo não há sombra de luz (só as marcadas à mão)", () => {
    assert.ok(!ehSombra(escuridaoNoPonto([], 0, 5, 5)));
    assert.ok(!ehSombra(escuridaoNoPonto([], 0.2, 5, 5)));
  });

  test("a luz baixa é uma elipse: o mesmo desvio na vertical cai mais cedo que na horizontal", () => {
    const luz = { ...vela, k: 0.62 };
    const lado = escuridaoNoPonto([luz], 0.8, 100 + 70, 100);
    const cima = escuridaoNoPonto([luz], 0.8, 100, 100 + 70);
    assert.ok(cima > lado);
  });

  test("as sombras à mão vêm conferidas", () => {
    const l = lerSombras([{ x: 1, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 0 }, { x: 99, y: 0 }, { x: 1.5, y: 1 }, "x", null], 5, 5);
    assert.deepEqual(l, [{ x: 1, y: 2 }]);
    assert.deepEqual(lerSombras("nada", 5, 5), []);
  });
});

describe("a animação do passo", () => {
  test("afunda e fica preta na saída, some, e sobe preta e desbota na chegada", () => {
    const ini = fasePasso(0);
    assert.ok(ini.naSaida && ini.visivel && ini.altura === 1 && ini.preto === 0);
    const meio = fasePasso(300);
    assert.ok(meio.preto >= 0.99 && meio.altura < 1 && meio.altura > 0);
    const dentro = fasePasso(800);
    assert.ok(!dentro.naSaida && !dentro.visivel, "escondida entre a saída e a chegada");
    const sobe = fasePasso(1200);
    assert.ok(sobe.visivel && sobe.preto === 1 && sobe.altura > 0 && sobe.altura < 1);
    const fim = fasePasso(PASSO_SOMBRAS.fim);
    assert.ok(fim.acabou && fim.altura === 1 && fim.preto === 0 && fim.pocaSaida === 0 && fim.pocaChegada === 0);
    // a saída dura uns 0,5 s (do preto à peça toda dentro do chão)
    assert.ok(fasePasso(640).altura <= 0.001);
  });
});
