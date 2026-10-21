import { getFurni, RoomMap, type FloorItem, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { plan, type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * O Orfanato Filhos do Dragão (09/10), o terceiro lugar da campanha, montado a partir da planta que o Felipe mandou: um
 * prédio comprido e estreito, de um andar só. Em cima, o refeitório; embaixo dele, o salão grande à esquerda (o balcão em
 * L) e a cozinha à direita; descendo pela direita, o depósito e o quarto da diretora, os sanitários e o banheiro, a sala
 * de banho; e embaixo de tudo a ala dos dormitórios, o corredor largo com seis quartos de cada lado. Fora, o pátio: o
 * prédio, a estradinha de terra contornando pela direita até o anexo de concreto do canto de cima, as árvores.
 *
 * O ORFANATO PEGOU FOGO (o Felipe, 09/10): está todo destruído e queimado, cheio de escombros, o teto caído, fuligem nas
 * paredes e cinza no chão. E virou o NINHO dos transtornados ("ninho" é como eles chamam a base deles, não ninho de bicho).
 * O livro (LR p. 303): o culto dos transtornados é desorganizado, uma histeria coletiva; eles invadem lugares abandonados
 * para MORAR e fazem do lugar inteiro uma casa de tortura e agonia, sem nenhuma sutileza: canibalismo, tortura e
 * mutilação são o dia a dia. Então o orfanato é a casa de um bando selvagem: a fogueira no salão, os colchões largados
 * por todo canto, o açougue no refeitório, a jaula com quem ainda está vivo, o sangue por todo lado e, na área aberta
 * onde o corredor dos quartos termina (o salão), as frases escritas com sangue na parede.
 *
 * Cada cômodo é uma cena (o Felipe: "entrei na sala, mudou o cenário"), inclusive cada quarto. Na planta do andar, cada
 * cena fica onde está no desenho (`plan`, em casas, a origem no canto de cima à esquerda do prédio). Subiu ORFANATO_REV, o
 * orfanato é refeito no lugar (e a cena que saiu da montagem é apagada).
 */
export const ORFANATO = "Orfanato · ";
export const ORFANATO_REV = 23;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const de = (id: string, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, 0] as FloorSeed);
const linha = (id: string, rot: number, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, rot] as FloorSeed);

const CASA = "Orfanato";
const FORA = "Pátio do Orfanato";

/** As frases dos transtornados, escritas com sangue na parede da área aberta (o salão), onde o corredor dos quartos termina. */
export const FRASES =
  "O Diabo observa e recompensa a dor extrema.\nO Sangue é o caminho para os desejos mais profundos.\nO corpo é o canal da revelação e o sofrimento é o idioma dos escolhidos.";

/** O clima de dentro: escuro, a luz baixa e suja, a fumaça e a cinza ainda no ar. */
const QUEIMADO = { darkness: 0.66, fog: 0.22, ambient: "#7a5a46", particles: ["smoke", "dust"] as CenaSpec["particles"] };

// ------------------------------------------------------------------ as medidas do prédio (em casas)

/** O prédio: 16 casas de largura; o refeitório em cima (6 fileiras), o meio (16) e a ala dos quartos (24). */
const PREDIO_W = 16;
/** A ala: o corredor largo (6 casas) entre os quartos de 5 × 4. */
const ALA_Y = 22;
const ALA_COR_X = 5;
const ALA_COR_W = 6;
const ALA_QUARTO = 4;
const ALA_H = 6 * ALA_QUARTO;
const PREDIO_H = ALA_Y + ALA_H;
/** O salão (o refeitório das crianças): grande, 14 casas de largura, vazando para a esquerda do prédio na planta. */
const SALAO_W = 14;
/** o quarto da direita que virou jaula (a passagem trancada, com a pista da grade) */
const ALA_JAULA = 4;
/** a fileira do corredor em que fica a passagem do quarto i (a cena começa na fileira 1: a 0 é a porta da frente) */
const portaDoQuarto = (i: number) => 1 + i * ALA_QUARTO + 1;
const chaveQuarto = (lado: "E" | "D", i: number) => `quarto${lado}${i}`;

// ------------------------------------------------------------------ o pátio (de fora)

/** Onde o prédio fica no pátio (o canto de cima à esquerda das paredes de fora). */
const PX = 2;
const PY = 2;
const PW = PX + PREDIO_W + 2 + 9;
const PH = PY + PREDIO_H + 2 + 3;
/** a porta do prédio no pátio: no fim do corredor dos quartos, na ponta de baixo (PORTA_Y é a última fileira do prédio) */
const PORTA_X = PX + 1 + ALA_COR_X + 2;
const PORTA_Y = PY + PREDIO_H;
/** o anexo de concreto, no canto de cima à direita */
const AX = PX + PREDIO_W + 3;
const AY = PY + 1;

function terrenoPatio(): Terreno {
  const t = new Terreno(PW, PH);
  // o chão do prédio queimado (o teto caiu: de fora se vê o miolo de cinza e terra)
  t.ret(PX + 1, PY + 1, PX + PREDIO_W, PY + PREDIO_H, "d");
  // a estradinha de terra: da porteira de baixo, subindo pela direita do prédio até o anexo, e o ramal até a porta
  t.linha([[PW - 5, PH - 1], [PW - 6.5, PH - 10], [AX - 1.5, PH * 0.55], [AX - 1.2, PH * 0.3], [AX - 1.5, AY + 6]], "d", 2);
  t.linha([[PW - 6, PH - 3.5], [PX + PREDIO_W, PH - 2.8], [PORTA_X + 0.5, PH - 2.5]], "d", 2);
  // o chão gasto e queimado na frente da porta
  t.disco(PORTA_X + 0.5, PORTA_Y + 1.5, 3, 1.4, "d");
  return t;
}
const T_PATIO = terrenoPatio();

/** As paredes de fora do prédio e do anexo, a porta, as árvores, a estradinha, o que o fogo jogou para fora. */
function patioPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  const y1 = PORTA_Y;
  // o prédio queimado inteiro, um mobi só (desenhado em código até chegar a arte do Códex), e a entrada na porta da frente
  f.push(["orfanato_predio", PX + 1, PY + 1, 0]);
  f.push(["entrada", PORTA_X, y1 + 1, 0], ["entrada", PORTA_X + 1, y1 + 1, 0]);
  // o anexo de concreto: um bloco de parede, a porta do lado da estradinha
  for (let y = AY; y <= AY + 5; y++)
    for (let x = AX; x <= AX + 4; x++) {
      if (x === AX && y === AY + 4) continue;
      f.push([x === AX && y === AY + 1 ? "iwall_window" : "iwall", x, y, 2]);
    }
  f.push(["iwall_door", AX, AY + 4, 2], ["entrada", AX - 1, AY + 4, 2]);
  // as árvores: o bosque da direita, as do canto de cima e as de baixo à esquerda
  for (const [x, y] of [
    [PW - 2, 1], [PW - 5, 0], [PW - 2, 10], [PW - 3, 16], [PW - 1, 21], [PW - 3, 27], [PW - 1, 33], [PW - 3, 39], [PW - 2, 45],
    [0, 6], [0, 18], [0, 31], [0, PH - 6], [1, PH - 2], [AX + 1, AY + 8],
  ] as [number, number][])
    f.push(["arvore", x, y, 0]);
  for (const [x, y] of [[AX + 2, AY + 12], [PW - 6, 24], [AX, 36], [3, PH - 3]] as [number, number][]) f.push(["arbusto", x, y, 0]);
  // o que o fogo jogou para fora, em volta da porta
  f.push(["escombros", PORTA_X - 4, y1 + 1, 0], ["viga_queimada", PORTA_X + 3, y1 + 1, 2]);
  f.push(...de("fuligem", [PORTA_X - 1, y1 + 1], [PORTA_X + 2, y1 + 2]), ...de("cinzas", [PORTA_X - 2, y1 + 2], [PORTA_X + 3, y1 + 2]));
  // o rastro de sangue do anexo até a porta, pela estradinha, e os ganchos de carne do lado do anexo
  f.push(...de("blood_pool", [AX - 1, AY + 5]), ...de("blood_drops", [AX - 2, AY + 8], [AX - 2, 16], [AX - 2, 26], [AX - 3, 38], [PORTA_X + 4, PORTA_Y + 2], [PORTA_X + 1, PORTA_Y + 2]));
  f.push(["gancho_carne", AX + 1, AY + 7, 2], ["trash_can", AX - 1, AY + 1, 0], ["corpo_lencol", AX + 3, AY + 9, 2]);
  // a cerca de baixo, com a porteira da estradinha (tombada aqui e ali)
  for (let x = 0; x < PW; x++) if ((x < PW - 6 || x > PW - 4) && x % 7 !== 3) f.push(["cerca", x, PH - 1, 4]);
  f.push(["porteira", PW - 6, PH - 1, 4]);
  return f;
}

// ------------------------------------------------------------------ as cenas

const CENAS: CenaSpec[] = [
  {
    key: "patio",
    name: ORFANATO + "Pátio",
    description:
      "O terreno do orfanato que pegou fogo e virou a casa dos transtornados: o prédio comprido de um andar só, enegrecido, o telhado caído por dentro, as janelas gradeadas estouradas; a porta no fim da ala dos quartos, com entulho na frente; a estradinha de terra subindo pela direita até o anexo de concreto do canto, com ganchos de carne do lado de fora; o bosque em volta. Um rastro de sangue liga o anexo à porta.",
    layout: { heightmap: T_PATIO.planta(), door: { x: PW - 5, y: PH - 2, dir: 0 } },
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
      [PORTA_X, PORTA_Y + 1, "dormitorios"],
      [PORTA_X + 1, PORTA_Y + 1, "dormitorios"],
      [AX - 1, AY + 4, "anexo"],
    ],
    plan: { x: 0, y: 0 },
    chao: [[PORTA_X - 2, PORTA_Y + 2, "Cavalinho de Balanço", 2, "misc"]],
  },
  // ------------------------------------------------------------ o prédio, de cima para baixo
  {
    key: "refeitorio",
    name: ORFANATO + "Enfermaria",
    description:
      "A enfermaria pequena do alto do prédio: uma fileira de caminhas simples de lona, onde as crianças ficavam deitadas depois dos \"tratamentos\" da sala de cirurgia lá fora, até se recuperarem. Os lençóis duros de sangue velho, o carrinho das bandagens tombado, o balde, a bandeja com os frascos. O fogo queimou metade das caminhas; nas outras, alguém do bando dorme agora.",
    layout: planBottom(13, 6, 1),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    darkness: 0.7,
    floor: [
      ["portal", 1, 5, 0],
      // a fileira de caminhas de lona contra a parede do fundo, e duas atravessadas embaixo
      ...[2, 4, 6, 8, 10, 12].map((x): FloorSeed => ["catre", x, 0, 4]),
      ["catre", 0, 3, 2],
      ["catre", 0, 4, 2],
      // o que sobrou da enfermaria: o carrinho das bandagens, a bandeja, o balde, o armarinho de remédio
      ["med_tray", 7, 3, 0],
      ["trash_can", 11, 4, 0],
      ["medical_cabinet", 0, 1, 2],
      ["escombros", 9, 3, 0],
      ["viga_queimada", 6, 4, 2],
      ...de("blood_pool", [2, 2], [6, 2], [10, 3], [5, 5]),
      ...de("blood_drops", [3, 4], [8, 3], [9, 4], [1, 3], [12, 5]),
      ...de("fuligem", [1, 0], [7, 0], [11, 0]),
      ...de("cinzas", [0, 4], [9, 2], [12, 3]),
    ],
    wall: [
      ["fuligem_parede", "r", 0, 3.0, 0.3],
      ["fuligem_parede", "r", 0, 8.0, 0.3],
      ["window_barred", "r", 0, 5.5, 2.2],
      ["window_barred", "r", 0, 11.0, 2.2],
      ["fuligem_parede", "l", 0, 3.5, 0.3],
    ],
    links: [[1, 5, "salao"]],
    plan: { x: 3, y: 0 },
  },
  {
    key: "salao",
    name: ORFANATO + "Salão",
    description:
      "O salão grande, o refeitório onde as crianças comiam, a área aberta onde o corredor dos quartos termina (do corredor se entra direto, sem porta). As duas fileiras de mesas compridas com os bancos ainda estão lá, queimadas e quebradas, com o teto caído em cima de uma; o balcão da comida carbonizado no canto. O bando fez dali a sala comum: no fundo, uma fogueira acesa no chão de taco, colchões imundos em volta e os crânios empilhados como troféu. Na parede comprida, escritas com sangue, as frases deles. Cheira a fumaça, carne e sangue.",
    layout: planBottom(SALAO_W, 16, SALAO_W - 2),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    floor: [
      // do corredor se entra direto (a mesma área, dividida em duas cenas): a passagem aberta, sem porta desenhada
      ["passagem_aberta", SALAO_W - 2, 15, 0],
      ["passagem_aberta", SALAO_W - 1, 15, 0],
      ["portal", SALAO_W - 3, 0, 4],
      ["portal", SALAO_W - 1, 2, 6],
      ["portal", SALAO_W - 1, 6, 6],
      ["portal", SALAO_W - 1, 9, 6],
      // as duas fileiras de mesas compridas das crianças, com os bancos dos dois lados
      ...[2, 7].flatMap((y): FloorSeed[] => [
        ["mesa_jantar", 1, y, 4],
        ["mesa_jantar", 7, y, 4],
        ...linha("bench", 4, [1, y - 1], [3, y - 1], [7, y - 1], [9, y - 1]),
        ...linha("bench", 0, [1, y + 2], [3, y + 2], [7, y + 2], [9, y + 2]),
      ]),
      // o teto que caiu em cima de uma das mesas, e as vigas no chão
      ["escombros", 11, 4, 0],
      ["viga_queimada", 5, 5, 0],
      // o balcão da comida no canto, na parede oposta à das frases, e a prateleira na parede do fundo
      ...linha("counter_wood", 2, [SALAO_W - 2, 11], [SALAO_W - 2, 13]),
      ["prateleira", 2, 0, 4],
      // a sala comum do bando, no fundo: a fogueira, os colchões em volta, os crânios e a comida
      ["fogueira", 5, 11, 0],
      ["colchao_chao", 3, 11, 0],
      ["colchao_chao", 8, 11, 0],
      ["colchao_chao", 5, 13, 2],
      ["pilha_cranios", 2, 14, 0],
      ["skull", 4, 10, 2],
      ["food_tray", 7, 13, 0],
      ["viga_queimada", 8, 14, 2],
      ["trash_can", 10, 10, 0],
      // as velas no chão, embaixo das frases (longe da parede, para não tapar a escrita)
      ...de("candles", [1, 5], [1, 12], [1, 0]),
      ...de("blood_pool", [4, 12], [2, 5], [10, 4]),
      ...de("blood_drops", [5, 4], [6, 14], [11, 15], [2, 10]),
      ...de("fuligem", [0, 0], [12, 0], [5, 0], [11, 8]),
      ...de("cinzas", [6, 1], [11, 2], [3, 15], [10, 12]),
    ],
    wall: [
      // na parede comprida da área aberta, as frases escritas com sangue (o texto inteiro vai na pista)
      ["escrita_sangue", "l", 0, 8.0, 0.3, { icon: "inspect", title: "Escrito com sangue", text: FRASES, visible: true }],
      ["tocha_parede", "l", 0, 1.6, 2.4],
      ["tocha_parede", "l", 0, 14.4, 2.4],
      ["fuligem_parede", "r", 0, 3.0, 0.3],
      ["window_barred", "r", 0, 6.0, 2.2],
      ["fuligem_parede", "r", 0, 9.0, 0.3],
      // os riscos ao lado da porta do refeitório (em 11,5 ficavam em cima dela)
      ["tally_marks", "r", 0, 12.6, 2.6],
    ],
    links: [
      [SALAO_W - 2, 15, "dormitorios"],
      [SALAO_W - 1, 15, "dormitorios"],
      [SALAO_W - 3, 0, "refeitorio"],
      [SALAO_W - 1, 2, "cozinha"],
      [SALAO_W - 1, 6, "deposito"],
      [SALAO_W - 1, 9, "sanitarios"],
    ],
    // na planta, o salão vaza para a esquerda do prédio (como no desenho do Felipe, cortado na beira)
    plan: { x: 7 - SALAO_W, y: 6 },
    chao: [[2, 12, "Boneca de Pano", 0.5, "misc"]],
  },
  {
    key: "cozinha",
    name: ORFANATO + "Cozinha",
    description:
      "A cozinha do orfanato, ao lado do salão: os armários de parede derretidos, a pia rachada e o fogão a lenha, que o bando voltou a acender. Na mesa do meio, coberta de sangue, as facas e o que estão cortando.",
    layout: planTop(9, 5, 6),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    darkness: 0.62,
    floor: [
      ["portal", 0, 3, 2],
      // os armários e a pia na parede de cima, o fogão aceso e o canto do lixo
      ["armario_cozinha", 0, 1, 4],
      ["fogao_lenha", 2, 1, 4],
      ["pia_cozinha", 4, 1, 4],
      ["armario_cozinha", 7, 1, 4],
      ["mesa_cozinha", 3, 3, 4, oculta("Mesa", "Coberta de sangue grosso. Uma tábua, um cutelo cravado e um pé pequeno embrulhado em pano.")],
      ["gancho_carne", 8, 3, 0],
      ["barrel", 1, 5, 0],
      ["trash_can", 7, 5, 0],
      ...de("blood_pool", [6, 3], [2, 4]),
      ...de("blood_drops", [1, 3], [6, 5], [5, 2]),
      ...de("fuligem", [6, 1], [0, 5]),
      ...de("cinzas", [4, 5]),
    ],
    wall: [
      ["fuligem_parede", "r", 1, 3.5, 0.3],
      ["window_barred", "r", 1, 5.3, 2.2],
    ],
    links: [[0, 3, "salao"]],
    plan: { x: 7, y: 6 },
  },
  {
    key: "deposito",
    name: ORFANATO + "Depósito",
    description:
      "O depósito atrás do salão: barris, caixotes, sacos de mantimento rasgados. O bando guarda aqui o que pega, e nem tudo é comida: um dos sacos se mexe de vez em quando.",
    layout: plan(4, 3, 1),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    darkness: 0.74,
    floor: [
      ["portal", 1, 1, 2],
      ["portal", 4, 1, 6],
      ...de("barrel", [2, 0], [3, 0]),
      ["crate_wood", 4, 0, 0],
      ["crate_wood", 2, 2, 0],
      ["sacas", 3, 2, 0, oculta("Sacos", "Sacos de lona amarrados com corda. Dentro de um deles, alguma coisa respira fraco.")],
      ...de("blood_drops", [3, 1], [1, 2]),
      ...de("cinzas", [1, 0]),
    ],
    wall: [["fuligem_parede", "r", 0, 2.5, 0.3]],
    links: [
      [1, 1, "salao"],
      [4, 1, "diretora"],
    ],
    plan: { x: 7, y: 11 },
  },
  {
    key: "diretora",
    name: ORFANATO + "Quarto da Diretora",
    description:
      "O quarto da diretora, o único que o fogo quase não pegou, e por isso o pior: a cama coberta de sangue velho, o guarda-roupa arrombado por dentro e a escrivaninha com as cartas que ela nunca mandou.",
    layout: plan(5, 4, 1),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    darkness: 0.6,
    floor: [
      ["portal", 1, 1, 2],
      ["guarda_roupa", 2, 0, 4, oculta("Guarda-roupa", "Arrombado POR DENTRO: as portas estão estufadas para fora. Lá dentro, um hábito de freira rasgado e uma caixa de metal com um cadeado novo.")],
      ["nightstand", 4, 0, 4],
      ["cama_queimada", 5, 0, 4, oculta("Cama", "O colchão está ensopado de sangue velho, endurecido. Há marcas de unha na cabeceira, de dentro para fora.")],
      ["rug_worn", 2, 1, 0],
      ["desk_wood", 2, 3, 0, oculta("Escrivaninha", "Cartas para a Ordem, datadas e assinadas, nenhuma enviada. A última termina no meio de uma frase: \"eles não estão mais doentes, estão\"")],
      ["candles", 5, 3, 0],
      ...de("blood_pool", [4, 2]),
      ...de("blood_drops", [3, 1], [1, 3], [4, 3]),
    ],
    wall: [
      ["mirror", "r", 0, 4.5, 2.72],
      ["tally_marks", "l", 1, 3.0, 2.6],
    ],
    links: [[1, 1, "deposito"]],
    plan: { x: 11, y: 11 },
  },
  {
    key: "sanitarios",
    name: ORFANATO + "Sanitários",
    description: "As três cabines das crianças, uma do lado da outra: os vasos quebrados, as divisórias tortas e o chão que nunca secou.",
    layout: plan(4, 3, 1),
    andar: CASA,
    style: "queimado_xadrez",
    ...QUEIMADO,
    darkness: 0.7,
    floor: [
      ["portal", 1, 1, 2],
      ["portal", 4, 1, 6],
      ["toilet", 2, 0, 4],
      ["stall_panel", 3, 0, 4],
      ["toilet", 4, 0, 4],
      ["sink", 1, 0, 4],
      ...de("puddle", [3, 2], [3, 1]),
      ...de("blood_drops", [2, 1], [4, 2]),
    ],
    wall: [["fuligem_parede", "r", 0, 3.0, 0.3]],
    links: [
      [1, 1, "salao"],
      [4, 1, "banheiro"],
    ],
    plan: { x: 7, y: 14 },
  },
  {
    key: "banheiro",
    name: ORFANATO + "Banheiro",
    description:
      "O banheiro da diretoria: a banheira de ferro cheia até a borda de uma água escura que não é água, o tapete encharcado e a mesinha com as toalhas duras de sangue.",
    layout: plan(5, 3, 1),
    andar: CASA,
    style: "queimado_xadrez",
    ...QUEIMADO,
    darkness: 0.7,
    floor: [
      ["portal", 1, 1, 2],
      ["portal", 4, 2, 0],
      ["banheira", 2, 0, 4, oculta("Banheira", "Cheia até a borda de sangue escuro, frio. Lá no fundo, alguma coisa encosta na mão de quem procura.")],
            ...de("blood_pool", [3, 1], [3, 2]),
      ...de("blood_drops", [2, 2], [5, 2]),
    ],
    wall: [["mirror", "r", 0, 3.5, 2.72]],
    links: [
      [1, 1, "sanitarios"],
      [4, 2, "banhos"],
    ],
    plan: { x: 11, y: 15 },
  },
  {
    key: "banhos",
    name: ORFANATO + "Sala de Banho",
    description:
      "A sala de banho das crianças, com as duas banheiras de ferro em boxes de madeira. As duas estão cheias de sangue escuro; numa delas, alguém deixou uma faca e uma vela apagada na borda.",
    layout: planBottom(5, 4, 1),
    andar: CASA,
    style: "queimado_xadrez",
    ...QUEIMADO,
    darkness: 0.72,
    floor: [
      ["portal", 1, 3, 0],
      ["portal", 3, 0, 4],
      ["banheira", 4, 0, 4, oculta("Banheira", "Cheia até a borda de sangue escuro. Na borda, uma faca e uma vela apagada.")],
      ["banheira", 4, 2, 4],
      ["stall_panel", 3, 2, 4],
      ["sink", 0, 0, 2],
      ...de("blood_pool", [2, 1], [3, 3]),
      ...de("blood_drops", [1, 1], [2, 2], [0, 3]),
      ...de("puddle", [1, 2]),
    ],
    wall: [["fuligem_parede", "l", 0, 2.4, 0.3]],
    links: [
      [3, 0, "banheiro"],
      [1, 3, "dormitorios"],
    ],
    plan: { x: 11, y: 18 },
  },
  {
    key: "dormitorios",
    name: ORFANATO + "Ala dos Dormitórios",
    description:
      "O corredor largo da porta da frente, o coração do Ninho: escuro, a fuligem subindo pelas paredes, sangue arrastado no chão e as portas dos doze quartos dos dois lados, umas abertas, outras fechadas, uma trancada com corrente. No fim do corredor, duas saídas: de um lado ele se abre direto no salão, a área aberta das frases de sangue; do outro, a porta da sala de banho.",
    // a porta da frente na parede do fundo da cena; o fim do corredor na beira da frente (sem parede: o salão continua dali)
    layout: planTop(ALA_COR_W, ALA_H, 2),
    andar: CASA,
    style: "queimado_madeira",
    ...QUEIMADO,
    darkness: 0.72,
    floor: corredorDaAla(),
    wall: [
      // não tem luz: o fogo levou a fiação; as tochas que eles prenderam nas paredes
      ...[0, 2, 4].map((i): WallSeed => ["tocha_parede", "l", 0, portaDoQuarto(i) + 2.5, 2.4]),
      ...[1, 3, 5].map((i): WallSeed => ["fuligem_parede", "l", 0, portaDoQuarto(i) + 1.8, 0.3]),
      ["fuligem_parede", "r", 1, 4.4, 0.3],
    ],
    links: [
      [2, 1, "patio"],
      [1, ALA_H, "banhos"],
      [3, ALA_H, "salao"],
      [4, ALA_H, "salao"],
      [5, ALA_H, "salao"],
      ...[0, 1, 2, 3, 4, 5].flatMap((i): [number, number, string][] => [
        [0, portaDoQuarto(i), chaveQuarto("E", i)],
        [ALA_COR_W - 1, portaDoQuarto(i), chaveQuarto("D", i)],
      ]),
    ],
    // na planta do andar a cena fica de cabeça para baixo: a porta da frente embaixo, o salão em cima
    plan: { x: ALA_COR_X, y: ALA_Y, r: 2 },
    chao: [
      [2, 7, "Ursinho de Pelúcia", 1, "misc"],
      [3, 15, "Soldadinhos de Chumbo", 0.5, "misc"],
      [2, 20, "Bolinhas de Gude", 0.5, "misc"],
    ],
  },
  {
    key: "anexo",
    name: ORFANATO + "Sala de Cirurgia",
    description:
      "O anexo de concreto do canto do terreno, que o fogo não pegou, era um centro cirúrgico, e o que se fazia aqui eram rituais. O lugar mais sangrento do orfanato: o círculo de ritual pintado no chão com a mesa de contenção em cima, as macas tombadas, os aparelhos quebrados, a mesa das ferramentas, velas derretidas e sangue em tudo, no chão, nas paredes, no ralo entupido.",
    layout: plan(8, 6, 2),
    andar: FORA,
    style: "queimado_concreto",
    darkness: 0.68,
    fog: 0.15,
    ambient: "#8a4040",
    particles: ["dust"],
    floor: [
      ["portal", 1, 2, 2],
      // o círculo de ritual no chão e a mesa de contenção em cima dele, no meio
      ["sigil_floor", 3, 2, 0],
      ["mesa_contencao", 4, 2, 4, oculta("Mesa de contenção", "As correias de couro estão gastas de tanto apertar. São do tamanho de um pulso de criança. Embaixo, o sangue fez uma crosta.")],
      // as macas (uma tombada), os aparelhos quebrados, o suporte do soro, o armário revirado
      ["catre", 2, 0, 4],
      ["catre", 7, 0, 4],
      ["iv_stand", 3, 0, 0],
      ["medical_cabinet", 1, 3, 2],
      ["table_tools", 8, 4, 2, oculta("Mesa das ferramentas", "Bisturis, serras de osso, ganchos, velas pretas e um livro de capa de couro com páginas de sangue seco.")],
      ["trolley", 5, 5, 0],
      ["drain", 6, 2, 0],
      ...de("candles", [3, 5], [8, 0], [2, 3]),
      ...de("blood_pool", [3, 3], [6, 3], [2, 4], [7, 2]),
      ...de("blood_drops", [1, 3], [7, 4], [3, 1]),
    ],
    wall: [
      ["chains_wall", "r", 0, 2.0, 2.4],
      ["tocha_parede", "l", 1, 3.5, 3.2],
      ["sigil_scratch", "r", 0, 6.0, 2.4],
      ["estandarte_sangue", "r", 0, 4.6, 1.9],
    ],
    links: [[1, 2, "patio"]],
    plan: { x: AX, y: AY },
  },
  ...quartos(),
];

/** O corredor da ala: as passagens dos quartos, as duas de cima (o salão e a sala de banho), o sangue e as velas no chão. */
function corredorDaAla(): FloorSeed[] {
  const W = ALA_COR_W;
  // a porta da frente (o pátio); no fim, a porta da sala de banho e a passagem aberta para o salão (sem porta desenhada)
  const f: FloorSeed[] = [["portal", 2, 1, 4], ["portal", 1, ALA_H, 0], ...[3, 4, 5].map((x): FloorSeed => ["passagem_aberta", x, ALA_H, 0])];
  for (let i = 0; i < 6; i++) {
    const y = portaDoQuarto(i);
    // as portas: umas abertas, outras fechadas; a da jaula trancada (o mestre abre no clique duplo)
    const fechada = (lado: number) => ((i + lado) % 3 === 1 ? 1 : 0);
    f.push(["portal", 0, y, 2, undefined, fechada(0)]);
    if (i === ALA_JAULA)
      f.push(["portal", W - 1, y, 6, hint("Porta trancada", "A porta foi reforçada com uma grade, corrente e cadeado. Do outro lado, alguém ainda respira."), 2]);
    else f.push(["portal", W - 1, y, 6, undefined, fechada(1)]);
    // o sangue arrastado, as velas e a cinza no chão do corredor, longe das portas
    f.push(["blood_drops", 2 + (i % 2), y + 1, 0], ["candles", i % 2 ? 1 : W - 2, y + 1, 0]);
    if (y + 2 < ALA_H) f.push(["blood_drops", 1 + (i % 3), y + 2, 0], ["cinzas", 3 - (i % 2), y + 2, 0]);
  }
  f.push(["colchao_chao", 3, 9, 2], ["escombros", 3, 17, 0], ["trash_can", 4, 12, 0], ["food_tray", 2, 18, 0]);
  f.push(...de("blood_pool", [3, 2], [3, 22], [4, 7]), ...de("fuligem", [1, 23], [4, 23]));
  return f;
}

/**
 * Os doze quartos da ala, cada um uma cena (o Felipe, 09/10: "entrei na sala, mudou o cenário"). Quartinhos de criança,
 * 5 × 4 casas, a porta para o corredor à esquerda. Queimados, e agora a toca de um transtornado cada: a cama de ferro
 * retorcida, o colchão no chão, o baú, o sangue; em dois o teto caiu em cima da cama; um virou a jaula de quem ainda está
 * vivo. Numerados como na porta: os da esquerda ímpares, os da direita pares, da porta da frente para o salão.
 */
function quartos(): CenaSpec[] {
  const lista: CenaSpec[] = [];
  const brinquedos: Record<number, [string, number]> = { 2: ["Trenzinho de Madeira", 1], 7: ["Pião de Madeira", 0.5], 10: ["Boneca de Porcelana", 0.5] };
  for (let i = 0; i < 6; i++)
    for (const lado of ["E", "D"] as const) {
      const n = i * 2 + (lado === "E" ? 1 : 2);
      const desabou = (i * 2 + (lado === "E" ? 0 : 1)) % 5 === 2;
      const jaula = lado === "D" && i === ALA_JAULA;
      const floor: FloorSeed[] = [["portal", 1, 1, 2]];
      const wall: WallSeed[] = [];
      let description: string;
      if (jaula) {
        description = `O quarto ${n} virou uma jaula: a porta reforçada com grade e cadeado, correntes chumbadas na parede, um colchão imundo no chão, um balde, um prato de lata e as marcas de dias contados riscadas na parede. Quem está aqui ainda está vivo.`;
        floor.push(["cama_queimada", 2, 0, 4], ["colchao_chao", 5, 0, 0], ["trash_can", 5, 3, 0], ["food_tray", 3, 3, 0]);
        floor.push(...de("blood_pool", [4, 1], [2, 2]), ...de("blood_drops", [3, 0], [4, 3], [2, 3]));
        wall.push(["chains_wall", "r", 0, 2.4, 2.4], ["chains_wall", "r", 0, 4.4, 2.4], ["tally_marks", "l", 1, 3.3, 2.6]);
      } else if (desabou) {
        description = `O quarto ${n}: o teto desabou em cima de uma das duas camas, e o que sobrou dela aparece entre as telhas e as vigas queimadas; a outra cama e o armário ficaram, pretos. Cinza por todo lado; ninguém dorme aqui, mas alguém vem aqui: há sangue fresco no chão.`;
        floor.push(["cama_queimada", 2, 0, 4], ["escombros", 4, 0, 0], ["guarda_roupa", 1, 2, 2], ["viga_queimada", 2, 3, 2]);
        floor.push(...de("cinzas", [1, 3], [5, 2], [3, 2]), ...de("fuligem", [1, 0], [5, 3]), ...de("blood_drops", [2, 2], [4, 3]));
        wall.push(["fuligem_parede", "r", 0, 3.0, 0.3]);
      } else {
        description = `O quarto ${n}, de duas crianças, queimado: as duas camas de ferro retorcidas, o criado-mudo entre elas, o armário arrombado e, no chão, o colchão onde um transtornado dorme agora, encardido de sangue.${i % 2 ? " No canto, os crânios dele, arrumados com cuidado." : ""}`;
        // um quarto de criança de orfanato pobre: duas camas de ferro, o criado-mudo entre elas e o armário; no chão, o
        // colchão do transtornado que dorme aqui agora e o baú dele
        floor.push(["cama_queimada", 2, 0, 4], ["nightstand", 3, 0, 4], ["cama_queimada", 4, 0, 4], ["guarda_roupa", 1, 2, 2]);
        floor.push(["colchao_chao", 2, 3, 2], ["bau_madeira", 5, 3, 0]);
        if (i % 2) floor.push(["pilha_cranios", 4, 3, 0]);
        else floor.push(["candles", 4, 3, 0]);
        floor.push(...de("blood_pool", [3, 1], [3, 2]), ...de("blood_drops", [1, 2], [5, 2]), ...de("fuligem", [1, 3], [1, 0]), ...de("cinzas", [3, 3]));
        wall.push(["window_barred", "r", 0, 3.5, 2.2], [n % 3 ? "sigil_scratch" : "tally_marks", "l", 1, 0.5, 2.5]);
      }
      const brinquedo = brinquedos[n];
      lista.push({
        key: chaveQuarto(lado, i),
        name: ORFANATO + `Quarto ${n}`,
        description,
        layout: plan(5, 4, 1),
        andar: CASA,
        style: "queimado_madeira",
        ...QUEIMADO,
        darkness: jaula ? 0.82 : 0.76,
        floor,
        wall,
        links: [[1, 1, "dormitorios"]],
        // na planta (o corredor fica de cabeça para baixo): os da esquerda da cena ficam à direita do corredor, os da
        // direita à esquerda (girados, a porta para o corredor); o primeiro quarto perto da porta da frente, embaixo
        plan: lado === "E" ? { x: ALA_COR_X + ALA_COR_W, y: ALA_Y + (5 - i) * ALA_QUARTO } : { x: 0, y: ALA_Y + (5 - i) * ALA_QUARTO, r: 2 },
        ...(brinquedo ? { chao: [[3, 2, brinquedo[0], brinquedo[1], "misc"]] as CenaSpec["chao"] } : {}),
      });
    }
  return lista;
}

// ------------------------------------------------------------------ montagem

/** O que sobrou dos móveis aparece vazio, revirado (a arte "!vazio" do Códex, quando existe). */
const SAQUEADOS = new Set(["armario_cozinha", "prateleira", "comoda", "nightstand", "mesa_jantar", "mesa_cozinha", "bookshelf"]);

/** O que o fogo e o bando destruíram (FloorItem.quebrado: carbonizado e torto, não senta nem liga, tapa metade). */
const QUEBRADOS = new Set([
  "chair_wood", "stool", "bench", "table_round", "mesa_jantar", "counter_wood", "prateleira", "armario_cozinha", "guarda_roupa",
  "toilet", "sink", "stall_panel", "chest_army", "bau_madeira", "nightstand", "catre",
  // a sala de cirurgia revirada: as macas tombadas, os aparelhos quebrados
  "hospital_bed", "trolley", "iv_stand", "monitor_suporte", "medical_cabinet",
]);

function arruinar(room: RoomData, spec: CenaSpec) {
  for (const it of room.items) {
    if (SAQUEADOS.has(it.defId)) (it as FloorItem).vazio = true;
    // dentro do prédio queimado e na sala de cirurgia; uma ou outra peça escapou inteira
    if (spec.key !== "patio" && QUEBRADOS.has(it.defId) && it.id % 5 !== 0) (it as FloorItem).quebrado = true;
  }
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
    arruinar(room, spec);
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

/** Refaz o orfanato no lugar quando a montagem muda (ORFANATO_REV): mesmas cenas, peças e registro; a que saiu é apagada. */
function rebuildOrfanato(db: Database): boolean {
  if ((db.orfanatoRev ?? 0) >= ORFANATO_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(ORFANATO));
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
    arruinar(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  // as cenas que saíram da montagem (a sala de estudos inventada, os banheiros de antes): as peças vão para a ala
  const ficam = new Set([...built.values()].map((r) => r.id));
  const ala = built.get("dormitorios")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (ala.tokens ??= []).push({ ...t, x: ala.door.x, y: ala.door.y });
    db.rooms.splice(db.rooms.indexOf(velha), 1);
  }
  // as peças que estavam numa casa que sumiu vão para perto da porta
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    for (const t of room.tokens ?? []) {
      if (map.walkState(t.x, t.y) === "walk") continue;
      t.x = room.door.x;
      t.y = room.door.y;
    }
  }
  // a campanha continua na primeira cena de antes (o pátio); a planta, como no desenho
  const camp = db.campaigns?.[String(key)];
  if (camp) {
    for (const id of Object.keys(camp.layout)) if (!ficam.has(Number(id))) delete camp.layout[Number(id)];
    for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  }
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
