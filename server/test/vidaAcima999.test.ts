import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyVital, sanitizeVitals, VITAL_LIMIT, VITAL_LIMIT_PV } from "@crona/shared";
import { combate } from "@crona/shared";
import { seedDb } from "../src/seed";
import { vidaAcima999 } from "../src/vidaAcima999";

const vitais = (pv: number, pvMax: number) => ({ pv, pvMax, pe: 0, peMax: 0, san: 0, sanMax: 0 });

describe("PV acima de 999 (a Magistrada tem 1200, LR p. 252)", () => {
  test("o total de PV vai até o teto novo, e PE e SAN continuam em 999", () => {
    const v = applyVital(applyVital(vitais(20, 20), "pv", { max: 1200 }), "pv", { value: 1200 });
    assert.equal(v.pvMax, 1200);
    assert.equal(v.pv, 1200);
    assert.equal(applyVital(vitais(20, 20), "pv", { max: 99999 }).pvMax, VITAL_LIMIT_PV);
    assert.equal(applyVital(vitais(20, 20), "pe", { max: 5000 }).peMax, VITAL_LIMIT);
    assert.equal(sanitizeVitals({ pv: 1413, pvMax: 1413, pe: 0, peMax: 0, san: 0, sanMax: 0 })?.pvMax, 1413);
  });

  test("o dano reduz a barra de 1200", () => {
    const v = applyVital(vitais(1200, 1200), "pv", { delta: -250 });
    assert.deepEqual([v.pv, v.pvMax], [950, 1200]);
  });

  test("migração: a Magistrada cortada em 999/999 sobe a 1200/1200, uma vez só, sem mexer nas peças que o mestre ajustou", () => {
    const db = seedDb();
    const sala = db.rooms[0];
    const base = { x: 0, y: 0, dir: 0, look: {} as never, color: "#fff" };
    const mag = { ...base, id: 9001, name: "Magistrada", criatura: { id: "mascara-do-desespero", aparencia: "padrao" }, vitals: vitais(999, 999) };
    const ferida = { ...base, id: 9002, name: "Magistrada 2", criatura: { id: "mascara-do-desespero", aparencia: "padrao" }, vitals: vitais(400, 999) };
    const ajustada = { ...base, id: 9003, name: "Magistrada 3", criatura: { id: "mascara-do-desespero", aparencia: "padrao" }, vitals: vitais(700, 700) };
    const pequena = { ...base, id: 9004, name: "Vulto", criatura: { id: "vulto", aparencia: "padrao" }, vitals: vitais(999, 999) };
    sala.tokens = [...(sala.tokens ?? []), mag, ferida, ajustada, pequena] as never;
    assert.equal(combate.AMEACAS_LIVRO.find((a) => a.id === "mascara-do-desespero")!.pv, 1200);
    assert.equal(vidaAcima999(db), true);
    const por = (id: number) => sala.tokens!.find((t) => t.id === id)!.vitals!;
    assert.deepEqual([por(9001).pv, por(9001).pvMax], [1200, 1200]);
    assert.deepEqual([por(9002).pv, por(9002).pvMax], [400, 1200], "machucada: só o total sobe");
    assert.deepEqual([por(9003).pv, por(9003).pvMax], [700, 700], "o mestre ajustou: fica");
    assert.deepEqual([por(9004).pv, por(9004).pvMax], [999, 999], "o livro não diz mais que 999");
    assert.equal(vidaAcima999(db), false, "uma vez só");
  });
});
