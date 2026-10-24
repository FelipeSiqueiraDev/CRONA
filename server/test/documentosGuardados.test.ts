import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { capaDoDocumento, documentoNoMovel, documentoParaJogador, paginasDoDocumento, sanitizarDocumento } from "@crona/shared";

describe("documentos guardados nos móveis, com as páginas em imagem (24/10)", () => {
  const bruto = {
    titulo: "Folha de presença",
    tipo: "registro",
    grupo: "pista",
    paginas: [""],
    para: [],
    equipe: false,
    imagens: ["/uploads/0123456789abcdef.webp", "/uploads/fedcba9876543210.png", "javascript:alert(1)", "/outro/lugar.png"],
    guardado: { cena: 232, x: 2, y: 0 },
  };

  test("as páginas em imagem passam (só as de /uploads) e o lugar onde está guardado fica", () => {
    const d = sanitizarDocumento(bruto)!;
    assert.deepEqual(d.imagens, ["/uploads/0123456789abcdef.webp", "/uploads/fedcba9876543210.png"]);
    assert.deepEqual(d.guardado, { cena: 232, x: 2, y: 0 });
    assert.equal(paginasDoDocumento(d), 2, "duas páginas em imagem, uma de texto vazia: duas páginas");
    assert.equal(capaDoDocumento(d), "/uploads/0123456789abcdef.webp");
  });

  test("o lugar sem cena ou sem casa não passa", () => {
    assert.equal(sanitizarDocumento({ ...bruto, guardado: { x: 1, y: 1 } })!.guardado, undefined);
    assert.equal(sanitizarDocumento({ ...bruto, guardado: "estante" })!.guardado, undefined);
  });

  test("o documento está no móvel que cobre a casa dele, só na cena dele", () => {
    const d = sanitizarDocumento(bruto)!;
    assert.ok(documentoNoMovel(d, 232, [{ x: 2, y: 0 }, { x: 3, y: 0 }]));
    assert.ok(!documentoNoMovel(d, 232, [{ x: 4, y: 0 }]));
    assert.ok(!documentoNoMovel(d, 999, [{ x: 2, y: 0 }]));
  });

  test("o jogador recebe o documento sem saber onde ele estava guardado", () => {
    const d = sanitizarDocumento({ ...bruto, para: [7] })!;
    const j = documentoParaJogador(d, 7);
    assert.equal(j.guardado, undefined);
    assert.deepEqual(j.imagens, d.imagens);
  });
});
