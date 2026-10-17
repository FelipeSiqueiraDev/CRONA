import { casaDeCidade } from "./casaComum";
import { type Hint } from "@crona/shared";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planTop } from "./seedSede";
import { type CenaSpec } from "./seedFazenda";

/**
 * A receita do prédio de apartamentos (17/10, o Felipe: "fazer esses prédios tal qual é o hotel, com uns números na
 * porta tipo 400, 402, 403; não precisamos fazer todos os andares, só a recepção e um andar"). Serve para qualquer
 * prédio de qualquer lugar: devolve duas cenas, a recepção do térreo e o corredor de um andar, ligadas pela escada.
 *
 * - A recepção (8 x 5 casas): o balcão do porteiro com a cadeira atrás, o banco de espera, a escada para cima e a porta
 *   de fora do lado certo (`porta`: "frente" se o prédio, de fora, está no giro 4; "fundo" se está no giro 0).
 * - O corredor do andar (11 x 3): as portas dos apartamentos na parede do fundo, cada uma com a plaquinha do número do
 *   em cima (`placa_numero~201`), e a escada que desce no fim. O número é o andar seguido de 00, 01, 02...
 * - O apartamento que tem cena (`casas`: número → chave da cena) tem a porta ligada a ela; a cena dele liga de volta ao
 *   corredor (`corredorDe(o)`). Os outros ficam com a porta trancada (o mestre abre com o clique duplo, se quiser).
 *
 * Para fazer outro prédio: chame com outra `chave`, ponha as duas cenas na lista do lugar e a entrada de fora apontando
 * para `o.chave` (a recepção). Respeita a regra dos móveis na parede (moveisNaParede.test.ts).
 */
export interface PredioOpcoes {
  /** o começo do nome das cenas, o do lugar ("Igarapé · ") */
  prefixo: string;
  /** a chave da recepção (a do corredor é `${chave}_andar`) */
  chave: string;
  /** o nome do prédio ("Prédio Amarelo") */
  nome: string;
  /** o andar que tem cena (1 = o primeiro acima do térreo): os apartamentos são 100, 101... ou 200, 201... */
  andar: number;
  /** quantos apartamentos no andar (até 4) */
  apartamentos?: number;
  /** os apartamentos com cena: número → chave da cena */
  casas?: Record<number, string>;
  /** a chave da cena de fora (a rua) */
  fora: string;
  /** o lado da porta de fora: "frente" (prédio no giro 4) ou "fundo" (giro 0) */
  porta: "frente" | "fundo";
  descricaoRecepcao: string;
  descricaoCorredor: string;
  /** o clima de dentro (escuridão, cor do ambiente, partículas) */
  clima: Pick<CenaSpec, "darkness" | "ambient" | "particles">;
  /** a pista do balcão do porteiro */
  pistaBalcao?: Hint;
}

/** A chave da cena do corredor do andar. */
export const corredorDe = (o: Pick<PredioOpcoes, "chave">) => `${o.chave}_andar`;

/** As casas das portas no corredor (na parede do fundo) e da escada. */
const PORTAS_X = [2, 4, 6, 8];
const ESCADA_X = 10;

/** O número do apartamento i do andar (o andar 2: 200, 201, 202...). */
export const numeroDoApartamento = (andar: number, i: number) => andar * 100 + i;

/** Onde fica, no corredor, a porta do apartamento com esse número. */
export function portaDoApartamento(o: Pick<PredioOpcoes, "andar">, numero: number): [number, number] {
  return [PORTAS_X[numero - o.andar * 100], 0];
}

export function predioDeApartamentos(o: PredioOpcoes): CenaSpec[] {
  const fundo = o.porta === "fundo";
  const Y = (y: number) => y + (fundo ? 1 : 0);
  const n = Math.min(4, o.apartamentos ?? 4);
  const andarNome = `${o.nome} · ${o.andar}º andar`;
  const recepcao: CenaSpec = {
    key: o.chave,
    name: o.prefixo + o.nome,
    description: o.descricaoRecepcao,
    layout: fundo ? planTop(8, 5, 3) : planBottom(8, 5, 3),
    andar: o.nome,
    style: "ladrilho",
    ...o.clima,
    floor: [
      fundo ? ["portal", 3, 1, 4] : ["portal", 3, 4, 0],
      // o balcão do porteiro, com a cadeira atrás (entre a parede e o balcão), e o vaso no canto
      ["balcao_recepcao", 0, Y(1), 4, o.pistaBalcao],
      ["chair_office", 1, Y(0), 4],
      ["plant", 0, Y(0), 0],
      // o banco de espera e a escada para os andares, encostados na parede do fundo
      ["bench", 4, Y(0), 4],
      ["stairs_up", 6, Y(0), 4],
      ["plant", 7, Y(0), 0],
      // os escaninhos das cartas, na parede da esquerda
      ["cabinet_file", 0, Y(3), 2],
      ["ceiling_lamp", 3, Y(2), 0],
      ["ceiling_lamp", 5, Y(3), 0],
    ] as FloorSeed[],
    wall: [
      ["clock", "r", fundo ? 1 : 0, 1.5, 2.8],
      ["notice_board", "r", fundo ? 1 : 0, 4.9, 2.0],
    ] as WallSeed[],
    links: [
      [3, fundo ? 1 : 4, o.fora],
      [6, Y(0), corredorDe(o)],
    ],
    plan: { x: 0, y: 0 },
  };
  const floor: FloorSeed[] = [
    ["escada_desce", ESCADA_X, 0, 4],
    ["rug_worn", 3, 1, 2],
    ["plant", 1, 0, 0],
    ["ceiling_lamp", 3, 1, 0],
    ["ceiling_lamp", 7, 1, 0],
  ];
  const wall: WallSeed[] = [["window_barred", "l", 0, 1.0, 1.4]];
  const links: [number, number, string][] = [[ESCADA_X, 0, o.chave]];
  const apartamentos: CenaSpec[] = [];
  for (let i = 0; i < n; i++) {
    const num = numeroDoApartamento(o.andar, i);
    const x = PORTAS_X[i];
    // o apartamento que tem cena própria (o dos Ribeiro) ou o comum, feito pela receita das casas de cidade (17/10, o
    // Felipe: "e cadê os apartamentos?"): a sala com a cozinha, o quarto e o banheirinho
    const cena = o.casas?.[num] ?? `${o.chave}_ap${num}`;
    if (!o.casas?.[num])
      apartamentos.push(
        ...casaDeCidade({
          key: cena,
          prefixo: o.prefixo,
          nome: `Apartamento ${num}`,
          lado: "frente",
          description: DESCRICOES[(num + o.andar) % DESCRICOES.length].replace("{n}", String(num)),
          style: "taco",
          clima: o.clima,
          janela: "janela_vidro",
          fora: corredorDe(o),
        }),
      );
    floor.push(["portal", x, 0, 4]);
    links.push([x, 0, cena]);
    // a plaquinha em cima da porta, no meio (do lado, a moldura da porta cobria um pedaço dela)
    wall.push([`placa_numero~${num}`, "r", 0, x + 0.5, 3.75]);
  }
  const corredor: CenaSpec = {
    key: corredorDe(o),
    name: o.prefixo + andarNome,
    description: o.descricaoCorredor,
    layout: planBottom(11, 3, ESCADA_X),
    andar: andarNome,
    style: "taco",
    ...o.clima,
    floor,
    wall,
    links,
    plan: { x: 0, y: 0 },
  };
  return [recepcao, corredor, ...apartamentos];
}

/** As descrições dos apartamentos comuns ({n}: o número), uma por porta. */
const DESCRICOES = [
  "O apartamento {n}: a sala e a cozinha juntas, a TV ligada baixinho, a mesa com a toalha de plástico, o quarto no fundo e o banheirinho do lado.",
  "O apartamento {n}: a cozinha arrumada, a geladeira com os ímãs e o calendário da farmácia, o sofá de frente para a TV e a cama feita.",
  "O apartamento {n}: o cheiro de café, a louça secando na pia, o rádio em cima da geladeira e a cama de casal com a colcha de crochê.",
  "O apartamento {n}: as cortinas fechadas, a TV desligada, a mesa com as contas empilhadas e o quarto com a porta encostada.",
];
