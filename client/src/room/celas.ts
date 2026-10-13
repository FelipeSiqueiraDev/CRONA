import { getFurni, type RoomMap } from '@crona/shared';
import { iso } from '../render/iso';

/**
 * As celas da cena: cada porta de cela (def.cela) fecha um pedaço do cômodo, achado a partir
 * dela (as casas de dentro, até as paredes). Fechada, a cela fica no escuro (o chão, o que tem
 * dentro, a luz dela e quem estiver lá); aberta, acende aos poucos e a parede que fica entre
 * ela e a câmera vira transparente, para ver lá dentro.
 */
export interface Cela {
  porta: number;
  /** as casas de dentro, "x,y" */
  casas: Set<string>;
}

/** O efeito das celas num quadro. */
export interface EfeitoCelas {
  /** o escuro de cada casa de dentro de uma cela (0 = acesa, 1 = fechada) */
  casa: Map<string, number>;
  /** por mobi: o escuro (o lado que a câmera vê dá para dentro de uma cela fechada) e a transparência (está entre uma cela aberta e a câmera) */
  mobi: Map<number, { escuro: number; transp: number }>;
}

/** O que fecha a cela: as paredes e as portas (a grade também, nas celas antigas). */
const PAREDES = new Set(['cell_front', 'cell_door_steel', 'cell_door', 'porta_quarto', 'bars', 'iwall', 'parede_reboco', 'iwall_window']);
/** a cela é pequena: passou disso, a porta dá para o resto do cômodo */
const MAX_CASAS = 48;

export function acharCelas(map: RoomMap): Cela[] {
  const parede = new Set<string>();
  const passagem = new Set<string>();
  const portas: { id: number; x: number; y: number; rot: number }[] = [];
  for (const it of map.allItems()) {
    const def = getFurni(it.defId);
    if (!def) continue;
    if (PAREDES.has(def.kind)) for (const c of map.tilesFor(def.id, it.x, it.y, it.rot)) parede.add(`${c.x},${c.y}`);
    if (def.portal) passagem.add(`${it.x},${it.y}`);
    if (def.cela) portas.push(it);
  }
  const celas: Cela[] = [];
  for (const p of portas) {
    // a porta fica numa parede que corre ao longo da lateral dela: a cela é um dos dois lados
    const lados: [number, number][] = p.rot === 2 || p.rot === 6 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
    let melhor: Set<string> | null = null;
    for (const [dx, dy] of lados) {
      const casas = encher(map, parede, passagem, p.x + dx, p.y + dy);
      if (casas && (!melhor || casas.size < melhor.size)) melhor = casas;
    }
    if (melhor) celas.push({ porta: p.id, casas: melhor });
  }
  return celas;
}

/** As casas ligadas a (x0, y0) sem passar por parede; null se for grande demais ou tiver passagem (não é cela). */
function encher(map: RoomMap, parede: Set<string>, passagem: Set<string>, x0: number, y0: number): Set<string> | null {
  const k0 = `${x0},${y0}`;
  if (map.floorHeight(x0, y0) === null || parede.has(k0)) return null;
  const casas = new Set([k0]);
  const fila: [number, number][] = [[x0, y0]];
  while (fila.length) {
    const [x, y] = fila.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (casas.has(k) || parede.has(k) || map.floorHeight(nx, ny) === null) continue;
      if (passagem.has(k) || map.isDoor(nx, ny)) return null;
      casas.add(k);
      if (casas.size > MAX_CASAS) return null;
      fila.push([nx, ny]);
    }
  }
  return casas;
}

/** As celas de uma cena e o quanto cada uma está acesa, que anda devagar até a porta (abre e acende aos poucos). */
export class Celas {
  private chave = NaN;
  private lista: Cela[] = [];
  private luz = new Map<number, number>();
  private antes = 0;

  quadro(map: RoomMap, now: number): EfeitoCelas | null {
    // as celas só mudam quando os móveis mudam
    let h = map.allItems().length;
    for (const it of map.allItems()) h = (Math.imul(h, 31) + it.id * 7 + it.x * 131 + it.y * 17 + it.rot) | 0;
    if (h !== this.chave) {
      this.chave = h;
      this.lista = acharCelas(map);
    }
    if (!this.lista.length) return null;
    const dt = Math.max(0, Math.min(200, now - (this.antes || now)));
    this.antes = now;
    const k = 1 - Math.exp(-dt / 170);
    const luzDaCasa = new Map<string, number>();
    const casa = new Map<string, number>();
    for (const c of this.lista) {
      const porta = map.getItem(c.porta);
      const def = porta ? getFurni(porta.defId) : null;
      const alvo = porta && def && porta.state === def.openState ? 1 : 0;
      const antes = this.luz.get(c.porta);
      // quem chega na cena vê a cela como ela está (sem acender na cara)
      const l = antes === undefined ? alvo : Math.abs(alvo - antes) < 0.004 ? alvo : antes + (alvo - antes) * k;
      this.luz.set(c.porta, l);
      for (const t of c.casas) {
        luzDaCasa.set(t, l);
        if (l < 0.999) casa.set(t, 1 - l);
      }
    }
    const mobi = new Map<number, { escuro: number; transp: number }>();
    for (const it of map.allItems()) {
      const def = getFurni(it.defId);
      if (!def) continue;
      let escuro = 0;
      let transp = 0;
      /** o escuro da cela para onde dá o lado da parede que a câmera vê */
      let beira = 0;
      for (const t of map.tilesFor(def.id, it.x, it.y, it.rot)) {
        const l = luzDaCasa.get(`${t.x},${t.y}`);
        if (l !== undefined) {
          escuro = Math.max(escuro, 1 - l);
          continue;
        }
        if (!PAREDES.has(def.kind)) continue;
        // na beira da cela: o lado que a câmera vê (+x, +y) dá para dentro dela, então fica na sombra
        // (não preto como o que está dentro: a parede ainda se lê como parede)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ]) {
          const l2 = luzDaCasa.get(`${t.x + dx},${t.y + dy}`);
          if (l2 !== undefined) beira = Math.max(beira, 1 - l2);
        }
        // e a cela atrás dela (-x, -y): aberta, a parede fica transparente para ver lá dentro
        for (const [dx, dy] of [
          [-1, 0],
          [0, -1],
        ]) {
          const l2 = luzDaCasa.get(`${t.x + dx},${t.y + dy}`);
          if (l2 !== undefined) transp = Math.max(transp, l2);
        }
      }
      escuro = Math.max(escuro, 0.6 * beira);
      if (escuro > 0.001 || transp > 0.001) mobi.set(it.id, { escuro, transp });
      // a parede na beira da cela fica na borda da casa dela: o resto do chão dessa casa é de dentro da cela
      if (beira > 0.001)
        for (const t of map.tilesFor(def.id, it.x, it.y, it.rot)) {
          const k = `${t.x},${t.y}`;
          if (!luzDaCasa.has(k)) casa.set(k, Math.max(casa.get(k) ?? 0, beira));
        }
    }
    return { casa, mobi };
  }
}

/** O escuro da casa onde fica o ponto (x, y) do cômodo, ou 0 fora das celas. */
export function escuroEm(ef: EfeitoCelas | null, x: number, y: number): number {
  return ef?.casa.get(`${Math.floor(x)},${Math.floor(y)}`) ?? 0;
}

/** O chão das celas fechadas no escuro: por cima do piso, por baixo de tudo que fica em pé (uma forma por cela, sem emenda). */
export function escurecerChao(ctx: CanvasRenderingContext2D, map: RoomMap, ef: EfeitoCelas) {
  const formas = new Map<number, Path2D>();
  for (const [k, e] of ef.casa) {
    if (e < 0.01) continue;
    const [x, y] = k.split(',').map(Number);
    const z = map.floorHeight(x, y) ?? 0;
    let f = formas.get(e);
    if (!f) formas.set(e, (f = new Path2D()));
    const pts = [iso(x, y, z), iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x, y + 1, z)];
    f.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) f.lineTo(pts[i][0], pts[i][1]);
    f.closePath();
  }
  for (const [e, f] of formas) {
    ctx.fillStyle = `rgba(4, 4, 7, ${(0.86 * e).toFixed(3)})`;
    ctx.fill(f);
  }
}

/** Escurece o contorno de um mobi (ou item de parede) que fica dentro de uma cela fechada, por cima do desenho dele. */
export function escurecerForma(ctx: CanvasRenderingContext2D, pts: [number, number][], escuro: number) {
  if (escuro < 0.01 || pts.length < 3) return;
  ctx.fillStyle = `rgba(4, 4, 7, ${(0.84 * escuro).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}
