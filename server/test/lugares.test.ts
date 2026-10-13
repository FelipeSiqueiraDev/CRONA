import assert from "node:assert/strict";
import { test } from "node:test";
import { Hotel } from "../src/hotel";
import { seedDb, upgradeDb } from "../src/seed";

const novoHotel = () => {
  const db = seedDb();
  upgradeDb(db);
  return new Hotel({ db, persist: false, timers: false });
};
const nomeDaSala = (h: Hotel, id: number) => h.db.rooms.find((r) => r.id === id)?.name;

test("os lugares do mapa-múndi: a Sede inteira (com a Câmara do Selo) entra pelo Bar; a fazenda, pela vista de fora", () => {
  const h = novoHotel();
  const ls = h.lugares();
  const sede = ls.find((l) => l.nome === "Sede da Ordem");
  const fazenda = ls.find((l) => /Fazenda/.test(l.nome));
  assert.ok(sede && fazenda);
  assert.equal(nomeDaSala(h, sede.entrada), "Sede · Bar");
  assert.equal(nomeDaSala(h, fazenda.entrada), "Fazenda · Olhos de Águia");
  assert.equal(sede.icone, "predio");
  assert.equal(fazenda.icone, "fazenda");
  // a Câmara do Selo não vira um lugar à parte
  assert.ok(!ls.some((l) => l.nome === "Sede"));
  assert.ok(sede.salas >= 12);
});
