import type { Door } from "@crona/shared";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planTop } from "./seedSede";
import type { CenaSpec } from "./seedFazenda";

/**
 * As casas comuns de cidade, sem nome (Santa Amália, Tiradentes, Igarapé), e o banheirinho de cada uma (17/10, o
 * Felipe: "as casas genéricas podiam ter ao menos um banheirinho básico"; e "Minas Gerais não é só roça não, a gente
 * também tem tecnologia e coisas bonitas, moderninhas").
 *
 * As duas plantas têm a sala e a cozinha num cômodo só (9 x 7 casas, 6,75 x 5,25 m). Na parede da direita (a da frente,
 * que não aparece), a porta do banheiro: 3 x 3 casas (2,25 x 2,25 m, uns 5 m²), com o chuveiro, a pia com o espelho e
 * o vaso. `lado`: a porta de fora virada para a frente da tela (a de dentro na parede da frente) ou para o fundo (na
 * parede do fundo, na casa 4). Cada uma devolve as duas cenas: a casa e o banheiro (a chave dele é a da casa com
 * "_banho").
 *
 * Nova cidade com casas comuns? Use uma delas: o banheiro e a porta vêm junto.
 */
interface Casa {
  key: string;
  /** o nome da cidade, como vai no nome da cena ("Tiradentes · ") */
  prefixo: string;
  lado: "frente" | "fundo";
  description: string;
  /** o piso da casa */
  style: CenaSpec["style"];
  /** a luz de dentro da cidade */
  clima: Pick<CenaSpec, "darkness" | "ambient" | "particles">;
}

/** Planta retangular com a porta na parede da esquerda, na fileira doorY. */
function planLeft(w: number, h: number, doorY: number): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push((y === doorY ? "0" : "x") + "0".repeat(w));
  return { heightmap: rows.join("\n"), door: { x: 0, y: doorY, dir: 2 } };
}

const lampadas = (...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => ["ceiling_lamp", x, y, 0] as FloorSeed);

/** A fileira da porta do banheiro, na parede da direita da sala (a sala começa na fileira y0). */
const FILEIRA_BANHO = 4;

/** As duas cenas: a casa (com a porta do banheiro e a passagem para ele) e o banheiro. */
function comBanheiro(o: Casa, casa: Omit<CenaSpec, "key" | "name" | "description" | "andar" | "style" | "links" | "plan"> & { links: CenaSpec["links"] }): [CenaSpec, CenaSpec] {
  const y0 = o.lado === "fundo" ? 1 : 0;
  const yb = y0 + FILEIRA_BANHO;
  const banho = `${o.key}_banho`;
  return [
    {
      key: o.key,
      name: o.prefixo + "Casa",
      description: o.description,
      andar: "Casa",
      style: o.style,
      ...casa,
      floor: [["portal", 8, yb, 6], ...casa.floor],
      links: [...casa.links, [8, yb, banho]],
      plan: { x: 0, y: 0 },
    },
    // o banheiro: a porta na parede da esquerda (a que dá para a sala); o chuveiro e a pia na parede do fundo, o vaso
    // encostado na da esquerda, e o meio livre
    {
      key: banho,
      name: o.prefixo + "Banheiro",
      description: "O banheiro da casa: o box com o chuveiro elétrico, a pia com o espelho e o vaso. Azulejo branco até o teto.",
      layout: planLeft(3, 3, 1),
      andar: "Casa",
      style: "azulejo",
      ...o.clima,
      floor: [["portal", 1, 1, 2], ["sink", 2, 0, 4], ["box_chuveiro", 3, 0, 4], ["toilet", 1, 2, 2], ...lampadas([2, 1])],
      wall: [["mirror", "r", 0, 2.5, 1.6]],
      links: [[1, 1, o.key]],
      plan: { x: 9, y: yb - 1 },
    },
  ];
}

/**
 * A casa de cidade comum (Santa Amália): na parede do fundo, a cozinha (a pia, o fogão a gás, a geladeira) e o quarto
 * (o guarda-roupa e a cama com a cabeceira na parede); na da esquerda, a TV, com o sofá virado para ela.
 */
export function casaDeCidade(o: Casa & { janela: string }): [CenaSpec, CenaSpec] {
  const fundo = o.lado === "fundo";
  const y0 = fundo ? 1 : 0;
  const Y = (y: number) => y + y0;
  return comBanheiro(o, {
    layout: fundo ? planTop(9, 7, 4) : planBottom(9, 7, 4),
    ...o.clima,
    floor: [
      fundo ? ["portal", 4, 1, 4] : ["portal", 4, 6, 0],
      // na parede do fundo, a cozinha e o quarto; só a mesa, o sofá e a mesinha ficam soltos, com caminho livre da
      // porta até a mesa, a cozinha e o banheiro (o Felipe, 17/10: "ninguém põe TV no meio da sala")
      ["pia_cozinha", 0, Y(0), 4],
      ["fogao_gas", 2, Y(0), 4],
      ["geladeira", 3, Y(0), 4],
      ["guarda_roupa", 5, Y(0), 4],
      ["cama_casal", 7, Y(0), 4],
      ...(fundo ? [] : [["plant", 4, Y(0), 0] as FloorSeed]),
      // a mesa da cozinha, com uma fileira livre entre ela e a pia
      ["mesa_cozinha", 1, Y(2), 4],
      ["chair_wood", 0, Y(2), 2],
      ["chair_wood", 4, Y(3), 6],
      ["mug", 1, Y(2), 0],
      ["food_tray", 2, Y(3), 0],
      // a sala: a TV na parede da esquerda, o sofá virado para ela, a mesinha no meio
      ["rack_tv", 0, Y(5), 2],
      ["rug_worn", 1, Y(4), 0],
      ["mesa_centro", 2, Y(5), 0],
      ["sofa_leather", 3, Y(5), 6],
      ...lampadas([2, Y(2)], [5, Y(4)]),
    ],
    wall: [
      [o.janela, "l", 0, Y(3.6), 1.4],
      ["clock", "r", y0, 1.2, 2.6],
      ["quadro_fazenda~03", "r", y0, 6.6, 2.5],
    ],
    links: [[4, fundo ? 1 : 6, "cidade"]],
  });
}

/**
 * A casa mineira de cidade histórica (Tiradentes, Igarapé): por fora a mesma, por dentro a casa de hoje, sem a cara de
 * roça (o Felipe, 17/10: "é cidade histórica, tem diferença"; "manter os símbolos religiosos, é legal"). Na parede do
 * fundo, a cozinha (a pia, o fogão a gás, a geladeira), a cômoda com a vela e o santo e a cama; a mesa da cozinha com
 * as cadeiras e o café; na parede da esquerda, a TV, e o sofá virado para ela. As paredes (o oratório, os quadros, a
 * janela) são de cada cidade.
 */
export function casaMineira(o: Casa & { paredes: (y0: number, Y: (y: number) => number) => WallSeed[] }): [CenaSpec, CenaSpec] {
  const fundo = o.lado === "fundo";
  const y0 = fundo ? 1 : 0;
  const Y = (y: number) => y + y0;
  return comBanheiro(o, {
    layout: fundo ? planTop(9, 7, 4) : planBottom(9, 7, 4),
    ...o.clima,
    floor: [
      fundo ? ["portal", 4, 1, 4] : ["portal", 4, 6, 0],
      // a parede do fundo: a cozinha, a cômoda (a vela e os livros em cima, o oratório na parede) e a cama
      ["pia_cozinha", 0, Y(0), 4],
      ["fogao_gas", 2, Y(0), 4],
      ["geladeira", 3, Y(0), 4],
      ["comoda", 5, Y(0), 4],
      ["candles", 5, Y(0), 0],
      ["books_stack", 6, Y(0), 0],
      ["cama_casal", 7, Y(0), 4],
      // a mesa da cozinha, com uma fileira livre entre ela e a cozinha, as cadeiras e o café em cima
      ["mesa_cozinha", 1, Y(3), 4],
      ["chair_wood", 1, Y(2), 4],
      ["chair_wood", 3, Y(2), 4],
      ["chair_wood", 4, Y(3), 6],
      ["food_tray", 2, Y(3), 0],
      ["mug", 1, Y(4), 0],
      ["mug", 3, Y(4), 0],
      // a sala: a TV na parede da esquerda, o tapete e o sofá virado para ela (longe da porta de fora)
      ["rack_tv", 0, Y(5), 2],
      ["rug_worn", 1, Y(5), 2],
      ["sofa_leather", 5, Y(5), 6],
      ...lampadas([2, Y(1)], [6, Y(4)]),
    ],
    wall: o.paredes(y0, Y),
    links: [[4, fundo ? 1 : 6, "cidade"]],
  });
}
