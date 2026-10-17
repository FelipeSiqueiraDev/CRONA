import { getFurni, RoomMap, type Door, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed } from "./seed";
import { planBottom, planRight, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * Santo Berço (14/10), o quarto lugar da campanha (docs/SANTO-BERCO.md): a vila anacrônica que nasce em volta da
 * Relíquia de Morte. Cara de vila medieval (sem eletricidade, sem armas de fogo), em ANEL em volta do Labirinto
 * Infinito, com as estradas de terra em anel e em raios; a luz vem dos cristais vermelhos. Os moradores (Luzidios)
 * vivem numa hipnose confortável e nada se paga.
 *
 * Primeira leva (14/10): a vila de fora inteira (todos os prédios no lugar, o labirinto, as quatro estátuas dos
 * Guardiões, os postes de cristal, o lodo preto) e por dentro a Torre do Porteiro (dois andares), a Taverna, a Ferraria
 * e o quarto do Ferreiro (com a escotilha que dá no bunker).
 *
 * Segunda leva (15/10, "vamos fazer o restante de Santo Berço"): o Hotel de dois andares (o hall dos quatro retratos e
 * o corredor dos quartos), a Casa do Doutor (a sala, o consultório e o quarto), a Fazenda ao norte (os dois celeiros e
 * a casa da Fazendeira), o Bosque da Provação ao sul, as Minas a oeste (as galerias de cada cor de cristal e a câmara
 * dos Cristais Pretos), o Bunker dos Guardiões (entre o fundo das minas e a escotilha do Ferreiro), o Labirinto
 * Infinito por dentro e a Caverna embaixo dele (as celas brancas e o lugar do Parasita de Dimensões).
 *
 * Na vila, o norte é o alto do mapa: o portão a leste (direita), a ferraria a noroeste, a taverna a nordeste, a casa do
 * Doutor a sudoeste; as estradas saem pela borda para a fazenda (norte), o bosque (sul) e as minas (oeste).
 */
export const SANTO_BERCO = "Santo Berço · ";
export const SANTO_BERCO_REV = 16;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);
const giro = (id: string, rot: number, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, rot] as FloorSeed);

const VILA = "Vila";
const TORRE = "Torre do Porteiro";
const TORRE2 = "Torre do Porteiro 2º";
const TAVERNA = "Taverna";
const FERRARIA = "Ferraria";
const HOTEL = "Hotel";
const HOTEL2 = "Hotel 2º";
const DOUTOR = "Casa do Doutor";
const DOUTOR2 = "Casa do Doutor 2º";
const MINAS = "Minas";
const CAVERNA = "Caverna";

/** O clima de dentro: a luz vermelha e morna dos cristais. */
const DENTRO = { darkness: 0.5, ambient: "#b07060", particles: ["dust"] as CenaSpec["particles"] };

/** A cena de Santo Berço: a de sempre e, se tiver neblina densa, o raio dela em casas (a escala da peça é raio / 4). */
type Cena = CenaSpec & { neblina?: number };

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
/** as saídas pela borda: a estrada do norte (a fazenda) e a do sul (o bosque) ocupam as colunas CX - 1 e CX */
const SAIDA_X = CX - 1;
/** a boca das minas (oeste): a encosta da montanha com o portal de troncos virado para a vila (giro 2, a frente +x) */
const MINA: [number, number] = [0, CY - 2];
const MINA_ENTRADA: [number, number] = [4, CY];

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
  t.linha([[CX, CY - R_ANEL0], [CX, 0]], "t", 2); // norte: a fazenda (sai pela borda)
  t.linha([[CX - 7.5 * K, CY + 8 * K], [11 * K, 29 * K]], "t", 2); // sudoeste: a casa do Doutor
  t.linha([[CX, CY + R_ANEL0], [CX, VH]], "t", 2); // sul: o bosque (sai pela borda)
  t.linha([[CX - R_ANEL0, CY], [0, CY]], "t", 2); // oeste: as minas
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

/**
 * Os prédios da vila (na grade do desenho): [def, x, y, giro, cena de dentro]. O celeiro saiu da vila (15/10): a
 * Fazenda virou uma cena própria, ao norte, com os dois celeiros e a casa da Fazendeira.
 */
const PREDIOS_DESENHO: [string, number, number, 0 | 4, string][] = [
  ["ferraria_predio", 8, 6, 4, "ferraria"],
  ["taverna_predio", 31, 3, 4, "taverna"],
  ["torre_porteiro", 40, 14, 4, "torre"],
  ["hotel_predio", 34, 25, 0, "hotel"],
  ["casa_doutor", 5, 31, 0, "doutor"],
  ["casa_vila", 1, 12, 4, "casa1"],
  ["casa_vila", 18, 37, 0, "casa2"],
  ["casa_vila", 27, 36, 0, "casa3"],
  ["casa_vila", 36, 36, 0, "casa4"],
];
const PREDIOS = PREDIOS_DESENHO.map(([id, x, y, r, cena]) => [id, ...espalha(id, x, y), r, cena] as [string, number, number, 0 | 4, string]);
const ENTRADAS = new Map(PREDIOS.map(([id, x, y, r, cena]) => [cena, porta(id, x, y, r)]));
/** O lado da porta de cada prédio (o giro 4 olha para a frente da tela, o 0 para o fundo): o de dentro segue. */
const LADO = new Map(PREDIOS.map(([, , , r, cena]) => [cena, r === 4 ? ("frente" as const) : ("fundo" as const)]));

/**
 * As quatro entradas do labirinto (o Felipe, 14/10, marcadas no print): no meio de cada lado dele na tela (no chão, o
 * norte, o leste, o sul e o oeste), cada uma com a sua estátua do lado.
 */
const ENTRADAS_LAB = [-0.5 * Math.PI, 0, 0.5 * Math.PI, Math.PI];
/** a distância entre dois ângulos (0..π) */
const entre = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** a casa do vão de cada entrada do labirinto na sebe de fora (a do meio do vão), onde fica a Entrada do Labirinto */
function vaosDoLabirinto(): [number, number][] {
  return ENTRADAS_LAB.map((e) => {
    let melhor: [number, number] = [0, 0];
    let menor = Infinity;
    for (let y = 0; y < VH; y++)
      for (let x = 0; x < VW; x++) {
        const d = dist(x, y);
        if (d < R_LAB - 0.5 || d >= R_LAB + 0.5) continue;
        const a = entre(Math.atan2(y + 0.5 - CY, x + 0.5 - CX), e);
        if (a < menor) [menor, melhor] = [a, [x, y]];
      }
    return melhor;
  });
}
const VAOS_LAB = vaosDoLabirinto();

/**
 * A sebe do labirinto: o anel de fora com as quatro entradas; duas paredes (sudeste e noroeste) cortam o corredor em
 * duas metades; o anel de dentro abre só a nordeste e a sudoeste, então de cada entrada se dá a volta até o miolo.
 */
function labirinto(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const d = dist(x, y);
      const ang = Math.atan2(y + 0.5 - CY, x + 0.5 - CX);
      const fora = d >= R_LAB - 0.5 && d < R_LAB + 0.5 && ENTRADAS_LAB.every((e) => entre(ang, e) > 0.15);
      const dentro = d >= R_DENTRO && d < R_DENTRO + 1 && entre(ang, -0.25 * Math.PI) > 0.24 && entre(ang, 0.75 * Math.PI) > 0.24;
      const raio = d >= R_DENTRO + 1 && d < R_LAB - 0.5 && (entre(ang, 0.25 * Math.PI) < 0.08 || entre(ang, -0.75 * Math.PI) < 0.08);
      if (fora || dentro || raio) f.push(["sebe", x, y, 0]);
    }
  return f;
}

/** as quatro estátuas dos Guardiões (2 × 2): uma do lado de cada entrada do labirinto, de costas para ele */
function estatuas(): FloorSeed[] {
  return ENTRADAS_LAB.map((e, i) => {
    const a = e + 0.3;
    const x = Math.round(CX + Math.cos(a) * R_EST - 1);
    const y = Math.round(CY + Math.sin(a) * R_EST - 1);
    // de costas para o labirinto, olhando para quem chega (o Felipe, 14/10)
    const rot = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 6) : Math.sin(a) > 0 ? 4 : 0;
    return [i % 2 ? "estatua_guardiao~b" : "estatua_guardiao", x, y, rot, hint("Estátua de Guardião", "Uma das quatro estátuas dos Guardiões, de costas para o Labirinto, de vigia numa entrada dele. O rosto foi gasto até sumir.")] as FloorSeed;
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
function naGrama(t: Terreno, ocupado: Set<string>, list: FloorSeed[]): FloorSeed[] {
  const ok = list.filter(([, x, y]) => t.at(x, y) === "." && !ocupado.has(`${x},${y}`));
  // o que entra passa a ocupar a casa: duas plantas sorteadas para o mesmo lugar não se empilham (a segunda era recusada)
  for (const [id, x, y, r] of ok) {
    const def = getFurni(id.split("~")[0]);
    const [sx, sy] = !def ? [1, 1] : r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) ocupado.add(`${x + dx},${y + dy}`);
  }
  return ok;
}

/** as casas ocupadas pelas peças de uma lista (para a vegetação não cair em cima) */
function ocupacao(f: FloorSeed[]): Set<string> {
  const ocupado = new Set<string>();
  for (const [id, x, y, r] of f) {
    const def = getFurni(id.split("~")[0]);
    if (!def) continue;
    const [sx, sy] = r === 2 || r === 6 ? [def.depth, def.width] : [def.width, def.depth];
    for (let dy = 0; dy < sy; dy++) for (let dx = 0; dx < sx; dx++) ocupado.add(`${x + dx},${y + dy}`);
  }
  return ocupado;
}

function vilaPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [id, x, y, r, cena] of PREDIOS) f.push([id, x, y, r], ["entrada", ...ENTRADAS.get(cena)!, r]);
  f.push(["portao_vila", PORTAO_X, ESTRADA_Y - 1, 2, hint("Portão de Santo Berço", "O arco de troncos no fim da estrada. Do lado de dentro, o ar fica mais pesado e o tempo parece andar diferente.")]);
  // as saídas pela borda: a fazenda (norte), o bosque (sul) e a boca das minas (oeste), cada uma com a placa
  f.push(["entrada_larga", SAIDA_X, 0, 0], ["entrada_larga", SAIDA_X, VH - 1, 4]);
  f.push(["placa", SAIDA_X + 2, 1, 4, hint("Placa", "\"Fazenda\", entalhado na tábua. Embaixo, à faca: \"os bichos dormem escondidos\".")]);
  f.push(["placa", SAIDA_X - 1, VH - 3, 0, hint("Placa", "\"Bosque da Provação\". Ninguém da vila passa por aqui sem baixar a cabeça.")]);
  f.push(["boca_mina", ...MINA, 2, hint("As Minas", "A boca das minas na encosta: o portal de troncos, o trilho saindo do escuro e o cristal vermelho pendurado. Lá dentro, cada galeria tem a sua cor.")]);
  f.push(["entrada", ...MINA_ENTRADA, 2]);
  // as quatro entradas do labirinto, no vão da sebe de fora (dão no Labirinto Infinito por dentro)
  for (const [x, y] of VAOS_LAB) f.push(["entrada", x, y, 0]);
  // o poste que cairia dentro de um prédio fica de fora
  const dentroDe = (x: number, y: number) =>
    [...PREDIOS.map(([id, px, py, r]): [string, number, number, number] => [id, px, py, r]), ["boca_mina", ...MINA, 2] as [string, number, number, number]].some(([id, px, py, r]) => {
      const d = getFurni(id)!;
      const [sx, sy] = r === 2 || r === 6 ? [d.depth, d.width] : [d.width, d.depth];
      return x >= px && x < px + sx && y >= py && y < py + sy;
    });
  f.push(...labirinto(), ...estatuas(), ...postes().filter(([, x, y]) => !dentroDe(x, y)));
  // o poço e o lodo preto: uma poça no chão batido perto da entrada do labirinto, outra no caminho das minas
  f.push(["poco", k(29), k(13), 0]);
  f.push(["lodo_preto", CX + k(7), CY + k(2), 0, oculta("Lodo Preto", "Brilha como se tivesse luz por dentro. Quem olha muito tempo sente vontade de tocar.")]);
  f.push(["lodo_preto", k(4), CY + k(3), 0], ["lodo_preto", k(14), k(26), 0]);
  // a neblina grossa que esconde o miolo do labirinto (o raio vem da escala da peça: Cena.neblina)
  f.push(["neblina_densa", CX, CY, 0]);
  // os cristais soltos: o vermelho na porta da ferraria, o verde na casa do Doutor, o azul atrás da taverna
  f.push(["cristal_vermelho", k(7), k(13), 0], ["cristal_verde", k(16), k(30), 0], ["cristal_azul", k(41), k(4), 0]);
  // a entrada das minas (oeste): as pedras na encosta
  f.push(...de("pedras", [0, CY - k(4)], [1, CY - k(3)], [0, CY + k(4)], [2, CY + k(5)], [1, CY + k(7)], [3, CY - k(2)], [2, CY - k(6)], [0, CY + k(9)]));
  // o resto da vila: barris e caixotes nas portas, a carroça na estrada
  f.push(["barril_madeira", k(30), k(11), 0], ["barril_madeira", k(41), k(11), 0], ["crate_wood", k(16), k(12), 0], ["carroca", k(44), k(25), 0]);
  const ocupado = ocupacao(f);
  // as árvores retorcidas: a mata do sul e da montanha a oeste e as soltas pela vila
  const arvores: [number, number][] = ([
    [2, 40], [5, 42], [9, 40], [13, 42], [14, 38], [30, 42], [33, 40], [40, 42], [44, 40], [46, 37],
    [3, 3], [6, 1], [1, 7], [12, 2], [46, 2], [45, 9], [43, 30], [46, 33], [2, 28], [1, 34],
    [15, 17], [33, 16], [16, 27], [32, 28], [21, 32], [27, 10], [17, 3], [20, 1], [29, 2],
  ] as [number, number][]).map(([x, y]) => [k(x), k(y)] as [number, number]);
  // e mais um punhado espalhado pela grama que sobrou entre as casas (sempre nos mesmos lugares)
  for (let i = 0; i < 46; i++) {
    const x = (i * 37 + 5) % VW;
    const y = (i * 53 + 11) % VH;
    if (dist(x, y) > R_ANEL1 + 2.5) arvores.push([x, y]);
  }
  arvores.forEach(([x, y], i) => f.push(...naGrama(T_VILA, ocupado, [[i % 3 === 0 ? "arvore_retorcida" : i % 3 === 1 ? "arvore_retorcida~b" : "arvore_retorcida~c", x, y, 0]])));
  const arbustos = ([[10, 14], [20, 6], [37, 13], [45, 18], [40, 33], [12, 35], [26, 41], [8, 25], [30, 32], [17, 15], [15, 4], [23, 3]] as [number, number][]).map(([x, y]) => [k(x), k(y)]);
  arbustos.forEach(([x, y], i) => f.push(...naGrama(T_VILA, ocupado, [[i % 2 ? "arbusto_estranho~b" : "arbusto_estranho", x, y, 0]])));
  return f;
}

/** as passagens da vila: a entrada de cada prédio, as saídas pela borda, as minas e as quatro do labirinto */
const LINKS_VILA: [number, number, string][] = [
  ...[...ENTRADAS].map(([cena, [x, y]]) => [x, y, cena] as [number, number, string]),
  [SAIDA_X, 0, "fazenda"],
  [SAIDA_X, VH - 1, "bosque"],
  [...MINA_ENTRADA, "minas"],
  ...VAOS_LAB.map(([x, y]) => [x, y, "labirinto"] as [number, number, string]),
];

// ------------------------------------------------------------------ a casinha padrão

/**
 * A casinha padrão, sem nome (o Felipe, 14/10: "simples mas completinha e bonita"), para toda casa da vila ainda sem interior
 * próprio: a sala de enxaimel com a lareira, a mesa comprida com os bancos, a cama de palha com o criado, a prateleira,
 * o baú, os barris e os lampiões. `lado`: a porta de fora está virada para a frente da tela (a de dentro na parede da
 * frente, a que não aparece) ou para o fundo (na parede do fundo). Vem do giro do prédio na vila (LADO).
 */
function casaPadrao(key: string, nome: string, description: string): Cena {
  const fundo = LADO.get(key) === "fundo";
  // na planta com a porta no fundo, a sala começa na fileira 1 (a 0 é o vão da porta)
  const y0 = fundo ? 1 : 0;
  const Y = (y: number) => y + y0;
  return {
    key,
    name: SANTO_BERCO + nome,
    description,
    layout: fundo ? planTop(9, 7, 4) : planBottom(9, 7, 4),
    andar: nome,
    style: "enxaimel",
    ...DENTRO,
    floor: [
      fundo ? ["portal", 4, 1, 4] : ["portal", 4, 6, 0],
      ["lareira_cristal", 0, Y(1), 2],
      ["prateleira", 2, Y(0), 4],
      ["cama_palha", 7, Y(0), 4],
      ["nightstand", 6, Y(0), 4],
      ["mesa_rustica", 3, Y(3), 4],
      ["banco_rustico", 3, Y(2), 4],
      ["banco_rustico", 3, Y(5), 0],
      ["rug_worn", 6, Y(3), 0],
      ["bau_madeira", 8, Y(4), 6],
      ["barril_madeira", 0, Y(6), 0],
      ["barril_madeira", 1, Y(6), 0],
      // em cima da mesa: a jarra com as canecas, o pão e a vela; a lenha do lado da lareira; o caixote no canto
      ["jarra_canecas", 4, Y(3), 0],
      ["cesta_pao", 3, Y(4), 0],
      ["velas_cristal", 5, Y(4), 0],
      ["lenha", 0, Y(4), 0],
      ["crate_wood", 8, Y(6), 0],
    ],
    wall: [
      ["lampiao_cristal", "r", y0, 6.2, 2.6],
      ["window_barred", "r", y0, 7.6, 2.2],
      ["lampiao_cristal", "l", 0, Y(5), 2.6],
    ],
    links: [[4, fundo ? 1 : 6, "vila"]],
    plan: { x: 0, y: 0 },
  };
}

// ------------------------------------------------------------------ a fazenda (norte)

const FW = 44;
const FH = 34;
/** os dois celeiros (12 × 8, a porta larga na frente, a Entrada Larga em x + 5) e a casa da Fazendeira (7 × 6) */
const CELEIRO_A: [number, number] = [3, 3];
const CELEIRO_B: [number, number] = [29, 3];
const CASA_F: [number, number] = [17, 15];
const ent = ([x, y]: [number, number]): [number, number] => [x + 5, y + 8];
const ENT_CASA_F = porta("casa_fazendeira", ...CASA_F, 4);

function terrenoFazenda(): Terreno {
  const t = new Terreno(FW, FH);
  // o terreiro de terra batida na frente dos celeiros e da casa
  t.ret(3, 11, 40, 13, "d");
  t.ret(15, 14, 26, 22, "d");
  // a estrada da vila (sul) até o terreiro, e o caminho de cada porta
  t.linha([[21, FH], [21, 14]], "t", 2);
  t.linha([[ent(CELEIRO_A)[0] + 1, 12], [ent(CELEIRO_B)[0] + 1, 12]], "t", 2);
  // as roças: a horta (à esquerda) e o milharal (à direita), atrás da cerca
  t.ret(3, 24, 14, 30, "l");
  t.ret(28, 24, 40, 30, "l");
  return t;
}
const T_FAZ = terrenoFazenda();

function fazendaPiso(): FloorSeed[] {
  const f: FloorSeed[] = [
    ["entrada_larga", 20, FH - 1, 4],
    ["celeiro", ...CELEIRO_A, 4, hint("Celeiro da Fazendeira", "O celeiro grande, das baias e da carroça. Toda noite, os bichos somem dentro dele.")],
    ["entrada_larga", ...ent(CELEIRO_A), 4],
    ["celeiro", ...CELEIRO_B, 4, hint("Celeiro Velho", "O celeiro de trás, mais velho, a tábua escurecida. Dele vem um barulho de casco e de respiração, sem bicho nenhum à vista.")],
    ["entrada_larga", ...ent(CELEIRO_B), 4],
    ["casa_fazendeira", ...CASA_F, 4],
    ["entrada", ...ENT_CASA_F, 4],
    ["placa", 23, FH - 3, 0, hint("Placa", "\"Fazenda\". Os campos de Santo Berço dão de tudo, o ano inteiro, e ninguém lembra de ter plantado.")],
    // o terreiro: o poço, a carroça, o feno, as sacas e os barris
    ["poco", 27, 17, 0],
    ["carroca", 12, 14, 0],
    ...de("feno", [15, 6], [16, 6], [15, 7], [16, 9], [27, 6], [27, 7], [28, 9]),
    ...de("sacas", [24, 15], [25, 15], [24, 16]),
    ...de("barril_madeira", [14, 15], [14, 16], [24, 19]),
    ["cristal_azul", 16, 20, 0, hint("Cristal Azul", "Encostado na parede da casa, o cristal azul que gela o que a Fazendeira guarda: a geladeira dela.")],
    ...de("poste_cristal", [19, 23], [24, 23], [10, 12], [36, 13]),
    // a cerca das roças, com a passagem no meio (a estrada)
    ...[...Array(13).keys()].map((i): FloorSeed => ["cerca", 2 + i, 23, 4]),
    ...[...Array(14).keys()].map((i): FloorSeed => ["cerca", 27 + i, 23, 4]),
    ...[...Array(7).keys()].map((i): FloorSeed => ["cerca", 2, 24 + i, 2]),
    ...[...Array(7).keys()].map((i): FloorSeed => ["cerca", 41, 24 + i, 2]),
  ];
  for (let y = 24; y <= 30; y += 2) for (let x = 3; x <= 14; x++) f.push([(x + y) % 3 ? "horta" : "horta~b", x, y, 4]);
  for (let y = 24; y <= 30; y += 2) for (let x = 28; x <= 40; x++) f.push(["milharal", x, y, 4]);
  f.push(["arbusto_estranho", 23, 25, 0, oculta("O pasto vazio", "De dia o pasto fica cheio de bichos de anatomia esquisita (a cabra de seis patas, a galinha sem bico). Ao anoitecer, somem todos para dentro dos celeiros.")]);
  const ocupado = ocupacao(f);
  const arvores: [number, number][] = [
    [0, 1], [1, 12], [0, 18], [1, 26], [0, 32], [43, 0], [42, 9], [43, 16], [42, 22], [43, 31], [17, 1], [22, 0], [26, 2],
    [10, 20], [32, 19], [7, 17], [37, 17], [4, 32], [12, 33], [30, 33], [38, 32], [18, 31], [26, 30],
  ];
  arvores.forEach(([x, y], i) => f.push(...naGrama(T_FAZ, ocupado, [[["arvore_retorcida", "arvore_retorcida~b", "arvore_retorcida~c"][i % 3], x, y, 0]])));
  const arbustos: [number, number][] = [[2, 15], [8, 21], [34, 20], [40, 15], [14, 1], [29, 1], [20, 28], [24, 30]];
  arbustos.forEach(([x, y], i) => f.push(...naGrama(T_FAZ, ocupado, [[i % 2 ? "arbusto_estranho~b" : "arbusto_estranho", x, y, 0]])));
  return f;
}

// ------------------------------------------------------------------ o bosque da provação (sul)

const BW = 40;
const BH = 32;

function terrenoBosque(): Terreno {
  const t = new Terreno(BW, BH);
  // a trilha da vila (norte) que desce até a clareira dos tocos e dá a volta pelas árvores dos mortos
  t.linha([[20, 0], [20, 9]], "t", 2);
  t.disco(20, 15, 8.5, 6.2, "d");
  t.volta(3, 4, 37, 29, 6, "d", 2);
  t.linha([[20, 21], [20, 27]], "d", 2);
  return t;
}
const T_BOSQUE = terrenoBosque();

/** as árvores dos mortos (cada um enterrado embaixo da sua): o túmulo fica na frente da árvore */
const ARVORES_MORTOS: [number, number][] = [
  [5, 6], [9, 3], [14, 4], [27, 4], [31, 3], [35, 6], [36, 12], [36, 19], [35, 25], [29, 27], [12, 27], [6, 25], [3, 19], [3, 12],
];

function bosquePiso(): FloorSeed[] {
  const f: FloorSeed[] = [["entrada_larga", 19, 0, 0]];
  // a clareira dos tocos: o toco da árvore de cada morador, em fileiras tortas
  const nomes = ["Ferreiro", "Porteiro", "Doutor", "Taverneiro", "Hoteleiro", "Fazendeira", "Minerador", "Peregrino", "Coletor", "Guarda", "Artista", "Tecelão"];
  let n = 0;
  for (let fila = 0; fila < 5; fila++)
    for (let col = 0; col < 7; col++) {
      const x = 14 + col * 2 + (fila % 2);
      const y = 11 + fila * 2;
      if (x === 20 || x === 21) continue;
      const nome = nomes[n++];
      f.push(["toco_morador", x, y, (col * 2) % 8, nome ? hint(`Toco do ${nome}`, `O toco cortado da árvore do ${nome}. Cada um que chega a Santo Berço ganha a sua árvore; quando passa pela Provação, cortam o tronco e fica o toco.`) : undefined]);
    }
  // as árvores dos mortos, cada uma com o túmulo embaixo
  ARVORES_MORTOS.forEach(([x, y], i) => {
    f.push([["arvore_retorcida", "arvore_retorcida~b", "arvore_retorcida~c"][i % 3], x, y, 0]);
    f.push([i % 3 === 1 ? "tumulo~b" : "tumulo", x, y + 1, 4, i === 0 ? hint("Túmulo", "Os mortos de Santo Berço são enterrados cada um embaixo da sua árvore. A terra ainda está fofa.") : undefined]);
  });
  f.push(["lodo_preto", 30, 15, 0, oculta("Lodo Preto", "Uma poça de lodo no meio das raízes. As raízes em volta estão pretas também.")], ["lodo_preto", 8, 17, 0]);
  f.push(...de("pedras", [24, 22], [16, 22], [33, 9]), ["poste_cristal", 22, 8, 0], ["poste_cristal", 18, 22, 0]);
  const ocupado = ocupacao(f);
  // e o resto do bosque: as árvores retorcidas bem juntas, roxas, amarelas e azuladas
  const mais: [number, number][] = [];
  for (let i = 0; i < 120; i++) mais.push([(i * 23 + 7) % BW, (i * 31 + 3) % BH]);
  mais.forEach(([x, y], i) => f.push(...naGrama(T_BOSQUE, ocupado, [[["arvore_retorcida~c", "arvore_retorcida", "arvore_retorcida~b"][i % 3], x, y, 0]])));
  const arbustos: [number, number][] = [[11, 9], [28, 9], [11, 20], [29, 20], [17, 6], [24, 6], [2, 30], [37, 30]];
  arbustos.forEach(([x, y], i) => f.push(...naGrama(T_BOSQUE, ocupacao(f), [[i % 2 ? "arbusto_estranho~b" : "arbusto_estranho", x, y, 0]])));
  return f;
}

// ------------------------------------------------------------------ o labirinto infinito por dentro

/** o labirinto: um círculo de 41 casas, os anéis de sebe em espiral e o miolo com a boca da caverna */
const LW = 41;
const LC = LW / 2;
const L_ANEIS = [19, 15, 11, 7];
/** o vão de cada anel de dentro (em radianos) e a parede que corta o corredor do lado de fora dele (a volta obrigada) */
const L_VAOS = [0.9, 3.4, 5.4];
const ld = (x: number, y: number) => Math.hypot(x + 0.5 - LC, y + 0.5 - LC);
const la = (x: number, y: number) => Math.atan2(y + 0.5 - LC, x + 0.5 - LC);
/** as quatro entradas, na borda (norte, leste, sul, oeste), como na vila */
const L_ENTRADAS: [number, number][] = [
  [20, 0],
  [40, 20],
  [20, 40],
  [0, 20],
];

function plantaLabirinto(): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < LW; y++) rows.push(Array.from({ length: LW }, (_, x) => (ld(x, y) <= 20.6 ? "0" : "x")).join(""));
  return { heightmap: rows.join("\n"), door: { x: 39, y: 20, dir: 6 } };
}

function terrenoLabirinto(): string {
  const rows: string[] = [];
  for (let y = 0; y < LW; y++) rows.push(Array.from({ length: LW }, (_, x) => (ld(x, y) < 5 ? "p" : ld(x, y) <= 19.5 ? "d" : ".")).join(""));
  return rows.join("\n");
}

function labirintoPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  for (const [x, y] of L_ENTRADAS) f.push(["entrada", x, y, 0]);
  for (let y = 0; y < LW; y++)
    for (let x = 0; x < LW; x++) {
      const d = ld(x, y);
      const a = la(x, y);
      let sebe = false;
      L_ANEIS.forEach((R, i) => {
        if (Math.abs(d - R) >= 0.5) return;
        // o anel de fora abre nas quatro entradas; os de dentro, cada um num vão só
        const vaos = i === 0 ? ENTRADAS_LAB : [L_VAOS[i - 1]];
        if (vaos.every((v) => entre(a, v) * R > 1.05)) sebe = true;
      });
      // a parede que corta cada corredor logo depois do vão do anel de dentro: dá a volta inteira para achar a passagem
      for (let i = 0; i < L_VAOS.length; i++) {
        const [r0, r1] = [L_ANEIS[i + 1] + 0.5, L_ANEIS[i] - 0.5];
        if (d >= r0 && d < r1 && entre(a, L_VAOS[i] + 2.6 / L_ANEIS[i + 1]) * d < 0.55) sebe = true;
      }
      if (sebe) f.push(["sebe", x, y, 0]);
    }
  // o miolo: a boca da caverna, a neblina mais grossa, e o que ficou de quem se perdeu
  f.push(["boca_caverna", 19, 19, 4, oculta("A boca da Caverna", "No meio da névoa, o chão se abre num buraco de pedra com degraus descendo. Sobe dele um ar frio e úmido, e um cheiro doce de lodo.")]);
  f.push(["neblina_densa", 21, 20, 0]);
  f.push(["lodo_preto", 24, 31, 0], ["lodo_preto", 8, 14, 0], ["lodo_preto", 30, 9, 0]);
  // o que ficou pelos corredores (só onde não tem sebe)
  const ocupado = ocupacao(f);
  const solto: FloorSeed[] = [
    ["skull", 12, 27, 0, oculta("Crânio", "Um crânio no meio do corredor, as raízes da sebe passando por dentro dele. Alguém entrou sem o Símbolo Espiral.")],
    ["skull", 34, 22, 2],
    ...de("pedras", [18, 23], [23, 18], [9, 30], [31, 8]),
    ["arbusto_estranho", 22, 24, 0],
    ["arbusto_estranho~b", 17, 18, 0],
    ["arbusto_estranho", 5, 12, 0],
    ["arbusto_estranho~b", 35, 28, 0],
  ];
  f.push(...solto.filter(([, x, y]) => !ocupado.has(`${x},${y}`) && ld(x, y) < 19));
  return f;
}

// ------------------------------------------------------------------ as minas (oeste)

/** o trilho ao comprido da galeria (giro 2: ao longo de x), de x0 a x1 na fileira y */
const trilho = (y: number, x0: number, x1: number): FloorSeed[] => [...Array(x1 - x0 + 1).keys()].map((i): FloorSeed => ["trilho_mina", x0 + i, y, 2]);
/** o chão de terra das galerias, com as manchas de cascalho (o terreno vale dentro das paredes também) */
function chaoDeMina(w: number, h: number, porta: [number, number], seed: number): string {
  const rows: string[] = [];
  for (let y = 0; y <= h; y++)
    rows.push(
      Array.from({ length: w + 1 }, (_, x) => {
        const r = Math.sin(x * 12.9898 + y * 78.233 + seed * 3.1) * 43758.5453;
        return (x === porta[0] && y === porta[1]) || r - Math.floor(r) > 0.78 ? "p" : "d";
      }).join(""),
    );
  return rows.join("\n");
}

const MINA_CLIMA = { style: "calabouco" as const, darkness: 0.62, fog: 0.12, particles: ["dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ as cenas

const CENAS: Cena[] = [
  {
    key: "vila",
    name: SANTO_BERCO + "Vila",
    description:
      "Santo Berço: a vila de casinhas de enxaimel e telhado vermelho em anel em volta do Labirinto Infinito, a sebe viva cheia de neblina, com quatro entradas e uma estátua de Guardião de vigia em cada uma. As estradas de terra correm em anel e em raios: a ferraria a noroeste, a taverna a nordeste, a torre do Porteiro na entrada, o hotel a leste, a casa do Doutor a sudoeste; a estrada do norte vai para a fazenda, a do sul para o bosque da Provação, a do oeste para as minas na montanha. Nada de luz elétrica: postes com cristais vermelhos acesos. As árvores são tortas e de cores erradas (roxas, amarelas, azuladas), e aqui e ali o lodo preto brilha no chão.",
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
    links: LINKS_VILA,
    plan: { x: 0, y: 0 },
    neblina: R_LAB - 0.6,
  },
  // ------------------------------------------------------------ a Torre do Porteiro
  // A porta de dentro fica do MESMO lado da de fora (o Felipe, 14/10, como na Sede em 05/10): o prédio com a porta
  // virada para a frente da tela tem a de dentro na parede da frente, a que não aparece (planBottom); virado para o
  // fundo, na parede do fundo (planTop).
  {
    key: "torre",
    name: SANTO_BERCO + "Torre do Porteiro",
    description:
      "O térreo da torre redonda da entrada: pedra fria, a escada em caracol subindo pelo meio, a mesa do Porteiro com o livro de quem chega, o baú, os lampiões de cristal. Pela seteira se vê a estrada do portão.",
    layout: planBottom(7, 7, 3),
    andar: TORRE,
    style: "calabouco",
    ...DENTRO,
    floor: [
      ["portal", 3, 6, 0],
      ["escada_espiral", 4, 3, 0],
      ["mesa_rustica", 0, 1, 2],
      ["banco_rustico", 2, 1, 2],
      ["jarra_canecas", 1, 1, 0],
      ["cesta_pao", 1, 3, 0],
      ["books_stack", 0, 2, 0, hint("Livro do Porteiro", "A lista de quem entrou na vila. Os nomes de fora têm, do lado, \"Ajudante do Porteiro\" escrito depois.")],
      ["bau_madeira", 0, 6, 2],
      ["barril_madeira", 6, 1, 0],
      ["velas_cristal", 1, 5, 0],
    ],
    wall: [
      ["lampiao_cristal", "r", 0, 1.5, 2.6],
      ["lampiao_cristal", "l", 0, 5.0, 2.6],
      ["armas_parede", "r", 0, 5.4, 2.4],
    ],
    links: [
      [3, 6, "vila"],
      [4, 3, "torre2"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "torre2",
    name: SANTO_BERCO + "Alto da Torre",
    description:
      "O alto da torre: o quarto do Porteiro, a cama de palha, e no meio o cristal vermelho grande que faz da torre um farol, quente como brasa. Das janelas se vê a vila inteira e o labirinto coberto de névoa.",
    layout: planBottom(7, 7, 3),
    andar: TORRE2,
    style: "calabouco",
    ...DENTRO,
    darkness: 0.38,
    floor: [
      ["escada_espiral", 4, 3, 0],
      ["cama_palha", 0, 0, 2],
      ["bau_madeira", 0, 3, 2],
      ["cristal_vermelho", 3, 1, 0, hint("O farol", "Um cristal vermelho do tamanho de uma cabeça. Esquenta o quarto inteiro; perto dele, o ar treme.")],
      ["cristal_vermelho", 3, 2, 0],
      ["rug_worn", 1, 4, 0],
      ["crate_wood", 6, 0, 0],
    ],
    wall: [
      ["window_barred", "r", 0, 5.2, 2.2],
      ["window_barred", "l", 0, 5.5, 2.2],
    ],
    links: [[4, 3, "torre"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ a Taverna
  {
    key: "taverna",
    name: SANTO_BERCO + "Taverna",
    description:
      "A taverna: o salão baixo de tábuas e vigas, as mesas compridas com os bancos, o balcão com as canecas de estanho e os barris atrás, a lareira acesa com o caldeirão. O Taverneiro serve \"Manteiga na Manteiga\" a quem chegar, de graça. Os Luzidios comem em silêncio e sorriem demais.",
    layout: planBottom(14, 10, 7),
    andar: TAVERNA,
    style: "enxaimel",
    ...DENTRO,
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 7, 9, 0],
      // o balcão no fundo à direita, os barris atrás
      ["balcao_taverna", 9, 3, 4],
      ...de("barril_madeira", [9, 1], [10, 1], [12, 1], [13, 1]),
      ["barril_madeira", 13, 3, 0],
      ["stool", 10, 4, 0],
      ["stool", 12, 4, 0],
      // a lareira na parede da esquerda
      ["lareira_cristal", 0, 3, 2],
      // as mesas compridas com os bancos (o tapete gasto embaixo da primeira) e o que está em cima delas
      ["rug_worn", 2, 5, 2],
      ["mesa_rustica", 2, 5, 4],
      ["banco_rustico", 2, 4, 4],
      ["banco_rustico", 2, 7, 0],
      ["mesa_rustica", 9, 6, 4],
      ["banco_rustico", 9, 5, 4],
      ["banco_rustico", 9, 8, 0],
      ["bau_madeira", 13, 9, 0],
      ["jarra_canecas", 3, 5, 0],
      ["cesta_pao", 2, 6, 0],
      ["velas_cristal", 4, 6, 0],
      ["jarra_canecas", 10, 6, 0],
      ["cesta_pao", 9, 7, 0],
      ["velas_cristal", 11, 7, 0],
      // a lenha dos dois lados da lareira, os caixotes e as sacas no canto
      ["lenha", 0, 2, 0],
      ["lenha", 0, 6, 0],
      ["crate_wood", 0, 9, 0],
      ["sacas", 1, 9, 0],
      ["sacas", 13, 8, 0],
    ],
    wall: [
      ["placa_taverna", "r", 0, 11.0, 2.6],
      ["lampiao_cristal", "r", 0, 4.0, 2.7],
      ["lampiao_cristal", "r", 0, 13.0, 2.7],
      ["lampiao_cristal", "l", 0, 7.5, 2.7],
      ["armas_parede", "l", 0, 1.5, 2.5],
    ],
    links: [[7, 9, "vila"]],
    plan: { x: 0, y: 0 },
    chao: [[12, 7, "Caneca de Estanho", 1, "misc"]],
  },
  // ------------------------------------------------------------ a Ferraria e o quarto do Ferreiro
  {
    key: "ferraria",
    name: SANTO_BERCO + "Ferraria",
    description:
      "A forja do Ferreiro, o líder da vila: o chão de pedra preto de fuligem, a forja acesa com um cristal vermelho no meio do carvão, a bigorna, a tina de têmpera, e por toda parte espadas, machados, arcos, escudos e armaduras — nenhuma arma de fogo. No fundo à esquerda, a porta do quarto dele.",
    layout: planBottom(11, 8, 5),
    andar: FERRARIA,
    style: "ferraria",
    ...DENTRO,
    darkness: 0.46,
    ambient: "#c07850",
    particles: ["dust", "embers"],
    floor: [
      ["portal", 5, 7, 0],
      ["portal", 0, 1, 2],
      ["forja_cristal", 7, 1, 4, hint("A forja", "Não tem carvão de verdade: no meio das brasas, um cristal vermelho mantém o ferro em brasa sem nunca apagar.")],
      ["bigorna", 7, 4, 0],
      ["tina_agua", 9, 4, 0],
      ["rack_medieval", 0, 2, 2],
      ["armadura_medieval", 10, 7, 6],
      ["armadura_medieval", 0, 7, 2],
      ["table_tools", 2, 5, 2],
      ["barril_madeira", 0, 4, 0],
      ["crate_wood", 3, 7, 0],
      ["lenha", 0, 5, 0],
      ["jarra_canecas", 2, 5, 0],
      ["sacas", 4, 7, 0],
    ],
    wall: [
      ["ferramentas_parede", "r", 0, 3.0, 2.3],
      ["armas_parede", "r", 0, 9.6, 2.6],
      ["lampiao_cristal", "l", 0, 5.0, 2.6],
    ],
    links: [
      [5, 7, "vila"],
      [0, 1, "quarto_ferreiro"],
    ],
    plan: { x: 7, y: 0 },
  },
  {
    key: "quarto_ferreiro",
    name: SANTO_BERCO + "Quarto do Ferreiro",
    description:
      "O quarto do Ferreiro, atrás da forja: a cama de palha, o baú, a mesinha com a vela. No chão, uma escotilha de ferro pesada, sem puxador por cima: só abre por baixo. Dá no Bunker dos Guardiões.",
    // a porta para a forja fica do lado dela (à direita do quarto)
    layout: planRight(6, 6, 1),
    andar: FERRARIA,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.56,
    floor: [
      ["portal", 5, 1, 6],
      ["cama_palha", 0, 0, 2],
      ["bau_madeira", 0, 3, 2],
      ["nightstand", 0, 4, 2],
      ["velas_cristal", 0, 5, 0],
      ["jarra_canecas", 0, 4, 0],
      ["rug_worn", 2, 2, 0],
      ["escotilha", 4, 5, 0, oculta("A escotilha", "Ferro grosso, sem argola nem fechadura deste lado. Por baixo dela, um barulho de vento — ou de respiração. Dá no Bunker dos Guardiões e só abre por baixo."), 2],
    ],
    wall: [["lampiao_cristal", "r", 0, 1.6, 2.6]],
    links: [
      [5, 1, "ferraria"],
      [4, 5, "bunker"],
    ],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ o Hotel (o prédio olha para o fundo: as portas de fora no fundo)
  {
    key: "hotel",
    name: SANTO_BERCO + "Hotel",
    description:
      "O hall do hotel: o balcão de recepção com o livro dos hóspedes e o quadro das chaves, os quatro retratos dos Hoteleiros na parede do fundo (o mesmo sorriso em quatro rostos), a lareira com as poltronas, a mesa comprida e a escada para os quartos. O Hoteleiro recebe todo mundo como se esperasse por eles; nada se paga.",
    layout: planTop(12, 9, 6),
    andar: HOTEL,
    style: "enxaimel",
    ...DENTRO,
    floor: [
      ["portal", 6, 1, 4],
      ["stairs_up", 10, 1, 4],
      // o balcão ao longo da parede da esquerda, o Hoteleiro atrás dele
      ["balcao_hotel", 1, 2, 2, hint("Livro dos Hóspedes", "Os nomes de quem passou pelo hotel, em letras de todas as épocas. Nenhum tem a data de saída.")],
      ["velas_cristal", 1, 5, 0],
      ["stool", 0, 3, 2],
      // a lareira do fundo com as poltronas viradas para ela
      ["lareira_cristal", 7, 1, 4],
      ["armchair", 7, 3, 0],
      ["armchair", 9, 3, 0],
      ["rug_worn", 5, 2, 0, oculta("O tapete", "À noite, o hall fica cheio de passos sem ninguém, e do corredor de cima vem uma música baixinha, de um instrumento que ninguém da vila toca.")],
      // a mesa comprida com os bancos
      ["mesa_rustica", 4, 6, 4],
      ["banco_rustico", 4, 5, 4],
      ["banco_rustico", 5, 8, 0],
      ["velas_cristal", 5, 6, 0],
      ["jarra_canecas", 6, 6, 0],
      ["cesta_pao", 4, 7, 0],
      ["lenha", 11, 1, 0],
      ["crate_wood", 11, 8, 0],
      // a bagagem de quem chegou
      ["bau_madeira", 0, 8, 2],
      ["bau_madeira", 0, 9, 2],
      ["barril_madeira", 11, 9, 0],
      ["cristal_vermelho", 11, 5, 0],
    ],
    wall: [
      // os quatro Hoteleiros (o retrato de cada um, em fila), entre o canto e a porta
      ["quadro_hoteleiro", "r", 1, 1.0, 2.35, hint("Os Hoteleiros", "Quatro retratos, quatro Hoteleiros: o pai, o avô, o bisavô... ou o mesmo homem quatro vezes. O sorriso é idêntico, e os olhos acompanham quem atravessa o hall.")],
      ["quadro_hoteleiro~2", "r", 1, 2.2, 2.35],
      ["quadro_hoteleiro~3", "r", 1, 3.4, 2.35],
      ["quadro_hoteleiro~4", "r", 1, 4.6, 2.35],
      ["quadro_chaves", "l", 0, 3.5, 2.3],
      ["lampiao_cristal", "l", 0, 6.5, 2.6],
      ["window_barred", "l", 0, 8.2, 2.2],
      ["lampiao_cristal", "r", 1, 11.5, 2.6],
    ],
    links: [
      [6, 1, "vila"],
      [10, 1, "hotel2"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "hotel2",
    name: SANTO_BERCO + "Corredor do Hotel",
    description:
      "O corredor do andar de cima: o tapete comprido, os lampiões entre as portas dos quatro quartos, a cômoda com as velas e a escada que desce para o hall. De noite, passa gente pelo corredor que não está hospedada em lugar nenhum.",
    // 16/10: o quarto 4 no fim (o Felipe: pelo menos 4 quartos em todo hotel)
    layout: planBottom(28, 4, 20),
    andar: HOTEL2,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.56,
    floor: [
      ["portal", 3, 0, 4],
      ["portal", 10, 0, 4],
      ["portal", 17, 0, 4],
      ["portal", 24, 0, 4],
      ["escada_desce", 20, 1, 4],
      ["rug_worn", 5, 1, 2],
      ["rug_worn", 12, 1, 2, oculta("Música do nada", "A música que vem do fim do corredor: um alaúde, baixinho. Quando alguém chega perto, para.")],
      ["comoda", 0, 1, 2],
      ["velas_cristal", 0, 1, 0],
      ["bau_madeira", 21, 3, 6],
    ],
    wall: [
      ["lampiao_cristal", "r", 0, 1.5, 2.6],
      ["lampiao_cristal", "r", 0, 6.5, 2.6],
      ["lampiao_cristal", "r", 0, 13.5, 2.6],
      ["lampiao_cristal", "r", 0, 22.0, 2.6],
      ["window_barred", "l", 0, 2.9, 2.2],
    ],
    links: [
      [3, 0, "quarto_hotel1"],
      [10, 0, "quarto_hotel2"],
      [17, 0, "quarto_hotel3"],
      [24, 0, "quarto_hotel4"],
      [20, 1, "hotel"],
    ],
    plan: { x: 0, y: 6 },
  },
  {
    key: "quarto_hotel1",
    name: SANTO_BERCO + "Quarto 1 do Hotel",
    description: "Um quarto do hotel, o mais simples: a cama de palha com a manta de lã, o criado-mudo com a vela, a cômoda, a lareira acesa e a janela gradeada para a vila. Descanso normal.",
    layout: planBottom(7, 6, 3),
    andar: HOTEL2,
    style: "enxaimel",
    ...DENTRO,
    descanso: "normal",
    floor: [
      ["portal", 3, 5, 0],
      ["cama_palha", 0, 0, 4],
      ["nightstand", 2, 0, 4],
      ["velas_cristal", 2, 0, 0],
      ["comoda", 5, 0, 4],
      ["jarra_canecas", 6, 0, 0],
      ["lareira_cristal", 0, 3, 2],
      // a lenha (de enfeite) a uma casa da lareira, nunca colada na frente dela (16/10)
      ["lenha", 2, 5, 0],
      ["rug_worn", 2, 2, 0],
      ["bau_madeira", 6, 4, 6],
    ],
    wall: [
      ["window_barred", "r", 0, 3.6, 2.2],
      ["lampiao_cristal", "l", 0, 1.5, 2.6],
    ],
    links: [[3, 5, "hotel2"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "quarto_hotel2",
    name: SANTO_BERCO + "Quarto 2 do Hotel",
    description: "Um quarto do hotel, à luz de vela: a cama de casal, o guarda-roupa, a cômoda com o castiçal, a cadeira e a janela. Descanso confortável.",
    layout: planBottom(7, 6, 3),
    andar: HOTEL2,
    style: "enxaimel",
    ...DENTRO,
    descanso: "confortavel",
    darkness: 0.58,
    floor: [
      ["portal", 3, 5, 0],
      ["cama_casal", 0, 0, 4],
      ["nightstand", 2, 0, 4],
      ["velas_cristal", 2, 0, 0],
      ["guarda_roupa", 5, 0, 4],
      ["comoda", 0, 4, 2],
      ["velas_cristal", 0, 4, 0],
      ["jarra_canecas", 0, 5, 0],
      ["chair_wood", 6, 3, 6],
      ["rug_worn", 3, 2, 0],
    ],
    wall: [
      ["window_barred", "r", 0, 3.6, 2.2],
      ["lampiao_cristal", "l", 0, 3.5, 2.6],
    ],
    links: [[3, 5, "hotel2"]],
    plan: { x: 7, y: 0 },
  },
  {
    key: "quarto_hotel3",
    name: SANTO_BERCO + "Quarto 3 do Hotel",
    description: "O terceiro quarto: a cama arrumada demais, a cômoda, o espelho, a lareira. A chave dele nunca está no quadro. Descanso confortável.",
    layout: planBottom(7, 6, 3),
    andar: HOTEL2,
    style: "enxaimel",
    ...DENTRO,
    descanso: "confortavel",
    darkness: 0.6,
    floor: [
      ["portal", 3, 5, 0],
      ["comoda", 0, 0, 4],
      ["nightstand", 4, 0, 4],
      ["velas_cristal", 4, 0, 0],
      ["lenha", 0, 5, 0],
      ["cama_palha", 5, 0, 4, oculta("A cama", "Arrumada como se ninguém tivesse dormido nela, mas o travesseiro está quente. Alguém dorme aqui toda noite e nunca vem buscar a chave.")],
      ["lareira_cristal", 0, 2, 2],
      ["rug_worn", 2, 2, 0],
    ],
    wall: [
      ["mirror", "r", 0, 2.5, 2.3, oculta("O espelho", "No espelho, a cama está desarrumada.")],
      ["window_barred", "r", 0, 3.7, 2.2],
    ],
    links: [[3, 5, "hotel2"]],
    plan: { x: 14, y: 0 },
  },
  {
    key: "quarto_hotel4",
    name: SANTO_BERCO + "Quarto 4 do Hotel",
    description:
      "O quarto do fim do corredor, o maior: a cama de casal com o dossel de lã, a lareira de pedra, a poltrona, o baú, o tapete grosso e a janela gradeada. O Hoteleiro o oferece primeiro, sorrindo. Descanso confortável.",
    layout: planBottom(7, 6, 3),
    andar: HOTEL2,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.54,
    descanso: "confortavel",
    floor: [
      ["portal", 3, 5, 0],
      ["cama_casal", 4, 0, 4, oculta("A cama do fim", "Os lençóis cheiram a lavado, mas embaixo do travesseiro há um dente de leite. Toda noite, um a mais.")],
      ["nightstand", 6, 0, 4],
      ["velas_cristal", 6, 0, 0],
      ["lareira_cristal", 0, 2, 2],
      // a poltrona virada para a lareira, a uma casa dela (colada na frente não; 16/10)
      ["armchair", 2, 3, 6],
      ["bau_madeira", 6, 4, 6],
      ["rug_worn", 3, 2, 0],
      ["lenha", 0, 5, 0],
    ],
    wall: [
      ["window_barred", "r", 0, 2.4, 2.2],
      ["lampiao_cristal", "l", 0, 1.0, 2.6],
    ],
    links: [[3, 5, "hotel2"]],
    plan: { x: 21, y: 0 },
  },
  // ------------------------------------------------------------ a Casa do Doutor (o casarão olha para o fundo)
  {
    key: "doutor",
    name: SANTO_BERCO + "Casa do Doutor",
    description:
      "A sala do casarão do Doutor: a lareira de pedra com as duas poltronas, a estante cheia de livros de anatomia de outras épocas, a mesa comprida, a escada para o quarto e, à esquerda, a porta do consultório.",
    layout: planTop(10, 8, 5),
    andar: DOUTOR,
    style: "enxaimel",
    ...DENTRO,
    floor: [
      ["portal", 5, 1, 4],
      ["portal", 0, 4, 2],
      ["stairs_up", 9, 1, 4],
      ["lareira_cristal", 1, 1, 4],
      ["armchair", 1, 3, 0],
      ["armchair", 3, 3, 0],
      ["bookshelf", 7, 1, 4, hint("Os livros do Doutor", "Livros de anatomia de épocas que não combinam: um de pergaminho, outro impresso, um com fotografias. Nas margens, a mesma letra anotou todos.")],
      ["mesa_rustica", 5, 5, 4],
      ["banco_rustico", 5, 4, 4],
      ["banco_rustico", 6, 7, 0],
      ["books_stack", 5, 5, 0],
      ["velas_cristal", 7, 6, 0],
      ["jarra_canecas", 6, 5, 0],
      ["cesta_pao", 5, 6, 0],
      ["lenha", 0, 1, 0],
      ["rug_worn", 1, 5, 0],
      ["barril_madeira", 0, 8, 0],
      ["cristal_vermelho", 9, 4, 0],
    ],
    wall: [
      ["lampiao_cristal", "r", 1, 6.4, 2.6],
      ["lampiao_cristal", "l", 0, 2.2, 2.6],
      ["window_barred", "l", 0, 7.0, 2.2],
    ],
    links: [
      [5, 1, "vila"],
      [0, 4, "consultorio"],
      [9, 1, "quarto_doutor"],
    ],
    plan: { x: 8, y: 0 },
  },
  {
    key: "consultorio",
    name: SANTO_BERCO + "Consultório do Doutor",
    description:
      "O consultório, junto da sala: a maca de madeira com o lençol de linho, o cristal verde de cura do lado da cabeceira, a bacia, o armário de botica com os vidrinhos, e a mesa do Doutor com os frascos e os livros, a cadeira dele de um lado e a banqueta do paciente do outro.",
    layout: planRight(8, 7, 3),
    andar: DOUTOR,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.44,
    floor: [
      ["portal", 7, 3, 6],
      ["maca_doutor", 1, 0, 4],
      ["cristal_verde", 0, 0, 0, hint("Cristal Verde", "O cristal de cura do Doutor: encostado numa ferida, fecha na hora; na boca, adormece. Já está mais apagado de um lado, de tanto uso.")],
      ["tina_agua", 2, 0, 0],
      ["armario_boticario", 4, 0, 4, oculta("O armário de botica", "Ervas secas, pós, unguentos e uns vidros de líquido verde que brilham no escuro: lascas de cristal moídas.")],
      ["mesa_doutor", 2, 4, 4],
      ["chair_wood", 2, 5, 0],
      ["stool", 3, 3, 4],
      ["frascos_boticario", 2, 4, 0],
      ["books_stack", 3, 4, 0],
      ["velas_cristal", 7, 0, 0],
      ["bau_madeira", 0, 6, 2],
    ],
    wall: [
      ["lampiao_cristal", "r", 0, 3.0, 2.6],
      ["window_barred", "l", 0, 4.5, 2.2],
      ["lampiao_cristal", "r", 0, 6.6, 2.6],
    ],
    links: [[7, 3, "doutor"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "quarto_doutor",
    name: SANTO_BERCO + "Quarto do Doutor",
    description: "O quarto do Doutor, no andar de cima: a cama de casal, o criado-mudo com a vela, o guarda-roupa, a cômoda e a janela para a vila.",
    layout: planBottom(8, 6, 6),
    andar: DOUTOR2,
    style: "enxaimel",
    ...DENTRO,
    darkness: 0.56,
    floor: [
      ["escada_desce", 7, 2, 4],
      ["cama_casal", 0, 0, 4],
      ["nightstand", 2, 0, 4],
      ["velas_cristal", 2, 0, 0],
      ["guarda_roupa", 4, 0, 4],
      ["comoda", 0, 4, 2],
      ["jarra_canecas", 0, 5, 0],
      ["rug_worn", 2, 3, 0],
      ["bau_madeira", 7, 0, 4],
    ],
    wall: [
      ["window_barred", "r", 0, 3.3, 2.2],
      ["lampiao_cristal", "l", 0, 3.4, 2.6],
    ],
    links: [[7, 2, "doutor"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ as casas ainda sem interior próprio (a casinha padrão)
  // as casinhas comuns da vila não têm nome próprio (o Felipe, 14/10): só os lugares importantes do mapa têm
  casaPadrao("casa1", "Casa", "Uma casinha da vila: a lareira acesa, a mesa com os bancos, a cama de palha, a prateleira e os barris. Simples e arrumada."),
  casaPadrao("casa2", "Casa", "Uma casinha da vila: a lareira acesa, a mesa com os bancos, a cama de palha, a prateleira e os barris. Simples e arrumada."),
  casaPadrao("casa3", "Casa", "Uma casinha da vila: a lareira acesa, a mesa com os bancos, a cama de palha, a prateleira e os barris. Simples e arrumada."),
  casaPadrao("casa4", "Casa", "Uma casinha da vila: a lareira acesa, a mesa com os bancos, a cama de palha, a prateleira e os barris. Simples e arrumada."),
  // ------------------------------------------------------------ a Fazenda (norte)
  {
    key: "fazenda",
    name: SANTO_BERCO + "Fazenda",
    description:
      "A fazenda ao norte da vila: o terreiro de terra batida, os dois celeiros (o grande e o velho), a casa de enxaimel da Fazendeira, o poço, a horta de folhas roxas e o milharal atrás da cerca. O pasto está vazio: os bichos, de anatomia esquisita, passam a noite escondidos dentro dos celeiros.",
    layout: { heightmap: T_FAZ.planta(), door: { x: 21, y: FH - 2, dir: 0 } },
    andar: "Fazenda",
    style: "grama",
    aberto: true,
    terreno: T_FAZ.texto(),
    darkness: 0.3,
    fog: 0.12,
    ambient: "#c0a8b0",
    particles: ["dust"],
    floor: fazendaPiso(),
    links: [
      [20, FH - 1, "vila"],
      [...ent(CELEIRO_A), "celeiro"],
      [...ent(CELEIRO_B), "celeiro2"],
      [...ENT_CASA_F, "casa_fazendeira"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "celeiro",
    name: SANTO_BERCO + "Celeiro da Fazendeira",
    description: "O celeiro grande da Fazenda: as baias, o feno, as sacas e a carroça. Os bichos se escondem aqui toda noite; no escuro, atrás do feno, os olhos acendem.",
    layout: planBottom(12, 8, 6),
    andar: "Celeiro da Fazendeira",
    style: "terra",
    ...DENTRO,
    darkness: 0.5,
    ambient: "#b08a60",
    floor: [
      ["portal", 6, 7, 0],
      ...[0, 2, 4].map((x): FloorSeed => ["baia", x, 0, 4]),
      ["olhos_escuro", 1, 0, 4, oculta("Olhos no escuro", "Atrás das baias, dois pares de olhos amarelos. Não piscam. Quando a luz chega perto, somem sem barulho.")],
      ...de("feno", [9, 0], [10, 0], [11, 0], [10, 1], [11, 1]),
      ["olhos_escuro", 9, 1, 4],
      ...de("sacas", [0, 5], [1, 5], [0, 6]),
      ["carroca", 8, 3, 0],
      ["barril_madeira", 11, 6, 0],
    ],
    wall: [["lampiao_cristal", "r", 0, 6.5, 2.7]],
    links: [[6, 7, "fazenda"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "celeiro2",
    name: SANTO_BERCO + "Celeiro Velho",
    description: "O celeiro de trás, mais velho: as baias fechadas com as tábuas (uma delas caída, dá para passar), o feno empilhado até o teto, o bebedouro, as sacas e a carroça. Escuro e quente de bicho, sem bicho nenhum à vista.",
    layout: planBottom(12, 8, 6),
    andar: "Celeiro Velho",
    style: "terra",
    ...DENTRO,
    darkness: 0.62,
    ambient: "#a07850",
    floor: [
      ["portal", 6, 7, 0],
      // as baias do fundo à esquerda, com os bichos escondidos dentro
      ...[0, 1, 3, 4].map((i): FloorSeed => ["baia", i, 3, 4]),
      ...giro("baia", 2, [5, 0], [5, 1], [5, 2]),
      ["olhos_escuro", 1, 1, 4, oculta("As baias", "Dentro das baias, a palha se mexe e respira. Uma coisa de pernas demais se encolhe no canto quando alguém olha.")],
      ["olhos_escuro", 3, 0, 4],
      // o feno empilhado à direita (e outro par de olhos no meio dele)
      ...de("feno", [8, 0], [9, 0], [10, 0], [11, 0], [10, 1], [11, 1], [11, 2], [9, 0], [10, 0]),
      ["olhos_escuro", 9, 1, 4],
      ["tina_agua", 6, 0, 0],
      ...de("sacas", [0, 6], [1, 6], [0, 5]),
      ["carroca", 8, 4, 0],
      ["barril_madeira", 11, 6, 0],
      ["crate_wood", 2, 6, 0],
    ],
    wall: [["lampiao_cristal", "r", 0, 7.0, 2.7, undefined, 1]],
    links: [[6, 7, "fazenda"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "casa_fazendeira",
    name: SANTO_BERCO + "Casa da Fazendeira",
    description: "A casa da Fazendeira: o fogão a lenha com a panela, a prateleira de potes, a mesa comprida com os bancos, a cama de palha, as sacas de grão, e o cristal azul no canto, gelando o que ela guarda.",
    layout: planBottom(9, 7, 4),
    andar: "Casa da Fazendeira",
    style: "enxaimel",
    ...DENTRO,
    floor: [
      ["portal", 4, 6, 0],
      ["fogao_cristal", 0, 0, 4],
      ["prateleira", 2, 0, 4],
      ["nightstand", 6, 0, 4],
      ["cama_palha", 7, 0, 4],
      ["rug_worn", 3, 3, 2],
      ["mesa_rustica", 3, 3, 4],
      ["banco_rustico", 3, 2, 4],
      ["banco_rustico", 4, 5, 0],
      ["cesta_pao", 3, 3, 0],
      ["jarra_canecas", 4, 4, 0],
      ["velas_cristal", 5, 3, 0],
      ["lenha", 0, 1, 0],
      ["cristal_azul", 0, 3, 0, hint("A geladeira", "O cristal azul num caixote forrado de palha: o leite, a manteiga e a carne ficam aqui, gelados como neve.")],
      ...de("sacas", [0, 5], [0, 6]),
      ["barril_madeira", 8, 5, 0],
      ["bau_madeira", 8, 4, 6],
    ],
    wall: [
      ["utensilios_parede", "l", 0, 2.0, 2.2],
      ["window_barred", "r", 0, 4.9, 2.2],
      ["lampiao_cristal", "l", 0, 5.2, 2.6],
    ],
    links: [[4, 6, "fazenda"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ o Bosque da Provação (sul)
  {
    key: "bosque",
    name: SANTO_BERCO + "Bosque da Provação",
    description:
      "O bosque ao sul da vila: as árvores retorcidas de copa roxa, amarela e azulada, bem juntas. Na clareira do meio, os tocos cortados, um de cada morador; em volta, as árvores dos mortos, cada um enterrado embaixo da sua. Nenhum passarinho canta aqui.",
    layout: { heightmap: T_BOSQUE.planta(), door: { x: 20, y: 1, dir: 4 } },
    andar: "Bosque da Provação",
    style: "grama",
    aberto: true,
    terreno: T_BOSQUE.texto(),
    darkness: 0.42,
    fog: 0.26,
    ambient: "#a890b8",
    particles: ["dust"],
    floor: bosquePiso(),
    links: [[19, 0, "vila"]],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ as Minas (oeste): a boca e as galerias, uma por cor
  // A boca das minas na vila olha para o leste (para a vila): por dentro, a entrada fica na parede da direita
  // (planRight). Daí para dentro, cada galeria passa para a seguinte pela parede da esquerda (a que aparece).
  {
    key: "minas",
    name: SANTO_BERCO + "Boca das Minas",
    description:
      "A primeira galeria das minas, aberta na montanha: o teto escorado com troncos, o trilho correndo pelo chão até o fundo, o carrinho cheio de pedra, os caixotes, as sacas de minério e as ferramentas do Minerador. Mais para dentro, a pedra começa a brilhar verde.",
    layout: planRight(14, 9, 4),
    andar: MINAS,
    ...MINA_CLIMA,
    darkness: 0.5,
    ambient: "#a07060",
    terreno: chaoDeMina(14, 9, [14, 4], 1),
    floor: [
      ["portal", 13, 4, 6],
      ["boca_tunel", 0, 4, 2],
      ...trilho(4, 1, 12),
      ["carrinho_mina", 8, 4, 2, hint("Carrinho de mina", "Cheio de pedra e de lascas de cristal de todas as cores. O Minerador enche três por dia e ninguém sabe para onde vão.")],
      ...giro("escora_mina", 4, [3, 0], [7, 0], [11, 0]), ...giro("escora_mina", 0, [3, 8], [7, 8], [11, 8]),
      ...de("crate_wood", [12, 0], [12, 1]),
      ["barril_madeira", 13, 0, 0],
      ...de("sacas", [9, 8], [10, 8], [9, 7]),
      ...de("pedras", [0, 0], [0, 8], [1, 8], [5, 7]),
      ["rubble", 5, 1, 0],
      ["cristal_vermelho", 1, 1, 0],
    ],
    wall: [
      ["lampiao_cristal", "r", 0, 5.0, 2.6],
      ["lampiao_cristal", "r", 0, 9.5, 2.4],
      ["lampiao_cristal", "l", 0, 2.0, 2.6],
      ["teia", "l", 0, 7.5, 3.4],
    ],
    links: [
      [13, 4, "vila"],
      [0, 4, "mina_verde"],
    ],
    plan: { x: 62, y: 1 },
  },
  {
    key: "mina_verde",
    name: SANTO_BERCO + "Galeria Verde",
    description:
      "A galeria dos cristais verdes, os de cura: drusas da altura de uma pessoa brotando do chão, veios acesos na rocha, a luz verde de aquário. No chão, os montinhos de terra revirada babados de lodo preto: as tocas das Toupeiras de Lodo.",
    layout: planRight(16, 9, 4),
    andar: MINAS,
    ...MINA_CLIMA,
    ambient: "#5a9a70",
    terreno: chaoDeMina(16, 9, [16, 4], 2),
    floor: [
      ["boca_tunel", 15, 4, 6],
      ["boca_tunel", 0, 4, 2],
      ...trilho(4, 1, 14),
      ["cristal_grande_verde", 3, 0, 0, hint("Drusa verde", "Cristais verdes do tamanho de uma pessoa. Perto deles, os arranhões param de arder.")],
      ["cristal_grande_verde", 10, 6, 0],
      ["cristal_grande_verde", 13, 0, 0],
      ...de("cristal_verde", [6, 1], [1, 7], [14, 8], [8, 7]),
      ["lodo_preto", 5, 6, 0],
      ["toca_toupeira", 5, 6, 0, oculta("Toca de Toupeira de Lodo", "A terra revirada ainda está mole. Lá do fundo do buraco, alguma coisa cava devagar.")],
      ["toca_toupeira", 12, 3, 0],
      ["toca_toupeira", 2, 2, 0],
      ["toca_toupeira", 8, 2, 0],
      ...giro("escora_mina", 4, [1, 0], [8, 0]), ...giro("escora_mina", 0, [6, 8], [12, 8]),
      ...de("pedras", [0, 0], [15, 0], [0, 8]),
    ],
    wall: [
      ["veio_cristal_verde", "r", 0, 6.0, 1.2],
      ["veio_cristal_verde", "l", 0, 2.0, 1.2],
      ["veio_cristal_verde", "r", 0, 10.5, 1.0],
    ],
    links: [
      [15, 4, "minas"],
      [0, 4, "mina_vermelha"],
    ],
    plan: { x: 46, y: 1 },
  },
  {
    key: "mina_vermelha",
    name: SANTO_BERCO + "Galeria Vermelha",
    description:
      "A galeria dos cristais vermelhos, os de calor: o ar treme de quente, a rocha em volta das drusas está preta de queimada. No alto das paredes, penduradas de cabeça para baixo, as Morcegosas, de olhinhos vermelhos abertos.",
    layout: planRight(16, 9, 4),
    andar: MINAS,
    ...MINA_CLIMA,
    darkness: 0.56,
    ambient: "#c06048",
    particles: ["dust", "embers"],
    terreno: chaoDeMina(16, 9, [16, 4], 3),
    floor: [
      ["boca_tunel", 15, 4, 6],
      ["boca_tunel", 0, 4, 2],
      ...trilho(4, 1, 14),
      ["carrinho_mina", 11, 4, 2],
      ["cristal_grande_vermelho", 2, 0, 0, hint("Drusa vermelha", "Quente como brasa: a dois passos, o rosto arde. Os mineradores cortam as pontas com cinzel e luva de couro grosso.")],
      ["cristal_grande_vermelho", 8, 6, 0],
      ["cristal_grande_vermelho", 12, 0, 0],
      ...de("cristal_vermelho", [5, 1], [14, 7], [1, 7], [9, 1]),
      ["toca_toupeira", 5, 7, 0],
      ["toca_toupeira", 14, 2, 0],
      ...giro("escora_mina", 4, [6, 0], [10, 0]), ...giro("escora_mina", 0, [4, 8], [12, 8]),
      ...de("pedras", [0, 0], [15, 0], [0, 8], [15, 8]),
    ],
    wall: [
      ["veio_cristal_vermelho", "r", 0, 8.0, 1.2],
      ["veio_cristal_vermelho", "l", 0, 6.5, 1.0],
      ["morcegosas", "r", 0, 4.5, 3.4, oculta("Morcegosas", "Dezenas delas, de asa fechada, penduradas no alto. Dormem de olho aberto; um barulho alto e a penca inteira cai em cima de quem passa.")],
      ["morcegosas", "l", 0, 2.0, 3.4],
    ],
    links: [
      [15, 4, "mina_verde"],
      [0, 4, "mina_azul"],
    ],
    plan: { x: 30, y: 1 },
  },
  {
    key: "mina_azul",
    name: SANTO_BERCO + "Galeria Azul",
    description:
      "A galeria dos cristais azuis, os de frio: a respiração vira fumaça, a geada cobre as escoras e o trilho, a água pinga e congela no meio do caminho. Mais Morcegosas no teto. No fundo, o túnel desce para onde a pedra fica preta.",
    layout: planRight(16, 9, 4),
    andar: MINAS,
    ...MINA_CLIMA,
    darkness: 0.6,
    fog: 0.2,
    ambient: "#6a90c8",
    terreno: chaoDeMina(16, 9, [16, 4], 4),
    floor: [
      ["boca_tunel", 15, 4, 6],
      ["boca_tunel", 0, 4, 2],
      ...trilho(4, 1, 14),
      ["cristal_grande_azul", 4, 0, 0, hint("Drusa azul", "Os cristais azuis gelam o ar em volta: a pedra perto deles racha de frio. Um pedaço do tamanho de um punho conserva carne por um ano.")],
      ["cristal_grande_azul", 10, 6, 0],
      ["cristal_grande_azul", 1, 6, 0],
      ...de("cristal_azul", [8, 1], [13, 1], [14, 7], [6, 7]),
      ["toca_toupeira", 12, 2, 0],
      ["toca_toupeira", 7, 6, 0],
      ["lodo_preto", 1, 2, 0, oculta("Lodo Preto", "Aqui o lodo já começa a aparecer pelas frestas da rocha, escorrendo da parte de baixo da mina.")],
      ...giro("escora_mina", 4, [7, 0], [11, 0]), ...giro("escora_mina", 0, [4, 8], [12, 8]),
      ...de("pedras", [15, 0], [0, 0], [15, 8]),
    ],
    wall: [
      ["veio_cristal_azul", "r", 0, 9.3, 1.2],
      ["veio_cristal_azul", "l", 0, 6.4, 1.0],
      ["morcegosas", "r", 0, 13.0, 3.4],
      ["morcegosas", "l", 0, 2.2, 3.4],
    ],
    links: [
      [15, 4, "mina_vermelha"],
      [0, 4, "mina_preta"],
    ],
    plan: { x: 14, y: 1 },
  },
  {
    key: "mina_preta",
    name: SANTO_BERCO + "Câmara dos Cristais Pretos",
    description:
      "O fundo das minas: a câmara onde a pedra é preta e os Cristais Pretos da Provação crescem do chão, sem brilho nenhum, só umas faíscas frias. Quem toca vira Luzidio. O lodo preto escorre das frestas. Na parede do fundo, a porta de ferro e pedra do Bunker dos Guardiões.",
    layout: planRight(14, 11, 5),
    andar: MINAS,
    ...MINA_CLIMA,
    darkness: 0.8,
    fog: 0.24,
    ambient: "#6a5a8a",
    terreno: chaoDeMina(14, 11, [14, 5], 5),
    floor: [
      ["boca_tunel", 13, 5, 6],
      ["portal", 6, 0, 4, oculta("A porta do Bunker", "Ferro grosso numa moldura de pedra, com a espiral entalhada em cima. Do outro lado, o Bunker dos Guardiões."), 1],
      ["cristal_grande_preto", 2, 2, 0, hint("Cristal Preto", "O cristal da Provação. Quem toca nele vira Luzidio: esquece de onde veio e passa a sorrir como os outros.")],
      ["cristal_grande_preto", 9, 3, 0],
      ["cristal_grande_preto", 4, 7, 0],
      ...de("cristal_preto", [1, 0], [11, 0], [0, 5], [8, 8], [12, 9], [1, 9], [10, 6]),
      ["lodo_preto", 6, 4, 0],
      ["lodo_preto", 10, 8, 0],
      ...de("pedras", [0, 10], [13, 0], [13, 10]),
    ],
    wall: [
      ["lampiao_cristal", "r", 0, 4.8, 2.4],
      ["lampiao_cristal", "r", 0, 8.2, 2.4],
      ["lodo_parede", "l", 0, 3.0, 0.3],
      ["lodo_parede", "r", 0, 11.5, 0.3],
    ],
    links: [
      [13, 5, "mina_azul"],
      [6, 0, "bunker"],
    ],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ o Bunker dos Guardiões
  // entre o fundo das minas (a porta do fundo da câmara: aqui, na parede da frente) e o quarto do Ferreiro (a escada de
  // mão sobe até a escotilha que só abre por baixo)
  {
    key: "bunker",
    name: SANTO_BERCO + "Bunker dos Guardiões",
    description:
      "O bunker dos Guardiões, cavado na pedra embaixo da vila: os cinco baús encostados na parede (um de cada Guardião), a mesa com os papéis e os livros, a estante, as armas e as armaduras, a espiral riscada fundo na pedra. A escada de mão sobe até a escotilha do quarto do Ferreiro; a porta da frente dá no fundo das minas.",
    layout: planBottom(12, 9, 6),
    andar: "Bunker",
    style: "calabouco",
    darkness: 0.66,
    ambient: "#8a7058",
    particles: ["dust"],
    floor: [
      ["portal", 6, 8, 0],
      ["escada_vertical", 10, 0, 4, hint("A escada", "A escada de ferro chumbada na pedra sobe até a escotilha do quarto do Ferreiro. Daqui de baixo, a tranca abre com a mão.")],
      ["bau_madeira", 0, 1, 2, hint("Os cinco baús", "Um baú para cada um dos Cinco Guardiões, cada um com uma marca entalhada na tampa. Um deles está vazio.")],
      ...giro("bau_madeira", 2, [0, 2], [0, 3], [0, 4], [0, 5]),
      ["mesa_rustica", 4, 3, 4],
      ["banco_rustico", 5, 5, 0],
      ["papers", 4, 3, 0, oculta("Os papéis", "Mapas da vila de épocas diferentes: a vila cresce, some e volta, sempre em volta do Labirinto.")],
      ["books_stack", 6, 4, 0],
      ["velas_cristal", 5, 3, 0],
      ["jarra_canecas", 6, 3, 0],
      ["cesta_pao", 5, 4, 0],
      ["bookshelf", 2, 0, 4],
      ["rack_medieval", 6, 0, 4],
      ["armadura_medieval", 11, 2, 6],
      ["armadura_medieval", 11, 4, 6],
      ["catre", 5, 0, 4],
      ["barril_madeira", 11, 0, 0],
      ["crate_wood", 8, 0, 0],
    ],
    wall: [
      ["sigil_scratch", "r", 0, 4.8, 2.0, hint("A espiral", "O Símbolo Espiral, riscado fundo na pedra. Quem tem a marca no corpo entra de verdade no Labirinto.")],
      ["tally_marks", "l", 0, 7.0, 2.0],
      ["lampiao_cristal", "l", 0, 3.0, 2.6],
      ["lampiao_cristal", "r", 0, 8.6, 2.4],
    ],
    links: [
      [6, 8, "mina_preta"],
      [10, 0, "quarto_ferreiro"],
    ],
    plan: { x: 0, y: 0 },
  },
  // ------------------------------------------------------------ o Labirinto Infinito por dentro
  {
    key: "labirinto",
    name: SANTO_BERCO + "Labirinto Infinito",
    description:
      "Dentro do Labirinto Infinito: as sebes vivas de folha escura e flor roxa, mais altas que uma pessoa, em anéis que fecham em espiral; a neblina densa enchendo os corredores, mais grossa a cada volta. As plantas mudam de lugar quando ninguém olha. No miolo, um buraco de pedra desce para a Caverna. Só entra de verdade quem tem o Símbolo Espiral no corpo.",
    layout: plantaLabirinto(),
    andar: "Labirinto Infinito",
    style: "grama",
    aberto: true,
    terreno: terrenoLabirinto(),
    darkness: 0.5,
    fog: 0.4,
    ambient: "#a0a8b8",
    particles: ["dust"],
    floor: labirintoPiso(),
    links: [...L_ENTRADAS.map(([x, y]) => [x, y, "vila"] as [number, number, string]), [19, 19, "caverna"]],
    plan: { x: 0, y: 0 },
    neblina: L_ANEIS[0] - 0.6,
  },
  // ------------------------------------------------------------ a Caverna (embaixo do labirinto)
  {
    key: "caverna",
    name: SANTO_BERCO + "Caverna",
    description:
      "A Caverna embaixo do Labirinto: escura e fria, a pedra molhada, o Lodo Preto escorrendo pelas paredes e juntando em poças que brilham. Encostadas no fundo, as celas brancas dos Mananciais, lisas demais para terem sido feitas por alguém, com as correntes lá dentro. A escada de pedra sobe para o miolo do labirinto; o túnel da esquerda desce mais.",
    layout: planBottom(16, 12, 2),
    andar: CAVERNA,
    style: "calabouco",
    darkness: 0.78,
    fog: 0.3,
    ambient: "#5a6a8a",
    particles: ["dust"],
    terreno: chaoDeMina(16, 12, [2, 12], 6),
    floor: [
      ["escada_espiral", 13, 1, 0],
      ["boca_tunel~b", 0, 9, 2],
      // as três celas brancas no fundo: as divisórias, a frente com a grade de cada uma
      ...[4, 8, 12].flatMap((x) => giro("cela_branca", 2, [x, 0], [x, 1], [x, 2])),
      ...giro("cela_branca", 4, [0, 3], [1, 3], [3, 3], [4, 3], [5, 3], [7, 3], [8, 3], [9, 3], [11, 3], [12, 3]),
      ["porta_cela_branca", 2, 3, 4, oculta("As celas dos Mananciais", "Brancas por dentro e por fora, frias como gelo. Nas correntes, a pele de quem esteve preso ficou grudada no metal.")],
      ["porta_cela_branca", 6, 3, 4],
      ["porta_cela_branca", 10, 3, 4, undefined, 1],
      ["colchao_chao", 7, 0, 4],
      ["skull", 10, 1, 0],
      // o lodo juntando em poças
      ["lodo_preto", 4, 6, 0, oculta("Lodo Preto", "O lodo daqui é mais grosso, quase vivo. Quando alguém se aproxima, ele se mexe na direção dela.")],
      ["lodo_preto", 9, 8, 0],
      ["lodo_preto", 13, 9, 0],
      ["lodo_preto", 1, 10, 0],
      ...de("pedras", [15, 0], [15, 11], [7, 11], [14, 5]),
      ["cristal_azul", 15, 7, 0],
    ],
    wall: [
      ["chains_wall", "r", 0, 1.5, 1.6],
      ["chains_wall", "r", 0, 6.5, 1.6],
      ["chains_wall", "r", 0, 10.5, 1.6],
      ["lodo_parede", "r", 0, 15.2, 0.4],
      ["lodo_parede", "l", 0, 6.0, 0.3],
      ["lodo_parede", "l", 0, 11.0, 0.4],
    ],
    links: [
      [13, 1, "labirinto"],
      [0, 9, "caverna_fundo"],
    ],
    plan: { x: 12, y: 0 },
  },
  {
    key: "caverna_fundo",
    name: SANTO_BERCO + "Fundo da Caverna",
    description:
      "O fundo da Caverna, onde o Lodo Preto nasce: o chão inteiro coberto dele, as paredes escorrendo, e no meio o rasgo de luz errada cercado de tentáculos de lodo endurecido. É o lugar do Parasita de Dimensões. O ar aqui não tem cheiro nem som.",
    layout: planRight(12, 10, 4),
    andar: CAVERNA,
    style: "calabouco",
    darkness: 0.84,
    fog: 0.36,
    ambient: "#5a4a7a",
    particles: ["dust"],
    terreno: chaoDeMina(12, 10, [12, 4], 7),
    floor: [
      ["boca_tunel~b", 11, 4, 6],
      ["ninho_parasita", 4, 3, 0, oculta("O lugar do Parasita", "O chão se abre num rasgo de uma luz que não é cor nenhuma. Quem olha muito tempo vê, lá dentro, outros lugares — e alguma coisa olhando de volta.")],
      ...de("lodo_preto", [1, 1], [8, 1], [1, 6], [8, 7], [4, 8], [2, 3]),
      ["skull", 9, 5, 2],
      ...de("pedras", [0, 0], [11, 0], [0, 9], [11, 9]),
    ],
    wall: [
      ["lodo_parede", "r", 0, 2.5, 0.2],
      ["lodo_parede", "r", 0, 6.0, 0.6],
      ["lodo_parede", "r", 0, 9.8, 0.3],
      ["lodo_parede", "l", 0, 3.0, 0.4],
      ["lodo_parede", "l", 0, 7.5, 0.2],
    ],
    links: [[11, 4, "caverna"]],
    plan: { x: 0, y: 0 },
  },
];

// ------------------------------------------------------------------ montagem

/** A neblina enche o labirinto até a sebe de fora (a escala da peça é o raio: 4 casas na escala 1). */
function neblina(room: RoomData, spec: Cena) {
  if (!spec.neblina) return;
  for (const it of room.items) if (it.defId === "neblina_densa") it.escala = Math.round((spec.neblina / 4) * 100) / 100;
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
    neblina(room, spec);
    // em Santo Berço não há fogo (16/10, o Felipe): a luz quente é a dos cristais vermelhos
    room.luzDeCristal = true;
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
  // várias cenas com o mesmo nome (as casinhas comuns): cada uma refaz a sua, na ordem em que foram criadas
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
    neblina(room, spec);
    // em Santo Berço não há fogo (16/10, o Felipe): a luz quente é a dos cristais vermelhos
    room.luzDeCristal = true;
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

/** Para os testes: as cenas de Santo Berço pela chave (o nome de cada uma). */
export const CENAS_SANTO_BERCO: ReadonlyMap<string, string> = new Map(CENAS.map((c) => [c.key, c.name]));
/** Para os testes: de que lado fica a porta de fora de cada prédio da vila (o de dentro tem de ficar do mesmo lado). */
export const LADO_DA_PORTA: ReadonlyMap<string, "frente" | "fundo"> = LADO;
