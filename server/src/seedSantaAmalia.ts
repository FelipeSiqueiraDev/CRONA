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
export const SANTA_AMALIA_REV = 2;

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

const VW = 60;
const VH = 44;
/** a avenida (3 casas de rua) e as calçadas dos dois lados */
const AV_Y = 22;
const CALC_N = AV_Y - 1;
const CALC_S = AV_Y + 3;
/** a rua de cima (entre a prefeitura e a praça) e as duas ruas laterais (de norte a sul) */
const CIMA_Y = 10;
const OESTE_X = 17;
const LESTE_X = 37;
/** a praça, entre as ruas */
const PRACA = [19, 12, 35, 20] as const;
/** a estrada de terra por onde a van chega (o leste da avenida) */
const ESTRADA_X = 56;

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
  for (const [x, y] of [[20, 13], [31, 13], [20, 17], [31, 17]] as [number, number][]) t.ret(x, y, x + 3, y + 2, ".");
  // o caminho de terra da casa dos Valença para a mata do sul
  t.linha([[50, CALC_S + 8], [52, VH]], "d", 1);
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
  ["casa_moderna", 1, 15, 4, "casa1"],
  ["casa_moderna~c", 9, 15, 4, "casa2"],
  ["cartorio_predio", 40, 14, 4, "cartorio"],
  ["casa_moderna~b", 52, 16, 4, "casa3"],
  // do outro lado da avenida (as portas para a rua, de costas para a tela)
  ["posto_saude", 2, 28, 0, "posto"],
  ["casa_moderna~d", 20, 28, 0, "casa4"],
  ["casa_moderna", 28, 28, 0, "casa5"],
  ["casa_moderna~c", 40, 28, 0, "casa6"],
  ["casa_valenca", 48, 28, 0, "valenca"],
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
  f.push(["prefeitura_predio", 21, 1, 4, hint("Prefeitura", "A prefeitura de Santa Amália, o sobrado caiado do centro. A bandeira do município no mastro, o relógio parado nas 3 e 15 desde que alguém se lembra.")]);
  // a praça: o coreto, os bancos virados para ele, os postes e os vasos
  f.push(["coreto", 25, 14, 4, hint("Coreto", "O coreto da praça, pintado de verde, com a tinta descascando. Nos sábados tem forró.")]);
  f.push(["banco_praca", 21, 16, 0], ["banco_praca", 31, 16, 0], ["banco_praca", 25, 19, 0], ["banco_praca", 29, 12, 4]);
  f.push(...de("vaso_flores", [24, 13], [30, 13], [24, 19], [30, 19]));
  f.push(...de("poste_ferro", [19, 12], [35, 12], [19, 20], [35, 20], [8, 21], [28, 21], [46, 21], [14, 25], [34, 25], [44, 25], [16, 11], [38, 11]));
  // a calçada: o orelhão-de-gente (a lixeira e o banco do ponto de ônibus) e os carros de ninguém
  f.push(["trash_can", 15, 21, 0], ["bench", 36, 25, 0], ["trash_can", 39, 25, 0]);
  const ocupado = new Set<string>();
  ocupar(ocupado, f);
  // as árvores: nos canteiros da praça, nos quintais e a mata do sul (atrás da casa dos Valença)
  const arvores: [number, number][] = [
    [21, 13], [33, 13], [21, 18], [33, 18],
    [2, 3], [6, 8], [12, 4], [16, 6], [38, 4], [44, 6], [50, 3], [56, 8], [58, 13], [1, 12], [13, 12], [47, 11],
    [1, 37], [6, 40], [12, 38], [17, 42], [24, 36], [30, 40], [35, 37], [42, 36],
    [46, 37], [48, 40], [50, 36], [53, 38], [55, 41], [57, 36], [58, 39], [52, 42], [45, 42], [56, 43],
  ];
  arvores.forEach(([x, y], i) => {
    const novo = naGrama(ocupado, [[i % 3 === 0 ? "arvore" : i % 3 === 1 ? "arvore~b" : "arvore~c", x, y, 0]]);
    f.push(...novo);
    ocupar(ocupado, novo);
  });
  const arbustos: [number, number][] = [[23, 17], [32, 17], [8, 13], [14, 14], [45, 12], [57, 20], [10, 34], [26, 35], [36, 34], [46, 35], [58, 33]];
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
  {
    key: "valenca",
    name: SANTA_AMALIA + "Sala dos Valença",
    description:
      "A sala dos Valença: o piso de lajota, o sofá verde gasto com a manta jogada, a mesa de centro, o rack com a TV desligada, a mesa de jantar com a toalha de crochê e as quatro cadeiras, o aparador com as fotos de família. Tudo limpo demais, arrumado demais, como uma casa onde ninguém mais senta. A cozinha fica à esquerda; os quartos e o banheiro, nas portas da frente; o quarto da filha, à direita.",
    layout: planTop(12, 7, 6),
    andar: VALENCA,
    style: "ladrilho",
    ...DENTRO,
    darkness: 0.4,
    floor: [
      ["portal", 6, 1, 4],
      ["portal", 0, 4, 2],
      ["portal", 11, 4, 6],
      ["portal", 3, 7, 0],
      ["portal", 8, 7, 0],
      // a sala de jantar (à esquerda)
      ["mesa_jantar", 1, 3, 4],
      ["chair_wood", 1, 2, 4],
      ["chair_wood", 2, 2, 4],
      ["chair_wood", 1, 5, 0],
      ["chair_wood", 2, 5, 0],
      ["vaso_flores", 1, 3, 0],
      ["sideboard", 0, 1, 4, hint("Aparador", "As fotos de família em porta-retratos: o Augusto, a mulher e a menina na praça, na igreja, no aniversário de sete anos. Nas mais novas, a mulher e a filha não olham para a câmera.")],
      // a sala de estar (à direita): o sofá virado para a TV
      ["rug_worn", 7, 3, 0],
      ["sofa_leather", 7, 5, 0],
      ["mesa_centro", 8, 3, 0],
      ["papers", 8, 3, 0],
      ["rack_tv", 7, 1, 4],
      ["plant", 10, 1, 0],
      ["plant", 0, 6, 0],
      ...lampadas([2, 4], [8, 4]),
    ],
    wall: [
      ["janela_vidro", "r", 1, 3.2, 1.4],
      ["quadro_fazenda~10", "r", 1, 9.6, 2.5],
      ["clock", "l", 0, 2.6, 2.7],
    ],
    links: [
      [6, 1, "cidade"],
      [0, 4, "cozinha_v"],
      [11, 4, "quarto_filha"],
      [3, 7, "banheiro_v"],
      [8, 7, "quarto_casal"],
    ],
    plan: { x: 4, y: 0 },
  },
  {
    key: "cozinha_v",
    name: SANTA_AMALIA + "Cozinha dos Valença",
    description:
      "A cozinha: a pia com a louça lavada e virada para secar, o fogão de quatro bocas, a geladeira com os ímãs e um bilhete na porta, o armário, a mesinha com o pano de prato. A porta dos fundos dá na área de serviço.",
    layout: planRight(7, 6, 3),
    andar: VALENCA,
    style: "ladrilho",
    ...DENTRO,
    floor: [
      ["portal", 6, 3, 6],
      ["portal", 1, 0, 4],
      ["pia_cozinha", 2, 0, 4],
      ["fogao_gas", 4, 0, 4],
      ["geladeira", 5, 0, 4, hint("Bilhete na geladeira", "Com a letra do Augusto, presa num ímã de farmácia: \"Não deixar papel nem lápis em cima da mesa. Esconder as canetas.\"")],
      ["armario_cozinha", 0, 2, 2],
      ["mesa_cozinha", 2, 3, 4],
      ["chair_wood", 2, 2, 4],
      ["chair_wood", 3, 5, 0],
      ["mug", 2, 3, 0],
      ["cafeteira", 3, 3, 0],
      ...lampadas([3, 2]),
    ],
    wall: [
      ["janela_vidro", "r", 0, 3.4, 1.4],
      ["utensilios_parede", "l", 0, 1.0, 1.6],
    ],
    links: [
      [6, 3, "valenca"],
      [1, 0, "lavanderia_v"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "lavanderia_v",
    name: SANTA_AMALIA + "Área de Serviço dos Valença",
    description:
      "A área de serviço nos fundos: o tanque de cimento, a máquina de lavar, a prateleira com os produtos de limpeza, o balde e o rodo. No ralo, uma mancha preta e grossa que não sai com água sanitária.",
    layout: planBottom(5, 4, 1),
    andar: VALENCA,
    style: "concreto",
    ...DENTRO,
    darkness: 0.46,
    floor: [
      ["portal", 1, 3, 0],
      ["tanque", 0, 0, 4],
      ["maquina_lavar", 1, 0, 4],
      ["prateleira", 3, 0, 4],
      ["trash_bin", 4, 2, 0],
      ["lodo_preto", 2, 2, 0, oculta("Mancha no ralo", "Uma pasta preta e grossa, que escorre devagar mesmo quando nada a empurra. Cheira a terra molhada e a ferro. Esfregada, volta no dia seguinte.")],
      ...lampadas([2, 1]),
    ],
    wall: [],
    links: [[1, 3, "cozinha_v"]],
    plan: { x: 0, y: -4 },
  },
  {
    key: "banheiro_v",
    name: SANTA_AMALIA + "Banheiro dos Valença",
    description: "O banheiro: o box de vidro com o chuveiro elétrico, o vaso, a pia com o espelho, o tapetinho. Os espelhos estão virados para a parede.",
    layout: planTop(4, 4, 2),
    andar: VALENCA,
    style: "azulejo",
    ...DENTRO,
    floor: [
      ["portal", 2, 1, 4],
      ["box_chuveiro", 0, 2, 0],
      ["toilet", 3, 4, 0],
      ["sink", 0, 4, 0],
      ["rug_worn", 1, 2, 0],
      ...lampadas([2, 3]),
    ],
    wall: [["mirror", "l", 0, 3.4, 1.6]],
    links: [[2, 1, "valenca"]],
    plan: { x: 3, y: 7 },
  },
  {
    key: "quarto_casal",
    name: SANTA_AMALIA + "Quarto do Casal",
    description:
      "O quarto do casal: a cama grande com o edredom verde e a manta vinho, os dois criados-mudos com os abajures, o guarda-roupa de madeira, a cômoda. Do lado do Augusto, a pilha de cadernos e o copo de água; do outro lado, o travesseiro intocado.",
    layout: planTop(7, 6, 3),
    andar: VALENCA,
    style: "taco",
    ...DENTRO,
    darkness: 0.42,
    floor: [
      ["portal", 3, 1, 4],
      ["cama_casal", 2, 4, 0],
      ["nightstand", 1, 6, 0],
      ["nightstand", 4, 6, 0],
      ["desk_lamp", 1, 6, 0],
      ["books_stack", 4, 6, 0, oculta("Os diários", "Os cadernos do Augusto e o diário da esposa. Datas, nomes de remédio, o horário em que a filha acordou gritando, e a mesma pergunta repetida: \"para onde elas olham?\". No último caderno, um mapa à mão da mata atrás da casa, com o caminho riscado e refeito várias vezes.")],
      ["guarda_roupa", 6, 2, 6],
      ["comoda", 0, 2, 2],
      ["rug_worn", 3, 3, 0],
      ...lampadas([3, 3]),
    ],
    wall: [
      ["janela_vidro", "r", 1, 2.0, 1.4],
      ["painting", "l", 0, 4.4, 2.4],
    ],
    links: [[3, 1, "valenca"]],
    plan: { x: 8, y: 7 },
  },
  {
    key: "quarto_filha",
    name: SANTA_AMALIA + "Quarto da Filha",
    description:
      "O quarto da menina: a cama de solteiro com a colcha lilás, a escrivaninha, o pufe, o tapete. Em todo lugar, folhas de papel com a mesma espiral preta, riscada até furar a folha: no chão, na cama, coladas com fita nas paredes, uma por cima da outra. Há marcas de lápis no rodapé e no batente da porta.",
    layout: planLeft(8, 6, 3),
    andar: VALENCA,
    style: "taco",
    ...DENTRO,
    darkness: 0.48,
    ambient: "#d8c8d8",
    floor: [
      ["portal", 1, 3, 2],
      ["cama_solteiro", 6, 0, 4],
      ["nightstand", 8, 3, 6],
      ["desk_lamp", 8, 3, 0],
      ["desk_wood", 2, 0, 4],
      ["chair_wood", 3, 1, 0],
      ["desenhos_espiral", 2, 0, 0],
      ["pufe", 5, 4, 0],
      ["rug_purple", 4, 2, 0],
      ...de("desenhos_espiral", [3, 2], [5, 1], [6, 3], [2, 4], [7, 5], [4, 5], [5, 3]),
      ["desenhos_espiral", 6, 2, 0, hint("Os desenhos", "Centenas de folhas, todas com a mesma espiral, desenhada do mesmo jeito: de fora para dentro, sempre no sentido do relógio. Algumas têm o centro furado de tanto passar o lápis.")],
      ["lodo_preto", 7, 4, 0, oculta("Manchas no lençol", "No travesseiro e no lençol, manchas de uma pasta preta e grossa. Saiu da boca e dos olhos dela, à noite. O Augusto troca a roupa de cama todo dia.")],
      ...lampadas([5, 3]),
    ],
    wall: [
      ["desenho_espiral_parede", "r", 0, 2.6, 1.6],
      ["desenho_espiral_parede", "r", 0, 5.4, 1.9],
      ["desenho_espiral_parede", "l", 1, 1.6, 1.7],
      ["desenho_espiral_parede", "l", 1, 4.9, 1.5],
    ],
    links: [[1, 3, "valenca"]],
    plan: { x: 16, y: 0 },
  },

  // ------------------------------------------------------------ o Posto de Saúde (a porta para o fundo)
  {
    key: "posto",
    name: SANTA_AMALIA + "Recepção do Posto",
    description:
      "A recepção do Posto de Saúde Municipal: o piso de granilite, as fileiras de cadeiras azuis de plástico, o balcão de atendimento com o computador e a pilha de fichas, o bebedouro de galão, o mural de avisos com as campanhas de vacina. Atrás do balcão, a Sônia, a recepcionista. As portas dos consultórios ficam na frente; o banheiro à esquerda; a sala administrativa e a farmácia à direita.",
    layout: planTop(14, 8, 7),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 7, 1, 4],
      ["portal", 0, 3, 2],
      ["portal", 13, 3, 6],
      ["portal", 13, 6, 6],
      ["portal", 2, 8, 0],
      ["portal", 6, 8, 0],
      ["portal", 10, 8, 0],
      // o balcão e a Sônia atrás dele
      ["balcao_recepcao", 5, 5, 4],
      ["chair_office", 6, 6, 4],
      ["papers", 5, 5, 0, hint("Fichas de atendimento", "A pilha de fichas do dia, presa com um clipe. A Sônia anota tudo à mão antes de passar para o computador.")],
      // as cadeiras de espera, viradas para o balcão
      ["cadeira_espera", 5, 2, 0],
      ["cadeira_espera", 5, 3, 0],
      ["cadeira_espera", 1, 4, 2],
      ["water_cooler", 12, 1, 0],
      ["trash_can", 11, 1, 0],
      ["plant", 1, 1, 0],
      ["plant", 12, 7, 0],
      ...lampadas([3, 3], [10, 3], [9, 6]),
    ],
    wall: [
      ["notice_board", "r", 1, 3.0, 2.0],
      ["clock", "r", 1, 10.6, 2.8],
      ["janela_vidro", "l", 0, 6.4, 1.4],
    ],
    links: [
      [7, 1, "cidade"],
      [0, 3, "banheiro_p"],
      [13, 3, "administracao"],
      [13, 6, "farmacia"],
      [2, 8, "consultorio"],
      [6, 8, "procedimentos"],
      [10, 8, "triagem"],
    ],
    plan: { x: 4, y: 0 },
  },
  {
    key: "consultorio",
    name: SANTA_AMALIA + "Consultório",
    description: "O consultório: a maca com o papel lençol, a mesa do médico com o computador e as duas cadeiras, a pia, o armário de remédios. O estetoscópio esquecido em cima do receituário.",
    layout: planTop(6, 6, 3),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 3, 1, 4],
      ["maca_exame", 0, 3, 0],
      ["desk_metal", 3, 4, 0],
      ["monitor", 3, 4, 0],
      ["chair_office", 4, 5, 0],
      ["chair_wood", 3, 3, 4],
      ["sink", 5, 2, 0],
      ["medical_cabinet", 4, 6, 0],
      ["trash_bin", 0, 6, 0],
      ...lampadas([2, 3]),
    ],
    wall: [["janela_vidro", "l", 0, 4.4, 1.4]],
    links: [[3, 1, "posto"]],
    plan: { x: 0, y: 9 },
  },
  {
    key: "procedimentos",
    name: SANTA_AMALIA + "Sala de Procedimentos",
    description: "A sala de procedimentos: a maca, o suporte de soro, o carrinho com as bandejas de curativo, a pia de inox e a lixeira de pedal. Cheiro de álcool.",
    layout: planTop(6, 6, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 2, 1, 4],
      ["maca_exame", 4, 3, 0],
      ["iv_stand", 5, 2, 0],
      ["trolley", 2, 4, 0],
      ["sink", 0, 3, 0],
      ["medical_cabinet", 0, 6, 0],
      ["trash_bin", 5, 6, 0],
      ...lampadas([3, 4]),
    ],
    wall: [],
    links: [[2, 1, "posto"]],
    plan: { x: 6, y: 9 },
  },
  {
    key: "triagem",
    name: SANTA_AMALIA + "Triagem",
    description: "A sala da triagem: a mesinha com o aparelho de pressão, o computador, a cadeira do paciente e a balança. O termômetro numa caneca.",
    layout: planTop(5, 5, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 2, 1, 4],
      ["desk_metal", 0, 3, 0],
      ["monitor", 0, 3, 0],
      ["chair_office", 0, 4, 0],
      ["chair_wood", 2, 3, 4],
      ["vitals_monitor", 4, 2, 0],
      ["mug", 1, 3, 0],
      ...lampadas([3, 4]),
    ],
    wall: [],
    links: [[2, 1, "posto"]],
    plan: { x: 12, y: 9 },
  },
  {
    key: "farmacia",
    name: SANTA_AMALIA + "Farmácia do Posto",
    description: "A farmacinha do posto: as estantes de aço cheias de caixas de remédio, o armário trancado dos controlados, a mesa com o caderno de saída e as caixas de papelão ainda fechadas.",
    layout: planLeft(6, 5, 2),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 2, 2],
      ["estante_remedios", 2, 0, 4],
      ["estante_remedios", 4, 0, 4],
      ["medical_cabinet", 5, 3, 6],
      ["desk_metal", 2, 4, 0],
      ["papers", 2, 4, 0],
      ["crate_wood", 6, 4, 0],
      ...lampadas([3, 2]),
    ],
    wall: [],
    links: [[1, 2, "posto"]],
    plan: { x: 18, y: 4 },
  },
  {
    key: "banheiro_p",
    name: SANTA_AMALIA + "Banheiro do Posto",
    description: "O banheiro do posto: o vaso, a pia, o porta-papel, o ralo e o cheiro de desinfetante.",
    layout: planRight(4, 4, 2),
    andar: POSTO,
    style: "azulejo",
    ...REPARTICAO,
    floor: [
      ["portal", 3, 2, 6],
      ["toilet", 0, 0, 4],
      ["sink", 0, 3, 0],
      ["trash_bin", 2, 0, 0],
      ...lampadas([1, 2]),
    ],
    wall: [["towel_dispenser", "l", 0, 2.4, 1.5]],
    links: [[3, 2, "posto"]],
    plan: { x: 0, y: 2 },
  },
  {
    key: "administracao",
    name: SANTA_AMALIA + "Administração do Posto",
    description:
      "A sala administrativa: a mesa com o computador e a impressora, os arquivos de aço com os cadastros dos profissionais e os prontuários, a estante de caixas-arquivo. A Sônia não deixa ninguém entrar sem autorização da Secretaria de Saúde.",
    layout: planLeft(7, 6, 3),
    andar: POSTO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 3, 2],
      ["desk_metal", 3, 2, 4],
      ["monitor", 3, 2, 0],
      ["printer_dot", 4, 2, 0],
      ["chair_office", 3, 1, 4],
      ["cabinet_file", 7, 0, 4],
      ["cabinet_file", 7, 1, 6],
      ["cabinet_file", 7, 2, 6, oculta("Cadastro de profissionais", "Na pasta dos médicos que atenderam na zona rural: Herman Arantes, vínculo de 1998 a 2004. A foto 3x4 tem algo errado no olhar. A rubrica é sempre a mesma: \"Bye\".")],
      ["estante_arquivo", 2, 5, 0],
      ["papers", 5, 4, 0, oculta("Extrato de atendimentos", "Um relatório de atendimentos impresso. Há registros assinados com a mesma rubrica \"Bye\" em datas recentes, embora o vínculo do médico tenha acabado em 2004.")],
      ...lampadas([4, 3]),
    ],
    wall: [["notes_wall", "r", 0, 2.6, 2.0]],
    links: [[1, 3, "posto"]],
    plan: { x: 18, y: -2 },
  },

  // ------------------------------------------------------------ o Cartório (a porta para a frente)
  {
    key: "cartorio",
    name: SANTA_AMALIA + "Atendimento do Cartório",
    description:
      "O atendimento do Cartório de Registro de Imóveis: o piso de granito, as duas fileiras de cadeiras pretas de espera, o balcão comprido com os dois guichês, os computadores e as pilhas de pastas, o carimbo e a campainha. A Lívia, a escrevente, atende com calma e pede para preencher o requerimento. Ao fundo, a sala do oficial, o arquivo e o depósito; à direita, o banheiro e a copa.",
    layout: planBottom(14, 8, 7),
    andar: CARTORIO,
    style: "pedra",
    ...REPARTICAO,
    floor: [
      ["portal", 7, 7, 0],
      ["portal", 2, 0, 4],
      ["portal", 7, 0, 4],
      ["portal", 11, 0, 4],
      ["portal", 13, 3, 6],
      ["portal", 13, 5, 6],
      // o balcão dos guichês e os escreventes atrás dele
      ["balcao_recepcao", 3, 2, 4],
      ["balcao_recepcao", 8, 2, 4],
      ["chair_office", 4, 1, 4],
      ["chair_office", 9, 1, 4],
      ["papers", 3, 2, 0, hint("Requerimento", "O formulário de pesquisa de imóveis: em nome de quem, de qual época, por qual tipo de ato. A Lívia explica que procurar só pelo nome do dono nem sempre acha.")],
      // as cadeiras de espera (viradas para o balcão)
      ["cadeira_espera", 1, 5, 4],
      ["cadeira_espera", 9, 5, 4],
      ["water_cooler", 12, 6, 0],
      ["plant", 0, 6, 0],
      ["plant", 13, 1, 0],
      ...lampadas([4, 4], [10, 4]),
    ],
    wall: [
      ["notice_board", "l", 0, 4.6, 2.0],
      ["clock", "r", 0, 6.0, 2.8],
      ["painting", "r", 0, 1.2, 2.4],
    ],
    links: [
      [7, 7, "cidade"],
      [2, 0, "oficial"],
      [7, 0, "arquivo"],
      [11, 0, "deposito"],
      [13, 3, "banheiro_c"],
      [13, 5, "copa"],
    ],
    plan: { x: 4, y: 8 },
  },
  {
    key: "oficial",
    name: SANTA_AMALIA + "Sala do Oficial",
    description: "A sala do oficial do registro: a mesa grande de madeira com o computador e o carimbo, a cadeira de couro, as duas cadeiras de visita, o tapete persa gasto, os diplomas na parede, o cofre e o arquivo.",
    layout: planBottom(7, 6, 3),
    andar: CARTORIO,
    style: "taco",
    ...REPARTICAO,
    ambient: "#e8d8b8",
    floor: [
      ["portal", 3, 5, 0],
      ["rug_ornate", 2, 2, 0],
      ["desk_wood", 2, 2, 4],
      ["monitor", 2, 2, 0],
      ["chair_verissimo", 3, 1, 4],
      ["chair_wood", 2, 3, 0],
      ["chair_wood", 3, 3, 0],
      ["bookshelf", 4, 0, 4],
      ["cabinet_file", 0, 0, 4],
      ["plant", 6, 0, 0],
      ["plant", 0, 4, 0],
      ...lampadas([5, 3]),
    ],
    wall: [
      ["painting", "r", 0, 1.6, 2.3],
      ["quadro_fazenda~03", "r", 0, 4.0, 2.3],
      ["janela_vidro", "l", 0, 2.4, 1.4],
    ],
    links: [[3, 5, "cartorio"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "arquivo",
    name: SANTA_AMALIA + "Arquivo do Cartório",
    description:
      "O arquivo: as estantes de aço até o teto com as caixas e os livros de registro por ano, a mesa comprida de pesquisa com a lupa e as pastas abertas, o carrinho de livros e a escadinha. Poeira de papel no ar.",
    layout: planBottom(9, 6, 4),
    andar: CARTORIO,
    style: "concreto",
    ...REPARTICAO,
    darkness: 0.34,
    floor: [
      ["portal", 4, 5, 0],
      ["estante_arquivo", 0, 0, 4],
      ["estante_arquivo", 2, 0, 4],
      ["estante_arquivo", 4, 0, 4],
      ["estante_arquivo", 6, 0, 4],
      ["table_meeting", 3, 2, 4],
      ["chair_wood", 3, 4, 0],
      ["chair_wood", 4, 4, 0],
      ["papers", 3, 2, 0, oculta("Índice de 2003", "O livro índice dos atos de 2003. Procurado pelo nome de Herman Arantes como dono, não aparece. Como procurador, aparece: representando as Indústrias Panacea S.A.")],
      ["books_stack", 4, 2, 0, oculta("Matrícula 1.847", "O registro de 18/06/2003: a Gleba Rural nº 12, com 186,40 hectares, comprada pelas Indústrias Panacea. A descrição fala em \"acesso existente\", sem dizer qual. Na averbação AV-2, de 17/08/2021, a área confere, mas o acesso registrado antes não foi identificado.")],
      ["trolley", 8, 3, 0],
      ...lampadas([4, 3]),
    ],
    wall: [],
    links: [[4, 5, "cartorio"]],
    plan: { x: 7, y: 0 },
  },
  {
    key: "deposito",
    name: SANTA_AMALIA + "Depósito do Cartório",
    description: "O depósito: os arquivos de aço verdes de quatro gavetas, as caixas de papelão empilhadas, os rolos de planta amarrados com barbante e os livros antigos de capa de couro.",
    layout: planBottom(6, 6, 2),
    andar: CARTORIO,
    style: "concreto",
    ...REPARTICAO,
    darkness: 0.44,
    floor: [
      ["portal", 2, 5, 0],
      ["cabinet_file", 5, 1, 6],
      ["cabinet_file", 5, 2, 6],
      ["cabinet_file", 5, 3, 6],
      ["estante_arquivo", 0, 0, 4],
      ["crate_wood", 3, 0, 0],
      ["crate_wood", 4, 0, 0],
      ["crate_wood", 0, 3, 0],
      ["books_stack", 0, 4, 0],
      ...lampadas([2, 2]),
    ],
    wall: [],
    links: [[2, 5, "cartorio"]],
    plan: { x: 16, y: 0 },
  },
  {
    key: "banheiro_c",
    name: SANTA_AMALIA + "Banheiro do Cartório",
    description: "O banheiro: o vaso, a pia, o espelho e o cheiro de lavanda barata.",
    layout: planLeft(4, 4, 2),
    andar: CARTORIO,
    style: "azulejo",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 2, 2],
      ["toilet", 4, 0, 4],
      ["sink", 4, 3, 6],
      ...lampadas([2, 2]),
    ],
    wall: [["mirror", "r", 0, 3.4, 1.6]],
    links: [[1, 2, "cartorio"]],
    plan: { x: 18, y: 8 },
  },
  {
    key: "copa",
    name: SANTA_AMALIA + "Copa do Cartório",
    description: "A copa: o balcão com a garrafa de café, os copinhos de plástico e o açucareiro, o frigobar e a lixeira.",
    layout: planLeft(4, 4, 1),
    andar: CARTORIO,
    style: "ladrilho",
    ...REPARTICAO,
    floor: [
      ["portal", 1, 1, 2],
      ["counter_wood", 3, 0, 4],
      ["cafeteira", 3, 0, 0],
      ["mug", 4, 0, 0],
      ["minibar", 4, 3, 4],
      ["trash_bin", 2, 3, 0],
      ...lampadas([2, 2]),
    ],
    wall: [],
    links: [[1, 1, "cartorio"]],
    plan: { x: 18, y: 12 },
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
