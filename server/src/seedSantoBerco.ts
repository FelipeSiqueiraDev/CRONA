import { getFurni, RoomMap, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed } from "./seed";
import { planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * Santo Berço (14/10), o quarto lugar da campanha (docs/SANTO-BERCO.md): a vila anacrônica que nasce em volta da
 * Relíquia de Morte. Cara de vila medieval (sem eletricidade, sem armas de fogo), em ANEL em volta do Labirinto
 * Infinito, com as estradas de terra em anel e em raios; a luz vem dos cristais vermelhos. Os moradores (Luzidios)
 * vivem numa hipnose confortável e nada se paga.
 *
 * Primeira leva: a vila de fora inteira (todos os prédios no lugar, o labirinto, as quatro estátuas dos Guardiões, os
 * postes de cristal, o lodo preto) e por dentro a Torre do Porteiro (dois andares), a Taverna, a Ferraria e o quarto
 * do Ferreiro (com a escotilha que dá no bunker, trancada até o bunker existir). Hotel, Casa do Doutor, Fazenda,
 * Bosque da Provação, Minas, Bunker, Labirinto e Caverna vêm nas próximas levas.
 *
 * Na vila, o norte é o alto do mapa: o portão a leste (direita), a ferraria a noroeste, a taverna a nordeste, a casa do
 * Doutor a sudoeste, o bosque ao sul, as minas a oeste.
 */
export const SANTO_BERCO = "Santo Berço · ";
export const SANTO_BERCO_REV = 6;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);

const VILA = "Vila";
const TORRE = "Torre do Porteiro";
const TORRE2 = "Torre do Porteiro 2º";
const TAVERNA = "Taverna";
const FERRARIA = "Ferraria";

/** O clima de dentro: a luz vermelha e morna dos cristais. */
const DENTRO = { darkness: 0.5, ambient: "#b07060", particles: ["dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ a vila (de fora)

/**
 * A vila foi desenhada numa grade menor e espalhada por K (o Felipe, 14/10: "tá tudo espremido"): as medidas abaixo
 * ficam na grade do desenho e `k` passa para casas do tabuleiro; os prédios se afastam pelo meio deles.
 */
const K = 1.45;
const k = (v: number) => Math.round(v * K);
/** O terreno da vila e o meio do Labirinto (em casas). */
const VW = k(48);
const VH = k(44);
const CX = k(24);
const CY = k(21);
/** os raios do labirinto (a sebe de fora e a de dentro), do anel de estátuas e da estrada em anel */
const R_LAB = 6.5 * K;
const R_DENTRO = 3.3 * K;
const R_EST = 8.8 * K;
const R_ANEL0 = 10.2 * K;
const R_ANEL1 = 11.8 * K;
/** a estrada do portão: chega pelo leste, nas fileiras ESTRADA_Y e ESTRADA_Y + 1 */
const ESTRADA_Y = CY;
const PORTAO_X = k(43);
/** a horta da fazenda (o canto de cima à esquerda) */
const HX = k(13);
const HY = k(1);

const dist = (x: number, y: number) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY);

function terrenoVila(): Terreno {
  const t = new Terreno(VW, VH);
  // a estrada em anel em volta do labirinto
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const d = dist(x, y);
      if (d >= R_ANEL0 && d <= R_ANEL1) t.put(x, y, "t");
      // o chão batido em volta do labirinto, onde ficam as estátuas
      else if (d > R_LAB + 0.6 && d < R_EST + 1.2) t.put(x, y, "d");
    }
  // a estrada do portão (leste) até o anel, e os raios para cada canto da vila
  t.linha([[VW, ESTRADA_Y], [CX + R_ANEL0, ESTRADA_Y]], "t", 2);
  t.linha([[CX - 6.5 * K, CY - 9 * K], [12 * K, 12.5 * K]], "t", 2); // noroeste: a ferraria
  t.linha([[CX + 6.5 * K, CY - 9 * K], [36 * K, 11.5 * K]], "t", 2); // nordeste: a taverna
  t.linha([[CX, CY - R_ANEL0], [CX, 8 * K]], "t", 2); // norte: a fazenda
  t.linha([[CX - 7.5 * K, CY + 8 * K], [11 * K, 29 * K]], "t", 2); // sudoeste: a casa do Doutor
  t.linha([[CX, CY + R_ANEL0], [CX, VH]], "t", 2); // sul: o bosque
  t.linha([[CX - R_ANEL0, CY], [0, CY]], "t", 2); // oeste: as minas
  // a horta da fazenda (norte), do lado do celeiro
  t.ret(HX, HY, HX + 3, HY + 3, "l");
  // o pé da montanha das minas (oeste): cascalho
  t.disco(0, CY + 0.5, 3.2 * K, 5 * K, "p");
  return t;
}
const T_VILA = terrenoVila();

/** a peça "entrada" na casa logo à frente da porta de um prédio (a porta no meio da frente; giro 4 ou 0) */
function porta(id: string, x: number, y: number, rot: 0 | 4): [number, number] {
  const def = getFurni(id)!;
  const meio = Math.floor(def.width / 2);
  return rot === 4 ? [x + meio, y + def.depth] : [x + def.width - 1 - meio, y - 1];
}

/** o canto do prédio na grade espalhada: o meio dele se afasta por K */
function espalha(id: string, x: number, y: number): [number, number] {
  const d = getFurni(id)!;
  return [Math.round((x + d.width / 2) * K - d.width / 2), Math.round((y + d.depth / 2) * K - d.depth / 2)];
}

/** Os prédios da vila (na grade do desenho): [def, x, y, giro, cena de dentro (ou nada, por enquanto)]. */
const PREDIOS_DESENHO: [string, number, number, 0 | 4, string | null][] = [
  ["ferraria_predio", 8, 6, 4, "ferraria"],
  ["taverna_predio", 31, 3, 4, "taverna"],
  ["torre_porteiro", 40, 14, 4, "torre"],
  ["hotel_predio", 34, 25, 0, null],
  ["casa_doutor", 5, 31, 0, null],
  ["celeiro", 17, 0, 4, null],
  ["casa_vila", 1, 12, 4, null],
  ["casa_vila", 18, 37, 0, null],
  ["casa_vila", 27, 36, 0, null],
  ["casa_vila", 36, 36, 0, null],
];
const PREDIOS = PREDIOS_DESENHO.map(([id, x, y, r, cena]) => [id, ...espalha(id, x, y), r, cena] as [string, number, number, 0 | 4, string | null]);
const ENTRADAS = new Map(PREDIOS.filter((p) => p[4]).map(([id, x, y, r, cena]) => [cena!, porta(id, x, y, r)]));

/**
 * As quatro entradas do labirinto (o Felipe, 14/10): uma em cada ponta dele na tela, em cima, à direita, embaixo e à
 * esquerda (no chão, as diagonais: noroeste, nordeste, sudeste e sudoeste), cada uma com a sua estátua do lado.
 */
const ENTRADAS_LAB = [-0.75 * Math.PI, -0.25 * Math.PI, 0.25 * Math.PI, 0.75 * Math.PI];
/** a distância entre dois ângulos (0..π) */
const entre = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * A sebe do labirinto: o anel de fora com as quatro entradas; duas paredes (norte e sul) cortam o corredor em duas
 * metades; o anel de dentro só abre a leste e a oeste, então de cada entrada se dá a volta até o miolo.
 */
function labirinto(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const d = dist(x, y);
      const ang = Math.atan2(y + 0.5 - CY, x + 0.5 - CX);
      const fora = d >= R_LAB - 0.5 && d < R_LAB + 0.5 && ENTRADAS_LAB.every((e) => entre(ang, e) > 0.15);
      const dentro = d >= R_DENTRO && d < R_DENTRO + 1 && entre(ang, 0) > 0.24 && entre(ang, Math.PI) > 0.24;
      const raio = d >= R_DENTRO + 1 && d < R_LAB - 0.5 && (entre(ang, Math.PI / 2) < 0.08 || entre(ang, -Math.PI / 2) < 0.08);
      if (fora || dentro || raio) f.push(["sebe", x, y, 0]);
    }
  return f;
}

/** as quatro estátuas dos Guardiões (2 × 2): uma do lado de cada entrada do labirinto, olhando para ela */
function estatuas(): FloorSeed[] {
  return ENTRADAS_LAB.map((e, i) => {
    const a = e + 0.3;
    const x = Math.round(CX + Math.cos(a) * R_EST - 1);
    const y = Math.round(CY + Math.sin(a) * R_EST - 1);
    const rot = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 6 : 2) : Math.sin(a) > 0 ? 0 : 4;
    return [i % 2 ? "estatua_guardiao~b" : "estatua_guardiao", x, y, rot, hint("Estátua de Guardião", "Uma das quatro estátuas dos Guardiões, de vigia numa entrada do Labirinto. O rosto foi gasto até sumir.")] as FloorSeed;
  });
}

/** os postes de cristal na beira de fora do anel, a cada 45°, e ao longo da estrada do portão */
function postes(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    f.push(["poste_cristal", Math.round(CX + Math.cos(a) * (R_ANEL1 + 1) - 0.5), Math.round(CY + Math.sin(a) * (R_ANEL1 + 1) - 0.5), 0]);
  }
  for (const x of [k(37), k(41)]) f.push(["poste_cristal", x, ESTRADA_Y - 1, 0], ["poste_cristal", x, ESTRADA_Y + 2, 0]);
  return f;
}

/** árvores e arbustos só onde é grama e não tem nada (a lista pode ser generosa) */
function naGrama(ocupado: Set<string>, list: FloorSeed[]): FloorSeed[] {
  return list.filter(([, x, y]) => T_VILA.at(x, y) === "." && !ocupado.has(`${x},${y}`));
}

function vilaPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [id, x, y, r, cena] of PREDIOS) {
    f.push([id, x, y, r]);
    if (cena) f.push(["entrada", ...ENTRADAS.get(cena)!, r]);
  }
  f.push(["portao_vila", PORTAO_X, ESTRADA_Y - 1, 2, hint("Portão de Santo Berço", "O arco de troncos no fim da estrada. Do lado de dentro, o ar fica mais pesado e o tempo parece andar diferente.")]);
  // o poste que cairia dentro de um prédio fica de fora
  const predio = (x: number, y: number) =>
    PREDIOS.some(([id, px, py]) => {
      const d = getFurni(id)!;
      return x >= px && x < px + d.width && y >= py && y < py + d.depth;
    });
  f.push(...labirinto(), ...estatuas(), ...postes().filter(([, x, y]) => !predio(x, y)));
  // o poço e o lodo preto: uma poça no chão batido perto da entrada do labirinto, outra no caminho das minas
  f.push(["poco", k(29), k(13), 0]);
  f.push(["lodo_preto", CX + k(7), CY + k(2), 0, oculta("Lodo Preto", "Brilha como se tivesse luz por dentro. Quem olha muito tempo sente vontade de tocar.")]);
  f.push(["lodo_preto", k(4), CY + k(3), 0], ["lodo_preto", k(14), k(26), 0]);
  // a neblina grossa que esconde o miolo do labirinto (o raio vem da escala da peça: neblinaDoLabirinto)
  f.push(["neblina_densa", CX, CY, 0]);
  // os cristais soltos: o vermelho na porta da ferraria, o verde na casa do Doutor, o azul atrás da taverna
  f.push(["cristal_vermelho", k(7), k(13), 0], ["cristal_verde", k(16), k(30), 0], ["cristal_azul", k(41), k(4), 0]);
  // a fazenda (norte): a horta do lado do celeiro, com a cerca na frente
  for (let y = HY; y <= HY + 2; y++) for (let x = HX; x <= HX + 3; x++) f.push(["horta", x, y, 0]);
  for (let x = HX; x <= HX + 3; x++) f.push(["cerca", x, HY + 3, 4]);
  // a entrada das minas (oeste): as pedras na encosta
  f.push(...de("pedras", [0, CY - k(4)], [1, CY - k(3)], [0, CY + k(4)], [2, CY + k(5)], [1, CY + k(7)], [3, CY - k(2)], [2, CY - k(6)], [0, CY + k(9)]));
  // o resto da vila: barris e caixotes nas portas, a carroça na estrada
  f.push(["barril_madeira", k(30), k(11), 0], ["barril_madeira", k(41), k(11), 0], ["crate_wood", k(16), k(12), 0], ["carroca", k(44), k(25), 0]);
  const ocupado = new Set<string>();
  for (const [id, x, y, r] of f) {
    const def = getFurni(id.split("~")[0]);
    if (!def) continue;
    const [sx, sy] = r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) ocupado.add(`${x + dx},${y + dy}`);
  }
  // as árvores retorcidas: o bosque da Provação ao sul, a mata da montanha a oeste e as soltas pela vila
  const arvores: [number, number][] = ([
    [2, 40], [5, 42], [9, 40], [13, 42], [14, 38], [30, 42], [33, 40], [40, 42], [44, 40], [46, 37],
    [3, 3], [6, 1], [1, 7], [12, 2], [46, 2], [45, 9], [43, 30], [46, 33], [2, 28], [1, 34],
    [15, 17], [33, 16], [16, 27], [32, 28], [21, 32], [27, 10],
  ] as [number, number][]).map(([x, y]) => [k(x), k(y)] as [number, number]);
  // e mais um punhado espalhado pela grama que sobrou entre as casas (sempre nos mesmos lugares)
  for (let i = 0; i < 46; i++) {
    const x = (i * 37 + 5) % VW;
    const y = (i * 53 + 11) % VH;
    if (dist(x, y) > R_ANEL1 + 2.5) arvores.push([x, y]);
  }
  arvores.forEach(([x, y], i) => f.push(...naGrama(ocupado, [[i % 3 === 0 ? "arvore_retorcida" : i % 3 === 1 ? "arvore_retorcida~b" : "arvore_retorcida~c", x, y, 0]])));
  const arbustos = ([[10, 14], [20, 6], [37, 13], [45, 18], [40, 33], [12, 35], [26, 41], [8, 25], [30, 32], [17, 15]] as [number, number][]).map(([x, y]) => [k(x), k(y)]);
  arbustos.forEach(([x, y], i) => f.push(...naGrama(ocupado, [[i % 2 ? "arbusto_estranho~b" : "arbusto_estranho", x, y, 0]])));
  return f;
}

// ------------------------------------------------------------------ as cenas

const CENAS: CenaSpec[] = [
  {
    key: "vila",
    name: SANTO_BERCO + "Vila",
    description:
      "Santo Berço: a vila de casinhas de enxaimel e telhado vermelho em anel em volta do Labirinto Infinito, a sebe viva cheia de neblina, com quatro entradas e uma estátua de Guardião de vigia em cada uma. As estradas de terra correm em anel e em raios: a ferraria a noroeste, a taverna a nordeste, a torre do Porteiro na entrada, o hotel a leste, a casa do Doutor a sudoeste, o bosque da Provação ao sul, as minas na montanha a oeste. Nada de luz elétrica: postes com cristais vermelhos acesos. As árvores são tortas e de cores erradas (roxas, amarelas, azuladas), e aqui e ali o lodo preto brilha no chão.",
    layout: { heightmap: T_VILA.planta(), door: { x: VW - 1, y: ESTRADA_Y, dir: 6 } },
    andar: VILA,
    style: "grama",
    aberto: true,
    terreno: T_VILA.texto(),
    darkness: 0.32,
    fog: 0.18,
    ambient: "#b8a0c0",
    particles: ["dust"],
    floor: vilaPiso(),
    wall: [],
    links: [...ENTRADAS].map(([cena, [x, y]]) => [x, y, cena] as [number, number, string]),
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Torre do Porteiro
  {
    key: "torre",
    name: SANTO_BERCO + "Torre do Porteiro",
    description:
      "O térreo da torre redonda da entrada: pedra fria, a escada em caracol subindo pelo meio, a mesa do Porteiro com o livro de quem chega, o baú, os lampiões de cristal. Pela seteira se vê a estrada do portão.",
    layout: planTop(7, 7, 3),
    andar: TORRE,
    style: "calabouco",
    ...DENTRO,
    floor: [
      ["portal", 3, 1, 4],
      ["escada_espiral", 4, 4, 0],
      ["mesa_rustica", 0, 2, 2],
      ["banco_rustico", 2, 2, 2],
      ["books_stack", 0, 3, 0, hint("Livro do Porteiro", "A lista de quem entrou na vila. Os nomes de fora têm, do lado, \"Ajudante do Porteiro\" escrito depois.")],
      ["bau_madeira", 0, 7, 2],
      ["barril_madeira", 6, 2, 0],
      ["candles", 1, 6, 0],
    ],
    wall: [
      ["lampiao_cristal", "r", 1, 1.5, 2.6],
      ["lampiao_cristal", "l", 0, 5.0, 2.6],
      ["armas_parede", "r", 1, 5.4, 2.4],
    ],
    links: [
      [3, 1, "vila"],
      [4, 4, "torre2"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "torre2",
    name: SANTO_BERCO + "Alto da Torre",
    description:
      "O alto da torre: o quarto do Porteiro, a cama de palha, e no meio o cristal vermelho grande que faz da torre um farol, quente como brasa. Das janelas se vê a vila inteira e o labirinto coberto de névoa.",
    layout: planTop(7, 7, 3),
    andar: TORRE2,
    style: "calabouco",
    ...DENTRO,
    darkness: 0.38,
    floor: [
      ["escada_espiral", 4, 4, 0],
      ["cama_palha", 0, 1, 2],
      ["bau_madeira", 0, 4, 2],
      ["cristal_vermelho", 3, 2, 0, hint("O farol", "Um cristal vermelho do tamanho de uma cabeça. Esquenta o quarto inteiro; perto dele, o ar treme.")],
      ["cristal_vermelho", 3, 3, 0],
    ],
    wall: [
      ["window_barred", "r", 1, 5.2, 2.2],
      ["window_barred", "l", 0, 5.5, 2.2],
    ],
    links: [[4, 4, "torre"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Taverna
  {
    key: "taverna",
    name: SANTO_BERCO + "Taverna",
    description:
      "A taverna: o salão baixo de tábuas e vigas, as mesas compridas com os bancos, o balcão com as canecas de estanho e os barris atrás, a lareira acesa com o caldeirão. O Taverneiro serve \"Manteiga na Manteiga\" a quem chegar, de graça. Os Luzidios comem em silêncio e sorriem demais.",
    layout: planTop(14, 10, 7),
    andar: TAVERNA,
    style: "enxaimel",
    ...DENTRO,
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 7, 1, 4],
      // o balcão no fundo à direita, os barris atrás
      ["balcao_taverna", 9, 4, 4],
      ...de("barril_madeira", [9, 2], [10, 2], [12, 2], [13, 2]),
      ["barril_madeira", 13, 4, 0],
      ["stool", 9, 5, 0],
      ["stool", 11, 5, 0],
      // a lareira na parede da esquerda
      ["lareira", 0, 4, 2],
      // as mesas compridas com os bancos
      ["mesa_rustica", 2, 6, 4],
      ["banco_rustico", 2, 5, 4],
      ["banco_rustico", 2, 8, 0],
      ["mesa_rustica", 7, 7, 4],
      ["banco_rustico", 7, 6, 4],
      ["banco_rustico", 7, 9, 0],
      ["bau_madeira", 13, 10, 0],
    ],
    wall: [
      ["placa_taverna", "r", 1, 11.0, 2.6],
      ["lampiao_cristal", "r", 1, 4.0, 2.7],
      ["lampiao_cristal", "r", 1, 13.0, 2.7],
      ["lampiao_cristal", "l", 0, 8.5, 2.7],
      ["armas_parede", "l", 0, 2.0, 2.5],
    ],
    links: [[7, 1, "vila"]],
    plan: { x: 0, y: 0 },
    chao: [[8, 8, "Caneca de Estanho", 1, "misc"]],
  },
  // ------------------------------------------------------------ a Ferraria e o quarto do Ferreiro
  {
    key: "ferraria",
    name: SANTO_BERCO + "Ferraria",
    description:
      "A forja do Ferreiro, o líder da vila: o chão de pedra preto de fuligem, a forja acesa com um cristal vermelho no meio do carvão, a bigorna, a tina de têmpera, e por toda parte espadas, machados, arcos, escudos e armaduras — nenhuma arma de fogo. No fundo à esquerda, a porta do quarto dele.",
    layout: planTop(11, 8, 5),
    andar: FERRARIA,
    style: "ferraria",
    ...DENTRO,
    darkness: 0.46,
    ambient: "#c07850",
    particles: ["dust", "embers"],
    floor: [
      ["portal", 5, 1, 4],
      ["portal", 0, 2, 2],
      ["forja", 7, 2, 4, hint("A forja", "Não tem carvão de verdade: no meio das brasas, um cristal vermelho mantém o ferro em brasa sem nunca apagar.")],
      ["bigorna", 7, 5, 0],
      ["tina_agua", 9, 5, 0],
      ["rack_medieval", 10, 6, 6],
      ["armadura_medieval", 10, 8, 6],
      ["armadura_medieval", 0, 8, 2],
      ["table_tools", 2, 6, 2],
      ["barril_madeira", 0, 5, 0],
      ["crate_wood", 3, 8, 0],
    ],
    wall: [
      ["ferramentas_parede", "r", 1, 3.0, 2.3],
      ["armas_parede", "r", 1, 9.6, 2.6],
      ["lampiao_cristal", "l", 0, 6.0, 2.6],
    ],
    links: [
      [5, 1, "vila"],
      [0, 2, "quarto_ferreiro"],
    ],
    plan: { x: 7, y: 0 },
  },
  {
    key: "quarto_ferreiro",
    name: SANTO_BERCO + "Quarto do Ferreiro",
    description:
      "O quarto do Ferreiro, atrás da forja: a cama de palha, o baú, a mesinha com a vela. No chão, uma escotilha de ferro pesada, sem puxador por cima: só abre por baixo.",
    layout: planTop(6, 6, 3),
    andar: FERRARIA,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.56,
    floor: [
      ["portal", 3, 1, 4],
      ["cama_palha", 0, 1, 2],
      ["bau_madeira", 0, 4, 2],
      ["nightstand", 0, 5, 2],
      ["candles", 0, 6, 0],
      ["rug_worn", 3, 3, 0],
      ["escotilha", 4, 6, 0, oculta("A escotilha", "Ferro grosso, sem argola nem fechadura deste lado. Por baixo dela, um barulho de vento — ou de respiração."), 2],
    ],
    wall: [["lampiao_cristal", "r", 1, 1.6, 2.6]],
    links: [[3, 1, "ferraria"]],
    plan: { x: 0, y: 0 },
  },
];

// ------------------------------------------------------------------ montagem

/** A neblina enche o labirinto inteiro, até a sebe de fora (a escala da peça é o raio: 4 casas na escala 1). */
function neblinaDoLabirinto(room: RoomData) {
  for (const it of room.items) if (it.defId === "neblina_densa") it.escala = Math.round(((R_LAB - 0.6) / 4) * 100) / 100;
}

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

/** Monta Santo Berço inteiro e a campanha dele (o lugar "Santo Berço" do mapa-múndi). */
export function seedSantoBerco(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(SANTO_BERCO))) return;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    const room = montar(db, spec);
    estilo(room, spec);
    neblinaDoLabirinto(room);
    built.set(spec.key, room);
  }
  ligar(built);
  db.rooms.push(...built.values());
  const primeira = built.get(CENAS[0].key)!;
  db.campaigns ??= {};
  db.campaigns[String(primeira.id)] = {
    title: "Santo Berço",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.santoBercoRev = SANTO_BERCO_REV;
}

/** Refaz Santo Berço no lugar quando a montagem muda (SANTO_BERCO_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildSantoBerco(db: Database): boolean {
  if ((db.santoBercoRev ?? 0) >= SANTO_BERCO_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(SANTO_BERCO));
  if (!existing.length) return false;
  const key = Math.min(...existing.map((r) => r.id));
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    let room = existing.find((r) => r.name === spec.name);
    const fresh = montar(db, spec);
    if (room) {
      db.nextRoomId--;
      Object.assign(room, { name: fresh.name, description: fresh.description, heightmap: fresh.heightmap, door: fresh.door, items: fresh.items, wallItems: fresh.wallItems });
    } else {
      room = fresh;
      db.rooms.push(room);
    }
    estilo(room, spec);
    neblinaDoLabirinto(room);
    built.set(spec.key, room);
  }
  ligar(built);
  const ficam = new Set([...built.values()].map((r) => r.id));
  const vila = built.get("vila")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (vila.tokens ??= []).push({ ...t, x: vila.door.x, y: vila.door.y });
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
  db.santoBercoRev = SANTO_BERCO_REV;
  return true;
}

/** Monta Santo Berço se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarSantoBerco(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(SANTO_BERCO))) {
    seedSantoBerco(db);
    return true;
  }
  return rebuildSantoBerco(db);
}
