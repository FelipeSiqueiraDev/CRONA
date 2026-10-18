import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHAMAS_DAS_CRIATURAS, DEGRAUS_DA_CHAMA, chamaDaCriatura, combate, criaturaDoLivro, lerChama, lerCriatura, paletaDaChama, ventoDaChama } from "@crona/shared";

const FACES = ["anfitriao-amphitruo", "anfitriao-aeneas", "anfitriao-liber", "anfitriao-silenus", "anfitriao-plautus"];

describe("chama fantasmagórica das criaturas", () => {
  test("o Anfitrião e as cinco faces têm chama, cada face na cor dela", () => {
    assert.ok(CHAMAS_DAS_CRIATURAS["anfitriao"]);
    for (const id of FACES) assert.ok(CHAMAS_DAS_CRIATURAS[id], id);
    // as cores combinadas com o Felipe: azul-fantasma, vermelho, laranja, azul-água, rosa
    const matiz = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return { r, g, b };
    };
    const a = matiz(CHAMAS_DAS_CRIATURAS["anfitriao-amphitruo"].cor);
    assert.ok(a.b > a.r && a.b > 200, "Amphitruo azul-fantasma");
    const e = matiz(CHAMAS_DAS_CRIATURAS["anfitriao-aeneas"].cor);
    assert.ok(e.r > 200 && e.g < 90 && e.b < 90, "Aeneas vermelho");
    const l = matiz(CHAMAS_DAS_CRIATURAS["anfitriao-liber"].cor);
    assert.ok(l.r > 230 && l.g > 110 && l.g < 170 && l.b < 60, "Liber laranja");
    const s = matiz(CHAMAS_DAS_CRIATURAS["anfitriao-silenus"].cor);
    assert.ok(s.g > 180 && s.b > 160 && s.r < 90, "Silenus azul-água");
    const p = matiz(CHAMAS_DAS_CRIATURAS["anfitriao-plautus"].cor);
    assert.ok(p.r > 230 && p.b > 140 && p.g < 140, "Plautus rosa");
    // o Anfitrião é azul e roxo, com o toque de magenta
    const o = CHAMAS_DAS_CRIATURAS["anfitriao"];
    assert.ok(matiz(o.cor).b > matiz(o.cor).r, "corpo azul");
    assert.ok(o.acento && matiz(o.acento).r > 80 && matiz(o.acento).b > 150 && matiz(o.acento).g < 60, "borda roxa");
    assert.ok(o.toque && matiz(o.toque).r > 200 && matiz(o.toque).b > 150, "toque magenta");
  });

  test("todo portador do Anfitrião da lista de relíquias tem chama (por dado, não por if)", () => {
    for (const id of combate.PORTADORES_RELIQUIA.filter((x) => x.startsWith("anfitriao"))) assert.ok(chamaDaCriatura(id), id);
    assert.equal(chamaDaCriatura("o-diabo"), null, "quem não tem o campo não ganha chama");
  });

  test("a criatura do livro já nasce com a chama da tabela, e a própria vale mais que a da tabela", () => {
    const c = criaturaDoLivro("anfitriao-liber");
    assert.deepEqual(c?.chama, CHAMAS_DAS_CRIATURAS["anfitriao-liber"]);
    assert.equal(criaturaDoLivro("o-diabo")?.chama, undefined);
    const propria = { cor: "#00ff00", intensidade: 1.5 };
    assert.equal(chamaDaCriatura("anfitriao-liber", propria), propria);
    assert.equal(chamaDaCriatura("o-diabo", propria), propria, "dá para pôr chama em outra criatura (o Existido, o Deus da Morte)");
  });

  test("lerChama confere cor e intensidade; a criatura lida guarda a chama", () => {
    assert.equal(lerChama(null), null);
    assert.equal(lerChama({ cor: "azul" }), null);
    assert.equal(lerChama({ cor: "#12345" }), null);
    assert.deepEqual(lerChama({ cor: "#AABBCC", intensidade: 9 }), { cor: "#aabbcc", intensidade: 2.5 });
    assert.deepEqual(lerChama({ cor: "#aabbcc", intensidade: -3, acento: "x", toque: "#ff00ff" }), { cor: "#aabbcc", toque: "#ff00ff", intensidade: 0.2 });
    const c = criaturaDoLivro("anfitriao-aeneas")!;
    const lida = lerCriatura(JSON.parse(JSON.stringify(c)));
    assert.deepEqual(lida?.chama, c.chama);
    assert.equal(lerCriatura({ ...JSON.parse(JSON.stringify(c)), chama: { cor: "lixo" } })?.chama, undefined);
  });

  test("a paleta tem os degraus todos, os dois primeiros vazios, e vai do escuro ao claro e do ralo ao cheio", () => {
    for (const ch of Object.values(CHAMAS_DAS_CRIATURAS)) {
      const { corpo, toque } = paletaDaChama(ch.cor, ch.acento, ch.toque);
      assert.equal(corpo.length, DEGRAUS_DA_CHAMA);
      assert.equal(toque.length, DEGRAUS_DA_CHAMA);
      assert.equal(corpo[0][3], 0);
      assert.equal(corpo[1][3], 0);
      const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      for (let i = 3; i < DEGRAUS_DA_CHAMA; i++) {
        assert.ok(corpo[i][3] >= corpo[i - 1][3], `opacidade sobe (${ch.cor})`);
        assert.ok(lum(corpo[i]) >= lum(corpo[i - 1]) - 1, `claridade sobe (${ch.cor})`);
      }
      assert.ok(corpo[DEGRAUS_DA_CHAMA - 1][3] < 255, "fantasma: nem o miolo é sólido");
    }
    // sem toque, o toque é a própria cor
    const sem = paletaDaChama("#ff8a1e");
    assert.deepEqual(sem.toque, sem.corpo);
  });

  test("o vento: parada a chama sobe reta e alta; andando é arrastada para trás e encolhe", () => {
    const parada = ventoDaChama(0, 0);
    assert.equal(parada.inclina, 0);
    assert.equal(parada.encolhe, 0);
    const direita = ventoDaChama(60, 0);
    assert.ok(direita.inclina < -0.9, "andando para a direita, pende para a esquerda");
    assert.ok(direita.encolhe > 0.3);
    const esquerda = ventoDaChama(-60, 0);
    assert.ok(esquerda.inclina > 0.9);
    const devagar = ventoDaChama(10, 0);
    assert.ok(Math.abs(devagar.inclina) < Math.abs(direita.inclina), "mais devagar, menos arrasto");
    assert.ok(ventoDaChama(0, 60).encolhe > 0.3, "andar para cima ou para baixo da tela também encurta a chama");
  });
});
