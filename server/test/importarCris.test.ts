import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import { regras, type ClientMsg, type ServerMsg } from "@crona/shared";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";
import { confereSenha } from "../src/contas";
import { importarContasCris, type UsuarioCris } from "../src/importarCris";

type Msg<T extends ServerMsg["t"]> = Extract<ServerMsg, { t: T }>;

/** Uma conexão de teste: guarda tudo o que o servidor manda. */
class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(
    private hotel: Hotel,
    local = false,
  ) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, local);
  }
  send(m: ClientMsg) {
    this.hotel.receive(this.client, m);
  }
  async espera<T extends ServerMsg["t"]>(t: T): Promise<Msg<T>> {
    for (let i = 0; i < 300; i++) {
      const k = this.inbox.findIndex((m) => m.t === t);
      if (k >= 0) return this.inbox.splice(k, 1)[0] as Msg<T>;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`não chegou ${t}`);
  }
}

const look = { skin: "#e8b98f", hair: "#3b2618", hairStyle: 0, top: "#2b2a30", pants: "#1c1b1f", shoes: "#3d3a40", outfit: 1, extra: 0, charId: null };

let hotel: Hotel;
/** o bcrypt do C.R.I.S (custo baixo, só para o teste ser rápido) */
let hashCris: string;
const agora = new Date().toISOString();
const ficha = (id: number, nome: string) => ({ id, nome, ficha: regras.novaFicha(nome), criadaEm: agora, atualizadaEm: agora });

const usuario = (o: Partial<UsuarioCris>): UsuarioCris => ({ id: "u1", username: "Gasai", nome: "Gasai", email: null, hash: hashCris, personagem: "D. Tepes", ...o });

beforeEach(async () => {
  const db = seedDb();
  upgradeDb(db);
  db.fichas = [ficha(1, "D.Tepes"), ficha(2, "Catarina Albuquerque"), { ...ficha(3, "Cora Falcão"), chave: "chave-da-cora" }];
  hotel = new Hotel({ db, persist: false, timers: false });
  hashCris ??= await bcrypt.hash("senha-do-cris", 4);
});

describe("as contas do C.R.I.S", () => {
  test("o bcrypt do C.R.I.S confere a senha de sempre", async () => {
    assert.ok(await confereSenha("senha-do-cris", hashCris));
    assert.ok(!(await confereSenha("outra", hashCris)));
    assert.ok(!(await confereSenha("senha-do-cris", "$2b$10$quebrado")));
  });

  test("cada jogador vira conta de jogador ligada à ficha do personagem; rodar de novo não duplica", () => {
    const lista = [
      usuario({}),
      usuario({ id: "u2", username: "liz-coolan@hotmail.com", nome: "Lorena", personagem: "Catarina Albuquerque" }),
      usuario({ id: "u3", username: "Ioliverg", nome: "Laura Gomes", personagem: "cora falcao" }),
      usuario({ id: "u4", username: "jogador_teste", personagem: "Agente Teste" }),
    ];
    const r = importarContasCris(hotel.db, lista);
    assert.deepEqual(r.map((x) => x.feito), ["nova", "nova", "nova", "sem ficha"]);
    const contas = hotel.db.contas!;
    const gasai = contas.find((c) => c.crisId === "u1")!;
    assert.equal(gasai.nome, "Gasai");
    assert.equal(gasai.papel, "jogador");
    assert.equal(gasai.fichaId, 1);
    // o usuário que era um e-mail entra pelo e-mail; o nome da conta é o nome dela
    const lorena = contas.find((c) => c.crisId === "u2")!;
    assert.equal(lorena.nome, "Lorena");
    assert.equal(lorena.email, "liz-coolan@hotmail.com");
    assert.equal(contas.find((c) => c.crisId === "u3")!.fichaId, 3);
    // a ficha sem link ganhou um; a que tinha ficou com o dela
    assert.ok(hotel.db.fichas![0].chave);
    assert.equal(hotel.db.fichas![2].chave, "chave-da-cora");
    const total = contas.length;
    const de2 = importarContasCris(hotel.db, lista);
    assert.equal(contas.length, total);
    assert.deepEqual(de2.map((x) => x.feito), ["atualizada", "atualizada", "atualizada", "sem ficha"]);
  });

  test("não passa por cima de uma conta do CRONA com o mesmo nome", async () => {
    const p = new Peer(hotel);
    p.send({ t: "contaCriar", nome: "Gasai", email: "gasai@crona.test", senha: "segredo1" });
    await p.espera("conta");
    const [r] = importarContasCris(hotel.db, [usuario({})]);
    assert.equal(r.feito, "nome ocupado");
    assert.equal(hotel.db.contas!.length, 1);
  });

  test("entra com a senha do C.R.I.S, cai na ficha dele, e a senha vira scrypt", async () => {
    importarContasCris(hotel.db, [usuario({})]);
    const p = new Peer(hotel);
    p.send({ t: "contaEntrar", email: "gasai", senha: "errada" });
    const e = await p.espera("conta");
    assert.ok(!e.ok);
    assert.ok(hotel.db.contas![0].senha.startsWith("$2b$"), "senha errada não mexe no hash");
    p.send({ t: "contaEntrar", email: "GASAI", senha: "senha-do-cris" });
    const r = await p.espera("conta");
    assert.ok(r.ok && r.papel === "jogador" && r.fichaKey === hotel.db.fichas![0].chave);
    const conta = hotel.db.contas![0];
    assert.ok(conta.senha.startsWith("scrypt$"));
    // daqui em diante, a mesma senha confere no scrypt; rodar a importação de novo não volta o bcrypt
    importarContasCris(hotel.db, [usuario({})]);
    assert.ok(conta.senha.startsWith("scrypt$"));
    const q = new Peer(hotel);
    q.send({ t: "contaEntrar", email: "gasai", senha: "senha-do-cris" });
    const de = await q.espera("conta");
    assert.ok(de.ok);
    if (!de.ok) return;
    q.send({ t: "login", name: "x", look, sessao: de.sessao });
    assert.equal((await q.espera("welcome")).role, "player");
  });

  test("a tela do falso C.R.I.S: ligada por padrão, só o mestre desliga", async () => {
    assert.equal(hotel.falsoCrisLigado(), true);
    const j = new Peer(hotel);
    j.send({ t: "login", name: "Jogador", look, mesa: true });
    await j.espera("welcome");
    j.send({ t: "falsoCris", ligado: false });
    assert.equal(hotel.falsoCrisLigado(), true);
    const m = new Peer(hotel, true);
    m.send({ t: "login", name: "Mestre", look });
    assert.equal((await m.espera("welcome")).role, "gm");
    m.send({ t: "falsoCris" });
    assert.equal((await m.espera("falsoCris")).ligado, true);
    m.send({ t: "falsoCris", ligado: false });
    assert.equal((await m.espera("falsoCris")).ligado, false);
    assert.equal(hotel.falsoCrisLigado(), false);
  });
});
