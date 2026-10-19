import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import { regras, type FichaSalva } from "@crona/shared";
import type { Database } from "../src/db";
import { igualarMarcadosCris, mochilasDaHistoria, zerarMochilasMarcados, avisosDe1910, tepesECora1910 } from "../src/marcadosCris";

/** Os 4 Marcados iguais ao C.R.I.S (18/10): o estado de jogo, a mochila e os avisos, uma vez só. */
describe("Marcados iguais ao C.R.I.S", () => {
  // as 4 fichas como estavam no jogo antes (sem a chave do link do jogador)
  const antes = JSON.parse(fs.readFileSync(new URL("./marcados-antes.json", import.meta.url), "utf8")) as FichaSalva[];
  const db = { fichas: antes } as unknown as Database;
  const ficha = (nome: string) => db.fichas!.find((f) => f.nome === nome)!;

  test("aplica uma vez", () => {
    assert.equal(igualarMarcadosCris(db), true);
    assert.equal(igualarMarcadosCris(db), false);
  });

  test("o estado de jogo é o do C.R.I.S", () => {
    assert.deepEqual({ pv: ficha("D.Tepes").atual?.pv, pe: ficha("D.Tepes").atual?.pe, san: ficha("D.Tepes").atual?.san }, { pv: 34, pe: 12, san: 6 });
    assert.equal(ficha("Alosi Walker").atual?.pv, 9);
  });

  test("sem os achados de exemplo, a Alosi e a Cora não ficam sobrecarregadas", () => {
    for (const nome of ["D.Tepes", "Catarina Albuquerque", "Alosi Walker", "Cora Falcão"]) assert.ok(!ficha(nome).ficha.inventario.some((i) => i.tipo === "cena"), nome);
    assert.equal(regras.calcular(ficha("Alosi Walker").ficha).defesa, 11);
    assert.equal(regras.calcular(ficha("Cora Falcão").ficha).defesa, 13);
  });

  test("a Catarina ganha as granadas e o Pé de Mesa, com uid novo", () => {
    const inv = ficha("Catarina Albuquerque").ficha.inventario;
    for (const id of ["granada-de-fumaca", "granada-de-fragmentacao", "arma-improvisada"]) assert.ok(inv.some((i) => i.id === id), id);
    const uids = db.fichas!.flatMap((f) => f.ficha.inventario.map((i) => i.uid));
    assert.equal(new Set(uids).size, uids.length);
  });

  test("cada um tem os avisos", () => {
    for (const nome of ["D.Tepes", "Catarina Albuquerque", "Alosi Walker", "Cora Falcão"]) assert.ok(ficha(nome).ficha.avisos?.length, nome);
  });

  test("a mochila da história: só o que o Felipe disse", () => {
    assert.equal(mochilasDaHistoria(db), true);
    assert.equal(mochilasDaHistoria(db), false);
    assert.deepEqual(ficha("D.Tepes").ficha.inventario.map((i) => i.id), ["corrente"]);
    assert.deepEqual(ficha("Cora Falcão").ficha.inventario.map((i) => i.id), ["faca", "arma-improvisada"]);
    assert.deepEqual(ficha("Catarina Albuquerque").ficha.inventario.map((i) => i.id), ["arma-improvisada"]);
    const alosi = ficha("Alosi Walker").ficha.inventario;
    assert.equal(alosi.filter((i) => i.tipo === "cena").length, 2);
    assert.deepEqual(alosi.filter((i) => i.escolha?.elemento).map((i) => i.escolha!.elemento), ["morte", "morte", "sangue", "energia", "energia"]);
    const k = regras.calcular(ficha("Alosi Walker").ficha);
    assert.ok(!k.problemas.some((p) => /desconhecid/i.test(p.texto)));
  });

  test("a mochila zerada de todos, uma vez", () => {
    assert.equal(zerarMochilasMarcados(db), true);
    assert.equal(zerarMochilasMarcados(db), false);
    for (const nome of ["D.Tepes", "Catarina Albuquerque", "Alosi Walker", "Cora Falcão"]) assert.deepEqual(ficha(nome).ficha.inventario, [], nome);
  });

  test("regra da mesa: o Vigor e a Presença só do NEX do aumento em diante (Cora 37 PV, Alosi 29 PE)", () => {
    assert.equal(regras.calcular(ficha("Cora Falcão").ficha).pv, 37);
    assert.equal(regras.calcular(ficha("Alosi Walker").ficha).pe, 29);
    assert.equal(regras.calcular(ficha("D.Tepes").ficha).pv, 44);
    assert.equal(avisosDe1910(db), true);
    assert.equal(avisosDe1910(db), false);
    assert.match(ficha("Cora Falcão").ficha.avisos![0], /37/);
    assert.ok(ficha("D.Tepes").ficha.avisos!.some((t) => /Ciências e Intuição/.test(t)));
  });

  test("19/10: o Vigor do Tepes no NEX 20% (45 PV), sem os avisos dele e da Cora; a etapa liga o Ser Amaldiçoado", () => {
    assert.equal(tepesECora1910(db), true);
    assert.equal(tepesECora1910(db), false);
    const t = ficha("D.Tepes").ficha;
    const k = regras.calcular(t);
    assert.equal(k.atributos.vig, 4);
    assert.equal(k.pv, 45);
    assert.equal(k.pendencias.length, 0);
    assert.equal(t.avisos, undefined);
    assert.equal(ficha("Cora Falcão").ficha.avisos, undefined);
    assert.deepEqual(k.resistencias, {});
    const com = regras.calcular({ ...t, etapaCumprida: true });
    assert.deepEqual(com.resistencias, { balistico: 5, sangue: 5 });
    assert.equal(com.pericias.ciencias.penalidadeDados, -1);
    assert.equal(com.reacoes.bloqueio, 5);
  });
});
