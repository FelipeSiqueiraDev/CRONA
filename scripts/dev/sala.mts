// A planta de uma sala em texto, para arrumar os móveis (17/10): cada casa com a letra do móvel que está nela,
// "." chão livre aonde se chega da porta, "!" chão livre preso, "#" parede, "D" a porta. Embaixo, a legenda.
//
//   npx tsx scripts/dev/sala.mts "Sede · Bar" ["Fazenda · Quarto 3" ...]
import { footprint, getFurni, RoomMap } from "../../shared/src/index.ts";
import { seedDb, upgradeDb } from "../../server/src/seed.ts";

const db = seedDb();
upgradeDb(db);
const PORTAS = new Set(["cell_door", "cell_door_steel", "iwall_door", "porta_quarto"]);
for (const nome of process.argv.slice(2)) {
  const r = db.rooms.find((s) => s.name === nome);
  if (!r) {
    console.log(`?? ${nome}`);
    continue;
  }
  const linhas = r.heightmap.replace(/\r/g, "").split("\n");
  const map = new RoomMap(r.heightmap, r.door, r.items.filter((i) => !PORTAS.has(getFurni(i.defId)?.kind ?? "")));
  const vistos = new Set([`${r.door.x},${r.door.y}`]);
  const fila: [number, number][] = [[r.door.x, r.door.y]];
  while (fila.length) {
    const [x, y] = fila.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (vistos.has(k) || map.walkState(x + dx, y + dy) !== "walk") continue;
      vistos.add(k);
      fila.push([x + dx, y + dy]);
    }
  }
  const grade = linhas.map((l) => [...l].map((c) => (c === "x" ? "#" : " ")));
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const legenda: string[] = [];
  r.items.forEach((it, n) => {
    const d = getFurni(it.defId);
    if (!d) return;
    const fp = footprint(d, it.rot);
    const l = letras[n % letras.length];
    if (!/ceiling_lamp|fluorescent/.test(d.kind)) legenda.push(`${l}=${it.defId}@${it.x},${it.y} r${it.rot}${it.z > 0.05 ? ` z${it.z.toFixed(1)}` : ""}`);
    for (let dy = 0; dy < fp.sy; dy++)
      for (let dx = 0; dx < fp.sx; dx++) {
        const row = grade[it.y + dy];
        if (row && row[it.x + dx] !== undefined && !/ceiling_lamp|fluorescent/.test(d.kind) && (row[it.x + dx] === " " || !(d.walkable || d.flat))) row[it.x + dx] = l;
      }
  });
  for (let y = 0; y < grade.length; y++)
    for (let x = 0; x < grade[y].length; x++) {
      if (grade[y][x] !== " ") continue;
      grade[y][x] = map.walkState(x, y) === "walk" ? (vistos.has(`${x},${y}`) ? "." : "!") : "?";
    }
  grade[r.door.y][r.door.x] = "D";
  console.log(`== ${nome} (${linhas[0].length}x${linhas.length})`);
  console.log("   " + [...Array(linhas[0].length).keys()].map((i) => i % 10).join(""));
  grade.forEach((g, y) => console.log(String(y).padStart(2) + " " + g.join("")));
  console.log(legenda.join("  "));
}
