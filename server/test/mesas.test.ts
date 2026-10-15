import assert from "node:assert/strict";
import { test } from "node:test";
import { footprint, getFurni } from "@crona/shared";
import { seedDb, upgradeDb } from "../src/seed";

/** A frente de cada giro (giro 4: a frente para +y; 0: -y; 2: +x; 6: -x). */
const FRENTE: Record<number, [number, number]> = { 4: [0, 1], 0: [0, -1], 2: [1, 0], 6: [-1, 0] };

test("mesa de escritório sempre virada para a cadeira dela (o Felipe, 14/10)", () => {
  const db = seedDb();
  upgradeDb(db);
  const erradas: string[] = [];
  for (const r of db.rooms) {
    if (!/^(Sede|Fazenda|Orfanato|Santo Berço)/.test(r.name)) continue;
    for (const d of r.items) {
      const def = getFurni(d.defId);
      if (!def || !/desk/.test(d.defId + def.kind)) continue;
      const fp = footprint(def, d.rot);
      const cx = d.x + fp.sx / 2;
      const cy = d.y + fp.sy / 2;
      // a cadeira mais perto (a de quem trabalha na mesa)
      let perto: { dx: number; dy: number; dist: number } | null = null;
      for (const c of r.items) {
        if (!getFurni(c.defId)?.sit || !/chair|cadeira/.test(c.defId)) continue;
        const dx = c.x + 0.5 - cx;
        const dy = c.y + 0.5 - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.6 && (!perto || dist < perto.dist)) perto = { dx, dy, dist };
      }
      if (!perto) continue;
      const [fx, fy] = FRENTE[d.rot] ?? [0, 0];
      if (perto.dx * fx + perto.dy * fy <= 0) erradas.push(`${r.name}: ${d.defId} em ${d.x},${d.y} (giro ${d.rot})`);
    }
  }
  assert.deepEqual(erradas, []);
});
