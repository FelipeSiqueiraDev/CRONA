import { getFurni, RoomMap, type FloorItem, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { plan, type FloorSeed, type WallSeed } from "./seed";
import { planBottom } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * O Orfanato Filhos do Dragão (09/10), o terceiro lugar da campanha: um casarão comprido, de um andar só, com o refeitório
 * numa ponta, o salão no meio (com a sala de estudos, o quarto da diretora e os banheiros do lado) e a ala dos dormitórios,
 * doze quartinhos dos dois lados do corredor; fora, o pátio com as árvores, a estradinha de terra e o anexo de concreto.
 *
 * O ORFANATO PEGOU FOGO (o Felipe, 09/10): está todo destruído e queimado, cheio de escombros, o teto caído, fuligem nas
 * paredes e cinza no chão. E virou o NINHO dos transtornados ("ninho" é como eles chamam a base deles, não ninho de bicho).
 * O livro (LR p. 303): o culto dos transtornados é desorganizado, uma histeria coletiva; eles invadem lugares abandonados
 * para MORAR e fazem do lugar inteiro uma casa de tortura e agonia, sem nenhuma sutileza: canibalismo, tortura e
 * mutilação são o dia a dia. Então o orfanato é a casa de um bando selvagem: a fogueira no salão, os colchões largados
 * por todo canto, o açougue no refeitório, a sala de tortura, a jaula com quem ainda está vivo, o sangue por todo lado e,
 * no fim do corredor dos dormitórios, as frases escritas com sangue.
 *
 * Cômodos pequenos e cheios (o Felipe: "cuidado com as salas ENORMES com um monte de espaço"). Mesmo jeito da Fazenda:
 * cada cômodo é uma cena, a porta principal numa parede do fundo; subiu ORFANATO_REV, o orfanato é refeito no lugar.
 */
export const ORFANATO = "Orfanato · ";
export const ORFANATO_REV = 10;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);
const linha = (id: string, rot: number, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, rot] as FloorSeed);

const CASA = "Orfanato";
const FORA = "Pátio do Orfanato";

/** As frases dos transtornados, escritas com sangue na parede do fim do corredor dos dormitórios. */
export const FRASES =
  "O Diabo observa e recompensa a dor extrema.\nO Sangue é o caminho para os desejos mais profundos.\nO corpo é o canal da revelação e o sofrimento é o idioma dos escolhidos.";

/** O clima de dentro: escuro, a luz baixa e suja, a fumaça e a cinza ainda no ar. */
const QUEIMADO = { darkness: 0.66, fog: 0.22, ambient: "#7a5a46", particles: ["smoke", "dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ o pátio (de fora)

const PW = 26;
const PH = 22;
function terrenoPatio(): Terreno {
  const t = new Terreno(PW, PH);
  // a estradinha de terra: do portão até a porta da frente, e o ramal até o anexo do fundo
  t.linha([[12.5, 21], [12.5, 14], [11.5, 9], [12.5, 1]], "d", 2);
  t.linha([[12.5, 12], [16, 11], [18.5, 10.5]], "d", 2);
  // o chão gasto em volta da árvore seca do balanço e o chão queimado na frente da fachada (o fogo saiu pelas janelas)
  t.disco(5.5, 15.5, 2.4, 1.8, "d");
  t.disco(12.5, 2.5, 7, 2.2, "d");
  return t;
}
const T_PATIO = terrenoPatio();

/** A fachada do casarão (a fileira de cima) e o bloco do anexo, de paredes; o resto é o pátio. */
function patioPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  // a fachada: parede, janelas e, no meio, a porta da frente (o vão e a entrada logo na frente dele)
  for (let x = 0; x <= 25; x++) {
    if (x === 12 || x === 13) continue;
    f.push([x % 4 === 2 ? "iwall_window" : "iwall", x, 0, 4]);
  }
  f.push(["iwall_door", 12, 0, 4], ["iwall_door", 13, 0, 4]);
  f.push(["entrada", 12, 1, 4], ["entrada", 13, 1, 4]);
  // o anexo de concreto: um bloco de parede, a porta do lado de cá
  for (let y = 7; y <= 12; y++)
    for (let x = 20; x <= 24; x++) {
      if (x === 20 && y === 10) continue;
      f.push([x === 20 && y === 8 ? "iwall_window" : "iwall", x, y, 2]);
    }
  f.push(["iwall_door", 20, 10, 2], ["entrada", 19, 10, 2]);
  // as árvores (grandes, nos cantos e no fundo) e os arbustos
  for (const [x, y] of [
    [1, 4], [3, 3], [23, 4], [1, 20], [3, 19], [24, 18], [22, 20], [17, 17], [8, 5], [16, 4], [1, 10], [24, 14],
  ] as [number, number][])
    f.push(["arvore", x, y, 0]);
  f.push(["arvore", 5, 14, 0]);
  for (const [x, y] of [[10, 7], [18, 14], [7, 19]] as [number, number][]) f.push(["arbusto", x, y, 0]);
  // o que o fogo jogou para fora: telhas e madeira queimada na frente da fachada, a viga que caiu da varanda
  f.push(["escombros", 4, 1, 0], ["escombros", 19, 2, 2], ["viga_queimada", 8, 1, 2], ["rubble", 15, 2, 0]);
  f.push(...de("fuligem", [6, 2], [11, 2], [14, 2], [17, 1], [9, 3]), ...de("cinzas", [5, 3], [10, 2], [16, 3], [21, 1]));
  // o rastro de sangue do anexo até a porta da frente
  f.push(...de("blood_drops", [18, 10], [16, 11], [14, 11], [13, 8], [12, 5], [13, 3]), ...de("blood_pool", [19, 11]));
  // o banco debaixo da árvore seca e o caixote de brinquedos esquecido
  f.push(["bench", 6, 17, 4], ["crate_wood", 8, 15, 0]);
  // do lado do anexo, os ganchos de carne ao ar livre, o tambor do lixo e o corpo largado
  f.push(["gancho_carne", 17, 8, 2], ["trash_bin", 18, 13, 0], ["corpo_lencol", 15, 13, 2]);
  // a cerca da frente, com o portão no meio (tombada aqui e ali)
  for (let x = 0; x <= 25; x++) if ((x < 11 || x > 13) && x !== 4 && x !== 19) f.push(["cerca", x, 21, 4]);
  f.push(["porteira", 11, 21, 4]);
  return f;
}

// ------------------------------------------------------------------ as cenas

/** A ala dos dormitórios: a área aberta do fim do corredor (4 fileiras e a parede dos primeiros quartos), os seis quartos
 * de cada lado (3 fileiras e a parede) e o quarto da direita que virou jaula. */
const ALA_FIM = 5;
const ALA_CELA = 4;
const ALA_JAULA = 4;
const ALA_H = ALA_FIM + 6 * ALA_CELA - 1;

// ------------------------------------------------------------------ as cenas

const CENAS: CenaSpec[] = [
  {
    key: "patio",
    name: ORFANATO + "Pátio",
    description:
      "O pátio da frente do orfanato que pegou fogo e virou a casa dos transtornados: a fachada comprida enegrecida, as janelas gradeadas estouradas, telhas e madeira queimada caídas na frente, a estradinha de terra do portão até a porta, a árvore seca com o banco embaixo e, no fundo à direita, o anexo de concreto, com ganchos de carne do lado de fora. Um rastro de sangue liga o anexo à porta.",
    layout: { heightmap: T_PATIO.planta(), door: { x: 12, y: 20, dir: 0 } },
    andar: FORA,
    style: "grama",
    aberto: true,
    terreno: T_PATIO.texto(),
    darkness: 0.3,
    ambient: "#a8967a",
    particles: ["dust", "smoke"],
    floor: patioPiso(),
    wall: [],
    links: [
      [12, 1, "salao"],
      [13, 1, "salao"],
      [19, 10, "anexo"],
    ],
    plan: { x: 0, y: 0 },
    chao: [[7, 16, "Cavalinho de Balanço", 2, "misc"]],
  },
  // ------------------------------------------------------------ o casarão
  {
    key: "salao",
    name: ORFANATO + "Salão",
    description:
      "O salão do meio, destruído pelo fogo e agora a sala comum do bando: o teto caiu num canto, as vigas queimadas atravessam o chão, o balcão em L está carbonizado e, no meio, uma fogueira acesa no chão de taco, com colchões imundos em volta e os crânios empilhados como troféu. Cheira a fumaça, carne e sangue. Para cima, o refeitório; do lado, a sala de estudos, o quarto da diretora e os banheiros; para baixo, a ala dos dormitórios.",
    layout: plan(12, 10, 5),
    andar: CASA,
    style: "taco",
    ...QUEIMADO,
    floor: [
      ["portal", 1, 5, 2],
      ["portal", 9, 0, 4],
      ["portal", 12, 2, 6],
      ["portal", 12, 5, 6],
      ["portal", 12, 8, 6],
      ["portal", 6, 9, 0],
      // o que sobrou atrás do balcão e o balcão em L, queimado
      ["prateleira", 1, 0, 4],
      ["armario_cozinha", 5, 0, 4],
      ["counter_wood", 1, 2, 4],
      ["counter_wood", 3, 2, 4],
      ["counter_wood", 5, 2, 2],
      ["stool", 3, 3, 0],
      // o teto que caiu no canto de cima e as vigas atravessadas no chão
      ["escombros", 10, 0, 0],
      ["escombros", 3, 6, 2],
      ["viga_queimada", 11, 5, 0],
      // a sala comum do bando: a fogueira no meio do chão, os colchões em volta e a pilha de crânios, o troféu deles
      ["fogueira", 7, 3, 0],
      ["colchao_chao", 5, 4, 2],
      ["colchao_chao", 9, 5, 0],
      ["colchao_chao", 6, 6, 0],
      ["pilha_cranios", 9, 7, 0],
      ["skull", 7, 6, 2],
      ["food_tray", 8, 6, 0],
      ["trash_bin", 1, 9, 0],
      ["armchair", 10, 3, 6, oculta("Poltrona", "O estofado foi rasgado por dentro, com as unhas. Lá dentro, cabelo de criança amarrado com fita.")],
      ["candelabra", 2, 8, 0],
      ...de("blood_pool", [2, 4], [6, 8], [10, 2]),
      ...de("blood_drops", [4, 4], [5, 5], [7, 8], [10, 7], [11, 1], [1, 7]),
      ...de("fuligem", [2, 1], [4, 1], [6, 2], [9, 2], [1, 9]),
      ...de("cinzas", [3, 5], [5, 7], [8, 8], [10, 8]),
    ],
    wall: [
      ["fuligem_parede", "r", 0, 2.6, 0.3],
      ["fuligem_parede", "r", 0, 7.5, 0.3],
      ["fuligem_parede", "l", 1, 1.8, 0.3],
      ["window_barred", "l", 1, 8.5, 2.2],
      ["sigil_scratch", "l", 1, 3.4, 2.4],
      ["tally_marks", "r", 0, 5.0, 2.6],
    ],
    links: [
      [1, 5, "patio"],
      [9, 0, "refeitorio"],
      [12, 2, "estudos"],
      [12, 5, "diretora"],
      [12, 8, "banheiros"],
      [6, 9, "dormitorios"],
    ],
    plan: { x: 0, y: 8 },
    chao: [[4, 8, "Boneca de Pano", 0.5, "misc"]],
  },
  {
    key: "refeitorio",
    name: ORFANATO + "Refeitório",
    description:
      "O refeitório comprido, onde o fogo começou, virou o açougue do bando: a cozinha do fundo derreteu, mas o fogão a lenha voltou a ser aceso; o teto desabou em cima de uma das mesas compridas, e na outra, coberta de sangue, há facas, ossos raspados e um corpo pela metade. Nos ganchos, pendurado, o que eles comem.",
    layout: planBottom(14, 6, 9),
    andar: CASA,
    style: "taco",
    ...QUEIMADO,
    darkness: 0.7,
    floor: [
      ["portal", 9, 5, 0],
      // a cozinha queimada, na parede do fundo
      ["armario_cozinha", 0, 0, 4],
      ["fogao_lenha", 2, 0, 4],
      ["pia_cozinha", 4, 0, 4],
      ["armario_cozinha", 8, 0, 4],
      // uma mesa comprida inteira, que virou a bancada do açougue; a outra soterrada pelo teto
      ["mesa_jantar", 1, 2, 4, oculta("Mesa", "Facas, um cutelo, ossos raspados e um corpo aberto pela metade. Ao lado, pratos com restos. Comem aqui mesmo.")],
      ...linha("bench", 0, [1, 4]),
      ["corpo_lencol", 1, 1, 2],
      // os ganchos de carne, no canto da cozinha
      ["gancho_carne", 11, 2, 0],
      ["gancho_carne", 6, 1, 0],
      ["escombros", 8, 2, 0],
      ["viga_queimada", 10, 4, 2],
      ["barrel", 13, 4, 0],
      ["crate_wood", 13, 3, 0],
      ...de("blood_pool", [3, 3], [5, 4], [12, 4]),
      ...de("blood_drops", [2, 5], [6, 5], [10, 4], [8, 5], [12, 2]),
      ...de("fuligem", [1, 0], [3, 0], [6, 0], [7, 1], [12, 0], [13, 1]),
      ...de("cinzas", [0, 2], [5, 1], [11, 4], [6, 4]),
    ],
    wall: [
      ["fuligem_parede", "r", 0, 3.0, 0.3],
      ["fuligem_parede", "r", 0, 6.0, 0.3],
      ["fuligem_parede", "r", 0, 11.0, 0.3],
      ["fuligem_parede", "l", 0, 2.5, 0.3],
    ],
    links: [[9, 5, "salao"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "estudos",
    name: ORFANATO + "Sala de Estudos",
    description:
      "A sala de estudos virou a sala de tortura: no meio, uma mesa de aço com as correias, o chão embaixo preto de sangue; a mesa das ferramentas encostada; as correntes na parede. As estantes caídas, os livros virados cinza. No quadro, por cima das contas pela metade, alguém riscou o mesmo símbolo, várias vezes.",
    layout: plan(7, 6, 2),
    andar: CASA,
    style: "carpete",
    ...QUEIMADO,
    floor: [
      ["portal", 1, 2, 2],
      ["bookshelf", 1, 0, 4],
      ["whiteboard", 5, 0, 4, oculta("Quadro", "As contas de uma aula de matemática e, por cima delas, o mesmo símbolo riscado com carvão, cada vez maior, até rasgar o quadro.")],
      ["mesa_contencao", 3, 2, 4, oculta("Mesa de tortura", "As correias estão frouxas de tanto uso. Embaixo, um balde, unhas e dentes.")],
      ["table_tools", 6, 3, 6],
      ["chair_wood", 6, 5, 0],
      ["viga_queimada", 1, 3, 0],
      ...de("books_stack", [5, 4], [7, 5]),
      ...de("blood_pool", [5, 2], [3, 5]),
      ...de("blood_drops", [4, 1], [2, 4], [6, 1]),
      ...de("fuligem", [3, 0], [4, 0], [1, 1]),
      ...de("cinzas", [2, 1], [5, 5]),
    ],
    wall: [
      ["fuligem_parede", "r", 0, 3.5, 0.3],
      ["chains_wall", "l", 1, 4.0, 2.4],
      ["window_barred", "l", 1, 5.1, 2.2],
    ],
    links: [[1, 2, "salao"]],
    plan: { x: 13, y: 8 },
    chao: [[2, 5, "Blocos de Montar", 1, "misc"]],
  },
  {
    key: "diretora",
    name: ORFANATO + "Quarto da Diretora",
    description:
      "O quarto da diretora, o único que o fogo quase não pegou, e por isso o pior: a cama coberta de sangue velho, o guarda-roupa arrombado por dentro e a escrivaninha com as cartas que ela nunca mandou.",
    layout: plan(6, 6, 3),
    andar: CASA,
    style: "taco",
    ...QUEIMADO,
    darkness: 0.6,
    floor: [
      ["portal", 1, 3, 2],
      ["guarda_roupa", 1, 0, 4, oculta("Guarda-roupa", "Arrombado POR DENTRO: as portas estão estufadas para fora. Lá dentro, um hábito de freira rasgado e uma caixa de metal com um cadeado novo.")],
      ["comoda", 3, 0, 4],
      ["nightstand", 5, 0, 4],
      ["cama_solteiro", 6, 0, 4, oculta("Cama", "O colchão está ensopado de sangue velho, endurecido. Há marcas de unha na cabeceira, de dentro para fora.")],
      ["rug_worn", 3, 2, 0],
      ["desk_wood", 1, 5, 0, oculta("Escrivaninha", "Cartas para a Ordem, datadas e assinadas, nenhuma enviada. A última termina no meio de uma frase: \"eles não estão mais doentes, estão\"")],
      ["chair_wood", 2, 4, 4],
      ["cabinet_file", 6, 5, 0],
      ["candles", 5, 1, 0],
      ...de("blood_pool", [5, 2], [4, 4]),
      ...de("blood_drops", [3, 1], [6, 4], [2, 2], [3, 5]),
      ...de("fuligem", [6, 3]),
    ],
    wall: [
      ["mirror", "r", 0, 4.0, 2.72],
      ["tally_marks", "l", 1, 1.7, 2.6],
      ["window_barred", "l", 1, 5.0, 2.2],
    ],
    links: [[1, 3, "salao"]],
    plan: { x: 13, y: 14 },
  },
  {
    key: "banheiros",
    name: ORFANATO + "Banheiros",
    description:
      "Os banheiros das crianças: os vasos quebrados, uma divisória caída, e as duas banheiras de ferro cheias até a borda de uma água escura que não é água. O chão nunca secou.",
    layout: plan(8, 6, 3),
    andar: CASA,
    style: "xadrez",
    ...QUEIMADO,
    darkness: 0.68,
    floor: [
      ["portal", 1, 3, 2],
      ["toilet", 1, 0, 4],
      ["stall_panel", 2, 0, 4],
      ["toilet", 3, 0, 4],
      ["toilet", 5, 0, 4],
      ["banheira", 7, 0, 4, oculta("Banheira", "Cheia até a borda de sangue escuro, frio. Lá no fundo, alguma coisa encosta na mão de quem procura.")],
      ["banheira", 8, 0, 4],
      ["sink", 8, 3, 6],
      ["escombros", 4, 3, 0],
      ...de("blood_pool", [7, 2], [8, 2], [3, 2], [6, 4]),
      ...de("blood_drops", [2, 2], [5, 1], [6, 2], [7, 5], [2, 4]),
      ...de("puddle", [3, 4], [5, 5]),
      ...de("fuligem", [4, 0], [6, 0]),
    ],
    wall: [
      ["mirror", "l", 1, 1.5, 2.72],
      ["fuligem_parede", "r", 0, 6.0, 0.3],
    ],
    links: [[1, 3, "salao"]],
    plan: { x: 13, y: 20 },
  },
  {
    key: "dormitorios",
    name: ORFANATO + "Ala dos Dormitórios",
    description:
      "O corredor comprido dos dormitórios, o coração do Ninho: doze quartinhos queimados dos dois lados, cada um com a sua porta, onde o bando dorme amontoado, nas camas de ferro retorcidas e nos colchões largados no chão; o teto caído em cima de alguns; um quarto com a porta trocada por uma grade, a jaula de quem ainda está vivo; crânios empilhados, sangue por todo lado. No fim do corredor, na parede, as frases escritas com sangue. No fim do corredor, na parede, as frases escritas com sangue.",
    layout: planBottom(13, ALA_H, 6),
    andar: CASA,
    style: "madeira",
    ...QUEIMADO,
    darkness: 0.72,
    floor: dormitorios(),
    wall: [
      // no fim do corredor, as frases escritas com sangue (o texto inteiro vai na pista)
      ["escrita_sangue", "r", 0, 6.5, 0.6, { icon: "inspect", title: "Escrito com sangue", text: FRASES, visible: true }],
      ["fuligem_parede", "r", 0, 1.8, 0.3],
      ["fuligem_parede", "r", 0, 11.2, 0.3],
      // uma janela gradeada em um quarto sim, um não; fuligem nos outros
      ...[0, 2, 4].map((i): WallSeed => ["window_barred", "l", 0, ALA_FIM + i * ALA_CELA + 1.5, 2.2]),
      ...[1, 3, 5].map((i): WallSeed => ["fuligem_parede", "l", 0, ALA_FIM + i * ALA_CELA + 1.5, 0.3]),
      // não tem luz: o fogo levou a fiação; a tocha que eles prenderam na parede da área aberta
      ["tocha_parede", "l", 0, 2.0, 2.4],
    ],
    links: [[6, ALA_H - 1, "salao"]],
    plan: { x: 0, y: 19 },
    chao: [
      [6, 8, "Ursinho de Pelúcia", 1, "misc"],
      [5, 13, "Trenzinho de Madeira", 1, "misc"],
      [7, 16, "Soldadinhos de Chumbo", 0.5, "misc"],
      [6, 20, "Pião de Madeira", 0.5, "misc"],
      [7, 24, "Bolinhas de Gude", 0.5, "misc"],
    ],
  },
  {
    key: "anexo",
    name: ORFANATO + "Anexo",
    description:
      "O anexo de concreto do fundo do pátio, que o fogo não pegou: dois leitos de ferro com as correias, um saco de cadáver no canto, o ralo no meio entupido e sangue que ninguém limpou. É aqui que os transtornados trazem o que caçam.",
    layout: plan(7, 5, 2),
    andar: FORA,
    style: "concreto",
    darkness: 0.66,
    fog: 0.15,
    ambient: "#8a4a40",
    particles: ["dust"],
    floor: [
      ["portal", 1, 2, 2],
      ["cabinet_file", 1, 0, 4],
      ["hospital_bed", 3, 0, 4, oculta("Leito", "As correias de couro estão gastas de tanto apertar. São do tamanho de um pulso de criança.")],
      ["trolley", 4, 0, 4],
      ["hospital_bed", 5, 0, 4],
      ["corpo_saco", 7, 0, 4],
      ["drain", 4, 3, 0],
      ...de("blood_pool", [3, 3], [5, 4], [2, 3], [6, 3]),
      ...de("blood_drops", [2, 4], [6, 4], [4, 1], [1, 3], [7, 4]),
      ["candelabra", 6, 1, 0],
    ],
    wall: [
      ["chains_wall", "r", 0, 2.0, 2.4],
      ["cage_lamp", "l", 1, 3.5, 3.2],
      ["sigil_scratch", "r", 0, 6.0, 2.4],
    ],
    links: [[1, 2, "patio"]],
    plan: { x: 20, y: 7 },
  },
];

/**
 * A ala dos dormitórios: o corredor no meio (x 5 a 7), a entrada embaixo (do salão) e o corredor correndo até a área
 * aberta do fim (as fileiras de cima, sem quarto), onde estão as frases na parede. Seis quartos de cada lado, cada um um
 * quarto de verdade (o Felipe, 09/10): parede inteira em volta e a porta de madeira, que fecha como a porta da cela
 * (fechada, ninguém passa e o quarto fica no escuro; aberta, acende e a parede da frente fica transparente). Queimados:
 * as camas retorcidas, o teto caído em cima de alguns, os colchões onde os transtornados dormem, os crânios e o sangue.
 * A área aberta tem 4 fileiras para a parede alta dos quartos não tapar a escrita.
 */
function dormitorios(): FloorSeed[] {
  const f: FloorSeed[] = [["portal", 6, ALA_H - 1, 0]];
  for (let i = 0; i < 6; i++) {
    const y0 = ALA_FIM + i * ALA_CELA;
    // as paredes: a de cima (entre um quarto e o outro, ou entre o primeiro e a área aberta) e a do corredor, com a porta
    for (const x of [0, 1, 2, 3, 4, 8, 9, 10, 11, 12]) f.push(["parede_orfanato", x, y0 - 1, 4]);
    for (let y = y0; y < y0 + 3; y++) {
      if (y !== y0 + 1) {
        f.push(["parede_orfanato", 4, y, 2], ["parede_orfanato", 8, y, 6]);
        continue;
      }
      // umas portas ficaram abertas, outras eles fecham; o quarto da jaula, com a porta de grade, sempre fechado
      const aberta = (lado: number) => ((i + lado) % 3 === 0 ? 1 : 0);
      f.push(["porta_quarto", 4, y, 2, undefined, aberta(0)]);
      if (i === ALA_JAULA)
        f.push(["cell_door", 8, y, 6, hint("Quarto trancado", "A porta de madeira foi trocada por uma grade, com corrente e cadeado. Lá dentro, alguém ainda respira.")]);
      else f.push(["porta_quarto", 8, y, 6, undefined, aberta(1)]);
    }
    // em dois quartos o teto caiu em cima da cama; nos outros, a cama queimada, o baú e o colchão no chão
    const desabou = (lado: number) => (i * 2 + lado) % 5 === 2;
    if (desabou(0)) f.push(["escombros", 0, y0, 0], ["viga_queimada", 0, y0 + 2, 2]);
    else f.push(["cama_queimada", 0, y0, 4], ["chest_army", 3, y0 + 2, 0], ["colchao_chao", 1, y0 + 1, 0]);
    if (desabou(1)) f.push(["escombros", 11, y0, 0], ["viga_queimada", 10, y0 + 2, 2]);
    else f.push(["cama_queimada", 12, y0, 4], ["chest_army", 9, y0 + 2, 0], ["colchao_chao", 10, y0 + 1, 0]);
    if (i % 2 === 1 && !desabou(0)) f.push(["pilha_cranios", 2, y0 + 2, 0]);
    // o sangue e a fuligem dos quartos e do corredor, e as velas do corredor (não tem luz)
    f.push(["blood_pool", 2, y0 + 1, 0], ["blood_drops", 10, y0 + 1, 0], ["fuligem", 1, y0 + 2, 0], ["cinzas", 11, y0 + 2, 0]);
    f.push(["blood_drops", 5 + (i % 3), y0 + 1, 0]);
    f.push(i % 2 ? ["candles", 5, y0 + 2, 0] : ["candles", 7, y0, 0]);
  }
  // a área aberta do fim do corredor (a parede das frases): as velas acesas embaixo da escrita, os crânios, o sangue
  f.push(...de("candles", [3, 1], [6, 1], [9, 1]), ["pilha_cranios", 5, 1, 0], ["skull", 7, 1, 0], ["skull", 1, 1, 2]);
  f.push(...de("blood_pool", [4, 0], [6, 0], [8, 1], [11, 0], [6, 3]), ...de("blood_drops", [2, 0], [10, 1], [5, 3], [8, 3]));
  f.push(["trash_bin", 7, 18, 0], ["food_tray", 5, 16, 0]);
  return f;
}

// ------------------------------------------------------------------ montagem

/** O que sobrou dos móveis aparece vazio, revirado (a arte "!vazio" do Códex, quando existe). */
const SAQUEADOS = new Set(["armario_cozinha", "prateleira", "comoda", "nightstand", "mesa_jantar", "mesa_cozinha", "bookshelf"]);

function arruinar(room: RoomData) {
  for (const it of room.items) if (SAQUEADOS.has(it.defId)) (it as FloorItem).vazio = true;
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

/** Monta o orfanato inteiro e a campanha dele (o lugar "Orfanato Filhos do Dragão" do mapa-múndi). */
export function seedOrfanato(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(ORFANATO))) return;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    const room = montar(db, spec);
    estilo(room, spec);
    arruinar(room);
    built.set(spec.key, room);
  }
  ligar(built);
  db.rooms.push(...built.values());
  const primeira = built.get(CENAS[0].key)!;
  db.campaigns ??= {};
  db.campaigns[String(primeira.id)] = {
    title: "Orfanato Filhos do Dragão",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.orfanatoRev = ORFANATO_REV;
}

/** Refaz o orfanato no lugar quando a montagem muda (ORFANATO_REV): mesmas cenas, peças e registro. */
function rebuildOrfanato(db: Database): boolean {
  if ((db.orfanatoRev ?? 0) >= ORFANATO_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(ORFANATO));
  if (!existing.length) return false;
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
    arruinar(room);
    built.set(spec.key, room);
  }
  ligar(built);
  // as peças que estavam numa casa que sumiu vão para perto da porta
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    for (const t of room.tokens ?? []) {
      if (map.walkState(t.x, t.y) === "walk") continue;
      t.x = room.door.x;
      t.y = room.door.y;
    }
  }
  const key = Math.min(...[...built.values()].map((r) => r.id));
  const camp = db.campaigns?.[String(key)];
  if (camp) for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  db.orfanatoRev = ORFANATO_REV;
  return true;
}

/** Monta o orfanato se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarOrfanato(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(ORFANATO))) {
    seedOrfanato(db);
    return true;
  }
  return rebuildOrfanato(db);
}
