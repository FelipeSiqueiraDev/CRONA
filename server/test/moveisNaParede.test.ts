import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { footprint, getFurni, RoomMap } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";

/**
 * A arrumação dos cômodos, em TODAS as cenas do jogo (o Felipe, 17/10: "esses móveis ninguém coloca no meio da sala,
 * coloca num canto na parede"; "o mesmo teste tem que fazer no mapa inteiro, em todos, e levar isso de regra para os
 * próximos"). Vale para toda cena nova também.
 *
 * 1. O móvel de parede (TV, guarda-roupa, fogão, geladeira, pia, estante, arquivo, cômoda, lareira, cama...) fica
 *    encostado numa das paredes que a câmera mostra, de costas para ela: no giro 4 com a parede de trás logo atrás
 *    dele, ou no giro 2 com a parede da esquerda. Numa divisória de dentro (a parede da cela, a do banheiro), que é
 *    desenhada inteira, vale de qualquer lado. Nas paredes da frente (que não aparecem) ele mostraria as costas, e no
 *    meio da sala fica "jogado". Mesa, sofá, cadeira, tapete e mesa de centro podem ficar soltos.
 * 2. Todo chão livre se alcança a pé a partir da porta: nada de canto preso atrás de móvel, nem volta pela TV para
 *    chegar à mesa. As portas de dentro contam como abertas (fechadas, abrem com o clique duplo).
 * 3. Todo móvel se alcança: tem pelo menos uma casa do lado dele aonde a peça chega a pé ("é um tabuleiro, o
 *    personagem tem que ANDAR pelas cenas e acessar todos os móveis").
 *
 * As regras 2 e 3 não valem nas cenas bagunçadas de propósito (o Felipe: "a não ser que a gente esteja construindo
 * uma cena tipo no Orfanato, que as coisas estão quebradas, queimadas, bagunçadas; aí é até legal, cria um desafio
 * para chegar num lugar"). A regra 1 vale em todas.
 */

/** os móveis que vivem encostados numa parede */
const DE_PAREDE = new Set([
  "armario", "bar_shelf", "bookshelf", "box_chuveiro", "beer_fridge", "frigobar", "fogao", "fogao_gas", "geladeira",
  "lareira", "locker", "medical_cabinet", "pia_cozinha", "rack_tv", "shelf", "sink", "toilet", "tanque", "maquina_lavar",
  "weapon_rack", "rack_medieval", "file_cabinet", "jukebox", "freezer_acai", "chapa_lanche", "bed", "beliche",
]);
/** a cama queimada (escombro) e a rede (pendurada entre dois esteios) não contam */
const SOLTOS = new Set(["cama_queimada", "igarape_rede"]);
/** as divisórias de dentro valem como parede, dos dois lados */
const DIVISORIAS = new Set(["iwall", "iwall_door", "iwall_window", "cell_front", "bars", "parede_reboco", "cell_door", "cell_door_steel"]);
/** as portas de dentro */
const PORTAS = new Set(["cell_door", "cell_door_steel", "iwall_door", "porta_quarto"]);
/** os lugares bagunçados de propósito (queimados, desabados), onde chegar a um canto pode ser o desafio */
const BAGUNCADOS = ["Orfanato · "];
/** o que não é móvel de chegar perto: o que fica no teto, no chão, na parede de dentro, a passagem */
const NAO_E_MOVEL = new Set([
  "ceiling_lamp", "fluorescent", "vent", "rug", "dirt", "blood", "blood_small", "lodo", "neblina", "olhos", "sigil", "pilha",
  "portal", "entrada", "passagem", "iwall", "iwall_door", "iwall_window", "cell_front", "bars", "cell_door", "cell_door_steel",
  "parede_reboco", "porta_quarto", "escada_desce", "stairs_down", "stairs_up", "escada_vertical", "alcapao", "escotilha", "divider",
  "cerca",
]);

describe("os móveis encostados na parede, em todas as cenas", () => {
  const db = seedDb();
  upgradeDb(db);
  const salas = db.rooms.filter((r) => !r.aberto);

  test("móvel de parede encostado numa parede que aparece, de frente para a sala", () => {
    const erros: string[] = [];
    for (const r of salas) {
      const linhas = r.heightmap.replace(/\r/g, "").split("\n");
      const divisoria = new Set<string>();
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (!d || !DIVISORIAS.has(d.kind)) continue;
        const fp = footprint(d, it.rot);
        for (let dy = 0; dy < fp.sy; dy++) for (let dx = 0; dx < fp.sx; dx++) divisoria.add(`${it.x + dx},${it.y + dy}`);
      }
      const daSala = (x: number, y: number) => y < 0 || y >= linhas.length || x < 0 || x >= linhas[y].length || linhas[y][x] === "x";
      const parede = (x: number, y: number) => daSala(x, y) || divisoria.has(`${x},${y}`);
      const map = new RoomMap(r.heightmap, r.door, []);
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (!d || !DE_PAREDE.has(d.kind) || SOLTOS.has(d.id)) continue;
        if (it.z > (map.floorHeight(it.x, it.y) ?? 0) + 0.05) continue; // em cima de outro móvel
        const fp = footprint(d, it.rot);
        const costas: [number, number][] =
          it.rot === 4 ? Array.from({ length: fp.sx }, (_, dx) => [it.x + dx, it.y - 1])
          : it.rot === 2 ? Array.from({ length: fp.sy }, (_, dy) => [it.x - 1, it.y + dy])
          : it.rot === 6 ? Array.from({ length: fp.sy }, (_, dy) => [it.x + fp.sx, it.y + dy])
          : Array.from({ length: fp.sx }, (_, dx) => [it.x + dx, it.y + fp.sy]);
        const ok = it.rot === 4 || it.rot === 2 ? costas.every(([x, y]) => parede(x, y)) : costas.every(([x, y]) => divisoria.has(`${x},${y}`));
        if (!ok) erros.push(`${r.name}: ${it.defId} em ${it.x},${it.y} (giro ${it.rot})`);
      }
    }
    assert.deepEqual(erros, [], `${erros.length} móvel(is) fora da parede:\n${erros.join("\n")}`);
  });

  /** As casas aonde a peça chega a pé a partir da porta (as portas de dentro abertas). */
  function alcancaveis(r: (typeof salas)[number]) {
    const map = new RoomMap(r.heightmap, r.door, r.items.filter((i) => !PORTAS.has(getFurni(i.defId)?.kind ?? "")));
    const anda = (x: number, y: number) => map.walkState(x, y) === "walk";
    const vistos = new Set([`${r.door.x},${r.door.y}`]);
    const fila: [number, number][] = [[r.door.x, r.door.y]];
    while (fila.length) {
      const [x, y] = fila.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (vistos.has(k) || !anda(x + dx, y + dy)) continue;
        vistos.add(k);
        fila.push([x + dx, y + dy]);
      }
    }
    return { vistos, anda, map };
  }
  const arrumadas = salas.filter((r) => !BAGUNCADOS.some((b) => r.name.startsWith(b)));

  test("todo chão livre se alcança a pé a partir da porta", () => {
    const erros: string[] = [];
    for (const r of arrumadas) {
      const { vistos, anda } = alcancaveis(r);
      const linhas = r.heightmap.replace(/\r/g, "").split("\n");
      // o vão embaixo da mesa (que dá para pisar) não é chão livre: só conta a casa sem nada em cima
      const ocupada = new Set<string>();
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (!d || d.flat || NAO_E_MOVEL.has(d.kind)) continue;
        const fp = footprint(d, it.rot);
        for (let dy = 0; dy < fp.sy; dy++) for (let dx = 0; dx < fp.sx; dx++) ocupada.add(`${it.x + dx},${it.y + dy}`);
      }
      const presos: string[] = [];
      for (let y = 0; y < linhas.length; y++)
        for (let x = 0; x < linhas[y].length; x++) if (anda(x, y) && !vistos.has(`${x},${y}`) && !ocupada.has(`${x},${y}`)) presos.push(`${x},${y}`);
      if (presos.length) erros.push(`${r.name}: ${presos.length} casa(s) presa(s) (${presos.join(" ")})`);
    }
    assert.deepEqual(erros, [], `${erros.length} sala(s) com chão preso:\n${erros.join("\n")}`);
  });

  test("todo móvel se alcança: uma casa do lado dele aonde a peça chega a pé", () => {
    const erros: string[] = [];
    for (const r of arrumadas) {
      const { vistos, map } = alcancaveis(r);
      // quem chega na cadeira chega na mesa: as cadeiras (e bancos) do lado de uma casa aonde se chega contam como
      // alcançadas; e a pilha (os fardos de feno, as caixas, os barris juntos) conta inteira se um deles se alcança
      const ao = (x: number, y: number, set: Set<string>) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${x + dx},${y + dy}`));
      const alcanca = new Set(vistos);
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (d?.sit && ao(it.x, it.y, vistos)) alcanca.add(`${it.x},${it.y}`);
      }
      const pilha = new Map<string, string>();
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (d && ["feno", "crate", "barrel", "crate_metal", "sacas", "lenha", "pilha_cranios", "skull"].includes(d.kind)) pilha.set(`${it.x},${it.y}`, d.kind);
      }
      for (let mudou = true; mudou; ) {
        mudou = false;
        for (const [k, kind] of pilha) {
          if (alcanca.has(k)) continue;
          const [x, y] = k.split(",").map(Number);
          if (ao(x, y, vistos) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => alcanca.has(`${x + dx},${y + dy}`) && pilha.get(`${x + dx},${y + dy}`) === kind)) {
            alcanca.add(k);
            mudou = true;
          }
        }
      }
      for (const it of r.items) {
        const d = getFurni(it.defId);
        if (!d || d.walkable || d.flat || NAO_E_MOVEL.has(d.kind)) continue;
        if (it.z > (map.floorHeight(it.x, it.y) ?? 0) + 0.05) continue; // em cima de outro: vale o de baixo
        const fp = footprint(d, it.rot);
        let chega = alcanca.has(`${it.x},${it.y}`) && !d.sit;
        for (let dy = -1; dy <= fp.sy && !chega; dy++)
          for (let dx = -1; dx <= fp.sx && !chega; dx++) {
            const dentro = dx >= 0 && dx < fp.sx && dy >= 0 && dy < fp.sy;
            const lado = (dx === -1 || dx === fp.sx) !== (dy === -1 || dy === fp.sy); // sem as diagonais
            if (!dentro && lado && (vistos.has(`${it.x + dx},${it.y + dy}`) || alcanca.has(`${it.x + dx},${it.y + dy}`))) chega = true;
          }
        // a cadeira e a banqueta: a peça senta nelas, então basta chegar na casa delas
        if (!chega && d.sit && vistos.has(`${it.x},${it.y}`)) chega = true;
        if (!chega) erros.push(`${r.name}: ${it.defId} em ${it.x},${it.y}`);
      }
    }
    assert.deepEqual(erros, [], `${erros.length} móvel(is) aonde não se chega:\n${erros.join("\n")}`);
  });
});
