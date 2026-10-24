import { getFurni, RoomMap, type Door, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { planRight } from "./seedSede";
import { type FloorSeed } from "./seed";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";
import { interioresDeVila } from "./seedTiradentes";
import { casaDeCidade } from "./casaComum";

/**
 * Pedra Serena (23/10), a cidade onde fica o Galpão do Fritz, no desenho da planta que o Felipe mandou: o galpão
 * grande de concreto, os três pilares no meio, o portão embaixo e, no canto de baixo à esquerda, o escritório. O
 * Felipe: "vai estar totalmente vazio esse galpão, exceto por uma prateleira com a documentação da sessão e a mesa do
 * escritório com a cadeira. Galpão sem luz". Nenhuma lâmpada: quem entra vê o escuro.
 *
 * A cidade de fora (24/10): uma cidade pequena do interior, a avenida de asfalto de oeste a leste, a praça com o coreto
 * e a igreja no alto, as casas e o comércio dos dois lados (os prédios ainda fechados) e, na saída leste, já longe do
 * centro, o galpão do Fritz com o pátio de concreto. Depois dele a avenida vira a estrada de terra que segue para o
 * Jardim do Fritz (o outro lugar, de van). A van chega pelo oeste.
 *
 * Por dentro (24/10): a igreja, a pousada, a venda e o boteco são os de Tiradentes (`interioresDeVila`, os mesmos
 * prédios), e as casas, a casa padrão (`casaDeCidade`). A porta de dentro fica do mesmo lado da de fora.
 */
export const PEDRA_SERENA = "Pedra Serena · ";
export const PEDRA_SERENA_REV = 3;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });

const GALPAO = "Galpão do Fritz";

/** A luz de dentro das casas e do comércio. */
const DENTRO = { darkness: 0.3, ambient: "#e8dcc4", particles: ["dust"] as CenaSpec["particles"] };

/** Sem luz nenhuma: o escuro do concreto e a poeira parada. */
const ESCURO = { darkness: 0.86, ambient: "#8a9098", particles: ["dust"] as CenaSpec["particles"] };

/** O galpão: 27 × 13 casas, o canto de baixo à esquerda (7 × 5) é o escritório; o portão no meio da parede de baixo. */
const GW = 27;
const GH = 13;
const PORTAO_X = 13;
const ESC = { w: 7, h: 5 };

function galpaoPlan(): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < GH; y++) rows.push(Array.from({ length: GW }, (_, x) => (x < ESC.w && y >= GH - ESC.h ? "x" : "0")).join(""));
  rows.push(Array.from({ length: GW }, (_, x) => (x === PORTAO_X ? "0" : "x")).join(""));
  return { heightmap: rows.join("\n"), door: { x: PORTAO_X, y: GH, dir: 0 } };
}

// ------------------------------------------------------------------ a cidade (de fora)

const VW = 64;
const VH = 48;
/** a avenida (3 casas) e as calçadas */
const AV_Y = 22;
/** a avenida vira a estrada de terra para o leste (para o Jardim) */
const TERRA_X = 54;
/** o galpão do Fritz (18 x 9, a porta virada para a avenida) */
const GALPAO_FORA = { x: 45, y: 28 };

function terrenoCidade(): Terreno {
  const t = new Terreno(VW, VH);
  t.ret(0, AV_Y, TERRA_X - 1, AV_Y + 2, "c");
  t.ret(TERRA_X, AV_Y, VW - 1, AV_Y + 2, "t");
  t.ret(0, AV_Y - 2, TERRA_X - 1, AV_Y - 1, "q");
  t.ret(0, AV_Y + 3, GALPAO_FORA.x - 1, AV_Y + 4, "q");
  // a praça (o calçamento de pedra) e a rua de pedra da igreja
  t.ret(18, 10, 32, 19, "p");
  // o pátio de concreto do galpão, da avenida até a porta
  t.ret(GALPAO_FORA.x - 1, AV_Y + 3, GALPAO_FORA.x + 18, GALPAO_FORA.y - 1, "c");
  // o caminho de terra que sai do galpão para os fundos
  t.linha([[GALPAO_FORA.x + 9, GALPAO_FORA.y + 9], [GALPAO_FORA.x + 9, VH - 1]], "d", 1);
  return t;
}
const T_CIDADE = terrenoCidade();

/**
 * Os prédios da cidade: [def, x, y, giro, cena de dentro]. Do lado de cima da avenida, virados para ela (e para a tela);
 * do lado de baixo, de costas para a tela.
 */
const PREDIOS: [string, number, number, 0 | 4, string][] = [
  ["casa_moderna", 0, 12, 4, "casa1"],
  ["boteco_predio", 10, 15, 4, "boteco"],
  ["igreja_barroca", 19, 0, 4, "igreja"],
  ["pousada_predio", 34, 14, 4, "pousada"],
  ["venda_predio", 44, 15, 4, "venda"],
  ["casa_moderna~b", 54, 12, 4, "casa2"],
  ["casa_moderna~c", 0, 27, 0, "casa3"],
  ["casa_colonial", 10, 27, 0, "casa4"],
  ["casa_moderna~c", 18, 27, 0, "casa5"],
  ["casa_moderna~d", 28, 27, 0, "casa6"],
  ["casa_colonial", 37, 27, 0, "casa7"],
];

/** a peça "entrada" na casa logo à frente da porta de um prédio (a porta no meio da frente; giro 4 ou 0) */
function porta(id: string, x: number, y: number, rot: 0 | 4): [number, number] {
  const def = getFurni(id.split("~")[0])!;
  const meio = Math.floor(def.width / 2);
  return rot === 4 ? [x + meio, y + def.depth] : [x + def.width - 1 - meio, y - 1];
}
const ENTRADAS = PREDIOS.map(([id, x, y, r, cena]) => [...porta(id, x, y, r), cena] as [number, number, string]);
/** as duas entradas do galpão (a porta de aço e o portão de enrolar), na casa do pátio na frente de cada uma */
const ENTRADAS_GALPAO: [number, number][] = [
  [GALPAO_FORA.x + 5, GALPAO_FORA.y - 1],
  [GALPAO_FORA.x + 10, GALPAO_FORA.y - 1],
];

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
  for (const [id, x, y, r] of PREDIOS) f.push([id, x, y, r]);
  for (const [x, y] of ENTRADAS) f.push(["entrada", x, y, 0]);
  f.push(["galpao_fritz", GALPAO_FORA.x, GALPAO_FORA.y, 0]);
  for (const [x, y] of ENTRADAS_GALPAO) f.push(["entrada", x, y, 0]);
  // a praça: o coreto, os bancos virados para ele, os vasos e os postes
  f.push(["coreto", 24, 13, 4], ["banco_praca", 25, 11, 4], ["banco_praca", 25, 18, 0], ["banco_praca", 21, 14, 2], ["banco_praca", 30, 14, 6]);
  for (const [x, y] of [[20, 12], [30, 12], [20, 18], [30, 18]] as [number, number][]) f.push(["vaso_flores", x, y, 0]);
  for (const [x, y] of [[18, 10], [32, 10], [18, 19], [32, 19], [5, 21], [15, 21], [37, 21], [49, 21], [8, 25], [22, 25], [33, 25], [43, 25]] as [number, number][])
    f.push(["poste_ferro", x, y, 0]);
  f.push(["trash_can", 17, 21, 0], ["bench", 27, 25, 0], ["trash_can", 41, 21, 0]);
  // a placa na saída leste, onde o asfalto acaba
  f.push(["placa", TERRA_X, AV_Y - 1, 4, hint("Placa", "A placa de beira de estrada, desbotada: o asfalto acaba aqui, e a estrada de terra segue para o leste, longe do centro, subindo a serra.")]);
  const ocupado = new Set<string>();
  ocupar(ocupado, f);
  const arvores: [number, number][] = [
    [1, 2], [5, 6], [9, 3], [13, 8], [16, 2], [34, 3], [38, 8], [42, 2], [46, 6], [50, 3], [55, 7], [59, 3], [62, 9], [11, 11], [33, 11],
    [2, 38], [6, 43], [11, 37], [15, 44], [20, 39], [25, 45], [30, 38], [35, 43], [40, 37], [43, 45], [48, 41], [58, 42], [62, 38], [52, 46], [61, 46],
    [19, 20], [31, 20],
  ];
  arvores.forEach(([x, y], i) => {
    if (T_CIDADE.at(x, y) !== "." || ocupado.has(`${x},${y}`)) return;
    const a: FloorSeed = [["arvore", "arvore~b", "arvore~c"][i % 3], x, y, 0];
    f.push(a);
    ocupar(ocupado, [a]);
  });
  return f;
}

const CENAS: CenaSpec[] = [
  {
    key: "cidade",
    name: PEDRA_SERENA + "Cidade",
    description:
      "Pedra Serena: uma cidade pequena e quieta do interior. A avenida de asfalto corta a cidade de oeste a leste; no alto, a igreja matriz virada para a praça do coreto. Dos dois lados, as casas de reboco, o boteco, a pousada e a venda. Na saída leste, já longe do centro, o galpão de bloco e chapa com o pátio de concreto; depois dele o asfalto acaba e a estrada de terra segue para a serra. A van chega pelo oeste.",
    layout: { heightmap: T_CIDADE.planta(), door: { x: 0, y: AV_Y + 1, dir: 2 } },
    andar: "Cidade",
    style: "grama",
    aberto: true,
    terreno: T_CIDADE.texto(),
    darkness: 0.14,
    fog: 0,
    ambient: "#ffe6c4",
    particles: ["dust"],
    floor: cidadePiso(),
    wall: [],
    links: [...ENTRADAS_GALPAO.map(([x, y]) => [x, y, "galpao"] as [number, number, string]), ...ENTRADAS],
    plan: { x: 0, y: 0 },
  },
  {
    key: "galpao",
    name: PEDRA_SERENA + "Galpão do Fritz",
    description: "O galpão de concreto, vazio: o chão rachado, os três pilares, a poeira parada e nenhuma luz. No canto, a porta do escritório.",
    layout: galpaoPlan(),
    andar: GALPAO,
    style: "galpao",
    ...ESCURO,
    floor: [
      ["portal", PORTAO_X, GH - 1, 0],
      ["portal", ESC.w, GH - ESC.h, 2],
      ["pillar", 9, 5, 0],
      ["pillar", 17, 5, 0],
      ["pillar", 22, 5, 0],
    ],
    wall: [],
    links: [
      [ESC.w, GH - ESC.h, "escritorio"],
      [PORTAO_X, GH - 1, "cidade"],
    ],
    plan: { x: 0, y: 0 },
  },
  {
    key: "escritorio",
    name: PEDRA_SERENA + "Escritório do Galpão",
    description: "O escritório do galpão: a estante de aço vazia, a mesa e a cadeira. Nada mais, e nenhuma luz.",
    layout: planRight(ESC.w, ESC.h, 0),
    andar: GALPAO,
    style: "galpao",
    ...ESCURO,
    floor: [
      ["portal", ESC.w - 1, 0, 6],
      ["estante_vazia", 2, 0, 4, hint("A estante", "A estante de aço vazia: a poeira nas chapas e as marcas limpas de onde ficavam as caixas.")],
      ["mesa_vazia", 2, 3, 4],
      ["chair_office", 2, 2, 4],
    ],
    wall: [],
    links: [[ESC.w - 1, 0, "galpao"]],
    plan: { x: 0, y: GH - ESC.h },
  },
  ...interioresDeVila(PEDRA_SERENA),
  ...casaDeCidade({ key: "casa1", prefixo: PEDRA_SERENA, lado: "frente", description: "Uma casa da avenida: a cozinha e a sala juntas, o café no fogão, a TV ligada no jornal, o quarto no fundo.", style: "ladrilho", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa2", prefixo: PEDRA_SERENA, lado: "frente", description: "A última casa antes do asfalto acabar: o fogão a gás, a geladeira com os ímãs, a mesa da cozinha e a cama no fundo. Da janela se vê o galpão.", style: "ladrilho", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa3", prefixo: PEDRA_SERENA, lado: "fundo", description: "Uma casa do outro lado da avenida: a mesa com o pão e o café, o sofá de frente para a TV, o quarto no fundo.", style: "ladrilho", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa4", prefixo: PEDRA_SERENA, lado: "fundo", description: "Uma casa antiga da avenida, de janelas verdes: a cozinha e a sala juntas, a TV pequena, o oratório e o quarto no fundo.", style: "taco", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa5", prefixo: PEDRA_SERENA, lado: "fundo", description: "Uma casa do outro lado da avenida, perto da praça: o fogão, a mesa da cozinha, o sofá e o quarto no fundo.", style: "ladrilho", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa6", prefixo: PEDRA_SERENA, lado: "fundo", description: "Uma casa do outro lado da avenida: a cozinha e a sala juntas, a TV ligada alto, o quarto no fundo.", style: "ladrilho", clima: DENTRO, janela: "janela_vidro" }),
  ...casaDeCidade({ key: "casa7", prefixo: PEDRA_SERENA, lado: "fundo", description: "A casa antiga mais perto do galpão, de janelas verdes: a cozinha, a mesa, o sofá e o quarto, a cortina sempre fechada.", style: "taco", clima: DENTRO, janela: "janela_vidro" }),
];

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

/** Monta Pedra Serena e a campanha dela (o lugar "Pedra Serena" do mapa-múndi). */
export function seedPedraSerena(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(PEDRA_SERENA))) return;
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
    title: "Pedra Serena",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.pedraSerenaRev = PEDRA_SERENA_REV;
}

/** Refaz Pedra Serena no lugar quando a montagem muda (PEDRA_SERENA_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildPedraSerena(db: Database): boolean {
  if ((db.pedraSerenaRev ?? 0) >= PEDRA_SERENA_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(PEDRA_SERENA));
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
  const galpao = built.get("galpao")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (galpao.tokens ??= []).push({ ...t, x: galpao.door.x, y: galpao.door.y });
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
  db.pedraSerenaRev = PEDRA_SERENA_REV;
  return true;
}

/** Monta Pedra Serena se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarPedraSerena(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(PEDRA_SERENA))) {
    seedPedraSerena(db);
    return true;
  }
  return rebuildPedraSerena(db);
}
