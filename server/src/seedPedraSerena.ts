import { getFurni, RoomMap, type Door, type Hint } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { planRight } from "./seedSede";
import { estilo, montar, naPlanta, type CenaSpec } from "./seedFazenda";

/**
 * Pedra Serena (23/10), a cidade onde fica o Galpão do Fritz, no desenho da planta que o Felipe mandou: o galpão
 * grande de concreto, os três pilares no meio, o portão embaixo e, no canto de baixo à esquerda, o escritório. O
 * Felipe: "vai estar totalmente vazio esse galpão, exceto por uma prateleira com a documentação da sessão e a mesa do
 * escritório com a cadeira. Galpão sem luz". Nenhuma lâmpada: quem entra vê o escuro.
 *
 * A cidade de fora ainda não tem cena: o galpão é a entrada do lugar, e o portão fica sem passagem.
 */
export const PEDRA_SERENA = "Pedra Serena · ";
export const PEDRA_SERENA_REV = 1;

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });

const GALPAO = "Galpão do Fritz";

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

const CENAS: CenaSpec[] = [
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
    links: [[ESC.w, GH - ESC.h, "escritorio"]],
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
