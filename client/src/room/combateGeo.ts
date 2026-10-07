/**
 * O que o tabuleiro sabe dizer para as regras do combate (COMBATE.md 7.2):
 * distância e faixa de alcance, adjacência, cobertura pelos mobis e pelas
 * outras peças, posição elevada, flanquear e as áreas de ritual e granada.
 * Tudo em casas do CRONA (1 casa = 0,75 m).
 */
import { combate as cb, getFurni, RoomMap, Z_PER_M } from '@crona/shared';

export interface Casa {
  x: number;
  y: number;
}

/**
 * A cobertura pela altura (DC-11, revisto em 07/10, DC-24): o corpo do alvo tem 1,8 m em pé e 1,0 m
 * agachado. Um mobi (ou escombro) com 44% do corpo dele ou mais (0,8 m em pé, 0,45 m agachado) dá
 * cobertura (+5); com a altura do corpo inteiro ou mais, tapa tudo (cobertura total). O mestre corrige
 * na chave da tela.
 */
export const ALTURA_EM_PE = 1.8;
export const ALTURA_AGACHADO = 1.0;
const FRACAO_COBRE = 0.44;
const fmtM = (m: number) => `${(Math.round(m * 100) / 100).toLocaleString('pt-BR')} m`;

export type TipoCobertura = 'nenhuma' | 'cobertura' | 'total';

export interface Cobertura {
  tipo: TipoCobertura;
  /** onde a reta bate (para o escudo no tabuleiro) */
  casa?: Casa;
  /** o que cobre: "mesa", "outro ser", "parede" */
  nome?: string;
  /** a altura do que cobre, em metros (mobi e escombro) */
  altura?: number;
}

const mesma = (a: Casa, b: Casa) => a.x === b.x && a.y === b.y;

/** Casas que a reta entre os centros atravessa, sem as das pontas. */
export function casasNaReta(a: Casa, b: Casa): Casa[] {
  const out: Casa[] = [];
  const ax = a.x + 0.5;
  const ay = a.y + 0.5;
  const dx = b.x + 0.5 - ax;
  const dy = b.y + 0.5 - ay;
  const n = Math.max(2, Math.ceil(Math.hypot(dx, dy) * 8));
  let ult = '';
  for (let i = 1; i < n; i++) {
    const c = { x: Math.floor(ax + (dx * i) / n), y: Math.floor(ay + (dy * i) / n) };
    const k = `${c.x},${c.y}`;
    if (k === ult || mesma(c, a) || mesma(c, b)) continue;
    ult = k;
    out.push(c);
  }
  return out;
}

/**
 * Cobertura pela reta de centro a centro: mobi de 0,8 m ou mais, outra peça no
 * meio, ou parede (fora do piso) e porta fechada, que tapam tudo. O livro usa
 * as retas dos cantos (p. 89); aqui fica a reta do meio, e o mestre corrige a
 * chave na tela.
 */
export function cobertura(map: RoomMap, a: Casa, b: Casa, outras: Casa[], agachado = false): Cobertura {
  const corpo = agachado ? ALTURA_AGACHADO : ALTURA_EM_PE;
  const COBRE = corpo * FRACAO_COBRE * Z_PER_M;
  const PAREDE = corpo * Z_PER_M;
  let achou: Cobertura = { tipo: 'nenhuma' };
  for (const c of casasNaReta(a, b)) {
    const piso = map.floorHeight(c.x, c.y);
    if (piso === null) return { tipo: 'total', casa: c, nome: 'parede' };
    for (const it of map.itemsAt(c.x, c.y)) {
      const def = getFurni(it.defId);
      if (!def || def.flat || def.walkable || def.portal) continue;
      // porta: aberta deixa passar; fechada tapa como parede
      if (def.openState !== undefined) {
        if (it.state === def.openState) continue;
        return { tipo: 'total', casa: c, nome: def.name.toLowerCase() };
      }
      const alto = it.z - piso + def.height;
      const metros = alto / Z_PER_M;
      const nome = `${def.name.toLowerCase()} (${fmtM(metros)})`;
      // tapa o corpo todo: o alvo não pode ser atingido por aí
      if (alto >= PAREDE) return { tipo: 'total', casa: c, nome, altura: metros };
      if (alto >= COBRE && achou.tipo === 'nenhuma') achou = { tipo: 'cobertura', casa: c, nome, altura: metros };
    }
    if (achou.tipo === 'nenhuma' && outras.some((o) => mesma(o, c))) achou = { tipo: 'cobertura', casa: c, nome: 'outro ser' };
  }
  return achou;
}

/** Posição elevada: o atacante está pelo menos 1 m acima do alvo (DC-9). */
export function elevado(map: RoomMap, a: Casa, b: Casa): boolean {
  return map.standHeight(a.x, a.y) - map.standHeight(b.x, b.y) >= Z_PER_M - 1e-6;
}

/** Flanquear: um aliado adjacente ao alvo, do lado oposto: a reta entre vocês passa pelo espaço dele (LR p. 90). */
export function flanqueia(atacante: Casa, alvo: Casa, aliados: Casa[]): boolean {
  if (!cb.adjacente(atacante, alvo)) return false;
  const ax = atacante.x + 0.5;
  const ay = atacante.y + 0.5;
  const tx = alvo.x + 0.5;
  const ty = alvo.y + 0.5;
  for (const al of aliados) {
    if (!cb.adjacente(al, alvo) || mesma(al, atacante)) continue;
    const bx = al.x + 0.5;
    const by = al.y + 0.5;
    const vx = bx - ax;
    const vy = by - ay;
    const L = vx * vx + vy * vy;
    if (!L) continue;
    const t = ((tx - ax) * vx + (ty - ay) * vy) / L;
    if (t <= 0 || t >= 1) continue;
    const px = ax + vx * t - tx;
    const py = ay + vy * t - ty;
    if (Math.hypot(px, py) <= 0.5) return true;
  }
  return false;
}

// ------------------------------------------------------------------ áreas

export type FormaArea = 'esfera' | 'cone' | 'linha' | 'cubo';
export const FORMAS: { id: FormaArea; nome: string }[] = [
  { id: 'esfera', nome: 'Esfera' },
  { id: 'cone', nome: 'Cone' },
  { id: 'linha', nome: 'Linha' },
  { id: 'cubo', nome: 'Cubo' },
];

export interface Area {
  forma: FormaArea;
  /** esfera: raio; cubo: lado; cone e linha: comprimento (em metros) */
  metros: number;
  /** de onde sai o cone e a linha (quem conjura) */
  origem: Casa;
  /** centro da esfera e do cubo, ou para onde o cone e a linha apontam */
  alvo: Casa;
}

/** Contorno da área no chão, em coordenadas de casa (centros em x + 0,5). */
export function contornoArea(a: Area): [number, number][] {
  const L = a.metros / cb.METROS_POR_CASA;
  const cx = a.alvo.x + 0.5;
  const cy = a.alvo.y + 0.5;
  if (a.forma === 'esfera') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 64; i++) pts.push([cx + L * Math.cos((i / 64) * Math.PI * 2), cy + L * Math.sin((i / 64) * Math.PI * 2)]);
    return pts;
  }
  if (a.forma === 'cubo') {
    const h = L / 2;
    return [
      [cx - h, cy - h],
      [cx + h, cy - h],
      [cx + h, cy + h],
      [cx - h, cy + h],
    ];
  }
  const ox = a.origem.x + 0.5;
  const oy = a.origem.y + 0.5;
  let dx = cx - ox;
  let dy = cy - oy;
  const n = Math.hypot(dx, dy) || 1;
  dx /= n;
  dy /= n;
  // perpendicular
  const px = -dy;
  const py = dx;
  if (a.forma === 'cone') {
    // a largura no fim é igual ao comprimento (LR p. 120)
    return [
      [ox, oy],
      [ox + dx * L + (px * L) / 2, oy + dy * L + (py * L) / 2],
      [ox + dx * L - (px * L) / 2, oy + dy * L - (py * L) / 2],
    ];
  }
  // linha de 1,5 m de largura (2 casas)
  const w = 1.5 / cb.METROS_POR_CASA / 2;
  return [
    [ox + px * w, oy + py * w],
    [ox + dx * L + px * w, oy + dy * L + py * w],
    [ox + dx * L - px * w, oy + dy * L - py * w],
    [ox - px * w, oy - py * w],
  ];
}

function dentroPoligono(x: number, y: number, pts: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** O centro da casa está dentro da área? */
export function naArea(a: Area, c: Casa): boolean {
  const x = c.x + 0.5;
  const y = c.y + 0.5;
  if (a.forma === 'esfera') return Math.hypot(x - (a.alvo.x + 0.5), y - (a.alvo.y + 0.5)) <= a.metros / cb.METROS_POR_CASA + 1e-6;
  return dentroPoligono(x, y, contornoArea(a));
}
