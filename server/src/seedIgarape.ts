import { getFurni, RoomMap, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";
import { casaMineira } from "./casaComum";
import { corredorDe, predioDeApartamentos } from "./predioApartamentos";

/**
 * Igarapé (15/10), o quinto lugar da campanha "Segredos do Outro Lado": a cidadezinha do interior histórico de Minas
 * cortada por um rio (a referência é a ilha do mapa-múndi, client/public/arte/mapa/lugar-igarape-hd.png). As casas
 * brancas de janelas azuis e telhado de barro em volta do largo da capelinha branca e do ipê amarelo; a estrada de
 * terra que chega pelo leste (por onde a van chega) e desce até a ponte de pedra em arco; do outro lado, a venda da
 * beira do rio; rio abaixo, as palafitas de madeira em cima das estacas na água, com os deques e as canoas.
 *
 * Primeira leva: a cidade de fora inteira e por dentro a Capela, a Casa de Palafita, a Venda, a outra palafita e as
 * casas comuns (sem nome, a casa mineira padrão).
 *
 * Na cidade, o norte é o alto do mapa: o rio desce de cima para baixo um pouco à direita do meio; a capela e o largo
 * ficam a oeste (à esquerda), a estrada da van chega pelo leste.
 */
export const IGARAPE = "Igarapé · ";
export const IGARAPE_REV = 15;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);

/** O clima de dentro: a tarde entrando pelas janelas, a lâmpada amarela. */
const DENTRO = { darkness: 0.36, ambient: "#d8b890", particles: ["dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ a cidade (de fora)

/** O terreno da cidade (em casas). */
const CW = 60;
const CH = 46;
/** a estrada que chega do leste e atravessa a ponte (as fileiras ESTRADA_Y e ESTRADA_Y + 1) */
const ESTRADA_Y = 20;
/**
 * O rio: a borda de cá (oeste) em cada fileira; ele tem RIO_L casas de largura. Desce de cima para baixo e vem para
 * a esquerda; em volta da ponte (fileiras 13 a 27) corre reto, e na altura das palafitas (26 a 35) também, para as
 * estacas caírem dentro da água.
 */
const RIO_L = 4;
const RIO_X: number[] = [
  36, 36, 35, 35, 34, 34, 33, 33, 32, 32, 31, 31, 31, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29,
  28, 28, 27, 27, 26, 26, 25, 25, 24, 24,
];
const naAgua = (x: number, y: number) => y >= 0 && y < CH && x >= RIO_X[y] && x < RIO_X[y] + RIO_L;
/** a ponte: 6 casas ao longo da estrada (a cabeceira de cá, as 4 do rio e a de lá) */
const PONTE_X = RIO_X[ESTRADA_Y] - 1;
/** os deques de tábua (o píer) que entram no rio: [x0, x1, y] */
const DEQUES: [number, number, number][] = [
  [27, 30, 36], // o da Casa de Palafita (margem de cá)
  [31, 34, 27], // o da outra palafita (margem de lá)
];
/** o largo da capela (calçamento de pedra) */
const LARGO: [number, number, number, number] = [11, 12, 25, 18];

function terrenoCidade(): Terreno {
  const t = new Terreno(CW, CH);
  // a estrada de terra: chega do leste, atravessa a ponte e segue até o largo
  t.ret(PONTE_X + 6, ESTRADA_Y, CW - 1, ESTRADA_Y + 1, "t");
  t.ret(8, ESTRADA_Y, PONTE_X - 1, ESTRADA_Y + 1, "t");
  // o largo de pedra na frente da capela, e a rua que desce do largo para as casas do sul
  t.ret(LARGO[0], LARGO[1], LARGO[2], LARGO[3], "p");
  t.ret(15, ESTRADA_Y + 2, 16, CH - 1, "t");
  // o barro da beira do rio, dos dois lados
  for (let y = 0; y < CH; y++) {
    t.put(RIO_X[y] - 1, y, "d");
    t.put(RIO_X[y] + RIO_L, y, "d");
  }
  // o rio (a água é casa vazia na planta: ninguém pisa)
  for (let y = 0; y < CH; y++) for (let x = RIO_X[y]; x < RIO_X[y] + RIO_L; x++) t.put(x, y, "a");
  // a ponte: o chão por baixo dela é pedra (a peça da ponte é pisável e fica por cima)
  for (let y = ESTRADA_Y; y <= ESTRADA_Y + 1; y++) for (let x = PONTE_X; x < PONTE_X + 6; x++) t.put(x, y, "p");
  // os deques entrando no rio
  for (const [x0, x1, y] of DEQUES) t.ret(x0, y, x1, y, "m");
  return t;
}
const T_CIDADE = terrenoCidade();

/** a peça "entrada" na casa logo à frente da porta de um prédio (a porta no meio da frente; giro 4 ou 0) */
function porta(id: string, x: number, y: number, rot: 0 | 4): [number, number] {
  const def = getFurni(id)!;
  const meio = Math.floor(def.width / 2);
  return rot === 4 ? [x + meio, y + def.depth] : [x + def.width - 1 - meio, y - 1];
}

/**
 * Os prédios da cidade: [def, x, y, giro, cena de dentro]. Giro 4 = a porta para a frente da tela (o sul); 0 = para o
 * fundo (o norte). As palafitas têm a coluna da direita da peça (no giro dela) por cima da água: a de cá (giro 4) com
 * o rio a leste, a de lá (giro 0) com o rio a oeste.
 */
const PREDIOS: [string, number, number, 0 | 4, string][] = [
  ["igarape_capela", 14, 3, 4, "capela"],
  // a casa 1 e a 4 têm a chaminé e o fogão a lenha aceso dentro (a fumaça sai quando ele está aceso); as outras, não
  ["igarape_casa~c", 3, 6, 4, "casa1"],
  ["igarape_casa~b", 21, 6, 4, "casa2"],
  ["igarape_casa", 3, 24, 0, "casa3"],
  ["igarape_casa~d", 8, 31, 0, "casa4"],
  ["igarape_venda", 19, 24, 0, "venda"],
  ["igarape_palafita", 25, 30, 4, "palafita"],
  ["igarape_palafita_b", 32, 29, 0, "palafita2"],
  // a casa dos Ribeiro, onde a Cora cresceu (17/10)
  // os prediozinhos de apartamentos (a receita em predioApartamentos.ts): o amarelo, do lado de lá do rio, com o
  // apartamento dos Ribeiro (a casa da Cora) no segundo andar; o verde, na beira da estrada
  ["igarape_predio", 38, 6, 4, "predio_amarelo"],
  ["igarape_predio~b", 50, 24, 0, "predio_verde"],
  ["igarape_casa~b", 49, 8, 4, "casa6"],
  ["igarape_casa", 42, 25, 0, "casa7"],
  // a lanchonete do largo (17/10), de frente para a estrada
  ["lanchonete_predio", 2, 13, 4, "lanchonete"],
];
const ENTRADAS = new Map(PREDIOS.map(([id, x, y, r, cena]) => [cena, porta(id.split("~")[0], x, y, r)]));

/** as casas que um def ocupa (no giro), para não pôr árvore em cima */
function ocupadas(f: FloorSeed[]): Set<string> {
  const s = new Set<string>();
  for (const [id, x, y, r] of f) {
    const def = getFurni(id.split("~")[0]);
    if (!def) continue;
    const [sx, sy] = r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) s.add(`${x + dx},${y + dy}`);
  }
  return s;
}

function cidadePiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [id, x, y, r, cena] of PREDIOS) f.push([id, x, y, r], ["entrada", ...ENTRADAS.get(cena)!, r]);
  f.push([
    "igarape_ponte",
    PONTE_X,
    ESTRADA_Y,
    4,
    hint("A ponte de pedra", "A ponte velha de pedra em arco, do tempo do ouro. Por baixo dela o rio corre escuro e fundo, e no meio do arco alguém riscou uma cruz na pedra."),
  ]);
  // o ipê amarelo do largo, na frente da capela, e outro na beira do rio do lado de lá
  f.push(["igarape_ipe", 22, 14, 0, hint("O ipê amarelo", "Florido, sem uma folha. As flores caídas fazem um tapete amarelo no chão de pedra do largo.")]);
  f.push(["igarape_ipe", 11, 15, 0], ["igarape_ipe", 37, 16, 0]);
  // as canoas puxadas para o barro da margem, perto dos deques e da ponte
  f.push(["igarape_canoa", 26, 36, 4, hint("Canoa", "A canoa de um pau só, amarrada na estaca. O remo ainda está molhado.")]);
  f.push(["igarape_canoa", 35, 23, 4], ["igarape_canoa", 34, 34, 4]);
  // a cerca da horta atrás das casas do sul e os bancos do largo
  for (let x = 3; x <= 9; x++) f.push(["cerca", x, 30, 4]);
  f.push(["bench", 13, 13, 4], ["bench", 18, 17, 0]);
  // a vida da beira do rio: as sacas e o caixote na porta da venda, os barris
  f.push(["sacas", 18, 22, 0], ["crate_wood", 27, 23, 0], ["barrel", 26, 23, 0]);
  // as redes de pesca, os cestos de peixe e os varais com os panos secando, perto das palafitas e dos deques
  f.push(["igarape_rede_pesca", 30, 36, 0, hint("Rede de pesca", "Ainda pinga. No meio da malha, preso, um peixe de olho branco que ninguém daqui sabe dizer qual é.")]);
  f.push(["igarape_cesto", 23, 34, 0], ["igarape_varal", 23, 30, 4], ["igarape_rede_pesca", 35, 28, 2], ["igarape_cesto", 35, 27, 0], ["igarape_varal", 37, 30, 4]);
  f.push(["igarape_rede_pesca", 36, 23, 0], ["barrel", 28, 27, 0]);
  const ocup = ocupadas(f);
  // as árvores e os arbustos na grama que sobrou (a lista pode ser generosa: só entra onde é grama livre)
  const arvores: [number, number][] = [
    [1, 1], [5, 2], [9, 1], [1, 13], [2, 18], [1, 36], [4, 41], [9, 43], [13, 40], [19, 41],
    [12, 2], [26, 2], [29, 9], [27, 16], [40, 2], [46, 3], [56, 2], [58, 10], [55, 16], [44, 16], [50, 30], [57, 32],
    [53, 42], [58, 40], [38, 13], [47, 14], [6, 37],
    [50, 38], [55, 27], [49, 44], [53, 35], [57, 22], [52, 23], [3, 33], [1, 27],
  ];
  arvores.forEach(([x, y], i) => {
    if (T_CIDADE.at(x, y) === "." && !ocup.has(`${x},${y}`)) f.push([i % 2 === 0 ? "arvore" : "arvore~b", x, y, 0]);
  });
  const arbustos: [number, number][] = [
    [11, 4], [20, 4], [2, 11], [10, 11], [27, 12], [36, 13], [45, 13], [56, 14], [2, 22], [13, 29], [19, 30], [37, 22],
    [41, 23], [48, 23], [52, 34], [30, 40], [24, 34], [33, 37],
  ];
  arbustos.forEach(([x, y], i) => {
    if (T_CIDADE.at(x, y) === "." && !ocup.has(`${x},${y}`)) f.push([i % 3 === 0 ? "arbusto" : i % 3 === 1 ? "arbusto~b" : "arbusto~c", x, y, 0]);
  });
  return f;
}

// ------------------------------------------------------------------ as cenas de dentro

/** As paredes da casa de Igarapé: a janela de cortina em cima da pia, o quadro, o relógio e a prateleira do santo. */
const paredesDaCasa = (y0: number, Y: (y: number) => number): WallSeed[] => [
  ["janela_cozinha", "r", y0, 1.0, 1.75],
  ["quadro_fazenda~05", "r", y0, 6.0, 2.54],
  ["clock", "r", y0, 8.0, 2.9],
  // a prateleira com arte (a "wall_shelf" é chapada, desenhada por código, e parecia um quadro, 17/10)
  ["shelf_wall", "l", 0, Y(3), 2.2],
];

const DESCRICAO_LENHA =
  "Uma casa de Igarapé das antigas: o chão de tábua encerado, o fogão a lenha aceso com a chaleira (a fumaça sai pela chaminé), a pia, a mesa com as cadeiras, a TV na sala com o sofá, a cama de casal com a colcha de crochê e o santinho na cômoda. Cheira a café passado e a lenha.";

const DESCRICAO_CASA =
  "Uma casa de Igarapé: o chão de tábua encerado, a cozinha com o fogão a gás e a geladeira, a mesa com as cadeiras, a TV na sala com o sofá, a cama de casal com a colcha de crochê e o santinho na cômoda. Cheira a café passado.";

const CENAS: CenaSpec[] = [
  {
    key: "cidade",
    name: IGARAPE + "Cidade",
    description:
      "Igarapé: a cidadezinha mineira cortada pelo rio. As casas brancas de janelas azuis e telhado de barro em volta do largo de pedra, a capelinha branca com o sino, o ipê amarelo florido na frente dela. A estrada de terra chega pelo leste e desce até a ponte de pedra em arco; do lado de cá do rio, a venda; rio abaixo, as palafitas de madeira em cima das estacas na água, os deques e as canoas amarradas no barro. Quieta demais para uma tarde de sol.",
    layout: { heightmap: T_CIDADE.planta(), door: { x: CW - 1, y: ESTRADA_Y, dir: 6 } },
    andar: "Cidade",
    style: "grama",
    aberto: true,
    terreno: T_CIDADE.texto(),
    darkness: 0.16,
    fog: 0.05,
    ambient: "#f0dcb8",
    particles: ["dust"],
    floor: cidadePiso(),
    wall: [],
    links: [...ENTRADAS].map(([cena, [x, y]]) => [x, y, cena] as [number, number, string]),
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Capela
  // A porta de dentro fica do MESMO lado da de fora (o Felipe, 14/10): a capela tem a porta virada para a frente da
  // tela, então a de dentro fica na parede da frente, a que não aparece (planBottom).
  {
    key: "capela",
    name: IGARAPE + "Capela",
    description:
      "A capelinha por dentro: o chão de pedra, as paredes caiadas, os bancos compridos de madeira escura dos dois lados do corredor, o altar branco com a toalha de renda, o crucifixo e os castiçais, as duas imagens de Nossa Senhora nos cantos e as arandelas de vela. Cheira a cera e a flor murcha.",
    layout: planBottom(9, 12, 4),
    andar: "Capela",
    style: "cascalho",
    ...DENTRO,
    darkness: 0.46,
    ambient: "#e0c08a",
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 4, 11, 0],
      ["igarape_altar", 3, 0, 4, hint("O altar", "A toalha de renda está passada e engomada, mas as velas dos castiçais foram apagadas com os dedos: tem cera nas pontas.")],
      ["candles", 4, 0, 0],
      ["candelabra", 2, 0, 0],
      ["candelabra", 6, 0, 0],
      ["igarape_santa", 0, 0, 4],
      ["igarape_santa", 8, 0, 4, hint("A imagem da santa", "Nossa Senhora de manto azul. Alguém virou o rosto dela para a parede e depois desvirou: a poeira da peanha está mexida.")],
      ["rug_ornate", 3, 5, 0],
      ["candles", 1, 0, 0],
      ["candles", 7, 0, 0],
      ["plant", 0, 10, 0],
      ["plant", 8, 10, 0],
      ...[4, 6, 8].flatMap((y): FloorSeed[] => [
        ["igarape_banco_igreja", 0, y, 0],
        ["igarape_banco_igreja", 6, y, 0],
      ]),
    ],
    wall: [
      ["painting", "r", 0, 4.5, 2.9],
      ["sconce", "r", 0, 1.5, 2.6],
      ["sconce", "r", 0, 7.5, 2.6],
      ["sconce", "l", 0, 5.0, 2.6],
      ["sconce", "l", 0, 9.0, 2.6],
    ],
    links: [[4, 11, "cidade"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Casa de Palafita (porta para a frente: planBottom)
  {
    key: "palafita",
    name: IGARAPE + "Casa de Palafita",
    description:
      "A casa de palafita por dentro: o assoalho de tábua que range e deixa ver o rio pelas frestas, as paredes de tábua, as duas redes armadas, o fogão a gás com a panela de peixe, a geladeira pequena, a mesa redonda com o banco e a vela, os barris e o caixote. Pela janela, a água passa embaixo.",
    layout: planBottom(8, 6, 4),
    andar: "Casa de Palafita",
    style: "pier",
    ...DENTRO,
    darkness: 0.42,
    ambient: "#c8a070",
    particles: ["dust"],
    floor: [
      ["portal", 4, 5, 0],
      // o fogão a gás e a geladeira no lugar do fogão de lenha (17/10, o Felipe: cidade, não roça)
      ["fogao_gas", 0, 0, 4],
      ["geladeira", 1, 0, 4],
      ["prateleira", 2, 0, 4],
      ["igarape_rede", 4, 0, 2],
      ["igarape_rede", 7, 0, 4, hint("A rede", "Ainda está morna, e balança sozinha devagar, como se alguém tivesse acabado de levantar.")],
      ["table_round", 2, 2, 0],
      ["candles", 2, 2, 0],
      ["bench", 2, 4, 0],
      ["chair_wood", 4, 2, 6],
      ["barrel", 0, 4, 0],
      ["crate_wood", 0, 5, 0],
      // em cima da mesa: a caneca e a bandeja; nos cantos, a rede de pesca e o cesto de peixe
      ["mug", 3, 2, 4],
      ["food_tray", 3, 3, 0],
      ["igarape_rede_pesca", 7, 4, 0],
      ["igarape_cesto", 6, 4, 0],
    ],
    wall: [
      ["janela_cozinha", "r", 0, 5.5, 1.75],
      ["utensilios_parede", "l", 0, 1.5, 2.4],
    ],
    links: [[4, 5, "cidade"]],
    plan: { x: 0, y: 0 },
    chao: [[6, 3, "Lanterna de Pilha", 1, "misc"]],
  },
  // ------------------------------------------------------------ a outra palafita, sem nome (porta para o fundo: planTop)
  {
    key: "palafita2",
    name: IGARAPE + "Palafita",
    description: "Uma palafita da beira do rio: o assoalho de tábua, a rede, o fogão a gás com o botijão, a mesinha e o caixote. Simples e arrumada.",
    layout: planTop(7, 5, 3),
    andar: "Palafita",
    style: "pier",
    ...DENTRO,
    darkness: 0.42,
    ambient: "#c8a070",
    floor: [
      ["portal", 3, 1, 4],
      ["fogao_gas", 0, 1, 4],
      ["igarape_rede", 6, 1, 4],
      ["table_small", 2, 3, 4],
      ["chair_wood", 2, 4, 0],
      ["crate_wood", 0, 5, 0],
      ["barrel", 0, 4, 0],
      ["mug", 2, 3, 4],
      ["igarape_rede_pesca", 5, 5, 0],
      ["igarape_cesto", 6, 5, 0],
    ],
    wall: [["utensilios_parede", "l", 0, 2.5, 2.4]],
    links: [[3, 1, "cidade"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Venda (porta para o fundo: planTop)
  {
    key: "venda",
    name: IGARAPE + "Venda",
    description:
      "A venda da beira do rio: o ladrilho preto e branco gasto, o balcão de madeira com a balança, as prateleiras de mantimento (fubá, rapadura, cachaça, querosene), as sacas de feijão e o caixote de frutas, a mesinha do canto onde se toma a pinga. O dono não está; a porta estava aberta.",
    layout: planTop(11, 8, 5),
    andar: "Venda",
    style: "xadrez",
    ...DENTRO,
    darkness: 0.34,
    floor: [
      ["portal", 5, 1, 4],
      ["prateleira", 7, 1, 4],
      ["prateleira", 9, 1, 4],
      ["prateleira", 0, 2, 2],
      ["prateleira", 0, 5, 2],
      ["counter_wood", 2, 3, 2, hint("O balcão", "A caderneta do fiado aberta em cima do balcão. A última anotação foi feita ontem, e a letra vai ficando torta até virar um risco.")],
      ["counter_wood", 2, 5, 2],
      ["stool", 3, 3, 6],
      ["stool", 3, 6, 6],
      ["table_bar", 6, 5, 4],
      ["chair_bar", 6, 6, 0],
      ["chair_bar", 7, 5, 6],
      ...de("sacas", [9, 6], [10, 6], [10, 5]),
      ...de("crate_wood", [9, 8], [10, 8]),
      ["beer_crate", 8, 8, 0],
      ["barrel", 10, 3, 0],
      ["rug_worn", 4, 2, 0],
      ["ceiling_lamp", 5, 4, 0],
      ["ceiling_lamp", 8, 4, 0],
      // em cima do balcão: a caderneta e o copo; na mesinha, o copo da pinga
      ["papers", 2, 3, 0],
      ["beer_glass", 2, 6, 0],
      ["beer_glass", 6, 5, 0],
      ["food_tray", 2, 4, 0],
    ],
    wall: [
      ["painting", "r", 1, 3.0, 2.6],
      ["shelf_wall", "l", 0, 8.0, 2.2],
      ["clock", "l", 0, 4.5, 3.0],
    ],
    links: [[5, 1, "cidade"]],
    plan: { x: 0, y: 0 },
    chao: [[4, 7, "Garrafa de Cachaça", 1, "misc"]],
  },
  // ------------------------------------------------------------ as casas comuns (sem nome: a casa mineira padrão)
  ...casaMineira({ key: "casa1", prefixo: IGARAPE, lado: "frente", description: DESCRICAO_LENHA, style: "taco", clima: DENTRO, paredes: paredesDaCasa, lenha: true }),
  ...casaMineira({ key: "casa2", prefixo: IGARAPE, lado: "frente", description: DESCRICAO_CASA, style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa3", prefixo: IGARAPE, lado: "fundo", description: DESCRICAO_CASA, style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa4", prefixo: IGARAPE, lado: "fundo", description: DESCRICAO_LENHA, style: "taco", clima: DENTRO, paredes: paredesDaCasa, lenha: true }),
  ...casaMineira({ key: "casa6", prefixo: IGARAPE, lado: "frente", description: DESCRICAO_CASA, style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa7", prefixo: IGARAPE, lado: "fundo", description: DESCRICAO_CASA, style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  // ------------------------------------------------------------ a lanchonete do largo (17/10)
  {
    key: "lanchonete",
    name: IGARAPE + "Big Dog Hot Dogs - Lanches e Açaí",
    description:
      "A Big Dog Hot Dogs - Lanches e Açaí, a lanchonete do largo: o piso de cerâmica, o balcão de inox com a chapa e a estufa de salgados, o freezer do açaí com as coberturas, as mesas e as cadeiras de plástico vermelho, a geladeira de refrigerante, o cardápio na parede e a TV no canto passando novela. Cheiro de salsicha, de cebola na chapa e de leite condensado.",
    layout: planBottom(9, 7, 4),
    andar: "Lanchonete",
    style: "ladrilho",
    ...DENTRO,
    darkness: 0.28,
    ambient: "#f0dcc0",
    floor: [
      ["portal", 4, 6, 0],
      // o fundo: a chapa, o freezer do açaí e a geladeira de refrigerante
      ["chapa_lanche", 0, 0, 4],
      ["freezer_acai", 3, 0, 4],
      ["fridge_drinks", 6, 0, 4],
      ["trash_can", 8, 0, 0],
      // o balcão e as banquetas
      ["counter_wood", 1, 2, 4],
      ["counter_wood", 3, 2, 4],
      ["stool_bar", 1, 3, 0],
      ["stool_bar", 2, 3, 0],
      ["stool_bar", 4, 3, 0],
      ["cafeteira", 1, 2, 0],
      ["beer_glass", 3, 2, 0],
      // as mesas de plástico
      ["table_bar", 6, 3, 0],
      ["chair_bar", 6, 2, 4],
      ["chair_bar", 7, 3, 6],
      ["table_bar", 6, 5, 0],
      ["chair_bar", 5, 5, 2],
      ["chair_bar", 7, 5, 6],
      ["food_tray", 6, 3, 0],
      ["plant", 0, 5, 0],
      ["ceiling_lamp", 2, 4, 0],
      ["ceiling_lamp", 6, 4, 0],
    ],
    wall: [
      ["notice_board", "r", 0, 2.2, 2.0],
      ["tv_wall", "l", 0, 3.0, 2.7],
      ["clock", "r", 0, 7.0, 2.9],
    ],
    links: [[4, 6, "cidade"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a casa dos Ribeiro, onde a Cora cresceu (17/10)
  {
    key: "casa_ribeiro",
    name: IGARAPE + "Casa dos Ribeiro",
    description:
      "O apartamento onde a Cora cresceu, no segundo andar do prediozinho amarelo, fechado desde que a Sara sumiu: o chão de tábua coberto de poeira, os móveis no mesmo lugar de sempre, a mesa da cozinha com as cadeiras de palhinha, a cama de casal com a colcha de crochê, a cômoda, o guarda-roupa. As teias nos cantos do teto e o cheiro de casa fechada. Na parede, o lugar mais claro onde ficava o retrato da família.",
    layout: planBottom(9, 7, 4),
    andar: "Casa dos Ribeiro",
    style: "taco",
    ...DENTRO,
    darkness: 0.5,
    ambient: "#c8b498",
    particles: ["dust"],
    floor: [
      ["portal", 4, 6, 0],
      // apartamento: a pia, o armário e o fogão a gás
      ["pia_cozinha", 0, 0, 4],
      ["armario_cozinha", 2, 0, 4],
      ["fogao_gas", 4, 0, 4],
      ["comoda", 5, 0, 4, oculta("As cartas", "Na gaveta de baixo da cômoda, embaixo das toalhas, as três cartas do Geraldo para a Sara, sem data: uma amarga, outra pedindo perdão e que ela cuide da Cora, a última falando do Exército e de um tal Fritz, no café de sempre.")],
      ["cama_casal", 7, 0, 4],
      ["mesa_cozinha", 1, 2, 4],
      ["chair_wood", 1, 1, 4],
      ["chair_wood", 3, 1, 4],
      ["chair_wood", 2, 4, 0],
      ["guarda_roupa", 0, 5, 2],
      ["rug_worn", 5, 3, 0],
      ["papers", 2, 2, 0, hint("O retrato rasgado", "O retrato da família em pedaços, juntados em cima da mesa: o Geraldo, a Sara e a Cora menina, na frente desta casa.")],
      ["dirt", 6, 5, 0],
      ["dirt", 3, 4, 0],
      ["ceiling_lamp", 4, 3, 0],
    ],
    wall: [
      ["janela_cozinha", "r", 0, 1.0, 1.75],
      ["teia", "r", 0, 7.6, 3.0],
      ["teia", "l", 0, 5.2, 3.0],
      ["clock", "l", 0, 2.4, 2.9],
    ],
    links: [[4, 6, corredorDe({ chave: "predio_amarelo" })]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ os prediozinhos de apartamentos
  ...predioDeApartamentos({
    prefixo: IGARAPE,
    chave: "predio_amarelo",
    nome: "Prédio Amarelo",
    andar: 2,
    casas: { 202: "casa_ribeiro" },
    fora: "cidade",
    porta: "frente",
    descricaoRecepcao:
      "A portaria do prediozinho amarelo: o chão de ladrilho gasto, o balcão do porteiro com o caderno de visitas, o banco de madeira, os escaninhos das cartas e a escada para os apartamentos. Cheira a cera e a umidade do rio.",
    descricaoCorredor:
      "O corredor do segundo andar: o tapete puído, as quatro portas com as plaquinhas de esmalte azul (200, 201, 202, 203) e a janela com grade para o rio. A porta do 202, a dos Ribeiro, tem poeira acumulada na soleira.",
    clima: DENTRO,
    pistaBalcao: hint("O caderno do porteiro", "As visitas anotadas com a letra do seu Zé. Do 202, a última anotação é antiga: \"Sara Ribeiro — saiu cedo, não voltou\". Depois disso, ninguém subiu para lá."),
  }),
  ...predioDeApartamentos({
    prefixo: IGARAPE,
    chave: "predio_verde",
    nome: "Prédio Verde",
    andar: 1,
    fora: "cidade",
    porta: "fundo",
    descricaoRecepcao:
      "A portaria do prediozinho verde da beira da estrada: o balcão vazio, o banco, os escaninhos com as cartas acumuladas e a escada. A porta de baixo vive encostada.",
    descricaoCorredor:
      "O corredor do primeiro andar: o tapete, as portas dos apartamentos 100 a 103 e a janela com grade para a estrada. Atrás de uma delas, um rádio ligado baixinho.",
    clima: DENTRO,
  }),
];

// ------------------------------------------------------------------ montagem

function ligar(built: Map<string, RoomData>) {
  for (const spec of CENAS) {
    const room = built.get(spec.key)!;
    for (const [x, y, to] of spec.links) {
      const target = built.get(to);
      const it = room.items.find((i) => i.x === x && i.y === y && getFurni(i.defId)?.portal);
      if (!it || !target) {
        console.warn(`[seed] ${room.name}: sem passagem em ${x},${y}`);
        continue;
      }
      it.link = target.id;
    }
  }
}

/** Monta Igarapé inteiro e a campanha dele (o lugar "Igarapé" do mapa-múndi). */
export function seedIgarape(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(IGARAPE))) return;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    const room = montar(db, spec);
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  db.rooms.push(...built.values());
  const primeira = built.get(CENAS[0].key)!;
  db.campaigns ??= {};
  db.campaigns[String(primeira.id)] = {
    title: "Igarapé",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.igarapeRev = IGARAPE_REV;
}

/** Refaz Igarapé no lugar quando a montagem muda (IGARAPE_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildIgarape(db: Database): boolean {
  if ((db.igarapeRev ?? 0) >= IGARAPE_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(IGARAPE));
  if (!existing.length) return false;
  const key = Math.min(...existing.map((r) => r.id));
  const built = new Map<string, RoomData>();
  // várias cenas com o mesmo nome (as casas comuns): cada uma refaz a sua, na ordem em que foram criadas
  const usadas = new Set<number>();
  for (const spec of CENAS) {
    let room = existing.find((r) => r.name === spec.name && !usadas.has(r.id));
    if (room) usadas.add(room.id);
    const fresh = montar(db, spec);
    if (room) {
      db.nextRoomId--;
      Object.assign(room, { name: fresh.name, description: fresh.description, heightmap: fresh.heightmap, door: fresh.door, items: fresh.items, wallItems: fresh.wallItems });
    } else {
      room = fresh;
      db.rooms.push(room);
    }
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  const ficam = new Set([...built.values()].map((r) => r.id));
  const cidade = built.get("cidade")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (cidade.tokens ??= []).push({ ...t, x: cidade.door.x, y: cidade.door.y });
    db.rooms.splice(db.rooms.indexOf(velha), 1);
  }
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    for (const t of room.tokens ?? []) {
      if (map.walkState(t.x, t.y) === "walk") continue;
      t.x = room.door.x;
      t.y = room.door.y;
    }
  }
  const camp = db.campaigns?.[String(key)];
  if (camp) {
    for (const id of Object.keys(camp.layout)) if (!ficam.has(Number(id))) delete camp.layout[Number(id)];
    for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  }
  db.igarapeRev = IGARAPE_REV;
  return true;
}

/** Monta Igarapé se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarIgarape(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(IGARAPE))) {
    seedIgarape(db);
    return true;
  }
  return rebuildIgarape(db);
}

/** Para o teste: o rio e a ponte (onde é água e onde a ponte passa). */
export const IGARAPE_RIO = { naAgua, ponte: { x: PONTE_X, y: ESTRADA_Y, w: 6, h: 2 }, largura: CW, altura: CH } as const;
