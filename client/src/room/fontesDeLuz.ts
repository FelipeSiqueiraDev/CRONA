import { getFurni, getWallFurni, type RoomMap } from '@crona/shared';
import { furniVisual } from '../render/furniFloor';
import { wallLights } from '../render/furniWall';

/**
 * As fontes de luz do cômodo (17/10, o Felipe: "apagar todas as luzes, tipo 'desligar' elas, normal... as janelas
 * também não se fecham com isso"): lâmpadas, abajures, velas, lareiras, TVs e telas, cada uma com o estado em que
 * fica apagada e o em que fica acesa, achados pelo desenho dela (a luz que cada estado dá). A luz que entra pela janela
 * (`natural`) não conta: a janela não é apagada. Móvel que não muda de estado (a lareira sempre acesa), porta,
 * fechadura e quebrado ficam de fora.
 */
export interface FonteDeLuz {
  id: number;
  acesa: boolean;
  /** o estado apagado e o aceso (o primeiro de cada, contando do estado de agora) */
  apagada: number;
  acender: number;
}

/** A luz de verdade de um estado (a da janela não conta). */
const daLuz = (luzes: { kind?: string }[]) => luzes.some((L) => L.kind !== 'natural');

function fonte(id: number, estado: number, estados: number, temLuz: (s: number) => boolean): FonteDeLuz | null {
  let apagada = -1;
  let acender = -1;
  for (let i = 0; i < estados; i++) {
    const s = (estado + i) % estados;
    if (temLuz(s)) {
      if (acender < 0) acender = s;
    } else if (apagada < 0) apagada = s;
  }
  if (apagada < 0 || acender < 0) return null;
  return { id, acesa: temLuz(estado), apagada, acender };
}

export function fontesDeLuz(map: RoomMap): FonteDeLuz[] {
  const out: FonteDeLuz[] = [];
  for (const it of map.allItems()) {
    const def = getFurni(it.defId);
    if (!def?.states || def.states < 2 || def.portal || def.openState !== undefined || it.lock || it.quebrado) continue;
    const f = fonte(it.id, it.state, def.states, (s) => daLuz(furniVisual(def, s, it.id).lights));
    if (f) out.push(f);
  }
  for (const it of map.allWallItems()) {
    const def = getWallFurni(it.defId);
    if (!def?.states || def.states < 2) continue;
    const f = fonte(it.id, it.state, def.states, (s) => daLuz(wallLights(def, s)));
    if (f) out.push(f);
  }
  return out;
}
