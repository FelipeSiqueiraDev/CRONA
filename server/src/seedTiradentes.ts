import { getFurni, RoomMap, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planRight, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";
import { casaMineira } from "./casaComum";

/**
 * Tiradentes (15/10), a cidadezinha histórica de Minas Gerais da campanha "Segredos do Outro Lado": o casario
 * colonial caiado de janelas e portas coloridas e telhado de barro, as ruas de pedra, o largo com o chafariz, o coreto
 * e os postes de ferro, e a igreja barroca no alto. A referência é a ilha do mapa-múndi
 * (arte/mapa/lugar-tiradentes-hd.png) e as duas chegadas (arte/viagem/ilustracoes/chegada-tiradentes-1.png e -2.png).
 * A arte do tabuleiro é pixel por código (scripts/3d/estilo/pecas_px/tiradentes.py).
 *
 * A cidade de fora vem primeiro (vira a chave da campanha e a entrada do lugar). Na cidade, o norte é o alto do mapa:
 * a Igreja Matriz no alto (o fundo do tabuleiro), virada para o largo; a Rua Direita corta a cidade de leste a oeste
 * embaixo do largo, e a van chega pela estrada de terra do leste. Na Rua Direita, do lado do largo, a Venda, o Boteco
 * e a Pousada (as fachadas viradas para a tela); do outro lado, o casario. Os lugares importantes têm nome; as casas,
 * não (`semNome`, a casa padrão mineira por dentro).
 *
 * A porta de dentro fica do MESMO lado da de fora (o Felipe, 14/10): o prédio com a porta virada para a frente da tela
 * (giro 4) tem a de dentro na parede da frente (planBottom); virado para o fundo (giro 0), na do fundo (planTop).
 */
export const TIRADENTES = "Tiradentes · ";
export const TIRADENTES_REV = 7;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);
/** as lâmpadas do teto (acesas) */
const lampadas = (...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => ["ceiling_lamp", x, y, 0] as FloorSeed);

const CIDADE = "Cidade";
const IGREJA = "Igreja Matriz";
const POUSADA = "Pousada";
const POUSADA2 = "Pousada 2º";

/** O clima de dentro: a luz morna das lâmpadas e das velas. */
const DENTRO = { darkness: 0.36, ambient: "#d8b080", particles: ["dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ a cidade (de fora)

/** O terreno da cidade (em casas). */
const VW = 56;
const VH = 44;
/**
 * a Rua Direita (de leste a oeste: as 3 casas da rua e as 3 da calçada larga do lado do casario, para a rua não sumir
 * atrás das casas na vista do tabuleiro) e a Rua de Cima (2 casas, na frente da igreja)
 */
const RUA_Y = 23;
const CALCADA_Y = RUA_Y + 5;
const CIMA_Y = 11;
/** as duas ruas laterais (de norte a sul, 2 casas) */
const OESTE_X = 16;
const LESTE_X = 38;
/** o largo, entre as ruas: [x0, y0, x1, y1] e os quatro canteiros de grama nos cantos */
const LARGO = [18, 13, 37, 22] as const;
const CANTEIROS: [number, number][] = [[18, 13], [34, 13], [18, 19], [34, 19]];
/** a estrada de terra por onde a van chega (o leste da Rua Direita) */
const ESTRADA_X = 50;

function terrenoCidade(): Terreno {
  const t = new Terreno(VW, VH);
  // as ruas de pedra (o pé-de-moleque: o cascalho de pedra do jogo)
  t.ret(0, RUA_Y, VW - 1, CALCADA_Y, "p");
  t.ret(ESTRADA_X, RUA_Y, VW - 1, RUA_Y + 2, "t");
  t.ret(6, CIMA_Y, 49, CIMA_Y + 1, "p");
  t.ret(OESTE_X, CIMA_Y, OESTE_X + 1, VH - 1, "p");
  t.ret(LESTE_X, CIMA_Y, LESTE_X + 1, VH - 1, "p");
  // o largo: o lajeado por cima da pedra, e os canteiros de grama
  t.ret(LARGO[0], LARGO[1], LARGO[2], LARGO[3], "p");
  for (const [x, y] of CANTEIROS) t.ret(x, y, x + 3, y + 3, ".");
  // a estradinha de terra para os quintais do sul
  t.linha([[27, CALCADA_Y + 1], [27, VH]], "d", 1);
  return t;
}
const T_CIDADE = terrenoCidade();

/** a peça "entrada" na casa logo à frente da porta de um prédio (a porta no meio da frente; giro 4 ou 0) */
function porta(id: string, x: number, y: number, rot: 0 | 4): [number, number] {
  const def = getFurni(id.split("~")[0])!;
  const meio = Math.floor(def.width / 2);
  return rot === 4 ? [x + meio, y + def.depth] : [x + def.width - 1 - meio, y - 1];
}

/** Os prédios da cidade: [def (com o modelo), x, y, giro, cena de dentro]. */
const PREDIOS: [string, number, number, 0 | 4, string][] = [
  ["igreja_barroca", 21, 1, 4, "igreja"],
  // do lado do largo, de frente para a Rua Direita (e para a tela)
  ["venda_predio", 0, 18, 4, "venda"],
  ["casa_colonial", 9, 18, 4, "casa1"],
  ["boteco_predio", 40, 18, 4, "boteco"],
  ["pousada_predio", 47, 17, 4, "pousada"],
  // as duas casas do lado da igreja, na Rua de Cima
  ["casa_colonial~d", 8, 6, 4, "casa2"],
  ["casa_colonial~b", 40, 6, 4, "casa3"],
  // o casario do outro lado da Rua Direita (as portas para a rua, de costas para a tela)
  ["casa_colonial~b", 1, 29, 0, "casa4"],
  ["casa_colonial~c", 9, 29, 0, "casa5"],
  ["casa_colonial~d", 19, 29, 0, "casa6"],
  ["casa_colonial", 29, 29, 0, "casa7"],
  ["casa_colonial~c", 41, 29, 0, "casa8"],
  ["casa_colonial~b", 48, 29, 0, "casa9"],
];
const ENTRADAS = new Map(PREDIOS.map(([id, x, y, r, cena]) => [cena, porta(id, x, y, r)]));

/** árvores e arbustos só onde é grama e não tem nada (a lista pode ser generosa) */
function naGrama(ocupado: Set<string>, list: FloorSeed[]): FloorSeed[] {
  return list.filter(([, x, y]) => T_CIDADE.at(x, y) === "." && !ocupado.has(`${x},${y}`));
}

function ocupar(ocupado: Set<string>, f: FloorSeed[]) {
  for (const [id, x, y, r] of f) {
    const def = getFurni(id.split("~")[0]);
    if (!def || def.flat) continue;
    const [sx, sy] = r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) ocupado.add(`${x + dx},${y + dy}`);
  }
}

function cidadePiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [id, x, y, r, cena] of PREDIOS) f.push([id, x, y, r], ["entrada", ...ENTRADAS.get(cena)!, r]);
  // o largo: o chafariz, o coreto, os bancos virados para o chafariz, os vasos e o cruzeiro na frente da igreja
  f.push(["chafariz", 23, 16, 0, hint("Chafariz", "O chafariz de pedra do largo, com as quatro bicas de bronze. A água é fria e corre o dia inteiro; dizem que nunca secou, nem na seca de 1890.")]);
  f.push(["coreto", 30, 15, 4, hint("Coreto", "O coreto de ferro do largo, onde a banda toca nas festas. No piso de tábua, alguém riscou um símbolo que não é de nenhuma igreja.")]);
  f.push(["banco_praca", 23, 14, 4], ["banco_praca", 23, 20, 0], ["banco_praca", 27, 21, 0], ["banco_praca", 20, 17, 2]);
  f.push(...de("vaso_flores", [22, 14], [25, 14], [22, 20], [25, 20], [29, 21], [35, 18]));
  f.push(["cruzeiro", 27, 13, 0, hint("Cruzeiro", "A cruz de madeira escura no adro, na base de pedra. Tem velas derretidas no pé e fitas amarradas.")]);
  // os postes de ferro: nas quinas do largo, na Rua Direita e na Rua de Cima
  f.push(...de("poste_ferro", [22, 13], [33, 13], [22, 22], [33, 22], [8, 28], [26, 28], [36, 28], [46, 28], [17, 21], [39, 22], [19, 12], [36, 12]));
  // a calçada da Venda e do Boteco: o banco, o caixote e o barril
    // os quintais do sul: as hortas e o varal de mandioca
  for (const [x0, y0] of [[2, 36], [10, 36], [42, 36]] as [number, number][])
    for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + 4; x++) f.push([x % 2 ? "horta~b" : "horta", x, y, 4]);
  const ocupado = new Set<string>();
  ocupar(ocupado, f);
  // as árvores: nos canteiros do largo, nos quintais, em volta da igreja e espalhadas pela grama que sobrou
  const arvores: [number, number][] = [
    [19, 14], [36, 14], [19, 21], [20, 13],
    [3, 2], [6, 9], [1, 12], [17, 3], [19, 8], [35, 3], [37, 9], [48, 2], [52, 8], [54, 13],
    [3, 14], [12, 14], [44, 14], [50, 12], [1, 41], [7, 40], [14, 42], [21, 39], [33, 41], [37, 38], [46, 41], [53, 39],
    [24, 40], [30, 43], [9, 43], [50, 43], [26, 4], [44, 2], [10, 1],
  ];
  arvores.forEach(([x, y], i) => {
    const novo = naGrama(ocupado, [[i % 3 === 0 ? "arvore" : i % 3 === 1 ? "arvore~b" : "arvore~c", x, y, 0]]);
    f.push(...novo);
    ocupar(ocupado, novo);
  });
  const arbustos: [number, number][] = [[18, 16], [37, 16], [21, 19], [34, 22], [36, 21], [35, 19], [5, 16], [13, 15], [43, 16], [53, 15], [6, 35], [24, 36], [35, 35], [51, 36], [18, 9], [37, 7]];
  arbustos.forEach(([x, y], i) => {
    const novo = naGrama(ocupado, [[["arbusto", "arbusto~b", "arbusto~c"][i % 3], x, y, 0]]);
    f.push(...novo);
    ocupar(ocupado, novo);
  });
  // por último, o lajeado do largo e do adro (decalque: fica por baixo de tudo o que já está nele)
  for (let y = LARGO[1]; y <= LARGO[3]; y += 2)
    for (let x = LARGO[0]; x <= LARGO[2]; x += 2) if (!CANTEIROS.some(([cx, cy]) => x >= cx && x < cx + 4 && y >= cy && y < cy + 4)) f.push(["lajeado", x, y, 0]);
  for (let x = 20; x <= 34; x += 2) f.push(["lajeado", x, CIMA_Y, 0]);
  return f;
}

// ------------------------------------------------------------------ as cenas

/** As paredes da casa de Tiradentes: o oratório em cima da cômoda, o retrato da família, a janela de cortina e o crucifixo. */
const paredesDaCasa = (y0: number, Y: (y: number) => number): WallSeed[] => [
  ["oratorio", "r", y0, 6.0, 2.1],
  ["painting", "r", y0, 7.6, 2.6],
  ["janela_cozinha", "l", 0, Y(3.6), 1.6],
  ["painting", "l", 0, Y(5.9), 2.5],
];

const CENAS: CenaSpec[] = [
  {
    key: "cidade",
    name: TIRADENTES + CIDADE,
    description:
      "Tiradentes: a cidadezinha histórica no pé da serra, o casario colonial caiado de branco (e uns amarelos e rosados) com as janelas e as portas pintadas de azul, verde e amarelo e o telhado de telha de barro. As ruas são de pedra; a Rua Direita corta a cidade e a van chega pela estrada de terra do leste. No meio, o largo de lajes com o chafariz de pedra, o coreto, os bancos e os postes de ferro; no alto, a Igreja Matriz barroca, branca, com as duas torres sineiras e o cruzeiro no adro. Na Rua Direita, a Venda, o Boteco e a Pousada.",
    layout: { heightmap: T_CIDADE.planta(), door: { x: VW - 1, y: RUA_Y + 1, dir: 6 } },
    andar: CIDADE,
    style: "grama",
    aberto: true,
    terreno: T_CIDADE.texto(),
    darkness: 0.14,
    fog: 0,
    ambient: "#ffe2b8",
    particles: ["dust"],
    floor: cidadePiso(),
    wall: [],
    links: [...ENTRADAS].map(([cena, [x, y]]) => [x, y, cena] as [number, number, string]),
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Igreja Matriz e a sacristia
  {
    key: "igreja",
    name: TIRADENTES + "Igreja Matriz",
    description:
      "A nave da Igreja Matriz: o assoalho de tábua, as paredes caiadas, os bancos compridos de madeira escura em duas fileiras, o tapete vermelho no corredor e, no fundo, o altar-mor barroco todo em talha dourada, com a santa de manto azul no nicho. As velas e os candelabros ficam acesos o dia inteiro. À esquerda do altar, a porta da sacristia.",
    layout: planBottom(12, 14, 6),
    andar: IGREJA,
    style: "taco",
    ...DENTRO,
    darkness: 0.44,
    ambient: "#e0b070",
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 6, 13, 0],
      ["portal", 0, 2, 2],
      ["altar_barroco", 4, 0, 4, hint("Altar-mor", "A talha dourada sobe até o teto. A santa do nicho tem os olhos de vidro; de perto, eles parecem seguir quem chega.")],
      ["candelabra", 3, 0, 0],
      ["candelabra", 8, 0, 0],
      ["candles", 2, 1, 0],
      ["candles", 9, 1, 0],
      // o tapete do corredor e os bancos (virados para o altar)
      ["rug_worn", 5, 6, 0],
      ...[4, 6, 8, 10].flatMap((y): FloorSeed[] => [["banco_igreja", 2, y, 0], ["banco_igreja", 7, y, 0]]),
      ["books_stack", 10, 12, 0, hint("Missais", "Os livrinhos de missa, gastos nas pontas. Num deles, alguém sublinhou a lápis a mesma frase em todas as páginas.")],
      ["plant", 11, 12, 0],
      ["plant", 1, 12, 0],
    ],
    wall: [
      ["painting", "r", 0, 1.6, 2.6],
      ["painting", "r", 0, 10.4, 2.6],
      ["sconce", "l", 0, 5.0, 2.9],
      ["painting", "l", 0, 7.5, 2.6],
      ["sconce", "l", 0, 10.0, 2.9],
      ["painting", "l", 0, 12.4, 2.6],
    ],
    links: [
      [6, 13, "cidade"],
      [0, 2, "sacristia"],
    ],
    plan: { x: 6, y: 0 },
  },
  {
    key: "sacristia",
    name: TIRADENTES + "Sacristia",
    description:
      "A sacristia, atrás da porta ao lado do altar: o armário das vestes, a escrivaninha do padre com o livro de tombo e a vela, a estante dos livros velhos da paróquia, o oratório na parede e o crucifixo.",
    // a porta para a nave fica do lado dela (à direita da sacristia)
    layout: planRight(6, 5, 2),
    andar: IGREJA,
    style: "madeira",
    ...DENTRO,
    darkness: 0.5,
    floor: [
      ["portal", 5, 2, 6],
      ["guarda_roupa", 0, 0, 4],
      ["bookshelf", 0, 3, 2],
      ["desk_wood", 2, 2, 4],
      ["chair_wood", 2, 3, 0],
      ["books_stack", 3, 2, 0, oculta("Livro de tombo", "O registro da paróquia desde 1700 e pouco. Nas páginas de 1792, os nomes de três batizados foram raspados com faca; na margem, o mesmo desenho de um olho, à tinta.")],
      ["candles", 2, 2, 0],
      ["crate_wood", 5, 0, 0],
      ["rug_worn", 3, 0, 0],
      ...lampadas([3, 4]),
    ],
    wall: [
      ["oratorio", "r", 0, 3.3, 2.1],
      ["painting", "l", 0, 2.1, 2.5],
    ],
    links: [[5, 2, "igreja"]],
    plan: { x: 0, y: 1 },
  },
  // ------------------------------------------------------------ a Pousada (a recepção, a sala do café e o quarto)
  {
    key: "pousada",
    name: TIRADENTES + "Pousada",
    description:
      "A recepção da pousada: o assoalho encerado, o balcão de madeira com o livro de hóspedes e as chaves penduradas atrás, as poltronas e a mesa redonda com o vaso, o relógio na parede. A escada sobe para o corredor dos quatro quartos (dois bons, um simples e o dos fundos, o mais barato); a porta da esquerda dá na sala do café.",
    layout: planBottom(10, 7, 5),
    andar: POUSADA,
    style: "taco",
    ...DENTRO,
    floor: [
      ["portal", 5, 6, 0],
      ["portal", 0, 3, 2],
      ["stairs_up", 1, 0, 4],
      ["counter_wood", 6, 2, 4],
      ["counter_wood", 8, 2, 4],
      ["chair_wood", 7, 1, 4],
      ["books_stack", 6, 2, 0, hint("Livro de hóspedes", "As assinaturas dos últimos meses. A do quarto 3 é sempre a mesma letra, com nomes diferentes.")],
      ["papers", 7, 2, 0],
      ["mug", 9, 2, 0],
      ["table_round", 3, 3, 0],
      ["vaso_flores", 3, 3, 0],
      ["armchair", 2, 4, 2],
      ["armchair", 5, 3, 6],
      ["rug_ornate", 2, 2, 0],
      ["sideboard", 9, 4, 6],
      ["candles", 9, 4, 0],
      ["plant", 9, 0, 0],
      ...lampadas([3, 1], [7, 4]),
    ],
    wall: [
      ["wall_shelf", "r", 0, 7.4, 2.5],
      ["janela_cozinha", "r", 0, 4.0, 1.6],
      ["clock", "l", 0, 1.4, 3.4],
      ["painting", "l", 0, 5.4, 2.6],
    ],
    links: [
      [5, 6, "cidade"],
      [0, 3, "cafe"],
      [1, 0, "corredor"],
    ],
    plan: { x: 8, y: 0 },
  },
  {
    key: "cafe",
    name: TIRADENTES + "Sala do Café",
    description:
      "A sala do café da pousada: o fogão a gás com o bule em cima, a geladeira, o louceiro, a mesa comprida posta com o café, o pão de queijo e o bolo de fubá, as cadeiras, o aparador com as flores, a janela de cortina para o quintal.",
    // a porta para a recepção fica do lado dela (à direita da sala)
    layout: planRight(8, 6, 3),
    andar: POUSADA,
    style: "taco",
    ...DENTRO,
    floor: [
      ["portal", 7, 3, 6],
      // o fogão a gás e a geladeira no lugar do fogão a lenha (17/10, o Felipe: cidade histórica, não roça)
      ["fogao_gas", 2, 0, 4],
      ["geladeira", 3, 0, 4],
      ["armario_cozinha", 5, 0, 4],
      ["mesa_jantar", 2, 2, 4],
      ["chair_wood", 2, 1, 4],
      ["chair_wood", 5, 1, 4],
      ["chair_wood", 3, 4, 0],
      ["chair_wood", 5, 4, 0],
      ["chair_wood", 1, 2, 2],
      ["food_tray", 3, 2, 0],
      ["food_tray", 4, 3, 0],
      ["mug", 2, 3, 0],
      ["mug", 5, 2, 0],
      ["candles", 5, 3, 0],
      ["sideboard", 0, 4, 2],
      ["vaso_flores", 0, 4, 0],
      ["barrel", 7, 0, 0],
      ...lampadas([3, 5]),
    ],
    wall: [
      ["janela_cozinha", "r", 0, 1.0, 1.6],
      ["clock", "l", 0, 1.5, 3.4],
      ["painting", "l", 0, 3.0, 2.5],
    ],
    links: [[7, 3, "pousada"]],
    plan: { x: 0, y: 0 },
  },
  // o andar de cima (16/10, o Felipe: "pelo menos 4 quartos em todo hotel ou pousada"; os agentes pagam mais pelo
  // quarto deles): o corredor com a escada no meio e dois quartos de cada lado. Cada quarto tem a condição do descanso
  // do interlúdio (LR p. 92): dois bons (confortável), um simples (normal) e o dos fundos (precária)
  {
    key: "corredor",
    name: TIRADENTES + "Corredor da Pousada",
    description:
      "O corredor do andar de cima: o assoalho que range, a passadeira, a cômoda com o vaso, os quadros de santo e as quatro portas numeradas. A escada desce para a recepção.",
    layout: planBottom(16, 4, 8),
    andar: POUSADA2,
    style: "taco",
    ...DENTRO,
    floor: [
      ["escada_desce", 8, 1, 4],
      ["portal", 4, 0, 4],
      ["portal", 12, 0, 4],
      ["portal", 4, 3, 0],
      ["portal", 12, 3, 0],
      ["rug_worn", 5, 1, 2],
      ["rug_worn", 9, 1, 2],
      ["comoda", 0, 1, 2],
      ["vaso_flores", 0, 1, 0],
      ["plant", 15, 0, 0],
      ...lampadas([6, 2], [11, 2]),
    ],
    wall: [
      ["painting", "r", 0, 2.2, 2.6],
      ["painting", "r", 0, 14.0, 2.6],
      ["clock", "l", 0, 2.0, 3.4],
    ],
    links: [
      [8, 1, "pousada"],
      [4, 0, "quarto"],
      [12, 0, "quarto2"],
      [4, 3, "quarto3"],
      [12, 3, "quarto4"],
    ],
    plan: { x: 0, y: 6 },
  },
  {
    key: "quarto",
    name: TIRADENTES + "Quarto da Pousada",
    description:
      "O quarto 1, o melhor da pousada, de frente para a Rua Direita: a cama de casal com a colcha de retalhos, os criados-mudos, o guarda-roupa, a cômoda com o oratório na parede, a poltrona e o tapete. Descanso confortável.",
    layout: planBottom(8, 6, 4),
    andar: POUSADA2,
    style: "taco",
    ...DENTRO,
    descanso: "confortavel",
    floor: [
      ["portal", 4, 5, 0],
      ["cama_casal", 1, 0, 4],
      ["nightstand", 0, 0, 4],
      ["nightstand", 3, 0, 4],
      ["candles", 0, 0, 0],
      ["books_stack", 3, 0, 0],
      ["guarda_roupa", 6, 0, 4],
      ["comoda", 0, 4, 2],
      ["mug", 0, 4, 0],
      ["rug_worn", 2, 3, 0],
      ["armchair", 7, 4, 6],
      ...lampadas([3, 2]),
    ],
    wall: [
      ["janela_cozinha", "r", 0, 4.4, 1.6],
      ["oratorio", "l", 0, 3.9, 2.1],
      ["painting", "l", 0, 1.3, 2.6],
    ],
    links: [[4, 5, "corredor"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "quarto2",
    name: TIRADENTES + "Quarto 2 da Pousada",
    description:
      "O quarto 2, também dos bons: a cama de casal arrumada, a escrivaninha com o tinteiro e a cadeira, o guarda-roupa, a poltrona perto da janela e o vaso de flores do dia. Descanso confortável.",
    layout: planBottom(8, 6, 4),
    andar: POUSADA2,
    style: "taco",
    ...DENTRO,
    descanso: "confortavel",
    floor: [
      ["portal", 4, 5, 0],
      ["guarda_roupa", 0, 0, 4],
      ["nightstand", 3, 0, 4],
      ["cama_casal", 4, 0, 4],
      ["nightstand", 6, 0, 4],
      ["candles", 6, 0, 0],
      ["desk_wood", 0, 3, 2],
      ["chair_wood", 1, 3, 6],
      ["vaso_flores", 0, 3, 0],
      ["papers", 0, 4, 0],
      ["rug_worn", 5, 3, 0],
      ["armchair", 7, 3, 6],
      ...lampadas([4, 3]),
    ],
    wall: [
      ["janela_cozinha", "r", 0, 2.3, 1.6],
      ["painting", "l", 0, 1.5, 2.6],
    ],
    links: [[4, 5, "corredor"]],
    plan: { x: 8, y: 0 },
  },
  {
    key: "quarto3",
    name: TIRADENTES + "Quarto 3 da Pousada",
    description:
      "O quarto 3, o simples: duas camas de solteiro com o criado-mudo no meio, a cômoda e a cadeira. Limpo e sem luxo. Descanso normal.",
    layout: planTop(8, 6, 4),
    andar: POUSADA2,
    style: "taco",
    ...DENTRO,
    descanso: "normal",
    floor: [
      ["portal", 4, 1, 4],
      ["cama_solteiro", 0, 3, 2],
      ["nightstand", 0, 4, 2],
      ["cama_solteiro", 0, 5, 2, oculta("A cama do 3", "No livro de hóspedes, quem dorme no quarto 3 assina sempre com a mesma letra, com nomes diferentes. Embaixo do colchão, um caderno com a mesma letra: datas, e ao lado de cada uma, \"ainda não\".")],
      ["candles", 0, 4, 0],
      ["comoda", 6, 1, 4],
      ["chair_wood", 6, 6, 0],
      ["rug_worn", 3, 3, 0],
      ...lampadas([4, 4]),
    ],
    wall: [["painting", "r", 1, 6.0, 2.6]],
    links: [[4, 1, "corredor"]],
    plan: { x: 0, y: 10 },
  },
  {
    key: "quarto4",
    name: TIRADENTES + "Quarto 4 da Pousada",
    description:
      "O quarto 4, o dos fundos e o mais barato: a cama de solteiro de colchão fino, a cadeira bamba, os caixotes no lugar da cômoda, a vela, a mancha de mofo no canto e a goteira quando chove. Descanso precário.",
    layout: planTop(8, 6, 4),
    andar: POUSADA2,
    style: "taco",
    ...DENTRO,
    darkness: 0.58,
    descanso: "precario",
    floor: [
      ["portal", 4, 1, 4],
      ["cama_solteiro", 0, 4, 2],
      ["crate_wood", 0, 6, 0],
      ["crate_wood", 1, 6, 0],
      ["candles", 0, 6, 0],
      ["chair_wood", 0, 2, 2],
      ["dirt", 2, 4, 0],
      ["dirt", 6, 2, 0],
    ],
    wall: [],
    links: [[4, 1, "corredor"]],
    plan: { x: 8, y: 10 },
  },
  // ------------------------------------------------------------ a Venda e o Boteco
  {
    key: "venda",
    name: TIRADENTES + "Venda",
    description:
      "A venda de secos e molhados: o balcão comprido de madeira com o caderno de fiado e a balança, as prateleiras até o teto com os potes de barro, as latas, as garrafas de cachaça e os rolos de pano, as sacas de feijão e de arroz no chão, os caixotes e o barril. Cheiro de fumo de rolo e de café.",
    layout: planBottom(11, 8, 5),
    andar: "Venda",
    style: "ladrilho",
    ...DENTRO,
    darkness: 0.32,
    floor: [
      ["portal", 5, 7, 0],
      ...[1, 3, 5, 7].map((x): FloorSeed => ["prateleira_venda", x, 0, 4]),
      ["counter_wood", 2, 3, 4],
      ["counter_wood", 4, 3, 4],
      ["counter_wood", 6, 3, 4],
      ["books_stack", 2, 3, 0, hint("Caderno de fiado", "As contas da cidade inteira, a lápis. Uma página tem só um nome, sublinhado três vezes, e nenhuma conta.")],
      ["food_tray", 5, 3, 0],
      ["mug", 7, 3, 0],
      ["stool", 4, 1, 4],
      ...de("sacas", [9, 0], [10, 0], [9, 1], [10, 5]),
      ["barrel", 10, 6, 0],
      ["crate_wood", 0, 6, 0],
      ["crate_wood", 1, 6, 0, undefined, 1],
      ["crate_wood", 0, 5, 0],
      ...lampadas([4, 2], [5, 5]),
    ],
    wall: [
      ["clock", "r", 0, 9.8, 3.5],
      ["janela_cozinha", "l", 0, 2.0, 1.6],
      ["notice_board", "l", 0, 4.4, 2.4],
    ],
    links: [[5, 7, "cidade"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "boteco",
    name: TIRADENTES + "Boteco",
    description:
      "O boteco da Rua Direita: o azulejo até a meia parede, o balcão com os copos americanos e o cinzeiro, as prateleiras de garrafas atrás, as banquetas, as mesinhas de bar com as cadeiras, o engradado de cerveja e o barril de chope no canto, a TV velha passando futebol.",
    layout: planBottom(9, 8, 4),
    andar: "Boteco",
    style: "cozinha_fazenda",
    ...DENTRO,
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 4, 7, 0],
      ["bar_shelf", 5, 0, 4],
      ["bar_shelf", 7, 0, 4],
      ["counter_wood", 5, 2, 4],
      ["counter_wood", 7, 2, 4],
      ["beer_glass", 5, 2, 0],
      ["ashtray", 6, 2, 0],
      ["beer_glass", 8, 2, 0],
      ...[5, 6, 7].map((x): FloorSeed => ["stool_bar", x, 3, 0]),
      // as duas mesinhas com as cadeiras viradas para elas, e o que está em cima
      ["table_bar", 1, 2, 0],
      ["chair_bar", 1, 1, 4],
      ["chair_bar", 2, 2, 6],
      ["beer_glass", 1, 2, 0],
      ["table_bar", 2, 5, 0],
      ["chair_bar", 1, 5, 2],
      ["chair_bar", 3, 5, 6],
      ["chair_bar", 2, 6, 0],
      ["ashtray", 2, 5, 0],
      ["keg", 8, 5, 0],
      ["beer_crate", 8, 6, 0],
      ["beer_crate", 8, 7, 0],
      ...lampadas([2, 3], [6, 5]),
    ],
    wall: [
      ["tv_wall", "r", 0, 2.4, 3.0],
      ["clock", "l", 0, 3.6, 3.4],
      ["painting", "l", 0, 6.4, 2.5],
    ],
    links: [[4, 7, "cidade"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ as casas comuns (sem nome: a casa padrão mineira)
  ...casaMineira({ key: "casa1", prefixo: TIRADENTES, lado: "frente", description: "Uma casa da Rua Direita: o fogão a gás, a geladeira, a mesa com o café e o pão de queijo, a TV na sala, a cama com a colcha de retalhos e o oratório em cima da cômoda. Cheiro de café coado.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa2", prefixo: TIRADENTES, lado: "frente", description: "Uma casa do lado da igreja: a cozinha arrumada, a mesa com as cadeiras, a TV ligada na novela, a cama de casal e o oratório com a santinha e a vela.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa3", prefixo: TIRADENTES, lado: "frente", description: "Uma casa do lado da igreja: a cozinha com a geladeira cheia de ímãs, a mesa da cozinha, o sofá de frente para a TV, a cama de casal e o oratório com a vela.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa4", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal, o oratório e o retrato da família na parede.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa5", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal, o oratório e o retrato da família na parede.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa6", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal, o oratório e o retrato da família na parede.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa7", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal, o oratório e o retrato da família na parede.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa8", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal, o oratório e o retrato da família na parede.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
  ...casaMineira({ key: "casa9", prefixo: TIRADENTES, lado: "fundo", description: "Uma casa do casario, a última antes da estrada: a cozinha com o fogão a gás, a mesa com as cadeiras, a TV na sala, a cama de casal e o oratório.", style: "taco", clima: DENTRO, paredes: paredesDaCasa }),
];

/**
 * Os interiores de vila de Tiradentes (a igreja com a sacristia, a pousada com o café, o corredor e os quatro quartos, a
 * venda e o boteco) para outra cidade com os mesmos prédios (24/10, Pedra Serena): uma cópia, com o nome da cidade
 * trocado e sem a "Rua Direita". As passagens para a rua levam à cena "cidade" de lá.
 */
export function interioresDeVila(prefixo: string): CenaSpec[] {
  const chaves = new Set(["igreja", "sacristia", "pousada", "cafe", "corredor", "quarto", "quarto2", "quarto3", "quarto4", "venda", "boteco"]);
  return CENAS.filter((s) => chaves.has(s.key)).map((s) => {
    const c = JSON.parse(JSON.stringify(s)) as CenaSpec;
    c.name = c.name.replace(TIRADENTES, prefixo);
    c.description = c.description.replace(/de frente para a Rua Direita/g, "de frente para a avenida").replace(/da Rua Direita/g, "da avenida");
    return c;
  });
}

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

/** Monta Tiradentes inteiro e a campanha dele (o lugar "Tiradentes" do mapa-múndi). */
export function seedTiradentes(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(TIRADENTES))) return;
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
    title: "Tiradentes",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.tiradentesRev = TIRADENTES_REV;
}

/** Refaz Tiradentes no lugar quando a montagem muda (TIRADENTES_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildTiradentes(db: Database): boolean {
  if ((db.tiradentesRev ?? 0) >= TIRADENTES_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(TIRADENTES));
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
  db.tiradentesRev = TIRADENTES_REV;
  return true;
}

/** Monta Tiradentes se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarTiradentes(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(TIRADENTES))) {
    seedTiradentes(db);
    return true;
  }
  return rebuildTiradentes(db);
}
