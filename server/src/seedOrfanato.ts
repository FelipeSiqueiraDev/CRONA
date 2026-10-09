import { getFurni, RoomMap, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { plan, type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planTop } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * O Orfanato Filhos do Dragão (09/10), o terceiro lugar da campanha: um casarão antigo e triste, comprido, com o
 * refeitório em cima, o salão no meio (com a sala de estudos, o quarto da diretora e os banheiros do lado) e a ala dos
 * dormitórios embaixo, doze quartinhos dos dois lados do corredor; fora, o pátio com as árvores, a estradinha de terra e
 * o anexo de concreto do fundo, onde ninguém devia entrar. A planta que serviu de base ficou com o Felipe.
 *
 * Cômodos pequenos e cheios (o Felipe: "cuidado com as salas ENORMES com um monte de espaço"). Mesmo jeito da Fazenda:
 * cada cômodo é uma cena, a porta principal numa parede do fundo; subiu ORFANATO_REV, o orfanato é refeito no lugar.
 */
export const ORFANATO = "Orfanato · ";
export const ORFANATO_REV = 3;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
const lamps = (...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => ["ceiling_lamp", x, y, 0] as FloorSeed);
const linha = (id: string, rot: number, ...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => [id, x, y, rot] as FloorSeed);

const CASA = "Orfanato";
const FORA = "Pátio do Orfanato";

// ------------------------------------------------------------------ o pátio (de fora)

const PW = 26;
const PH = 22;
function terrenoPatio(): Terreno {
  const t = new Terreno(PW, PH);
  // a estradinha de terra: do portão até a porta da frente, e o ramal até o anexo do fundo
  t.linha([[12.5, 21], [12.5, 14], [11.5, 9], [12.5, 1]], "d", 2);
  t.linha([[12.5, 12], [16, 11], [18.5, 10.5]], "d", 2);
  // o chão gasto em volta da árvore seca do balanço
  t.disco(5.5, 15.5, 2.4, 1.8, "d");
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
  // as árvores (grandes, nos cantos e no fundo) e os arbustos na beira da fachada
  for (const [x, y] of [
    [1, 4], [3, 3], [23, 4], [1, 20], [3, 19], [24, 18], [22, 20], [17, 17], [8, 5], [16, 4], [1, 10], [24, 14],
  ] as [number, number][])
    f.push(["arvore", x, y, 0]);
  f.push(["arvore", 5, 14, 0]);
  for (const [x, y] of [[4, 1], [9, 1], [16, 1], [21, 1], [10, 7], [18, 14], [7, 19]] as [number, number][]) f.push(["arbusto", x, y, 0]);
  // o banco debaixo da árvore seca e o caixote de brinquedos esquecido
  f.push(["bench", 6, 17, 4], ["crate_wood", 8, 15, 0]);
  // a cerca da frente, com o portão no meio
  for (let x = 0; x <= 25; x++) if (x < 11 || x > 13) f.push(["cerca", x, 21, 4]);
  f.push(["porteira", 11, 21, 4]);
  return f;
}

// ------------------------------------------------------------------ as cenas

const CENAS: CenaSpec[] = [
  {
    key: "patio",
    name: ORFANATO + "Pátio",
    description:
      "O pátio da frente: o casarão comprido e triste, de janelas gradeadas, a estradinha de terra do portão até a porta, a árvore seca com o banco embaixo e, no fundo à direita, o anexo de concreto onde ninguém devia entrar.",
    layout: { heightmap: T_PATIO.planta(), door: { x: 12, y: 20, dir: 0 } },
    andar: FORA,
    style: "grama",
    aberto: true,
    terreno: T_PATIO.texto(),
    darkness: 0.18,
    ambient: "#c8b48a",
    particles: ["dust"],
    floor: patioPiso(),
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
      "O salão do meio: o balcão em L onde as freiras davam as tarefas, as prateleiras de potes, o tapete persa gasto, o sofá e as poltronas. Para cima, o refeitório; do lado, a sala de estudos, o quarto da diretora e os banheiros; para baixo, a ala dos dormitórios.",
    layout: plan(12, 10, 5),
    andar: CASA,
    style: "taco",
    darkness: 0.42,
    ambient: "#b08a60",
    particles: ["dust"],
    floor: [
      ["portal", 1, 5, 2],
      ["portal", 9, 0, 4],
      ["portal", 12, 2, 6],
      ["portal", 12, 5, 6],
      ["portal", 12, 8, 6],
      ["portal", 6, 9, 0],
      // atrás do balcão: as prateleiras de potes e o armário
      ["prateleira", 1, 0, 4],
      ["prateleira", 3, 0, 4],
      ["armario_cozinha", 5, 0, 4],
      // o balcão em L e as banquetas
      ["counter_wood", 1, 2, 4],
      ["counter_wood", 3, 2, 4],
      ["counter_wood", 5, 2, 2],
      ["stool", 2, 3, 0],
      ["stool", 3, 3, 0],
      ["stool", 4, 3, 0],
      // a sala de estar: o tapete, o sofá, as poltronas e a mesinha do meio
      ["rug_ornate", 7, 3, 0],
      ["sofa_velvet", 7, 2, 4],
      ["armchair", 10, 4, 6],
      ["armchair", 10, 5, 6],
      ["table_small", 8, 4, 0],
      ["chair_wood", 7, 7, 0],
      ["floor_lamp", 11, 1, 0],
      ["bookshelf", 10, 0, 4],
      ["plant", 1, 8, 0],
      ["plant", 12, 0, 0],
      ["candelabra", 2, 7, 0],
      ["books_stack", 2, 1, 0],
      ...lamps([3, 5], [8, 5], [9, 8]),
    ],
    wall: [
      ["clock", "r", 0, 8.5, 3.45],
      ["painting", "r", 0, 6.4, 3.22],
      ["window_barred", "l", 1, 2.5, 2.2],
      ["window_barred", "l", 1, 8.5, 2.2],
      ["sconce", "l", 1, 4.0, 2.9],
      ["sconce", "l", 1, 7.0, 2.9],
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
    chao: [[11, 7, "Boneca de Pano", 0.5, "misc"]],
  },
  {
    key: "refeitorio",
    name: ORFANATO + "Refeitório",
    description:
      "O refeitório comprido: a cozinha encostada na parede do fundo (o fogão a lenha, a pia, os armários) e as duas mesas compridas com os bancos de madeira, onde trinta crianças comiam em silêncio.",
    layout: planBottom(14, 6, 9),
    andar: CASA,
    style: "taco",
    darkness: 0.45,
    ambient: "#b08a60",
    particles: ["dust", "smoke"],
    floor: [
      ["portal", 9, 5, 0],
      // a cozinha, na parede do fundo
      ["armario_cozinha", 0, 0, 4],
      ["fogao_lenha", 2, 0, 4, undefined, 1],
      ["pia_cozinha", 4, 0, 4],
      ["prateleira", 6, 0, 4],
      ["armario_cozinha", 8, 0, 4],
      ["prateleira", 12, 0, 4],
      // as duas mesas compridas, com os bancos dos dois lados
      ["mesa_jantar", 1, 2, 4],
      ["mesa_jantar", 7, 2, 4],
      ...linha("bench", 4, [1, 1], [3, 1], [7, 1], [9, 1]),
      ...linha("bench", 0, [1, 4], [3, 4], [7, 4], [9, 4]),
      ["chair_wood", 11, 2, 6],
      ["candles", 2, 2, 0],
      ["candles", 9, 3, 0],
      ["crate_wood", 13, 3, 0],
      ["barrel", 13, 4, 0],
      ["crate_wood", 12, 5, 0],
      ...lamps([5, 3], [11, 3]),
    ],
    wall: [
      ["clock", "r", 0, 10.5, 3.45],
      ["window_barred", "l", 0, 2.5, 2.2],
      ["quadro_fazenda", "r", 0, 11.2, 2.6],
    ],
    links: [[9, 5, "salao"]],
    plan: { x: 0, y: 0 },
  },
  {
    key: "estudos",
    name: ORFANATO + "Sala de Estudos",
    description:
      "A sala de estudos: as estantes de livros velhos, o quadro com as contas pela metade e as duas mesas redondas com as cadeiras empurradas, como se tivessem saído correndo.",
    layout: plan(7, 6, 2),
    andar: CASA,
    style: "carpete",
    darkness: 0.45,
    ambient: "#b08a60",
    floor: [
      ["portal", 1, 2, 2],
      ["bookshelf", 1, 0, 4],
      ["bookshelf", 3, 0, 4],
      ["whiteboard", 5, 0, 4],
      ["table_round", 3, 2, 0],
      ["table_round", 6, 2, 0],
      ["chair_wood", 2, 3, 2],
      ["chair_wood", 3, 4, 0],
      ["chair_wood", 5, 2, 6],
      ["chair_wood", 6, 4, 0],
      ["chair_wood", 7, 1, 4],
      ["books_stack", 1, 5, 0],
      ["table_chess", 7, 5, 0],
      ...lamps([3, 2], [6, 3]),
    ],
    wall: [["window_barred", "l", 1, 4.5, 2.2]],
    links: [[1, 2, "salao"]],
    plan: { x: 13, y: 8 },
    chao: [[4, 5, "Blocos de Montar", 1, "misc"]],
  },
  {
    key: "diretora",
    name: ORFANATO + "Quarto da Diretora",
    description:
      "O quarto da diretora: a cama arrumada demais, o guarda-roupa trancado, a cômoda e a escrivaninha com as cartas que ela nunca mandou.",
    layout: plan(6, 6, 3),
    andar: CASA,
    style: "taco",
    darkness: 0.5,
    ambient: "#a87a50",
    floor: [
      ["portal", 1, 3, 2],
      ["guarda_roupa", 1, 0, 4, oculta("Guarda-roupa", "Trancado por dentro. Pela fresta, vê-se um hábito de freira pendurado e, no fundo, uma caixa de metal com um cadeado novo.")],
      ["comoda", 3, 0, 4],
      ["nightstand", 5, 0, 4],
      ["cama_solteiro", 6, 0, 4],
      ["rug_worn", 3, 2, 0],
      ["desk_wood", 1, 5, 0, oculta("Escrivaninha", "Cartas para a Ordem, datadas e assinadas, nenhuma enviada. A última termina no meio de uma frase.")],
      ["chair_wood", 2, 4, 4],
      ["cabinet_file", 6, 5, 0],
      ["candles", 5, 1, 0],
      ...lamps([4, 3]),
    ],
    wall: [
      ["mirror", "r", 0, 4.0, 2.72],
      ["painting", "l", 1, 1.7, 2.54],
      ["window_barred", "l", 1, 5.0, 2.2],
    ],
    links: [[1, 3, "salao"]],
    plan: { x: 13, y: 14 },
  },
  {
    key: "banheiros",
    name: ORFANATO + "Banheiros",
    description: "Os banheiros das crianças: os vasos em fila com as divisórias, as duas banheiras de ferro e as pias de pedra. O chão nunca seca.",
    layout: plan(8, 6, 3),
    andar: CASA,
    style: "xadrez",
    darkness: 0.48,
    floor: [
      ["portal", 1, 3, 2],
      ["toilet", 1, 0, 4],
      ["stall_panel", 2, 0, 4],
      ["toilet", 3, 0, 4],
      ["stall_panel", 4, 0, 4],
      ["toilet", 5, 0, 4],
      ["banheira", 7, 0, 4],
      ["banheira", 8, 0, 4],
      ["sink", 8, 3, 6],
      ["sink", 8, 4, 6],
      ["puddle", 4, 3, 0],
      ["puddle", 6, 4, 0],
      ["crate_wood", 1, 5, 0],
      ...lamps([4, 2]),
    ],
    wall: [
      ["mirror", "l", 1, 1.5, 2.72],
      ["mirror", "l", 1, 5.0, 2.72],
    ],
    links: [[1, 3, "salao"]],
    plan: { x: 13, y: 20 },
  },
  {
    key: "dormitorios",
    name: ORFANATO + "Ala dos Dormitórios",
    description:
      "O corredor comprido dos dormitórios: doze quartinhos, seis de cada lado, cada um com a cama de ferro, o baú e a mesinha. As portas ficam abertas; em alguns, os brinquedos ainda estão no chão.",
    layout: planTop(13, 23, 6),
    andar: CASA,
    style: "madeira",
    darkness: 0.52,
    ambient: "#a8805a",
    particles: ["dust"],
    floor: dormitorios(),
    wall: [
      ...[3, 11, 19].map((y): WallSeed => ["window_barred", "l", 0, y + 0.3, 2.2]),
      ["painting", "r", 1, 10.5, 2.54],
    ],
    links: [[6, 1, "salao"]],
    plan: { x: 0, y: 19 },
    chao: [
      [2, 6, "Ursinho de Pelúcia", 1, "misc"],
      [10, 10, "Trenzinho de Madeira", 1, "misc"],
      [2, 14, "Soldadinhos de Chumbo", 0.5, "misc"],
      [10, 18, "Pião de Madeira", 0.5, "misc"],
      [1, 22, "Bolinhas de Gude", 0.5, "misc"],
    ],
  },
  {
    key: "anexo",
    name: ORFANATO + "Anexo",
    description:
      "O anexo de concreto do fundo do pátio: dois leitos de ferro com as correias, um saco de cadáver no canto, o ralo no meio e sangue que ninguém limpou. Não é enfermaria.",
    layout: plan(7, 5, 2),
    andar: FORA,
    style: "concreto",
    darkness: 0.62,
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
      ["blood_pool", 3, 3, 0],
      ["blood_pool", 5, 4, 0],
      ["blood_drops", 2, 4, 0],
      ["blood_drops", 6, 3, 0],
      ...lamps([4, 2]),
    ],
    wall: [
      ["chains_wall", "r", 0, 2.0, 2.4],
      ["cage_lamp", "l", 1, 3.5, 3.2],
    ],
    links: [[1, 2, "patio"]],
    plan: { x: 20, y: 7 },
  },
];

/** A ala dos dormitórios: o corredor no meio (x 5 a 7) e seis quartinhos de cada lado, separados por paredes. */
function dormitorios(): FloorSeed[] {
  const f: FloorSeed[] = [["portal", 6, 1, 4]];
  const CELA = 4;
  for (let i = 0; i < 6; i++) {
    const y0 = 1 + i * CELA;
    // as divisórias dos quartinhos (baixas: dá para ver quem está dentro): a do corredor, com o vão da porta no meio, e
    // a de baixo, entre um e outro
    for (let y = y0; y < y0 + 3; y++) {
      if (y === y0 + 1) continue;
      f.push(["iwall_low", 4, y, 2]);
      f.push(["iwall_low", 8, y, 6]);
    }
    if (i < 5) for (const x of [0, 1, 2, 3, 4, 8, 9, 10, 11, 12]) f.push(["iwall_low", x, y0 + 3, 4]);
    // o quartinho da esquerda: a cama na parede, a mesinha e o baú
    f.push(["cama_solteiro", 0, y0, 4], ["table_small", 2, y0, 0], ["chest_army", 3, y0 + 2, 0]);
    // o da direita, espelhado
    f.push(["cama_solteiro", 12, y0, 4], ["table_small", 10, y0, 0], ["chest_army", 9, y0 + 2, 0]);
    // a luz do corredor, uma sim, uma não
    if (i % 2 === 0) f.push(["ceiling_lamp", 6, y0 + 1, 0]);
  }
  f.push(["plant", 5, 23, 0], ["bench", 6, 23, 0]);
  return f;
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

/** Monta o orfanato inteiro e a campanha dele (o lugar "Orfanato Filhos do Dragão" do mapa-múndi). */
export function seedOrfanato(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(ORFANATO))) return;
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
