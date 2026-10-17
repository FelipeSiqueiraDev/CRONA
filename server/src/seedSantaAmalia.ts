import { getFurni, RoomMap, type Door, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed } from "./seed";
import { planBottom, planRight, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * Santa Amália (17/10), a cidade comum do interior de Minas onde a Hydra procura o Herman Arantes (a Bíblia da Campanha,
 * seção 29 a 32): nada de lenda, nada de Santo Berço à vista; a investigação é feita com gente e papel do dia a dia.
 * A arte do tabuleiro é pixel por código (scripts/3d/estilo/pecas_px/santa_amalia.py).
 *
 * A cidade de fora vem primeiro (a chave da campanha e a entrada do lugar). O norte é o alto do mapa: a prefeitura no
 * alto, virada para a praça; a avenida corta a cidade de leste a oeste embaixo da praça, e a van chega pelo leste. Do
 * lado da praça, o Cartório e duas casas; do outro lado da avenida, o Posto de Saúde, as casas e, no fim da rua, a
 * casa dos Valença, com a mata atrás. Os três prédios da história têm o interior inteiro, cômodo por cômodo, no
 * desenho das plantas que o Felipe mandou (17/10); as casas comuns, a casa padrão (`semNome`).
 *
 * A porta de dentro fica do MESMO lado da de fora (o Felipe, 14/10): virado para a tela (giro 4), planBottom; virado
 * para o fundo (giro 0), planTop.
 */
export const SANTA_AMALIA = "Santa Amália · ";
export const SANTA_AMALIA_REV = 4;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);
/** as lâmpadas do teto (acesas) */
const lampadas = (...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => ["ceiling_lamp", x, y, 0] as FloorSeed);

/** Planta retangular com a porta na parede da esquerda (a do fundo), na fileira doorY: o vão na coluna 0. */
function planLeft(w: number, h: number, doorY: number): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push((y === doorY ? "0" : "x") + "0".repeat(w));
  return { heightmap: rows.join("\n"), door: { x: 0, y: doorY, dir: 2 } };
}

const CIDADE = "Cidade";
const VALENCA = "Casa dos Valença";
const POSTO = "Posto de Saúde";
const CARTORIO = "Cartório";

/** O clima de dentro: a luz branca das lâmpadas de casa e de repartição. */
const DENTRO = { darkness: 0.3, ambient: "#e8dcc4", particles: ["dust"] as CenaSpec["particles"] };
/** O posto e o cartório: a luz fria das fluorescentes. */
const REPARTICAO = { darkness: 0.24, ambient: "#e4ecf0", particles: ["dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ a cidade (de fora)

const VW = 68;
const VH = 56;
/** a avenida (3 casas de rua) e as calçadas dos dois lados */
const AV_Y = 28;
const CALC_N = AV_Y - 1;
const CALC_S = AV_Y + 3;
/** a rua de cima (entre a prefeitura e a praça) e as duas ruas laterais (de norte a sul) */
const CIMA_Y = 14;
const OESTE_X = 18;
const LESTE_X = 42;
/** a praça, entre as ruas */
const PRACA = [20, 16, 41, 26] as const;
/** a estrada de terra por onde a van chega (o leste da avenida) */
const ESTRADA_X = 64;

function terrenoCidade(): Terreno {
  const t = new Terreno(VW, VH);
  // as ruas (o asfalto gasto) e as calçadas de cimento
  t.ret(0, AV_Y, VW - 1, AV_Y + 2, "c");
  t.ret(0, CALC_N, VW - 1, CALC_N, "q");
  t.ret(0, CALC_S, VW - 1, CALC_S + 1, "q");
  t.ret(ESTRADA_X, AV_Y, VW - 1, AV_Y + 2, "t");
  t.ret(OESTE_X, CIMA_Y, OESTE_X + 1, VH - 1, "c");
  t.ret(LESTE_X, CIMA_Y, LESTE_X + 1, VH - 1, "c");
  t.ret(OESTE_X, CIMA_Y, LESTE_X + 1, CIMA_Y + 1, "c");
  // a praça: o calçamento de pedra clara, com os canteiros de grama
  t.ret(PRACA[0], PRACA[1], PRACA[2], PRACA[3], "p");
  for (const [x, y] of [[21, 17], [37, 17], [21, 23], [37, 23]] as [number, number][]) t.ret(x, y, x + 3, y + 2, ".");
  // o caminho de terra da casa dos Valença para a mata do sul
  t.linha([[60, 44], [62, VH]], "d", 1);
  return t;
}
const T_CIDADE = terrenoCidade();

/** a peça "entrada" na casa logo à frente da porta de um prédio (a porta no meio da frente; giro 4 ou 0) */
function porta(id: string, x: number, y: number, rot: 0 | 4): [number, number] {
  const def = getFurni(id.split("~")[0])!;
  const meio = Math.floor(def.width / 2);
  return rot === 4 ? [x + meio, y + def.depth] : [x + def.width - 1 - meio, y - 1];
}

/** Os prédios com interior: [def (com o modelo), x, y, giro, cena de dentro]. */
const PREDIOS: [string, number, number, 0 | 4, string][] = [
  // do lado da praça, de frente para a avenida (e para a tela)
  ["casa_moderna", 1, 20, 4, "casa1"],
  ["casa_moderna~c", 10, 20, 4, "casa2"],
  ["cartorio_predio", 45, 16, 4, "cartorio"],
  ["casa_moderna~b", 60, 20, 4, "casa3"],
  // do outro lado da avenida (as portas para a rua, de costas para a tela)
  ["posto_saude", 1, 34, 0, "posto"],
  ["casa_moderna~d", 21, 34, 0, "casa4"],
  ["casa_moderna", 31, 34, 0, "casa5"],
  ["casa_moderna~c", 45, 34, 0, "casa6"],
  ["casa_valenca", 55, 34, 0, "valenca"],
];
const ENTRADAS = new Map(PREDIOS.map(([id, x, y, r, cena]) => [cena, porta(id, x, y, r)]));

function ocupar(ocupado: Set<string>, f: FloorSeed[]) {
  for (const [id, x, y, r] of f) {
    const def = getFurni(id.split("~")[0]);
    if (!def || def.flat) continue;
    const [sx, sy] = r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) ocupado.add(`${x + dx},${y + dy}`);
  }
}

/** árvores e arbustos só onde é grama e não tem nada */
function naGrama(ocupado: Set<string>, list: FloorSeed[]): FloorSeed[] {
  return list.filter(([, x, y]) => T_CIDADE.at(x, y) === "." && !ocupado.has(`${x},${y}`));
}

function cidadePiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [id, x, y, r, cena] of PREDIOS) f.push([id, x, y, r], ["entrada", ...ENTRADAS.get(cena)!, r]);
  // a prefeitura (sem interior por enquanto) no alto, virada para a praça
  f.push(["prefeitura_predio", 24, 1, 4, hint("Prefeitura", "A prefeitura de Santa Amália, o sobrado caiado do centro. A bandeira do município no mastro, o relógio parado nas 3 e 15 desde que alguém se lembra.")]);
  // a praça: o coreto, os bancos virados para ele, os postes e os vasos
  f.push(["coreto", 29, 19, 4, hint("Coreto", "O coreto da praça, pintado de verde, com a tinta descascando. Nos sábados tem forró.")]);
  f.push(["banco_praca", 25, 21, 0], ["banco_praca", 35, 21, 0], ["banco_praca", 30, 25, 0], ["banco_praca", 30, 16, 4]);
  f.push(...de("vaso_flores", [26, 18], [34, 18], [26, 24], [34, 24]));
  f.push(...de("poste_ferro", [20, 16], [41, 16], [20, 26], [41, 26], [9, 27], [30, 27], [57, 27], [15, 31], [40, 31], [53, 31], [17, 13], [44, 13]));
  // a calçada: as lixeiras e o banco do ponto de ônibus
  f.push(["trash_can", 16, 27, 0], ["bench", 37, 31, 0], ["trash_can", 46, 31, 0]);
  const ocupado = new Set<string>();
  ocupar(ocupado, f);
  // as árvores: nos canteiros da praça, nos quintais e a mata do sul (atrás da casa dos Valença)
  const arvores: [number, number][] = [
    [22, 18], [39, 18], [22, 24], [39, 24],
    [2, 3], [6, 9], [12, 4], [16, 8], [20, 2], [42, 4], [47, 9], [52, 3], [58, 7], [63, 3], [66, 11], [1, 15], [14, 16], [48, 13], [56, 12],
    [2, 48], [7, 51], [12, 47], [17, 53], [24, 49], [29, 54], [34, 48], [39, 52], [44, 47], [49, 53],
    [53, 47], [56, 50], [58, 46], [63, 48], [65, 52], [61, 54], [55, 54], [67, 45], [52, 51], [47, 50],
  ];
  arvores.forEach(([x, y], i) => {
    const novo = naGrama(ocupado, [[i % 3 === 0 ? "arvore" : i % 3 === 1 ? "arvore~b" : "arvore~c", x, y, 0]]);
    f.push(...novo);
    ocupar(ocupado, novo);
  });
  const arbustos: [number, number][] = [[24, 19], [38, 19], [8, 18], [15, 19], [50, 14], [64, 25], [10, 46], [27, 46], [38, 46], [52, 45], [66, 42]];
  arbustos.forEach(([x, y], i) => {
    const novo = naGrama(ocupado, [[["arbusto", "arbusto~b", "arbusto~c"][i % 3], x, y, 0]]);
    f.push(...novo);
    ocupar(ocupado, novo);
  });
  return f;
}

// ------------------------------------------------------------------ as cenas

/**
 * A casa comum da cidade, sem nome: a sala e a cozinha juntas, o quarto no fundo. O fogão a gás, a geladeira, a pia, a
 * mesa com o café, o sofá com a TV, a cama de casal e o guarda-roupa. `lado`: a porta de fora virada para a frente da
 * tela (a de dentro na parede da frente) ou para o fundo (na do fundo).
 */
function casaComum(key: string, lado: "frente" | "fundo", description: string): CenaSpec {
  const fundo = lado === "fundo";
  const y0 = fundo ? 1 : 0;
  const Y = (y: number) => y + y0;
  return {
    key,
    name: SANTA_AMALIA + "Casa",
    description,
    layout: fundo ? planTop(9, 7, 4) : planBottom(9, 7, 4),
    andar: "Casa",
    style: "ladrilho",
    ...DENTRO,
    floor: [
      fundo ? ["portal", 4, 1, 4] : ["portal", 4, 6, 0],
      // o fundo: a cozinha (a pia, o fogão, a geladeira) e o quarto (o guarda-roupa e a cama)
      ["pia_cozinha", 0, Y(0), 4],
      ["fogao_gas", 2, Y(0), 4],
      ["geladeira", 3, Y(0), 4],
      ["guarda_roupa", 5, Y(0), 4],
      ["cama_casal", 7, Y(0), 4],
      ["mesa_cozinha", 1, Y(3), 4],
      ["chair_wood", 1, Y(2), 4],
      ["chair_wood", 2, Y(5), 0],
      ["mug", 1, Y(3), 0],
      ["food_tray", 2, Y(4), 0],
      // a sala: o sofá virado para a TV
      ["rack_tv", 7, Y(4), 6],
      ["sofa_leather", 5, Y(3), 2],
      ["mesa_centro", 6, Y(4), 0],
      ["rug_worn", 5, Y(3), 0],
      ["plant", 8, Y(6), 0],
      ...lampadas([2, Y(2)], [6, Y(3)]),
    ],
    wall: [
      ["janela_vidro", "l", 0, Y(3.6), 1.4],
      ["clock", "r", y0, 1.2, 2.6],
      ["quadro_fazenda~03", "r", y0, 6.6, 2.5],
    ],
    links: [[4, fundo ? 1 : 6, "cidade"]],
    plan: { x: 0, y: 0 },
  };
}

const CENAS: CenaSpec[] = [
  {
    key: "cidade",
    name: SANTA_AMALIA + CIDADE,
    description:
      "Santa Amália: uma cidade comum do interior de Minas, sem nada de turístico. A avenida de asfalto gasto corta a cidade, com as calçadas de cimento rachado; no alto, a prefeitura caiada virada para a praça do coreto. Do lado da praça, o Cartório de Registro de Imóveis; do outro lado da avenida, o Posto de Saúde Municipal, as casas de reboco pintado e, no fim da rua, a casa dos Valença, com a mata fechada atrás. A van chega pela estrada de terra do leste.",
    layout: { heightmap: T_CIDADE.planta(), door: { x: VW - 1, y: AV_Y + 1, dir: 6 } },
    andar: CIDADE,
    style: "grama",
    aberto: true,
    terreno: T_CIDADE.texto(),
    darkness: 0.14,
    fog: 0,
    ambient: "#ffe6c4",
    particles: ["dust"],
    floor: cidadePiso(),
    wall: [],
    links: [...ENTRADAS].map(([cena, [x, y]]) => [x, y, cena] as [number, number, string]),
    plan: { x: 0, y: 0 },
  },

  // ------------------------------------------------------------ a casa dos Valença (a porta para o fundo)
  // por dentro do tamanho de fora (12 x 10, o Felipe 17/10): a sala e a cozinha na metade de cima, a área de serviço do
  // lado da cozinha; na de baixo, o quarto da filha, o banheiro e o quarto do casal
  {
    key: "valenca",
    name: SANTA_AMALIA + "Sala dos Valença",
    description:
      "A sala dos Valença: o piso de lajota, a mesa de jantar com a toalha de crochê, o aparador com as fotos de família, o sofá verde gasto de frente para a TV desligada, a mesa de centro. Tudo limpo demais, arrumado demais, como uma casa onde ninguém mais senta. A cozinha fica à esquerda, e também o quarto da filha; o banheiro e o quarto do casal, nas portas da frente.",
    layout: planTop(8, 5, 4),
    andar: VALENCA,
    style: "ladrilho",
    ...DENTRO,
    darkness: 0.4,
    floor: [
      ["portal", 4, 1, 4],
      ["portal", 0, 2, 2],
      ["portal", 0, 4, 2],
      ["portal", 2, 5, 0],
      ["portal", 6, 5, 0],
      // a mesa de jantar (à esquerda) e o aparador com as fotos
      ["mesa_cozinha", 1, 2, 4],
      ["chair_wood", 1, 4, 0],
      ["chair_wood", 3, 4, 0],
      ["vaso_flores", 2, 2, 0],
      ["sideboard", 2, 1, 4, hint("Aparador", "As fotos de família em porta-retratos: o Augusto, a mulher e a menina na praça, na igreja, no aniversário de sete anos. Nas mais novas, a mulher e a filha não olham para a câmera.")],
      // a sala de estar (à direita): o sofá virado para a TV
      ["rug_worn", 5, 2, 0],
      ["rack_tv", 6, 1, 4],
      ["mesa_centro", 6, 3, 0],
      ["papers", 6, 3, 0],
      ["sofa_leather", 6, 4, 0],
      ["plant", 0, 1, 0],
      ["plant", 7, 5, 0],
      ...lampadas([2, 3], [5, 3]),
    ],
    wall: [
      ["janela_vidro", "r", 1, 1.2, 1.4],
      ["quadro_fazenda~10", "r", 1, 6.4, 2.5],
    ],
    links: [
      [4, 1, "cidade"],
      [0, 2, "cozinha_v"],
      [0, 4, "quarto_filha"],
      [2, 5, "banheiro_v"],
      [6, 5, "quarto_casal"],
    ],
    plan: { x: 4, y: 0 },
  },
  {
    key: "cozinha_v",
    name: SANTA_AMALIA + "Cozinha dos Valença",
    description:
      "A cozinha: a pia com a louça lavada e virada para secar, o fogão de quatro bocas, a geladeira com os ímãs e um bilhete na porta, a mesinha com o pano de prato. A porta da esquerda dá na área de serviço.",
    layout: planRight(4, 4, 1),
    andar: VALENCA,
    style: "ladrilho",
    ...DENTRO,
    floor: [
      ["portal", 3, 1, 6],
      ["portal", 0, 2, 2],
      ["pia_cozinha", 0, 0, 4],
      ["fogao_gas", 2, 0, 4],
      ["geladeira", 3, 0, 4, hint("Bilhete na geladeira", "Com a letra do Augusto, presa num ímã de farmácia: \"Não deixar papel nem lápis em cima da mesa. Esconder as canetas.\"")],
      ["table_small", 1, 2, 0],
      ["chair_wood", 2, 2, 6],
      ["cafeteira", 1, 2, 0],
      ...lampadas([2, 3]),
    ],
    wall: [
      ["janela_vidro", "r", 0, 1.0, 1.4],
      ["utensilios_parede", "r", 0, 2.6, 1.7],
    ],
    links: [
      [3, 1, "valenca"],
      [0, 2, "lavanderia_v"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "lavanderia_v",
    name: SANTA_AMALIA + "Área de Serviço dos Valença",
    description:
      "A área de serviço: o tanque de cimento, a máquina de lavar, a prateleira com os produtos de limpeza, o balde e o rodo. No ralo, uma mancha preta e grossa que não sai com água sanitária.",
    layout: planRight(3, 3, 1),
    andar: VALENCA,
    style: "concreto",
    ...DENTRO,
    darkness: 0.46,
    floor: [
      ["portal", 2, 1, 6],
      ["tanque", 0, 0, 4],
      ["maquina_lavar", 1, 0, 4],
      ["prateleira", 0, 2, 0],
      ["lodo_preto", 1, 1, 0, oculta("Mancha no ralo", "Uma pasta preta e grossa, que escorre devagar mesmo quando nada a empurra. Cheira a terra molhada e a ferro. Esfregada, volta no dia seguinte.")],
      ...lampadas([0, 1]),
    ],
    wall: [],
    links: [[2, 1, "cozinha_v"]],
    plan: { x: -3, y: 0 },
  },
  {
    key: "banheiro_v",
    name: SANTA_AMALIA + "Banheiro dos Valença",
    description: "O banheiro: o box de vidro com o chuveiro elétrico, o vaso, a pia com o espelho. Os espelhos estão virados para a parede.",
    layout: planTop(3, 4, 1),
    andar: VALENCA,
    style: "azulejo",
    ...DENTRO,
    floor: [
      ["portal", 1, 1, 4],
      ["sink", 2, 1, 4],
      ["box_chuveiro", 0, 3, 0],
      ["toilet", 2, 4, 0],
      ...lampadas([1, 2]),
    ],
    wall: [["mirror", "l", 0, 3.0, 1.6]],
    links: [[1, 1, "valenca"]],
    plan: { x: 4, y: 5 },
  },
  {
    key: "quarto_casal",
    name: SANTA_AMALIA + "Quarto do Casal",
    description:
      "O quarto do casal: a cama grande com o edredom verde e a manta vinho, os dois criados-mudos com os abajures, o guarda-roupa de madeira, a cômoda. Do lado do Augusto, a pilha de cadernos e o copo de água; do outro lado, o travesseiro intocado.",
    layout: planTop(5, 5, 2),
    andar: VALENCA,
    style: "taco",
    ...DENTRO,
    darkness: 0.42,
    floor: [
      ["portal", 2, 1, 4],
      ["cama_casal", 1, 3, 0],
      ["nightstand", 0, 5, 0],
      ["nightstand", 3, 5, 0],
      ["desk_lamp", 0, 5, 0],
      ["books_stack", 3, 5, 0, oculta("Os diários", "Os cadernos do Augusto e o diário da esposa. Datas, nomes de remédio, o horário em que a filha acordou gritando, e a mesma pergunta repetida: \"para onde elas olham?\". No último caderno, um mapa à mão da mata atrás da casa, com o caminho riscado e refeito várias vezes.")],
      ["guarda_roupa", 4, 2, 2],
      ["comoda", 0, 1, 2],
      ...lampadas([3, 3]),
    ],
    wall: [
      ["janela_vidro", "l", 0, 2.2, 1.4],
      ["painting", "r", 1, 4.3, 2.4],
    ],
    links: [[2, 1, "valenca"]],
    plan: { x: 7, y: 5 },
  },
  {
    key: "quarto_filha",
    name: SANTA_AMALIA + "Quarto da Filha",
    description:
      "O quarto da menina: a cama de solteiro com a colcha lilás, a escrivaninha, o pufe, o tapete. Em todo lugar, folhas de papel com a mesma espiral preta, riscada até furar a folha: no chão, na cama, coladas com fita nas paredes, uma por cima da outra. Há marcas de lápis no rodapé e no batente da porta.",
    layout: planRight(4, 5, 1),
    andar: VALENCA,
    style: "taco",
    ...DENTRO,
    darkness: 0.48,
    ambient: "#d8c8d8",
    floor: [
      ["portal", 3, 1, 6],
      ["rug_purple", 1, 1, 0],
      ["cama_solteiro", 0, 0, 4],
      ["nightstand", 1, 0, 4],
      ["desk_lamp", 1, 0, 0],
      ["desk_wood", 0, 4, 0],
      ["desenhos_espiral", 0, 4, 0],
      ["chair_wood", 1, 3, 4],
      ["pufe", 3, 3, 0],
      ...de("desenhos_espiral", [2, 0], [2, 1], [1, 1], [2, 3], [3, 4]),
      ["desenhos_espiral", 2, 2, 0, hint("Os desenhos", "Centenas de folhas, todas com a mesma espiral, desenhada do mesmo jeito: de fora para dentro, sempre no sentido do relógio. Algumas têm o centro furado de tanto passar o lápis.")],
      ["lodo_preto", 1, 2, 0, oculta("Manchas no lençol", "No travesseiro e no lençol, manchas de uma pasta preta e grossa. Saiu da boca e dos olhos dela, à noite. O Augusto troca a roupa de cama todo dia.")],
      ...lampadas([2, 4]),
    ],
    wall: [
      ["desenho_espiral_parede", "r", 0, 1.6, 1.8],
      ["desenho_espiral_parede", "l", 0, 1.0, 1.7],
      ["desenho_espiral_parede", "l", 0, 2.8, 1.5],
    ],
    links: [[3, 1, "valenca"]],
    plan: { x: 0, y: 5 },
  },

  // ------------------------------------------------------------ o Posto de Saúde (a porta para o fundo)
  // por dentro do tamanho de fora (16 x 12): na metade de cima o banheiro, a recepção e a administração; na de baixo,
  // em fileira, o consultório, a sala de procedimentos, a triagem e a farmácia
  {
    key: "posto",
    name: SANTA_AMALIA + "Recepção do Posto",
    description:
      "A recepção do Posto de Saúde Municipal: o piso de granilite, as fileiras de cadeiras azuis de plástico, o balcão de atendimento com o computador e a pilha de fichas, o bebedouro de galão, o mural de avisos com as campanhas de vacina. Atrás do balcão, a Sônia, a recepcionista. As portas dos consultórios, da triagem e da farmácia ficam na frente; o banheiro à esquerda; a sala administrativa à direita.",
    layout: planTop(9, 6, 4),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 4, 1, 4],
      ["portal", 0, 3, 2],
      ["portal", 8, 3, 6],
      ["portal", 1, 6, 0],
      ["portal", 3, 6, 0],
      ["portal", 5, 6, 0],
      ["portal", 7, 6, 0],
      // as cadeiras de espera (viradas para o balcão) e o balcão com a Sônia atrás dele
      ["cadeira_espera", 0, 2, 4],
      ["cadeira_espera", 6, 2, 4],
      ["balcao_recepcao", 3, 4, 0],
      ["chair_office", 4, 5, 0],
      ["papers", 3, 4, 0, hint("Fichas de atendimento", "A pilha de fichas do dia, presa com um clipe. A Sônia anota tudo à mão antes de passar para o computador.")],
      ["water_cooler", 8, 1, 0],
      ["trash_can", 0, 1, 0],
      ["plant", 8, 5, 0],
      ...lampadas([2, 3], [6, 3]),
    ],
    wall: [
      ["notice_board", "r", 1, 1.2, 2.0],
      ["clock", "r", 1, 6.6, 2.8],
      ["janela_vidro", "l", 0, 2.0, 1.4],
    ],
    links: [
      [4, 1, "cidade"],
      [0, 3, "banheiro_p"],
      [8, 3, "administracao"],
      [1, 6, "consultorio"],
      [3, 6, "procedimentos"],
      [5, 6, "triagem"],
      [7, 6, "farmacia"],
    ],
    plan: { x: 3, y: 0 },
  },
  {
    key: "consultorio",
    name: SANTA_AMALIA + "Consultório",
    description: "O consultório: a maca com o papel lençol, a mesa do médico com o computador e a cadeira do paciente, a pia. O estetoscópio esquecido em cima do receituário.",
    layout: planTop(4, 5, 1),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 1, 4],
      ["maca_exame", 3, 2, 4],
      ["desk_metal", 0, 4, 0],
      ["monitor", 0, 4, 0],
      ["chair_office", 0, 5, 0],
      ["chair_wood", 1, 3, 4],
      ["sink", 3, 5, 0],
      ["trash_bin", 2, 5, 0],
      ...lampadas([2, 2]),
    ],
    wall: [["janela_vidro", "l", 0, 2.6, 1.4]],
    links: [[1, 1, "posto"]],
    plan: { x: 0, y: 7 },
  },
  {
    key: "procedimentos",
    name: SANTA_AMALIA + "Sala de Procedimentos",
    description: "A sala de procedimentos: a maca, o suporte de soro, o carrinho de curativo, a pia de inox e o armário de remédios. Cheiro de álcool.",
    layout: planTop(4, 5, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 2, 1, 4],
      ["maca_exame", 0, 3, 4],
      ["iv_stand", 1, 3, 0],
      ["trolley", 3, 3, 0],
      ["medical_cabinet", 1, 5, 0],
      ["sink", 3, 5, 0],
      ["trash_bin", 0, 5, 0],
      ...lampadas([2, 4]),
    ],
    wall: [],
    links: [[2, 1, "posto"]],
    plan: { x: 4, y: 7 },
  },
  {
    key: "triagem",
    name: SANTA_AMALIA + "Triagem",
    description: "A sala da triagem: a mesinha com o aparelho de pressão e o computador, a cadeira do paciente e o monitor. O termômetro numa caneca.",
    layout: planTop(4, 5, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 2, 1, 4],
      ["chair_office", 0, 3, 4],
      ["desk_metal", 0, 4, 4],
      ["monitor", 0, 4, 0],
      ["mug", 1, 4, 0],
      ["chair_wood", 1, 5, 0],
      ["vitals_monitor", 3, 3, 0],
      ...lampadas([2, 3]),
    ],
    wall: [],
    links: [[2, 1, "posto"]],
    plan: { x: 8, y: 7 },
  },
  {
    key: "farmacia",
    name: SANTA_AMALIA + "Farmácia do Posto",
    description: "A farmacinha do posto: as estantes de aço cheias de caixas de remédio, a mesa com o caderno de saída e as caixas de papelão ainda fechadas.",
    layout: planTop(4, 5, 1),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 1, 4],
      ["estante_remedios", 0, 5, 0],
      ["estante_remedios", 2, 5, 0],
      ["desk_metal", 3, 2, 2],
      ["papers", 3, 2, 0],
      ["crate_wood", 0, 2, 0],
      ...lampadas([1, 3]),
    ],
    wall: [],
    links: [[1, 1, "posto"]],
    plan: { x: 12, y: 7 },
  },
  {
    key: "banheiro_p",
    name: SANTA_AMALIA + "Banheiro do Posto",
    description: "O banheiro do posto: o vaso, a pia, o porta-papel, o ralo e o cheiro de desinfetante.",
    layout: planRight(3, 4, 2),
    andar: POSTO,
    style: "azulejo",
    ...REPARTICAO,
    floor: [
      ["portal", 2, 2, 6],
      ["toilet", 0, 0, 4],
      ["sink", 0, 3, 0],
      ["trash_bin", 2, 0, 0],
      ...lampadas([1, 1]),
    ],
    wall: [["towel_dispenser", "l", 0, 1.4, 1.5]],
    links: [[2, 2, "posto"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "administracao",
    name: SANTA_AMALIA + "Administração do Posto",
    description:
      "A sala administrativa: a mesa com o computador e a impressora, os arquivos de aço com os cadastros dos profissionais e os prontuários, a estante de caixas-arquivo. A Sônia não deixa ninguém entrar sem autorização da Secretaria de Saúde.",
    layout: planLeft(4, 6, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 2, 2],
      ["desk_metal", 2, 0, 4],
      ["monitor", 2, 0, 0],
      ["printer_dot", 3, 0, 0],
      ["chair_office", 2, 1, 0],
      ["cabinet_file", 4, 1, 6],
      ["cabinet_file", 4, 2, 6],
      ["cabinet_file", 4, 3, 6, oculta("Cadastro de profissionais", "Na pasta dos médicos que atenderam na zona rural: Herman Arantes, vínculo de 1998 a 2004. A foto 3x4 tem algo errado no olhar. A rubrica é sempre a mesma: \"Bye\".")],
      ["estante_arquivo", 2, 5, 0],
      ["papers", 3, 3, 0, oculta("Extrato de atendimentos", "Um relatório de atendimentos impresso. Há registros assinados com a mesma rubrica \"Bye\" em datas recentes, embora o vínculo do médico tenha acabado em 2004.")],
      ...lampadas([2, 3]),
    ],
    wall: [["notes_wall", "r", 0, 2.5, 2.0]],
    links: [[1, 2, "posto"]],
    plan: { x: 12, y: 0 },
  },

  // ------------------------------------------------------------ o Cartório (a porta para a frente)
  // por dentro do tamanho de fora (14 x 11): no fundo a sala do oficial, o arquivo e o depósito; na frente, o
  // atendimento, com o banheiro e a copa do lado
  {
    key: "cartorio",
    name: SANTA_AMALIA + "Atendimento do Cartório",
    description:
      "O atendimento do Cartório de Registro de Imóveis: o piso de granito, as duas fileiras de cadeiras pretas de espera, o balcão com os dois guichês, os computadores e as pilhas de pastas, o carimbo e a campainha. A Lívia, a escrevente, atende com calma e pede para preencher o requerimento. Ao fundo, a sala do oficial, o arquivo e o depósito; à direita, o banheiro e a copa.",
    layout: planBottom(10, 6, 5),
    andar: CARTORIO,
    style: "pedra",
    ...REPARTICAO,
    floor: [
      ["portal", 5, 5, 0],
      ["portal", 1, 0, 4],
      ["portal", 5, 0, 4],
      ["portal", 8, 0, 4],
      ["portal", 9, 2, 6],
      ["portal", 9, 4, 6],
      // o balcão dos guichês e os escreventes atrás dele
      ["balcao_recepcao", 1, 2, 4],
      ["balcao_recepcao", 5, 2, 4],
      ["chair_office", 2, 1, 4],
      ["chair_office", 6, 1, 4],
      ["papers", 1, 2, 0, hint("Requerimento", "O formulário de pesquisa de imóveis: em nome de quem, de qual época, por qual tipo de ato. A Lívia explica que procurar só pelo nome do dono nem sempre acha.")],
      // as cadeiras de espera (viradas para o balcão)
      ["cadeira_espera", 0, 4, 0],
      ["cadeira_espera", 6, 4, 0],
      ["water_cooler", 9, 5, 0],
      ["plant", 0, 5, 0],
      ...lampadas([4, 3], [8, 3]),
    ],
    wall: [
      ["notice_board", "l", 0, 2.2, 2.0],
      ["clock", "r", 0, 3.0, 2.8],
      ["painting", "r", 0, 7.0, 2.6],
    ],
    links: [
      [5, 5, "cidade"],
      [1, 0, "oficial"],
      [5, 0, "arquivo"],
      [8, 0, "deposito"],
      [9, 2, "banheiro_c"],
      [9, 4, "copa"],
    ],
    plan: { x: 0, y: 5 },
  },
  {
    key: "oficial",
    name: SANTA_AMALIA + "Sala do Oficial",
    description: "A sala do oficial do registro: a mesa de madeira com o computador e o carimbo, a cadeira de couro, as duas cadeiras de visita, o tapete persa gasto, a estante, os diplomas na parede e o arquivo.",
    layout: planBottom(5, 5, 2),
    andar: CARTORIO,
    style: "taco",
    ...REPARTICAO,
    ambient: "#e8d8b8",
    floor: [
      ["portal", 2, 4, 0],
      ["rug_ornate", 1, 0, 0],
      ["chair_verissimo", 1, 0, 4],
      ["desk_wood", 1, 1, 4],
      ["monitor", 1, 1, 0],
      ["chair_wood", 1, 2, 0],
      ["chair_wood", 2, 2, 0],
      ["bookshelf", 0, 2, 2],
      ["cabinet_file", 4, 0, 4],
      ["plant", 4, 3, 0],
      ...lampadas([3, 2]),
    ],
    wall: [
      ["painting", "r", 0, 0.9, 2.3],
      ["quadro_fazenda~03", "r", 0, 3.2, 2.3],
      ["janela_vidro", "l", 0, 1.0, 1.4],
    ],
    links: [[2, 4, "cartorio"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "arquivo",
    name: SANTA_AMALIA + "Arquivo do Cartório",
    description:
      "O arquivo: as estantes de aço até o teto com as caixas e os livros de registro por ano, a mesa comprida de pesquisa com a lupa e as pastas abertas, o carrinho de livros. Poeira de papel no ar.",
    layout: planBottom(6, 5, 3),
    andar: CARTORIO,
    style: "concreto",
    ...REPARTICAO,
    darkness: 0.34,
    floor: [
      ["portal", 3, 4, 0],
      ["estante_arquivo", 0, 0, 4],
      ["estante_arquivo", 2, 0, 4],
      ["estante_arquivo", 4, 0, 4],
      ["table_meeting", 1, 2, 4],
      ["chair_wood", 4, 2, 6],
      ["papers", 1, 2, 0, oculta("Índice de 2003", "O livro índice dos atos de 2003. Procurado pelo nome de Herman Arantes como dono, não aparece. Como procurador, aparece: representando as Indústrias Panacea S.A.")],
      ["books_stack", 2, 2, 0, oculta("Matrícula 1.847", "O registro de 18/06/2003: a Gleba Rural nº 12, com 186,40 hectares, comprada pelas Indústrias Panacea. A descrição fala em \"acesso existente\", sem dizer qual. Na averbação AV-2, de 17/08/2021, a área confere, mas o acesso registrado antes não foi identificado.")],
      ["trolley", 5, 3, 0],
      ...lampadas([0, 3]),
    ],
    wall: [],
    links: [[3, 4, "cartorio"]],
    plan: { x: 5, y: 0 },
  },
  {
    key: "deposito",
    name: SANTA_AMALIA + "Depósito do Cartório",
    description: "O depósito: os arquivos de aço verdes de quatro gavetas, as caixas de papelão empilhadas e os livros antigos de capa de couro.",
    layout: planBottom(3, 5, 1),
    andar: CARTORIO,
    style: "concreto",
    ...REPARTICAO,
    darkness: 0.44,
    floor: [
      ["portal", 1, 4, 0],
      ["estante_arquivo", 0, 0, 4],
      ["cabinet_file", 2, 1, 6],
      ["cabinet_file", 2, 2, 6],
      ["crate_wood", 0, 2, 0],
      ["crate_wood", 0, 3, 0],
      ["books_stack", 2, 3, 0],
      ...lampadas([1, 2]),
    ],
    wall: [],
    links: [[1, 4, "cartorio"]],
    plan: { x: 11, y: 0 },
  },
  {
    key: "banheiro_c",
    name: SANTA_AMALIA + "Banheiro do Cartório",
    description: "O banheiro: o vaso, a pia, o espelho e o cheiro de lavanda barata.",
    layout: planLeft(4, 3, 1),
    andar: CARTORIO,
    style: "azulejo",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 1, 2],
      ["toilet", 4, 0, 4],
      ["sink", 4, 2, 6],
      ...lampadas([2, 1]),
    ],
    wall: [["mirror", "r", 0, 3.0, 1.6]],
    links: [[1, 1, "cartorio"]],
    plan: { x: 10, y: 5 },
  },
  {
    key: "copa",
    name: SANTA_AMALIA + "Copa do Cartório",
    description: "A copa: o balcão com a garrafa de café, os copinhos de plástico e o açucareiro, o frigobar e a lixeira.",
    layout: planLeft(4, 3, 1),
    andar: CARTORIO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 1, 2],
      ["counter_wood", 3, 0, 4],
      ["cafeteira", 3, 0, 0],
      ["mug", 4, 0, 0],
      ["minibar", 4, 2, 4],
      ["trash_bin", 2, 2, 0],
      ...lampadas([2, 1]),
    ],
    wall: [],
    links: [[1, 1, "cartorio"]],
    plan: { x: 10, y: 8 },
  },

  // ------------------------------------------------------------ as casas comuns
  casaComum("casa1", "frente", "Uma casa da avenida: a cozinha e a sala juntas, a TV ligada no jornal, o cheiro de café, o quarto no fundo."),
  casaComum("casa2", "frente", "Uma casa da avenida, perto da praça: o fogão a gás, a mesa com o café, o sofá de frente para a TV."),
  casaComum("casa3", "frente", "A última casa antes da estrada: o fogão, a geladeira com os ímãs, a mesa da cozinha e a cama no fundo."),
  casaComum("casa4", "fundo", "Uma casa do outro lado da avenida: a cozinha e a sala juntas, a TV e o sofá, o quarto no fundo."),
  casaComum("casa5", "fundo", "Uma casa do outro lado da avenida: a mesa com o pão e o café, o sofá de frente para a TV."),
  casaComum("casa6", "fundo", "A casa vizinha dos Valença: a cozinha e a sala juntas, a TV ligada alto, a cortina sempre fechada para o lado da casa deles."),
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

/** Monta Santa Amália inteira e a campanha dela (o lugar "Santa Amália" do mapa-múndi). */
export function seedSantaAmalia(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(SANTA_AMALIA))) return;
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
    title: "Santa Amália",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.santaAmaliaRev = SANTA_AMALIA_REV;
}

/** Refaz Santa Amália no lugar quando a montagem muda (SANTA_AMALIA_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildSantaAmalia(db: Database): boolean {
  if ((db.santaAmaliaRev ?? 0) >= SANTA_AMALIA_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(SANTA_AMALIA));
  if (!existing.length) return false;
  const key = Math.min(...existing.map((r) => r.id));
  const built = new Map<string, RoomData>();
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
  db.santaAmaliaRev = SANTA_AMALIA_REV;
  return true;
}

/** Monta Santa Amália se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarSantaAmalia(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(SANTA_AMALIA))) {
    seedSantaAmalia(db);
    return true;
  }
  return rebuildSantaAmalia(db);
}
