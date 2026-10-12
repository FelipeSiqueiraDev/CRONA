import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sortDrawables, type Drawable } from "../../client/src/render/sort";

/**
 * A ordem de desenho do tabuleiro (client/src/render/sort.ts) com as caixas das pegadas (12/10): a
 * mesa maior que a pegada e a cadeira que desliza para baixo do tampo se cruzam na tela, mas a ordem
 * vem das casas de verdade.
 */
type Caixa = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
const peca = (nome: string, box: Caixa, extra: Partial<Drawable> = {}): Drawable & { nome: string } => ({
  nome,
  box,
  // o retângulo na tela é grande de propósito: todo mundo se cruza (o desenho passa da pegada)
  sx0: -1000,
  sx1: 1000,
  sy0: -1000,
  sy1: 1000,
  draw: () => {},
  ...extra,
});
const ordem = (l: (Drawable & { nome: string })[]) => sortDrawables(l).map((d) => (d as Drawable & { nome: string }).nome);
const antes = (o: string[], a: string, b: string) => assert.ok(o.indexOf(a) < o.indexOf(b), `${a} antes de ${b}: ${o.join(", ")}`);

describe("ordem de desenho pelas pegadas", () => {
  // a mesa de jantar 2×4 (x 4..6, y 2..6), na altura nova
  const mesa = { x0: 4, x1: 6, y0: 2, y1: 6, z0: 0, z1: 1.53 };

  test("a cadeira de trás vem antes da mesa; a da frente, depois; as dos lados, cada uma no seu lado", () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const lista = [
        peca("mesa", mesa),
        peca("tras", { x0: 4, x1: 5, y0: 1, y1: 2, z0: 0, z1: 1.5 }),
        peca("frente", { x0: 4, x1: 5, y0: 6, y1: 7, z0: 0, z1: 1.5 }),
        peca("esquerda", { x0: 3, x1: 4, y0: 3, y1: 4, z0: 0, z1: 1.5 }),
        peca("direita", { x0: 6, x1: 7, y0: 4, y1: 5, z0: 0, z1: 1.5 }),
      ];
      // a ordem da lista não muda o resultado
      for (let k = 0; k < rodada; k++) lista.push(lista.shift()!);
      const o = ordem(lista);
      antes(o, "tras", "mesa");
      antes(o, "esquerda", "mesa");
      antes(o, "mesa", "frente");
      antes(o, "mesa", "direita");
    }
  });

  test("a peça escondida e a cadeira encaixada embaixo vêm antes da mesa; a caneca em cima, depois", () => {
    const o = ordem([
      peca("caneca", { x0: 5, x1: 6, y0: 3, y1: 4, z0: 1.53, z1: 1.86 }),
      peca("mesa", mesa),
      peca("escondida", { x0: 4.3, x1: 4.7, y0: 4.3, y1: 4.7, z0: 0, z1: 2.9 }, { sob: true }),
      peca("encaixada", { x0: 5, x1: 6, y0: 5, y1: 6, z0: 0, z1: 1.5 }, { sob: true }),
    ]);
    antes(o, "escondida", "mesa");
    antes(o, "encaixada", "mesa");
    antes(o, "mesa", "caneca");
  });
});
