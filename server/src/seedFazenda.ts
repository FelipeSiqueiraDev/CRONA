import {
  footprint,
  getFurni,
  parseHeightmap,
  PILHA_CHAO,
  RoomMap,
  type Door,
  type FloorStyle,
  type Hint,
  type LightMode,
  type Loot,
  type ParticleKind,
} from "@crona/shared";
import type { Database, RoomData } from "./db";
import { buildRoom, plan, type FloorSeed, type WallSeed } from "./seed";
import { partyTokens, planRight, planTop } from "./seedSede";

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
export const FAZENDA_REV = 38;

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
export class Terreno {
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
  // uma entrada larga por prédio (08/10: eram dois capachos lado a lado)
  ["entrada_larga", 19, 18, 0],
  ["entrada_larga", 30, 7, 0],
  ["entrada_larga", 51, 9, 0],
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

export interface CenaSpec {
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
  /** o quarto (de hotel, de pousada): a condição do descanso de quem dorme nele (LR p. 92) */
  descanso?: RoomData["descanso"];
  /** passagens: [x, y, chave da cena de destino] */
  links: [number, number, string][];
  /** na planta do andar: onde fica o canto de cima à esquerda do cômodo (sem o vão da porta) e o giro */
  plan: { x: number; y: number; r?: number };
  /** peças que começam aqui: [x, y, direção] de cada agente */
  grupo?: [number, number, number][];
  /** itens largados no chão (a pilha "Itens no Chão", que os jogadores pegam): [x, y, nome, espaços, tipo] */
  chao?: [number, number, string, number, Loot["kind"]][];
}

/** Ao ar livre: a planta inteira do terreno e a "porta" (onde nasce quem chega sem passagem) dentro dela. */
const aoArLivre = (t: Terreno, porta: Door) => ({
  heightmap: t.planta(),
  door: porta,
});

/**
 * A Casa de Mantimentos por dentro: a sala grande do depósito (22 × 8) e, na frente, o corredor da entrada (2 casas)
 * entre o escritório do capataz e a sala de utensílios, com o vão da porta na parede da frente.
 */
function mantimentosPlan(): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) rows.push("0".repeat(22));
  for (let y = 8; y < 15; y++) rows.push(Array.from({ length: 22 }, (_, x) => (x === 10 || x === 11 ? "0" : "x")).join(""));
  rows.push(Array.from({ length: 22 }, (_, x) => (x === 11 ? "0" : "x")).join(""));
  return { heightmap: rows.join("\n"), door: { x: 11, y: 15, dir: 0 } };
}

const CASA = "Casarão";
const CASA2 = "Casarão 2º";
const GALPOES = "Galpões";
const CALABOUCO = "Calabouço";

/**
 * O calabouço embaixo do celeiro: 16×14 de pedra. Desce-se pela escada de mão, reta, do
 * alçapão no teto até o chão (no fundo à esquerda); a "porta" é o vão do corredor escuro, no
 * meio da parede do fundo. No meio, o estrado redondo do altar: o chão é plano, e o estrado é um
 * móvel pisável de 0,61 m (09/10; antes a planta subia num bloco quadrado, feio).
 */
function calaboucoPlan(): { heightmap: string; door: Door } {
  const W = 16;
  const H = 14;
  const rows = [
    Array.from({ length: W }, (_, x) => (x === 9 ? "0" : "x")).join(""),
  ];
  // o chão é todo plano (09/10): quem sobe é o estrado do altar (o móvel pisável de 0,61 m), não a planta
  for (let y = 1; y <= H; y++) rows.push("0".repeat(W));
  return { heightmap: rows.join("\n"), door: { x: 9, y: 0, dir: 4 } };
}

/**
 * Põe a sala no quadro do DESENHO (`plan.r`: 1 e 3 giram um quarto de volta, 2 espelha): a porta cai na parede onde o
 * desenho a põe (antes a sala só girava na planta, e no tabuleiro a porta ficava na parede oposta). Os móveis, as
 * passagens, o grupo e a porta andam junto. Os quadros de parede que caem numa parede da
 * frente (que não aparece) vão para uma parede de trás, em outro ponto.
 */
function giraSala(spec: CenaSpec): CenaSpec {
  const k = (((spec.plan.r ?? 0) % 4) + 4) % 4;
  if (!k) return spec;
  // meia-volta (r = 2): ESPELHA a sala (x vira o oposto). A porta cai na parede oposta, mas o que estava encostado no
  // fundo (a parede de cima, que aparece) continua no fundo, e nada fica escondido atrás de um móvel alto na frente.
  const espelho = k === 2;
  const linhas = spec.layout.heightmap.split("\n");
  const H = linhas.length;
  const W = linhas[0].length;
  const [W2, H2] = k % 2 ? [H, W] : [W, H];
  const pt = (x: number, y: number): [number, number] => (espelho ? [W - 1 - x, y] : giraPt(W, H, k, x, y));
  const girar = (r: number) => (espelho ? (r === 2 ? 6 : r === 6 ? 2 : r) : (r + 2 * k) % 8);
  const grade = Array.from({ length: H2 }, () => Array<string>(W2).fill("x"));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [nx, ny] = pt(x, y);
      grade[ny][nx] = linhas[y][x];
    }
  const heightmap = grade.map((l) => l.join("")).join("\n");
  const [dx, dy] = pt(spec.layout.door.x, spec.layout.door.y);
  const door = { x: dx, y: dy, dir: girar(spec.layout.door.dir) };
  const floor = spec.floor.map((f) => {
    const [id, x, y, rot, ...resto] = f;
    const d = getFurni(id);
    const fp = d ? footprint(d, rot) : { sx: 1, sy: 1 };
    const [ax, ay] = pt(x, y);
    const [bx, by] = pt(x + fp.sx - 1, y + fp.sy - 1);
    return [id, Math.min(ax, bx), Math.min(ay, by), girar(rot), ...resto] as FloorSeed;
  });
  // onde ficam as paredes de trás (a do norte, 'r', e a do oeste, 'l') no quadro novo
  const chao = (x: number, y: number) => grade[y]?.[x] !== undefined && grade[y][x] !== "x";
  let planoN = 0;
  while (planoN < H2 && grade[planoN].filter((c) => c !== "x").length < 2) planoN++;
  let planoO = 0;
  while (planoO < W2 && grade.filter((l) => l[planoO] !== "x").length < 2) planoO++;
  const xs = grade[planoN].map((c, x) => (c !== "x" ? x : -1)).filter((x) => x >= 0);
  const ys = grade.map((l, y) => (l[planoO] !== "x" ? y : -1)).filter((y) => y >= 0);
  const portais = floor.filter((f) => f[0] === "portal" || f[0].startsWith("stairs") || f[0] === "escada_desce");
  const livre = (lado: "r" | "l", pos: number) =>
    !portais.some(([, x, y]) => (lado === "r" ? y === planoN && Math.abs(x + 0.5 - pos) < 1.2 : x === planoO && Math.abs(y + 0.5 - pos) < 1.2));
  const wall: WallSeed[] = [];
  const perdidos: WallSeed[] = [];
  for (const w of spec.wall ?? []) {
    const [id, lado, , pos, z, ...resto] = w;
    // o lado novo: o norte ('r') e o oeste ('l') giram junto; só os que sobram no norte ou no oeste aparecem
    const nova = espelho ? (lado === "r" ? "r" : "x") : lado === "r" ? (["r", "x", "x", "l"] as const)[k] : (["l", "r", "x", "x"] as const)[k];
    if (nova === "x") {
      perdidos.push(w);
      continue;
    }
    // a posição ao longo da parede nova (contínua, no sentido do giro)
    const p = espelho ? W - pos : k === 1 ? H - pos : k === 3 ? W - pos : pos;
    wall.push([id, nova, nova === "r" ? planoN : planoO, p, z, ...resto] as WallSeed);
  }
  // o que caiu numa parede da frente: vai para uma parede de trás, num ponto livre
  const lugares: [("r" | "l"), number][] = [];
  for (const f of [0.5, 0.25, 0.75, 0.15, 0.85, 0.4, 0.6]) {
    if (xs.length) lugares.push(["r", xs[0] + (xs[xs.length - 1] - xs[0] + 1) * f]);
    if (ys.length) lugares.push(["l", ys[0] + (ys[ys.length - 1] - ys[0] + 1) * f]);
  }
  const usados: [("r" | "l"), number][] = wall.map((w) => [w[1], w[3]] as [("r" | "l"), number]);
  for (const w of perdidos) {
    const [id, , , , z, ...resto] = w;
    const l = lugares.find(([lado, pos]) => livre(lado, pos) && !usados.some(([a, b]) => a === lado && Math.abs(b - pos) < 1.6));
    if (!l) continue;
    usados.push(l);
    wall.push([id, l[0], l[0] === "r" ? planoN : planoO, l[1], z, ...resto] as WallSeed);
  }
  void chao;
  return {
    ...spec,
    layout: { heightmap, door },
    floor,
    wall,
    links: spec.links.map(([x, y, para]) => {
      const [nx, ny] = pt(x, y);
      return [nx, ny, para] as [number, number, string];
    }),
    chao: spec.chao?.map(([x, y, ...resto]) => [...pt(x, y), ...resto] as [number, number, string, number, Loot["kind"]]),
    grupo: spec.grupo?.map(([x, y, d]) => {
      const [nx, ny] = pt(x, y);
      return [nx, ny, girar(d)] as [number, number, number];
    }),
    plan: { x: spec.plan.x, y: spec.plan.y },
  };
}

// ------------------------------------------------------------------ decoração (15/10)

/**
 * A "densidade" que deixa as cenas vivas (15/10, análise do Códex): peças grandes, conjuntos médios e objetinhos pequenos,
 * sem tapar a passagem. Só enfeite, com peças que já existem: nada aqui é pista, puzzle, porta nem item de missão, e tudo
 * entra DEPOIS dos móveis (quem fica em cima de tampo precisa do tampo já posto). Cada mesa leva um conjunto diferente.
 * Os objetos pequenos ficam sempre EM CIMA de tampo (mesa, aparador, cômoda, pia, criado-mudo); os de chão ficam nos
 * cantos e junto das paredes, com o miolo e as portas livres. As salas que giram (`plan.r`) usam as coordenadas BRUTAS
 * daqui, como o resto do seed. As velas ficam apagadas (estado 1): a casa está sem luz, e `abandonada` já faz o mesmo
 * com as do casarão.
 */
const dec = (id: string, x: number, y: number, rot = 0, apagada = false): FloorSeed =>
  apagada ? [id, x, y, rot, undefined, 1] : [id, x, y, rot];
const vela = (x: number, y: number): FloorSeed => dec("candles", x, y, 0, true);

const DECOR = {
  fazenda: [
    // a varanda do casarão: vasos de cada lado da entrada e um banco de cada lado da fonte
    dec("vaso_flores", 18, 18),
    dec("vaso_flores", 21, 18),
    dec("banco_rustico", 17, 23, 2),
    dec("banco_rustico", 23, 23, 6),
    // o poço do quintal
    dec("poco", 29, 14),
    // a frente da casa de mantimentos: caixotes empilhados, barril, sacas e lenha
    dec("crate_wood", 27, 7),
    dec("crate_wood", 27, 7),
    dec("barrel", 28, 7),
    dec("sacas", 33, 7),
    dec("lenha", 34, 7),
    // a frente do celeiro: a lenha rachada, o toco e os barris da água
    dec("lenha", 47, 9),
    dec("lenha", 47, 9),
    dec("lenha", 48, 9),
    dec("toco_morador", 49, 9),
    dec("barrel", 55, 9),
    dec("barrel", 56, 9),
    // ao lado da carroça
    dec("sacas", 58, 5),
    dec("sacas", 59, 5),
    dec("feno", 61, 5),
    // as colheitas largadas na beira das leiras
    dec("igarape_cesto", 56, 23),
    dec("igarape_cesto", 54, 33),
    dec("sacas", 56, 33),
    // a beira do lago: a rede, o cesto e as pedras
    dec("igarape_rede_pesca", 27, 28),
    dec("igarape_cesto", 28, 28),
    dec("pedras", 25, 32),
    dec("pedras", 36, 31),
  ],
  arredores: [
    // a encruzilhada: o banco ao lado da placa e um toco
    dec("banco_rustico", 14, 12, 4),
    dec("toco_morador", 14, 13),
    dec("toco_morador", 33, 17),
    // a beira do rio
    dec("pedras", 20, 11),
    dec("pedras", 29, 17),
    // as roças dos vizinhos: o cesto e as sacas do lado de fora da cerca
    dec("igarape_cesto", 29, 5),
    dec("sacas", 41, 5),
    dec("igarape_cesto", 13, 22),
    dec("sacas", 14, 22),
  ],
  // o hall: o aparador com o vaso seco e a vela, a mesinha dos recados, o cesto dos guarda-chuvas e a lama da porta
  // (16/10, o Felipe: "encostado na parede como é de costume") o aparador e a mesinha junto da parede, não no meio
  hall: [
    dec("vaso_flores", 6, 5),
    vela(6, 6),
    dec("table_small", 0, 7),
    dec("books_stack", 0, 7),
    dec("igarape_cesto", 4, 10),
    dec("dirt", 3, 10),
  ],
  // a mesa da família: o prato, a caneca, a jarra, o vaso seco; o aparador com a vela e o copo; a mesinha e o cesto
  jantar: [
    dec("food_tray", 4, 2),
    dec("mug", 5, 2),
    dec("jarra_canecas", 5, 3),
    dec("vaso_flores", 4, 4),
    dec("mug", 5, 5),
    vela(6, 0),
    dec("beer_glass", 7, 0),
    dec("table_small", 1, 5),
    dec("books_stack", 1, 5),
    dec("igarape_cesto", 7, 6),
  ],
  // a cozinha: o cesto com o pão de um ano, a jarra, o prato e a vela na mesa; a lenha empilhada; os sacos e o cesto
  cozinha: [
    dec("cesta_pao", 4, 3),
    dec("jarra_canecas", 6, 4),
    dec("food_tray", 4, 4),
    vela(5, 4),
    dec("mug", 5, 0),
    dec("lenha", 9, 0),
    dec("lenha", 9, 0),
    dec("lenha", 8, 0),
    dec("sacas", 1, 4),
    dec("igarape_cesto", 1, 5),
  ],
  banheiro: [dec("beer_glass", 5, 0), dec("trash_bin", 2, 0), dec("puddle", 2, 2)],
  // o quarto das crianças: vela e livros nos criados-mudos, o vaso na cômoda, o cesto de brinquedo e o banquinho
  criancas: [
    vela(4, 0),
    dec("books_stack", 6, 0),
    vela(8, 3),
    dec("vaso_flores", 8, 4),
    dec("igarape_cesto", 7, 5),
    dec("stool", 5, 5),
  ],
  // o escritório do dono: a caneca fria na mesa, os livros em cima do arquivo, a mesinha da poltrona, a lixeira
  escritorio: [
    dec("mug", 5, 3),
    dec("books_stack", 9, 0),
    dec("books_stack", 5, 0),
    dec("table_small", 9, 4),
    vela(9, 4),
    dec("trash_can", 7, 2),
    dec("floor_lamp", 8, 7),
  ],
  // o corredor de cima: duas mesinhas encostadas na parede, o baú de roupa de cama e o cesto
  corredor: [
    dec("table_small", 0, 5),
    dec("books_stack", 0, 5),
    dec("table_small", 0, 9),
    vela(0, 9),
    dec("bau_madeira", 4, 4, 6),
    dec("igarape_cesto", 4, 9),
  ],
  principal: [
    vela(6, 0),
    vela(1, 4),
    dec("vaso_flores", 1, 5),
    dec("table_small", 9, 3),
    dec("books_stack", 9, 3),
  ],
  banheiro2: [dec("mug", 3, 1), dec("trash_bin", 4, 3), dec("stool", 3, 5), dec("puddle", 1, 3)],
  quarto1: [vela(5, 0), dec("mug", 8, 4), dec("bau_madeira", 3, 5, 4), dec("vaso_flores", 8, 0)],
  quarto2: [
    dec("vaso_flores", 5, 0),
    vela(1, 4),
    dec("books_stack", 1, 5),
    dec("igarape_cesto", 7, 5),
    dec("vaso_flores", 8, 1),
  ],
  quarto3: [vela(7, 0), dec("books_stack", 8, 3), dec("bau_madeira", 6, 5, 4), dec("vaso_flores", 2, 5)],
  // o depósito: a mesa de trabalho no meio, a lenha, o feno, os caixotes empilhados e as sacas do outro lado
  mantimentos: [
    dec("table_work", 6, 3),
    dec("books_stack", 6, 3),
    vela(7, 3),
    dec("mug", 8, 4),
    dec("stool", 7, 5),
    dec("lenha", 12, 0),
    dec("lenha", 12, 0),
    dec("lenha", 13, 0),
    dec("toco_morador", 14, 0),
    dec("feno", 2, 7),
    dec("feno", 2, 7),
    dec("feno", 3, 7),
    dec("igarape_cesto", 13, 5),
    dec("crate_wood", 14, 7),
    dec("crate_wood", 14, 7),
    dec("crate_wood", 15, 7),
    dec("barrel", 16, 7),
    dec("sacas", 17, 6),
    dec("sacas", 18, 6),
    dec("sacas", 18, 5),
    dec("dirt", 9, 6),
    dec("dirt", 12, 4),
    dec("dirt", 5, 6),
  ],
  // o escritório do capataz: o livro-caixa e a caneca na mesa, a vela no arquivo, a lixeira, os caixotes e as sacas
  capataz: [
    dec("books_stack", 4, 1),
    dec("mug", 5, 1),
    vela(8, 0),
    dec("trash_can", 3, 1),
    dec("crate_wood", 8, 3),
    dec("crate_wood", 8, 3),
    dec("sacas", 1, 5),
  ],
  // a sala de utensílios: a jarra, a caneca e o prato na mesa; o engradado, o cocho, o carrinho e a sujeira
  utensilios: [
    dec("jarra_canecas", 3, 3),
    dec("mug", 5, 3),
    dec("food_tray", 4, 4),
    vela(5, 4),
    dec("beer_crate", 1, 5),
    dec("tina_agua", 2, 5),
    dec("janitor_cart", 7, 5),
    dec("dirt", 5, 1),
    dec("dirt", 2, 2),
  ],
  // o celeiro: a lenha e o toco, a mesinha de ferramentas, os sacos e caixotes do depósito, o cocho de cada baia
  celeiro: [
    dec("lenha", 7, 1),
    dec("lenha", 7, 1),
    dec("toco_morador", 7, 2),
    dec("lenha", 8, 6),
    dec("lenha", 8, 6),
    dec("table_small", 6, 6),
    dec("jarra_canecas", 6, 6),
    dec("sacas", 6, 8),
    dec("sacas", 7, 8),
    dec("crate_wood", 8, 8),
    dec("igarape_cesto", 2, 8),
    dec("crate_wood", 8, 12),
    dec("crate_wood", 8, 12),
    dec("barrel", 8, 13),
    dec("lenha", 7, 10),
    dec("lenha", 8, 10),
    dec("tina_agua", 22, 4),
    dec("feno", 21, 2),
    dec("tina_agua", 22, 8),
    dec("sacas", 23, 6),
    dec("tina_agua", 21, 12),
    dec("feno", 19, 13),
    dec("dirt", 12, 6),
    dec("dirt", 14, 10),
    dec("dirt", 11, 3),
  ],
  // o calabouço: a mesa de trabalho com o microscópio, a bandeja e a caneca, o resto de comida, o lixo e a cera
  calabouco: [
    dec("microscope", 4, 11),
    dec("med_tray", 3, 12),
    dec("mug", 5, 12),
    dec("mug", 0, 5),
    dec("food_tray", 0, 7),
    dec("lixeira_lanches", 2, 9),
    dec("wax_pool", 6, 12),
    dec("wax_pool", 12, 12),
    dec("dirt", 3, 3),
    dec("dirt", 12, 2),
  ],
  corredorEscuro: [dec("pedras", 2, 6), dec("pedras", 0, 10)],
  salaSangue: [dec("med_tray", 4, 2)],
};

/** Enfeites de parede da Casa de Mantimentos e do escritório do capataz (as outras salas já têm os seus). */
const DECOR_PAREDE = {
  mantimentos: [
    ["blade_rack", "r", 0, 5.5, 2.3],
    ["tool_board", "r", 0, 8.5, 2.3],
  ] as WallSeed[],
  capataz: [["notice_board", "r", 0, 2.5, 2.4]] as WallSeed[],
};

const CENAS_BRUTAS: CenaSpec[] = [
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
    floor: [...FAZENDA_FORA, ...DECOR.fazenda],
    links: [
      [0, 18, "arredores"],
      [19, 18, "hall"],
      [30, 7, "mantimentos"],
      [51, 9, "celeiro"],
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
    floor: [...ARREDORES, ...DECOR.arredores],
    links: [[47, 13, "fazenda"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ casarão, térreo
  {
    key: "hall",
    name: FAZENDA + "Hall do Casarão",
    description:
      "O hall de entrada, com a escada para o andar de cima e as portas: a cozinha, o banheiro e o quarto das crianças do lado de lá; a sala de jantar e o escritório do outro.",
    layout: planTop(7, 11, 3),
    andar: CASA,
    style: "taco",
    darkness: 0.35,
    ambient: "#c08a50",
    particles: ["dust"],
    floor: [
      ["stairs_up", 3, 1, 4],
      // o lado oeste (a parede que aparece): a cozinha, o banheiro e o quarto das crianças
      ["portal", 0, 3, 2],
      ["portal", 0, 6, 2],
      ["portal", 0, 9, 2],
      // o lado leste (a da frente, que não aparece): a sala de jantar e o escritório
      ["portal", 6, 3, 6],
      ["portal", 6, 8, 6],
      // a porta da frente, dupla, na parede de baixo
      ["portal", 2, 11, 0],
      ["portal", 3, 11, 0],
      ["rug_worn", 2, 5, 0],
      // encostados nas paredes, entre as portas (16/10)
      ["bench", 0, 4, 2],
      ["sideboard", 6, 5, 6],
      ["armchair", 0, 10, 2],
      ["plant", 1, 1, 0],
      ["plant", 5, 1, 0],
      ["plant", 5, 10, 0],
      ...lamps([3, 5], [3, 9]),
      ...DECOR.hall,
    ],
    wall: [
      ["quadro_fazenda", "r", 1, 5.5, 2.54],
      ["clock", "r", 1, 1.4, 3.45],
      ["sconce", "l", 0, 4.5, 2.9],
      ["sconce", "l", 0, 7.5, 2.9],
    ],
    links: [
      [3, 1, "corredor"],
      [0, 3, "cozinha"],
      [0, 6, "banheiro"],
      [0, 9, "criancas"],
      [6, 3, "jantar"],
      [6, 8, "escritorio"],
      [2, 11, "fazenda"],
      [3, 11, "fazenda"],
    ],
    plan: { x: 12, y: 3 },
  },
  {
    key: "cozinha",
    name: FAZENDA + "Cozinha",
    description:
      "A cozinha de fazenda: fogão a lenha, a pia, os armários e a mesa onde a família come. A porta dá para o hall, a leste.",
    layout: planRight(10, 6, 3),
    andar: CASA,
    style: "cozinha_fazenda",
    // abandonada há mais de um ano (14/10, o Felipe): sem luz elétrica e o fogão frio; a luz vem da janela
    darkness: 0.5,
    ambient: "#9a8f7c",
    particles: ["dust"],
    floor: [
      ["portal", 9, 3, 6],
      // o armário do canto em L (13/10, pedido do Felipe: um móvel só, no lugar de dois armários)
      ["armario_cozinha_l", 0, 0, 4],
      ["fogao_lenha", 2, 0, 4],
      ["pia_cozinha", 4, 0, 4],
      ["armario_cozinha", 6, 0, 4],
      ["crate_wood", 0, 4, 0],
      ["barrel", 0, 5, 0],
      ["mesa_cozinha", 4, 3, 0],
      ["chair_wood", 3, 3, 2],
      ["chair_wood", 3, 4, 2],
      ["chair_wood", 7, 3, 6],
      ["chair_wood", 7, 4, 6],
      ["chair_wood", 5, 2, 4],
      ["chair_wood", 5, 5, 0],
      ["mug", 5, 3, 0],
      ["plant", 9, 5, 0],
      // as lâmpadas apagadas (estado 1), balançando no fio com o vento da janela
      ["ceiling_lamp", 4, 2, 0, undefined, 1],
      ["ceiling_lamp", 8, 2, 0, undefined, 1],
      ...DECOR.cozinha,
    ],
    wall: [
      ["shelf_wall", "r", 0, 8.5, 3.22],
      // a natureza-morta das frutas, em cima do fogão
      ["quadro_fazenda~02", "r", 0, 3.0, 2.54],
      // a janela em cima da pia (14/10, pedido do Felipe: "tá faltando só a janela"): o meio a 5 casas e 2,84 unidades
      ["janela_cozinha", "r", 0, 5.0, 1.75],
      ["clock", "l", 0, 4.5, 3.45],
      // a teia de aranha no canto do teto, tremendo com o vento
      ["teia", "r", 0, 0.6, 3.55],
    ],
    links: [[9, 3, "hall"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "jantar",
    name: FAZENDA + "Sala de Jantar",
    description:
      "A mesa grande de madeira com as cadeiras em volta, o aparador e a cristaleira. A porta dá para o hall, a oeste.",
    layout: plan(7, 8, 3),
    andar: CASA,
    style: "taco",
    darkness: 0.38,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 3, 2],
      ["mesa_jantar", 4, 2, 2],
      ["candelabra", 4, 3, 0],
      ...[2, 3, 4, 5].map((y): FloorSeed => ["chair_wood", 3, y, 2]),
      ...[2, 3, 4, 5].map((y): FloorSeed => ["chair_wood", 6, y, 6]),
      ["chair_wood", 4, 1, 4],
      ["chair_wood", 4, 6, 0],
      ["sideboard", 6, 0, 4],
      ["armario_cozinha", 1, 0, 4],
      ["plant", 7, 7, 0],
      ["plant", 1, 7, 0],
      ...lamps([2, 5], [5, 6]),
      ...DECOR.jantar,
    ],
    wall: [
      ["quadro_fazenda~03", "l", 1, 5.5, 2.54],
      ["sconce", "l", 1, 1.6, 2.9],
      ["sconce", "l", 1, 6.4, 2.9],
      ["clock", "r", 0, 4.5, 3.45],
    ],
    links: [[1, 3, "hall"]],
    plan: { x: 21, y: 0 },
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
      ...DECOR.banheiro,
    ],
    wall: [["mirror", "r", 0, 5.5, 2.72]],
    links: [[1, 1, "hall"]],
    plan: { x: 0, y: 7, r: 2 },
  },
  {
    key: "criancas",
    name: FAZENDA + "Quarto das Crianças",
    description:
      "Três beliches lado a lado, o tapete gasto e brinquedo por todo lado: ursinhos, blocos, um cavalinho de balanço e uma casinha de brinquedo.",
    layout: plan(8, 6, 3),
    andar: CASA,
    style: "taco",
    darkness: 0.4,
    ambient: "#c08a50",
    floor: [
      ["portal", 1, 3, 2],
      ["beliche", 3, 0, 4],
      ["beliche", 5, 0, 4],
      ["beliche", 7, 0, 4],
      ["nightstand", 4, 0, 4],
      ["nightstand", 6, 0, 4],
      ["rug_worn", 3, 3, 0],
      ["comoda", 8, 3, 6],
      ["crate_wood", 8, 5, 0],
      ...lamps([5, 3]),
      ...DECOR.criancas,
    ],
    wall: [["quadro_fazenda~12", "r", 0, 2.2, 2.63]],
    // os brinquedos espalhados pelo chão: itens que os jogadores podem pegar
    chao: [
      [1, 0, "Casinha de Brinquedo", 2, "misc"],
      [2, 1, "Ursinho de Pelúcia", 1, "misc"],
      [6, 2, "Boneca de Pano", 0.5, "misc"],
      [6, 4, "Blocos de Montar", 1, "misc"],
      [7, 4, "Cavalinho de Balanço", 2, "misc"],
      [2, 5, "Carrinho de Brinquedo", 0.5, "misc"],
    ],
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
      ["desk_wood", 5, 3, 0],
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
      ...DECOR.escritorio,
    ],
    wall: [
      ["quadro_fazenda~04", "r", 0, 6.5, 2.54],
      // o mapa da fazenda, desenhado à mão, na mesma parede da gravura do casarão
      ["quadro_fazenda~09", "r", 0, 8.0, 2.54],
      ["clock", "l", 1, 2.0, 3.45],
      ["sconce", "l", 1, 6.5, 2.9],
    ],
    links: [[1, 4, "hall"]],
    plan: { x: 20, y: 9 },
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
      ...DECOR.corredor,
    ],
    wall: [
      ["quadro_fazenda~05", "l", 0, 4.8, 2.54],
      // o rio na neblina, com a ponte, mais no fundo do corredor
      // (em 9,0, não 8,5: ali a moldura entrava no vão da porta do quarto 2, em y = 7)
      ["quadro_fazenda~11", "l", 0, 9.0, 2.54],
      ["clock", "r", 1, 0.8, 3.45],
    ],
    links: [
      [2, 1, "banheiro2"],
      [0, 2, "quarto1"],
      [0, 7, "quarto2"],
      [4, 2, "quarto3"],
      [4, 7, "principal"],
      [2, 8, "hall"],
    ],
    plan: { x: 12, y: 6 },
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
      ...DECOR.principal,
    ],
    wall: [
      ["quadro_fazenda~06", "r", 0, 2.2, 2.63],
      ["mirror", "l", 1, 4.5, 2.18],
    ],
    links: [[1, 1, "corredor"]],
    plan: { x: 20, y: 8 },
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
      ...DECOR.banheiro2,
    ],
    wall: [["mirror", "r", 1, 3.5, 2.72]],
    links: [[2, 1, "corredor"]],
    plan: { x: 12, y: 0, r: 2 },
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
      ["desk_wood", 8, 4, 6],
      ["desk_lamp", 8, 5, 6],
      ["chair_wood", 7, 4, 2],
      ...lamps([4, 3]),
      ...DECOR.quarto1,
    ],
    wall: [["quadro_fazenda~07", "r", 0, 3.5, 2.63]],
    links: [[1, 4, "corredor"]],
    plan: { x: 1, y: 1, r: 2 },
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
      ...DECOR.quarto2,
    ],
    wall: [["quadro_fazenda~08", "r", 0, 2.5, 2.63]],
    links: [[1, 3, "corredor"]],
    plan: { x: 1, y: 8, r: 2 },
  },
  {
    key: "quarto3",
    name: FAZENDA + "Quarto 3",
    description: "Quarto de solteiro, a cama de colcha amarela e a escrivaninha.",
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
      ["guarda_roupa", 8, 1, 6],
      ["desk_wood", 8, 3, 6],
      ["desk_lamp", 8, 4, 6],
      ["chair_wood", 7, 3, 2],
      ...lamps([5, 3]),
      ...DECOR.quarto3,
    ],
    links: [[1, 2, "corredor"]],
    // os doze quadros do casarão: aqui, o bordado da cruz em cima da cama
    wall: [["quadro_fazenda~10", "r", 0, 3.5, 2.63]],
    plan: { x: 20, y: 1 },
  },
  // ------------------------------------------------------------ casa de mantimentos e celeiro
  {
    // As salas de dentro da Casa de Mantimentos são cenas próprias, de parede inteira (o Felipe, 14/10: "essas paredes
    // são completas, pra ir até essas salas é outra cena"). O galpão abre para a frente da tela: a porta de fora fica
    // na parede da frente (a que não aparece), no fim do corredor entre o escritório e a sala de utensílios.
    key: "mantimentos",
    name: FAZENDA + "Casa de Mantimentos",
    description:
      "O depósito da fazenda: caixotes, barris e sacas de grão, as prateleiras na parede. Pelo corredor da entrada, a porta do escritório do capataz de um lado e a da sala de utensílios do outro.",
    layout: mantimentosPlan(),
    andar: GALPOES,
    style: "taco",
    darkness: 0.45,
    ambient: "#b88a50",
    particles: ["dust"],
    floor: [
      ["portal", 11, 14, 0],
      ["portal", 10, 11, 2],
      ["portal", 11, 11, 6],
      // as prateleiras na parede da esquerda e as sacas
      ["prateleira", 0, 0, 2],
      ["prateleira", 0, 2, 2],
      ["prateleira", 0, 4, 2],
      ...de("sacas", [3, 1], [4, 1], [3, 2], [4, 2], [5, 2]),
      ["barrel", 0, 7, 0],
      ["barrel", 1, 7, 0],
      // o depósito: caixotes e barris do lado de lá
      ...de("crate_wood", [20, 0], [21, 0], [21, 1], [15, 3], [16, 3], [15, 4]),
      ...de("barrel", [18, 0], [21, 3], [20, 6]),
      ...lamps([5, 3], [16, 3], [10, 5]),
      ...DECOR.mantimentos,
    ],
    wall: [...DECOR_PAREDE.mantimentos],
    links: [
      [11, 14, "fazenda"],
      [10, 11, "utensilios"],
      [11, 11, "capataz"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "capataz",
    name: FAZENDA + "Escritório do Capataz",
    description: "O escritório do capataz, do lado do corredor da entrada: a mesa com os papéis, o arquivo, a estante e o tapete gasto.",
    // a porta para o corredor fica na parede da esquerda (o escritório está a leste do corredor)
    layout: plan(8, 6, 2),
    andar: GALPOES,
    style: "taco",
    darkness: 0.45,
    ambient: "#b88a50",
    particles: ["dust"],
    floor: [
      ["portal", 1, 2, 2],
      ["chair_wood", 4, 0, 4],
      ["desk_wood", 4, 1, 0],
      ["papers", 4, 1, 4],
      ["bookshelf", 6, 0, 4],
      ["cabinet_file", 8, 0, 6],
      ["rug_worn", 3, 3, 0],
      ["plant", 8, 5, 0],
      ...lamps([5, 3]),
      ...DECOR.capataz,
    ],
    wall: [...DECOR_PAREDE.capataz],
    links: [[1, 2, "mantimentos"]],
    plan: { x: 13, y: 9 },
  },
  {
    key: "utensilios",
    name: FAZENDA + "Sala de Utensílios",
    description:
      "A sala de utensílios, do outro lado do corredor: as estantes cheias de panelas, frigideiras, pratos esmaltados, canecas e bules, a régua de ganchos com as conchas e as escumadeiras, a mesa no meio. Tudo debaixo de um ano de poeira.",
    // a porta para o corredor fica na parede da direita (a sala está a oeste do corredor)
    layout: planRight(8, 6, 2),
    andar: GALPOES,
    style: "taco",
    darkness: 0.45,
    ambient: "#b88a50",
    particles: ["dust"],
    floor: [
      ["portal", 7, 2, 6],
      // as estantes encostadas na parede do fundo e na da esquerda
      ["estante_utensilios", 0, 0, 4],
      ["estante_utensilios", 2, 0, 4],
      ["estante_utensilios", 4, 0, 4],
      ["estante_utensilios", 0, 2, 2],
      ["mesa_cozinha", 3, 3, 4],
      ["barrel", 0, 5, 0],
      ...lamps([4, 2]),
      ...DECOR.utensilios,
    ],
    wall: [["utensilios_parede", "l", 0, 5.0, 2.2]],
    links: [[7, 2, "mantimentos"]],
    plan: { x: 1, y: 9 },
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
      ...DECOR.celeiro,
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
      "Embaixo do celeiro, pedra molhada e cheiro de ferro: o lugar de um ritual. Na parede da esquerda, a central de monitoramento; no meio, o altar no estrado redondo, com o círculo de sangue e os crânios, e em volta dele os computadores, as máquinas e os monitores que ficavam ligados na pessoa, o gravador e a câmera; no fundo, os arquivos do estudo e a passagem para o corredor escuro.",
    layout: calaboucoPlan(),
    andar: CALABOUCO,
    style: "calabouco",
    darkness: 0.66,
    fog: 0.25,
    ambient: "#3a8a90",
    particles: ["dust", "smoke"],
    // 08/10 (o Felipe): aqui faziam um ritual de TROCA DE MENTE à força, pondo uma mente muito forte num corpo que não
    // aguentava. Não tem criatura presa (os tanques saíram): tem os aparelhos que monitoravam a pessoa e o registro do
    // "estudo". Ninguém ficava aqui: descia, fazia o ritual e pronto (sem leitos). Quem não resistiu ficou na sala do fim
    // do corredor e virou Existido.
    floor: [
      // a escada de mão que sobe reto para o alçapão do celeiro, e a passagem do corredor escuro
      ["escada_vertical", 1, 1, 4],
      ["portal", 9, 1, 4],
      // a central de monitoramento, na parede da esquerda: os computadores, com o painel das telas em cima
      [
        "console",
        0,
        4,
        2,
        oculta(
          "Computadores",
          "As telas mostram um corpo por dentro, em camadas, e duas linhas de atividade cerebral que deviam ser de pessoas diferentes, mas sobem e descem juntas. Os cabos descem pelo chão até o altar.",
        ),
      ],
      ["chair_office", 1, 4, 6],
      ["console", 0, 6, 2],
      ["chair_office", 1, 7, 6],
      ["cables_floor", 2, 6, 0],
      ["cables_floor", 4, 7, 0],
      ["server_rack", 0, 11, 2],
      ["server_rack", 0, 12, 2],
      ["ups", 0, 13, 2],
      // em volta do altar: o computador do ritual, as máquinas, os monitores ligados na pessoa (um deles tomado pela
      // Energia), o gravador e a câmera apontada para a pedra
      ["console", 12, 5, 2],
      ["chair_office", 13, 5, 6],
      ["gravador_rolo", 13, 7, 6],
      ["eletroencefalografo", 6, 7, 2],
      ["monitor_suporte", 7, 5, 4],
      ["monitor_suporte", 6, 9, 2],
      [
        "monitor_energia",
        12,
        9,
        6,
        oculta(
          "Monitor",
          "Fundido com outro aparelho que não devia estar ali, os cabos acesos como veias. A tela ainda mostra um batimento, e não tem ninguém ligado nele.",
        ),
      ],
      ["camera_tripe", 9, 12, 0],
      // o registro do estudo: os arquivos do lado da passagem, o quadro branco com os gráficos e a mesa de trabalho
      [
        "cabinet_file",
        6,
        1,
        4,
        oculta(
          "Arquivo",
          "Pastas por nome, em ordem de data. Cada uma termina com a mesma palavra carimbada: REJEIÇÃO. A última está vazia, só com o nome escrito na capa.",
        ),
      ],
      ["cabinet_file", 7, 1, 4],
      ["whiteboard", 10, 1, 4],
      ["table_work", 3, 11, 4],
      ["flasks", 3, 11, 0],
      ["vitals_monitor", 5, 11, 4],
      ["papers", 4, 12, 0],
      ["trolley", 13, 9, 6],
      // o estrado redondo de pedra negra (o sigilo, as velas e os crânios já vêm nele) e, em cima, a pedra do sacrifício
      ["estrado_altar", 7, 6, 4],
      [
        "pedra_sacrificio",
        8,
        8,
        4,
        oculta(
          "Pedra do sacrifício",
          "Pedra escura, lisa de tanto uso, com argolas e correntes nas quatro pontas. O sulco do meio ainda está úmido: é sangue. Subir aqui dá a sensação de que alguma coisa olha de volta.",
        ),
      ],
      ["candelabra", 6, 11, 0],
      ["candelabra", 12, 11, 0],
      // o rastro de sangue até o corredor, as poças e o ralo
      ["blood_drops", 9, 2, 0],
      ["blood_drops", 10, 4, 0],
      ["blood_drops", 9, 5, 0],
      ["puddle", 5, 6, 0],
      ["puddle", 13, 6, 0],
      ["puddle", 3, 8, 0],
      ["puddle", 10, 13, 0],
      ["drain", 7, 13, 0],
      ...DECOR.calabouco,
    ],
    wall: [
      // as telas em cima dos computadores (antes ficavam atrás dos racks), a câmera da escada e as arandelas
      ["monitor_wall", "l", 0, 5.5, 2.63],
      ["cctv", "l", 0, 1.7, 3.3],
      ["sconce", "l", 0, 9.0, 2.9],
      ["sconce", "r", 1, 8.5, 2.9],
      ["sconce", "r", 1, 15.4, 2.9],
      ["pipes", "r", 1, 3.0, 3.6],
      // as fotos de quem passou pelo ritual
      [
        "board_investigation",
        "r",
        1,
        5.6,
        2.5,
        { icon: "inspect", title: "Quadro", text: "Fotos de gente da região, de frente e de perfil, cada uma com uma data. Fios ligam todas a uma foto só, no meio: o altar, de cima.", visible: false },
      ],
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
      ...DECOR.corredorEscuro,
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
    // 08/10 (o Felipe): é onde guardavam quem não resistiu ao ritual. Os corpos viraram Existidos e acordam quando os
    // agentes chegam: o primeiro combate oficial do CRONA. Os Existidos entram pelo combate (a ameaça do livro).
    description:
      "A sala do fim do corredor, onde guardavam quem não aguentou o ritual: os corpos no chão, cobertos, o sangue de tudo, a mesa de metal no meio e o ralo entupido. O ar aqui é parado demais.",
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
      // o sangue vem antes: a mesa e os corpos ficam em cima dele, não o contrário
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
      // os corpos de quem não aguentou
      [
        "corpo_lencol",
        5,
        0,
        4,
        oculta(
          "Corpo",
          "Embaixo do lençol, a pele está fria e cinzenta. Por baixo dela, fraco, alguma coisa brilha dourado, como uma luz que acabou de acender.",
        ),
      ],
      ["corpo_saco", 6, 1, 4],
      ["corpo_lencol", 2, 4, 2],
      ["skull", 6, 4, 6],
      ["candles", 6, 0, 0],
      ...DECOR.salaSangue,
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

/** As cenas como o desenho as põe: as salas com `plan.r` giram para a porta cair na parede do desenho. */
/**
 * A fazenda abandonada há mais de um ano (14/10, o Felipe: "nada vivo, sóbrio, mas a cena com vida"): no casarão,
 * sem energia e sem ninguém, as lâmpadas, as arandelas, as luminárias e as velas ficam apagadas (estado 1), só a
 * poeira no ar, e a teia de aranha no canto do teto (o que não couber na parede o seed só avisa e pula).
 */
const APAGA = new Set(["ceiling_lamp", "desk_lamp", "candles", "candelabra", "floor_lamp"]);
const APAGA_PAREDE = new Set(["sconce", "cage_lamp"]);
function abandonada(s: CenaSpec): CenaSpec {
  if (s.andar !== CASA && s.andar !== CASA2) return s;
  const floor = s.floor.map((f): FloorSeed => (APAGA.has(f[0]) ? [f[0], f[1], f[2], f[3], f[4], 1] : f));
  const wall = (s.wall ?? []).map((w): WallSeed => (APAGA_PAREDE.has(w[0]) ? [w[0], w[1], w[2], w[3], w[4], w[5], 1] : w));
  if (!wall.some((w) => w[0] === "teia")) {
    // o canto de trás de verdade: a primeira linha com chão (o plano da parede do fundo) e a primeira casa dela
    const linhas = s.layout.heightmap.replace(/\r/g, "").split("\n");
    // a linha que é só o vão da porta (uma casa) não é a parede: a de baixo dela é
    const conta = (l: string) => (l.match(/[0-9a-w]/g) ?? []).length;
    let y0 = linhas.findIndex((l) => conta(l) > 0);
    if (y0 >= 0 && conta(linhas[y0]) === 1) y0++;
    const x0 = y0 < 0 ? -1 : linhas[y0].search(/[0-9a-w]/);
    if (x0 >= 0) wall.push(["teia", "r", y0, x0 + 0.6, 3.55]);
  }
  return { ...s, floor, wall, particles: ["dust"] };
}

const CENAS: CenaSpec[] = CENAS_BRUTAS.map(giraSala).map(abandonada);

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
export function naPlanta(spec: CenaSpec): { x: number; y: number; r?: number } {
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
export function estilo(room: RoomData, spec: CenaSpec) {
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
  if (spec.descanso) room.descanso = spec.descanso;
  else delete room.descanso;
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
  if (feno) {
    // o fardo sai "para trás" (dy -1); se a sala girou (`plan.r` 1 ou 3), o empurrão gira junto (o espelho, r 2, não muda o eixo y)
    const k = ((CENAS_BRUTAS.find((c) => c.key === "celeiro")?.plan.r ?? 0) % 4 + 4) % 4;
    const slide = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }][k];
    feno.lock = { open: false, slide, semSenha: true };
  }
  else console.warn("[seed] Fazenda: o feno do alçapão não coube");
}

export const montar = (db: Database, spec: CenaSpec) => {
  const chao = spec.chao ?? [];
  const room = buildRoom(
    db,
    spec.name,
    spec.description,
    spec.layout,
    [...spec.floor, ...chao.map(([x, y]): FloorSeed => [PILHA_CHAO, x, y, 0])],
    spec.wall ?? [],
    spec.darkness,
  );
  // cada pilha leva o item que ficou ali, visível para todos
  for (const [x, y, name, espacos, kind] of chao) {
    const pilha = room.items.find((i) => i.defId === PILHA_CHAO && i.x === x && i.y === y && !i.loot);
    if (pilha) pilha.loot = [{ id: db.nextItemId++, name, espacos, kind, revealed: true }];
  }
  return room;
};

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
/** Cenas que já existiram e saíram da montagem: [nome, chave da cena que fica com as peças delas]. */
const SAIRAM: [string, string][] = [
  // 14/10: o quarto das ferramentas não existe (o Felipe); a sala do outro lado do corredor é a de utensílios
  ["Quarto das Ferramentas", "mantimentos"],
];

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
  // as cenas que saíram da montagem (só as desta lista: a van e as cenas que o mestre criou ficam): as peças que
  // estavam nelas vão para a cena que ficou no lugar, e a cena é apagada
  for (const [nome, para] of SAIRAM) {
    const velha = db.rooms.find((r) => r.name === FAZENDA + nome);
    const destino = built.get(para);
    if (!velha || !destino || velha === destino) continue;
    for (const t of velha.tokens ?? []) (destino.tokens ??= []).push({ ...t, x: destino.door.x, y: destino.door.y });
    for (const r of db.rooms) for (const it of r.items) if (it.link === velha.id) it.link = destino.id;
    db.rooms.splice(db.rooms.indexOf(velha), 1);
    for (const c of Object.values(db.campaigns ?? {})) delete c.layout[velha.id];
  }
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

/** Repõe na porteira os agentes que faltam na fazenda (depois da limpeza das salas de exemplo, que levou as peças). */
export function reporAgentesDaFazenda(db: Database): boolean {
  const spec = CENAS.find((s) => s.grupo);
  const porteira = spec ? db.rooms.find((r) => r.name === spec.name) : undefined;
  if (!spec || !porteira) return false;
  const nomes = new Set(
    db.rooms.filter((r) => r.name.startsWith(FAZENDA)).flatMap((r) => (r.tokens ?? []).map((t) => t.name)),
  );
  const charIdOf = (name: string) =>
    db.characters.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  const faltam = partyTokens(db, charIdOf, spec.grupo).filter((t) => !nomes.has(t.name));
  if (!faltam.length) return false;
  porteira.tokens = [...(porteira.tokens ?? []), ...faltam];
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
