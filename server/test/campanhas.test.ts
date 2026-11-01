import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { lerConvite, novoConvite, regras, type ClientMsg, type ServerMsg } from "@crona/shared";
import { migrarCampanhas } from "../src/campanhas";
import type { Database } from "../src/db";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

type Msg<T extends ServerMsg["t"]> = Extract<ServerMsg, { t: T }>;

/** Uma conexão de teste: guarda tudo o que o servidor manda. */
class Peer {
  inbox: ServerMsg[] = [];
  readonly client;
  constructor(private hotel: Hotel) {
    this.client = hotel.attach((m) => this.inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg), undefined, false);
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
beforeEach(() => {
  const db = seedDb();
  upgradeDb(db);
  hotel = new Hotel({ db, persist: false, timers: false });
});

/** Cria a conta e devolve a conexão e a sessão. */
async function conta(nome: string) {
  const p = new Peer(hotel);
  p.send({ t: "contaCriar", nome, email: `${nome.toLowerCase()}@crona.test`, senha: "segredo1" });
  const r = await p.espera("conta");
  assert.ok(r.ok);
  return { p, sessao: r.ok ? r.sessao : "", papel: r.ok ? r.papel : null };
}

async function lista(p: Peer, m: ClientMsg) {
  p.send(m);
  return p.espera("campanhas");
}

describe("campanhas das contas", () => {
  test("o código de convite: 6 letras sem as que se confundem, lido do jeito que a pessoa digitar", () => {
    let n = 0;
    const c = novoConvite(() => (n++ % 10) / 10);
    assert.match(c, /^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    assert.equal(lerConvite(c.toLowerCase().replace("-", " ")), c);
    assert.equal(lerConvite("ABC"), null);
    assert.equal(lerConvite("AB0-OI1"), null);
  });

  test("a primeira vez: a história de hoje vira a principal, com os mestres e os jogadores que têm ficha", () => {
    const db = { contas: [
      { id: 1, nome: "Felipe", email: "f@x", senha: "", papel: "mestre", sessoes: [], criadaEm: 0 },
      { id: 2, nome: "Alosi", email: "a@x", senha: "", papel: "jogador", fichaId: 7, sessoes: [], criadaEm: 0 },
      { id: 3, nome: "Visita", email: "v@x", senha: "", papel: "jogador", sessoes: [], criadaEm: 0 },
    ] } as unknown as Database;
    assert.equal(migrarCampanhas(db, "Segredos do Outro Lado", 5), true);
    assert.deepEqual(db.campanhasJogo, [{ id: 1, nome: "Segredos do Outro Lado", sistema: "ordem-paranormal", criadaEm: 5, principal: true, membros: [
      { contaId: 1, papel: "mestre", desde: 5 },
      { contaId: 2, papel: "jogador", desde: 5 },
    ] }]);
    assert.equal(migrarCampanhas(db, "outra"), false);
  });

  test("o mestre vê a principal; cria outra em outro sistema; o jogador entra pelo código", async () => {
    const mestre = await conta("Felipe");
    assert.equal(mestre.papel, "mestre");
    let r = await lista(mestre.p, { t: "campanhasMinhas", sessao: mestre.sessao });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.lista.map((c) => [c.nome, c.papel, c.principal]), [["Segredos do Outro Lado", "mestre", true]]);

    r = await lista(mestre.p, { t: "campanhaCriar", sessao: mestre.sessao, nome: "  Neon   Sujo ", sistema: "cyberpunk" });
    assert.ok(r.ok && r.nova);
    const neon = r.ok ? r.lista.find((c) => c.id === (r.ok ? r.nova : 0))! : null;
    assert.equal(neon?.nome, "Neon Sujo");
    assert.equal(neon?.sistema, "cyberpunk");
    assert.equal(neon?.papel, "mestre");
    // a principal continua primeiro
    assert.equal(r.ok && r.lista[0].principal, true);

    const repetida = await lista(mestre.p, { t: "campanhaCriar", sessao: mestre.sessao, nome: "neon sujo", sistema: "cyberpunk" });
    assert.ok(!repetida.ok && /mesmo nome|esse nome/.test(repetida.erro));
    const semSistema = await lista(mestre.p, { t: "campanhaCriar", sessao: mestre.sessao, nome: "Outra", sistema: "xadrez" as never });
    assert.ok(!semSistema.ok && /sistema/.test(semSistema.erro));

    r = await lista(mestre.p, { t: "campanhaConvite", sessao: mestre.sessao, id: neon!.id, acao: "gerar" });
    const codigo = r.ok ? r.lista.find((c) => c.id === neon!.id)!.convite! : "";
    assert.match(codigo, /^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

    const jogador = await conta("Cora");
    assert.equal(jogador.papel, "jogador");
    r = await lista(jogador.p, { t: "campanhasMinhas", sessao: jogador.sessao });
    assert.deepEqual(r.ok && r.lista, []);
    // o jogador não mexe no convite de quem mestra
    const intruso = await lista(jogador.p, { t: "campanhaConvite", sessao: jogador.sessao, id: neon!.id, acao: "gerar" });
    assert.ok(!intruso.ok && /Só o mestre/.test(intruso.erro));
    const errado = await lista(jogador.p, { t: "campanhaEntrar", sessao: jogador.sessao, codigo: "ZZZ-ZZZ" });
    assert.ok(!errado.ok && /Nenhuma campanha/.test(errado.erro));
    r = await lista(jogador.p, { t: "campanhaEntrar", sessao: jogador.sessao, codigo: codigo.toLowerCase().replace("-", "") });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.lista.map((c) => [c.nome, c.papel, c.mestres, c.convite]), [["Neon Sujo", "jogador", ["Felipe"], undefined]]);

    // o mestre vê o jogador a mais; desligado o convite, o código para de valer
    r = await lista(mestre.p, { t: "campanhaConvite", sessao: mestre.sessao, id: neon!.id, acao: "desligar" });
    const naLista = r.ok ? r.lista.find((c) => c.id === neon!.id) : undefined;
    assert.equal(naLista?.jogadores, 1);
    assert.equal(naLista?.convite, undefined);
    const outro = await conta("Miguel");
    const fechado = await lista(outro.p, { t: "campanhaEntrar", sessao: outro.sessao, codigo });
    assert.ok(!fechado.ok);
  });

  test("entrar pelo código na principal faz da conta jogador do tabuleiro; o mestre não desce a jogador", async () => {
    const mestre = await conta("Felipe");
    const principal = hotel.db.campanhasJogo!.find((c) => c.principal)!;
    const r = await lista(mestre.p, { t: "campanhaConvite", sessao: mestre.sessao, id: principal.id, acao: "gerar" });
    const codigo = r.ok ? r.lista[0].convite! : "";
    const j = await conta("Alosi");
    await lista(j.p, { t: "campanhaEntrar", sessao: j.sessao, codigo });
    assert.equal(hotel.db.contas!.find((c) => c.nome === "Alosi")!.papel, "jogador");
    await lista(mestre.p, { t: "campanhaEntrar", sessao: mestre.sessao, codigo });
    assert.equal(hotel.db.contas!.find((c) => c.nome === "Felipe")!.papel, "mestre");
    assert.deepEqual(principal.membros.map((m) => m.papel), ["mestre", "jogador"]);
  });

  test("o jogador que liga a ficha pelo link entra na principal", async () => {
    await conta("Felipe");
    const agora = new Date().toISOString();
    hotel.db.fichas = [{ id: 1, nome: "Alosi", ficha: regras.novaFicha("Alosi"), criadaEm: agora, atualizadaEm: agora, chave: "chave-de-teste-123" }];
    const j = await conta("Alosi");
    j.p.send({ t: "login", name: "x", look, sessao: j.sessao, fichaKey: "chave-de-teste-123" });
    await j.p.espera("welcome");
    const r = await lista(j.p, { t: "campanhasMinhas", sessao: j.sessao });
    assert.deepEqual(r.ok && r.lista.map((c) => [c.principal, c.papel]), [[true, "jogador"]]);
  });

  test("o mestre renomeia, tira, gera o código de nova senha e apaga; o jogador sai sozinho", async () => {
    const mestre = await conta("Felipe");
    let r = await lista(mestre.p, { t: "campanhaCriar", sessao: mestre.sessao, nome: "Neon", sistema: "cyberpunk" });
    const id = r.ok ? r.nova! : 0;
    r = await lista(mestre.p, { t: "campanhaConvite", sessao: mestre.sessao, id, acao: "gerar" });
    const codigo = r.ok ? r.lista.find((c) => c.id === id)!.convite! : "";
    const cora = await conta("Cora");
    const miguel = await conta("Miguel");
    await lista(cora.p, { t: "campanhaEntrar", sessao: cora.sessao, codigo });
    await lista(miguel.p, { t: "campanhaEntrar", sessao: miguel.sessao, codigo });
    const coraId = hotel.db.contas!.find((c) => c.nome === "Cora")!.id;

    r = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id, acao: "renomear", nome: "Neon Velho" });
    const neon = r.ok ? r.lista.find((c) => c.id === id) : undefined;
    assert.equal(neon?.nome, "Neon Velho");
    assert.deepEqual(neon?.membros?.map((m) => m.nome), ["Felipe", "Cora", "Miguel"]);
    // o jogador não mexe
    const intruso = await lista(cora.p, { t: "campanhaMudar", sessao: cora.sessao, id, acao: "apagar" });
    assert.ok(!intruso.ok && /Só o mestre/.test(intruso.erro));
    // o mestre só sai se houver outro mestre
    const sozinho = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id, acao: "sair" });
    assert.ok(!sozinho.ok && /único mestre/.test(sozinho.erro));

    // o código de nova senha: vale uma vez e entra na conta
    r = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id, acao: "senha", contaId: coraId });
    const nova = r.ok ? r.senha : undefined;
    assert.equal(nova?.nome, "Cora");
    const p = new Peer(hotel);
    p.send({ t: "contaRecuperar", email: "cora", codigo: "AAA-AAA", senha: "nova-senha" });
    assert.ok(!(await p.espera("conta")).ok);
    p.send({ t: "contaRecuperar", email: "cora@crona.test", codigo: nova!.codigo.toLowerCase(), senha: "nova-senha" });
    assert.ok((await p.espera("conta")).ok);
    p.send({ t: "contaRecuperar", email: "cora@crona.test", codigo: nova!.codigo, senha: "outra-senha" });
    assert.ok(!(await p.espera("conta")).ok);
    // a sessão velha da Cora caiu junto com a senha velha
    const velha = await lista(cora.p, { t: "campanhasMinhas", sessao: cora.sessao });
    assert.ok(!velha.ok && velha.expirou);

    r = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id, acao: "tirar", contaId: coraId });
    assert.deepEqual(r.ok && r.lista.find((c) => c.id === id)!.membros!.map((m) => m.nome), ["Felipe", "Miguel"]);
    r = await lista(miguel.p, { t: "campanhaMudar", sessao: miguel.sessao, id, acao: "sair" });
    assert.deepEqual(r.ok && r.lista, []);

    // a principal não se apaga; a outra sim
    const principal = hotel.db.campanhasJogo!.find((c) => c.principal)!;
    const naoApaga = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id: principal.id, acao: "apagar" });
    assert.ok(!naoApaga.ok);
    r = await lista(mestre.p, { t: "campanhaMudar", sessao: mestre.sessao, id, acao: "apagar" });
    assert.deepEqual(r.ok && r.lista.map((c) => c.id), [principal.id]);
  });

  test("minha conta: troca nome, e-mail e senha só com a senha de agora; sair dos outros aparelhos", async () => {
    const eu = await conta("Felipe");
    const outro = new Peer(hotel);
    outro.send({ t: "contaEntrar", email: "felipe@crona.test", senha: "segredo1" });
    const sessao2 = await outro.espera("conta");
    eu.p.send({ t: "contaDados", sessao: eu.sessao });
    let d = await eu.p.espera("contaDados");
    assert.ok(d.ok && d.aparelhos === 2 && d.email === "felipe@crona.test");

    eu.p.send({ t: "contaMudar", sessao: eu.sessao, senhaAtual: "errada", nome: "Lipe" });
    d = await eu.p.espera("contaDados");
    assert.ok(!d.ok && /não confere/.test(d.erro));
    eu.p.send({ t: "contaMudar", sessao: eu.sessao, senhaAtual: "segredo1", nome: "Lipe", email: "LIPE@crona.test" });
    d = await eu.p.espera("contaDados");
    assert.ok(d.ok && d.nome === "Lipe" && d.email === "lipe@crona.test" && /nome/.test(d.feito ?? ""));
    assert.equal(hotel.db.contas!.find((c) => c.nome === "Lipe")!.papel, "mestre");

    eu.p.send({ t: "contaSairOutros", sessao: eu.sessao });
    d = await eu.p.espera("contaDados");
    assert.ok(d.ok && d.aparelhos === 1 && /1 outro aparelho/.test(d.feito ?? ""));
    outro.send({ t: "campanhasMinhas", sessao: sessao2.ok ? sessao2.sessao : "" });
    const caiu = await outro.espera("campanhas");
    assert.ok(!caiu.ok && caiu.expirou);

    eu.p.send({ t: "contaMudar", sessao: eu.sessao, senhaAtual: "segredo1", senhaNova: "nova-senha" });
    d = await eu.p.espera("contaDados");
    assert.ok(d.ok && /senha/.test(d.feito ?? ""));
    const p = new Peer(hotel);
    p.send({ t: "contaEntrar", email: "lipe", senha: "nova-senha" });
    assert.ok((await p.espera("conta")).ok);
  });

  test("sem sessão válida, a lista pede para entrar de novo", async () => {
    const p = new Peer(hotel);
    const r = await lista(p, { t: "campanhasMinhas", sessao: "nada" });
    assert.ok(!r.ok && r.expirou);
  });
});
