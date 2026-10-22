import { RoomMap, type FloorItem } from '@crona/shared';
import type { Database, RoomData } from './db';

/**
 * Os retoques do Igarapé (22/10, o Felipe: "vamos atacar o Igarapé"), da conferência dos cenários: a cerca solta atrás
 * das casas do sul, as canoas longe da água e os três ipês iguais.
 *
 * O seedIgarape.ts já sai com isso certo; aqui a cidade que já está no banco é retocada no lugar, sem refazer a cena
 * (subir IGARAPE_REV apagaria o que o mestre arrumou à mão). Roda uma vez (`db.retoquesIgarape2210`) e só mexe no que
 * ainda está onde o seed antigo botou.
 *
 * Só arte que já existe: o ipê tem uma silhueta diferente em cada giro, então cada um vira para um lado.
 */
const CIDADE = 'Igarapé · Cidade';

/** [x, y, giro] */
type Pos = [number, number, number];

/** as canoas: de onde estavam para a beira do barro, de ponta a ponta na margem (o rio tem 4 casas de largura) */
const CANOAS: [de: [number, number], para: Pos][] = [
  [[26, 36], [28, 26, 4]], // a margem de cá, ao norte da palafita
  [[35, 23], [34, 22, 4]], // a margem de lá, junto da ponte
  [[34, 34], [33, 34, 4]], // a margem de lá, abaixo da outra palafita
];
/** os ipês: de onde estavam e o giro novo (o do largo, na frente da capela, fica como está) */
const IPES: [de: [number, number], giro: number][] = [
  [[11, 15], 4],
  [[37, 16], 2],
];
/** o barril que estava onde a canoa agora fica */
const BARRIL: [de: [number, number], para: [number, number]] = [[28, 27], [27, 27]];

/** a cerca solta (a única carreira de 7) vira o fundo do quintal; o quintal da horta fecha nas paredes da casa 4 */
const CERCA_ANTIGA = [3, 4, 5, 6, 7, 8, 9].map((x) => [x, 30] as [number, number]);
const HORTA = { x0: 2, x1: 8, y0: 30, y1: 36, portao: 33 };
const ARBUSTOS_DA_HORTA: [string, number, number][] = [
  ['arbusto', 4, 32], ['arbusto', 6, 32], ['arbusto', 4, 34], ['arbusto', 6, 34],
  ['igarape_cesto', 7, 33], ['igarape_cesto', 3, 35],
];

const mapaDe = (r: RoomData) => new RoomMap(r.heightmap, r.door, r.items, r.wallItems);

function tirar(r: RoomData, it: FloorItem) {
  r.items.splice(r.items.indexOf(it), 1);
}

/** põe o móvel no lugar novo se a casa aceitar; se não, ele fica onde estava */
function mover(r: RoomData, it: FloorItem, x: number, y: number, rot: number): boolean {
  const antes = { x: it.x, y: it.y, z: it.z, rot: it.rot };
  tirar(r, it);
  const res = mapaDe(r).canPlace(it.defId, x, y, rot);
  if (res.ok) Object.assign(it, { x, y, z: res.z, rot });
  else Object.assign(it, antes);
  r.items.push(it);
  return res.ok;
}

function por(db: Database, r: RoomData, defId: string, x: number, y: number, rot: number): boolean {
  const res = mapaDe(r).canPlace(defId, x, y, rot);
  if (!res.ok) return false;
  r.items.push({ id: db.nextItemId++, defId, x, y, z: res.z, rot, state: 0 });
  return true;
}

export function retoquesIgarape2210(db: Database): boolean {
  const d = db as Database & { retoquesIgarape2210?: boolean };
  if (d.retoquesIgarape2210) return false;
  d.retoquesIgarape2210 = true;
  const r = db.rooms.find((q) => q.name === CIDADE);
  if (!r) return true;
  const em = (defId: string, x: number, y: number) => r.items.find((i) => i.defId === defId && i.x === x && i.y === y);

  // o arbusto que estava no caminho da canoa de lá
  const arbusto = r.items.find((i) => i.defId === 'arbusto' && i.x === 33 && i.y === 37);
  if (arbusto) tirar(r, arbusto);
  for (const [[x, y], para] of CANOAS) {
    const it = em('igarape_canoa', x, y);
    if (it) mover(r, it, ...para);
  }
  for (const [[x, y], giro] of IPES) {
    const it = em('igarape_ipe', x, y);
    if (it) it.rot = giro;
  }
  const barril = em('barrel', ...BARRIL[0]);
  if (barril) mover(r, barril, BARRIL[1][0], BARRIL[1][1], barril.rot);

  // a horta: só se a cerca solta ainda está inteira como o seed antigo deixou
  const cerca = CERCA_ANTIGA.map(([x, y]) => em('cerca', x, y));
  if (!cerca.every(Boolean)) return true;
  for (const it of cerca) tirar(r, it!);
  const { x0, x1, y0, y1, portao } = HORTA;
  // o que cresceu no meio do quintal sai (árvore, arbusto)
  for (const it of [...r.items])
    if (/^(arvore|arbusto)/.test(it.defId) && it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1) tirar(r, it);
  for (let x = x0; x <= x1; x++) {
    por(db, r, 'cerca', x, y0, 4);
    por(db, r, 'cerca', x, y1, 4);
  }
  for (let y = y0 + 1; y < y1; y++) if (y !== portao) por(db, r, 'cerca', x0, y, 2);
  for (const [id, x, y] of ARBUSTOS_DA_HORTA) por(db, r, id, x, y, 0);
  return true;
}
