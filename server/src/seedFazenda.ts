import {
  getFurni,
  parseHeightmap,
  RoomMap,
  type Door,
  type FloorStyle,
  type Hint,
  type LightMode,
  type ParticleKind,
} from "@crona/shared";
import type { Database, RoomData } from "./db";
import { buildRoom, plan, type FloorSeed, type WallSeed } from "./seed";
import { partyTokens, planTop } from "./seedSede";

/**
 * Fazenda Olhos de Águia, a primeira missão grande: o mundo aberto da fazenda (anda-se
 * livre entre o casarão, a casa de mantimentos, o celeiro, as plantações e o lago), o
 * interior de cada prédio (o casarão com os dois andares) e os arredores, para onde se
 * sai pela porteira. As plantas que serviram de base ficam só neste computador.
 *
 * Primeiro funcionar, depois deixar bonito: os prédios, a cerca, as árvores e o chão
 * de fora são desenhados em código até a arte chegar.
 *
 * Cada cômodo é uma cena (como na Sede). A porta principal de cada um fica numa parede
 * do fundo (as da frente não aparecem); na planta o cômodo é girado de volta (`plan.r`).
 */

export const FAZENDA = "Fazenda · ";
/** Versão da montagem da fazenda: subiu, ela é refeita no lugar (mesmas cenas, peças e registro). */
export const FAZENDA_REV = 11;

const hint = (title: string, text: string): Hint => ({
  icon: "inspect",
  title,
  text,
  visible: true,
});
/** Pista que só o mestre vê até mostrar (o calabouço é para ser descoberto). */
const oculta = (title: string, text: string): Hint => ({
  ...hint(title, text),
  visible: false,
});

// ------------------------------------------------------------------ terreno

/** Chão ao ar livre casa por casa (letras de TERRENOS); a água vira casa vazia na planta. */
class Terreno {
  readonly g: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill("."));
  }
  put(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
  }
  at(x: number, y: number) {
    return this.g[y]?.[x] ?? "";
  }
  ret(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) this.put(x, y, c);
  }
  /** elipse: as casas com o meio dentro dela */
  disco(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1)
          this.put(x, y, c);
  }
  /** caminho pelos pontos, com a largura em casas */
  linha(pts: [number, number][], c: string, larg = 2) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n =
        Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4) + 1;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const y = y0 + ((y1 - y0) * k) / n;
        for (let dy = 0; dy < larg; dy++)
          for (let dx = 0; dx < larg; dx++)
            this.put(
              Math.floor(x + dx - larg / 2 + 0.5),
              Math.floor(y + dy - larg / 2 + 0.5),
              c,
            );
      }
    }
  }
  /** a volta: a borda (larg casas) de um retângulo de cantos redondos */
  volta(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    c: string,
    larg = 2,
  ) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const qx = Math.max(x0 + r - px, 0, px - (x1 - r));
        const qy = Math.max(y0 + r - py, 0, py - (y1 - r));
        if (Math.hypot(qx, qy) > r) continue;
        const borda =
          qx > 0 && qy > 0
            ? r - Math.hypot(qx, qy)
            : Math.min(px - x0, x1 - px, py - y0, y1 - py);
        if (borda <= larg) this.put(x, y, c);
      }
  }
  texto() {
    return this.g.map((r) => r.join("")).join("\n");
  }
  /** a planta: chão em tudo, menos na água */
  planta() {
    return this.g
      .map((r) => r.map((c) => (c === "a" ? "x" : "0")).join(""))
      .join("\n");
  }
}

/** Mobi que só entra em casa de grama (árvore, arbusto): a lista pode ser generosa. */
const naGrama = (t: Terreno, list: FloorSeed[]): FloorSeed[] =>
  list.filter(([, x, y]) => t.at(x, y) === ".");
const arvores = (t: Terreno, ...at: [number, number][]) =>
  naGrama(
    t,
    at.map(([x, y]) => ["arvore", x, y, 0] as FloorSeed),
  );
const arbustos = (t: Terreno, ...at: [number, number][]) =>
  naGrama(
    t,
    at.map(([x, y]) => ["arbusto", x, y, 0] as FloorSeed),
  );
/** Cerca correndo em x (de x0 a x1, na linha y), pulando as casas de `pula`. */
const cercaX = (
  y: number,
  x0: number,
  x1: number,
  pula: number[] = [],
  id = "cerca",
): FloorSeed[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i)
    .filter((x) => !pula.includes(x))
    .map((x) => [id, x, y, 4] as FloorSeed);
/** Cerca correndo em y (de y0 a y1, na coluna x). */
const cercaY = (
  x: number,
  y0: number,
  y1: number,
  pula: number[] = [],
  id = "cerca",
): FloorSeed[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
    .filter((y) => !pula.includes(y))
    .map((y) => [id, x, y, 2] as FloorSeed);
const lamps = (...at: [number, number][]): FloorSeed[] =>
  at.map(([x, y]) => ["ceiling_lamp", x, y, 0] as FloorSeed);
const de = (id: string, ...at: [number, number][]): FloorSeed[] =>
  at.map(([x, y]) => [id, x, y, 0] as FloorSeed);

// ------------------------------------------------------------------ a fazenda (de fora)

/** As leiras das plantações: [x0, y0, x1, y1]. */
const LEIRAS: [number, number, number, number][] = [
  [40, 15, 45, 21],
  [47, 15, 53, 21],
  [57, 15, 62, 21],
  [64, 15, 69, 21],
  [40, 24, 45, 32],
  [47, 24, 53, 32],
  [57, 24, 62, 32],
  [64, 24, 69, 32],
];

function terrenoFazenda(): Terreno {
  const t = new Terreno(72, 36);
  // a volta em redor do casarão e a estrada que vem da porteira
  t.volta(9, 6, 33, 28, 5, "t");
  t.ret(0, 18, 10, 20, "t");
  // o pátio de pedra da fonte, na frente do casarão
  t.disco(20.5, 23.5, 4.2, 3.4, "p");
  t.ret(19, 18, 20, 21, "t");
  // para o celeiro, passando a cerca do meio; a estrada das plantações e o carreiro entre elas
  t.ret(32, 10, 58, 11, "t");
  t.ret(38, 12, 70, 13, "t");
  t.ret(55, 14, 55, 34, "t");
  for (const [x0, y0, x1, y1] of LEIRAS) t.ret(x0, y0, x1, y1, "l");
  // o lago e o píer de madeira
  t.disco(30.5, 31.5, 4.6, 2.7, "a");
  t.ret(29, 28, 30, 29, "m");
  return t;
}
const T_FAZENDA = terrenoFazenda();

/** Milharal e canteiros: uma fileira a cada duas linhas da leira. */
function plantacoes(): FloorSeed[] {
  const out: FloorSeed[] = [];
  const fileiras = (
    id: string,
    [x0, y0, x1, y1]: [number, number, number, number],
    desde: number,
  ) => {
    for (let y = y0 + desde; y <= y1; y += 2)
      for (let x = x0; x <= x1; x++) out.push([id, x, y, 4]);
  };
  fileiras("milharal", LEIRAS[1], 0);
  fileiras("horta", LEIRAS[2], 1);
  fileiras("horta", LEIRAS[4], 1);
  fileiras("milharal", LEIRAS[6], 0);
  return out;
}

const FAZENDA_FORA: FloorSeed[] = [
  // os prédios (a porta de cada um é uma Entrada na frente dela)
  ["casarao", 13, 9, 4],
  ["galpao", 27, 1, 4],
  ["celeiro", 46, 1, 4],
  ["entrada", 19, 18, 0],
  ["entrada", 20, 18, 0],
  ["entrada", 30, 7, 0],
  ["entrada", 31, 7, 0],
  ["entrada", 51, 9, 0],
  ["entrada", 52, 9, 0],
  // a porteira (aberta) e a cerca em volta de tudo; a do meio separa a casa das plantações
  ["porteira", 0, 18, 2, undefined, 1],
  ...cercaX(0, 0, 71),
  ...cercaX(35, 0, 71),
  ...cercaY(0, 1, 34, [18, 19, 20]),
  ...cercaY(71, 1, 34),
  ...cercaY(37, 1, 34, [10, 11, 12, 13]),
  [
    "placa",
    3,
    16,
    2,
    hint(
      "Fazenda Olhos de Águia",
      "A placa de madeira, com o nome pintado à mão. A tinta descasca embaixo do olho de águia desenhado.",
    ),
  ],
  // a fonte do pátio e os arbustos da frente do casarão
  ["fonte", 19, 22, 0],
  ...arbustos(
    T_FAZENDA,
    [14, 18],
    [16, 18],
    [23, 18],
    [25, 18],
    [17, 21],
    [23, 21],
    [16, 26],
    [25, 26],
  ),
  // perto do celeiro: o feno e a carroça
  ["feno", 44, 6, 2],
  ["feno", 44, 7, 2],
  ["feno", 44, 7, 2],
  ["feno", 45, 7, 2],
  ["carroca", 59, 3, 6],
  ...plantacoes(),
  // árvores: o cinturão de mata junto da cerca e as do terreiro
  ...arvores(
    T_FAZENDA,
    [2, 2],
    [5, 1],
    [8, 2],
    [11, 1],
    [14, 2],
    [17, 1],
    [20, 2],
    [23, 1],
    [25, 3],
    [36, 2],
    [39, 1],
    [42, 2],
    [44, 4],
    [59, 7],
    [62, 1],
    [65, 2],
    [68, 1],
    [70, 4],
    [1, 4],
    [2, 7],
    [1, 11],
    [2, 14],
    [1, 23],
    [2, 26],
    [1, 29],
    [2, 32],
    [70, 7],
    [69, 10],
    [70, 16],
    [70, 20],
    [70, 24],
    [70, 28],
    [70, 32],
    [4, 34],
    [7, 33],
    [11, 34],
    [15, 33],
    [19, 34],
    [23, 33],
    [38, 34],
    [41, 34],
    [46, 34],
    [51, 34],
    [59, 34],
    [63, 34],
    [67, 34],
    [5, 24],
    [6, 29],
    [13, 30],
    [17, 32],
    [36, 22],
    [35, 27],
    [34, 16],
    [29, 9],
    [12, 22],
    [27, 21],
    [28, 24],
    [8, 15],
    [6, 11],
    [24, 31],
    [4, 4],
    [35, 6],
  ),
];

// ------------------------------------------------------------------ os arredores

function terrenoArredores(): Terreno {
  const t = new Terreno(48, 30);
  // o rio de cima a baixo, a estrada de terra da porteira (direita) para Santo Berço (esquerda) e a ponte
  t.linha(
    [
      [27, 0],
      [26, 6],
      [24, 11],
      [25, 18],
      [23, 24],
      [24, 29],
    ],
    "a",
    3,
  );
  t.ret(0, 14, 47, 15, "t");
  t.ret(22, 13, 27, 16, "m");
  // a trilha da mata (em cima à esquerda) e a estrada da rodovia (embaixo)
  t.linha(
    [
      [12, 14],
      [11, 9],
      [8, 4],
      [7, 1],
    ],
    "d",
    1,
  );
  t.ret(36, 16, 37, 29, "t");
  // as roças dos vizinhos
  t.ret(31, 3, 39, 9, "l");
  t.ret(4, 19, 12, 25, "l");
  return t;
}
const T_ARREDORES = terrenoArredores();

const ARREDORES: FloorSeed[] = [
  ["porteira", 47, 13, 6, undefined, 1],
  [
    "placa",
    44,
    12,
    6,
    hint(
      "Fazenda Olhos de Águia",
      "A porteira da fazenda, aberta. O caminho de terra sobe até o casarão.",
    ),
  ],
  [
    "placa",
    13,
    12,
    4,
    hint(
      "Encruzilhada",
      "Para a esquerda, Santo Berço. Para cima, a trilha da mata. Para a direita, a fazenda.",
    ),
  ],
  [
    "placa",
    35,
    17,
    2,
    hint("Rodovia", "A estrada desce até a rodovia. (Ainda não montada.)"),
  ],
  [
    "placa",
    2,
    12,
    2,
    hint(
      "Santo Berço",
      "A cidadezinha fica logo depois da curva. (Ainda não montada.)",
    ),
  ],
  [
    "placa",
    8,
    3,
    2,
    hint(
      "Mata fechada",
      "A trilha some entre as árvores. (Ainda não montada.)",
    ),
  ],
  // o guarda-corpo da ponte
  ...cercaX(13, 22, 27),
  ...cercaX(16, 22, 27),
  // a cerca das roças
  ...cercaX(2, 30, 40),
  ...cercaX(10, 30, 40, [35]),
  ...cercaY(30, 3, 9),
  ...cercaY(40, 3, 9),
  ...cercaX(18, 3, 13),
  ...cercaX(26, 3, 13, [8]),
  ...plantacoesArredores(),
  ...arbustos(
    T_ARREDORES,
    [3, 13],
    [9, 16],
    [16, 13],
    [19, 16],
    [30, 13],
    [33, 16],
    [41, 13],
    [44, 16],
    [20, 20],
    [29, 22],
  ),
  ...arvores(
    T_ARREDORES,
    // a mata, em cima à esquerda
    [1, 1],
    [3, 2],
    [5, 4],
    [2, 5],
    [4, 7],
    [1, 8],
    [6, 9],
    [10, 2],
    [12, 4],
    [14, 1],
    [15, 6],
    [13, 8],
    [9, 7],
    [3, 10],
    [17, 3],
    [18, 8],
    [16, 10],
    [11, 11],
    // à beira do rio e espalhadas
    [21, 3],
    [29, 2],
    [22, 8],
    [28, 10],
    [20, 18],
    [28, 19],
    [21, 26],
    [27, 26],
    [42, 4],
    [45, 8],
    [44, 20],
    [41, 24],
    [46, 27],
    [32, 21],
    [31, 26],
    [15, 21],
    [17, 27],
    [2, 27],
    [7, 28],
    [42, 1],
  ),
];

function plantacoesArredores(): FloorSeed[] {
  const out: FloorSeed[] = [];
  for (let y = 4; y <= 9; y += 2)
    for (let x = 31; x <= 39; x++) out.push(["milharal", x, y, 4]);
  for (let y = 20; y <= 25; y += 2)
    for (let x = 4; x <= 12; x++) out.push(["horta", x, y, 4]);
  return out;
}

// ------------------------------------------------------------------ as cenas

interface CenaSpec {
  key: string;
  name: string;
  description: string;
  layout: { heightmap: string; door: Door };
  andar: string;
  style: FloorStyle;
  darkness: number;
  fog?: number;
  light?: LightMode;
  aberto?: boolean;
  terreno?: string;
  ambient?: string;
  particles?: ParticleKind[];
  floor: FloorSeed[];
  wall?: WallSeed[];
  /** passagens: [x, y, chave da cena de destino] */
  links: [number, number, string][];
  /** na planta do andar: onde fica o canto de cima à esquerda do cômodo (sem o vão da porta) e o giro */
  plan: { x: number; y: number; r?: number };
  /** peças que começam aqui: [x, y, direção] de cada agente */
  grupo?: [number, number, number][];
}

/** Ao ar livre: a planta inteira do terreno e a "porta" (onde nasce quem chega sem passagem) dentro dela. */
const aoArLivre = (t: Terreno, porta: Door) => ({
  heightmap: t.planta(),
  door: porta,
});

const CASA = "Casarão";
const CASA2 = "Casarão 2º";
const GALPOES = "Galpões";
const CALABOUCO = "Calabouço";

/**
 * O calabouço embaixo do celeiro: 16×14 de pedra. Desce-se pela escada de mão, reta, do
 * alçapão no teto até o chão (no fundo à esquerda); a "porta" é o vão do corredor escuro, no
 * meio da parede do fundo. No meio, o estrado redondo do altar, um degrau acima do chão
 * (altura 1, uns 60 cm).
 */
function calaboucoPlan(): { heightmap: string; door: Door } {
  const W = 16;
  const H = 14;
  const rows = [
    Array.from({ length: W }, (_, x) => (x === 9 ? "0" : "x")).join(""),
  ];
  for (let y = 1; y <= H; y++) {
    let r = "";
    for (let x = 0; x < W; x++)
      r += Math.hypot(x + 0.5 - 9.5, y + 0.5 - 8.5) <= 2.6 ? "1" : "0";
    rows.push(r);
  }
  return { heightmap: rows.join("\n"), door: { x: 9, y: 0, dir: 4 } };
}

const CENAS: CenaSpec[] = [
  // ------------------------------------------------------------ fora
  {
    key: "fazenda",
    name: FAZENDA + "Olhos de Águia",
    description:
      "A fazenda inteira: o casarão no meio da volta de terra, a casa de mantimentos, o celeiro vermelho, as plantações e o lago. Anda-se livre; as portas levam para dentro.",
    layout: aoArLivre(T_FAZENDA, { x: 1, y: 19, dir: 2 }),
    andar: "Fazenda",
    style: "grama",
    aberto: true,
    terreno: T_FAZENDA.texto(),
    darkness: 0.1,
    ambient: "#f2d9a4",
    particles: ["dust"],
    floor: FAZENDA_FORA,
    links: [
      [0, 18, "arredores"],
      [19, 18, "hall"],
      [20, 18, "hall"],
      [30, 7, "mantimentos"],
      [31, 7, "mantimentos"],
      [51, 9, "celeiro"],
      [52, 9, "celeiro"],
    ],
    plan: { x: 0, y: 0 },
    grupo: [
      [3, 18, 2],
      [3, 20, 2],
      [4, 19, 2],
      [2, 19, 2],
    ],
  },
  {
    key: "arredores",
    name: FAZENDA + "Arredores",
    description:
      "O mundo depois da porteira: a estrada de terra, o rio com a ponte, a mata, as roças dos vizinhos e os caminhos para Santo Berço e a rodovia.",
    layout: aoArLivre(T_ARREDORES, { x: 45, y: 14, dir: 6 }),
    andar: "Arredores",
    style: "grama",
    aberto: true,
    terreno: T_ARREDORES.texto(),
    darkness: 0.12,
    ambient: "#f2d9a4",
    particles: ["dust"],
    floor: ARREDORES,
    links: [[47, 13, "fazenda"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ casarão, térreo
  {
    key: "hall",
    name: FAZENDA + "Hall do Casarão",
    description:
      "O hall de entrada, com a escada para o andar de cima e as portas para a cozinha, a sala de jantar, o banheiro, o quarto das crianças e o escritório.",
    layout: planTop(9, 12, 4),
    andar: CASA,
    style: "taco",
    darkness: 0.35,
    ambient: "#c08a50",
    particles: ["dust"],
    floor: [
      ["stairs_up", 4, 1, 4],
      ["portal", 2, 1, 4],
      ["portal", 6, 1, 4],
      ["portal", 0, 2, 2],
      ["portal", 0, 8, 2],
      ["portal", 8, 7, 6],
      ["portal", 3, 12, 0],
      ["portal", 4, 12, 0],
      ["rug_ornate", 3, 6, 0],
      ["table_round", 3, 7, 0],
      ["plant", 3, 7, 0],
      ["bench", 1, 4, 2],
      ["sideboard", 7, 3, 6],
      ["armchair", 1, 10, 2],
      ["plant", 1, 11, 0],
      ["plant", 8, 11, 0],
      ...lamps([4, 5], [4, 9]),
    ],
    wall: [
      ["painting", "r", 1, 7.6, 2.54],
      ["clock", "l", 0, 5.0, 3.45],
      ["sconce", "l", 0, 3.6, 2.9],
      ["sconce", "l", 0, 6.6, 2.9],
    ],
    links: [
      [4, 1, "corredor"],
      [2, 1, "cozinha"],
      [6, 1, "jantar"],
      [0, 2, "banheiro"],
      [0, 8, "criancas"],
      [8, 7, "escritorio"],
      [3, 12, "fazenda"],
      [4, 12, "fazenda"],
    ],
    plan: { x: 9, y: 7 },
  },
  {
    key: "cozinha",
    name: FAZENDA + "Cozinha",
    description:
      "A cozinha de fazenda: fogão a lenha, a pia, os armários e a mesa comprida onde a família come.",
    layout: planTop(14, 7, 2),
    andar: CASA,
    style: "ladrilho",
    darkness: 0.35,
    ambient: "#c08a50",
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 2, 1, 4],
      ["portal", 0, 4, 2],
      ["fogao_lenha", 5, 1, 4, undefined, 1],
      ["pia_cozinha", 8, 1, 4],
      ["armario_cozinha", 11, 1, 4],
      ["armario_cozinha", 0, 1, 2],
      ["barrel", 0, 6, 0],
      ["crate_wood", 0, 7, 0],
      ["mesa_cozinha", 5, 4, 0],
      ["chair_wood", 4, 4, 2],
      ["chair_wood", 4, 5, 2],
      ["chair_wood", 8, 4, 6],
      ["chair_wood", 8, 5, 6],
      ["chair_wood", 6, 6, 0],
      ["mug", 6, 4, 0],
      ["plant", 13, 7, 0],
      ...lamps([6, 3], [10, 5]),
    ],
    wall: [
      ["shelf_wall", "r", 1, 10.5, 2.99],
      ["clock", "l", 0, 6.5, 3.45],
    ],
    links: [
      [2, 1, "hall"],
      [0, 4, "jantar"],
    ],
    plan: { x: 0, y: 0, r: 2 },
  },
  {
    key: "jantar",
    name: FAZENDA + "Sala de Jantar",
    description:
      "A mesa grande de madeira com as cadeiras em volta, o aparador e a cristaleira.",
    layout: plan(7, 14, 1),
    andar: CASA,
    style: "taco",
    darkness: 0.38,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 1, 2],
      ["portal", 4, 0, 4],
      ["mesa_jantar", 3, 5, 2],
      ["candelabra", 3, 6, 0],
      ...[5, 6, 7, 8].map((y): FloorSeed => ["chair_wood", 2, y, 2]),
      ...[5, 6, 7, 8].map((y): FloorSeed => ["chair_wood", 5, y, 6]),
      ["chair_wood", 3, 4, 4],
      ["chair_wood", 4, 9, 0],
      ["sideboard", 7, 3, 6],
      ["armario_cozinha", 1, 10, 2],
      ["plant", 1, 13, 0],
      ["plant", 7, 0, 0],
      ...lamps([6, 4], [6, 9]),
    ],
    wall: [
      ["painting", "l", 1, 7.0, 2.54],
      ["sconce", "l", 1, 4.5, 2.9],
      ["sconce", "l", 1, 9.5, 2.9],
      ["clock", "r", 0, 2.0, 3.45],
    ],
    links: [
      [1, 1, "hall"],
      [4, 0, "cozinha"],
    ],
    plan: { x: 14, y: 0, r: 3 },
  },
  {
    key: "banheiro",
    name: FAZENDA + "Banheiro de Baixo",
    description: "O banheiro do térreo: vaso, pia e o espelho manchado.",
    layout: plan(5, 3, 1),
    andar: CASA,
    style: "xadrez",
    darkness: 0.4,
    floor: [
      ["portal", 1, 1, 2],
      ["toilet", 3, 0, 4],
      ["sink", 5, 0, 4],
      ["plant", 5, 2, 0],
      ...lamps([3, 1]),
    ],
    wall: [["mirror", "r", 0, 5.5, 2.72]],
    links: [[1, 1, "hall"]],
    plan: { x: 0, y: 7, r: 2 },
  },
  {
    key: "criancas",
    name: FAZENDA + "Quarto das Crianças",
    description:
      "Três camas de solteiro lado a lado, os brinquedos num caixote e o tapete gasto.",
    layout: plan(8, 6, 3),
    andar: CASA,
    style: "taco",
    darkness: 0.4,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 3, 2],
      ["cama_solteiro", 3, 0, 4],
      ["cama_solteiro", 5, 0, 4],
      ["cama_solteiro", 7, 0, 4],
      ["nightstand", 4, 0, 4],
      ["nightstand", 6, 0, 4],
      ["rug_worn", 3, 3, 0],
      ["comoda", 8, 3, 6],
      ["crate_wood", 8, 5, 0],
      ...lamps([5, 3]),
    ],
    wall: [["painting", "r", 0, 2.2, 2.63]],
    links: [[1, 3, "hall"]],
    plan: { x: 0, y: 11, r: 2 },
  },
  {
    key: "escritorio",
    name: FAZENDA + "Escritório",
    description:
      "O escritório do dono da fazenda: a escrivaninha, as estantes de livros, o arquivo e a poltrona.",
    layout: plan(9, 8, 4),
    andar: CASA,
    style: "madeira",
    darkness: 0.42,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 4, 2],
      ["desk_wood", 5, 3, 4],
      ["chair_wood", 5, 2, 4],
      ["chair_wood", 6, 4, 0],
      ["desk_lamp", 6, 3, 4],
      ["papers", 5, 3, 4],
      ["bookshelf", 1, 0, 4],
      ["bookshelf", 3, 0, 4],
      ["cabinet_file", 9, 0, 4],
      ["rug_ornate", 4, 5, 2],
      ["armchair", 9, 6, 6],
      ["plant", 9, 7, 0],
      ...lamps([5, 4]),
    ],
    wall: [
      ["painting", "r", 0, 6.5, 2.54],
      ["clock", "l", 1, 2.0, 3.45],
      ["sconce", "l", 1, 6.5, 2.9],
    ],
    links: [[1, 4, "hall"]],
    plan: { x: 18, y: 7 },
  },
  // ------------------------------------------------------------ casarão, 2º andar
  {
    key: "corredor",
    name: FAZENDA + "Corredor de Cima",
    description:
      "O corredor do andar de cima: a escada que desce para o hall e as portas dos quartos e do banheiro.",
    layout: planTop(5, 11, 2),
    andar: CASA2,
    style: "taco",
    darkness: 0.4,
    ambient: "#c08a50",
    particles: ["dust"],
    floor: [
      ["portal", 2, 1, 4],
      ["portal", 0, 2, 2],
      ["portal", 0, 7, 2],
      ["portal", 4, 2, 6],
      ["portal", 4, 7, 6],
      ["escada_desce", 2, 8, 4],
      ["rug_worn", 1, 3, 0],
      ["plant", 0, 11, 0],
      ["plant", 4, 11, 0],
      ...lamps([2, 4]),
    ],
    wall: [
      ["painting", "l", 0, 4.8, 2.54],
      ["clock", "r", 1, 0.8, 3.45],
    ],
    links: [
      [2, 1, "banheiro2"],
      [0, 2, "principal"],
      [0, 7, "quarto2"],
      [4, 2, "quarto1"],
      [4, 7, "quarto3"],
      [2, 8, "hall"],
    ],
    plan: { x: 11, y: 5 },
  },
  {
    key: "principal",
    name: FAZENDA + "Quarto Principal",
    description:
      "O quarto do casal: a cama grande, os criados-mudos, o guarda-roupa e a cômoda.",
    layout: plan(9, 7, 1),
    andar: CASA2,
    style: "taco",
    darkness: 0.42,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 1, 2],
      ["cama_casal", 4, 0, 4],
      ["nightstand", 3, 0, 4],
      ["nightstand", 6, 0, 4],
      ["desk_lamp", 3, 0, 4],
      ["rug_ornate", 3, 3, 2],
      ["guarda_roupa", 8, 0, 4],
      ["comoda", 1, 4, 2],
      ["armchair", 9, 5, 6],
      ["plant", 9, 6, 0],
      ...lamps([5, 4]),
    ],
    wall: [
      ["painting", "r", 0, 2.2, 2.63],
      ["mirror", "l", 1, 4.5, 2.18],
    ],
    links: [[1, 1, "corredor"]],
    plan: { x: 0, y: 0, r: 2 },
  },
  {
    key: "banheiro2",
    name: FAZENDA + "Banheiro de Cima",
    description:
      "O banheiro do andar de cima, com a banheira de pés de bronze.",
    layout: planTop(5, 5, 2),
    andar: CASA2,
    style: "xadrez",
    darkness: 0.4,
    floor: [
      ["portal", 2, 1, 4],
      ["banheira", 0, 3, 4],
      ["toilet", 4, 1, 4],
      ["sink", 3, 1, 4],
      ["plant", 4, 5, 0],
      ...lamps([2, 3]),
    ],
    wall: [["mirror", "r", 1, 3.5, 2.72]],
    links: [[2, 1, "corredor"]],
    plan: { x: 11, y: 0, r: 2 },
  },
  {
    key: "quarto1",
    name: FAZENDA + "Quarto 1",
    description: "Quarto de solteiro, com a escrivaninha perto da janela.",
    layout: plan(8, 6, 4),
    andar: CASA2,
    style: "taco",
    darkness: 0.42,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 4, 2],
      ["cama_solteiro", 6, 0, 4],
      ["nightstand", 5, 0, 4],
      ["rug_worn", 3, 1, 0],
      ["guarda_roupa", 8, 2, 6],
      ["table_small", 8, 5, 0],
      ["chair_wood", 7, 5, 2],
      ...lamps([4, 3]),
    ],
    wall: [["painting", "r", 0, 3.5, 2.63]],
    links: [[1, 4, "corredor"]],
    plan: { x: 16, y: 0 },
  },
  {
    key: "quarto2",
    name: FAZENDA + "Quarto 2",
    description:
      "Quarto de solteiro, a cama de colcha cor-de-rosa e o guarda-roupa.",
    layout: plan(8, 6, 3),
    andar: CASA2,
    style: "taco",
    darkness: 0.42,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 3, 2],
      ["cama_solteiro", 4, 0, 4],
      ["nightstand", 5, 0, 4],
      ["rug_worn", 4, 3, 0],
      ["guarda_roupa", 7, 0, 4],
      ["comoda", 1, 4, 2],
      ...lamps([5, 3]),
    ],
    wall: [["painting", "r", 0, 2.5, 2.63]],
    links: [[1, 3, "corredor"]],
    plan: { x: 0, y: 8, r: 2 },
  },
  {
    key: "quarto3",
    name: FAZENDA + "Quarto 3",
    description: "Quarto de solteiro, a cama de colcha amarela e uma mesinha.",
    layout: plan(8, 6, 2),
    andar: CASA2,
    style: "taco",
    darkness: 0.42,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 2, 2],
      ["cama_solteiro", 6, 0, 4],
      ["nightstand", 7, 0, 4],
      ["rug_worn", 3, 3, 0],
      ["guarda_roupa", 8, 3, 6],
      ["table_small", 8, 5, 0],
      ["chair_wood", 7, 5, 2],
      ...lamps([5, 3]),
    ],
    links: [[1, 2, "corredor"]],
    plan: { x: 16, y: 8 },
  },
  // ------------------------------------------------------------ casa de mantimentos e celeiro
  {
    key: "mantimentos",
    name: FAZENDA + "Casa de Mantimentos",
    description:
      "O depósito da fazenda: caixotes, barris e sacas de grão; o quartinho das ferramentas e o escritório do capataz.",
    layout: planTop(22, 15, 10),
    andar: GALPOES,
    style: "taco",
    darkness: 0.45,
    ambient: "#b88a50",
    particles: ["dust"],
    floor: [
      ["portal", 10, 1, 4],
      // o escritório do capataz (em cima à esquerda) e o das ferramentas (em cima à direita), de meia parede
      ...cercaY(9, 1, 6, [4], "iwall_low"),
      ...cercaX(7, 0, 8, [], "iwall_low"),
      ...cercaY(12, 1, 6, [5], "iwall_low"),
      ...cercaX(7, 13, 21, [], "iwall_low"),
      ["desk_wood", 3, 2, 4],
      ["chair_wood", 3, 1, 4],
      ["papers", 3, 2, 4],
      ["cabinet_file", 0, 1, 2],
      ["bookshelf", 6, 1, 4],
      ["rug_worn", 2, 4, 0],
      ["plant", 8, 1, 0],
      ["table_tools", 15, 2, 4],
      ["crate_wood", 20, 1, 0],
      ["crate_wood", 21, 1, 0],
      ["barrel", 21, 3, 0],
      // as prateleiras e as sacas
      ["prateleira", 0, 9, 2],
      ["prateleira", 0, 11, 2],
      ["prateleira", 0, 13, 2],
      ...de("sacas", [4, 10], [5, 10], [4, 11], [5, 11], [6, 11]),
      ["barrel", 2, 15, 0],
      ["barrel", 3, 15, 0],
      // o depósito: caixotes e barris
      ...de(
        "crate_wood",
        [20, 14],
        [21, 14],
        [21, 13],
        [21, 13],
        [15, 11],
        [16, 11],
        [15, 12],
        [15, 12],
      ),
      ...de("barrel", [18, 15], [19, 15], [17, 12]),
      ...lamps([5, 4], [17, 4], [10, 10], [16, 12], [4, 12]),
    ],
    wall: [
      ["tool_board", "r", 1, 17.0, 1.63],
      ["blade_rack", "r", 1, 19.6, 2.09],
    ],
    links: [[10, 1, "fazenda"]],
    plan: { x: 0, y: 0, r: 2 },
  },
  {
    key: "celeiro",
    name: FAZENDA + "Celeiro",
    description:
      "O celeiro: as três baias de um lado, o feno empilhado, o depósito, as ferramentas e a carroça do outro, e o corredor de terra no meio.",
    layout: planTop(24, 13, 12),
    andar: GALPOES,
    style: "terra",
    darkness: 0.36,
    ambient: "#c89050",
    particles: ["dust"],
    floor: [
      ["portal", 12, 1, 4],
      // as baias (à direita): a frente com as porteirinhas e as divisórias
      ...cercaY(17, 1, 13, [3, 7, 11], "baia"),
      ...cercaX(5, 18, 23, [], "baia"),
      ...cercaX(9, 18, 23, [], "baia"),
      ...de("feno", [22, 2], [22, 6], [22, 10]),
      ...de("barrel", [23, 4], [23, 8], [23, 12]),
      // do outro lado: o feno, o depósito, as ferramentas e a carroça
      ...cercaY(9, 5, 13, [7, 11], "baia"),
      ...cercaX(9, 0, 8, [4], "baia"),
      ...cercaX(5, 0, 8, [6], "baia"),
      // o alçapão do calabouço, escondido embaixo do fardo da quina da pilha, virada para quem olha
      // (vem antes: o feno fica em cima). Empurrado para trás, o fardo deixa a boca à vista e a
      // chegada pelo lado (5, 13) livre
      ["alcapao", 4, 13, 4],
      ...de(
        "feno",
        [0, 12],
        [1, 12],
        [2, 12],
        [3, 12],
        [0, 13],
        [1, 13],
        [2, 13],
        [3, 13],
        [4, 13],
        [0, 12],
        [1, 12],
        [0, 10],
        [1, 10],
        [0, 11],
      ),
      ...de("crate_wood", [0, 6], [0, 7], [0, 6]),
      ...de("barrel", [1, 6], [3, 8]),
      ...de("sacas", [3, 6], [4, 6], [5, 8]),
      ["carroca", 0, 1, 4],
      ["barrel", 8, 1, 0],
      ...lamps([12, 4], [12, 9], [4, 3], [20, 7]),
    ],
    wall: [["tool_board", "r", 1, 6.0, 1.63]],
    links: [
      [12, 1, "fazenda"],
      [4, 13, "calabouco"],
    ],
    plan: { x: 26, y: 0, r: 2 },
  },
  // ------------------------------------------------------------ o calabouço (embaixo do feno do celeiro)
  {
    key: "calabouco",
    name: FAZENDA + "Calabouço",
    description:
      "Embaixo do celeiro, pedra molhada e o cheiro de ferro: de um lado os computadores ligados e os tanques com gente dentro, no meio o altar no estrado redondo, com o círculo de sangue e os crânios, e no fundo um corredor escuro.",
    layout: calaboucoPlan(),
    andar: CALABOUCO,
    style: "calabouco",
    darkness: 0.66,
    fog: 0.25,
    ambient: "#3a8a90",
    particles: ["dust", "smoke"],
    floor: [
      // a escada de mão que sobe reto para o alçapão do celeiro, e a porta do corredor escuro
      ["escada_vertical", 1, 1, 4],
      ["portal", 9, 1, 4],
      // a parede dos computadores (à esquerda), cada estação com a sua cadeira
      ["server_rack", 0, 3, 2],
      [
        "console",
        0,
        4,
        2,
        oculta(
          "Computadores",
          "As telas mostram um corpo por dentro, em camadas, e um contador que não para de subir. Os cabos descem pelo chão até os tanques.",
        ),
      ],
      ["chair_office", 1, 4, 6],
      ["server_rack", 0, 6, 2],
      ["server_rack", 0, 7, 2],
      ["console", 0, 8, 2],
      ["chair_office", 1, 9, 6],
      ["ups", 0, 10, 2],
      ["parts_boxes", 0, 11, 2],
      ["crate_metal", 0, 12, 2],
      ["crate_metal", 0, 12, 2],
      ["crate_metal", 0, 13, 2],
      ["cables_floor", 1, 6, 2],
      // os tanques com os corpos: dois no fundo e um no lado direito (na frente, tampava o estrado)
      [
        "tank",
        4,
        1,
        4,
        oculta(
          "Tanque",
          "No líquido esverdeado boia um homem, ligado por tubos. Os olhos estão abertos.",
        ),
      ],
      [
        "tank",
        12,
        1,
        4,
        oculta(
          "Tanque",
          "Uma mulher encolhida no líquido, com marcas riscadas na pele. O vidro está quente.",
        ),
      ],
      [
        "tank",
        14,
        5,
        6,
        oculta(
          "Tanque",
          "O corpo aqui dentro não é bem de gente: os braços são compridos demais.",
        ),
      ],
      // a mesa de trabalho com os frascos e o monitor dos sinais vitais; o carrinho
      ["table_work", 3, 11, 4],
      ["flasks", 3, 11, 0],
      ["vitals_monitor", 5, 11, 4],
      ["papers", 4, 12, 0],
      ["trolley", 13, 9, 6],
      // o estrado: o círculo de sangue no meio, o altar no fundo, velas e crânios na borda
      ["sigil_floor", 8, 7, 0],
      [
        "altar",
        9,
        6,
        4,
        oculta(
          "Altar",
          "Pedra escura, lisa de tanto uso. O círculo pintado em volta ainda está úmido: é sangue.",
        ),
      ],
      ["blood_pool", 9, 8, 0],
      ["blood_pool", 8, 10, 0],
      ["blood_drops", 10, 10, 0],
      ["candles", 8, 6, 0],
      ["candles", 7, 8, 0],
      ["candles", 11, 8, 0],
      ["candles", 9, 10, 0],
      ["skull", 7, 7, 2],
      ["skull", 11, 7, 6],
      ["skull", 7, 9, 2],
      ["skull", 11, 9, 6],
      ["candelabra", 6, 11, 0],
      ["candelabra", 12, 11, 0],
      // o rastro de sangue até o corredor, as poças e o ralo
      ["blood_drops", 9, 2, 0],
      ["blood_drops", 10, 4, 0],
      ["blood_drops", 9, 5, 0],
      ["puddle", 5, 6, 0],
      ["puddle", 13, 4, 0],
      ["puddle", 3, 8, 0],
      ["puddle", 10, 13, 0],
      ["drain", 7, 13, 0],
    ],
    wall: [
      ["monitor_wall", "l", 0, 6.5, 2.63],
      ["cctv", "l", 0, 1.7, 3.9],
      ["sconce", "l", 0, 11.8, 2.9],
      ["sconce", "r", 1, 7.6, 2.9],
      ["sconce", "r", 1, 11.4, 2.9],
      ["pipes", "r", 1, 6.4, 3.6],
      ["poster_sigil", "r", 1, 14.4, 2.2],
    ],
    links: [
      [1, 1, "celeiro"],
      [9, 1, "corredor_escuro"],
    ],
    plan: { x: 0, y: 14 },
  },
  {
    key: "corredor_escuro",
    name: FAZENDA + "Corredor Escuro",
    description:
      "O corredor do fundo do calabouço: estreito, sem luz, a pedra suando. Um rastro de sangue vai até a porta do fim.",
    layout: planTop(3, 14, 1),
    andar: CALABOUCO,
    style: "calabouco",
    darkness: 0.86,
    fog: 0.45,
    light: "flicker",
    ambient: "#5a1a1a",
    particles: ["dust"],
    floor: [
      ["portal", 1, 1, 4],
      ["portal", 0, 12, 2],
      ["blood_drops", 1, 3, 0],
      ["blood_drops", 2, 5, 0],
      ["blood_drops", 1, 7, 0],
      ["blood_pool", 1, 9, 0],
      ["blood_drops", 0, 11, 0],
      ["puddle", 0, 4, 0],
      ["puddle", 2, 8, 0],
      ["skull", 2, 13, 4],
    ],
    wall: [
      ["sconce", "l", 0, 2.2, 2.9],
      ["chains_wall", "l", 0, 5.5, 1.63],
      ["tally_marks", "l", 0, 8.0, 1.81],
      ["sigil_scratch", "l", 0, 9.8, 1.81],
      ["emergency_light", "l", 0, 11.2, 3.6],
    ],
    links: [
      [1, 1, "calabouco"],
      [0, 12, "sala_sangue"],
    ],
    plan: { x: 8, y: 0, r: 2 },
  },
  {
    key: "sala_sangue",
    name: FAZENDA + "Sala de Sangue",
    description:
      "Uma sala pequena no fim do corredor, e tudo nela é sangue: o chão, as paredes, a mesa de metal no meio, o ralo entupido.",
    layout: plan(6, 5, 2),
    andar: CALABOUCO,
    style: "calabouco",
    darkness: 0.7,
    fog: 0.3,
    light: "flicker",
    ambient: "#c0201a",
    particles: ["dust"],
    floor: [
      ["portal", 1, 2, 2],
      // o sangue vem antes: a mesa fica em cima dele, não o contrário
      ...de(
        "blood_pool",
        [2, 0],
        [3, 1],
        [5, 1],
        [2, 3],
        [4, 3],
        [6, 2],
        [3, 4],
        [5, 4],
        [3, 2],
        [4, 2],
      ),
      ...de("blood_drops", [4, 0], [6, 0], [2, 1], [1, 3], [6, 4], [2, 4]),
      ["drain", 5, 3, 0],
      [
        "desk_metal",
        3,
        2,
        4,
        oculta(
          "Mesa de metal",
          "As correias de couro estão abertas e duras de sangue seco. O sangue escorre da mesa até o ralo entupido.",
        ),
      ],
      ["barrel", 1, 4, 0],
      ["skull", 6, 3, 6],
      ["candles", 6, 0, 0],
    ],
    wall: [
      ["chains_wall", "r", 0, 2.5, 1.63],
      ["cage_lamp", "r", 0, 4.0, 3.9],
      ["sigil_scratch", "r", 0, 5.4, 1.81],
      ["chains_wall", "l", 1, 0.6, 1.63],
      ["chains_wall", "l", 1, 4.2, 1.63],
    ],
    links: [[1, 2, "corredor_escuro"]],
    plan: { x: 11, y: 0 },
  },
];

// ------------------------------------------------------------------ montagem

/** O giro da planta (como na tela MAPA): onde a casa (x, y) do cômodo cai. */
function giraPt(
  w: number,
  h: number,
  r: number,
  x: number,
  y: number,
): [number, number] {
  const k = ((r % 4) + 4) % 4;
  if (k === 1) return [h - 1 - y, x];
  if (k === 2) return [w - 1 - x, h - 1 - y];
  if (k === 3) return [y, w - 1 - x];
  return [x, y];
}

/** Posição na planta: o canto de cima à esquerda do cômodo girado (sem o vão da porta) cai em (plan.x, plan.y). */
function naPlanta(spec: CenaSpec): { x: number; y: number; r?: number } {
  const hm = parseHeightmap(spec.layout.heightmap);
  const r = spec.plan.r ?? 0;
  let mx = Infinity;
  let my = Infinity;
  for (let y = 0; y < hm.height; y++)
    for (let x = 0; x < hm.width; x++) {
      if (
        hm.tiles[y][x] === null ||
        (x === spec.layout.door.x && y === spec.layout.door.y && !spec.aberto)
      )
        continue;
      const [px, py] = giraPt(hm.width, hm.height, r, x, y);
      mx = Math.min(mx, px);
      my = Math.min(my, py);
    }
  return { x: spec.plan.x - mx, y: spec.plan.y - my, ...(r ? { r } : {}) };
}

/** Aplica o andar, o piso, o clima e o ar livre da cena. */
function estilo(room: RoomData, spec: CenaSpec) {
  room.floor = spec.andar;
  room.floorStyle = spec.style;
  room.fog = spec.fog ?? 0;
  room.lightMode = spec.light ?? "normal";
  room.darkness = spec.darkness;
  if (spec.ambient) room.ambient = spec.ambient;
  else delete room.ambient;
  room.particles = spec.particles ?? [];
  if (spec.aberto) room.aberto = true;
  else delete room.aberto;
  if (spec.terreno) room.terreno = spec.terreno;
  else delete room.terreno;
}

/** Liga as passagens de cada cena (porta, escada, entrada, porteira). */
function ligar(built: Map<string, RoomData>) {
  for (const spec of CENAS) {
    const room = built.get(spec.key)!;
    for (const [x, y, to] of spec.links) {
      const target = built.get(to);
      const it = room.items.find(
        (i) => i.x === x && i.y === y && getFurni(i.defId)?.portal,
      );
      if (!it || !target) {
        console.warn(`[seed] ${room.name}: sem passagem em ${x},${y}`);
        continue;
      }
      it.link = target.id;
    }
  }
  // o feno em cima do alçapão do celeiro: sem senha, o clique duplo do mestre empurra e ele aparece
  const celeiro = built.get("celeiro");
  const alcapao = celeiro?.items.find((i) => i.defId === "alcapao");
  const feno = alcapao
    ? celeiro!.items
        .filter(
          (i) => i.defId === "feno" && i.x === alcapao.x && i.y === alcapao.y,
        )
        .pop()
    : undefined;
  if (feno)
    feno.lock = { open: false, slide: { dx: 0, dy: -1 }, semSenha: true };
  else console.warn("[seed] Fazenda: o feno do alçapão não coube");
}

const montar = (db: Database, spec: CenaSpec) =>
  buildRoom(
    db,
    spec.name,
    spec.description,
    spec.layout,
    spec.floor,
    spec.wall ?? [],
    spec.darkness,
  );

/** Monta a fazenda inteira (fora, arredores e os interiores) e a campanha dela. */
export function seedFazenda(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(FAZENDA))) return;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    const room = montar(db, spec);
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  const charIdOf = (name: string) =>
    db.characters.find((c) => c.name.toLowerCase() === name.toLowerCase())
      ?.id ?? null;
  for (const spec of CENAS)
    if (spec.grupo)
      built.get(spec.key)!.tokens = partyTokens(db, charIdOf, spec.grupo);
  db.rooms.push(...built.values());
  const primeira = built.get(CENAS[0].key)!;
  db.campaigns ??= {};
  db.campaigns[String(primeira.id)] = {
    title: "Fazenda Olhos de Águia",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(
      CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)]),
    ),
    log: [],
  };
  db.fazendaRev = FAZENDA_REV;
}

/**
 * Refaz a fazenda no lugar quando a montagem muda (FAZENDA_REV): mesmas cenas (ids),
 * mesmas peças (numa casa livre se a antiga sumiu), mesmo registro. Móveis e planta voltam
 * aos da montagem nova.
 */
export function rebuildFazenda(db: Database): boolean {
  if ((db.fazendaRev ?? 0) >= FAZENDA_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(FAZENDA));
  if (!existing.length) return false;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    let room = existing.find((r) => r.name === spec.name);
    const fresh = montar(db, spec);
    if (room) {
      db.nextRoomId--;
      Object.assign(room, {
        name: fresh.name,
        description: fresh.description,
        heightmap: fresh.heightmap,
        door: fresh.door,
        items: fresh.items,
        wallItems: fresh.wallItems,
      });
    } else {
      room = fresh;
      db.rooms.push(room);
    }
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    const taken = new Set<string>();
    for (const t of room.tokens ?? []) {
      let ok =
        map.walkState(t.x, t.y) === "walk" && !taken.has(`${t.x},${t.y}`);
      for (let r = 1; !ok && r < 8; r++)
        for (let dy = -r; dy <= r && !ok; dy++)
          for (let dx = -r; dx <= r && !ok; dx++) {
            const x = room.door.x + dx;
            const y = room.door.y + dy;
            if (
              map.walkState(x, y) === "walk" &&
              !map.isDoor(x, y) &&
              !taken.has(`${x},${y}`)
            ) {
              t.x = x;
              t.y = y;
              ok = true;
            }
          }
      taken.add(`${t.x},${t.y}`);
    }
  }
  const key = Math.min(...[...built.values()].map((r) => r.id));
  const camp = db.campaigns?.[String(key)];
  if (camp)
    for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  db.fazendaRev = FAZENDA_REV;
  return true;
}

/** Monta a fazenda se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarFazenda(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(FAZENDA))) {
    seedFazenda(db);
    return true;
  }
  return rebuildFazenda(db) || pisosDoCalabouco(db);
}

/**
 * O calabouço ganhou o piso próprio (07/10, `piso-calabouco.png`): troca só o estilo das três cenas dele
 * (era a pedra antiga), sem refazer nada do que o mestre mexeu nelas.
 */
function pisosDoCalabouco(db: Database): boolean {
  let mudou = false;
  for (const spec of CENAS) {
    if (spec.style !== "calabouco") continue;
    const room = db.rooms.find((r) => r.name === spec.name);
    if (room && room.floorStyle === "selo") {
      room.floorStyle = "calabouco";
      mudou = true;
    }
  }
  return mudou;
}
