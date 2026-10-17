import type { FurniDef, WallFurniDef } from '@crona/shared';
import { furniVisual } from './furniFloor';
import { wallLights } from './furniWall';
import { estadoSoprado } from './sopro';

/** Os estados de desenhar da vela soprada (sopro.ts), para o móvel de chão e o de parede. */
const temFogo = (luzes: { kind?: string }[]) => luzes.some((L) => L.kind === 'fire');

/** O estado do móvel de chão para desenhar (o aceso, enquanto a chama encolhe). */
export function estadoDoMovel(it: { id: number; state: number }, def: FurniDef): number {
  if (!def.states || def.states < 2) return it.state;
  return estadoSoprado(it.id, it.state, (s) => temFogo(furniVisual(def, s, it.id).lights));
}

/** O mesmo, do item de parede (a arandela de velas). */
export function estadoDaParede(it: { id: number; state: number }, def: WallFurniDef): number {
  if (!def.states || def.states < 2) return it.state;
  return estadoSoprado(it.id, it.state, (s) => temFogo(wallLights(def, s)));
}
